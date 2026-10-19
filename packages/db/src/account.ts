import type { PrismaClient } from "@prisma/client";

export async function deleteAccount(db: PrismaClient, userId: string) {
  const at = new Date();
  await db.$transaction([
    db.session.deleteMany({ where: { userId } }),
    db.user.update({
      where: { id: userId },
      data: {
        deletedAt: at,
        email: `deleted+${userId}@invalid.lineskip.local`,
        name: "Deleted user",
        dateOfBirth: null,
      },
    }),
  ]);
}

export async function healthCheck(db: PrismaClient) {
  await db.$queryRaw`SELECT 1`;
  return { status: "ok" as const };
}
