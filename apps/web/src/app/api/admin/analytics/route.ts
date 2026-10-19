import { prisma, revenueSummary } from "@lineskip/db";
import { requireUser, scopedVenueIds } from "@/lib/session";

export async function GET(request: Request) {
  const authz = await requireUser(request);
  if ("error" in authz) return authz.error;
  const ids = await scopedVenueIds(authz.user.id, ["venue_admin"]);
  if (ids.length === 0) {
    return Response.json({ error: "admin access required" }, { status: 403 });
  }
  const superadmin = authz.user.platformRole === "superadmin";
  const report = await revenueSummary(prisma, superadmin ? undefined : ids);
  return Response.json(report);
}
