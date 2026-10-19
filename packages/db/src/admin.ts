import type { Prisma, PrismaClient } from "@prisma/client";
import { DomainError } from "@lineskip/shared";

type Db = PrismaClient | Prisma.TransactionClient;

export async function listVenuesForAdmin(db: Db, venueIds?: string[]) {
  return db.venue.findMany({
    where: venueIds ? { id: { in: venueIds } } : undefined,
    orderBy: { name: "asc" },
    include: {
      products: { orderBy: { priceCents: "asc" } },
      roles: { include: { user: true } },
    },
  });
}

export async function createVenue(
  db: Db,
  input: {
    name: string;
    address: string;
    city?: string;
    lat?: number;
    lng?: number;
    ownerUserId?: string;
  },
) {
  return db.venue.create({
    data: {
      name: input.name,
      address: input.address,
      city: input.city ?? "Madrid",
      lat: input.lat,
      lng: input.lng,
      status: "pending",
      roles: input.ownerUserId
        ? { create: { userId: input.ownerUserId, role: "venue_admin" } }
        : undefined,
    },
  });
}

export async function setVenueStatus(db: Db, venueId: string, status: string) {
  return db.venue.update({ where: { id: venueId }, data: { status } });
}

export async function upsertProduct(
  db: Db,
  input: {
    id?: string;
    venueId: string;
    type: string;
    name: string;
    priceCents: number;
    quantityTotal: number;
    validFrom: Date;
    validTo: Date;
    isActive: boolean;
  },
) {
  if (input.priceCents < 0 || input.quantityTotal < 1) {
    throw new DomainError("VALIDATION", "invalid price or quantity", 400);
  }
  if (input.validTo <= input.validFrom) {
    throw new DomainError("VALIDATION", "valid_to must be after valid_from", 400);
  }
  if (input.id) {
    const existing = await db.passProduct.findUnique({ where: { id: input.id } });
    if (!existing || existing.venueId !== input.venueId) {
      throw new DomainError("NOT_FOUND", "product not found", 404);
    }
    if (input.quantityTotal < existing.quantitySold) {
      throw new DomainError("VALIDATION", "quantity cannot be below sold count", 400);
    }
    return db.passProduct.update({
      where: { id: input.id },
      data: {
        type: input.type,
        name: input.name,
        priceCents: input.priceCents,
        quantityTotal: input.quantityTotal,
        validFrom: input.validFrom,
        validTo: input.validTo,
        isActive: input.isActive,
      },
    });
  }
  return db.passProduct.create({
    data: {
      venueId: input.venueId,
      type: input.type,
      name: input.name,
      priceCents: input.priceCents,
      quantityTotal: input.quantityTotal,
      validFrom: input.validFrom,
      validTo: input.validTo,
      isActive: input.isActive,
    },
  });
}

export async function inviteStaff(
  db: Db,
  input: { venueId: string; email: string; role: "venue_admin" | "door_staff" },
) {
  const user = await db.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user || user.deletedAt) {
    throw new DomainError("NOT_FOUND", "user not found — they must register first", 404);
  }
  return db.userVenueRole.upsert({
    where: {
      userId_venueId_role: {
        userId: user.id,
        venueId: input.venueId,
        role: input.role,
      },
    },
    update: {},
    create: { userId: user.id, venueId: input.venueId, role: input.role },
  });
}

export async function setStripeAccount(db: Db, venueId: string, stripeAccountId: string) {
  return db.venue.update({
    where: { id: venueId },
    data: { stripeAccountId },
  });
}
