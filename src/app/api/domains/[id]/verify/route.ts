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
  const wasVerified = domain.status === "VERIFIED";

  // A verified domain whose TXT record is missing or wrong loses ownership.
  // Transient resolver failures keep the current status; lastError still
  // records the failed re-check so the dashboard can surface it.
  const status = result.verified
    ? "VERIFIED"
    : wasVerified && !result.transient ? "REVOKED" : domain.status;

  const updated = await prisma.domain.update({
    where: { id },
    data: {
      lastCheckedAt: new Date(),
      status,
      // Re-verifying after a revocation starts a new verified period.
      verifiedAt: result.verified ? (wasVerified ? (domain.verifiedAt ?? new Date()) : new Date()) : domain.verifiedAt,
      lastError: result.verified ? null : (result.reason ?? "Verification failed."),
    },
  });

  const message = result.verified
    ? "Ownership verified successfully."
    : status === "REVOKED" && wasVerified
      ? `Ownership revoked: ${result.reason}`
      : result.reason;

  return NextResponse.json({
    verified: result.verified,
    status: updated.status,
    message,
    verificationRecordName: verificationRecordName(domain.hostname),
  });
}
