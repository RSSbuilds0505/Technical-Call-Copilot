import { redirect } from "next/navigation";
import Link from "next/link";
import { readSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PRODUCT_SHORT, PRODUCT_NAME } from "@/lib/branding";
import { SidebarNav, SignOutButton } from "@/components/layout/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!session.organizationId) redirect("/login");

  const membership = await db.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: session.organizationId, userId: session.userId } },
    include: { user: { select: { name: true } }, organization: { select: { name: true, deletedAt: true } } },
  });
  if (!membership || membership.organization.deletedAt) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-line bg-surface-1 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-5 py-5" title={PRODUCT_NAME}>
          <span className="flex h-7 w-7 items-center justify-center rounded bg-signal font-mono text-xs font-bold text-surface-0">{PRODUCT_SHORT}</span>
          <span className="text-sm font-semibold tracking-tight">{PRODUCT_NAME}</span>
        </Link>
        <SidebarNav role={membership.role} />
        <div className="mt-auto border-t border-line px-5 py-4 text-xs text-muted">
          <p className="truncate font-medium text-slate-300">{membership.user.name}</p>
          <p className="truncate">{membership.organization.name} · {membership.role.toLowerCase().replace("_", "-")}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="min-h-screen w-full lg:pl-56">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</div>
      </main>
    </div>
  );
}
