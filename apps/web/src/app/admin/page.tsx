import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, revenueSummary } from "@lineskip/db";
import { centsToEuros } from "@lineskip/shared";
import { auth } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const ws = await getWorkspace(session.user.id);
  if (ws.kind === "customer") redirect("/");
  if (ws.kind === "door") redirect("/door");
  const superadmin = ws.superadmin;
  const ids = superadmin ? undefined : ws.adminVenues.map((v) => v.id);
  const report = await revenueSummary(prisma, ids);
  const venues = await prisma.venue.findMany({
    where: ids ? { id: { in: ids } } : undefined,
    orderBy: { name: "asc" },
  });

  return (
    <>
      <h1>Portal {superadmin ? "superadmin" : "del local"}</h1>
      <p className="muted">Esta cuenta gestiona locales. No compra pases de cliente.</p>
      <p className="big">{centsToEuros(report.total_cents)}</p>
      <p className="muted">Ingresos (pases activos + canjeados)</p>
      <p><Link href="/door">Ir a la puerta (escanear QR) →</Link></p>
      <p><Link href="/admin/analytics">Ver analítica →</Link></p>
      <h2>Locales</h2>
      <div className="cards">
        {venues.map((v) => (
          <Link className="card" key={v.id} href={`/admin/venues/${v.id}`}>
            <h3>{v.name}</h3>
            <p className="muted">{v.status}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
