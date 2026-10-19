import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const allowed = [
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8000",
  "http://localhost:8081",
  "http://localhost:19006",
];

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const ok =
    allowed.includes(origin) ||
    origin.startsWith("exp://") ||
    origin.startsWith("lineskip://");
  if (request.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    if (ok) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Credentials", "true");
      res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    }
    return res;
  }
  const res = NextResponse.next();
  if (ok && origin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
  }
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
