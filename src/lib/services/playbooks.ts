import { db } from "@/lib/db";

export interface PlaybookMatch {
  title: string;
  slug: string;
  clarifyingQuestions: string[];
  likelyCauses: { cause: string; likelihood: string; verificationStep: string }[];
  safeActions: string[];
  riskyActions: string[];
  escalationCriteria: string[];
  captureFields: string[];
}

/**
 * Matches the trigger text against seeded troubleshooting playbooks (built-in + org-specific).
 * Playbooks supplement retrieval and AI reasoning; they never replace them.
 */
export async function matchPlaybook(organizationId: string, text: string): Promise<PlaybookMatch | null> {
  const templates = await db.playbookTemplate.findMany({
    where: { OR: [{ organizationId: null }, { organizationId }] },
  });
  const lower = text.toLowerCase();
  let best: { score: number; template: (typeof templates)[number] } | null = null;
  for (const t of templates) {
    let score = 0;
    for (const symptom of t.symptoms) {
      const words = symptom.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const hits = words.filter((w) => lower.includes(w)).length;
      if (words.length > 0) score = Math.max(score, hits / words.length);
    }
    for (const platform of t.platforms) {
      if (lower.includes(platform.toLowerCase())) score += 0.15;
    }
    if (!best || score > best.score) best = { score, template: t };
  }
  if (!best || best.score < 0.4) return null;
  const t = best.template;
  return {
    title: t.title,
    slug: t.slug,
    clarifyingQuestions: t.clarifyingQuestions,
    likelyCauses: (t.likelyCauses as PlaybookMatch["likelyCauses"]) ?? [],
    safeActions: t.safeActions,
    riskyActions: t.riskyActions,
    escalationCriteria: t.escalationCriteria,
    captureFields: t.captureFields,
  };
}
