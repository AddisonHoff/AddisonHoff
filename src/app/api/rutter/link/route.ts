import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserId, isAuthEnabled } from "@/lib/auth";

/**
 * Create a Rutter Link session for the user's company.
 * Returns a URL to redirect the user to Rutter's OAuth flow.
 */
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = await request.json();

  // Verify the user belongs to this company
  const member = await db.companyMember.findFirst({
    where: isAuthEnabled() ? { clerkUserId: userId, companyId } : { companyId },
  });

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const RUTTER_CLIENT_ID = process.env.RUTTER_CLIENT_ID;
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

  // Create a Rutter Link URL
  // In production, use the Rutter Link API to create a session
  const linkUrl = `https://link.rutterapi.com/?client_id=${RUTTER_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${APP_URL}/api/rutter/callback?companyId=${companyId}`)}`;

  return NextResponse.json({ linkUrl });
}
