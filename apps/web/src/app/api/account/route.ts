import { deleteAccount, prisma } from "@lineskip/db";
import { requireUser } from "@/lib/session";

export async function DELETE(request: Request) {
  const authz = await requireUser(request);
  if ("error" in authz) return authz.error;
  await deleteAccount(prisma, authz.user.id);
  return Response.json({ ok: true });
}

export async function GET(request: Request) {
  const authz = await requireUser(request);
  if ("error" in authz) return authz.error;
  const roles = await prisma.userVenueRole.findMany({
    where: { userId: authz.user.id },
    include: { venue: true },
  });
  return Response.json({
    id: authz.user.id,
    email: authz.user.email,
    name: authz.user.name,
    platform_role: authz.user.platformRole,
    door_venues: roles.filter((r) => r.role === "door_staff").map((r) => r.venue.name),
    admin_venues: roles.filter((r) => r.role === "venue_admin").map((r) => r.venue.name),
  });
}
