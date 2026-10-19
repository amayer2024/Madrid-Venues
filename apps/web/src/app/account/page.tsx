"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function AccountPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [info, setInfo] = useState<{ email: string; name: string; platform_role: string } | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.push("/login");
      return;
    }
    fetch("/api/account").then(async (res) => setInfo(await res.json()));
  }, [session, isPending, router]);

  async function del() {
    if (!confirm("Esto elimina tu cuenta de forma permanente. ¿Seguro?")) return;
    const res = await fetch("/api/account", { method: "DELETE" });
    if (res.ok) {
      await authClient.signOut();
      router.push("/");
    } else {
      setMsg("No se pudo eliminar la cuenta");
    }
  }

  return (
    <>
      <h1>Cuenta</h1>
      {info ? (
        <div className="card">
          <p><strong>{info.name}</strong></p>
          <p className="muted">{info.email}</p>
          <p className="muted">Rol: {info.platform_role}</p>
        </div>
      ) : null}
      <p className="prose">Apple y el RGPD exigen poder borrar la cuenta desde la app.</p>
      <button type="button" onClick={del}>Eliminar cuenta</button>
      {msg ? <p className="msg err">{msg}</p> : null}
    </>
  );
}
