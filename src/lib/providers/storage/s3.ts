import { env } from "@/lib/env";
import type { StorageDriver } from "./types";

/**
 * S3-compatible driver using AWS Signature V4 via fetch (no SDK dependency).
 * Works with AWS S3, Cloudflare R2, MinIO, and other S3-compatible endpoints.
 * NOTE: implemented but not exercised in local development; local driver is the default.
 */
import { createHash, createHmac } from "crypto";

export class S3StorageDriver implements StorageDriver {
  readonly name = "s3";

  private endpointFor(key: string): { url: string; host: string; path: string } {
    const base = env.S3_ENDPOINT || `https://s3.${env.S3_REGION}.amazonaws.com`;
    const u = new URL(base);
    const path = `/${env.S3_BUCKET}/${key}`;
    return { url: `${u.origin}${path}`, host: u.host, path };
  }

  private sign(method: string, path: string, host: string, payloadHash: string): Record<string, string> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const region = env.S3_REGION || "us-east-1";
    const service = "s3";
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [method, path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
    const kDate = createHmac("sha256", `AWS4${env.S3_SECRET_ACCESS_KEY}`).update(dateStamp).digest();
    const kRegion = createHmac("sha256", kDate).update(region).digest();
    const kService = createHmac("sha256", kRegion).update(service).digest();
    const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
    const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
    return {
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      Authorization: `AWS4-HMAC-SHA256 Credential=${env.S3_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
  }

  async put(key: string, data: Buffer, contentType?: string): Promise<void> {
    const { url, host, path } = this.endpointFor(key);
    const payloadHash = createHash("sha256").update(data).digest("hex");
    const res = await fetch(url, {
      method: "PUT",
      headers: { ...this.sign("PUT", path, host, payloadHash), ...(contentType ? { "Content-Type": contentType } : {}) },
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`S3 upload failed (${res.status}).`);
  }

  async get(key: string): Promise<Buffer> {
    const { url, host, path } = this.endpointFor(key);
    const payloadHash = createHash("sha256").update("").digest("hex");
    const res = await fetch(url, { headers: this.sign("GET", path, host, payloadHash) });
    if (!res.ok) throw new Error(`S3 download failed (${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const { url, host, path } = this.endpointFor(key);
    const payloadHash = createHash("sha256").update("").digest("hex");
    await fetch(url, { method: "DELETE", headers: this.sign("DELETE", path, host, payloadHash) });
  }
}
