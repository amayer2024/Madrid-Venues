# LineSkip

Madrid nightlife passes (line-skip / cover). Buy in the app, show a QR at the door.

## Stack

- **`apps/web`** — Next.js: public site, JSON API, venue/superadmin portal
- **`apps/mobile`** — Expo (iOS/Android): customer wallet + door scanner
- **`packages/db`** — Prisma + Postgres (inventory, purchases, payments, RBAC)
- **`packages/shared`** — statuses, money helpers, copy
- **`legacy/`** — original Flask/SQLite prototype

Purchases are **not refundable**. A pass becomes active only after Stripe reports `payment_intent.succeeded` (or the local `PAYMENTS_MODE=fake` simulator, which still goes through `activatePurchase`).

## Setup

```bash
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev:web
```

Then open http://localhost:8000 (health: http://localhost:8000/api/health).

In zsh, `#` is not a comment unless you `setopt interactivecomments`, so do not paste trailing `# notes` on the same line as a command.

Mobile (API must be reachable from the device/simulator):

```bash
pnpm dev:mobile
```

Optional: `EXPO_PUBLIC_API_URL=http://localhost:8000` if the phone cannot reach that default.

## Demo accounts

Password for all: `LineSkip1!`

| Email | Role |
|---|---|
| customer@lineskip.app | customer |
| door@lineskip.app | door staff (all seeded venues) |
| venue@lineskip.app | venue admin |
| admin@lineskip.app | superadmin |

## Tests

Needs Postgres running (`docker compose up -d postgres`):

```bash
DATABASE_URL=postgresql://lineskip:lineskip@localhost:5432/lineskip?schema=public pnpm test
```

## Payments

- `PAYMENTS_MODE=fake` — local demo, no Stripe keys; stock still claimed atomically and the pass activates through the same function as the webhook
- `PAYMENTS_MODE=stripe` — PaymentIntents + Connect destination charges + signed webhooks. Venues without a Connect account cannot sell.

## Store

See [STORE_REVIEW.md](STORE_REVIEW.md) for 3.1.3(e), demo accounts, privacy, and age rating.
