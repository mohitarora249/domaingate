import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, setSessionCookie } from "@/lib/auth";
import { errorResponse, readJson } from "@/lib/http";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await readJson(request));
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    // Demo-only single-admin authentication. Replace with your product's real
    // user/workspace auth before using this as a multi-tenant production service.
    if (!adminEmail || !adminPassword || input.email.toLowerCase() !== adminEmail.toLowerCase() || input.password !== adminPassword) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }

    const token = await createSession(adminEmail);
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return errorResponse(error, "Enter a valid email address and password.");
  }
}
