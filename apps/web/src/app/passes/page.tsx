"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { centsToEuros } from "@lineskip/shared";
import { authClient } from "@/lib/auth-client";

type Pass = {
  id: string;
  status: string;
  redemption_code: string | null;
  price_cents_paid: number;
  venue: { name: string; address: string };
  product: { name: string; type: string };
};

export default function MyPassesPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [passes, setPasses] = useState<Pass[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.push("/login");
      return;
    }
    fetch("/api/account")
      .then((res) => (res.ok ? res.json() : null))
      .then((account) => {
        const staff =
          account?.platform_role === "superadmin" ||
          (account?.admin_venues?.length ?? 0) > 0 ||
          (account?.door_venues?.length ?? 0) > 0;
        if (staff) {
          router.replace(account?.admin_venues?.length || account?.platform_role === "superadmin" ? "/admin" : "/door");
          return;
        }
        return fetch("/api/passes/mine");
      })
      .then(async (res) => {
        if (!res) return;
        if (!res.ok) throw new Error("No se pudieron cargar los pases");
        setPasses(await res.json());
      })
      .catch((err: Error) => setError(err.message));
  }, [session, isPending, router]);

  return (
    <>
      <h1>Mis pases</h1>
      {error ? <p className="msg err">{error}</p> : null}
      {passes.length === 0 && !error ? <p className="muted">Todavía no tienes pases.</p> : null}
      <div className="cards">
        {passes.map((p) => (
          <div className="card" key={p.id}>
            <h3>{p.product.name}</h3>
            <p>{p.venue.name}</p>
            <p className="muted">{p.venue.address}</p>
            <p className="muted">Estado: {p.status}</p>
            <p className="price">{centsToEuros(p.price_cents_paid)}</p>
            {p.redemption_code ? (
              <>
                <p>Código: <code>{p.redemption_code}</code></p>
                {/* QR via a public encoder so we don't add a native dep on web */}
                <div className="qr">
                  <img
                    alt="QR del pase"
                    width={160}
                    height={160}
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(p.redemption_code)}`}
                  />
                </div>
              </>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
