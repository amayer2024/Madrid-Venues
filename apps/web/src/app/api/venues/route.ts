import { listApprovedVenues, prisma } from "@lineskip/db";

export async function GET() {
  const venues = await listApprovedVenues(prisma);
  return Response.json(
    venues.map((v) => ({
      id: v.id,
      name: v.name,
      city: v.city,
      address: v.address,
      lat: v.lat,
      lng: v.lng,
      products: v.products.map((p) => ({
        id: p.id,
        type: p.type,
        name: p.name,
        price_cents: p.priceCents,
        quantity_total: p.quantityTotal,
        quantity_sold: p.quantitySold,
        remaining: Math.max(0, p.quantityTotal - p.quantitySold),
        valid_from: p.validFrom.toISOString(),
        valid_to: p.validTo.toISOString(),
        sold_out: p.quantitySold >= p.quantityTotal,
      })),
    })),
  );
}
