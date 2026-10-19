import { prisma, venueIdsFor } from "@lineskip/db";
import { auth } from "./auth";

export async function getSessionFromRequest(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}

export async function requireUser(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session?.user) {
    return { error: Response.json({ error: "authentication required" }, { status: 401 }) };
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.deletedAt) {
    return { error: Response.json({ error: "authentication required" }, { status: 401 }) };
  }
  return { user, session };
}

export async function isSuperadmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.platformRole === "superadmin";
}

export async function scopedVenueIds(userId: string, roles?: string[]) {
  if (await isSuperadmin(userId)) {
    const all = await prisma.venue.findMany({ select: { id: true } });
    return all.map((v) => v.id);
  }
  const rows = await venueIdsFor(prisma, userId, roles);
  return [...new Set(rows.map((r) => r.venueId))];
}
