import { getVenue, prisma } from "@lineskip/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const venue = await getVenue(prisma, id);
  if (!venue || venue.status !== "approved") {
    return Response.json({ error: "venue not found" }, { status: 404 });
  }
  return Response.json({
    id: venue.id,
    name: venue.name,
    city: venue.city,
    address: venue.address,
    lat: venue.lat,
    lng: venue.lng,
    products: venue.products
      .filter((p) => p.isActive)
      .map((p) => ({
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
  });
}
