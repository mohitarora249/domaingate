import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { isReservedHostname, normalizeHostname, verificationRecordName, getRoutingTarget } from "@/lib/domain";
import { badRequest, errorResponse, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createVerificationToken } from "@/lib/verification";

const createSchema = z.object({ hostname: z.string().min(1).max(500) });

export async function GET() {
  const auth = await requireApiSession();
  if (auth.response) return auth.response;

  const domains = await prisma.domain.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({
    domains: domains.map((domain) => ({
      ...domain,
      verificationRecordName: verificationRecordName(domain.hostname),
      routingTarget: getRoutingTarget(),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if (auth.response) return auth.response;

  try {
    const body = createSchema.parse(await readJson(request));
    const hostname = normalizeHostname(body.hostname);
    if (isReservedHostname(hostname)) return badRequest("This hostname is reserved by the platform.", 409);

    // One hostname may belong to only one record. The DB unique constraint is
    // the final race-safe protection; a pre-check alone would not be enough.
    const token = createVerificationToken();
    const domain = await prisma.domain.create({
      data: { hostname, verificationToken: token, status: "PENDING" },
    });

    return NextResponse.json({
      domain: {
        id: domain.id,
        hostname: domain.hostname,
        status: domain.status,
        verificationRecordName: verificationRecordName(domain.hostname),
        verificationToken: domain.verificationToken,
        routingTarget: getRoutingTarget(),
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return badRequest("This hostname has already been claimed.", 409);
    }
    return errorResponse(error, "Enter a valid hostname, such as links.example.com.");
  }
}
