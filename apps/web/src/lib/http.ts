import { DomainError } from "@lineskip/shared";

export function jsonError(err: unknown) {
  if (err instanceof DomainError) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: err.statusCode },
    );
  }
  const message = err instanceof Error ? err.message : "internal error";
  if (message.toLowerCase().includes("18")) {
    return Response.json({ error: message, code: "AGE" }, { status: 400 });
  }
  console.error(err);
  return Response.json({ error: "internal error" }, { status: 500 });
}

const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) return false;
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
