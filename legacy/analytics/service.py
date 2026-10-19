"""Analytics domain: recording sales events and (Day 4) reporting on them.

Pure logic — no Flask. `record_event` is the single seam between the Passes domain and this one:
Passes calls it on each purchase. When the domains are split into separate services later, this
call becomes a network/queue message and nothing else about Passes has to change (see ADR-2).
"""
from datetime import datetime, timezone

from analytics import repository


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def record_event(conn, venue_id, event_type, amount_cents):
    """Record one sales event into the Analytics-owned events table.

    This is the only entry point the Passes domain uses to reach Analytics.
    """
    return repository.insert_event(conn, venue_id, event_type, amount_cents, _now_iso())


# --- reporting -------------------------------------------------------------
# All reports read only the events table, so Analytics never depends on the
# Passes schema (ADR-2).

def total_revenue(conn):
    """Total revenue in cents across every purchase (0 when there are none)."""
    return repository.sum_revenue(conn)


def revenue_per_venue(conn):
    """Revenue per venue: [{'venue_id': .., 'revenue_cents': ..}, ...]."""
    rows = repository.revenue_by_venue(conn)
    return [{"venue_id": r["venue_id"], "revenue_cents": r["total"]} for r in rows]


def top_venues(conn, n=3):
    """The n highest-grossing venues, same shape as revenue_per_venue."""
    rows = repository.top_venues_by_revenue(conn, n)
    return [{"venue_id": r["venue_id"], "revenue_cents": r["total"]} for r in rows]


def revenue_per_day(conn):
    """Daily revenue series: [{'day': 'YYYY-MM-DD', 'revenue_cents': ..}, ...]."""
    rows = repository.revenue_by_day(conn)
    return [{"day": r["day"], "revenue_cents": r["total"]} for r in rows]
