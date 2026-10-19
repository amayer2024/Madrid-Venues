"""Tests for the auth domain's core logic (register / login / verify_session)."""
from datetime import timedelta

import pytest

from auth import service as auth


def test_register_returns_user_id_and_persists(conn):
    user_id = auth.register(conn, "Dancer@madrid.es", "supersecret")
    assert isinstance(user_id, int)
    row = conn.execute("SELECT email, password_hash FROM users WHERE id = ?", (user_id,)).fetchone()
    assert row["email"] == "dancer@madrid.es"  # normalized to lowercase
    assert row["password_hash"] != "supersecret"  # stored hashed, never plaintext


def test_login_with_correct_password_issues_token(conn):
    auth.register(conn, "user@madrid.es", "supersecret")
    token = auth.login(conn, "user@madrid.es", "supersecret")
    assert token
    assert auth.verify_session(conn, token) is not None


def test_verify_session_rejects_unknown_token(conn):
    assert auth.verify_session(conn, "not-a-real-token") is None
    assert auth.verify_session(conn, None) is None


def test_register_rejects_invalid_email(conn):
    with pytest.raises(auth.AuthError):
        auth.register(conn, "no-at-sign", "supersecret")


def test_register_rejects_short_password(conn):
    with pytest.raises(auth.AuthError):
        auth.register(conn, "user@madrid.es", "short")


def test_register_rejects_duplicate_email(conn):
    auth.register(conn, "dup@madrid.es", "supersecret")
    with pytest.raises(auth.AuthError):
        auth.register(conn, "DUP@madrid.es", "supersecret")  # case-insensitive duplicate


def test_login_with_wrong_password_raises(conn):
    auth.register(conn, "user@madrid.es", "supersecret")
    with pytest.raises(auth.AuthError):
        auth.login(conn, "user@madrid.es", "wrongpassword")


def test_login_unknown_email_raises(conn):
    with pytest.raises(auth.AuthError):
        auth.login(conn, "ghost@madrid.es", "supersecret")


def test_verify_session_rejects_expired_token(conn):
    auth.register(conn, "user@madrid.es", "supersecret")
    token = auth.login(conn, "user@madrid.es", "supersecret")
    # Force the session to look expired, then confirm it is rejected and purged.
    past = (auth._now() - timedelta(seconds=1)).isoformat()
    conn.execute("UPDATE sessions SET expires_at = ? WHERE token = ?", (past, token))
    conn.commit()
    assert auth.verify_session(conn, token) is None
    assert conn.execute("SELECT 1 FROM sessions WHERE token = ?", (token,)).fetchone() is None
