import { NextRequest, NextResponse } from "next/server";
import { verifyApprovalToken } from "@/lib/approval/tokens";
import { processClaimResponse } from "@/lib/approval/flow";
import { inngest } from "@/lib/inngest/client";

/**
 * Handle claim approval/decline from email links.
 * No auth required — the signed JWT token in the URL is the authentication.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return renderResponse("Invalid link", "This approval link is missing or invalid.", false);
  }

  const payload = verifyApprovalToken(token);

  if (!payload) {
    return renderResponse(
      "Link expired",
      "This approval link has expired. Please contact us if you need a new one.",
      false,
    );
  }

  const result = await processClaimResponse(payload.claimId, payload.action);

  // If approved, trigger the filing job
  if (result.success && payload.action === "approve") {
    await inngest.send({
      name: "claim/approved",
      data: { claimId: payload.claimId },
    });
  }

  return renderResponse(
    payload.action === "approve" ? "Claim Approved" : "Claim Declined",
    result.message,
    result.success,
  );
}

function renderResponse(title: string, message: string, success: boolean) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — ClaimScout</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f6f9fc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 40px;
      max-width: 440px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 12px;
      color: #1a1a1a;
    }
    p {
      color: #6b7280;
      font-size: 15px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? (title.includes("Approved") ? "&#9989;" : "&#128721;") : "&#9888;&#65039;"}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
