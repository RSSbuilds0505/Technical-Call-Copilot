"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card, Select, Input, Button } from "@/components/ui";

const CALL_TYPES = ["discovery", "demo", "implementation", "troubleshooting", "support", "architecture_review", "customer_success", "escalation", "internal", "other"];

export function CallFilters({ customers, users }: { customers: { id: string; name: string }[]; users: { id: string; name: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.push(`/calls?${next.toString()}`);
  }

  return (
    <Card className="grid gap-2 md:grid-cols-6">
      <Select value={params.get("customerId") ?? ""} onChange={(e) => set("customerId", e.target.value)} aria-label="Filter by customer">
        <option value="">All customers</option>
        {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <Select value={params.get("ownerId") ?? ""} onChange={(e) => set("ownerId", e.target.value)} aria-label="Filter by user">
        <option value="">All users</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </Select>
      <Select value={params.get("callType") ?? ""} onChange={(e) => set("callType", e.target.value)} aria-label="Filter by call type">
        <option value="">All call types</option>
        {CALL_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
      </Select>
      <Select value={params.get("resolved") ?? ""} onChange={(e) => set("resolved", e.target.value)} aria-label="Filter by resolution">
        <option value="">Resolved + unresolved</option>
        <option value="true">Resolved</option>
        <option value="false">Unresolved</option>
      </Select>
      <Input type="date" value={params.get("from") ?? ""} onChange={(e) => set("from", e.target.value)} aria-label="From date" />
      <div className="flex gap-2">
        <Input type="date" value={params.get("to") ?? ""} onChange={(e) => set("to", e.target.value)} aria-label="To date" />
        <Button variant="ghost" size="sm" onClick={() => router.push("/calls")}>Clear</Button>
      </div>
    </Card>
  );
}
