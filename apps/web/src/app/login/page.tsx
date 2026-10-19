"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error: err } = await authClient.signIn.email({ email, password });
    if (err) {
      setError(err.message ?? "Login failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <h1>Entrar</h1>
      <form className="form" onSubmit={onSubmit}>
        <label>Email <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Contraseña <input type="password" minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button type="submit">Entrar</button>
        {error ? <p className="msg err">{error}</p> : null}
      </form>
    </>
  );
}
