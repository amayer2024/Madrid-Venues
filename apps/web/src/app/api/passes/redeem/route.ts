import { prisma, redeem, venueIdsFor } from "@lineskip/db";
import { clientIp, jsonError, rateLimit } from "@/lib/http";
import { isSuperadmin, requireUser } from "@/lib/session";

export async function POST(request: Request) {
  const authz = await requireUser(request);
  if ("error" in authz) return authz.error;
  if (!rateLimit(`redeem:${authz.user.id}:${clientIp(request)}`, 30, 60_000)) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }

  try {
    const body = (await request.json()) as { code?: string };
    if (!body.code) {
      return Response.json({ error: "code is required" }, { status: 400 });
    }
    const superadmin = await isSuperadmin(authz.user.id);
    const roles = await venueIdsFor(prisma, authz.user.id, ["door_staff", "venue_admin"]);
    const venueIds = superadmin
      ? (await prisma.venue.findMany({ select: { id: true } })).map((v) => v.id)
      : roles.map((r) => r.venueId);
    if (venueIds.length === 0) {
      return Response.json({ error: "door access required" }, { status: 403 });
    }
    const result = await redeem(prisma, {
      code: body.code,
      actorId: authz.user.id,
      venueIds,
    });
    return Response.json({
      id: result.id,
      status: result.status,
      venue: result.venue.name,
      product: result.product.name,
      guest: result.user.name,
    });
  } catch (err) {
    return jsonError(err);
  }
}
