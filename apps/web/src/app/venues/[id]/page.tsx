import { notFound } from "next/navigation";
import { getVenue, prisma } from "@lineskip/db";
import { centsToEuros } from "@lineskip/shared";
import { BuyButton } from "./BuyButton";

export const dynamic = "force-dynamic";

export default async function VenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const venue = await getVenue(prisma, id);
  if (!venue || venue.status !== "approved") notFound();

  return (
    <>
      <p><a href="/">&larr; Todos los locales</a></p>
      <h1>{venue.name}</h1>
      <p className="muted">{venue.address}, {venue.city}</p>
      {venue.lat && venue.lng ? (
        <p>
          <a
            href={`https://www.google.com/maps?q=${venue.lat},${venue.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            Abrir en Maps
          </a>
        </p>
      ) : null}
      <div className="cards">
        {venue.products.filter((p) => p.isActive).map((p) => {
          const soldOut = p.quantitySold >= p.quantityTotal;
          return (
            <div className="card" key={p.id}>
              <h3>{p.name}</h3>
              <p className="muted">{p.type.replace("_", " ")}</p>
              <p className="price">{centsToEuros(p.priceCents)}</p>
              <p className="muted">
                {Math.max(0, p.quantityTotal - p.quantitySold)} de {p.quantityTotal} restantes
              </p>
              <BuyButton productId={p.id} soldOut={soldOut} />
            </div>
          );
        })}
      </div>
    </>
  );
}
