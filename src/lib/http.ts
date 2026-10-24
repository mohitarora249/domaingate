import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UserError } from "@/lib/errors";

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Limit request payload size at the application layer for small JSON APIs.
export async function readJson(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 10_000) throw new UserError("Request body is too large.", 413);
  try {
    return await request.json();
  } catch {
    throw new UserError("The request could not be read. Please try again.");
  }
}

/**
 * Turn a caught error into a short, user-facing JSON response. Validation
 * failures get `invalidInput`; UserError messages pass through; anything else
 * (misconfiguration, bugs) is logged server-side and hidden behind a generic
 * message so internal details never reach the client.
 */
export function errorResponse(error: unknown, invalidInput: string) {
  if (error instanceof ZodError) return badRequest(invalidInput);
  if (error instanceof UserError) return badRequest(error.message, error.status);
  console.error(error);
  return badRequest("Something went wrong. Please try again later.", 500);
}
