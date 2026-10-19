import Stripe from "stripe";
import {
  activatePurchase,
  attachPaymentIntent,
  failPurchasePayment,
  prisma,
  recordStripeEvent,
} from "@lineskip/db";
import {
  APPLICATION_FEE_BPS_DEFAULT,
  RESERVATION_TTL_MINUTES_DEFAULT,
} from "@lineskip/shared";

export function paymentsMode(): "fake" | "stripe" {
  if (process.env.PAYMENTS_MODE === "fake" || !process.env.STRIPE_SECRET_KEY) {
    return "fake";
  }
  return "stripe";
}

export function getStripe() {
  if (paymentsMode() === "fake") return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export function feeBps() {
  return Number(process.env.APPLICATION_FEE_BPS ?? APPLICATION_FEE_BPS_DEFAULT);
}

export function reservationTtlMinutes() {
  return Number(process.env.RESERVATION_TTL_MINUTES ?? RESERVATION_TTL_MINUTES_DEFAULT);
}

export async function simulatePaid(purchaseId: string, paymentId: string) {
  const pi = `pi_fake_${purchaseId}`;
  await attachPaymentIntent(prisma, paymentId, pi);
  return activatePurchase(prisma, pi);
}

export async function handleStripeEvent(event: Stripe.Event) {
  const fresh = await recordStripeEvent(prisma, event.id, event.type);
  if (!fresh) return { duplicate: true };

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    await activatePurchase(prisma, pi.id);
  }
  if (
    event.type === "payment_intent.payment_failed" ||
    event.type === "payment_intent.canceled"
  ) {
    const pi = event.data.object;
    await failPurchasePayment(prisma, pi.id);
  }
  return { duplicate: false };
}
