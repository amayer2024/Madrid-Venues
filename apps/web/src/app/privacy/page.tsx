export default function PrivacyPage() {
  return (
    <article className="prose">
      <h1>Política de privacidad</h1>
      <p>
        LineSkip trata tu email, nombre, fecha de nacimiento y compras para vender y canjear
        pases de acceso a locales de ocio nocturno en Madrid. Base legal: ejecución del contrato
        y obligación legal (RGPD / LOPDGDD).
      </p>
      <p>
        Conservamos la cuenta hasta que la eliminates. Los registros de canje se guardan para
        resolver disputas con el local. No vendemos datos. Encargados: el host de Postgres (UE)
        y Stripe (pagos; no vemos el número de tarjeta).
      </p>
      <p>
        Derechos: acceso, rectificación, supresión (botón Eliminar cuenta), portabilidad y
        reclamación ante la AEPD. Contacto: privacy@lineskip.app.
      </p>
    </article>
  );
}
