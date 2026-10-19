import { listMyPasses, prisma } from "@lineskip/db";
import { requireUser } from "@/lib/session";

export async function GET(request: Request) {
  const authz = await requireUser(request);
  if ("error" in authz) return authz.error;
  const rows = await listMyPasses(prisma, authz.user.id);
  return Response.json(
    rows.map((p) => ({
      id: p.id,
      status: p.status,
      redemption_code: p.redemptionCode,
      price_cents_paid: p.priceCentsPaid,
      purchased_at: p.purchasedAt.toISOString(),
      venue: { id: p.venue.id, name: p.venue.name, address: p.venue.address },
      product: { id: p.product.id, name: p.product.name, type: p.product.type },
    })),
  );
}
