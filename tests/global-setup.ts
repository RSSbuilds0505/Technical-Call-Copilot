import { execSync } from "node:child_process";

export const TEST_DATABASE_URL = "postgresql://tcc:tcc@localhost:5432/tcc_test";

/** Runs once before the suite: sync the Prisma schema into the isolated test database. */
export default function globalSetup() {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
