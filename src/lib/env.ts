import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16),
  CREDENTIAL_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i).optional().or(z.literal("")),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AI_PROVIDER: z.enum(["anthropic", "mock"]).default("mock"),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  EMBEDDING_PROVIDER: z.enum(["openai", "local"]).default("local"),
  OPENAI_API_KEY: z.string().optional().default(""),
  TRANSCRIPTION_PROVIDER: z.enum(["simulated", "deepgram"]).default("simulated"),
  DEEPGRAM_API_KEY: z.string().optional().default(""),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().default("./storage"),
  S3_BUCKET: z.string().optional().default(""),
  S3_REGION: z.string().optional().default(""),
  S3_ENDPOINT: z.string().optional().default(""),
  S3_ACCESS_KEY_ID: z.string().optional().default(""),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(""),
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().optional().default("Technical Call Copilot <noreply@example.com>"),
});

// Validated once at module load. Fails fast with a readable message if misconfigured.
function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example.`);
  }
  const env = parsed.data;
  // Downgrade to safe fallbacks when a provider is selected without credentials.
  if (env.AI_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) env.AI_PROVIDER = "mock";
  if (env.EMBEDDING_PROVIDER === "openai" && !env.OPENAI_API_KEY) env.EMBEDDING_PROVIDER = "local";
  if (env.TRANSCRIPTION_PROVIDER === "deepgram" && !env.DEEPGRAM_API_KEY) env.TRANSCRIPTION_PROVIDER = "simulated";
  return env;
}

export const env = loadEnv();
