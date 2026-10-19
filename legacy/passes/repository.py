"""Passes domain: the SQL layer for venues, pass products, and purchases.

Only queries and row access live here — no business rules (those are in service.py) and no Flask.
Keeping SQL in one place makes the service logic easy to read and test.
"""
from datetime import datetime, timezone


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


# --- venues ---------------------------------------------------------------

def list_venues(conn):
    return conn.execute("SELECT * FROM venues ORDER BY name").fetchall()


def get_venue(conn, venue_id):
    return conn.execute("SELECT * FROM venues WHERE id = ?", (venue_id,)).fetchone()


# --- pass products --------------------------------------------------------

def list_pass_products(conn, venue_id):
    return conn.execute(
        "SELECT * FROM pass_products WHERE venue_id = ? ORDER BY price_cents", (venue_id,)
    ).fetchall()


def get_pass_product(conn, pass_product_id):
    return conn.execute(
        "SELECT * FROM pass_products WHERE id = ?", (pass_product_id,)
    ).fetchone()


# --- purchases ------------------------------------------------------------

def try_claim_unit(conn, pass_product_id):
    """Atomically claim one unit of inventory. Returns True if a unit was available.

    The WHERE clause checks stock and the SET increments it in one step, so two concurrent
    buyers can never both claim the last unit (no read-then-write race).
    """
    cur = conn.execute(
        """UPDATE pass_products
              SET quantity_sold = quantity_sold + 1
            WHERE id = ? AND quantity_sold < quantity_total""",
        (pass_product_id,),
    )
    return cur.rowcount > 0


def insert_purchase(conn, user_id, pass_product_id, venue_id, price_cents, code):
    cur = conn.execute(
        """INSERT INTO purchases
               (user_id, pass_product_id, venue_id, price_cents_paid, status,
                redemption_code, purchased_at)
           VALUES (?, ?, ?, ?, 'active', ?, ?)""",
        (user_id, pass_product_id, venue_id, price_cents, code, _now_iso()),
    )
    return cur.lastrowid


def get_purchase(conn, purchase_id):
    return conn.execute("SELECT * FROM purchases WHERE id = ?", (purchase_id,)).fetchone()


def get_purchase_by_code(conn, code):
    return conn.execute(
        "SELECT * FROM purchases WHERE redemption_code = ?", (code,)
    ).fetchone()


def list_purchases_for_user(conn, user_id):
    return conn.execute(
        "SELECT * FROM purchases WHERE user_id = ? ORDER BY id DESC", (user_id,)
    ).fetchall()


def set_status(conn, purchase_id, status, redeemed_at=None):
    """Single writer for purchase status transitions."""
    conn.execute(
        "UPDATE purchases SET status = ?, redeemed_at = ? WHERE id = ?",
        (status, redeemed_at, purchase_id),
    )


def release_unit(conn, pass_product_id):
    """Give one unit back to inventory (the mirror of try_claim_unit, used by refunds)."""
    conn.execute(
        "UPDATE pass_products SET quantity_sold = quantity_sold - 1 WHERE id = ?",
        (pass_product_id,),
    )


# --- seed -----------------------------------------------------------------

_SEED = [
    ("Teatro Kapital", "Calle de Atocha 125", [
        ("line_skip", "Skip the Line", 1500, 100),
        ("cover", "Cover Entry", 2000, 300),
    ]),
    ("Fabrik", "Avenida de la Industria 82, Humanes", [
        ("line_skip", "Fast Track", 2000, 150),
        ("cover", "General Admission", 2500, 500),
    ]),
    ("Joy Eslava", "Calle del Arenal 11", [
        ("line_skip", "Skip the Line", 1200, 80),
    ]),
    ("Opium Madrid", "Calle de José Abascal 56", [
        ("line_skip", "VIP Skip", 1800, 60),
        ("cover", "Cover Entry", 2200, 200),
    ]),
    ("Shôko Madrid", "Calle de Toledo 86", [
        ("cover", "Cover Entry", 1500, 250),
    ]),
]


def seed_venues(conn, valid_date="2026-10-10"):
    """Insert sample Madrid venues and pass products, but only if no venues exist yet.

    Idempotent: safe to call on every startup (deployment contract §7 forbids manual setup).
    """
    if conn.execute("SELECT 1 FROM venues LIMIT 1").fetchone() is not None:
        return
    now = _now_iso()
    for name, address, products in _SEED:
        cur = conn.execute(
            "INSERT INTO venues (name, city, address, created_at) VALUES (?, ?, ?, ?)",
            (name, "Madrid", address, now),
        )
        venue_id = cur.lastrowid
        for ptype, pname, price_cents, qty in products:
            conn.execute(
                """INSERT INTO pass_products
                       (venue_id, type, name, price_cents, quantity_total, quantity_sold,
                        valid_date, created_at)
                   VALUES (?, ?, ?, ?, ?, 0, ?, ?)""",
                (venue_id, ptype, pname, price_cents, qty, valid_date, now),
            )
    conn.commit()
