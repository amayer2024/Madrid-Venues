import { healthCheck, prisma } from "@lineskip/db";

export async function GET() {
  try {
    await healthCheck(prisma);
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "unhealthy" }, { status: 503 });
  }
}
