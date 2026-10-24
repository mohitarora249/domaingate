import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { verificationRecordName } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { createVerificationToken } from "@/lib/verification";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const existing = await prisma.domain.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Domain not found." }, { status: 404 });

  // The old TXT value no longer proves anything once it is replaced, so the
  // domain starts over as PENDING and must be verified with the new token.
  const updated = await prisma.domain.update({
    where: { id },
    data: {
      verificationToken: createVerificationToken(),
      status: "PENDING",
      verifiedAt: null,
      lastCheckedAt: null,
      lastError: null,
    },
  });

  return NextResponse.json({
    status: updated.status,
    verificationToken: updated.verificationToken,
    verificationRecordName: verificationRecordName(updated.hostname),
  });
}
