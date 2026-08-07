"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, ErrorNote, Input, Label } from "@/components/ui";

function ResetInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const data = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/reset-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.get("email") }),
    });
    const json = await res.json();
    setMessage(json.message ?? "Check your inbox for a reset link.");
    setBusy(false);
  }

  async function confirmReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/reset-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: data.get("password") }),
    });
    if (res.ok) {
      router.push("/login");
    } else {
      setError((await res.json()).error ?? "Reset failed.");
      setBusy(false);
    }
  }

  if (token) {
    return (
      <Card>
        <form onSubmit={confirmReset} className="space-y-4">
          <div>
            <Label htmlFor="password">New password (10+ characters)</Label>
            <Input id="password" name="password" type="password" minLength={10} required />
          </div>
          <ErrorNote message={error} />
          <Button type="submit" className="w-full" disabled={busy}>Set new password</Button>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={requestReset} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        {message && <p className="text-sm text-ok">{message}</p>}
        <Button type="submit" className="w-full" disabled={busy}>Send reset link</Button>
        <p className="text-center text-xs text-muted"><Link className="text-signal" href="/login">Back to sign in</Link></p>
      </form>
    </Card>
  );
}

export default function ResetPage() {
  return <Suspense><ResetInner /></Suspense>;
}
