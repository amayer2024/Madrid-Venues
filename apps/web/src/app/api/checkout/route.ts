import { createCheckout, prisma } from "@lineskip/db";
import { clientIp, jsonError, rateLimit } from "@/lib/http";
import {
  feeBps,
  getStripe,
  paymentsMode,
  reservationTtlMinutes,
  simulatePaid,
} from "@/lib/payments";
import { requireUser } from "@/lib/session";
import { getWorkspace } from "@/lib/workspace";

export async function POST(request: Request) {
  const authz = await requireUser(request);
  if ("error" in authz) return authz.error;
  if (!rateLimit(`checkout:${authz.user.id}:${clientIp(request)}`, 8, 60_000)) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }
  const workspace = await getWorkspace(authz.user.id);
  if (!workspace.canBuy) {
    return Response.json(
      { error: "staff accounts cannot buy passes" },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as { pass_product_id?: string };
    if (!body.pass_product_id) {
      return Response.json({ error: "pass_product_id is required" }, { status: 400 });
    }
    const mode = paymentsMode();
    const checkout = await createCheckout(prisma, {
      userId: authz.user.id,
      passProductId: body.pass_product_id,
      ttlMinutes: reservationTtlMinutes(),
      feeBps: feeBps(),
      requireStripeAccount: mode === "stripe",
    });

    if (mode === "fake") {
      const purchase = await simulatePaid(checkout.purchase.id, checkout.payment.id);
      return Response.json(
        {
          mode,
          purchase: {
            id: purchase.id,
            status: purchase.status,
            redemption_code: purchase.redemptionCode,
            price_cents_paid: purchase.priceCentsPaid,
            venue_id: purchase.venueId,
          },
        },
        { status: 201 },
      );
    }

    const stripe = getStripe()!;
    const intent = await stripe.paymentIntents.create(
      {
        amount: checkout.purchase.priceCentsPaid,
        currency: "eur",
        application_fee_amount: checkout.payment.applicationFeeCents,
        transfer_data: checkout.venue.stripeAccountId
          ? { destination: checkout.venue.stripeAccountId }
          : undefined,
        metadata: { purchase_id: checkout.purchase.id },
      },
      { idempotencyKey: checkout.purchase.id },
    );
    const { attachPaymentIntent } = await import("@lineskip/db");
    await attachPaymentIntent(prisma, checkout.payment.id, intent.id);
    return Response.json(
      {
        mode,
        client_secret: intent.client_secret,
        purchase_id: checkout.purchase.id,
        publishable_key: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      },
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err);
  }
}
