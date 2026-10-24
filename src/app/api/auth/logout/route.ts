import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

// Always clear the cookie, even if it is invalid or expired (e.g. after
// SESSION_SECRET rotation), so the browser never keeps a stale session.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
