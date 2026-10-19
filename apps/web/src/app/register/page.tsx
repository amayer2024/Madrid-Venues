"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error: err } = await authClient.signUp.email({
      email,
      password,
      name,
      dateOfBirth,
    } as never);
    if (err) {
      setError(err.message ?? "No se pudo crear la cuenta");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <h1>Crear cuenta</h1>
      <p className="muted">Tienes que tener 18 años o más.</p>
      <form className="form" onSubmit={onSubmit}>
        <label>Nombre <input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>Email <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Fecha de nacimiento <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required /></label>
        <label>Contraseña <input type="password" minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button type="submit">Registrarme</button>
        {error ? <p className="msg err">{error}</p> : null}
      </form>
    </>
  );
}
