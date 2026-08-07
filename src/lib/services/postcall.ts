import { db } from "@/lib/db";
import { getAIProvider } from "@/lib/providers/ai";
import { postCallSchema, type PostCallContent } from "@/lib/schemas/recommendation";
import type { TenantContext } from "@/lib/tenant";
import { ingestInlineText } from "./ingestion";

const SYSTEM = `POST_CALL_MODE. You generate a post-call review for a technical customer call.
Respond ONLY with a single JSON object matching the schema below. No prose, no markdown fences.
Rules: clearly separate confirmed facts from assumptions and likely causes; never invent commitments or facts not present in the transcript; drafts (CRM note, email, tickets) must be professional and customer-safe; keep the customer email warm and concise.
Schema keys (all required): executiveSummary, technicalSummary, customerQuestions[], issuesDiscussed[], confirmedFacts[], assumptions[], likelyCauses[], confirmedRootCauses[], troubleshootingCompleted[], resolvedIssues[], unresolvedIssues[], decisionsMade[], customerCommitments[], internalCommitments[], followUpItems[], recommendedEscalation (string|null), crmNote, internalTechnicalNote, customerEmail, escalationSummary, supportTicket, engineeringTicket, knowledgeBaseUpdate (string|null).`;

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const s = t.indexOf("{"); const e = t.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("No JSON in output.");
  return JSON.parse(t.slice(s, e + 1));
}

export async function generatePostCallReview(ctx: TenantContext, callId: string): Promise<PostCallContent> {
  const call = await db.call.findFirst({
    where: { id: callId, organizationId: ctx.organizationId },
    include: {
      customer: true,
      segments: { where: { isInterim: false }, orderBy: { spokenAt: "asc" } },
      recommendations: { orderBy: { createdAt: "asc" }, include: { feedback: true } },
      resolution: true,
    },
  });
  if (!call) throw new Error("Call not found.");

  const transcript = call.segments.map((s) => `[${s.speakerRole}] ${s.speakerName}: ${s.content}`).join("\n");
  const recs = call.recommendations.map((r) => `- (${r.eventType}, confidence ${r.confidence}) ${r.issueSummary} | feedback: ${r.feedback.map((f) => f.rating).join(",") || "none"}`).join("\n");
  const resolution = call.resolution
    ? `Recorded resolution — summary: ${call.resolution.finalIssueSummary ?? "n/a"}; root cause: ${call.resolution.confirmedRootCause ?? "not confirmed"}; resolution: ${call.resolution.finalResolution ?? "n/a"}; customer confirmed: ${call.resolution.customerConfirmedFix}`
    : "No resolution recorded yet.";

  const mockContext = JSON.stringify({
    issueSummary: call.resolution?.finalIssueSummary ?? call.knownIssue ?? call.recommendations[0]?.issueSummary ?? `${call.title} (${call.callType})`,
    playbook: null,
  });

  const user = `CALL: ${call.title} (${call.callType}) with ${call.customer?.name ?? "unknown customer"}\nObjective: ${call.objective ?? "n/a"}\n\nTRANSCRIPT:\n${transcript || "(empty)"}\n\nRECOMMENDATIONS DURING CALL:\n${recs || "(none)"}\n\n${resolution}\n\nRespond with the JSON object only.\n<mock-context>${mockContext}</mock-context>`;

  const provider = getAIProvider();
  let content: PostCallContent | null = null;
  for (let attempt = 1; attempt <= 2 && !content; attempt++) {
    const result = await provider.complete({ system: SYSTEM, user, maxTokens: 3000 });
    try {
      content = postCallSchema.parse(extractJson(result.text));
    } catch (err) {
      if (attempt === 2) throw new Error(`Post-call generation failed validation: ${err instanceof Error ? err.message : "unknown"}`);
    }
    await db.aIUsageRecord.create({
      data: { organizationId: ctx.organizationId, provider: result.provider, model: result.model, operation: "postcall", inputTokens: result.inputTokens, outputTokens: result.outputTokens },
    });
  }
  if (!content) throw new Error("Post-call generation failed.");

  await db.callReview.upsert({
    where: { callId: call.id },
    update: { content: content as object },
    create: { callId: call.id, organizationId: ctx.organizationId, content: content as object },
  });
  return content;
}

/**
 * Converts a resolved call into retrievable knowledge (a "resolved-case" document)
 * so future calls benefit from confirmed resolutions. No model retraining involved.
 */
export async function publishResolvedCase(ctx: TenantContext, callId: string): Promise<void> {
  const call = await db.call.findFirst({
    where: { id: callId, organizationId: ctx.organizationId },
    include: { resolution: true, customer: true },
  });
  if (!call?.resolution?.finalResolution || !call.resolution.confirmedRootCause) return;
  const r = call.resolution;
  const content = `RESOLVED CASE\n\nIssue: ${r.finalIssueSummary ?? call.title}\n\nConfirmed root cause: ${r.confirmedRootCause}\n\nResolution: ${r.finalResolution}\n\nCustomer confirmed fix: ${r.customerConfirmedFix ? "yes" : "no"}\nCustomer: ${call.customer?.name ?? "n/a"}\nCall type: ${call.callType}`;
  await ingestInlineText({
    organizationId: ctx.organizationId,
    customerId: call.customerId,
    title: `Resolved: ${r.finalIssueSummary ?? call.title}`,
    content,
    documentType: "resolved-case",
    source: "resolved-case",
  });
}
