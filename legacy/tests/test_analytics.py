"""Tests for the Analytics domain: recording events (Day 3) and reporting (Day 4)."""
from analytics import service as analytics


def test_record_event_writes_a_row(conn):
    analytics.record_event(conn, venue_id=7, event_type="purchase", amount_cents=1500)

    row = conn.execute("SELECT * FROM events").fetchone()
    assert row["venue_id"] == 7
    assert row["event_type"] == "purchase"
    assert row["amount_cents"] == 1500
    assert row["occurred_at"]  # timestamp was stamped


def test_record_event_returns_event_id(conn):
    first = analytics.record_event(conn, 1, "purchase", 1000)
    second = analytics.record_event(conn, 1, "purchase", 2000)
    assert second != first
    assert conn.execute("SELECT COUNT(*) FROM events").fetchone()[0] == 2


# --- reporting ------------------------------------------------------------

def _event(conn, venue_id, amount_cents, occurred_at):
    """Insert one purchase event with an explicit timestamp (for day grouping)."""
    conn.execute(
        """INSERT INTO events (venue_id, event_type, amount_cents, occurred_at)
           VALUES (?, 'purchase', ?, ?)""",
        (venue_id, amount_cents, occurred_at),
    )
    conn.commit()


def test_reports_are_empty_with_no_events(conn):
    assert analytics.total_revenue(conn) == 0
    assert analytics.revenue_per_venue(conn) == []
    assert analytics.top_venues(conn) == []
    assert analytics.revenue_per_day(conn) == []


def test_total_revenue_sums_all_purchases(conn):
    _event(conn, 1, 1500, "2026-10-07T10:00:00+00:00")
    _event(conn, 1, 2000, "2026-10-08T11:00:00+00:00")
    _event(conn, 2, 5000, "2026-10-08T12:00:00+00:00")
    assert analytics.total_revenue(conn) == 8500


def test_revenue_per_venue_groups_by_venue(conn):
    _event(conn, 1, 1500, "2026-10-07T10:00:00+00:00")
    _event(conn, 1, 2000, "2026-10-08T11:00:00+00:00")
    _event(conn, 2, 5000, "2026-10-08T12:00:00+00:00")
    assert analytics.revenue_per_venue(conn) == [
        {"venue_id": 1, "revenue_cents": 3500},
        {"venue_id": 2, "revenue_cents": 5000},
    ]


def test_top_venues_orders_highest_first_and_caps_at_n(conn):
    _event(conn, 1, 3500, "2026-10-08T10:00:00+00:00")
    _event(conn, 2, 5000, "2026-10-08T11:00:00+00:00")
    _event(conn, 3, 1000, "2026-10-08T12:00:00+00:00")
    assert analytics.top_venues(conn, 2) == [
        {"venue_id": 2, "revenue_cents": 5000},
        {"venue_id": 1, "revenue_cents": 3500},
    ]


def test_revenue_per_day_groups_on_the_date_boundary(conn):
    # Two events on 10-08 collapse into one bucket; 10-07 stays separate.
    _event(conn, 1, 1500, "2026-10-07T23:59:59+00:00")
    _event(conn, 1, 2000, "2026-10-08T00:00:01+00:00")
    _event(conn, 2, 5000, "2026-10-08T18:00:00+00:00")
    assert analytics.revenue_per_day(conn) == [
        {"day": "2026-10-07", "revenue_cents": 1500},
        {"day": "2026-10-08", "revenue_cents": 7000},
    ]
