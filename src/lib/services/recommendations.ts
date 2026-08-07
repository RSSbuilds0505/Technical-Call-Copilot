import { db } from "@/lib/db";
import { getAIProvider } from "@/lib/providers/ai";
import { retrieveContext, type RetrievedChunk } from "./retrieval";
import { matchPlaybook, type PlaybookMatch } from "./playbooks";
import { recommendationSchema, type StructuredRecommendation, NO_SOURCE_MESSAGE } from "@/lib/schemas/recommendation";
import { publish } from "./liveBus";
import { assertWithinSpendCap } from "./spendGuard";
import type { TenantContext } from "@/lib/tenant";

const SYSTEM_PROMPT = `You are a real-time copilot for a technical specialist on a live customer call, focused on CRM, RevOps, integration, and implementation troubleshooting (HubSpot, Salesforce, LeadSquared, Apollo, Zapier, Make, Dynamics, APIs, webhooks).

Rules you must follow:
- Respond ONLY with a single JSON object matching the provided schema. No prose, no markdown fences.
- Distinguish clearly between confirmed facts, customer-provided information, retrieved documentation, likely causes, and assumptions. Never present a likely diagnosis as confirmed.
- Every verification step must be read-only. Never instruct destructive or production-changing actions.
- Risk levels: low = read-only/clarifying; medium = configuration changes (require verification + approval); high = destructive/production changes (never execute; recommend escalation and a safe diagnostic plan instead).
- Never fabricate a source. Only cite sources that appear in the RETRIEVED CONTEXT block. If none are relevant, return an empty sources array and include this exact warning: "${NO_SOURCE_MESSAGE}"
- The suggestedResponse must be customer-safe: professional, honest, no internal jargon, no invented commitments.
- Keep everything concise; the specialist is reading while speaking.

JSON schema (all keys required):
{"eventType": string, "issueSummary": string, "suggestedResponse": string, "clarifyingQuestions": string[], "possibleCauses": [{"cause": string, "likelihood": "high"|"medium"|"low", "reasoningSummary": string, "verificationStep": string}], "recommendedActions": [{"action": string, "riskLevel": "low"|"medium"|"high", "requiresApproval": boolean}], "missingInformation": string[], "warnings": string[], "shouldEscalate": boolean, "escalationReason": string|null, "confidence": number, "sources": [{"documentId": string|null, "title": string, "section": string|null, "relevance": string|null}]}`;

interface GenerateParams {
  ctx: TenantContext;
  callId: string;
  triggerText: string;
  eventType: string;
  eventId?: string | null;
  manualPrompt?: string | null;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output.");
  return JSON.parse(trimmed.slice(start, end + 1));
}

/** Drops any source the model cited that wasn't actually in the retrieved context. */
function sanitizeSources(rec: StructuredRecommendation, retrieved: RetrievedChunk[]): StructuredRecommendation {
  const allowedIds = new Set(retrieved.map((r) => r.documentId));
  const allowedTitles = new Set(retrieved.map((r) => r.documentTitle.toLowerCase()));
  const sources = rec.sources.filter(
    (s) => (s.documentId && allowedIds.has(s.documentId)) || allowedTitles.has(s.title.toLowerCase())
  );
  const warnings = [...rec.warnings];
  if (sources.length === 0 && !warnings.includes(NO_SOURCE_MESSAGE)) warnings.push(NO_SOURCE_MESSAGE);
  return { ...rec, sources, warnings };
}

export async function generateRecommendation(params: GenerateParams) {
  const { ctx, callId, triggerText, eventType } = params;
  const startedAt = Date.now();

  const call = await db.call.findFirst({
    where: { id: callId, organizationId: ctx.organizationId },
    include: {
      customer: { include: { technologies: true, integrations: true, issues: { where: { status: { not: "resolved" } } } } },
      segments: { where: { isInterim: false }, orderBy: { spokenAt: "desc" }, take: 20 },
    },
  });
  if (!call) throw new Error("Call not found in this organization.");

  const query = params.manualPrompt ? `${params.manualPrompt}\n${triggerText}` : triggerText;
  const [retrieved, playbook] = await Promise.all([
    retrieveContext({ organizationId: ctx.organizationId, customerId: call.customerId, query, limit: 6 }),
    matchPlaybook(ctx.organizationId, triggerText),
  ]);

  const userPrompt = buildUserPrompt({ call, retrieved, playbook, triggerText, eventType, manualPrompt: params.manualPrompt ?? null });

  // Fail fast if the organization has exhausted its daily allowance, before any provider spend.
  await assertWithinSpendCap(ctx.organizationId);

  const provider = getAIProvider();
  let structured: StructuredRecommendation | null = null;
  let usage = { inputTokens: 0, outputTokens: 0, model: "", provider: provider.name };

  for (let attempt = 1; attempt <= 2 && !structured; attempt++) {
    const result = await provider.complete({ system: SYSTEM_PROMPT, user: userPrompt, maxTokens: 2000 });
    usage = { inputTokens: result.inputTokens, outputTokens: result.outputTokens, model: result.model, provider: result.provider };
    try {
      const parsed = recommendationSchema.parse(extractJson(result.text));
      structured = sanitizeSources(parsed, retrieved);
    } catch (err) {
      if (attempt === 2) {
        publish({ type: "error", callId, data: { message: "The copilot returned an invalid response. Try Analyze again." } });
        throw new Error(`AI response failed validation after retry: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  }
  if (!structured) throw new Error("Recommendation generation failed.");

  const maxRisk = structured.recommendedActions.reduce<"low" | "medium" | "high">((acc, a) => {
    const order = { low: 0, medium: 1, high: 2 } as const;
    return order[a.riskLevel] > order[acc] ? a.riskLevel : acc;
  }, "low");

  const latencyMs = Date.now() - startedAt;
  const recommendation = await db.recommendation.create({
    data: {
      organizationId: ctx.organizationId,
      customerId: call.customerId,
      callId: call.id,
      eventId: params.eventId ?? null,
      eventType: structured.eventType,
      issueSummary: structured.issueSummary,
      payload: structured as object,
      confidence: structured.confidence,
      riskLevel: maxRisk,
      triggerText: triggerText.slice(0, 500),
      latencyMs,
      sources: {
        create: structured.sources.map((s) => ({
          documentId: s.documentId,
          title: s.title,
          section: s.section,
          relevance: s.relevance,
        })),
      },
    },
    include: { sources: true },
  });

  await db.aIUsageRecord.create({
    data: {
      organizationId: ctx.organizationId,
      provider: usage.provider,
      model: usage.model,
      operation: params.manualPrompt ? "copilot" : "recommendation",
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      latencyMs,
    },
  });

  publish({ type: "recommendation", callId, data: serializeRecommendation(recommendation) });
  return recommendation;
}

export function serializeRecommendation(rec: { id: string; eventType: string; issueSummary: string; payload: unknown; confidence: number; riskLevel: string; triggerText: string | null; createdAt: Date; sources: unknown[] }) {
  return {
    id: rec.id,
    eventType: rec.eventType,
    issueSummary: rec.issueSummary,
    payload: rec.payload,
    confidence: rec.confidence,
    riskLevel: rec.riskLevel,
    triggerText: rec.triggerText,
    createdAt: rec.createdAt.toISOString(),
    sources: rec.sources,
  };
}

function buildUserPrompt(params: {
  call: {
    title: string; callType: string; objective: string | null; knownIssue: string | null; products: string[];
    customer: {
      name: string; crmPlatform: string | null; subscriptionTier: string | null; description: string | null;
      technologies: { name: string; category: string | null }[];
      integrations: { sourceSystem: string; targetSystem: string; syncType: string | null; status: string | null }[];
      issues: { title: string; status: string }[];
      customTerminology: unknown;
    } | null;
    segments: { speakerName: string; speakerRole: string; content: string; spokenAt: Date }[];
  };
  retrieved: RetrievedChunk[];
  playbook: PlaybookMatch | null;
  triggerText: string;
  eventType: string;
  manualPrompt: string | null;
}): string {
  const { call, retrieved, playbook } = params;
  const c = call.customer;
  const transcript = [...call.segments].reverse().map((s) => `[${s.speakerRole}] ${s.speakerName}: ${s.content}`).join("\n");

  const contextBlock = retrieved.length > 0
    ? retrieved.map((r, i) => `--- Source ${i + 1} ---\ndocumentId: ${r.documentId}\ntitle: ${r.documentTitle}\nsection: ${r.section ?? "n/a"}\ntier: ${r.tier}\ncontent:\n${r.content}`).join("\n\n")
    : "(no relevant documents found)";

  const playbookBlock = playbook
    ? `MATCHED TROUBLESHOOTING PLAYBOOK: ${playbook.title}\nClarifying questions: ${playbook.clarifyingQuestions.join(" | ")}\nLikely causes: ${playbook.likelyCauses.map((lc) => `${lc.cause} (${lc.likelihood}; verify: ${lc.verificationStep})`).join(" | ")}\nSafe actions: ${playbook.safeActions.join(" | ")}\nRisky actions (do not execute): ${playbook.riskyActions.join(" | ")}\nEscalate if: ${playbook.escalationCriteria.join(" | ")}`
    : "(no playbook matched)";

  const customerBlock = c
    ? `CUSTOMER: ${c.name}\nCRM: ${c.crmPlatform ?? "unknown"} (${c.subscriptionTier ?? "tier unknown"})\nDescription: ${c.description ?? "n/a"}\nStack: ${c.technologies.map((t) => t.name).join(", ") || "n/a"}\nIntegrations: ${c.integrations.map((i) => `${i.sourceSystem}→${i.targetSystem} (${i.syncType ?? "?"}, ${i.status ?? "?"})`).join("; ") || "n/a"}\nOpen known issues: ${c.issues.map((i) => i.title).join("; ") || "none"}\nTerminology: ${JSON.stringify(c.customTerminology ?? [])}`
    : "CUSTOMER: (no customer workspace linked)";

  const mockContext = JSON.stringify({
    triggerText: params.triggerText,
    eventType: params.eventType,
    issueSummary: playbook ? `${playbook.title}: ${params.triggerText.slice(0, 140)}` : params.triggerText.slice(0, 160),
    playbook,
    sources: retrieved.slice(0, 3).map((r) => ({ documentId: r.documentId, title: r.documentTitle, section: r.section, relevance: `Matched ${r.tier} knowledge for this issue` })),
  });

  return `CALL: ${call.title} (${call.callType})\nObjective: ${call.objective ?? "n/a"}\nKnown issue going in: ${call.knownIssue ?? "n/a"}\nProducts: ${call.products.join(", ") || "n/a"}\n\n${customerBlock}\n\nRECENT TRANSCRIPT (newest last):\n${transcript || "(no transcript yet)"}\n\nRETRIEVED CONTEXT:\n${contextBlock}\n\n${playbookBlock}\n\nDETECTED EVENT TYPE (rule-based, refine if wrong): ${params.eventType}\nTRIGGER: ${params.triggerText}\n${params.manualPrompt ? `SPECIALIST'S REQUEST: ${params.manualPrompt}` : ""}\n\nRespond with the JSON object only.\n<mock-context>${mockContext}</mock-context>`;
}
