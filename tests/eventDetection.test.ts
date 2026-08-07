import { describe, it, expect } from "vitest";
import { detectEvent, isDuplicateEvent } from "@/lib/services/eventDetection";

describe("detectEvent", () => {
  it("flags integration trouble from a customer turn", () => {
    const r = detectEvent(
      "Every single contact from Apollo is syncing into HubSpot, not just qualified ones, and our database is flooded.",
      "customer"
    );
    expect(["integration_issue", "troubleshooting_issue", "data_issue"]).toContain(r.eventType);
    expect(r.shouldRecommend).toBe(true);
    expect(r.fingerprint).toHaveLength(16);
  });

  it("classifies plain technical questions", () => {
    const r = detectEvent("How does the workflow decide which contacts get enrolled into the sequence?", "customer");
    expect(r.shouldRecommend).toBe(true);
    expect(r.eventType).not.toBe("non_technical");
  });

  it("does not auto-recommend on specialist turns", () => {
    const r = detectEvent("The webhook is failing with a 401 signature invalid error on most deliveries.", "specialist");
    expect(r.shouldRecommend).toBe(false);
  });

  it("marks trivial fragments as insufficient information", () => {
    const r = detectEvent("ok thanks", "customer");
    expect(r.eventType).toBe("insufficient_information");
    expect(r.shouldRecommend).toBe(false);
  });

  it("ignores non-technical small talk", () => {
    const r = detectEvent("We had a great weekend at the lake with the family, weather was perfect.", "customer");
    expect(r.eventType).toBe("non_technical");
    expect(r.shouldRecommend).toBe(false);
  });

  it("produces stable fingerprints for near-identical phrasing", () => {
    const a = detectEvent("The workflow is not enrolling anyone from the list!", "customer");
    const b = detectEvent("the workflow is NOT enrolling anyone from the list", "customer");
    expect(a.fingerprint).toBe(b.fingerprint);
  });
});

describe("isDuplicateEvent (debounce window)", () => {
  const fp = "abc123abc123abc1";

  it("suppresses a repeat within the window", () => {
    const recent = [{ fingerprint: fp, createdAt: new Date(Date.now() - 60_000) }];
    expect(isDuplicateEvent(fp, recent)).toBe(true);
  });

  it("allows the same issue again after the window passes", () => {
    const recent = [{ fingerprint: fp, createdAt: new Date(Date.now() - 6 * 60_000) }];
    expect(isDuplicateEvent(fp, recent)).toBe(false);
  });

  it("does not suppress different fingerprints", () => {
    const recent = [{ fingerprint: "different000000", createdAt: new Date() }];
    expect(isDuplicateEvent(fp, recent)).toBe(false);
  });
});
