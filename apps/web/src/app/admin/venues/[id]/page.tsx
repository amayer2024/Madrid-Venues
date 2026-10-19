import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma, venueIdsFor } from "@lineskip/db";
import { centsToEuros } from "@lineskip/shared";
import { auth } from "@/lib/auth";
import { VenueAdminForms } from "./VenueAdminForms";

export const dynamic = "force-dynamic";

export default async function VenueAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const superadmin = user.platformRole === "superadmin";
  const roles = await venueIdsFor(prisma, user.id, ["venue_admin"]);
  if (!superadmin && !roles.some((r) => r.venueId === id)) {
    redirect("/");
  }
  const venue = await prisma.venue.findUnique({
    where: { id },
    include: {
      products: { orderBy: { priceCents: "asc" } },
      roles: { include: { user: true } },
    },
  });
  if (!venue) notFound();

  return (
    <>
      <p><a href="/admin">&larr; Admin</a></p>
      <h1>{venue.name}</h1>
      <p className="muted">{venue.address} · {venue.status}</p>
      <p className="muted">Stripe: {venue.stripeAccountId ?? "no conectado"}</p>
      <h2>Pases</h2>
      <table>
        <thead><tr><th>Nombre</th><th>Precio</th><th>Stock</th><th>Activo</th></tr></thead>
        <tbody>
          {venue.products.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{centsToEuros(p.priceCents)}</td>
              <td>{p.quantitySold}/{p.quantityTotal}</td>
              <td>{p.isActive ? "sí" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <VenueAdminForms
        venueId={venue.id}
        superadmin={superadmin}
        status={venue.status}
        staff={venue.roles.map((r) => ({ email: r.user.email, role: r.role }))}
      />
    </>
  );
}
