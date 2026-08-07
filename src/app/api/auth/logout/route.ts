import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";

export const POST = apiHandler(async () => {
  clearSession();
  return NextResponse.json({ ok: true });
});
