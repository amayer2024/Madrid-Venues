export const PASS_TYPES = ["line_skip", "cover"] as const;
export type PassType = (typeof PASS_TYPES)[number];

export const PURCHASE_STATUSES = [
  "reserved",
  "active",
  "redeemed",
  "expired",
] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const VENUE_STATUSES = ["pending", "approved", "suspended"] as const;
export type VenueStatus = (typeof VENUE_STATUSES)[number];

export const VENUE_ROLES = ["venue_admin", "door_staff"] as const;
export type VenueRole = (typeof VENUE_ROLES)[number];

export const PLATFORM_ROLES = ["customer", "superadmin"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MIN_AGE = 18;
export const RESERVATION_TTL_MINUTES_DEFAULT = 15;
export const APPLICATION_FEE_BPS_DEFAULT = 1000;

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function centsToEuros(cents: number, locale = "es-ES"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function applicationFeeCents(
  priceCents: number,
  bps = APPLICATION_FEE_BPS_DEFAULT,
): number {
  return Math.round((priceCents * bps) / 10_000);
}

export function isAtLeastAge(dob: Date, age = MIN_AGE, now = new Date()): boolean {
  const boundary = new Date(now.getFullYear() - age, now.getMonth(), now.getDate());
  return dob <= boundary;
}

export const messages = {
  es: {
    brand: "LineSkip",
    tagline: "Salta la cola en Madrid.",
    venues: "Locales",
    myPasses: "Mis pases",
    door: "Puerta",
    account: "Cuenta",
    login: "Entrar",
    register: "Crear cuenta",
    logout: "Salir",
    buy: "Comprar",
    soldOut: "Agotado",
    redeem: "Canjear",
    scan: "Escanear",
    ageGate: "Tienes que tener 18 años o más.",
    deleteAccount: "Eliminar cuenta",
  },
  en: {
    brand: "LineSkip",
    tagline: "Skip the line in Madrid.",
    venues: "Venues",
    myPasses: "My passes",
    door: "Door",
    account: "Account",
    login: "Log in",
    register: "Create account",
    logout: "Log out",
    buy: "Buy",
    soldOut: "Sold out",
    redeem: "Redeem",
    scan: "Scan",
    ageGate: "You must be 18 or older.",
    deleteAccount: "Delete account",
  },
} as const;

export type Locale = keyof typeof messages;
