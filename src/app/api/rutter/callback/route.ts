import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createRutterClient } from "@/lib/rutter/client";
import { inngest } from "@/lib/inngest/client";

/**
 * Rutter OAuth callback handler.
 * Rutter redirects here after the user connects their accounting platform.
 * We exchange the public token for an access token and trigger initial sync.
 */
export async function GET(request: NextRequest) {
  const publicToken = request.nextUrl.searchParams.get("public_token");
  const companyId = request.nextUrl.searchParams.get("companyId");

  if (!publicToken || !companyId) {
    return NextResponse.redirect(
      new URL("/onboarding/connect?error=missing_params", request.url),
    );
  }

  try {
    const rutter = createRutterClient();
    const { access_token, connection_id, platform } =
      await rutter.exchangeToken(publicToken);

    // Save the connection
    await db.rutterConnection.create({
      data: {
        companyId,
        accessToken: access_token,
        connectionId: connection_id,
        platform,
      },
    });

    // Trigger initial sync and matching
    await inngest.send({
      name: "company/connected",
      data: { companyId },
    });

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("Rutter callback error:", error);
    return NextResponse.redirect(
      new URL("/onboarding/connect?error=connection_failed", request.url),
    );
  }
}
