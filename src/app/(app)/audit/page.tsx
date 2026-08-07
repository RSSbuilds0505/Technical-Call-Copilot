import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, EmptyState } from "@/components/ui";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACTION_TONES: Record<string, "ok" | "warn" | "danger" | "signal" | "neutral"> = {
  "auth.login": "signal",
  "auth.register": "signal",
  "user.invite": "ok",
  "role.change": "warn",
  "data.delete": "danger",
  "data.export": "warn",
  "integration.connect": "ok",
  "integration.disconnect": "warn",
};

export default async function AuditPage({ searchParams }: { searchParams: { action?: string } }) {
  const ctx = await requireTenant();
  if (!hasAtLeast(ctx.role, "MANAGER")) redirect("/dashboard");

  const action = searchParams.action || undefined;
  const [logs, actions] = await Promise.all([
    db.auditLog.findMany({
      where: { organizationId: ctx.organizationId, ...(action ? { action } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { name: true, email: true } } },
    }),
    db.auditLog.groupBy({ by: ["action"], where: { organizationId: ctx.organizationId }, orderBy: { action: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-white">Audit log</h1>
        <p className="mt-1 text-sm text-muted">Security-relevant activity across the organization. Showing the latest 200 entries.</p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip label="All" href="/audit" active={!action} />
        {actions.map((a) => (
          <FilterChip key={a.action} label={a.action} href={`/audit?action=${encodeURIComponent(a.action)}`} active={action === a.action} />
        ))}
      </div>

      {logs.length === 0 ? (
        <EmptyState title="No audit entries" hint={action ? "No entries match this filter." : "Activity will appear here as your team uses the workspace."} />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-line/50 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <p className="text-gray-100">{log.user?.name ?? "system"}</p>
                    {log.user?.email && <p className="text-xs text-muted">{log.user.email}</p>}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={ACTION_TONES[log.action] ?? "neutral"}>{log.action}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-300">
                    {log.resourceType}
                    {log.resourceId && <span className="text-muted"> · {log.resourceId.slice(0, 8)}</span>}
                  </td>
                  <td className="hidden max-w-xs truncate px-4 py-2.5 text-xs text-muted md:table-cell">
                    {log.metadata ? JSON.stringify(log.metadata) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function FilterChip(props: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={props.href}
      className={
        "rounded-full border px-3 py-1 text-xs " +
        (props.active ? "border-signal bg-signal/15 text-signal" : "border-line bg-surface-2 text-muted hover:text-white")
      }
    >
      {props.label}
    </Link>
  );
}
