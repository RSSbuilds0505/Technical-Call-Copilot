import { z } from "zod";

/** Shared request body schema for creating/updating customers (POST full, PATCH partial). */
export const customerBodySchema = z.object({
  name: z.string().min(1).max(200),
  website: z.string().max(300).optional().nullable(),
  industry: z.string().max(120).optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  primaryProducts: z.array(z.string().max(120)).default([]),
  crmPlatform: z.string().max(80).optional().nullable(),
  subscriptionTier: z.string().max(80).optional().nullable(),
  architectureNotes: z.string().max(8000).optional().nullable(),
  dataArchitectureNotes: z.string().max(8000).optional().nullable(),
  securityRequirements: z.string().max(4000).optional().nullable(),
  implementationPhase: z.string().max(120).optional().nullable(),
  internalNotes: z.string().max(8000).optional().nullable(),
  customTerminology: z.array(z.object({ term: z.string(), meaning: z.string() })).default([]),
});
