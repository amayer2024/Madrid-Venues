import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { listApprovedVenues, prisma } from "@lineskip/db";
import { auth } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    const ws = await getWorkspace(session.user.id);
    if (ws.homePath !== "/") redirect(ws.homePath);
  }

  const venues = await listApprovedVenues(prisma);
  return (
    <>
      <section className="hero">
        <h1>Madrid. Sin cola.</h1>
        <p className="muted">Compra un pase line-skip o cover y entra directo.</p>
      </section>
      <div className="cards">
        {venues.map((v) => (
          <Link className="card" key={v.id} href={`/venues/${v.id}`}>
            <h2>{v.name}</h2>
            <p className="muted">{v.address}, {v.city}</p>
            <p className="muted">{v.products.length} pases a la venta</p>
          </Link>
        ))}
        {venues.length === 0 ? <p>No hay locales aprobados todavía.</p> : null}
      </div>
    </>
  );
}
