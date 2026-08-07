import { describe, it, expect } from "vitest";
import { recommendationSchema, postCallSchema, NO_SOURCE_MESSAGE } from "@/lib/schemas/recommendation";

const validRecommendation = {
  eventType: "integration_issue",
  issueSummary: "Apollo syncing all contacts into HubSpot.",
  suggestedResponse: "Let's check the sync scope in Apollo settings together.",
  clarifyingQuestions: ["Is the sync native or via middleware?"],
  possibleCauses: [
    {
      cause: "Referenced saved search was deleted, sync fell back to all contacts",
      likelihood: "high",
      reasoningSummary: "Timing matches the June cleanup.",
      verificationStep: "Read the contact sync scope in Apollo integration settings.",
    },
  ],
  recommendedActions: [
    { action: "Re-point the sync to the current qualified search", riskLevel: "low", requiresApproval: false },
    { action: "Bulk delete synced contacts", riskLevel: "high", requiresApproval: true },
  ],
  missingInformation: [],
  warnings: [],
  shouldEscalate: false,
  escalationReason: null,
  confidence: 0.86,
  sources: [{ documentId: "doc-1", title: "Runbook: Apollo sync", section: "Fix", relevance: "Remediation steps" }],
};

describe("recommendationSchema (the AI output contract)", () => {
  it("accepts a fully valid structured response", () => {
    const parsed = recommendationSchema.safeParse(validRecommendation);
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown event types", () => {
    expect(recommendationSchema.safeParse({ ...validRecommendation, eventType: "made_up_type" }).success).toBe(false);
  });

  it("rejects missing issueSummary / suggestedResponse", () => {
    expect(recommendationSchema.safeParse({ ...validRecommendation, issueSummary: "" }).success).toBe(false);
    const { suggestedResponse: _omit, ...rest } = validRecommendation;
    expect(recommendationSchema.safeParse(rest).success).toBe(false);
  });

  it("caps clarifying questions at 4", () => {
    const tooMany = { ...validRecommendation, clarifyingQuestions: ["a?", "b?", "c?", "d?", "e?"] };
    expect(recommendationSchema.safeParse(tooMany).success).toBe(false);
  });

  it("requires a verificationStep on every possible cause", () => {
    const bad = {
      ...validRecommendation,
      possibleCauses: [{ cause: "x", likelihood: "high", reasoningSummary: "y", verificationStep: "" }],
    };
    expect(recommendationSchema.safeParse(bad).success).toBe(false);
  });

  it("constrains riskLevel to the three tiers", () => {
    const bad = {
      ...validRecommendation,
      recommendedActions: [{ action: "x", riskLevel: "catastrophic", requiresApproval: true }],
    };
    expect(recommendationSchema.safeParse(bad).success).toBe(false);
  });

  it("bounds confidence to [0, 1]", () => {
    expect(recommendationSchema.safeParse({ ...validRecommendation, confidence: 1.2 }).success).toBe(false);
    expect(recommendationSchema.safeParse({ ...validRecommendation, confidence: -0.1 }).success).toBe(false);
  });

  it("allows an empty sources array (rendered as the no-source guardrail message)", () => {
    const parsed = recommendationSchema.safeParse({ ...validRecommendation, sources: [] });
    expect(parsed.success).toBe(true);
    expect(NO_SOURCE_MESSAGE).toBe("No verified source was found in the connected knowledge base.");
  });
});

describe("postCallSchema", () => {
  it("rejects a review missing required sections", () => {
    expect(postCallSchema.safeParse({ executiveSummary: "only this" }).success).toBe(false);
  });
});
