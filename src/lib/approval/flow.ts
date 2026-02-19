import { db } from "@/lib/db";
import { ClaimStatus } from "@prisma/client";
import { generateApprovalUrls } from "./tokens";
import { sendClaimApprovalEmail } from "@/lib/email/send";
import { format } from "date-fns";

const FEE_PERCENTAGE = 25;

/**
 * Send approval emails for all newly identified claims.
 * This runs after the matching engine finds new matches.
 */
export async function sendPendingApprovalEmails(): Promise<{
  sent: number;
  errors: string[];
}> {
  const claims = await db.claim.findMany({
    where: { status: ClaimStatus.IDENTIFIED },
    include: {
      company: {
        include: { members: { where: { role: "ADMIN" } } },
      },
      settlement: {
        include: { defendants: true },
      },
      match: true,
    },
  });

  let sent = 0;
  const errors: string[] = [];

  for (const claim of claims) {
    try {
      const adminEmail = claim.company.members[0]?.email;
      if (!adminEmail) {
        errors.push(`Claim ${claim.id}: no admin email found`);
        continue;
      }

      const { approveUrl, declineUrl, token } = generateApprovalUrls(
        claim.id,
        claim.companyId,
      );

      const defendantNames = claim.settlement.defendants
        .map((d) => d.name)
        .join(", ");

      const eligibleSpend = claim.match?.eligibleSpend
        ? `$${Number(claim.match.eligibleSpend).toLocaleString()}`
        : "Calculating...";

      const deadline = claim.settlement.claimDeadline
        ? format(claim.settlement.claimDeadline, "MMMM d, yyyy")
        : "TBD";

      await sendClaimApprovalEmail({
        to: adminEmail,
        companyName: claim.company.name,
        caseName: claim.settlement.caseName,
        qualificationReason: `You purchased from ${defendantNames}`,
        eligibleSpend,
        estimatedPayout: claim.match?.estimatedPayout || "Varies",
        feePercentage: FEE_PERCENTAGE,
        deadline,
        approveUrl,
        declineUrl,
      });

      // Update claim status and store approval token
      await db.claim.update({
        where: { id: claim.id },
        data: {
          status: ClaimStatus.PENDING_APPROVAL,
          approvalToken: token,
        },
      });

      sent++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Claim ${claim.id}: ${msg}`);
    }
  }

  return { sent, errors };
}

/**
 * Process an approval/decline action from an email link.
 */
export async function processClaimResponse(
  claimId: string,
  action: "approve" | "decline",
): Promise<{ success: boolean; message: string }> {
  const claim = await db.claim.findUnique({
    where: { id: claimId },
    include: { settlement: true },
  });

  if (!claim) {
    return { success: false, message: "Claim not found" };
  }

  if (claim.status !== ClaimStatus.PENDING_APPROVAL) {
    return {
      success: false,
      message: `Claim has already been ${claim.status.toLowerCase()}`,
    };
  }

  // Check if deadline has passed
  if (
    claim.settlement.claimDeadline &&
    claim.settlement.claimDeadline < new Date()
  ) {
    await db.claim.update({
      where: { id: claimId },
      data: { status: ClaimStatus.EXPIRED },
    });
    return {
      success: false,
      message: "The deadline for this claim has passed",
    };
  }

  if (action === "approve") {
    await db.claim.update({
      where: { id: claimId },
      data: {
        status: ClaimStatus.APPROVED,
        approvedAt: new Date(),
      },
    });
    return {
      success: true,
      message: "Claim approved. We'll file it and notify you when it's submitted.",
    };
  }

  // Decline
  await db.claim.update({
    where: { id: claimId },
    data: { status: ClaimStatus.DECLINED },
  });

  return { success: true, message: "Claim declined. We won't file this one." };
}
