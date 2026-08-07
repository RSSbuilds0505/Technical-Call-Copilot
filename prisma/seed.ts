/**
 * Seed script: builds a realistic demo workspace.
 *
 * Demo login (documented in README):
 *   email:    demo@example.com
 *   password: DemoPass123!
 *
 * A second organization (Northgate Digital) with its own user exists purely to
 * demonstrate tenant isolation: none of its data is visible to the demo org.
 *
 * Run with: npm run db:seed
 */
process.loadEnvFile?.(".env");

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { ingestInlineText } from "../src/lib/services/ingestion";
import { PLAYBOOKS } from "./seed-playbooks";

const db = new PrismaClient();

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "DemoPass123!";

async function main() {
  console.log("Seeding Technical Call Copilot demo data…");

  // Idempotency: wipe previously seeded demo orgs so re-running is safe.
  const existing = await db.organization.findMany({ where: { name: { in: ["Meridian Solutions", "Northgate Digital"] } } });
  for (const org of existing) {
    await db.organization.delete({ where: { id: org.id } });
  }
  await db.user.deleteMany({ where: { email: { in: [DEMO_EMAIL, "manager@example.com", "isolated@example.com"] } } });
  await db.playbookTemplate.deleteMany({ where: { organizationId: null } });

  // ---------- Built-in playbooks (shared, organizationId = null) ----------
  for (const p of PLAYBOOKS) {
    await db.playbookTemplate.create({
      data: {
        organizationId: null,
        slug: p.slug,
        title: p.title,
        platforms: p.platforms,
        symptoms: p.symptoms,
        clarifyingQuestions: p.clarifyingQuestions,
        likelyCauses: p.likelyCauses,
        safeActions: p.safeActions,
        riskyActions: p.riskyActions,
        escalationCriteria: p.escalationCriteria,
        captureFields: p.captureFields,
      },
    });
  }
  console.log(`  ${PLAYBOOKS.length} built-in playbook templates`);

  // ---------- Demo organization + users ----------
  const org = await db.organization.create({ data: { name: "Meridian Solutions" } });

  const demoUser = await db.user.create({
    data: { email: DEMO_EMAIL, name: "Jordan Reyes", passwordHash: await hashPassword(DEMO_PASSWORD) },
  });
  await db.organizationMembership.create({ data: { organizationId: org.id, userId: demoUser.id, role: "ADMIN" } });

  const managerUser = await db.user.create({
    data: { email: "manager@example.com", name: "Priya Natarajan", passwordHash: await hashPassword(DEMO_PASSWORD) },
  });
  await db.organizationMembership.create({ data: { organizationId: org.id, userId: managerUser.id, role: "MANAGER" } });

  await db.organizationSetting.createMany({
    data: [
      { organizationId: org.id, key: "dataRetentionDays", value: 365 },
      { organizationId: org.id, key: "recordingConsentText", value: "This call may be transcribed to assist our team. Do we have your consent to proceed?" },
      { organizationId: org.id, key: "kbAutoPublishResolvedCases", value: true },
    ],
  });

  // ---------- Isolation org (proves tenant boundaries) ----------
  const otherOrg = await db.organization.create({ data: { name: "Northgate Digital" } });
  const otherUser = await db.user.create({
    data: { email: "isolated@example.com", name: "Sam Okafor", passwordHash: await hashPassword(DEMO_PASSWORD) },
  });
  await db.organizationMembership.create({ data: { organizationId: otherOrg.id, userId: otherUser.id, role: "ADMIN" } });
  const otherCustomer = await db.customer.create({
    data: { organizationId: otherOrg.id, name: "Private Corp (other tenant)", crmPlatform: "salesforce" },
  });
  await ingestInlineText({
    organizationId: otherOrg.id,
    customerId: otherCustomer.id,
    title: "Northgate confidential runbook",
    content: "SECTION: Confidential\nThis document belongs to Northgate Digital and must never appear in Meridian Solutions retrieval results. It covers Private Corp's Salesforce org credentials rotation procedure.",
    documentType: "runbook",
    platform: "salesforce",
    source: "seed",
  });
  console.log("  isolation org: Northgate Digital (isolated@example.com)");

  // ---------- Flagship customer: Brightline Manufacturing ----------
  const brightline = await db.customer.create({
    data: {
      organizationId: org.id,
      name: "Brightline Manufacturing",
      website: "https://brightline.example.com",
      industry: "Industrial equipment",
      description: "Mid-market manufacturer, 240 employees. We run their HubSpot instance and RevOps stack.",
      primaryProducts: ["HubSpot Marketing Hub Pro", "HubSpot Sales Hub Pro"],
      crmPlatform: "hubspot",
      subscriptionTier: "Professional",
      architectureNotes: "HubSpot is the system of record for contacts and deals. Apollo used by SDR team for prospecting. NetSuite holds invoicing (one-way export from HubSpot deals, weekly CSV).",
      dataArchitectureNotes: "Lifecycle stages drive handoff: MQL threshold at score 60. 'Qualified' operationally means lifecycle stage SQL or a positive SDR disposition in Apollo.",
      securityRequirements: "No PII beyond business contact data. SOC 2 vendor questionnaire completed 2025.",
      implementationPhase: "steady-state support",
      internalNotes: "Champion is Dana (RevOps). CFO watches contact-tier billing closely, sensitive to marketing-contact overage.",
      customTerminology: [
        { term: "the floor list", meaning: "Their master list of plant-manager contacts (top buyer persona)" },
        { term: "green accounts", meaning: "Accounts in good standing with active support contracts" },
      ],
      contacts: {
        create: [
          { name: "Dana Whitfield", title: "RevOps Manager", email: "dana@brightline.example.com", isPrimary: true },
          { name: "Marcus Lee", title: "SDR Team Lead", email: "marcus@brightline.example.com" },
        ],
      },
      technologies: {
        create: [
          { name: "HubSpot", category: "crm" },
          { name: "Apollo", category: "enrichment" },
          { name: "NetSuite", category: "data" },
          { name: "Zapier", category: "automation" },
        ],
      },
      integrations: {
        create: [
          { sourceSystem: "Apollo", targetSystem: "HubSpot", syncType: "native", direction: "one-way", status: "active", notes: "SDR prospecting flow. Supposed to push only engaged/qualified prospects." },
          { sourceSystem: "HubSpot", targetSystem: "NetSuite", syncType: "custom", direction: "one-way", status: "active", notes: "Weekly closed-won deal export." },
        ],
      },
      issues: {
        create: [
          { title: "Apollo pushing every contact into HubSpot", description: "Contact database ballooning with unqualified prospects; marketing-contact billing at risk.", status: "open", severity: "high" },
          { title: "Lifecycle stage overwritten by list imports", description: "Occasional imports reset lifecycle stage to Lead.", status: "monitoring", severity: "low" },
        ],
      },
      actionItems: {
        create: [
          { organizationId: org.id, description: "Send Dana the Apollo sync filter documentation link", ownerType: "internal", status: "open" },
          { organizationId: org.id, description: "Dana to confirm definition of 'qualified' with sales leadership", ownerType: "customer", status: "open" },
        ],
      },
    },
  });

  // ---------- More customers for breadth ----------
  const harbor = await db.customer.create({
    data: {
      organizationId: org.id,
      name: "Harborview Health Partners",
      industry: "Healthcare services",
      description: "Multi-clinic network. Salesforce org with heavy field customization.",
      crmPlatform: "salesforce",
      subscriptionTier: "Enterprise",
      primaryProducts: ["Salesforce Sales Cloud"],
      technologies: { create: [{ name: "Salesforce", category: "crm" }, { name: "Own Backup", category: "data" }] },
      integrations: { create: [{ sourceSystem: "Salesforce", targetSystem: "Epic referral intake", syncType: "custom", direction: "one-way", status: "active" }] },
    },
  });

  const tally = await db.customer.create({
    data: {
      organizationId: org.id,
      name: "Tallgrass Outdoor Co",
      industry: "E-commerce",
      description: "DTC outdoor gear brand on HubSpot Starter, evaluating Professional.",
      crmPlatform: "hubspot",
      subscriptionTier: "Starter",
      primaryProducts: ["HubSpot Marketing Hub Starter"],
      technologies: { create: [{ name: "HubSpot", category: "crm" }, { name: "Shopify", category: "data" }] },
    },
  });

  const vector = await db.customer.create({
    data: {
      organizationId: org.id,
      name: "Vectorly (SaaS)",
      industry: "B2B SaaS",
      description: "Product-led SaaS. Custom webhook pipeline pushes product events into HubSpot.",
      crmPlatform: "hubspot",
      subscriptionTier: "Professional",
      technologies: { create: [{ name: "HubSpot", category: "crm" }, { name: "Segment", category: "data" }, { name: "Custom Node.js middleware", category: "automation" }] },
      integrations: { create: [{ sourceSystem: "Product events", targetSystem: "HubSpot", syncType: "custom", direction: "one-way", status: "broken", notes: "Webhook receiver returning 401 since last week." }] },
    },
  });

  console.log("  4 customers created");

  // ---------- Knowledge base documents ----------
  // Organization-level docs (available on all calls).
  await ingestInlineText({
    organizationId: org.id,
    title: "Runbook: Apollo to HubSpot sync scoping",
    documentType: "runbook",
    platform: "hubspot",
    source: "seed",
    content: [
      "SECTION: Overview",
      "The Apollo to HubSpot native integration can sync contacts on three scopes: all contacts, contacts in selected lists, or contacts matching a saved search. When customers report that every prospect is appearing in HubSpot, the sync scope is almost always set to 'all contacts' or the referenced Apollo list has been deleted, which silently reverts scope to all.",
      "SECTION: Verification steps",
      "1. In Apollo, open Settings then Integrations then HubSpot, and read the Contact Sync scope value. 2. If scoped to a list or saved search, open that list and confirm it still exists and its filter matches the operational definition of qualified. 3. In HubSpot, check the contact property 'Apollo Sync Source' (or the record source detail) on a sample unwanted contact to confirm it came from this integration and not an import or form.",
      "SECTION: Fix",
      "Change the Apollo sync scope to a saved search that encodes qualification, for example: engaged in a sequence AND has a positive disposition, OR list membership maintained by the SDR lead. After changing scope, only new syncs are affected; contacts already in HubSpot remain. To handle the backlog, build a HubSpot active list of contacts whose record source is the Apollo integration AND lifecycle stage is subscriber or lead AND has no sales activity, then review with the customer before setting those contacts to non-marketing status. Setting contacts to non-marketing takes effect for billing at the next contact-tier renewal.",
      "SECTION: Risk notes",
      "Do not bulk delete synced contacts on the first pass: deletions are hard to reverse and can remove legitimate engagement history. Setting contacts to non-marketing is reversible and addresses the billing concern. Pausing the entire sync stops legitimate qualified prospects from arriving and should be a customer decision, not a default move.",
    ].join("\n"),
  });

  await ingestInlineText({
    organizationId: org.id,
    title: "HubSpot marketing contacts and billing guide",
    documentType: "guide",
    platform: "hubspot",
    source: "seed",
    content: [
      "SECTION: How marketing contact billing works",
      "HubSpot bills by marketing contact tier. Contacts marked as marketing count toward the purchased tier; non-marketing contacts are free up to the platform's overall record limits. Tier changes to a lower count apply at renewal, while automatic tier upgrades can happen mid-term the moment the marketing contact count exceeds the current tier.",
      "SECTION: Practical guidance",
      "When a database grows unexpectedly (for example from an integration syncing broadly), the immediate billing exposure is the marketing flag, not the record count. Triage order: 1) stop the inflow at the source integration, 2) set clearly unqualified synced contacts to non-marketing, 3) only then discuss deletion for records with no value. Workflows can set contacts to non-marketing automatically based on record source and absence of engagement.",
      "SECTION: Subscription tier feature notes",
      "Starter tier does not include workflows or custom reporting. Professional adds workflows, custom reports, and A/B testing. Enterprise adds custom objects, partitioning, and predictive scoring. Feature-gap questions from Starter customers usually resolve to either a Professional upgrade or a documented manual process.",
    ].join("\n"),
  });

  await ingestInlineText({
    organizationId: org.id,
    title: "HubSpot workflow enrollment troubleshooting",
    documentType: "runbook",
    platform: "hubspot",
    source: "seed",
    content: [
      "SECTION: The three usual causes",
      "When a HubSpot workflow does not enroll records: first, records that met enrollment criteria before the workflow was turned on will not enroll unless re-enrollment applies or the criteria change; second, trigger groups may use AND where OR was intended, making criteria impossible to satisfy together; third, a suppression list or an unenrollment goal may remove records the moment they enroll, which looks identical to never enrolling.",
      "SECTION: The definitive test",
      "Use the workflow's built-in enrollment test on a specific record. It reports exactly which criterion fails or whether the record would enroll. Also open the workflow's enrollment history: instant enroll-then-unenroll pairs point to goals or suppression, an empty history points to trigger logic.",
      "SECTION: Safe remediation",
      "Fix criteria first, then use manual enrollment from a static list for the backlog. Before manually enrolling, confirm which actions the workflow will execute on enrollment, especially emails, so the backlog does not mass-send.",
    ].join("\n"),
  });

  await ingestInlineText({
    organizationId: org.id,
    title: "Salesforce field mapping and picklist sync errors",
    documentType: "runbook",
    platform: "salesforce",
    source: "seed",
    content: [
      "SECTION: Picklist mismatches",
      "The most common cross-system field sync failure is a picklist value present in the source but absent in the destination. Salesforce rejects the write with INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST. Fix by aligning value sets exactly, including casing, or by adding a translation step in the middleware.",
      "SECTION: Type and permission mismatches",
      "Text-to-number and multi-select-to-single-select mappings fail silently in some tools and loudly in others; always check both the mapping screen and the integration user's field-level security. The integration user needs edit access to every mapped destination field. Formula and roll-up fields are read-only and can never be mapped as destinations.",
      "SECTION: Verification",
      "Reproduce with a single record update through the integration using a known-valid value. If a single-record test succeeds while batches fail, look at batch-only content such as legacy values that predate the current picklist definition.",
    ].join("\n"),
  });

  await ingestInlineText({
    organizationId: org.id,
    title: "Webhook signature and authentication debugging",
    documentType: "runbook",
    platform: "custom",
    source: "seed",
    content: [
      "SECTION: Reading the failure",
      "A webhook receiver returning 401 means authentication failed outright, usually a rotated or mismatched secret. 403 typically means the request authenticated but was rejected by policy, for example an IP allowlist. Intermittent failures with occasional success suggest multiple receiver instances holding different secrets after a partial deploy.",
      "SECTION: Signature verification pitfalls",
      "HMAC signatures must be computed over the exact raw request body bytes. JSON parsing and re-serialization changes key order and whitespace and will not match. Frameworks that consume the body stream before the verification middleware are the classic cause: capture the raw body first. Also confirm both sides agree on the digest encoding, hex versus base64.",
      "SECTION: Safe process",
      "Use the sender's delivery log to replay a single event at a request inspector to see exact headers and body. Never disable signature verification in production to restore flow; instead rotate the secret on both sides in one coordinated change.",
    ].join("\n"),
  });

  // Customer-scoped document for Brightline (retrieval must prefer this on their calls).
  await ingestInlineText({
    organizationId: org.id,
    customerId: brightline.id,
    title: "Brightline: qualified prospect definition and Apollo setup",
    documentType: "customer-note",
    platform: "hubspot",
    source: "seed",
    content: [
      "SECTION: What qualified means at Brightline",
      "For Brightline Manufacturing, a qualified prospect is: title matches plant manager, operations director, or procurement lead at a manufacturer with 50 or more employees, AND the contact has replied to a sequence or booked a meeting. This maps to their Apollo saved search named 'BLM Qualified v3', maintained by Marcus Lee (SDR lead). The internal shorthand 'the floor list' refers to the plant-manager subset.",
      "SECTION: Current Apollo to HubSpot configuration",
      "As of the last audit, the Apollo integration sync scope was set to the saved search 'BLM Qualified v2'. Note the SDR team created v3 and archived v2 in June. If v2 was deleted rather than archived, Apollo reverts the sync scope to all contacts without warning, which matches the flooding symptom reported in July.",
      "SECTION: Billing sensitivity",
      "Brightline's CFO tracks the HubSpot marketing contact tier (currently 10,000). Any remediation should prioritize marking unqualified synced contacts as non-marketing before discussing deletion. Deletion decisions go through Dana Whitfield.",
    ].join("\n"),
  });

  // Customer-scoped doc for Vectorly (webhook scenario).
  await ingestInlineText({
    organizationId: org.id,
    customerId: vector.id,
    title: "Vectorly: product event pipeline architecture",
    documentType: "customer-note",
    platform: "custom",
    source: "seed",
    content: [
      "SECTION: Pipeline",
      "Vectorly's Node.js middleware receives product events from Segment via webhook, enriches them, and writes timeline events to HubSpot. The receiver verifies an HMAC-SHA256 signature with a shared secret stored in their Vault instance. The middleware runs on two instances behind a load balancer.",
      "SECTION: Known change history",
      "Their platform team rotates the Segment shared secret quarterly. The last rotation was the week the 401 errors began. Deploys roll instance by instance; a partial deploy can leave one instance on the old secret, which produces intermittent 401s that look random from Segment's side.",
    ].join("\n"),
  });

  console.log("  7 knowledge base documents ingested (org + customer scoped)");

  // ---------- Flagship demo call: Apollo flooding HubSpot ----------
  const now = Date.now();
  const flagStart = new Date(now - 1000 * 60 * 60 * 24 * 6); // 6 days ago
  const flagshipCall = await db.call.create({
    data: {
      organizationId: org.id,
      customerId: brightline.id,
      ownerId: demoUser.id,
      title: "Brightline: Apollo sync flooding HubSpot",
      callType: "troubleshooting",
      meetingPlatform: "zoom",
      products: ["HubSpot", "Apollo"],
      objective: "Diagnose why every Apollo contact is syncing into HubSpot and agree a remediation plan.",
      knownIssue: "Contact database ballooning with unqualified prospects since mid-July; CFO worried about marketing contact billing.",
      consentConfirmed: true,
      status: "ENDED",
      startedAt: flagStart,
      endedAt: new Date(flagStart.getTime() + 1000 * 60 * 38),
      participants: {
        create: [
          { name: "Jordan Reyes", roleType: "specialist" },
          { name: "Dana Whitfield", roleType: "customer" },
          { name: "Marcus Lee", roleType: "customer" },
        ],
      },
    },
  });

  const flagshipLines: { speaker: string; role: string; content: string; important?: boolean }[] = [
    { speaker: "Jordan Reyes", role: "specialist", content: "Thanks for making time, both. Quick housekeeping: this call may be transcribed to assist our team. Are you both okay with that?" },
    { speaker: "Dana Whitfield", role: "customer", content: "Yes, fine by us. Let's dig in, this one's been painful." },
    { speaker: "Jordan Reyes", role: "specialist", content: "Great. So walk me through what you're seeing." },
    { speaker: "Dana Whitfield", role: "customer", content: "Every single contact from Apollo is syncing into HubSpot. Not just qualified ones. We only want qualified contacts coming over, but the database has grown by something like nine thousand contacts since mid-July.", important: true },
    { speaker: "Marcus Lee", role: "customer", content: "And to be clear, the SDR team didn't change how we prospect. We're pulling the same volumes we always have." },
    { speaker: "Jordan Reyes", role: "specialist", content: "Understood. Two quick questions. First, is the sync the native Apollo to HubSpot integration, or does it go through Zapier?" },
    { speaker: "Dana Whitfield", role: "customer", content: "Native. We set it up together last year, remember, scoped to a saved search." },
    { speaker: "Jordan Reyes", role: "specialist", content: "Right, BLM Qualified. Second question: did anything change in Apollo around mid-July? New lists, deleted lists, team changes?" },
    { speaker: "Marcus Lee", role: "customer", content: "Hmm. We did clean up old saved searches in June when we rolled out the v3 qualification search. I archived the old ones. Or, honestly, I might have deleted a couple.", important: true },
    { speaker: "Jordan Reyes", role: "specialist", content: "That timing lines up. If the saved search the sync references gets deleted, Apollo can silently fall back to syncing all contacts. Can you open Apollo settings, integrations, HubSpot, and read me the contact sync scope right now?" },
    { speaker: "Marcus Lee", role: "customer", content: "One sec. Okay, it says... contact sync: all contacts. That is not what we set it to.", important: true },
    { speaker: "Dana Whitfield", role: "customer", content: "There it is. Okay, so what do we do about the nine thousand contacts already in HubSpot? The CFO is watching our marketing contact tier and we cannot eat an overage." },
    { speaker: "Jordan Reyes", role: "specialist", content: "We'll take it in order: stop the inflow, then deal with billing exposure, then decide on cleanup. For billing, the key is these contacts' marketing status, not their existence." },
    { speaker: "Dana Whitfield", role: "customer", content: "Can we just bulk delete everything Apollo created since July?" },
    { speaker: "Jordan Reyes", role: "specialist", content: "I'd hold off on deletion as a first move. Some of those nine thousand may be legitimately engaged, and deletes are hard to reverse. Let me lay out the safer sequence and you can decide." },
    { speaker: "Marcus Lee", role: "customer", content: "I've re-pointed the sync scope to BLM Qualified v3 while we were talking, by the way." },
    { speaker: "Jordan Reyes", role: "specialist", content: "Perfect, inflow is stopped. Next: we build an active list in HubSpot of contacts whose record source is the Apollo integration, lifecycle stage still subscriber or lead, and no sales activity. Those we set to non-marketing, which removes them from tier billing. Anything with engagement stays marketing and gets reviewed by your team." },
    { speaker: "Dana Whitfield", role: "customer", content: "That works. And the tier itself, do we get relief immediately?" },
    { speaker: "Jordan Reyes", role: "specialist", content: "Non-marketing status takes effect for billing at your next contact-tier renewal, so the important thing is getting it done before that date. I'll confirm your renewal date after the call and put it in the follow-up." },
    { speaker: "Dana Whitfield", role: "customer", content: "Great. Send me the plan in writing and let's get the list built this week." },
  ];

  let t = flagStart.getTime();
  const flagSegments = [];
  for (const line of flagshipLines) {
    t += 45_000 + Math.floor(Math.random() * 60_000);
    flagSegments.push(
      await db.transcriptSegment.create({
        data: {
          callId: flagshipCall.id,
          organizationId: org.id,
          speakerName: line.speaker,
          speakerRole: line.role,
          content: line.content,
          isImportant: Boolean(line.important),
          spokenAt: new Date(t),
        },
      })
    );
  }

  const flagshipEvent = await db.detectedEvent.create({
    data: {
      callId: flagshipCall.id,
      organizationId: org.id,
      segmentId: flagSegments[3].id,
      eventType: "integration_issue",
      summary: "Apollo integration syncing all contacts into HubSpot instead of qualified only",
      triggerText: flagshipLines[3].content,
      fingerprint: "seed-apollo-flood",
    },
  });

  const brightlineDoc = await db.document.findFirst({ where: { organizationId: org.id, customerId: brightline.id, title: { contains: "qualified prospect" } } });
  const apolloRunbook = await db.document.findFirst({ where: { organizationId: org.id, title: { contains: "Apollo to HubSpot sync scoping" } } });
  const billingGuide = await db.document.findFirst({ where: { organizationId: org.id, title: { contains: "marketing contacts and billing" } } });

  const flagshipRec = await db.recommendation.create({
    data: {
      organizationId: org.id,
      customerId: brightline.id,
      callId: flagshipCall.id,
      eventId: flagshipEvent.id,
      eventType: "integration_issue",
      issueSummary: "Apollo native sync is pushing every contact into HubSpot instead of only qualified prospects; database grew by ~9,000 contacts since mid-July with marketing-contact billing exposure.",
      confidence: 0.86,
      riskLevel: "medium",
      triggerText: flagshipLines[3].content,
      latencyMs: 3400,
      payload: {
        eventType: "integration_issue",
        issueSummary: "Apollo native sync is pushing every contact into HubSpot instead of only qualified prospects; database grew by ~9,000 contacts since mid-July with marketing-contact billing exposure.",
        suggestedResponse: "It sounds like the sync scope may have changed rather than anything your team did in prospecting. The Apollo integration syncs based on a saved search, and if that search was removed it can quietly fall back to syncing everything. Let's check the sync scope in Apollo together right now, that will tell us in about a minute.",
        clarifyingQuestions: [
          "Is the sync the native Apollo integration or routed through middleware like Zapier?",
          "Did anyone change, archive, or delete Apollo saved searches or lists around mid-July?",
          "What is the current contact sync scope shown in Apollo's HubSpot integration settings?",
          "What is your current HubSpot marketing contact tier and renewal date?",
        ],
        possibleCauses: [
          {
            cause: "The Apollo saved search referenced by the sync (BLM Qualified v2) was deleted during the June cleanup, causing Apollo to fall back to syncing all contacts",
            likelihood: "high",
            reasoningSummary: "Timing matches: cleanup happened in June, flooding began mid-July. This fallback behavior is documented in the runbook and in the Brightline account notes.",
            verificationStep: "Open Apollo Settings, Integrations, HubSpot and read the Contact Sync scope value; confirm whether 'BLM Qualified v2' still exists.",
          },
          {
            cause: "Sync scope was manually changed to 'all contacts' by a team member",
            likelihood: "low",
            reasoningSummary: "Possible but the SDR lead reports no intentional changes to the integration.",
            verificationStep: "Check the Apollo integration change history or audit log for who last edited the sync settings.",
          },
        ],
        recommendedActions: [
          { action: "Re-point the Apollo sync scope to the current qualification saved search (BLM Qualified v3) to stop the inflow", riskLevel: "low", requiresApproval: false },
          { action: "Build a HubSpot active list of contacts with record source = Apollo integration, lifecycle stage subscriber/lead, and no sales activity, then set that list to non-marketing to remove billing exposure", riskLevel: "medium", requiresApproval: true },
          { action: "Bulk delete the ~9,000 synced contacts", riskLevel: "high", requiresApproval: true },
        ],
        missingInformation: ["HubSpot marketing contact tier renewal date", "Exact count of synced contacts with engagement"],
        warnings: ["Bulk deletion is effectively irreversible and may remove legitimately engaged contacts; recommend the non-marketing route first."],
        shouldEscalate: false,
        escalationReason: null,
        confidence: 0.86,
        sources: [
          { documentId: brightlineDoc?.id ?? null, title: "Brightline: qualified prospect definition and Apollo setup", section: "Current Apollo to HubSpot configuration", relevance: "Documents the v2 search deletion risk and fallback-to-all behavior for this exact account" },
          { documentId: apolloRunbook?.id ?? null, title: "Runbook: Apollo to HubSpot sync scoping", section: "Fix", relevance: "Remediation sequence: rescope sync, non-marketing backlog list, deletion only after review" },
          { documentId: billingGuide?.id ?? null, title: "HubSpot marketing contacts and billing guide", section: "Practical guidance", relevance: "Marketing vs non-marketing billing mechanics and renewal timing" },
        ],
      },
      sources: {
        create: [
          { documentId: brightlineDoc?.id ?? null, title: "Brightline: qualified prospect definition and Apollo setup", section: "Current Apollo to HubSpot configuration", relevance: "Documents the v2 search deletion risk for this account" },
          { documentId: apolloRunbook?.id ?? null, title: "Runbook: Apollo to HubSpot sync scoping", section: "Fix", relevance: "Remediation sequence" },
          { documentId: billingGuide?.id ?? null, title: "HubSpot marketing contacts and billing guide", section: "Practical guidance", relevance: "Billing mechanics" },
        ],
      },
    },
  });

  await db.recommendationFeedback.create({
    data: {
      recommendationId: flagshipRec.id,
      userId: demoUser.id,
      organizationId: org.id,
      customerId: brightline.id,
      callId: flagshipCall.id,
      rating: "helpful",
      usedOnCall: true,
      issueResolved: true,
      finalRootCause: "Deleted Apollo saved search caused sync scope to revert to all contacts",
      finalResolution: "Rescoped sync to BLM Qualified v3; non-marketing remediation list agreed",
      notes: "Verification step nailed it in one screen share.",
    },
  });

  await db.resolution.create({
    data: {
      callId: flagshipCall.id,
      organizationId: org.id,
      finalIssueSummary: "Apollo native integration synced all contacts into HubSpot (~9,000 since mid-July) instead of only qualified prospects.",
      confirmedRootCause: "The saved search 'BLM Qualified v2' that scoped the sync was deleted during a June cleanup; Apollo silently fell back to syncing all contacts.",
      finalResolution: "Sync scope re-pointed to 'BLM Qualified v3' on the call, stopping the inflow. Remediation: active list of Apollo-sourced, unengaged, subscriber/lead contacts to be set non-marketing before tier renewal. Deletion deferred pending engagement review.",
      customerConfirmedFix: true,
      followUpRequired: true,
      engineeringEscalation: false,
      docsToUpdate: "Add a warning to the Brightline account notes: never delete saved searches referenced by the Apollo sync; archive only.",
    },
  });

  // Publish the confirmed resolution as a retrievable case document (mirrors app behavior).
  await ingestInlineText({
    organizationId: org.id,
    customerId: brightline.id,
    title: "Resolved case: Apollo sync flooding HubSpot (Brightline)",
    documentType: "resolved-case",
    platform: "hubspot",
    source: "resolved-case",
    content: [
      "SECTION: Issue",
      "Apollo native integration synced all contacts into HubSpot, roughly nine thousand since mid-July, instead of only qualified prospects.",
      "SECTION: Root cause",
      "The saved search BLM Qualified v2 that scoped the sync was deleted during a June cleanup. Apollo silently fell back to syncing all contacts.",
      "SECTION: Resolution",
      "Sync scope re-pointed to BLM Qualified v3, stopping the inflow. Backlog handled by setting Apollo-sourced unengaged subscriber and lead contacts to non-marketing before the contact tier renewal. Deletion deferred pending engagement review.",
    ].join("\n"),
  });

  console.log("  flagship scenario: Apollo flooding HubSpot (transcript, event, recommendation, feedback, resolution)");

  // ---------- Five additional demo scenario calls ----------
  async function scenarioCall(params: {
    customerId: string | null;
    title: string;
    callType: string;
    daysAgo: number;
    objective: string;
    knownIssue: string | null;
    lines: { speaker: string; role: string; content: string }[];
    eventType: string;
    eventSummary: string;
    triggerIndex: number;
    recSummary: string;
    suggestedResponse: string;
    causes: { cause: string; likelihood: "high" | "medium" | "low"; reasoningSummary: string; verificationStep: string }[];
    actions: { action: string; riskLevel: "low" | "medium" | "high"; requiresApproval: boolean }[];
    sourceTitle: string | null;
    confidence: number;
    feedback: { rating: string; usedOnCall: boolean; issueResolved: boolean } | null;
    resolution: { finalIssueSummary: string; confirmedRootCause: string; finalResolution: string; customerConfirmedFix: boolean; engineeringEscalation?: boolean } | null;
  }) {
    const start = new Date(now - 1000 * 60 * 60 * 24 * params.daysAgo);
    const call = await db.call.create({
      data: {
        organizationId: org.id,
        customerId: params.customerId,
        ownerId: demoUser.id,
        title: params.title,
        callType: params.callType,
        meetingPlatform: "meet",
        products: [],
        objective: params.objective,
        knownIssue: params.knownIssue,
        consentConfirmed: true,
        status: "ENDED",
        startedAt: start,
        endedAt: new Date(start.getTime() + 1000 * 60 * 30),
        participants: { create: [{ name: "Jordan Reyes", roleType: "specialist" }] },
      },
    });
    let ts = start.getTime();
    const segs = [];
    for (const line of params.lines) {
      ts += 60_000;
      segs.push(
        await db.transcriptSegment.create({
          data: { callId: call.id, organizationId: org.id, speakerName: line.speaker, speakerRole: line.role, content: line.content, spokenAt: new Date(ts) },
        })
      );
    }
    const ev = await db.detectedEvent.create({
      data: {
        callId: call.id,
        organizationId: org.id,
        segmentId: segs[params.triggerIndex]?.id ?? null,
        eventType: params.eventType,
        summary: params.eventSummary,
        triggerText: params.lines[params.triggerIndex]?.content ?? null,
        fingerprint: `seed-${call.id.slice(0, 8)}`,
      },
    });
    const sourceDoc = params.sourceTitle ? await db.document.findFirst({ where: { organizationId: org.id, title: { contains: params.sourceTitle } } }) : null;
    const sources = sourceDoc
      ? [{ documentId: sourceDoc.id, title: sourceDoc.title, section: null as string | null, relevance: "Primary runbook for this issue class" }]
      : [];
    const rec = await db.recommendation.create({
      data: {
        organizationId: org.id,
        customerId: params.customerId,
        callId: call.id,
        eventId: ev.id,
        eventType: params.eventType,
        issueSummary: params.recSummary,
        confidence: params.confidence,
        riskLevel: params.actions.some((a) => a.riskLevel === "high") ? "high" : params.actions.some((a) => a.riskLevel === "medium") ? "medium" : "low",
        triggerText: params.lines[params.triggerIndex]?.content ?? null,
        latencyMs: 2500 + Math.floor(Math.random() * 3000),
        payload: {
          eventType: params.eventType,
          issueSummary: params.recSummary,
          suggestedResponse: params.suggestedResponse,
          clarifyingQuestions: [],
          possibleCauses: params.causes,
          recommendedActions: params.actions,
          missingInformation: [],
          warnings: [],
          shouldEscalate: Boolean(params.resolution?.engineeringEscalation),
          escalationReason: params.resolution?.engineeringEscalation ? "Requires vendor or engineering-side change beyond configuration." : null,
          confidence: params.confidence,
          sources,
        },
        sources: { create: sources },
      },
    });
    if (params.feedback) {
      await db.recommendationFeedback.create({
        data: {
          recommendationId: rec.id,
          userId: demoUser.id,
          organizationId: org.id,
          customerId: params.customerId,
          callId: call.id,
          rating: params.feedback.rating,
          usedOnCall: params.feedback.usedOnCall,
          issueResolved: params.feedback.issueResolved,
        },
      });
    }
    if (params.resolution) {
      await db.resolution.create({
        data: {
          callId: call.id,
          organizationId: org.id,
          finalIssueSummary: params.resolution.finalIssueSummary,
          confirmedRootCause: params.resolution.confirmedRootCause,
          finalResolution: params.resolution.finalResolution,
          customerConfirmedFix: params.resolution.customerConfirmedFix,
          engineeringEscalation: Boolean(params.resolution.engineeringEscalation),
        },
      });
    }
    return call;
  }

  // Scenario 2: duplicate contacts (Brightline)
  await scenarioCall({
    customerId: brightline.id,
    title: "Brightline: duplicate contacts after list import",
    callType: "support",
    daysAgo: 18,
    objective: "Diagnose duplicate contacts appearing after the trade-show list import.",
    knownIssue: "Support inbox reports contacts appearing twice.",
    lines: [
      { speaker: "Jordan Reyes", role: "specialist", content: "Consent reminder as usual: transcription on, all good? Great. Tell me about the duplicates." },
      { speaker: "Dana Whitfield", role: "customer", content: "After the trade-show import last week we're seeing the same people twice. Same name, and I think the emails differ slightly." },
      { speaker: "Jordan Reyes", role: "specialist", content: "If the emails differ, HubSpot treats them as different people. Was the import file using their work emails or the ones collected at the booth?" },
      { speaker: "Dana Whitfield", role: "customer", content: "Booth scans, so personal emails in a lot of cases." },
    ],
    eventType: "data_issue",
    eventSummary: "Duplicate contacts created by import with alternate email addresses",
    triggerIndex: 1,
    recSummary: "Trade-show import created duplicates because booth-scan records used alternate email addresses; HubSpot matched on email and created new records.",
    suggestedResponse: "Since HubSpot deduplicates on email, records with a different email will always create a new contact. Let's confirm on one pair, then size the problem with the duplicate management tool before merging anything.",
    causes: [
      { cause: "Import records carried personal emails while existing contacts hold work emails", likelihood: "high", reasoningSummary: "Booth scans commonly capture personal addresses; matches the reported slight email differences.", verificationStep: "Open one duplicate pair and compare the email properties and record sources." },
    ],
    actions: [
      { action: "Run HubSpot duplicate management to size and review pairs", riskLevel: "low", requiresApproval: false },
      { action: "Merge confirmed pairs, keeping the work email as primary", riskLevel: "medium", requiresApproval: true },
    ],
    sourceTitle: null,
    confidence: 0.78,
    feedback: { rating: "helpful", usedOnCall: true, issueResolved: true },
    resolution: {
      finalIssueSummary: "Duplicates from trade-show import with personal emails.",
      confirmedRootCause: "Import rows carried personal emails, so email-based matching created new records instead of updating existing ones.",
      finalResolution: "Reviewed pairs in duplicate management and merged with work email as primary; future imports will pre-map to work email where known.",
      customerConfirmedFix: true,
    },
  });

  // Scenario 3: workflow not enrolling (Tallgrass)
  await scenarioCall({
    customerId: tally.id,
    title: "Tallgrass: welcome workflow not enrolling",
    callType: "troubleshooting",
    daysAgo: 12,
    objective: "Find out why the new welcome workflow enrolls nobody.",
    knownIssue: "Welcome nurture workflow shows zero enrollments since launch.",
    lines: [
      { speaker: "Jordan Reyes", role: "specialist", content: "Transcription consent confirmed before we started. So, the welcome workflow: zero enrollments since it went live?" },
      { speaker: "Tallgrass Ops", role: "customer", content: "Zero. The workflow is on, the list it targets has four hundred people, nothing happens. The workflow is just not enrolling anyone." },
      { speaker: "Jordan Reyes", role: "specialist", content: "Were those four hundred people on the list before you turned the workflow on?" },
      { speaker: "Tallgrass Ops", role: "customer", content: "Yes, we built the list first, then activated the workflow the next day." },
    ],
    eventType: "workflow_issue",
    eventSummary: "Workflow not enrolling records that met criteria before activation",
    triggerIndex: 1,
    recSummary: "Welcome workflow enrolls nobody because all list members met the enrollment criteria before activation and re-enrollment is off; HubSpot only enrolls records that newly meet criteria.",
    suggestedResponse: "This is almost certainly the activation-order effect: records that already met the trigger before the workflow turned on won't enroll. The enrollment test will confirm it in a minute, and then we can safely enroll the backlog manually.",
    causes: [
      { cause: "List members met criteria before workflow activation; no re-enrollment", likelihood: "high", reasoningSummary: "List was built the day before activation, matching the classic pattern.", verificationStep: "Run the workflow's enrollment test on one list member and read the reported reason." },
    ],
    actions: [
      { action: "Run the enrollment test on a sample record", riskLevel: "low", requiresApproval: false },
      { action: "Manually enroll the existing list after reviewing which actions fire on enrollment", riskLevel: "medium", requiresApproval: true },
    ],
    sourceTitle: "workflow enrollment troubleshooting",
    confidence: 0.84,
    feedback: { rating: "helpful", usedOnCall: true, issueResolved: true },
    resolution: {
      finalIssueSummary: "Welcome workflow showed zero enrollments since launch.",
      confirmedRootCause: "All targeted records met criteria before activation; without re-enrollment, HubSpot enrolls only records newly meeting criteria.",
      finalResolution: "Confirmed via enrollment test; reviewed workflow actions, then manually enrolled the backlog from the static list. New signups enroll normally.",
      customerConfirmedFix: true,
    },
  });

  // Scenario 4: Salesforce field mapping (Harborview)
  await scenarioCall({
    customerId: harbor.id,
    title: "Harborview: referral status field sync failures",
    callType: "troubleshooting",
    daysAgo: 9,
    objective: "Resolve sync errors on the referral status field between intake middleware and Salesforce.",
    knownIssue: "Integration log shows repeated write failures on Referral_Status__c.",
    lines: [
      { speaker: "Jordan Reyes", role: "specialist", content: "Consent noted. Let's look at those referral status errors. What does the integration log say exactly?" },
      { speaker: "Harborview IT", role: "customer", content: "The error is INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST on Referral_Status__c. The field mapping error started Monday, it's a field not syncing at all now for new referrals." },
      { speaker: "Jordan Reyes", role: "specialist", content: "Restricted picklist rejection. Did anyone add a new status value on the intake side recently?" },
      { speaker: "Harborview IT", role: "customer", content: "The clinic ops team added a 'Pending Insurance' status in the intake tool last week." },
    ],
    eventType: "integration_issue",
    eventSummary: "Restricted picklist rejecting new source value on Referral_Status__c",
    triggerIndex: 1,
    recSummary: "Salesforce rejects writes to Referral_Status__c because the intake tool added a 'Pending Insurance' value that does not exist in the restricted picklist.",
    suggestedResponse: "The error code tells us exactly what's happening: the picklist is restricted and the intake tool is sending a value Salesforce doesn't have. Adding 'Pending Insurance' to the picklist, or translating it in the middleware, will clear it.",
    causes: [
      { cause: "New 'Pending Insurance' value exists in intake but not in the Salesforce restricted picklist", likelihood: "high", reasoningSummary: "Error code is specific to restricted picklists and the value was added days before failures began.", verificationStep: "Compare the picklist value set on Referral_Status__c with the intake tool's status list." },
    ],
    actions: [
      { action: "Add 'Pending Insurance' to the Referral_Status__c picklist (exact casing) and replay failed records", riskLevel: "medium", requiresApproval: true },
      { action: "Alternatively map 'Pending Insurance' to an existing value in the middleware", riskLevel: "medium", requiresApproval: true },
    ],
    sourceTitle: "field mapping and picklist",
    confidence: 0.88,
    feedback: { rating: "helpful", usedOnCall: true, issueResolved: true },
    resolution: {
      finalIssueSummary: "Referral status writes failing since Monday.",
      confirmedRootCause: "Intake tool introduced 'Pending Insurance', absent from the restricted picklist on Referral_Status__c.",
      finalResolution: "Value added to the picklist with matching casing; failed referrals replayed successfully. Change process updated so picklist additions are coordinated.",
      customerConfirmedFix: true,
    },
  });

  // Scenario 5: subscription limitation (Tallgrass)
  await scenarioCall({
    customerId: tally.id,
    title: "Tallgrass: A/B testing unavailable on Starter",
    callType: "customer_success",
    daysAgo: 5,
    objective: "Advise on A/B testing emails from HubSpot Starter.",
    knownIssue: null,
    lines: [
      { speaker: "Jordan Reyes", role: "specialist", content: "Consent confirmed off-record before we began. What are you trying to do with the campaign?" },
      { speaker: "Tallgrass Ops", role: "customer", content: "We want to A/B test subject lines on the spring launch email, but the option is greyed out. Do we need to upgrade our plan for that feature?" },
      { speaker: "Jordan Reyes", role: "specialist", content: "A/B testing for marketing email is a Professional-tier feature, so on Starter it will show but stay locked. Whether to upgrade depends on more than this one feature, so let me lay out what Professional adds and a manual alternative." },
    ],
    eventType: "subscription_limitation",
    eventSummary: "A/B testing gated behind Professional tier",
    triggerIndex: 1,
    recSummary: "Customer on HubSpot Starter cannot use email A/B testing; the feature requires Marketing Hub Professional. A manual split with two lists approximates it meanwhile.",
    suggestedResponse: "A/B testing is a Professional feature, so it's expected to be locked on Starter. If the upgrade isn't justified yet, we can approximate it: split the audience into two random lists and send each a variant, then compare opens manually.",
    causes: [
      { cause: "Marketing email A/B testing requires Marketing Hub Professional", likelihood: "high", reasoningSummary: "Documented tier gating; matches the greyed-out UI on Starter.", verificationStep: "Check the official HubSpot feature matrix for A/B testing tier availability." },
    ],
    actions: [
      { action: "Manual split test using two randomized static lists and two email variants", riskLevel: "low", requiresApproval: false },
      { action: "Evaluate a Professional upgrade against the full feature set, not this one feature", riskLevel: "low", requiresApproval: false },
    ],
    sourceTitle: "marketing contacts and billing",
    confidence: 0.9,
    feedback: { rating: "partially_helpful", usedOnCall: true, issueResolved: true },
    resolution: {
      finalIssueSummary: "A/B testing locked on Starter tier.",
      confirmedRootCause: "Feature is gated to Marketing Hub Professional; not a misconfiguration.",
      finalResolution: "Ran a manual two-list split for the spring launch. Upgrade evaluation scheduled for next quarter planning.",
      customerConfirmedFix: true,
    },
  });

  // Scenario 6: webhook auth failure (Vectorly), escalated
  await scenarioCall({
    customerId: vector.id,
    title: "Vectorly: product event webhooks failing with 401",
    callType: "escalation",
    daysAgo: 2,
    objective: "Diagnose intermittent 401s on the Segment to middleware webhook.",
    knownIssue: "Product events missing from HubSpot timelines since last week.",
    lines: [
      { speaker: "Jordan Reyes", role: "specialist", content: "Consent handled in the invite. So: events missing from timelines, and Segment shows delivery failures?" },
      { speaker: "Vectorly Platform", role: "customer", content: "Right, the webhook receiver is returning 401 on maybe sixty percent of deliveries. The webhook is failing with signature invalid errors in our middleware logs, but only sometimes, which makes no sense." },
      { speaker: "Jordan Reyes", role: "specialist", content: "Intermittent 401s on signature checks usually means two receiver instances disagree about the secret. You rotate the Segment secret quarterly, right, and deploys roll instance by instance?" },
      { speaker: "Vectorly Platform", role: "customer", content: "We rotated it last week. And yes, rolling deploys. Oh. If one instance never picked up the new secret from Vault..." },
    ],
    eventType: "integration_troubleshooting",
    eventSummary: "Intermittent webhook 401s after secret rotation with rolling deploys",
    triggerIndex: 1,
    recSummary: "Intermittent 401 signature failures on the Segment webhook receiver, consistent with one middleware instance still holding the pre-rotation secret after a partial rollout.",
    suggestedResponse: "A roughly sixty percent failure rate that started right after a secret rotation points at instance drift: one of the two receivers likely still has the old secret. Checking the secret version each instance loaded will confirm it without touching production.",
    causes: [
      { cause: "One middleware instance still holds the pre-rotation secret after a partial deploy", likelihood: "high", reasoningSummary: "Failure onset matches the rotation date and the account notes document exactly this risk with their rolling deploys.", verificationStep: "Log or inspect the Vault secret version loaded by each instance and compare." },
      { cause: "Signature computed over parsed JSON instead of the raw body on one code path", likelihood: "low", reasoningSummary: "Would usually fail consistently rather than intermittently, but worth ruling out.", verificationStep: "Confirm the raw-body capture middleware runs before any JSON parsing on all routes." },
    ],
    actions: [
      { action: "Compare loaded secret versions across instances via logs or a diagnostic endpoint", riskLevel: "low", requiresApproval: false },
      { action: "Redeploy or restart the stale instance so it re-reads the current secret from Vault", riskLevel: "medium", requiresApproval: true },
      { action: "Disable signature verification to restore event flow", riskLevel: "high", requiresApproval: true },
    ],
    sourceTitle: "Webhook signature and authentication",
    confidence: 0.81,
    feedback: { rating: "helpful", usedOnCall: true, issueResolved: false },
    resolution: {
      finalIssueSummary: "Intermittent 401s on product event webhooks since the quarterly secret rotation.",
      confirmedRootCause: "Instance B never reloaded the rotated secret from Vault; rolling deploy completed on instance A only.",
      finalResolution: "Customer platform team restarting instance B and adding a startup check that logs the secret version. Verification pending their deploy window tonight.",
      customerConfirmedFix: false,
      engineeringEscalation: true,
    },
  });

  console.log("  5 additional scenario calls (duplicates, workflow, field mapping, tier limit, webhook auth)");

  // ---------- A draft call ready to run live in the demo ----------
  await db.call.create({
    data: {
      organizationId: org.id,
      customerId: brightline.id,
      ownerId: demoUser.id,
      title: "Brightline: weekly RevOps check-in",
      callType: "customer_success",
      meetingPlatform: "zoom",
      products: ["HubSpot"],
      objective: "Review non-marketing remediation progress and lifecycle stage hygiene.",
      knownIssue: null,
      consentConfirmed: false,
      status: "DRAFT",
      participants: { create: [{ name: "Jordan Reyes", roleType: "specialist" }, { name: "Dana Whitfield", roleType: "customer" }] },
    },
  });

  // ---------- Audit trail flavor ----------
  await db.auditLog.createMany({
    data: [
      { organizationId: org.id, userId: demoUser.id, action: "auth.register", resourceType: "user", resourceId: demoUser.id },
      { organizationId: org.id, userId: demoUser.id, action: "user.invite", resourceType: "user", resourceId: managerUser.id, metadata: { role: "MANAGER" } },
      { organizationId: org.id, userId: demoUser.id, action: "call.resolution", resourceType: "call", resourceId: flagshipCall.id },
    ],
  });

  const docCount = await db.document.count({ where: { organizationId: org.id } });
  const chunkCount = await db.documentChunk.count({ where: { organizationId: org.id } });
  console.log(`\nSeed complete.`);
  console.log(`  Organization: Meridian Solutions`);
  console.log(`  Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Documents: ${docCount} (${chunkCount} chunks embedded)`);
  console.log(`  Isolation check org: Northgate Digital (isolated@example.com / ${DEMO_PASSWORD})`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
