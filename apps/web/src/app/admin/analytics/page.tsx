import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, revenueSummary, venueIdsFor } from "@lineskip/db";
import { centsToEuros } from "@lineskip/shared";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const superadmin = user.platformRole === "superadmin";
  const roles = await venueIdsFor(prisma, user.id, ["venue_admin"]);
  const ids = superadmin ? undefined : roles.map((r) => r.venueId);
  if (!superadmin && (!ids || ids.length === 0)) redirect("/");
  const report = await revenueSummary(prisma, ids);

  return (
    <>
      <p><a href="/admin">&larr; Admin</a></p>
      <h1>Analítica</h1>
      <p className="big">{centsToEuros(report.total_cents)}</p>
      <h2>Por local</h2>
      <table>
        <thead><tr><th>Local</th><th>Ingresos</th></tr></thead>
        <tbody>
          {report.by_venue.map((row) => (
            <tr key={row.venue_id}>
              <td>{row.venue_name}</td>
              <td>{centsToEuros(row.revenue_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Por día</h2>
      <table>
        <thead><tr><th>Día</th><th>Ingresos</th></tr></thead>
        <tbody>
          {report.by_day.map((row) => (
            <tr key={row.day}>
              <td>{row.day}</td>
              <td>{centsToEuros(row.revenue_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
