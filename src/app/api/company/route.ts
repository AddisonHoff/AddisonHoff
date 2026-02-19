import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { getCurrentUserId, isAuthEnabled } from "@/lib/auth";

const createCompanySchema = z.object({
  name: z.string().min(1).max(200),
  ein: z.string().optional(),
  state: z.string().max(2).optional(),
  naicsCode: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const currentUserId = await getCurrentUserId();
  let orgId: string | undefined;

  if (isAuthEnabled()) {
    const { auth } = await import("@clerk/nextjs/server");
    orgId = (await auth()).orgId ?? undefined;
  }

  if (!currentUserId) {
  const userId = await getCurrentUserId();
  let orgId: string | null = null;

  if (isAuthEnabled()) {
    const { auth } = await import("@clerk/nextjs/server");
    orgId = (await auth()).orgId;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createCompanySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Check if user already has a company
  const existing = await db.companyMember.findFirst({
    where: { clerkUserId: currentUserId },
  });

  if (existing) {
    return NextResponse.json(
      { error: "You already have a company set up" },
      { status: 409 },
    );
  }

  const company = await db.company.create({
    data: {
      ...parsed.data,
      clerkOrgId: orgId,
      members: {
        create: {
          clerkUserId: currentUserId,
          role: "ADMIN",
          email: "", // Will be populated from Clerk user data
        },
      },
    },
  });

  return NextResponse.json({ id: company.id }, { status: 201 });
}
