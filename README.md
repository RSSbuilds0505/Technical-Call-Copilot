# Technical Call Copilot

A real-time call assistant for solutions engineers and technical CSMs. It listens to (or is fed) the call transcript, detects technical questions and issues as they happen, retrieves grounded answers from your knowledge base, and hands the specialist structured, risk-rated guidance — then turns the finished call into CRM notes, follow-up emails, tickets, and a growing library of resolved cases.

Multi-tenant, role-based, and honest about sources: if the knowledge base has no verified answer, the copilot says exactly that instead of inventing one.

## Quick start

Prerequisites: Node 20+, PostgreSQL 14+.

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Set DATABASE_URL and generate secrets:
#   AUTH_SECRET:               openssl rand -hex 32
#   CREDENTIAL_ENCRYPTION_KEY: openssl rand -hex 32
# All API keys are OPTIONAL — see docs/providers.md

# 3. Database
npx prisma migrate dev
npm run db:seed

# 4. Run
npm run dev
```

Open http://localhost:3000

## Demo login

| | |
|---|---|
| Email | `demo@example.com` |
| Password | `DemoPass123!` |

The seed builds **Meridian Solutions**, a CRM consultancy, with 4 customers, a knowledge base, 20 built-in troubleshooting playbooks, and six realistic scenarios — the flagship being *"every Apollo contact is syncing into HubSpot but the customer only wants qualified contacts"*, complete with transcript, detected event, grounded recommendation, feedback, and a confirmed resolution that was republished into the knowledge base.

A second seeded login (`manager@example.com`, same password) demonstrates the MANAGER role, and a separate organization (`isolated@example.com`) exists to demonstrate tenant isolation: log in as it and none of Meridian's data is visible anywhere.

### A good 5-minute tour

1. **Dashboard** → open the ended call *"Brightline: Apollo sync flooding HubSpot"* → **View transcript** to see detection + the guidance card with sources, risk-rated actions, and confidence.
2. Open its **review** page: generated summaries, copyable CRM note / email / tickets, and the confirmed resolution.
3. Start the drafted call *"Brightline: weekly RevOps check-in"* — the consent gate blocks going live until confirmed. Once live, type a customer turn like *"our workflow isn't enrolling anyone from the list"* and watch a guidance card arrive over SSE. Try the quick actions and the context search in the right panel.
4. **Analytics** — every number is computed from the data you just looked at.
5. **Settings** (as demo admin): team, read-only integrations, provider transparency, export, audit log.

## What works without any API keys

Everything in the demo tour. The app auto-downgrades to a deterministic mock AI, local embeddings, simulated transcription, local storage, and console-logged reset emails when keys are absent. Guardrails (schema validation, source sanitization, risk tiers) run identically in mock mode. See `docs/providers.md` for upgrading each capability.

## Verified vs implemented-but-unverified

Verified locally in this build:
- `tsc --noEmit` clean, `next build` passes, 30 tests passing (`npm test`), seed + full demo flow exercised end-to-end in mock/local/simulated mode
- HubSpot connector code paths (against the mock connector; the real HubSpot path uses the same interface and verifies the token with a read-only call before saving)

Implemented but requiring credentials/infrastructure to verify — treat as beta:
- Deepgram streaming transcription (needs `DEEPGRAM_API_KEY`)
- S3 storage driver (needs a bucket)
- Anthropic + OpenAI live providers (needs keys; both are thin, schema-validated adapters)
- Resend email delivery

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | TypeScript, no emit |
| `npx prisma migrate dev` | Apply migrations |
| `npm run db:seed` | Seed demo data (idempotent: re-running rebuilds the demo orgs) |
| `npm test` | Vitest suite (uses the `tcc_test` database, schema-pushed automatically) |

Tests expect a `tcc_test` database reachable at `postgresql://tcc:tcc@localhost:5432/tcc_test` (create with `createdb tcc_test` or adjust `tests/global-setup.ts`).

## Security posture (MVP)

- Server-side tenant enforcement on every route via `requireTenant`; org id never accepted from the client; retrieval filters by org **before** ranking (tested)
- RBAC: `ADMIN > MANAGER > SPECIALIST > READ_ONLY`, enforced server-side
- Sessions: httpOnly, SameSite=Lax JWT cookies; bcrypt cost 12
- Integration credentials AES-256-GCM encrypted at rest; only a last-4 hint is ever returned; all connectors read-only
- Consent gate: a call cannot go live until consent is explicitly confirmed
- Audit log for auth, roles, deletions, exports, integrations, resolutions

## Docs

- `docs/architecture.md` — system design, tenancy, retrieval, guardrails
- `docs/build-plan.md` — phase-by-phase status with known gaps
- `docs/providers.md` — provider matrix and configuration
