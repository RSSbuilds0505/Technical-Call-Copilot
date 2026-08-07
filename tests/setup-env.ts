/**
 * Loaded before any test file. Ensures src/lib/env.ts (imported transitively by
 * services) sees a complete configuration pointed at the isolated test database,
 * regardless of what .env contains.
 */
process.env.DATABASE_URL = "postgresql://tcc:tcc@localhost:5432/tcc_test";
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-test-secret-test-secret";
process.env.CREDENTIAL_ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || "a".repeat(64);
process.env.AI_PROVIDER = "mock";
process.env.EMBEDDING_PROVIDER = "local";
process.env.TRANSCRIPTION_PROVIDER = "simulated";
process.env.STORAGE_DRIVER = "local";
