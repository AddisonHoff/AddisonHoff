import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

interface ApprovalTokenPayload {
  claimId: string;
  companyId: string;
  action: "approve" | "decline";
}

/**
 * Generate signed approval/decline URLs for email CTAs.
 * These tokens embed the action so no login is required.
 * Tokens expire in 30 days (claims have deadlines, but give buffer).
 */
export function generateApprovalUrls(
  claimId: string,
  companyId: string,
): { approveUrl: string; declineUrl: string; token: string } {
  const approveToken = jwt.sign(
    { claimId, companyId, action: "approve" } satisfies ApprovalTokenPayload,
    JWT_SECRET,
    { expiresIn: "30d" },
  );

  const declineToken = jwt.sign(
    { claimId, companyId, action: "decline" } satisfies ApprovalTokenPayload,
    JWT_SECRET,
    { expiresIn: "30d" },
  );

  return {
    approveUrl: `${APP_URL}/api/claims/respond?token=${approveToken}`,
    declineUrl: `${APP_URL}/api/claims/respond?token=${declineToken}`,
    token: approveToken,
  };
}

/**
 * Verify and decode an approval token from an email link.
 */
export function verifyApprovalToken(
  token: string,
): ApprovalTokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as ApprovalTokenPayload;
    if (!payload.claimId || !payload.action) return null;
    return payload;
  } catch {
    return null;
  }
}
