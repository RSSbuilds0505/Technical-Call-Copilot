import { env } from "@/lib/env";
import type { StorageDriver } from "./types";
import { LocalStorageDriver } from "./local";
import { S3StorageDriver } from "./s3";

let cached: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (cached) return cached;
  cached = env.STORAGE_DRIVER === "s3" && env.S3_BUCKET ? new S3StorageDriver() : new LocalStorageDriver();
  return cached;
}
