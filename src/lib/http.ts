import { NextResponse } from "next/server";

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Limit request payload size at the application layer for small JSON APIs.
export async function readJson(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 10_000) throw new Error("Request body is too large.");
  return request.json();
}
