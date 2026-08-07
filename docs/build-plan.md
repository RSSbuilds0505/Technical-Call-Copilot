# Build plan

Status legend: [x] complete and verified locally · [~] implemented, needs external credentials to verify · [ ] not built

## Phase 0 — Foundation
- [x] Next.js 14 + TypeScript strict + Tailwind scaffold
- [x] Prisma schema (all domain models, tenant denormalization) + initial migration
- [x] Environment validation with automatic provider downgrade (`src/lib/env.ts`)
- [x] Error envelope + `apiHandler` wrapper
- [x] AES-256-GCM credential encryption helper

## Phase 1 — Auth & tenancy
- [x] Register / login / logout (bcrypt cost 12, jose JWT httpOnly cookie)
- [x] Password reset (token table; email via Resend or console fallback)
- [x] Organization creation on register; memberships with roles
- [x] `requireTenant(minRole)` single enforcement point
- [x] RBAC hierarchy + server-side checks on every route

## Phase 2 — Customers & knowledge base
- [x] Customer CRUD with workspace fields (stack, integrations, issues, terminology, notes)
- [x] Sub-entities: contacts, technologies, integrations, issues, action items
- [x] Document upload (pdf/docx/txt/md/csv, 15MB) → chunk (1400/200) → embed → READY/FAILED
- [x] Inline job queue with retries; reprocess; soft delete
- [x] Retrieval: hard org filter, customer/org scoping, tier boosts, min-score floor

## Phase 3 — Calls & live copilot
- [x] Call setup with explicit consent gate (server rejects LIVE without consent)
- [x] Live workspace: transcript panel, guidance panel (max 3 visible), context panel
- [x] SSE stream per call with heartbeat; in-process live bus
- [x] Manual + simulated transcript entry (Mode A)
- [~] Deepgram streaming provider (implemented; needs DEEPGRAM_API_KEY to verify)
- [x] Event detection (regex heuristics, 10+ types) with fingerprint debounce/dedup
- [x] 10 quick-action prompts + free-form custom prompt
- [x] Structured AI responses validated against zod schema, one retry, error card on failure
- [x] Source sanitization (no fabricated citations) + exact no-source message
- [x] Risk tiers on actions; high-risk advisory-only; read-only connectors
- [x] Feedback loop (helpful / partially / incorrect / dismissed + outcome flags)
- [x] Analyze modes: last 30s / selected speaker segments / custom prompt
- [x] Segment edit, delete, mark-important; speaker management

## Phase 4 — Post-call & learning loop
- [x] Post-call review generation (executive/technical summaries, facts vs assumptions, commitments)
- [x] Copyable outputs: CRM note, customer email, internal note, support + engineering tickets, escalation summary
- [x] Editable + saveable review; resolution form
- [x] Confirmed resolutions republished as retrievable resolved-case documents

## Phase 5 — Admin & operations
- [x] Call history with filters; analytics computed live from stored data
- [x] Settings: org profile, retention, consent text, users/invites/roles
- [x] Integrations: HubSpot (real, read-only, verify-before-save) + mock; credential hints only
- [x] Audit log with action filter
- [x] Full-org JSON export; org soft delete
- [~] S3 storage driver (implemented SigV4; needs a bucket to verify)

## Phase 6 — Seed, tests, docs
- [x] Seed: demo org, 2 users, 4 customers, 7 KB docs, 20 built-in playbooks
- [x] Seed: flagship Apollo→HubSpot scenario (transcript, event, recommendation, feedback, resolution, resolved-case doc) + 5 more scenarios
- [x] Isolation org seeded to demonstrate tenant boundaries
- [x] Tests: tenant isolation (critical), retrieval scoping, schema contract, event detection, RBAC — 30 passing
- [x] Docs: architecture, build plan, providers, README
- [x] `tsc --noEmit` clean; `next build` verified

## Known gaps / next iterations
- [ ] Real STT verification end-to-end (needs Deepgram key + mic capture UI)
- [ ] pgvector migration once corpora grow past in-process ranking comfort
- [ ] Redis-backed live bus + queue for multi-instance deployment
- [ ] Salesforce / Jira / Slack connectors (interfaces in place, marked "planned" in settings)
- [ ] Email-based invite acceptance flow (MVP uses admin-set temporary passwords)
