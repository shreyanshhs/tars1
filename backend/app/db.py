"""SQLite access for TARS. One connection per request; path overridable via TARS_DB (used by tests)."""
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Iterator, Optional

DEFAULT_DB = Path(__file__).resolve().parents[1] / "tars.db"
DAYS = ["MON", "TUE", "WED", "THU", "FRI"]


def db_path() -> Path:
    return Path(os.environ.get("TARS_DB", DEFAULT_DB))


def connect() -> sqlite3.Connection:
    # check_same_thread=False: FastAPI may run a sync dependency and the endpoint on different threads.
    con = sqlite3.connect(db_path(), check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


@contextmanager
def use_db(con: Optional[sqlite3.Connection] = None) -> Iterator[sqlite3.Connection]:
    """Yield `con` if given, else open a connection and close it afterwards."""
    if con is not None:
        yield con
        return
    own = connect()
    try:
        yield own
    finally:
        own.close()


def period_numbers(con: sqlite3.Connection) -> list[int]:
    """Periods of the seeded timetable (6 by default, 7 for BMSIT)."""
    return [r[0] for r in con.execute("SELECT period FROM periods ORDER BY period")]


def ensure_tables() -> None:
    """Add tables that a tars.db seeded by an older version doesn't have yet (nothing else is touched)."""
    sql = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8")
    with use_db() as con, con:
        if con.execute("SELECT 1 FROM sqlite_master WHERE name = 'decisions'").fetchone():  # seeded at all?
            for table in ("applied_changes", "nptel_requests", "nptel_submissions"):
                i = sql.index(f"CREATE TABLE {table} (")
                con.execute(sql[i:sql.index(";", i)].replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS", 1))


def get_db() -> Iterator[sqlite3.Connection]:
    con = connect()
    try:
        yield con
    finally:
        con.close()


def now() -> datetime:
    """Single clock for the app (tests monkeypatch this)."""
    return datetime.now()


def iso(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")


NUDGE_SELECT = "SELECT id, user_id, kind, title, body, created_at, read, snoozed_until, blocked FROM nudges"


def nudge_dict(r: sqlite3.Row) -> dict:
    return {**dict(r), "read": bool(r["read"]), "blocked": bool(r["blocked"])}


# Slot rows joined into the exact contract shape.
SLOT_SELECT = """
SELECT s.id, s.day, s.period, p.start, p.end, s.section, s.subject_code,
       sub.name AS subject_name, s.faculty_id, u.name AS faculty_name, s.room_id, s.status
FROM slots s
JOIN periods p ON p.period = s.period
JOIN subjects sub ON sub.code = s.subject_code
JOIN users u ON u.id = s.faculty_id
"""
SLOT_ORDER = """
ORDER BY CASE s.day WHEN 'MON' THEN 1 WHEN 'TUE' THEN 2 WHEN 'WED' THEN 3
                    WHEN 'THU' THEN 4 ELSE 5 END, s.period, s.section
"""


def fetch_slots(con: sqlite3.Connection, where: str = "", params: tuple = ()) -> list[dict]:
    sql = SLOT_SELECT + (f" WHERE {where}" if where else "") + SLOT_ORDER
    return [dict(r) for r in con.execute(sql, params)]
