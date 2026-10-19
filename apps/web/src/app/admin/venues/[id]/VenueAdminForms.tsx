"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function VenueAdminForms({
  venueId,
  superadmin,
  status,
  staff,
}: {
  venueId: string;
  superadmin: boolean;
  status: string;
  staff: { email: string; role: string }[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState("");

  async function post(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Error");
      return;
    }
    setMsg("Guardado");
    router.refresh();
    if (data.url) window.location.href = data.url;
  }

  return (
    <div>
      <h2>Nuevo pase</h2>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          post(`/api/admin/venues/${venueId}/products`, {
            type: fd.get("type"),
            name: fd.get("name"),
            price_cents: Math.round(Number(fd.get("price")) * 100),
            quantity_total: Number(fd.get("qty")),
            valid_from: fd.get("from"),
            valid_to: fd.get("to"),
            is_active: true,
          });
        }}
      >
        <label>Nombre <input name="name" required /></label>
        <label>Tipo
          <select name="type">
            <option value="line_skip">line skip</option>
            <option value="cover">cover</option>
          </select>
        </label>
        <label>Precio € <input name="price" type="number" step="0.01" min="0" required /></label>
        <label>Cantidad <input name="qty" type="number" min="1" required /></label>
        <label>Desde <input name="from" type="datetime-local" required /></label>
        <label>Hasta <input name="to" type="datetime-local" required /></label>
        <button type="submit">Crear pase</button>
      </form>

      <h2>Personal de puerta</h2>
      <ul>
        {staff.map((s) => (
          <li key={s.email + s.role}>{s.email} · {s.role}</li>
        ))}
      </ul>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          post(`/api/admin/venues/${venueId}/staff`, {
            email: fd.get("email"),
            role: fd.get("role"),
          });
        }}
      >
        <label>Email (ya registrado) <input name="email" type="email" required /></label>
        <label>Rol
          <select name="role">
            <option value="door_staff">door staff</option>
            <option value="venue_admin">venue admin</option>
          </select>
        </label>
        <button type="submit">Invitar</button>
      </form>

      <h2>Stripe Connect</h2>
      <button type="button" onClick={() => post("/api/admin/connect", { venue_id: venueId })}>
        Conectar pagos del local
      </button>

      {superadmin ? (
        <>
          <h2>Aprobación (superadmin)</h2>
          <p className="muted">Estado actual: {status}</p>
          <button
            type="button"
            onClick={async () => {
              await fetch(`/api/admin/venues/${venueId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "approved" }),
              });
              router.refresh();
            }}
          >
            Aprobar local
          </button>
        </>
      ) : null}
      {msg ? <p className="msg ok">{msg}</p> : null}
    </div>
  );
}
