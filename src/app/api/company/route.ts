import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";

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
  const { userId, orgId } = await auth();
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
    where: { clerkUserId: userId },
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
      clerkOrgId: orgId || undefined,
      members: {
        create: {
          clerkUserId: userId,
          role: "ADMIN",
          email: "", // Will be populated from Clerk user data
        },
      },
    },
  });

  return NextResponse.json({ id: company.id }, { status: 201 });
}
