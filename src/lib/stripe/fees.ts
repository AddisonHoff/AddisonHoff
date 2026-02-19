import { stripe } from "./client";
import { db } from "@/lib/db";
import { ClaimStatus } from "@prisma/client";
import { sendPayoutReceivedEmail } from "@/lib/email/send";

const FEE_PERCENTAGE = 0.25; // 25%

/**
 * Create a Stripe customer for a company during onboarding.
 * Save their payment method for future fee collection.
 */
export async function createStripeCustomer(
  companyId: string,
  email: string,
  companyName: string,
): Promise<string> {
  const customer = await stripe.customers.create({
    email,
    name: companyName,
    metadata: { companyId },
  });

  await db.company.update({
    where: { id: companyId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * Create a Stripe Setup Intent for collecting a payment method.
 * Used during onboarding to save a card for future charges.
 */
export async function createSetupIntent(
  stripeCustomerId: string,
): Promise<{ clientSecret: string }> {
  const setupIntent = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ["card", "us_bank_account"],
  });

  return { clientSecret: setupIntent.client_secret! };
}

/**
 * Record a payout for a claim and charge our fee.
 *
 * Flow:
 * 1. Record the payout amount on the claim
 * 2. Calculate our fee (25% of payout)
 * 3. Charge the fee to the saved payment method
 * 4. Update claim status
 * 5. Send payout notification email
 */
export async function recordPayoutAndChargeFee(
  claimId: string,
  payoutAmount: number,
): Promise<{ success: boolean; error?: string }> {
  const claim = await db.claim.findUnique({
    where: { id: claimId },
    include: {
      company: { include: { members: { where: { role: "ADMIN" } } } },
      settlement: true,
    },
  });

  if (!claim) return { success: false, error: "Claim not found" };
  if (claim.status !== ClaimStatus.FILED) {
    return { success: false, error: "Claim not in FILED status" };
  }

  const feeAmount = Math.round(payoutAmount * FEE_PERCENTAGE * 100) / 100;

  // Update claim with payout info
  await db.claim.update({
    where: { id: claimId },
    data: {
      status: ClaimStatus.PAID,
      paidAt: new Date(),
      payoutAmount,
      feeAmount,
    },
  });

  // Charge the fee via Stripe
  if (claim.company.stripeCustomerId) {
    try {
      // Get the customer's default payment method
      const customer = await stripe.customers.retrieve(
        claim.company.stripeCustomerId,
      );

      if (customer.deleted) {
        return { success: false, error: "Stripe customer deleted" };
      }

      const defaultPaymentMethod =
        customer.invoice_settings?.default_payment_method;

      if (!defaultPaymentMethod) {
        return { success: false, error: "No payment method on file" };
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(feeAmount * 100), // Stripe uses cents
        currency: "usd",
        customer: claim.company.stripeCustomerId,
        payment_method: defaultPaymentMethod as string,
        off_session: true,
        confirm: true,
        description: `ClaimScout fee: ${claim.settlement.caseName}`,
        metadata: {
          claimId: claim.id,
          companyId: claim.companyId,
          settlementId: claim.settlementId,
        },
      });

      await db.claim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.FEE_COLLECTED,
          feeCharged: true,
          stripeChargeId: paymentIntent.id,
        },
      });
    } catch (error) {
      // Fee charge failed — claim is still marked as paid
      // We'll need to follow up manually
      console.error(`Fee charge failed for claim ${claimId}:`, error);
    }
  }

  // Send payout notification email
  const adminEmail = claim.company.members[0]?.email;
  if (adminEmail) {
    const netAmount = payoutAmount - feeAmount;
    await sendPayoutReceivedEmail({
      to: adminEmail,
      companyName: claim.company.name,
      caseName: claim.settlement.caseName,
      payoutAmount: `$${payoutAmount.toLocaleString()}`,
      feeAmount: `$${feeAmount.toLocaleString()}`,
      netAmount: `$${netAmount.toLocaleString()}`,
    });
  }

  return { success: true };
}
