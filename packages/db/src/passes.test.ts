import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { DomainError } from "@lineskip/shared";
import {
  activatePurchase,
  attachPaymentIntent,
  createCheckout,
  expireReservations,
  failPurchasePayment,
  listMyPasses,
  redeem,
} from "./passes";
import { revenueSummary } from "./analytics";

const url =
  process.env.DATABASE_URL ??
  "postgresql://lineskip:lineskip@localhost:5432/lineskip_test?schema=public";

const prisma = new PrismaClient({ datasourceUrl: url });

async function user() {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      id,
      name: "Test",
      email: `u-${id}@madrid.es`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

async function venueProduct(opts?: { qty?: number; from?: Date; to?: Date; stripe?: string | null }) {
  const from = opts?.from ?? new Date(Date.now() - 86_400_000);
  const to = opts?.to ?? new Date(Date.now() + 86_400_000 * 30);
  const venue = await prisma.venue.create({
    data: {
      name: `Venue ${randomUUID().slice(0, 8)}`,
      address: "Calle Test 1",
      status: "approved",
      stripeAccountId: opts?.stripe === undefined ? "acct_test" : opts.stripe,
    },
  });
  const product = await prisma.passProduct.create({
    data: {
      venueId: venue.id,
      type: "line_skip",
      name: "Skip",
      priceCents: 1500,
      quantityTotal: opts?.qty ?? 5,
      validFrom: from,
      validTo: to,
      isActive: true,
    },
  });
  return { venue, product };
}

async function paidPass(userId: string, productId: string) {
  const checkout = await createCheckout(prisma, {
    userId,
    passProductId: productId,
    ttlMinutes: 15,
    feeBps: 1000,
    requireStripeAccount: false,
  });
  const pi = `pi_${randomUUID()}`;
  await attachPaymentIntent(prisma, checkout.payment.id, pi);
  const purchase = await activatePurchase(prisma, pi);
  return { ...checkout, purchase, pi };
}

beforeAll(async () => {
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE pass_products
        DROP CONSTRAINT IF EXISTS pass_products_qty_check;
      ALTER TABLE pass_products
        ADD CONSTRAINT pass_products_qty_check
        CHECK (quantity_sold >= 0 AND quantity_sold <= quantity_total);
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END $$;
  `);
});

beforeEach(async () => {
  await prisma.auditEvent.deleteMany();
  await prisma.stripeEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.passProduct.deleteMany();
  await prisma.userVenueRole.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.auditEvent.deleteMany();
  await prisma.stripeEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.passProduct.deleteMany();
  await prisma.userVenueRole.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

describe("checkout + activate", () => {
  it("claims stock and activates only after payment", async () => {
    const u = await user();
    const { product } = await venueProduct({ qty: 2 });
    const checkout = await createCheckout(prisma, {
      userId: u.id,
      passProductId: product.id,
      ttlMinutes: 15,
      feeBps: 1000,
      requireStripeAccount: true,
    });
    expect(checkout.purchase.status).toBe("reserved");
    expect(checkout.purchase.redemptionCode).toBeNull();

    const sold = await prisma.passProduct.findUniqueOrThrow({ where: { id: product.id } });
    expect(sold.quantitySold).toBe(1);

    const pi = "pi_ok";
    await attachPaymentIntent(prisma, checkout.payment.id, pi);
    const active = await activatePurchase(prisma, pi);
    expect(active.status).toBe("active");
    expect(active.redemptionCode).toBeTruthy();
    expect(active.redemptionCode!.length).toBeGreaterThan(16);
  });

  it("rejects sold out without overselling", async () => {
    const u = await user();
    const { product } = await venueProduct({ qty: 1 });
    await createCheckout(prisma, {
      userId: u.id,
      passProductId: product.id,
      ttlMinutes: 15,
      feeBps: 1000,
      requireStripeAccount: false,
    });
    await expect(
      createCheckout(prisma, {
        userId: u.id,
        passProductId: product.id,
        ttlMinutes: 15,
        feeBps: 1000,
        requireStripeAccount: false,
      }),
    ).rejects.toMatchObject({ code: "SOLD_OUT", statusCode: 409 });
    const sold = await prisma.passProduct.findUniqueOrThrow({ where: { id: product.id } });
    expect(sold.quantitySold).toBe(1);
  });

  it("does not oversell under concurrency", async () => {
    const u = await user();
    const { product } = await venueProduct({ qty: 5 });
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        createCheckout(prisma, {
          userId: u.id,
          passProductId: product.id,
          ttlMinutes: 15,
          feeBps: 1000,
          requireStripeAccount: false,
        }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const soldOut = results.filter(
      (r) =>
        r.status === "rejected" &&
        r.reason instanceof DomainError &&
        r.reason.code === "SOLD_OUT",
    );
    expect(ok).toHaveLength(5);
    expect(soldOut).toHaveLength(15);
    const sold = await prisma.passProduct.findUniqueOrThrow({ where: { id: product.id } });
    expect(sold.quantitySold).toBe(5);
  });

  it("rejects purchases outside the validity window", async () => {
    const u = await user();
    const { product } = await venueProduct({
      from: new Date("2020-01-01"),
      to: new Date("2020-01-02"),
    });
    await expect(
      createCheckout(prisma, {
        userId: u.id,
        passProductId: product.id,
        ttlMinutes: 15,
        feeBps: 1000,
        requireStripeAccount: false,
      }),
    ).rejects.toMatchObject({ code: "OUTSIDE_WINDOW" });
  });

  it("requires a Stripe account when asked", async () => {
    const u = await user();
    const { product } = await venueProduct({ stripe: null });
    await expect(
      createCheckout(prisma, {
        userId: u.id,
        passProductId: product.id,
        ttlMinutes: 15,
        feeBps: 1000,
        requireStripeAccount: true,
      }),
    ).rejects.toMatchObject({ code: "VENUE_NOT_PAYABLE", statusCode: 409 });
  });

  it("expires unpaid reservations and returns stock", async () => {
    const u = await user();
    const { product } = await venueProduct({ qty: 1 });
    const checkout = await createCheckout(prisma, {
      userId: u.id,
      passProductId: product.id,
      ttlMinutes: 15,
      feeBps: 1000,
      requireStripeAccount: false,
    });
    await prisma.purchase.update({
      where: { id: checkout.purchase.id },
      data: { reservedUntil: new Date(Date.now() - 1000) },
    });
    const n = await expireReservations(prisma);
    expect(n).toBe(1);
    const sold = await prisma.passProduct.findUniqueOrThrow({ where: { id: product.id } });
    expect(sold.quantitySold).toBe(0);
  });

  it("failed payment releases the reservation", async () => {
    const u = await user();
    const { product } = await venueProduct({ qty: 1 });
    const checkout = await createCheckout(prisma, {
      userId: u.id,
      passProductId: product.id,
      ttlMinutes: 15,
      feeBps: 1000,
      requireStripeAccount: false,
    });
    const pi = "pi_fail";
    await attachPaymentIntent(prisma, checkout.payment.id, pi);
    await failPurchasePayment(prisma, pi);
    const sold = await prisma.passProduct.findUniqueOrThrow({ where: { id: product.id } });
    expect(sold.quantitySold).toBe(0);
  });
});

describe("redeem", () => {
  it("marks a pass redeemed once", async () => {
    const u = await user();
    const { venue, product } = await venueProduct();
    const { purchase } = await paidPass(u.id, product.id);
    const staff = await user();
    const result = await redeem(prisma, {
      code: purchase.redemptionCode!,
      actorId: staff.id,
      venueIds: [venue.id],
    });
    expect(result.status).toBe("redeemed");
    expect(result.redeemedAt).toBeTruthy();
  });

  it("rejects a second redeem even when concurrent", async () => {
    const u = await user();
    const { venue, product } = await venueProduct();
    const { purchase } = await paidPass(u.id, product.id);
    const staff = await user();
    const args = {
      code: purchase.redemptionCode!,
      actorId: staff.id,
      venueIds: [venue.id],
    };
    const results = await Promise.allSettled([redeem(prisma, args), redeem(prisma, args)]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const denied = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(denied).toHaveLength(1);
  });

  it("forbids staff from another venue", async () => {
    const u = await user();
    const { product } = await venueProduct();
    const other = await venueProduct();
    const { purchase } = await paidPass(u.id, product.id);
    const staff = await user();
    await expect(
      redeem(prisma, {
        code: purchase.redemptionCode!,
        actorId: staff.id,
        venueIds: [other.venue.id],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
  });

  it("rejects unknown codes and writes an audit row", async () => {
    const staff = await user();
    await expect(
      redeem(prisma, { code: "nope", actorId: staff.id, venueIds: [] }),
    ).rejects.toMatchObject({ code: "INVALID_CODE" });
    const fails = await prisma.auditEvent.findMany({ where: { type: "redeem_fail" } });
    expect(fails.length).toBeGreaterThan(0);
  });
});

describe("my passes + analytics", () => {
  it("lists only the caller's paid passes with venue names", async () => {
    const me = await user();
    const other = await user();
    const { product } = await venueProduct();
    await paidPass(me.id, product.id);
    await paidPass(other.id, product.id);
    const mine = await listMyPasses(prisma, me.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].venue.name).toBeTruthy();
    expect(mine[0].product.name).toBe("Skip");
  });

  it("reports revenue from activated passes", async () => {
    const u = await user();
    const { venue, product } = await venueProduct();
    await paidPass(u.id, product.id);
    const report = await revenueSummary(prisma);
    expect(report.total_cents).toBe(1500);
    expect(report.by_venue[0].venue_name).toBe(venue.name);
  });
});
