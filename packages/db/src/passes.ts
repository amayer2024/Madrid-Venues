import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { DomainError, applicationFeeCents } from "@lineskip/shared";

type Db = PrismaClient | Prisma.TransactionClient;

function now() {
  return new Date();
}

function newRedemptionCode() {
  return randomBytes(16).toString("base64url");
}

async function claimUnit(db: Db, productId: string, at: Date) {
  const claimed = await db.$executeRaw`
    UPDATE pass_products
       SET quantity_sold = quantity_sold + 1
     WHERE id = ${productId}
       AND quantity_sold < quantity_total
       AND is_active = true
       AND valid_from <= ${at}
       AND valid_to >= ${at}
  `;
  return claimed === 1;
}

async function releaseUnit(db: Db, productId: string) {
  const released = await db.$executeRaw`
    UPDATE pass_products
       SET quantity_sold = quantity_sold - 1
     WHERE id = ${productId}
       AND quantity_sold >= 1
  `;
  return released === 1;
}

export async function expireReservations(db: Db, at = now()) {
  const expired = await db.purchase.findMany({
    where: { status: "reserved", reservedUntil: { lt: at } },
    select: { id: true, passProductId: true },
  });
  if (expired.length === 0) return 0;

  await db.purchase.updateMany({
    where: { id: { in: expired.map((p) => p.id) } },
    data: { status: "expired" },
  });
  for (const row of expired) {
    await releaseUnit(db, row.passProductId);
  }
  return expired.length;
}

export async function listApprovedVenues(db: Db) {
  return db.venue.findMany({
    where: { status: "approved" },
    orderBy: { name: "asc" },
    include: {
      products: {
        where: { isActive: true },
        orderBy: { priceCents: "asc" },
      },
    },
  });
}

export async function getVenue(db: Db, venueId: string) {
  return db.venue.findUnique({
    where: { id: venueId },
    include: {
      products: { orderBy: { priceCents: "asc" } },
    },
  });
}

export async function createCheckout(
  db: PrismaClient,
  input: {
    userId: string;
    passProductId: string;
    ttlMinutes: number;
    feeBps: number;
    requireStripeAccount: boolean;
  },
) {
  const at = now();
  return db.$transaction(async (tx) => {
    await expireReservations(tx, at);

    const product = await tx.passProduct.findUnique({
      where: { id: input.passProductId },
      include: { venue: true },
    });
    if (!product || !product.isActive) {
      throw new DomainError("NOT_FOUND", "pass product not found", 404);
    }
    if (product.venue.status !== "approved") {
      throw new DomainError("NOT_FOUND", "venue not found", 404);
    }
    if (at < product.validFrom || at > product.validTo) {
      throw new DomainError("OUTSIDE_WINDOW", "pass is not on sale for this date", 400);
    }
    if (input.requireStripeAccount && !product.venue.stripeAccountId) {
      throw new DomainError("VENUE_NOT_PAYABLE", "venue cannot accept payments yet", 409);
    }

    const claimed = await claimUnit(tx, product.id, at);
    if (!claimed) {
      throw new DomainError("SOLD_OUT", "sold out", 409);
    }

    const reservedUntil = new Date(at.getTime() + input.ttlMinutes * 60_000);
    const purchase = await tx.purchase.create({
      data: {
        userId: input.userId,
        passProductId: product.id,
        venueId: product.venueId,
        priceCentsPaid: product.priceCents,
        status: "reserved",
        reservedUntil,
      },
    });

    const fee = applicationFeeCents(product.priceCents, input.feeBps);
    const payment = await tx.payment.create({
      data: {
        purchaseId: purchase.id,
        stripePaymentIntentId: `pending_${purchase.id}`,
        amountCents: product.priceCents,
        applicationFeeCents: fee,
        status: "requires_payment",
        idempotencyKey: purchase.id,
      },
    });

    await tx.auditEvent.create({
      data: {
        type: "checkout_reserved",
        actorId: input.userId,
        venueId: product.venueId,
        purchaseId: purchase.id,
        metadata: { passProductId: product.id, priceCents: product.priceCents },
      },
    });

    return {
      purchase,
      payment,
      product,
      venue: product.venue,
    };
  });
}

export async function attachPaymentIntent(
  db: Db,
  paymentId: string,
  stripePaymentIntentId: string,
) {
  return db.payment.update({
    where: { id: paymentId },
    data: { stripePaymentIntentId },
  });
}

export async function activatePurchase(
  db: PrismaClient,
  stripePaymentIntentId: string,
) {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { stripePaymentIntentId },
      include: { purchase: true },
    });
    if (!payment) {
      throw new DomainError("NOT_FOUND", "payment not found", 404);
    }
    if (payment.purchase.status === "active") {
      return payment.purchase;
    }
    if (payment.purchase.status !== "reserved") {
      throw new DomainError("INACTIVE", `cannot activate a ${payment.purchase.status} pass`, 409);
    }

    const code = newRedemptionCode();
    const purchase = await tx.purchase.update({
      where: { id: payment.purchaseId },
      data: {
        status: "active",
        redemptionCode: code,
        reservedUntil: null,
      },
    });
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "succeeded" },
    });
    await tx.auditEvent.create({
      data: {
        type: "purchase_activated",
        actorId: purchase.userId,
        venueId: purchase.venueId,
        purchaseId: purchase.id,
      },
    });
    return purchase;
  });
}

export async function failPurchasePayment(
  db: PrismaClient,
  stripePaymentIntentId: string,
) {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { stripePaymentIntentId },
      include: { purchase: true },
    });
    if (!payment) return null;
    if (payment.purchase.status !== "reserved") return payment.purchase;

    await tx.purchase.update({
      where: { id: payment.purchaseId },
      data: { status: "expired" },
    });
    await releaseUnit(tx, payment.purchase.passProductId);
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "failed" },
    });
    return payment.purchase;
  });
}

export async function listMyPasses(db: Db, userId: string) {
  return db.purchase.findMany({
    where: {
      userId,
      status: { in: ["active", "redeemed"] },
    },
    orderBy: { purchasedAt: "desc" },
    include: {
      venue: true,
      product: true,
      payment: true,
    },
  });
}

async function auditFail(
  db: Db,
  input: { actorId: string; venueId?: string; purchaseId?: string; reason: string; status?: string },
) {
  await db.auditEvent.create({
    data: {
      type: "redeem_fail",
      actorId: input.actorId,
      venueId: input.venueId,
      purchaseId: input.purchaseId,
      metadata: { reason: input.reason, status: input.status },
    },
  });
}

export async function redeem(db: PrismaClient, input: {
  code: string;
  actorId: string;
  venueIds: string[];
}) {
  const at = now();
  const code = input.code.trim();
  const existing = await db.purchase.findUnique({
    where: { redemptionCode: code },
    include: { product: true, venue: true },
  });

  if (!existing) {
    await auditFail(db, { actorId: input.actorId, reason: "invalid_code" });
    throw new DomainError("INVALID_CODE", "invalid code", 400);
  }

  if (!input.venueIds.includes(existing.venueId)) {
    await auditFail(db, {
      actorId: input.actorId,
      venueId: existing.venueId,
      purchaseId: existing.id,
      reason: "wrong_venue",
    });
    throw new DomainError("FORBIDDEN", "not your venue", 403);
  }

  if (at < existing.product.validFrom || at > existing.product.validTo) {
    await auditFail(db, {
      actorId: input.actorId,
      venueId: existing.venueId,
      purchaseId: existing.id,
      reason: "outside_window",
    });
    throw new DomainError("OUTSIDE_WINDOW", "pass is not valid tonight", 400);
  }

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.purchase.updateMany({
        where: { id: existing.id, status: "active", venueId: existing.venueId },
        data: { status: "redeemed", redeemedAt: at },
      });
      if (updated.count !== 1) {
        throw new DomainError("INACTIVE", `pass is already ${existing.status}`, 409);
      }
      await tx.auditEvent.create({
        data: {
          type: "redeem_success",
          actorId: input.actorId,
          venueId: existing.venueId,
          purchaseId: existing.id,
        },
      });
      return tx.purchase.findUniqueOrThrow({
        where: { id: existing.id },
        include: { product: true, venue: true, user: true },
      });
    });
  } catch (err) {
    if (err instanceof DomainError && err.code === "INACTIVE") {
      await auditFail(db, {
        actorId: input.actorId,
        venueId: existing.venueId,
        purchaseId: existing.id,
        reason: "not_active",
        status: existing.status,
      });
    }
    throw err;
  }
}

export async function recordStripeEvent(db: Db, id: string, type: string) {
  try {
    await db.stripeEvent.create({ data: { id, type } });
    return true;
  } catch {
    return false;
  }
}

export async function venueIdsFor(
  db: Db,
  userId: string,
  roles?: string[],
) {
  const rows = await db.userVenueRole.findMany({
    where: {
      userId,
      ...(roles ? { role: { in: roles } } : {}),
    },
    select: { venueId: true, role: true },
  });
  return rows;
}
