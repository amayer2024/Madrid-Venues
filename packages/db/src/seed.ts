import { config } from "dotenv";
import { resolve } from "node:path";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "./client";

config({ path: resolve(process.cwd(), "../../.env") });
config({ path: resolve(process.cwd(), ".env") });

const DEMO_PASSWORD = "LineSkip1!";

async function upsertUser(input: {
  email: string;
  name: string;
  platformRole: string;
  dateOfBirth: Date;
}) {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  const id = crypto.randomUUID();
  const now = new Date();
  const user = await prisma.user.create({
    data: {
      id,
      email,
      name: input.name,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      platformRole: input.platformRole,
      dateOfBirth: input.dateOfBirth,
    },
  });
  await prisma.account.create({
    data: {
      id: crypto.randomUUID(),
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: await hashPassword(DEMO_PASSWORD),
      createdAt: now,
      updatedAt: now,
    },
  });
  return user;
}

const SEED_VENUES = [
  {
    name: "Teatro Kapital",
    address: "Calle de Atocha 125",
    lat: 40.4107,
    lng: -3.6934,
    products: [
      { type: "line_skip", name: "Skip the Line", priceCents: 1500, quantityTotal: 100 },
      { type: "cover", name: "Cover Entry", priceCents: 2000, quantityTotal: 300 },
    ],
  },
  {
    name: "Fabrik",
    address: "Avenida de la Industria 82, Humanes",
    lat: 40.263,
    lng: -3.827,
    products: [
      { type: "line_skip", name: "Fast Track", priceCents: 2000, quantityTotal: 150 },
      { type: "cover", name: "General Admission", priceCents: 2500, quantityTotal: 500 },
    ],
  },
  {
    name: "Joy Eslava",
    address: "Calle del Arenal 11",
    lat: 40.417,
    lng: -3.707,
    products: [{ type: "line_skip", name: "Skip the Line", priceCents: 1200, quantityTotal: 80 }],
  },
  {
    name: "Opium Madrid",
    address: "Calle de José Abascal 56",
    lat: 40.437,
    lng: -3.694,
    products: [
      { type: "line_skip", name: "VIP Skip", priceCents: 1800, quantityTotal: 60 },
      { type: "cover", name: "Cover Entry", priceCents: 2200, quantityTotal: 200 },
    ],
  },
  {
    name: "Shôko Madrid",
    address: "Calle de Toledo 86",
    lat: 40.411,
    lng: -3.711,
    products: [{ type: "cover", name: "Cover Entry", priceCents: 1500, quantityTotal: 250 }],
  },
];

async function main() {
  const dob = new Date("1995-01-15T00:00:00.000Z");
  const [customer, door, venueAdmin, superadmin] = await Promise.all([
    upsertUser({
      email: "customer@lineskip.app",
      name: "Demo Customer",
      platformRole: "customer",
      dateOfBirth: dob,
    }),
    upsertUser({
      email: "door@lineskip.app",
      name: "Demo Door",
      platformRole: "customer",
      dateOfBirth: dob,
    }),
    upsertUser({
      email: "venue@lineskip.app",
      name: "Demo Venue Admin",
      platformRole: "customer",
      dateOfBirth: dob,
    }),
    upsertUser({
      email: "admin@lineskip.app",
      name: "LineSkip Superadmin",
      platformRole: "superadmin",
      dateOfBirth: dob,
    }),
  ]);

  const validFrom = new Date();
  validFrom.setUTCHours(0, 0, 0, 0);
  const validTo = new Date(validFrom);
  validTo.setUTCFullYear(validTo.getUTCFullYear() + 1);

  for (const v of SEED_VENUES) {
    let venue = await prisma.venue.findFirst({ where: { name: v.name } });
    if (!venue) {
      venue = await prisma.venue.create({
        data: {
          name: v.name,
          city: "Madrid",
          address: v.address,
          lat: v.lat,
          lng: v.lng,
          status: "approved",
          stripeAccountId: process.env.PAYMENTS_MODE === "fake" ? `acct_fake_${v.name}` : null,
        },
      });
      for (const p of v.products) {
        await prisma.passProduct.create({
          data: {
            venueId: venue.id,
            type: p.type,
            name: p.name,
            priceCents: p.priceCents,
            quantityTotal: p.quantityTotal,
            validFrom,
            validTo,
            isActive: true,
          },
        });
      }
    }
    await prisma.userVenueRole.upsert({
      where: {
        userId_venueId_role: {
          userId: venueAdmin.id,
          venueId: venue.id,
          role: "venue_admin",
        },
      },
      update: {},
      create: { userId: venueAdmin.id, venueId: venue.id, role: "venue_admin" },
    });
    await prisma.userVenueRole.upsert({
      where: {
        userId_venueId_role: {
          userId: door.id,
          venueId: venue.id,
          role: "door_staff",
        },
      },
      update: {},
      create: { userId: door.id, venueId: venue.id, role: "door_staff" },
    });
  }

  console.log("Seeded demo users:");
  console.log("  customer@lineskip.app / LineSkip1!");
  console.log("  door@lineskip.app / LineSkip1!");
  console.log("  venue@lineskip.app / LineSkip1!");
  console.log("  admin@lineskip.app / LineSkip1!");
  void customer;
  void superadmin;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
