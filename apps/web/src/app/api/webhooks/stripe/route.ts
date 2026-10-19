import { getStripe, handleStripeEvent, paymentsMode } from "@/lib/payments";

export async function POST(request: Request) {
  if (paymentsMode() === "fake") {
    return Response.json({ received: true });
  }
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return Response.json({ error: "stripe not configured" }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "missing signature" }, { status: 400 });
  }
  const raw = await request.text();
  try {
    const event = stripe.webhooks.constructEvent(raw, signature, secret);
    await handleStripeEvent(event);
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }
}
