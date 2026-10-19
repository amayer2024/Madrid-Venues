-- LineSkip schema. Applied idempotently at startup (deployment contract §7: no manual migration).

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

-- Passes domain ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS venues (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    city       TEXT NOT NULL,
    address    TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pass_products (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id       INTEGER NOT NULL REFERENCES venues(id),
    type           TEXT NOT NULL CHECK (type IN ('line_skip', 'cover')),
    name           TEXT NOT NULL,
    price_cents    INTEGER NOT NULL,
    quantity_total INTEGER NOT NULL,
    quantity_sold  INTEGER NOT NULL DEFAULT 0,
    valid_date     TEXT NOT NULL,
    created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    pass_product_id  INTEGER NOT NULL REFERENCES pass_products(id),
    venue_id         INTEGER NOT NULL REFERENCES venues(id),
    price_cents_paid INTEGER NOT NULL,
    status           TEXT NOT NULL CHECK (status IN ('active', 'redeemed', 'refunded')),
    redemption_code  TEXT NOT NULL UNIQUE,
    purchased_at     TEXT NOT NULL,
    redeemed_at      TEXT
);

-- Analytics domain ---------------------------------------------------------
-- Owned entirely by the Analytics domain. Deliberately has NO foreign key into
-- venues/purchases: it stores its own copy of what it needs so Analytics never
-- reads the Passes tables and the two domains can be separated later (see ADR-2).

CREATE TABLE IF NOT EXISTS events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id     INTEGER NOT NULL,
    event_type   TEXT NOT NULL,
    amount_cents INTEGER NOT NULL DEFAULT 0,
    occurred_at  TEXT NOT NULL
);
