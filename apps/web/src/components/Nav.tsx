"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

type Account = {
  platform_role: string;
  door_venues: string[];
  admin_venues: string[];
};

export function Nav() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    if (!session) {
      setAccount(null);
      return;
    }
    fetch("/api/account")
      .then((res) => (res.ok ? res.json() : null))
      .then(setAccount)
      .catch(() => setAccount(null));
  }, [session]);

  const isAdmin =
    account?.platform_role === "superadmin" || (account?.admin_venues.length ?? 0) > 0;
  const isDoor = (account?.door_venues.length ?? 0) > 0;
  const isStaff = isAdmin || isDoor;

  async function logout() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link className="brand" href="/">LineSkip</Link>
        <div className="nav-links">
          {!session ? (
            <>
              <Link href="/">Locales</Link>
              <Link href="/login">Entrar</Link>
              <Link href="/register">Crear cuenta</Link>
            </>
          ) : isStaff ? (
            <>
              <Link href={isAdmin ? "/admin" : "/door"}>Inicio</Link>
              {isAdmin ? <Link href="/admin/analytics">Analítica</Link> : null}
              <Link href="/door">Puerta</Link>
              <Link href="/account">Cuenta</Link>
              <button type="button" className="btn ghost" onClick={logout}>Salir</button>
            </>
          ) : (
            <>
              <Link href="/">Locales</Link>
              <Link href="/passes">Mis pases</Link>
              <Link href="/account">Cuenta</Link>
              <button type="button" className="btn ghost" onClick={logout}>Salir</button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
