import { createVenue, listVenuesForAdmin, prisma } from "@lineskip/db";
import { jsonError } from "@/lib/http";
import { isSuperadmin, requireUser, scopedVenueIds } from "@/lib/session";

export async function GET(request: Request) {
  const authz = await requireUser(request);
  if ("error" in authz) return authz.error;
  const ids = await scopedVenueIds(authz.user.id, ["venue_admin"]);
  if (ids.length === 0) {
    return Response.json({ error: "admin access required" }, { status: 403 });
  }
  const venues = await listVenuesForAdmin(prisma, ids);
  return Response.json(venues);
}

export async function POST(request: Request) {
  const authz = await requireUser(request);
  if ("error" in authz) return authz.error;
  try {
    const body = (await request.json()) as {
      name?: string;
      address?: string;
      city?: string;
    };
    if (!body.name || !body.address) {
      return Response.json({ error: "name and address are required" }, { status: 400 });
    }
    const owner = (await isSuperadmin(authz.user.id)) ? undefined : authz.user.id;
    const venue = await createVenue(prisma, {
      name: body.name,
      address: body.address,
      city: body.city,
      ownerUserId: owner ?? authz.user.id,
    });
    return Response.json(venue, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
