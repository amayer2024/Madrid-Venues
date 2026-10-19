import { Prisma, type PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

const COUNTED = ["active", "redeemed"] as const;

export async function revenueSummary(db: Db, venueIds?: string[]) {
  const venueFilter = venueIds ? { venueId: { in: venueIds } } : {};

  const [totals, byVenue, top] = await Promise.all([
    db.purchase.aggregate({
      where: { ...venueFilter, status: { in: [...COUNTED] } },
      _sum: { priceCentsPaid: true },
    }),
    db.purchase.groupBy({
      by: ["venueId"],
      where: { ...venueFilter, status: { in: [...COUNTED] } },
      _sum: { priceCentsPaid: true },
      orderBy: { venueId: "asc" },
    }),
    db.purchase.groupBy({
      by: ["venueId"],
      where: { ...venueFilter, status: { in: [...COUNTED] } },
      _sum: { priceCentsPaid: true },
      orderBy: { _sum: { priceCentsPaid: "desc" } },
      take: 5,
    }),
  ]);

  const byDay =
    venueIds && venueIds.length > 0
      ? await db.$queryRaw<{ day: Date; revenue_cents: bigint }[]>`
          SELECT date_trunc('day', purchased_at) AS day,
                 SUM(price_cents_paid)::bigint AS revenue_cents
            FROM purchases
           WHERE status IN ('active', 'redeemed')
             AND venue_id IN (${Prisma.join(venueIds)})
           GROUP BY 1
           ORDER BY 1
        `
      : await db.$queryRaw<{ day: Date; revenue_cents: bigint }[]>`
          SELECT date_trunc('day', purchased_at) AS day,
                 SUM(price_cents_paid)::bigint AS revenue_cents
            FROM purchases
           WHERE status IN ('active', 'redeemed')
           GROUP BY 1
           ORDER BY 1
        `;

  const venues = await db.venue.findMany({
    where: venueIds ? { id: { in: venueIds } } : undefined,
    select: { id: true, name: true },
  });
  const names = Object.fromEntries(venues.map((v) => [v.id, v.name]));
  const total = totals._sum.priceCentsPaid ?? 0;

  return {
    total_cents: total,
    by_venue: byVenue.map((row) => ({
      venue_id: row.venueId,
      venue_name: names[row.venueId] ?? row.venueId,
      revenue_cents: row._sum.priceCentsPaid ?? 0,
    })),
    top_venues: top.map((row) => ({
      venue_id: row.venueId,
      venue_name: names[row.venueId] ?? row.venueId,
      revenue_cents: row._sum.priceCentsPaid ?? 0,
    })),
    by_day: byDay.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      revenue_cents: Number(row.revenue_cents),
    })),
  };
}
