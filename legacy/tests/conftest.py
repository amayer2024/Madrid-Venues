"""Shared test fixtures: a throwaway SQLite database per test, isolated via DATA_DIR."""
import pytest

import db


@pytest.fixture
def conn(tmp_path, monkeypatch):
    """A connection to a fresh, schema-initialized SQLite file under a temp DATA_DIR."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    connection = db.get_connection()
    db.init_db(connection)
    yield connection
    connection.close()
