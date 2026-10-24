import { NextResponse } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/auth";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: true });
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
