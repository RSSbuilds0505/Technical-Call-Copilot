import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { dirname, join, normalize } from "path";
import { env } from "@/lib/env";
import type { StorageDriver } from "./types";

export class LocalStorageDriver implements StorageDriver {
  readonly name = "local";
  private root = env.STORAGE_LOCAL_PATH;

  private resolve(key: string): string {
    const p = normalize(join(this.root, key));
    if (!p.startsWith(normalize(this.root))) throw new Error("Invalid storage key.");
    return p;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await unlink(this.resolve(key)).catch(() => {});
  }
}
