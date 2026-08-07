"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/calls", label: "Calls" },
  { href: "/customers", label: "Customers" },
  { href: "/documents", label: "Knowledge base" },
  { href: "/analytics", label: "Analytics" },
];

const ADMIN_NAV = [
  { href: "/settings", label: "Settings", minRole: ["ADMIN", "MANAGER"] },
  { href: "/audit", label: "Audit log", minRole: ["ADMIN", "MANAGER"] },
];

export function SidebarNav({ role }: { role: string }) {
  const pathname = usePathname();
  const items = [...NAV, ...ADMIN_NAV.filter((i) => i.minRole.includes(role))];
  return (
    <nav className="mt-2 flex flex-col gap-0.5 px-3" aria-label="Main">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              active ? "bg-signal/10 font-medium text-signal" : "text-slate-300 hover:bg-surface-3"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="mt-2 text-xs text-muted underline-offset-2 hover:text-signal hover:underline"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
