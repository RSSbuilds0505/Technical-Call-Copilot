# Architecture

Technical Call Copilot (TCC) is a single Next.js 14 App Router application backed by PostgreSQL through Prisma. Everything, including background ingestion and the live event stream, runs inside the one Node process to keep the MVP deployable anywhere Postgres is available.

## System shape

```
Browser
  │  HTTPS (session cookie: tcc_session, httpOnly JWT)
  ▼
Next.js 14 (App Router)
  ├── Server components (pages: dashboard, customers, calls, review, analytics, settings, audit)
  ├── Route handlers (/api/**) — every handler resolves the tenant first
  ├── SSE stream per live call (/api/calls/[id]/stream)
  └── Services layer (src/lib/services)
        ├── ingestion   — extract → chunk → embed → store
        ├── retrieval   — org-filtered vector ranking with tier boosts
        ├── eventDetection — regex/heuristic detection + fingerprint dedup
        ├── recommendations — prompt build → provider call → zod validate → persist → publish
        ├── postcall    — review generation, resolved-case publishing
        └── integrations — read-only connectors (HubSpot real, mock)
  ▼
PostgreSQL (Prisma) ── embeddings stored as Float[] on DocumentChunk
Local disk or S3 (uploaded files)
```

## Tenancy model

Every tenant-owned table carries `organizationId`, including denormalized copies on
`DocumentChunk`, `TranscriptSegment`, `Recommendation`, and `RecommendationFeedback` so
no query ever needs a join to enforce the boundary.

The single enforcement point is `requireTenant(minRole?)` in `src/lib/tenant.ts`:

1. Reads and verifies the JWT session cookie.
2. Loads the membership for the session's organization and rejects missing/soft-deleted orgs.
3. Optionally enforces a minimum role (RBAC below).
4. Returns a `TenantContext` whose `organizationId` is then used in **every** Prisma `where`.

Route handlers never accept an organization id from the client. Retrieval applies the
`organizationId` filter in SQL before any similarity ranking, so cross-tenant leakage
cannot occur even when another tenant's document is the best semantic match
(covered by `tests/tenant-isolation.test.ts`).

## RBAC

Roles: `ADMIN > MANAGER > SPECIALIST > READ_ONLY` (rank order in `src/lib/rbac.ts`).

| Capability | READ_ONLY | SPECIALIST | MANAGER | ADMIN |
|---|---|---|---|---|
| View calls, customers, docs, analytics | ✓ | ✓ | ✓ | ✓ |
| Run calls, submit transcript, feedback, reviews | | ✓ | ✓ | ✓ |
| Manage customers/documents (delete), audit log, view team | | | ✓ | ✓ |
| Org settings, invites, roles, integrations, delete org | | | | ✓ |

Enforcement is server-side in `requireTenant(minRole)`; the UI additionally hides
controls the role cannot use.

## Provider abstraction

Each external capability sits behind an interface with a real implementation and a
no-credential fallback. `src/lib/env.ts` validates configuration at boot and
automatically downgrades any provider whose credentials are missing, so a fresh
clone runs the complete flow offline.

| Capability | Real | Fallback | Notes |
|---|---|---|---|
| AI guidance | Anthropic (`claude-sonnet-4-6`) | `MockAIProvider` | Mock is deterministic; embeds retrieved context so guardrail behavior is testable offline |
| Embeddings | OpenAI `text-embedding-3-small` (1536-d) | Local hashed n-gram (384-d) | Dimensions can differ; cosine ranking is per-corpus |
| Transcription | Deepgram streaming (implemented, unverified without a key) | Simulated + manual entry | Mode A (manual/simulated) is the supported demo path |
| Storage | S3 (hand-rolled SigV4) | Local disk | Local path traversal guarded |
| Email (reset) | Resend | Console log of reset link | Reset flow works either way |

## Live call pipeline

1. `POST /api/calls/[id]/transcript` stores the segment (tenant-checked), publishes it on the in-process `liveBus`, and runs `detectEvent`.
2. Detection is regex/heuristic with a normalized SHA-1 fingerprint; `isDuplicateEvent` suppresses repeats inside a 5-minute window (debounce/dedup).
3. Qualifying events call `generateRecommendation` asynchronously: retrieval (customer docs → org docs → resolved cases, reranked with tier boosts), playbook matching, prompt build, provider call.
4. The model must return JSON matching `recommendationSchema` (zod). One retry on validation failure; a second failure surfaces an error event, never invalid data.
5. `sanitizeSources` drops any citation whose `documentId` is not among the actually-retrieved documents — the model cannot fabricate sources. Empty sources render the exact string: "No verified source was found in the connected knowledge base."
6. The persisted recommendation is published on `liveBus`; the browser receives it over the per-call SSE stream (15s heartbeat).

Risk guardrails: every action carries `low | medium | high` risk; high-risk actions are advisory only, flagged `requiresApproval`, and nothing in the system executes actions against customer systems (all connectors are read-only).

## Retrieval

Embeddings live on `DocumentChunk.embedding Float[]`. Query flow: embed query →
fetch up to 400 org-scoped candidate chunks (customer-scoped OR org-scoped when a
customer is attached; org-scoped only otherwise) → cosine similarity in process →
tier boost (+0.08 customer, +0.05 resolved-case) → drop scores under 0.12 → top N.
pgvector is the documented upgrade path once corpus size warrants it; the interface
would not change.

## Data lifecycle

- Documents: upload → PENDING → PROCESSING → READY/FAILED (inline queue with 3 retries); reprocess and soft-delete supported.
- Confirmed resolutions (root cause + fix + customer confirmation) are republished as `resolved-case` documents, closing the learning loop.
- Audit log records auth, permission, data-deletion, export, integration, and resolution events.
- Org deletion is a soft delete that invalidates all sessions at the membership check.

## Key decisions and trade-offs

- **Inline queue over Redis/BullMQ**: zero extra infrastructure; jobs are idempotent and retried. Documented swap point in `src/lib/providers/queue`.
- **App-side cosine over pgvector**: no extension requirement on the demo database; fine to ~10⁴ chunks per org.
- **Custom credential auth over NextAuth**: the spec requires email/password with reset; a ~60-line jose/bcrypt implementation is easier to audit than an adapter stack.
- **In-process SSE bus**: correct for a single instance; multi-instance deployment would move `liveBus` to Redis pub/sub (single documented seam).
