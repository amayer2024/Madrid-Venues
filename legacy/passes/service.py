"""Passes domain: purchase / redeem / refund business logic.

Pure logic — no Flask. Decisions live here; raw SQL lives in repository.py.

Purchase lifecycle (status is a small state machine):
    active --redeem--> redeemed   (one-time; redeeming twice is rejected)
    active --refund--> refunded   (returns one unit to inventory)
Only 'active' purchases can transition; 'redeemed' and 'refunded' are terminal.
"""
import secrets
from datetime import datetime, timezone

from analytics import service as analytics
from passes import repository


class PassError(Exception):
    """Raised when a passes operation fails for a caller-visible reason."""


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _new_redemption_code():
    # 8 uppercase hex chars, e.g. "A1B2C3D4". The column is UNIQUE, so a collision would be
    # rejected by the DB; at this scale the odds are negligible.
    return secrets.token_hex(4).upper()


def purchase(conn, user_id, pass_product_id):
    """Buy one unit of a pass product. Returns the new purchase as a dict.

    Raises PassError if the product does not exist or is sold out.
    """
    product = repository.get_pass_product(conn, pass_product_id)
    if product is None:
        raise PassError("pass product not found")

    # Atomic oversell guard: only proceed if a unit was actually claimed.
    if not repository.try_claim_unit(conn, pass_product_id):
        raise PassError("sold out")

    code = _new_redemption_code()
    purchase_id = repository.insert_purchase(
        conn, user_id, pass_product_id, product["venue_id"], product["price_cents"], code
    )
    conn.commit()

    # The one and only coupling point to the Analytics domain (the seam — see ADR-2).
    analytics.record_event(conn, product["venue_id"], "purchase", product["price_cents"])
    conn.commit()

    return {
        "id": purchase_id,
        "pass_product_id": pass_product_id,
        "venue_id": product["venue_id"],
        "price_cents_paid": product["price_cents"],
        "status": "active",
        "redemption_code": code,
    }


def redeem(conn, code):
    """Redeem an active pass by its code (the door scan). Returns the updated purchase.

    Raises PassError if the code is unknown or the pass is not active (one-time use).
    """
    purchase = repository.get_purchase_by_code(conn, code)
    if purchase is None:
        raise PassError("invalid code")
    if purchase["status"] != "active":
        raise PassError(f"pass is already {purchase['status']}")

    repository.set_status(conn, purchase["id"], "redeemed", redeemed_at=_now_iso())
    conn.commit()
    return dict(repository.get_purchase(conn, purchase["id"]))


def refund(conn, purchase_id, user_id):
    """Refund the caller's own active pass and return its unit to inventory.

    Raises PassError if the purchase is missing, not owned by the caller, or not active.
    """
    purchase = repository.get_purchase(conn, purchase_id)
    if purchase is None:
        raise PassError("purchase not found")
    if purchase["user_id"] != user_id:
        raise PassError("not your purchase")
    if purchase["status"] != "active":
        raise PassError(f"cannot refund a {purchase['status']} pass")

    repository.set_status(conn, purchase_id, "refunded")
    repository.release_unit(conn, purchase["pass_product_id"])
    conn.commit()

    # Track the refund in Analytics through the same seam (see ADR-2). Revenue reports
    # filter to 'purchase' events, so this records the refund without changing gross revenue.
    analytics.record_event(conn, purchase["venue_id"], "refund", purchase["price_cents_paid"])
    conn.commit()

    return dict(repository.get_purchase(conn, purchase_id))
