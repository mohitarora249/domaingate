import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const existing = await prisma.domain.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Domain not found." }, { status: 404 });
  await prisma.domain.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
