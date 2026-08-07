import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ingestInlineText } from "@/lib/services/ingestion";
import { retrieveContext } from "@/lib/services/retrieval";

const db = new PrismaClient();

let org: string;
let customerA: string;
let customerB: string;

beforeAll(async () => {
  await db.organization.deleteMany({ where: { name: "RetrievalTest Org" } });
  org = (await db.organization.create({ data: { name: "RetrievalTest Org" } })).id;
  customerA = (await db.customer.create({ data: { organizationId: org, name: "Customer A" } })).id;
  customerB = (await db.customer.create({ data: { organizationId: org, name: "Customer B" } })).id;

  // Same topic in three scopes to exercise filtering + boosts.
  await ingestInlineText({
    organizationId: org,
    title: "Org-wide webhook runbook",
    documentType: "runbook",
    content: "SECTION: General\nWebhook signature verification fails when the shared secret is rotated on one side only. Compare secret versions across services.",
  });
  await ingestInlineText({
    organizationId: org,
    customerId: customerA,
    title: "Customer A webhook notes",
    documentType: "customer-note",
    content: "SECTION: A-specific\nCustomer A's webhook signature verification failures historically trace to their Vault secret rotation and rolling deploys leaving one instance stale.",
  });
  await ingestInlineText({
    organizationId: org,
    customerId: customerB,
    title: "Customer B webhook notes",
    documentType: "customer-note",
    content: "SECTION: B-specific\nCustomer B's webhook signature verification failures are caused by their proxy stripping authentication headers.",
  });
});

afterAll(async () => {
  await db.organization.deleteMany({ where: { id: org } });
  await db.$disconnect();
});

describe("retrieval scoping", () => {
  it("on a customer call, returns that customer's docs plus org docs, never another customer's docs", async () => {
    const results = await retrieveContext({
      organizationId: org,
      customerId: customerA,
      query: "webhook signature verification failing after secret rotation",
      limit: 10,
    });
    expect(results.length).toBeGreaterThan(0);
    const titles = results.map((r) => r.documentTitle);
    expect(titles).not.toContain("Customer B webhook notes");
    // Org-level material remains available on customer calls.
    expect(titles.some((t) => t === "Org-wide webhook runbook" || t === "Customer A webhook notes")).toBe(true);
  });

  it("boosts customer-scoped chunks above org chunks of similar relevance", async () => {
    const results = await retrieveContext({
      organizationId: org,
      customerId: customerA,
      query: "webhook signature verification failures secret rotation stale instance",
      limit: 10,
    });
    const customerIdx = results.findIndex((r) => r.documentTitle === "Customer A webhook notes");
    const orgIdx = results.findIndex((r) => r.documentTitle === "Org-wide webhook runbook");
    expect(customerIdx).toBeGreaterThanOrEqual(0);
    if (orgIdx >= 0) expect(customerIdx).toBeLessThan(orgIdx);
    expect(results[customerIdx].tier).toBe("customer");
  });

  it("without a customer, returns only org-level (non-customer-scoped) docs", async () => {
    const results = await retrieveContext({
      organizationId: org,
      customerId: null,
      query: "webhook signature verification",
      limit: 10,
    });
    for (const r of results) {
      expect(["Customer A webhook notes", "Customer B webhook notes"]).not.toContain(r.documentTitle);
    }
  });

  it("returns an empty list for a blank query instead of dumping the corpus", async () => {
    const results = await retrieveContext({ organizationId: org, customerId: customerA, query: "   " });
    expect(results).toEqual([]);
  });
});
