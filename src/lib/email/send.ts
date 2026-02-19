import { Resend } from "resend";
import { render } from "@react-email/components";
import { ClaimApprovalEmail } from "./templates/claim-approval";
import { ClaimFiledEmail } from "./templates/claim-filed";
import { PayoutReceivedEmail } from "./templates/payout-received";

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM || "ClaimScout <claims@yourapp.com>";

export async function sendClaimApprovalEmail(params: {
  to: string;
  companyName: string;
  caseName: string;
  qualificationReason: string;
  eligibleSpend: string;
  estimatedPayout: string;
  feePercentage: number;
  deadline: string;
  approveUrl: string;
  declineUrl: string;
}) {
  const html = await render(
    ClaimApprovalEmail({
      companyName: params.companyName,
      caseName: params.caseName,
      qualificationReason: params.qualificationReason,
      eligibleSpend: params.eligibleSpend,
      estimatedPayout: params.estimatedPayout,
      feePercentage: params.feePercentage,
      deadline: params.deadline,
      approveUrl: params.approveUrl,
      declineUrl: params.declineUrl,
    }),
  );

  return resend.emails.send({
    from: EMAIL_FROM,
    to: params.to,
    subject: `We found a claim worth ~${params.estimatedPayout} for ${params.companyName}`,
    html,
  });
}

export async function sendClaimFiledEmail(params: {
  to: string;
  companyName: string;
  caseName: string;
  estimatedPayout: string;
}) {
  const html = await render(
    ClaimFiledEmail({
      companyName: params.companyName,
      caseName: params.caseName,
      estimatedPayout: params.estimatedPayout,
    }),
  );

  return resend.emails.send({
    from: EMAIL_FROM,
    to: params.to,
    subject: `Your claim was submitted — ${params.caseName}`,
    html,
  });
}

export async function sendPayoutReceivedEmail(params: {
  to: string;
  companyName: string;
  caseName: string;
  payoutAmount: string;
  feeAmount: string;
  netAmount: string;
}) {
  const html = await render(
    PayoutReceivedEmail({
      companyName: params.companyName,
      caseName: params.caseName,
      payoutAmount: params.payoutAmount,
      feeAmount: params.feeAmount,
      netAmount: params.netAmount,
    }),
  );

  return resend.emails.send({
    from: EMAIL_FROM,
    to: params.to,
    subject: `You received ${params.payoutAmount} from ${params.caseName}`,
    html,
  });
}
