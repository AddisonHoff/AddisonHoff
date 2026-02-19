import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";

/**
 * Stripe webhook handler.
 * Handles payment confirmations and failures.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );

    switch (event.type) {
      case "payment_intent.succeeded":
        // Fee collection succeeded — already handled in recordPayoutAndChargeFee
        console.log(
          `Payment succeeded: ${event.data.object.id}`,
        );
        break;

      case "payment_intent.payment_failed":
        // Fee collection failed — need manual follow-up
        console.error(
          `Payment failed: ${event.data.object.id}`,
          event.data.object.last_payment_error?.message,
        );
        break;

      default:
        // Unhandled event type
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json(
      { error: "Webhook verification failed" },
      { status: 400 },
    );
  }
}
