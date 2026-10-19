import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "LineSkip",
  description: "Pases para saltar la cola en Madrid",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Nav />
        <main className="container">{children}</main>
        <footer className="container muted">
          <a href="/privacy">Privacidad</a>
          {" · "}
          <a href="/terms">Términos</a>
        </footer>
      </body>
    </html>
  );
}
