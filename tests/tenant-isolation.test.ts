import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ingestInlineText } from "@/lib/services/ingestion";
import { retrieveContext } from "@/lib/services/retrieval";
import { createSessionToken, verifySessionToken } from "@/lib/auth";

/**
 * Tenant isolation is the most security-critical property of the system:
 * organization A must never see organization B's documents, chunks, or
 * retrieval results, even when B's content is the best semantic match.
 */
const db = new PrismaClient();

let orgA: string;
let orgB: string;
let customerA: string;

beforeAll(async () => {
  // Clean slate for these fixtures.
  await db.organization.deleteMany({ where: { name: { in: ["IsoTest A", "IsoTest B"] } } });

  orgA = (await db.organization.create({ data: { name: "IsoTest A" } })).id;
  orgB = (await db.organization.create({ data: { name: "IsoTest B" } })).id;
  customerA = (await db.customer.create({ data: { organizationId: orgA, name: "A Customer" } })).id;

  // Org B owns the only document about "quantum flux capacitors" — a strong,
  // unique retrieval target that must never leak into org A's results.
  await ingestInlineText({
    organizationId: orgB,
    title: "B-only secret runbook",
    documentType: "runbook",
    content:
      "SECTION: Secret\nThe quantum flux capacitor synchronizer requires the tachyon polarity inverter to be calibrated to 42 units. This unique phrase exists only in organization B.",
  });

  await ingestInlineText({
    organizationId: orgA,
    customerId: customerA,
    title: "A customer note",
    documentType: "customer-note",
    content: "SECTION: Note\nOrganization A customer-scoped content about HubSpot workflow enrollment problems and lifecycle stages.",
  });
});

afterAll(async () => {
  await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
  await db.$disconnect();
});

describe("retrieval tenant isolation", () => {
  it("never returns another organization's chunks, even on an exact-match query", async () => {
    const results = await retrieveContext({
      organizationId: orgA,
      customerId: null,
      query: "quantum flux capacitor synchronizer tachyon polarity inverter",
      limit: 10,
    });
    // Org A may get weak matches from its own docs, but nothing from org B.
    for (const r of results) {
      const doc = await db.document.findUnique({ where: { id: r.documentId } });
      expect(doc?.organizationId).toBe(orgA);
      expect(r.documentTitle).not.toContain("B-only");
    }
  });

  it("returns the content to its rightful owner", async () => {
    const results = await retrieveContext({
      organizationId: orgB,
      customerId: null,
      query: "quantum flux capacitor synchronizer tachyon polarity inverter",
      limit: 5,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].documentTitle).toBe("B-only secret runbook");
  });

  it("chunk rows are denormalized with the owning organizationId", async () => {
    const leaked = await db.documentChunk.count({
      where: { organizationId: orgA, document: { organizationId: orgB } },
    });
    expect(leaked).toBe(0);
  });
});

describe("session tokens", () => {
  it("round-trips a valid session", async () => {
    const token = await createSessionToken({ userId: "u1", organizationId: orgA });
    const session = await verifySessionToken(token);
    expect(session?.userId).toBe("u1");
    expect(session?.organizationId).toBe(orgA);
  });

  it("rejects tampered tokens", async () => {
    const token = await createSessionToken({ userId: "u1", organizationId: orgA });
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it("rejects garbage tokens", async () => {
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
  });
});
