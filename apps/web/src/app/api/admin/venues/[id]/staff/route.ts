import { inviteStaff, prisma } from "@lineskip/db";
import { jsonError } from "@/lib/http";
import { requireUser, scopedVenueIds } from "@/lib/session";

export async function POST(
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
  try {
    const body = (await request.json()) as { email?: string; role?: string };
    if (!body.email) {
      return Response.json({ error: "email is required" }, { status: 400 });
    }
    const role = body.role === "venue_admin" ? "venue_admin" : "door_staff";
    const row = await inviteStaff(prisma, { venueId: id, email: body.email, role });
    return Response.json(row, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
