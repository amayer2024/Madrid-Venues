import { prisma, setStripeAccount } from "@lineskip/db";
import { getStripe, paymentsMode } from "@/lib/payments";
import { requireUser, scopedVenueIds } from "@/lib/session";

export async function POST(request: Request) {
  const authz = await requireUser(request);
  if ("error" in authz) return authz.error;
  const body = (await request.json()) as { venue_id?: string };
  if (!body.venue_id) {
    return Response.json({ error: "venue_id is required" }, { status: 400 });
  }
  const ids = await scopedVenueIds(authz.user.id, ["venue_admin"]);
  if (!ids.includes(body.venue_id)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  if (paymentsMode() === "fake") {
    const venue = await setStripeAccount(prisma, body.venue_id, `acct_fake_${body.venue_id}`);
    return Response.json({ url: null, venue, mode: "fake" });
  }

  const stripe = getStripe();
  if (!stripe) {
    return Response.json({ error: "stripe not configured" }, { status: 503 });
  }
  const venue = await prisma.venue.findUniqueOrThrow({ where: { id: body.venue_id } });
  const accountId =
    venue.stripeAccountId ??
    (
      await stripe.accounts.create({
        type: "express",
        country: "ES",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      })
    ).id;
  if (!venue.stripeAccountId) {
    await setStripeAccount(prisma, venue.id, accountId);
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8000";
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/admin/venues/${venue.id}`,
    return_url: `${appUrl}/admin/venues/${venue.id}`,
    type: "account_onboarding",
  });
  return Response.json({ url: link.url, mode: "stripe" });
}
