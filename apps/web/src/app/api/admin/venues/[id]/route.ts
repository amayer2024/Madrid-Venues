import { prisma, setVenueStatus } from "@lineskip/db";
import { jsonError } from "@/lib/http";
import { isSuperadmin, requireUser, scopedVenueIds } from "@/lib/session";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireUser(request);
  if ("error" in authz) return authz.error;
  const { id } = await params;
  if (!(await isSuperadmin(authz.user.id))) {
    return Response.json({ error: "superadmin only" }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { status?: string };
    if (!body.status || !["pending", "approved", "suspended"].includes(body.status)) {
      return Response.json({ error: "invalid status" }, { status: 400 });
    }
    const venue = await setVenueStatus(prisma, id, body.status);
    return Response.json(venue);
  } catch (err) {
    return jsonError(err);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireUser(request);
  if ("error" in authz) return authz.error;
  const { id } = await params;
  const ids = await scopedVenueIds(authz.user.id, ["venue_admin"]);
  if (!ids.includes(id)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const venue = await prisma.venue.findUnique({
    where: { id },
    include: { products: true, roles: { include: { user: true } } },
  });
  if (!venue) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(venue);
}
