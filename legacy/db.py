"""SQLite connection helper and startup schema initialization."""
import os
import sqlite3

import config


def get_connection():
    """Open a connection to the configured SQLite file with row access by name."""
    path = config.get_db_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn=None):
    """Create tables if missing. Safe to call on every startup."""
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, "r", encoding="utf-8") as f:
        script = f.read()
    owns = conn is None
    conn = conn or get_connection()
    conn.executescript(script)
    conn.commit()
    if owns:
        conn.close()
