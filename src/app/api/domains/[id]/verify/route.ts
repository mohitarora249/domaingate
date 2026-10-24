import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { verificationRecordName } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { checkTxtOwnership } from "@/lib/verification";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const domain = await prisma.domain.findUnique({ where: { id } });
  if (!domain) return NextResponse.json({ error: "Domain not found." }, { status: 404 });

  const result = await checkTxtOwnership(domain.hostname, domain.verificationToken);
  const updated = await prisma.domain.update({
    where: { id },
    data: {
      lastCheckedAt: new Date(),
      status: result.verified ? "VERIFIED" : domain.status,
      verifiedAt: result.verified ? (domain.verifiedAt ?? new Date()) : domain.verifiedAt,
      lastError: result.verified ? null : (result.reason ?? "Verification failed."),
    },
  });

  return NextResponse.json({
    verified: result.verified,
    status: updated.status,
    message: result.verified ? "Ownership verified successfully." : result.reason,
    verificationRecordName: verificationRecordName(domain.hostname),
  });
}
