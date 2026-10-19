import { prisma } from "@lineskip/db";

export type WorkspaceKind = "customer" | "door" | "admin";

export async function getWorkspace(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const roles = await prisma.userVenueRole.findMany({
    where: { userId },
    include: { venue: true },
  });
  const superadmin = user?.platformRole === "superadmin";
  const adminVenues = roles.filter((r) => r.role === "venue_admin").map((r) => r.venue);
  const doorVenues = roles.filter((r) => r.role === "door_staff").map((r) => r.venue);
  const kind: WorkspaceKind =
    superadmin || adminVenues.length > 0
      ? "admin"
      : doorVenues.length > 0
        ? "door"
        : "customer";
  return {
    kind,
    superadmin,
    canBuy: kind === "customer",
    canScan: superadmin || adminVenues.length > 0 || doorVenues.length > 0,
    adminVenues,
    doorVenues,
    homePath: kind === "admin" ? "/admin" : kind === "door" ? "/door" : "/",
  };
}
