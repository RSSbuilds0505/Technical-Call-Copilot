import { z } from "zod";

export const eventTypeSchema = z.enum([
  "technical_question",
  "troubleshooting_issue",
  "customer_objection",
  "feature_request",
  "architecture_question",
  "integration_issue",
  "data_issue",
  "workflow_issue",
  "permissions_issue",
  "subscription_limitation",
  "security_compliance_question",
  "escalation_request",
  "non_technical",
  "insufficient_information",
  "integration_troubleshooting",
]);
export type EventType = z.infer<typeof eventTypeSchema>;

export const riskLevelSchema = z.enum(["low", "medium", "high"]);
export const likelihoodSchema = z.enum(["high", "medium", "low"]);

export const possibleCauseSchema = z.object({
  cause: z.string().min(1),
  likelihood: likelihoodSchema,
  reasoningSummary: z.string().min(1),
  verificationStep: z.string().min(1),
});

export const recommendedActionSchema = z.object({
  action: z.string().min(1),
  riskLevel: riskLevelSchema,
  requiresApproval: z.boolean(),
});

export const sourceRefSchema = z.object({
  documentId: z.string().nullable(),
  title: z.string().min(1),
  section: z.string().nullable(),
  relevance: z.string().nullable(),
});

/**
 * The single validated contract for every AI recommendation.
 * Model output that fails this schema is retried once, then surfaced as an error card —
 * invalid data never reaches the UI.
 */
export const recommendationSchema = z.object({
  eventType: eventTypeSchema,
  issueSummary: z.string().min(1),
  suggestedResponse: z.string().min(1),
  clarifyingQuestions: z.array(z.string()).max(4),
  possibleCauses: z.array(possibleCauseSchema).max(6),
  recommendedActions: z.array(recommendedActionSchema).max(6),
  missingInformation: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  shouldEscalate: z.boolean().default(false),
  escalationReason: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1),
  sources: z.array(sourceRefSchema).default([]),
});
export type StructuredRecommendation = z.infer<typeof recommendationSchema>;

export const postCallSchema = z.object({
  executiveSummary: z.string(),
  technicalSummary: z.string(),
  customerQuestions: z.array(z.string()),
  issuesDiscussed: z.array(z.string()),
  confirmedFacts: z.array(z.string()),
  assumptions: z.array(z.string()),
  likelyCauses: z.array(z.string()),
  confirmedRootCauses: z.array(z.string()),
  troubleshootingCompleted: z.array(z.string()),
  resolvedIssues: z.array(z.string()),
  unresolvedIssues: z.array(z.string()),
  decisionsMade: z.array(z.string()),
  customerCommitments: z.array(z.string()),
  internalCommitments: z.array(z.string()),
  followUpItems: z.array(z.string()),
  recommendedEscalation: z.string().nullable(),
  crmNote: z.string(),
  internalTechnicalNote: z.string(),
  customerEmail: z.string(),
  escalationSummary: z.string(),
  supportTicket: z.string(),
  engineeringTicket: z.string(),
  knowledgeBaseUpdate: z.string().nullable(),
});
export type PostCallContent = z.infer<typeof postCallSchema>;

export const NO_SOURCE_MESSAGE = "No verified source was found in the connected knowledge base.";
