import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";
import { DoorScanner } from "./DoorScanner";

export const dynamic = "force-dynamic";

export default async function DoorHomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const ws = await getWorkspace(session.user.id);
  if (!ws.canScan) redirect("/");

  const venues = [
    ...new Map(
      [...ws.adminVenues, ...ws.doorVenues].map((v) => [v.id, v]),
    ).values(),
  ];

  return (
    <>
      <section className="hero">
        <h1>Puerta</h1>
        <p className="muted">
          Esta cuenta es de personal del local. Escanea o introduce el código del pase.
          No compra pases.
        </p>
      </section>
      <div className="card door-venues">
        <h2>Tus locales</h2>
        {venues.length === 0 ? (
          <p className="muted">Todos los locales (superadmin).</p>
        ) : (
          <ul className="plain-list">
            {venues.map((v) => (
              <li key={v.id}>{v.name}</li>
            ))}
          </ul>
        )}
      </div>
      <DoorScanner />
    </>
  );
}
