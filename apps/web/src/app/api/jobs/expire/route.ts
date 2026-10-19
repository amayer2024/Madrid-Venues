import { expireReservations, prisma } from "@lineskip/db";

export async function POST() {
  const n = await expireReservations(prisma);
  return Response.json({ expired: n });
}
