# Providers

Every external capability is behind an interface with a working no-credential fallback. The app boots and runs the full demo flow with zero API keys; adding keys upgrades individual capabilities without code changes.

`src/lib/env.ts` validates configuration at startup and silently downgrades any provider whose credentials are missing (e.g. `AI_PROVIDER=anthropic` without `ANTHROPIC_API_KEY` runs as `mock`). The active configuration is shown on the Settings page.

## AI guidance — `AI_PROVIDER`

| Value | Requires | Behavior |
|---|---|---|
| `anthropic` | `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`, default `claude-sonnet-4-6`) | Real structured guidance and post-call reviews |
| `mock` | nothing | Deterministic provider that reads the retrieved context injected into the prompt and returns schema-valid JSON. The full loop (detection → retrieval → validation → guardrails → UI) is exercisable offline |

Both providers are subject to the same zod validation, retry-once policy, and source sanitization; the mock cannot bypass guardrails because guardrails live outside the provider.

## Embeddings — `EMBEDDING_PROVIDER`

| Value | Requires | Behavior |
|---|---|---|
| `openai` | `OPENAI_API_KEY` | `text-embedding-3-small`, 1536 dimensions |
| `local` | nothing | Hashed character n-gram embedding, 384 dimensions. Weaker semantics than a real model but honest: it is a real vector-space ranking, not a keyword grep |

If you switch providers after ingesting documents, reprocess them (Documents → reprocess) so query and chunk vectors share a space.

## Transcription — `TRANSCRIPTION_PROVIDER`

| Value | Requires | Behavior |
|---|---|---|
| `simulated` | nothing | Mode A: type or paste turns in the live workspace; a simulated feed is also available for demos |
| `deepgram` | `DEEPGRAM_API_KEY` | Streaming STT over raw WebSocket. **Implemented but not verified against the live API** (no key available in this environment). Treat as beta until exercised |

## Storage — `STORAGE_DRIVER`

| Value | Requires | Behavior |
|---|---|---|
| `local` | `STORAGE_LOCAL_PATH` (default `./storage`) | Path-traversal-safe local disk |
| `s3` | `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (+ optional `S3_ENDPOINT`) | Hand-rolled SigV4 PUT/GET/DELETE, no AWS SDK. **Implemented but not verified against a live bucket** |

## Email — password reset

| Config | Behavior |
|---|---|
| `RESEND_API_KEY` set | Reset emails sent via Resend (`EMAIL_FROM` configurable) |
| unset | Reset link printed to the server console; the flow still completes |

## Integrations (in-app connectors)

Configured in Settings by an admin, not by environment variables. All connectors are read-only by design; TCC never writes to customer systems.

| Provider | Status |
|---|---|
| HubSpot | Real. Private-app token, verified with a read-only test call before the encrypted credential is saved. Only a hint (last 4) is ever shown afterwards |
| mock | Always available; returns fixed sample records for demos |
| Salesforce, Jira, Asana, GitHub, Slack, Google Drive, Notion, Confluence, Zendesk | Listed as **planned**; connecting them is intentionally blocked rather than faked |
