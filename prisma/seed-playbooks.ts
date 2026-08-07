/**
 * 20 built-in playbook templates (organizationId = null, shared across all orgs).
 * These give the copilot structured troubleshooting patterns for common
 * CRM / integration issues even before an org uploads any documents.
 */
export interface PlaybookSeed {
  slug: string;
  title: string;
  platforms: string[];
  symptoms: string[];
  clarifyingQuestions: string[];
  likelyCauses: { cause: string; likelihood: "high" | "medium" | "low"; verificationStep: string }[];
  safeActions: string[];
  riskyActions: string[];
  escalationCriteria: string[];
  captureFields: string[];
}

export const PLAYBOOKS: PlaybookSeed[] = [
  {
    slug: "unwanted-contact-sync",
    title: "Integration syncing unwanted records",
    platforms: ["hubspot", "salesforce", "apollo", "zoominfo"],
    symptoms: ["every contact syncing", "unwanted contacts", "syncing everything", "only want qualified", "too many records coming over", "database flooded"],
    clarifyingQuestions: [
      "Is the sync native, or through a middleware tool like Zapier or Make?",
      "Do you see any filters or inclusion lists configured on the source side?",
      "When did the unwanted records start appearing, and did anything change around that time?",
      "Roughly how many unwanted records have come over so far?",
    ],
    likelyCauses: [
      { cause: "Source-side sync filter is missing or set to 'all contacts'", likelihood: "high", verificationStep: "Open the integration settings in the source tool and check the sync scope or filter configuration" },
      { cause: "An inclusion list or saved search was deleted or renamed, causing fallback to full sync", likelihood: "medium", verificationStep: "Check whether the list the sync references still exists and has the expected membership" },
      { cause: "A workflow on the destination side is creating records from raw sync events", likelihood: "low", verificationStep: "Review recently changed workflows that have contact-creation actions" },
    ],
    safeActions: [
      "Review the current sync filter configuration together on screen share",
      "Create a test list of qualified contacts and confirm how membership is defined",
      "Check the integration's sync log for the trigger reason on a sample unwanted contact",
    ],
    riskyActions: [
      "Pausing the sync (may create a backlog or data gaps)",
      "Bulk-deleting the already-synced contacts (irreversible without a backup, may break associations)",
    ],
    escalationCriteria: ["Sync configuration looks correct but records still flow over", "Vendor-side bug suspected in the native integration"],
    captureFields: ["Source tool and plan tier", "Sync type (native/middleware)", "Filter configuration screenshot", "Approximate unwanted record count"],
  },
  {
    slug: "duplicate-contacts",
    title: "Duplicate contacts after import or sync",
    platforms: ["hubspot", "salesforce"],
    symptoms: ["duplicates", "duplicate contacts", "same person twice", "records doubled"],
    clarifyingQuestions: [
      "Are the duplicates exact email matches, or do they differ (aliases, casing, secondary emails)?",
      "Did the duplicates appear after a specific import or a new integration going live?",
      "Which system do you consider the source of truth for contacts?",
    ],
    likelyCauses: [
      { cause: "Import file matched on a different unique key than the CRM uses (e.g. no email column)", likelihood: "high", verificationStep: "Open one duplicate pair and compare create dates and record sources" },
      { cause: "Integration is writing with its own ID instead of matching on email", likelihood: "medium", verificationStep: "Check the integration's record-matching or deduplication setting" },
      { cause: "Contacts created from form fills with alternate email addresses", likelihood: "medium", verificationStep: "Compare the email properties of a duplicate pair for aliases or secondary addresses" },
    ],
    safeActions: ["Run the CRM's duplicate management view to size the problem", "Export a sample of duplicate pairs for review before any merging"],
    riskyActions: ["Bulk merge (merges are irreversible in most CRMs)", "Deleting the newer record without checking activity history"],
    escalationCriteria: ["Duplicates keep being created after matching settings were fixed"],
    captureFields: ["Duplicate pair example URLs", "Matching key used by each system", "Import/integration that triggered it"],
  },
  {
    slug: "workflow-not-enrolling",
    title: "Workflow or automation not enrolling records",
    platforms: ["hubspot"],
    symptoms: ["workflow not triggering", "not enrolling", "automation not firing", "emails not sending from workflow"],
    clarifyingQuestions: [
      "Is the workflow turned on, and were the records created before or after it was activated?",
      "Do the enrollment triggers require ALL criteria or ANY criteria?",
      "Is re-enrollment enabled for records that met the criteria before?",
    ],
    likelyCauses: [
      { cause: "Records met the criteria before the workflow was turned on and re-enrollment is off", likelihood: "high", verificationStep: "Use the workflow's enrollment test on a specific record and read the reason it is not enrolled" },
      { cause: "Trigger criteria use AND logic where OR was intended", likelihood: "medium", verificationStep: "Review the enrollment trigger groups and confirm the AND/OR structure" },
      { cause: "A suppression list or unenrollment condition removes records immediately", likelihood: "medium", verificationStep: "Check suppression settings and the enrollment history log for instant unenrollments" },
    ],
    safeActions: ["Run the built-in enrollment test against a known-good record", "Review the workflow's enrollment history for skip reasons"],
    riskyActions: ["Bulk manual enrollment (may send emails to unintended recipients)", "Turning on re-enrollment without reviewing criteria (can double-send)"],
    escalationCriteria: ["Enrollment test says the record should enroll but it does not"],
    captureFields: ["Workflow name and URL", "Example record that should enroll", "Enrollment test result"],
  },
  {
    slug: "field-mapping-sync-errors",
    title: "Field mapping errors between systems",
    platforms: ["salesforce", "hubspot"],
    symptoms: ["field not syncing", "mapping error", "picklist error", "value not coming over", "sync error on field"],
    clarifyingQuestions: [
      "Which specific fields fail, and what error does the sync log show?",
      "Are the field types compatible (e.g. picklist to picklist with matching values)?",
      "Was a picklist value added on one side recently?",
    ],
    likelyCauses: [
      { cause: "Picklist values exist in the source but not the destination", likelihood: "high", verificationStep: "Compare the picklist value sets for the failing field on both sides" },
      { cause: "Field type mismatch (text into number, multi-select into single-select)", likelihood: "medium", verificationStep: "Check the data types of the mapped pair in the integration's field mapping screen" },
      { cause: "Destination field is read-only, calculated, or lacks API write permission", likelihood: "medium", verificationStep: "Check field-level security and whether the integration user can edit the field" },
    ],
    safeActions: ["Pull the integration error log for the exact failing records and messages", "Test a single record update with a known-valid value"],
    riskyActions: ["Changing field types (can destroy existing data)", "Remapping fields in bulk without documenting the current state"],
    escalationCriteria: ["Errors persist after values and types are aligned", "Sync vendor confirms a defect"],
    captureFields: ["Failing field API names on both sides", "Exact error message", "Example record IDs"],
  },
  {
    slug: "subscription-tier-limitation",
    title: "Feature blocked by subscription tier",
    platforms: ["hubspot", "salesforce"],
    symptoms: ["need to upgrade", "feature not available", "locked feature", "plan limit", "hit our limit"],
    clarifyingQuestions: [
      "Which exact feature or limit are you hitting, and what does the in-app message say?",
      "What plan tier are you on today?",
      "Is this a recurring need or a one-time project?",
    ],
    likelyCauses: [
      { cause: "The feature genuinely requires a higher tier", likelihood: "high", verificationStep: "Check the vendor's official pricing/feature matrix for the specific feature" },
      { cause: "A workaround exists within the current tier (manual process, different tool combination)", likelihood: "medium", verificationStep: "Identify what outcome is needed and map it to features available on the current tier" },
    ],
    safeActions: ["Confirm the exact tier requirement from official documentation", "Quantify the cost of the workaround vs the upgrade so the customer can decide"],
    riskyActions: ["Building brittle workarounds that silently break at other limits"],
    escalationCriteria: ["Pricing negotiation is needed (route to the account owner, not support)"],
    captureFields: ["Feature name", "Current tier", "In-app limitation message"],
  },
  {
    slug: "webhook-auth-failures",
    title: "Webhook delivery or authentication failures",
    platforms: ["hubspot", "salesforce", "custom"],
    symptoms: ["webhook failing", "401", "403", "signature invalid", "events not arriving", "webhook retries"],
    clarifyingQuestions: [
      "What HTTP status is the receiving endpoint returning (401, 403, 500)?",
      "Was a secret, token, or certificate rotated recently?",
      "Is the failure constant or intermittent?",
    ],
    likelyCauses: [
      { cause: "Signing secret or bearer token rotated on one side but not the other", likelihood: "high", verificationStep: "Compare the secret's last-rotated date with the timestamp of the first failure" },
      { cause: "Signature verification is using the wrong payload encoding (raw body vs parsed JSON)", likelihood: "medium", verificationStep: "Log the exact bytes being signed on the receiver and compare with the sender's documented scheme" },
      { cause: "Endpoint URL changed or a proxy strips authentication headers", likelihood: "medium", verificationStep: "Send a test event and inspect the headers received by the endpoint" },
    ],
    safeActions: ["Check the sender's webhook delivery log for statuses and retry counts", "Replay a single test event against a request inspector to see exactly what is sent"],
    riskyActions: ["Disabling signature verification to 'make it work' (removes authentication entirely)"],
    escalationCriteria: ["Failures continue with verified matching secrets", "Sender's delivery log shows success but nothing arrives (network path issue)"],
    captureFields: ["HTTP status codes", "First failure timestamp", "Secret rotation history"],
  },
  {
    slug: "email-deliverability",
    title: "Marketing emails landing in spam or not sending",
    platforms: ["hubspot"],
    symptoms: ["emails going to spam", "low open rates suddenly", "emails not delivered", "bounces increased"],
    clarifyingQuestions: [
      "Is this all recipients or specific domains?",
      "Are SPF, DKIM, and DMARC configured for the sending domain?",
      "Did sending volume or list composition change recently?",
    ],
    likelyCauses: [
      { cause: "Missing or broken domain authentication (SPF/DKIM/DMARC)", likelihood: "high", verificationStep: "Run the domain through an authentication checker and review the CRM's domain settings page" },
      { cause: "List hygiene problem: purchased or stale lists spiking bounces", likelihood: "medium", verificationStep: "Review bounce and unsubscribe rates for the last 5 sends against historical baseline" },
    ],
    safeActions: ["Verify domain authentication records", "Segment recent sends by recipient domain to find where drops occur"],
    riskyActions: ["Continuing to send to high-bounce lists (damages sender reputation further)"],
    escalationCriteria: ["Domain appears on a blocklist (needs a structured remediation plan)"],
    captureFields: ["Sending domain", "Bounce rate trend", "Authentication check results"],
  },
  {
    slug: "lead-scoring-not-updating",
    title: "Lead scores not updating or scoring incorrectly",
    platforms: ["hubspot", "salesforce"],
    symptoms: ["score not updating", "everyone has the same score", "scores look wrong", "MQL threshold never hit"],
    clarifyingQuestions: [
      "Is the score property manual or computed by a scoring rule set?",
      "When was the scoring model last edited?",
      "Do the scoring criteria reference properties or lists that still exist?",
    ],
    likelyCauses: [
      { cause: "Scoring criteria reference a deleted or renamed property/list", likelihood: "high", verificationStep: "Open the score property's criteria and confirm every referenced asset still exists" },
      { cause: "Score recalculation lag after a large model edit", likelihood: "medium", verificationStep: "Check a recently active contact and see if the score reflects activity after the edit time" },
    ],
    safeActions: ["Audit each scoring criterion against existing assets", "Test with one contact whose expected score can be computed by hand"],
    riskyActions: ["Rebuilding the scoring model from scratch mid-quarter without documenting the old one"],
    escalationCriteria: ["Scores frozen for more than 24 hours after edits were verified"],
    captureFields: ["Score property name", "Last model edit date", "Example contact with expected vs actual score"],
  },
  {
    slug: "permissions-user-access",
    title: "User cannot see or edit records they should",
    platforms: ["salesforce", "hubspot"],
    symptoms: ["can't see records", "permission denied", "insufficient privileges", "records missing for one user"],
    clarifyingQuestions: [
      "Is it one user, one team, or everyone?",
      "What exact object and action fails (view, edit, delete)?",
      "Did roles, profiles, or sharing rules change recently?",
    ],
    likelyCauses: [
      { cause: "Role hierarchy or team assignment does not include the records' owner branch", likelihood: "high", verificationStep: "Check the user's role/team and the record owner's position relative to it" },
      { cause: "Object or field-level permission missing from the profile/permission set", likelihood: "medium", verificationStep: "Review the user's effective permissions for the specific object and field" },
    ],
    safeActions: ["Reproduce with the affected user's exact view (login-as if policy allows)", "Compare permissions with a user who can see the records"],
    riskyActions: ["Granting broad admin rights as a shortcut (audit and security risk)"],
    escalationCriteria: ["Permissions look correct but access still fails (possible sharing recalculation issue)"],
    captureFields: ["Affected user and role", "Object/action failing", "Recent permission changes"],
  },
  {
    slug: "reporting-numbers-mismatch",
    title: "Reports show different numbers than expected",
    platforms: ["hubspot", "salesforce"],
    symptoms: ["numbers don't match", "report wrong", "dashboard different from list", "revenue mismatch"],
    clarifyingQuestions: [
      "Which two numbers disagree, and what filters does each view apply?",
      "Do the views use the same date property (create date vs close date vs activity date)?",
      "Are both views scoped to the same pipelines, teams, or record types?",
    ],
    likelyCauses: [
      { cause: "Different date properties or time ranges between the two views", likelihood: "high", verificationStep: "List the exact filters of both views side by side and diff them" },
      { cause: "One view excludes archived/deleted/other-pipeline records", likelihood: "medium", verificationStep: "Check inclusion of archived records and pipeline scoping in both views" },
    ],
    safeActions: ["Rebuild the smaller number's filter set on top of the larger view step by step to find the diverging filter"],
    riskyActions: ["Editing shared report filters used by other teams without notice"],
    escalationCriteria: ["Identical filters still disagree (possible indexing/caching defect)"],
    captureFields: ["Both report URLs", "Filter list of each", "Expected number and source of truth"],
  },
  {
    slug: "api-rate-limits",
    title: "Integration hitting API rate limits",
    platforms: ["hubspot", "salesforce", "custom"],
    symptoms: ["429", "rate limit", "throttled", "sync slowed down", "daily limit reached"],
    clarifyingQuestions: [
      "Which app or integration consumes the most calls (check the API usage dashboard)?",
      "Is usage spiky (batch jobs) or constant?",
      "What plan tier and corresponding limits apply?",
    ],
    likelyCauses: [
      { cause: "A polling integration checks far more often than data changes", likelihood: "high", verificationStep: "Review each connected app's polling interval against actual data change frequency" },
      { cause: "A batch job retries failed calls in a tight loop", likelihood: "medium", verificationStep: "Check error logs for repeated identical failing calls" },
    ],
    safeActions: ["Pull the API usage breakdown by app", "Switch pollers to webhooks where supported"],
    riskyActions: ["Raising limits with a plan upgrade before fixing a runaway consumer"],
    escalationCriteria: ["A vendor app consumes calls disproportionately with no configuration to reduce it"],
    captureFields: ["Daily call volume by app", "Limit for the current tier", "Spike timestamps"],
  },
  {
    slug: "data-import-mapping",
    title: "Import mapped columns incorrectly or partially failed",
    platforms: ["hubspot", "salesforce"],
    symptoms: ["import errors", "wrong fields populated", "import skipped rows", "dates wrong after import"],
    clarifyingQuestions: [
      "Do you still have the import file and the error report?",
      "What format were dates and numbers in the file?",
      "Was the import matched on email or another key?",
    ],
    likelyCauses: [
      { cause: "Column mapped to the wrong property or property type rejected values", likelihood: "high", verificationStep: "Open the import summary and inspect the per-column mapping and error rows" },
      { cause: "Locale format mismatch (DD/MM vs MM/DD, comma decimals)", likelihood: "medium", verificationStep: "Compare a failing row's raw value with the destination property's expected format" },
    ],
    safeActions: ["Download the import error file and categorize failures", "Re-import only the failed rows into a test list first"],
    riskyActions: ["Re-running the full import without dedup matching (creates duplicates)"],
    escalationCriteria: ["Import tool reports success but records are missing"],
    captureFields: ["Import ID", "Error file", "Sample failing rows"],
  },
  {
    slug: "sso-login-issues",
    title: "SSO or login failures for CRM users",
    platforms: ["salesforce", "hubspot", "okta", "azure-ad"],
    symptoms: ["can't log in", "SSO error", "SAML error", "redirect loop"],
    clarifyingQuestions: [
      "Is it all users or specific ones, and does a direct (non-SSO) login work?",
      "Was the identity provider certificate rotated recently?",
      "What exact error appears and at which step of the redirect?",
    ],
    likelyCauses: [
      { cause: "Expired or rotated IdP signing certificate not updated in the CRM", likelihood: "high", verificationStep: "Compare the certificate fingerprint in the CRM's SSO settings with the IdP's current one" },
      { cause: "Clock skew between IdP and service provider invalidating assertions", likelihood: "low", verificationStep: "Check the SAML response timestamps against server time" },
    ],
    safeActions: ["Test with one user and capture the SAML trace", "Verify certificate expiry dates on both sides"],
    riskyActions: ["Disabling SSO enforcement broadly (opens password-only access)"],
    escalationCriteria: ["Identity team owns the IdP config and must rotate certificates"],
    captureFields: ["Error message and step", "Certificate expiry dates", "Affected user list"],
  },
  {
    slug: "pipeline-stage-hygiene",
    title: "Deals stuck in stages or pipeline reporting unusable",
    platforms: ["hubspot", "salesforce"],
    symptoms: ["deals stuck", "pipeline a mess", "stages don't match process", "close dates in the past"],
    clarifyingQuestions: [
      "Does each stage have a clear exit criterion the team agrees on?",
      "Are stage moves manual or automated anywhere?",
      "How many open deals have close dates in the past?",
    ],
    likelyCauses: [
      { cause: "Stages model the org chart or wishful thinking rather than buyer commitments", likelihood: "high", verificationStep: "Walk one real deal through the stages and see where definitions get fuzzy" },
      { cause: "No required fields or validation on stage change", likelihood: "medium", verificationStep: "Check stage-change requirements configuration" },
    ],
    safeActions: ["Run a pipeline hygiene report (stale deals, past close dates) to size the issue", "Draft exit criteria per stage with the sales lead"],
    riskyActions: ["Bulk-moving or bulk-closing deals without owner review"],
    escalationCriteria: ["This is a process design engagement rather than a support fix (scope appropriately)"],
    captureFields: ["Stage list with current definitions", "Stale deal count", "Owner of the sales process"],
  },
  {
    slug: "tracking-attribution",
    title: "Source tracking or attribution missing/wrong",
    platforms: ["hubspot"],
    symptoms: ["everything shows direct traffic", "utm not captured", "original source wrong", "attribution empty"],
    clarifyingQuestions: [
      "Is the tracking code installed on every page, including landing pages on subdomains?",
      "Are UTMs applied consistently on paid and email links?",
      "Do forms submit on the same domain the tracking cookie is set on?",
    ],
    likelyCauses: [
      { cause: "Tracking script missing on entry pages or blocked before consent", likelihood: "high", verificationStep: "Load a landing page with the network inspector and confirm the tracking script fires" },
      { cause: "Cross-domain form submissions dropping the visitor cookie", likelihood: "medium", verificationStep: "Trace one known submission and check whether the contact's first-page-seen is populated" },
    ],
    safeActions: ["Audit script presence across templates", "Submit a test form with UTMs and inspect the created contact's source properties"],
    riskyActions: ["Rewriting historical source data (destroys the audit trail)"],
    escalationCriteria: ["Consent management platform intentionally blocks tracking (needs a policy decision, not a fix)"],
    captureFields: ["Domains involved", "Test submission contact URL", "Consent tool in use"],
  },
  {
    slug: "sandbox-vs-production",
    title: "Change works in sandbox but fails in production",
    platforms: ["salesforce"],
    symptoms: ["works in sandbox", "deployment failed", "different behavior in prod", "validation errors on deploy"],
    clarifyingQuestions: [
      "When was the sandbox last refreshed from production?",
      "What exact error does the deployment or the prod execution show?",
      "Are there prod-only automations, validation rules, or data volumes involved?",
    ],
    likelyCauses: [
      { cause: "Stale sandbox missing prod validation rules, flows, or data shapes", likelihood: "high", verificationStep: "Compare the failing component's dependencies between environments" },
      { cause: "Data volume differences triggering governor limits only in production", likelihood: "medium", verificationStep: "Check debug logs for limit exceptions on the prod run" },
    ],
    safeActions: ["Run the deployment validation against production without deploying", "Reproduce with production-scale data in a full sandbox"],
    riskyActions: ["Deploying with test skips or reduced coverage thresholds"],
    escalationCriteria: ["Managed package conflicts requiring vendor involvement"],
    captureFields: ["Deployment error text", "Sandbox refresh date", "Components in the change set"],
  },
  {
    slug: "gdpr-data-deletion",
    title: "GDPR/CCPA deletion or consent requests",
    platforms: ["hubspot", "salesforce"],
    symptoms: ["gdpr request", "delete my data", "right to be forgotten", "consent basis", "ccpa"],
    clarifyingQuestions: [
      "Is this a deletion, access, or consent-basis question?",
      "Does the record exist in connected systems (data warehouse, email tool) beyond the CRM?",
      "Who owns privacy compliance internally?",
    ],
    likelyCauses: [
      { cause: "Standard subject request needing the CRM's compliant-deletion feature (not regular delete)", likelihood: "high", verificationStep: "Confirm the request type in writing and locate the record across systems" },
    ],
    safeActions: ["Document the request and inventory every system holding the subject's data", "Use the platform's GDPR-delete (permanent) rather than regular delete where required"],
    riskyActions: ["Deleting only in the CRM while syncs restore the record from another system"],
    escalationCriteria: ["Any ambiguity about legal basis: route to the customer's privacy owner or counsel. We do not give legal advice."],
    captureFields: ["Request type and date", "Systems holding the data", "Compliance owner"],
  },
  {
    slug: "custom-object-modeling",
    title: "Custom object or data model design questions",
    platforms: ["hubspot", "salesforce"],
    symptoms: ["should this be a custom object", "data model", "how to structure", "associations design"],
    clarifyingQuestions: [
      "What real-world thing does this data represent, and how does it relate to contacts/companies/deals?",
      "Will you report on it, automate from it, or both?",
      "How many records and what growth rate do you expect?",
    ],
    likelyCauses: [
      { cause: "Requirement fits an existing standard object with custom properties (simpler than a custom object)", likelihood: "medium", verificationStep: "Map the required fields and relations against standard objects first" },
      { cause: "Genuine many-to-many or lifecycle-independent entity justifying a custom object", likelihood: "medium", verificationStep: "Check whether the entity has its own lifecycle independent of contacts/deals" },
    ],
    safeActions: ["Sketch the entity relationship on the call and validate cardinality with real examples", "Check tier limits on custom objects before committing to a design"],
    riskyActions: ["Creating custom objects ad hoc without naming and association conventions (hard to unwind)"],
    escalationCriteria: ["Cross-system canonical modeling spanning a data warehouse (architecture engagement)"],
    captureFields: ["Entities and relations sketch", "Reporting requirements", "Expected volume"],
  },
  {
    slug: "territory-routing",
    title: "Lead routing or assignment sending records to wrong owners",
    platforms: ["salesforce", "hubspot"],
    symptoms: ["leads going to wrong rep", "round robin broken", "assignment not firing", "territory wrong"],
    clarifyingQuestions: [
      "What defines correct ownership (geography, segment, named accounts)?",
      "What is the rule order, and could an earlier rule capture these records first?",
      "Are the routing inputs (country, size fields) reliably populated at create time?",
    ],
    likelyCauses: [
      { cause: "Routing rule order captures records before the intended rule evaluates", likelihood: "high", verificationStep: "Trace one misrouted record through the rule list in order" },
      { cause: "Routing depends on fields that are empty at creation and only enriched later", likelihood: "medium", verificationStep: "Check field population timestamps vs assignment timestamp on a misrouted record" },
    ],
    safeActions: ["Trace 3 recent misrouted records through the rules", "Add a fallback queue so nothing lands with a random owner"],
    riskyActions: ["Reordering rules live during business hours without a test"],
    escalationCriteria: ["Assignment engine behaves inconsistently with identical inputs"],
    captureFields: ["Misrouted record examples", "Rule list order", "Enrichment timing"],
  },
  {
    slug: "backup-restore",
    title: "Data loss: accidental deletion or bad bulk update",
    platforms: ["hubspot", "salesforce"],
    symptoms: ["accidentally deleted", "bulk update went wrong", "restore data", "records gone"],
    clarifyingQuestions: [
      "Exactly what was deleted or changed, when, and by which user or tool?",
      "Is there a backup tool in place, or only the platform's recycle bin?",
      "Has anything written to the affected records since (which complicates restore)?",
    ],
    likelyCauses: [
      { cause: "Records recoverable from the platform recycle bin within its retention window", likelihood: "high", verificationStep: "Check the recycle bin for the affected records and note the purge deadline" },
      { cause: "Property-level changes needing a backup snapshot or import-file reversal", likelihood: "medium", verificationStep: "Locate the pre-change export, backup snapshot, or original import file" },
    ],
    safeActions: ["Stop further automated writes to the affected records immediately", "Inventory what is recoverable from recycle bin, backups, and export files before restoring anything"],
    riskyActions: ["Mass restore without deduplication (can duplicate against re-created records)", "Restoring old values over legitimate newer edits"],
    escalationCriteria: ["No backup exists and the recycle bin window has passed (vendor support request, uncertain outcome)"],
    captureFields: ["Deletion/change timestamp and actor", "Recycle bin purge deadline", "Backup tooling in place"],
  },
];
