"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function BuyButton({ productId, soldOut }: { productId: string; soldOut: boolean }) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [staff, setStaff] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) {
      setStaff(false);
      return;
    }
    fetch("/api/account")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setStaff(
          data.platform_role === "superadmin" ||
            (data.admin_venues?.length ?? 0) > 0 ||
            (data.door_venues?.length ?? 0) > 0,
        );
      })
      .catch(() => setStaff(false));
  }, [session]);

  if (staff) {
    return <p className="muted">Las cuentas de personal no compran pases.</p>;
  }

  async function buy() {
    if (!session) {
      router.push("/login");
      return;
    }
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pass_product_id: productId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "No se pudo comprar");
      return;
    }
    if (data.mode === "fake") {
      router.push("/passes");
      return;
    }
    setMsg("Confirma el pago en Stripe…");
  }

  return (
    <>
      <button type="button" disabled={soldOut || busy} onClick={buy}>
        {soldOut ? "Agotado" : busy ? "…" : "Comprar"}
      </button>
      {msg ? <p className="msg err">{msg}</p> : null}
    </>
  );
}
