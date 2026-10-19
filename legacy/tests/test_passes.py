"""Tests for the Passes domain's core logic (purchase + oversell guard)."""
import pytest

from analytics import service as analytics
from passes import repository
from passes import service as passes


def _make_product(conn, quantity_total=100, price_cents=1500):
    """Seed one venue + one pass product directly, returning (venue_id, pass_product_id)."""
    vcur = conn.execute(
        "INSERT INTO venues (name, city, address, created_at) VALUES ('V', 'Madrid', 'A', 'now')"
    )
    venue_id = vcur.lastrowid
    pcur = conn.execute(
        """INSERT INTO pass_products
               (venue_id, type, name, price_cents, quantity_total, quantity_sold, valid_date, created_at)
           VALUES (?, 'line_skip', 'Skip', ?, ?, 0, '2026-10-10', 'now')""",
        (venue_id, price_cents, quantity_total),
    )
    conn.commit()
    return venue_id, pcur.lastrowid


def _user(conn):
    cur = conn.execute(
        "INSERT INTO users (email, password_hash, created_at) VALUES ('u@m.es', 'x', 'now')"
    )
    conn.commit()
    return cur.lastrowid


def test_purchase_succeeds_and_increments_stock(conn):
    venue_id, product_id = _make_product(conn, quantity_total=100, price_cents=1500)
    user_id = _user(conn)

    result = passes.purchase(conn, user_id, product_id)

    assert result["status"] == "active"
    assert result["price_cents_paid"] == 1500
    assert result["venue_id"] == venue_id
    assert result["redemption_code"]
    sold = conn.execute(
        "SELECT quantity_sold FROM pass_products WHERE id = ?", (product_id,)
    ).fetchone()["quantity_sold"]
    assert sold == 1


def test_purchase_rejects_when_sold_out(conn):
    _, product_id = _make_product(conn, quantity_total=1)
    user_id = _user(conn)

    passes.purchase(conn, user_id, product_id)  # claims the only unit
    with pytest.raises(passes.PassError):
        passes.purchase(conn, user_id, product_id)  # sold out

    sold = conn.execute(
        "SELECT quantity_sold FROM pass_products WHERE id = ?", (product_id,)
    ).fetchone()["quantity_sold"]
    assert sold == 1  # never exceeds quantity_total


def test_purchase_unknown_product_raises(conn):
    user_id = _user(conn)
    with pytest.raises(passes.PassError):
        passes.purchase(conn, user_id, 9999)


def test_purchase_records_an_analytics_event(conn):
    """The seam: a successful purchase writes exactly one 'purchase' event (see ADR-2)."""
    venue_id, product_id = _make_product(conn, price_cents=1500)
    user_id = _user(conn)

    passes.purchase(conn, user_id, product_id)

    events = conn.execute("SELECT * FROM events").fetchall()
    assert len(events) == 1
    assert events[0]["event_type"] == "purchase"
    assert events[0]["venue_id"] == venue_id
    assert events[0]["amount_cents"] == 1500


def test_each_purchase_gets_a_unique_code(conn):
    _, product_id = _make_product(conn, quantity_total=10)
    user_id = _user(conn)
    codes = {passes.purchase(conn, user_id, product_id)["redemption_code"] for _ in range(5)}
    assert len(codes) == 5


# --- redeem ---------------------------------------------------------------

def test_redeem_marks_pass_redeemed(conn):
    _, product_id = _make_product(conn)
    user_id = _user(conn)
    bought = passes.purchase(conn, user_id, product_id)

    result = passes.redeem(conn, bought["redemption_code"])

    assert result["status"] == "redeemed"
    assert result["redeemed_at"] is not None


def test_redeem_twice_is_rejected(conn):
    _, product_id = _make_product(conn)
    user_id = _user(conn)
    bought = passes.purchase(conn, user_id, product_id)

    passes.redeem(conn, bought["redemption_code"])
    with pytest.raises(passes.PassError):
        passes.redeem(conn, bought["redemption_code"])  # one-time use


def test_redeem_unknown_code_raises(conn):
    with pytest.raises(passes.PassError):
        passes.redeem(conn, "NOPE0000")


# --- refund ---------------------------------------------------------------

def test_refund_marks_refunded_and_releases_stock(conn):
    _, product_id = _make_product(conn, quantity_total=5)
    user_id = _user(conn)
    bought = passes.purchase(conn, user_id, product_id)
    assert conn.execute(
        "SELECT quantity_sold FROM pass_products WHERE id = ?", (product_id,)
    ).fetchone()["quantity_sold"] == 1

    result = passes.refund(conn, bought["id"], user_id)

    assert result["status"] == "refunded"
    assert conn.execute(
        "SELECT quantity_sold FROM pass_products WHERE id = ?", (product_id,)
    ).fetchone()["quantity_sold"] == 0  # unit returned to stock


def test_refund_rejects_other_users_purchase(conn):
    _, product_id = _make_product(conn)
    owner = _user(conn)
    bought = passes.purchase(conn, owner, product_id)
    other = conn.execute(
        "INSERT INTO users (email, password_hash, created_at) VALUES ('x@m.es','x','now')"
    ).lastrowid
    conn.commit()
    with pytest.raises(passes.PassError):
        passes.refund(conn, bought["id"], other)


def test_refund_unknown_purchase_raises(conn):
    user_id = _user(conn)
    with pytest.raises(passes.PassError):
        passes.refund(conn, 9999, user_id)


def test_refund_rejects_already_redeemed_pass(conn):
    _, product_id = _make_product(conn)
    user_id = _user(conn)
    bought = passes.purchase(conn, user_id, product_id)
    passes.redeem(conn, bought["redemption_code"])
    with pytest.raises(passes.PassError):
        passes.refund(conn, bought["id"], user_id)


def test_refund_records_a_refund_event(conn):
    """A refund is tracked in Analytics as a 'refund' event (gross revenue is unaffected)."""
    venue_id, product_id = _make_product(conn, price_cents=1500)
    user_id = _user(conn)
    bought = passes.purchase(conn, user_id, product_id)  # writes one 'purchase' event

    passes.refund(conn, bought["id"], user_id)

    refunds = conn.execute("SELECT * FROM events WHERE event_type = 'refund'").fetchall()
    assert len(refunds) == 1
    assert refunds[0]["venue_id"] == venue_id
    assert refunds[0]["amount_cents"] == 1500
    # Revenue report still counts only the purchase, so gross revenue is unchanged.
    assert analytics.total_revenue(conn) == 1500
