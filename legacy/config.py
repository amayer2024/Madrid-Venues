"""Runtime configuration, read entirely from environment variables (deployment contract §7)."""
import os


def get_port():
    return int(os.environ.get("PORT", "8000"))


def get_data_dir():
    return os.environ.get("DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))


def get_db_path():
    return os.path.join(get_data_dir(), "lineskip.db")
