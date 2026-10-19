"""Auth domain: user registration, login, and session-token verification.

Pure business logic — no Flask imports — so it can be unit-tested directly against a SQLite
connection. The Flask glue (the require_auth decorator) lives in app.py.
"""
import secrets
from datetime import datetime, timedelta, timezone

from werkzeug.security import check_password_hash, generate_password_hash

SESSION_TTL = timedelta(days=7)


class AuthError(Exception):
    """Raised when registration or login fails for a caller-visible reason."""


def _now():
    return datetime.now(timezone.utc)


def register(conn, email, password):
    """Create a user with a hashed password. Returns the new user's id.

    Raises AuthError on blank input or a duplicate email.
    """
    email = (email or "").strip().lower()
    if not email or "@" not in email:
        raise AuthError("a valid email is required")
    if not password or len(password) < 8:
        raise AuthError("password must be at least 8 characters")

    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing is not None:
        raise AuthError("email is already registered")

    cur = conn.execute(
        "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
        (email, generate_password_hash(password), _now().isoformat()),
    )
    conn.commit()
    return cur.lastrowid


def login(conn, email, password):
    """Verify credentials and issue a session token. Raises AuthError on bad credentials."""
    email = (email or "").strip().lower()
    row = conn.execute(
        "SELECT id, password_hash FROM users WHERE email = ?", (email,)
    ).fetchone()
    if row is None or not check_password_hash(row["password_hash"], password or ""):
        raise AuthError("invalid email or password")
    return _create_session(conn, row["id"])


def _create_session(conn, user_id):
    token = secrets.token_urlsafe(32)
    now = _now()
    conn.execute(
        "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (token, user_id, now.isoformat(), (now + SESSION_TTL).isoformat()),
    )
    conn.commit()
    return token


def verify_session(conn, token):
    """Return the user_id for a valid, unexpired token, or None otherwise."""
    if not token:
        return None
    row = conn.execute(
        "SELECT user_id, expires_at FROM sessions WHERE token = ?", (token,)
    ).fetchone()
    if row is None:
        return None
    if datetime.fromisoformat(row["expires_at"]) < _now():
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        return None
    return row["user_id"]
