import { createHash } from "crypto";

export type DetectedEventType =
  | "technical_question" | "troubleshooting_issue" | "customer_objection" | "feature_request"
  | "architecture_question" | "integration_issue" | "data_issue" | "workflow_issue"
  | "permissions_issue" | "subscription_limitation" | "security_compliance_question"
  | "escalation_request" | "non_technical" | "insufficient_information";

export interface DetectionResult {
  eventType: DetectedEventType;
  shouldRecommend: boolean;
  summary: string;
  fingerprint: string;
}

const PATTERNS: { type: DetectedEventType; patterns: RegExp[] }[] = [
  { type: "escalation_request", patterns: [/escalat/i, /speak (to|with) (a manager|your manager|someone senior)/i, /this is unacceptable/i] },
  { type: "security_compliance_question", patterns: [/\b(hipaa|gdpr|soc ?2|pci|compliance|encryption|data residency|security review)\b/i] },
  { type: "subscription_limitation", patterns: [/\b(plan|tier|subscription|upgrade|professional|enterprise|starter)\b.*\b(limit|include|support|allow|available)\b/i, /\b(limit|include|allow)\b.*\b(plan|tier|subscription)\b/i] },
  { type: "permissions_issue", patterns: [/\b(permission|access denied|can't see|cannot see|not authorized|role|admin rights)\b/i] },
  { type: "integration_issue", patterns: [/\b(sync|syncing|synced|integration|webhook|api|zapier|make\.com|field mapping|connector)\b/i] },
  { type: "workflow_issue", patterns: [/\b(workflow|automation|enrollment|enroll|trigger|sequence)\b/i] },
  { type: "data_issue", patterns: [/\b(duplicate|missing (contact|record|data)|dedup|bad data|dirty data|import)\b/i] },
  { type: "architecture_question", patterns: [/\b(architecture|data model|schema|scale|design|structure our)\b/i] },
  { type: "feature_request", patterns: [/\b(would be great if|feature request|can you add|wish (it|we) could|roadmap)\b/i] },
  { type: "customer_objection", patterns: [/\b(too expensive|not sure this|competitor|why should we|pushback|concern about)\b/i] },
];

const QUESTION_HINTS = /\b(how|why|what|when|where|which|can we|can you|could|should|is there|is it possible|do you|does it)\b/i;
const TROUBLE_HINTS = /\b(isn't working|not working|broken|failing|failed|error|issue|problem|stopped|won't|doesn't|every .* (is|are)|only want|instead of)\b/i;

/**
 * Rule-based classification of a completed speaker turn. Deliberately conservative:
 * recommendations fire on clear technical questions/issues, not every fragment.
 * The AI layer refines classification; this gate controls when the AI is invoked at all.
 */
export function detectEvent(text: string, speakerRole: string): DetectionResult {
  const trimmed = text.trim();
  const fingerprint = createHash("sha1").update(normalizeForFingerprint(trimmed)).digest("hex").slice(0, 16);

  if (trimmed.length < 12 || trimmed.split(/\s+/).length < 4) {
    return { eventType: "insufficient_information", shouldRecommend: false, summary: trimmed.slice(0, 120), fingerprint };
  }

  let matched: DetectedEventType | null = null;
  for (const group of PATTERNS) {
    if (group.patterns.some((p) => p.test(trimmed))) { matched = group.type; break; }
  }

  const isQuestion = QUESTION_HINTS.test(trimmed) || trimmed.includes("?");
  const isTrouble = TROUBLE_HINTS.test(trimmed);

  if (!matched) {
    if (isTrouble) matched = "troubleshooting_issue";
    else if (isQuestion) matched = "technical_question";
    else {
      return { eventType: "non_technical", shouldRecommend: false, summary: trimmed.slice(0, 120), fingerprint };
    }
  }

  // Only customer/other turns trigger automatic guidance; specialists trigger via manual actions.
  const shouldRecommend = speakerRole !== "specialist" && matched !== "non_technical";
  return { eventType: matched, shouldRecommend, summary: trimmed.slice(0, 200), fingerprint };
}

function normalizeForFingerprint(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 3).sort().slice(0, 12).join(" ");
}

/** Debounce/dedup: skip if the same fingerprint produced a recommendation recently. */
export function isDuplicateEvent(fingerprint: string, recentFingerprints: { fingerprint: string | null; createdAt: Date }[], windowMs = 5 * 60 * 1000): boolean {
  const cutoff = Date.now() - windowMs;
  return recentFingerprints.some((e) => e.fingerprint === fingerprint && e.createdAt.getTime() >= cutoff);
}
