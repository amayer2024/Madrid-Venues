"""Direct tests for the Passes SQL layer (repository.py).

These cover the read helpers and the startup seed that the service tests reach only
indirectly, using the same per-test temp SQLite `conn` fixture.
"""
from passes import repository


def _venue(conn, name, city="Madrid", address="A"):
    cur = conn.execute(
        "INSERT INTO venues (name, city, address, created_at) VALUES (?, ?, ?, 'now')",
        (name, city, address),
    )
    conn.commit()
    return cur.lastrowid


def _product(conn, venue_id, price_cents, name="P"):
    cur = conn.execute(
        """INSERT INTO pass_products
               (venue_id, type, name, price_cents, quantity_total, quantity_sold, valid_date, created_at)
           VALUES (?, 'line_skip', ?, ?, 10, 0, '2026-10-10', 'now')""",
        (venue_id, name, price_cents),
    )
    conn.commit()
    return cur.lastrowid


def _user(conn, email="u@m.es"):
    cur = conn.execute(
        "INSERT INTO users (email, password_hash, created_at) VALUES (?, 'x', 'now')",
        (email,),
    )
    conn.commit()
    return cur.lastrowid


# --- venues ---------------------------------------------------------------

def test_list_venues_is_ordered_by_name(conn):
    _venue(conn, "Zed")
    _venue(conn, "Alpha")
    names = [v["name"] for v in repository.list_venues(conn)]
    assert names == ["Alpha", "Zed"]


def test_get_venue_hit_and_miss(conn):
    venue_id = _venue(conn, "Kapital")
    assert repository.get_venue(conn, venue_id)["name"] == "Kapital"
    assert repository.get_venue(conn, 9999) is None


# --- pass products --------------------------------------------------------

def test_list_pass_products_is_ordered_by_price(conn):
    venue_id = _venue(conn, "Kapital")
    _product(conn, venue_id, 2000, name="Pricey")
    _product(conn, venue_id, 1000, name="Cheap")
    names = [p["name"] for p in repository.list_pass_products(conn, venue_id)]
    assert names == ["Cheap", "Pricey"]


# --- purchases ------------------------------------------------------------

def test_list_purchases_for_user_is_scoped_and_newest_first(conn):
    venue_id = _venue(conn, "Kapital")
    product_id = _product(conn, venue_id, 1500)
    me = _user(conn, "me@m.es")
    other = _user(conn, "other@m.es")
    first = repository.insert_purchase(conn, me, product_id, venue_id, 1500, "AAAA1111")
    second = repository.insert_purchase(conn, me, product_id, venue_id, 1500, "BBBB2222")
    repository.insert_purchase(conn, other, product_id, venue_id, 1500, "CCCC3333")
    conn.commit()

    rows = repository.list_purchases_for_user(conn, me)
    ids = [r["id"] for r in rows]
    assert ids == [second, first]  # only my purchases, newest first


# --- seed -----------------------------------------------------------------

def test_seed_venues_populates_an_empty_db(conn):
    repository.seed_venues(conn)
    venues = repository.list_venues(conn)
    assert len(venues) == 5  # the 5 Madrid venues
    # each seeded venue has at least one pass product
    first = repository.list_pass_products(conn, venues[0]["id"])
    assert len(first) >= 1


def test_seed_venues_is_idempotent(conn):
    repository.seed_venues(conn)
    count = conn.execute("SELECT COUNT(*) FROM venues").fetchone()[0]
    repository.seed_venues(conn)  # second call must be a no-op
    assert conn.execute("SELECT COUNT(*) FROM venues").fetchone()[0] == count
