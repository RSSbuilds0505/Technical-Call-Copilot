# Deploying the pilot to Railway

Target: a single-instance deployment for one operator using the app on live client calls. Not yet a multi-customer production setup. See `docs/build-plan.md` for what that additionally requires.

## Why a persistent process

The live bus and the ingestion queue run in the app process, and the call workspace holds an open server-sent-event stream. This requires a long-lived Node process. Railway's default service model provides that. A serverless platform would break the live stream, which is why Vercel is not an option here despite this being a Next.js app.

For the same reason: **keep `numReplicas` at 1**. Two instances would each hold their own live bus, so a guidance card generated on instance A would never reach a browser connected to instance B. Scaling horizontally requires moving the bus and queue to Redis first.

## 1. Provision

1. Create a Railway project, then **New > Database > PostgreSQL**.
2. **New > GitHub Repo** and point it at this repository. Railway reads `railway.json` and `nixpacks.toml` automatically.
3. In the app service under **Variables**, add a reference to the database: `DATABASE_URL = ${{Postgres.DATABASE_URL}}`.

## 2. Generate secrets

Run locally, then paste each value into Railway's variables. Do not reuse development values.

```bash
openssl rand -hex 32   # AUTH_SECRET
openssl rand -hex 32   # CREDENTIAL_ENCRYPTION_KEY
```

`CREDENTIAL_ENCRYPTION_KEY` decrypts every stored integration credential. If it is lost, those credentials are unrecoverable and must be reconnected by hand. Keep a copy in a password manager, not only in Railway.

## 3. Variables

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Railway reference, not a literal |
| `AUTH_SECRET` | generated | Rotating it signs out every session |
| `CREDENTIAL_ENCRYPTION_KEY` | generated | 64 hex characters, back this up |
| `APP_URL` | `https://<your-domain>` | Used in password reset links |
| `AI_PROVIDER` | `anthropic` | Falls back to `mock` if the key is missing |
| `ANTHROPIC_API_KEY` | your key | |
| `AI_DAILY_TOKEN_CAP` | `750000` | Per organization per UTC day. `0` disables the cap |
| `EMBEDDING_PROVIDER` | `openai` | `local` works without a key but retrieves less well |
| `OPENAI_API_KEY` | your key | Only needed for `openai` embeddings |
| `TRANSCRIPTION_PROVIDER` | `simulated` | Browser dictation does not use this |
| `STORAGE_DRIVER` | `local` | With the volume below |
| `STORAGE_LOCAL_PATH` | `/data/storage` | Must point at the mounted volume |
| `RESEND_API_KEY` | your key | Without it, reset links print to logs |
| `EMAIL_FROM` | `noreply@yourdomain.com` | Domain must be verified in Resend |
| `NODE_ENV` | `production` | Makes session cookies secure-only |

## 4. Attach a volume

**Railway container filesystems are ephemeral.** Every redeploy wipes them. Uploaded document originals would disappear, and reprocessing a document would fail.

Chunks and embeddings live in Postgres, so retrieval keeps working after a wipe, which makes this failure quiet and easy to miss.

Fix it before the first upload: in the service, **Settings > Volumes > New Volume**, mount path `/data`. Then set `STORAGE_LOCAL_PATH=/data/storage`. Alternatively set `STORAGE_DRIVER=s3` with bucket credentials, though that path has not been verified against a live bucket.

## 5. Deploy and verify

Migrations run automatically on start via `prisma migrate deploy`.

```bash
curl https://<your-domain>/api/health
```

Expect `status: ok`, `database: connected`, and the provider list reflecting your variables. If `ai` reports `mock` when you set `anthropic`, the key is missing or malformed and the app has silently downgraded.

Then create your account at `/register`. **Do not run the seed against production**; it deletes and rebuilds demo organizations.

## 6. Before the first real call

1. Create a customer workspace for the client, including their stack, integrations, open issues, and terminology. Retrieval quality depends on this more than on anything else.
2. Upload your actual runbooks and past resolution notes. Wait for every document to reach `READY`.
3. Open the knowledge base search in the context panel and run three questions you already know the answers to. If the results are weak, the problem is the corpus, not the model.
4. Run one throwaway call end to end: consent, dictation, a pasted customer turn, a guidance card, and a generated review.
5. Confirm your browser is Chrome or Edge. Dictation does not work in Safari or Firefox.

## Operating notes

- **Dictation captures your microphone only.** With headphones on, the customer is never heard. Paste their key statements into the composer.
- **Chrome's speech recognition sends audio to a Google service.** This is a separate data flow from your configured AI provider. Disclose it alongside the consent gate, and check it against any client confidentiality terms before use.
- **Watch spend for the first week.** The health check does not report usage; the Analytics page does. The daily cap is a backstop, not a budget.
- **Back up the database.** Enable Railway's Postgres backups, and export from Settings before any risky change.

## Known limits of this configuration

| Limit | Consequence | Resolution |
|---|---|---|
| Single instance required | No horizontal scaling | Move live bus and queue to Redis |
| In-memory rate limiting | Counters reset on deploy | Move to Redis with the above |
| Retention setting not enforced | Nothing is auto-deleted | Build the retention job before making retention claims |
| Sessions survive password change | An old session stays valid | Add a token version to the session payload |
| No billing or self-serve signup | Manual account creation | Not needed for a solo pilot |
