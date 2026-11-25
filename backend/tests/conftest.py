import os

import pytest
from fastapi.testclient import TestClient

from typing import Optional

from fastapi import Header, HTTPException

import app.main as main_module  # loads .env first
from app import auth, seed

# Tests must never poll or message the real Telegram bot, nor see the real demo password / session
# secret / passwordless flag from .env: blank them after .env was loaded.
os.environ["TELEGRAM_BOT_TOKEN"] = ""
os.environ["TARS_DEMO_PASSWORD"] = ""
os.environ["TARS_PASSWORDLESS_LOGIN"] = ""
os.environ["TARS_SESSION_SECRET"] = "test-secret-" + "x" * 32
os.environ["GOOGLE_CALENDAR_ID"] = ""            # tests never touch the real calendar
os.environ["GOOGLE_SERVICE_ACCOUNT_FILE"] = ""
auth.PBKDF2_ITERATIONS = 1_000  # fast hashes in tests; real runs use the default (stored per hash)


def _test_current_user(x_user_id: Optional[str] = Header(None, alias="X-User-Id")):
    """TEST-ONLY identity: installed via app.dependency_overrides below, never in the app itself.
    Lets the behaviour tests say H("S001") instead of logging in. Real token auth is tested in
    test_auth.py, which removes this override (see the `real_auth` fixture)."""
    from app.db import use_db
    from app.models import User
    if not x_user_id:
        raise HTTPException(401, "Missing test identity")
    with use_db() as con:
        row = con.execute(f"{main_module.USER_SELECT} WHERE id = ?", (x_user_id,)).fetchone()
    if row is None:
        raise HTTPException(401, "Unknown user id")
    return User(**dict(row))


def _test_session_claims(x_user_id: Optional[str] = Header(None, alias="X-User-Id")):
    """TEST-ONLY: claims for the test identity (stream-ticket/logout depend on session claims)."""
    u = _test_current_user(x_user_id)
    return {"typ": "session", "sub": u.user_id, "role": u.role, "section": u.section,
            "jti": f"test-{u.user_id}", "exp": 4102444800}


TEST_OVERRIDES = {main_module.current_user: _test_current_user, main_module.session_claims: _test_session_claims}
main_module.app.dependency_overrides.update(TEST_OVERRIDES)


@pytest.fixture
def real_auth():
    """Remove the test identity overrides: requests must carry a real Bearer token."""
    overrides = main_module.app.dependency_overrides
    saved = {k: overrides.pop(k) for k in TEST_OVERRIDES if k in overrides}
    yield
    overrides.update(saved)


@pytest.fixture(scope="session")
def client(tmp_path_factory, monkeypatch_session):
    tmp = tmp_path_factory.mktemp("tars")
    monkeypatch_session.setattr(seed, "DB", tmp / "tars.db")
    monkeypatch_session.setattr(seed, "MOCK", tmp / "mock")  # don't overwrite docs/mock
    seed.main()
    monkeypatch_session.setenv("TARS_DB", str(tmp / "tars.db"))
    monkeypatch_session.setenv("DEMO_DAY", "MON")
    from app.main import app
    return TestClient(app)


@pytest.fixture(scope="session")
def monkeypatch_session():
    mp = pytest.MonkeyPatch()
    yield mp
    mp.undo()


@pytest.fixture
def db(tmp_path, monkeypatch):
    """Fresh seeded DB per test (tools mutate it); yields an open connection."""
    monkeypatch.setattr(seed, "DB", tmp_path / "tars.db")
    monkeypatch.setattr(seed, "MOCK", tmp_path / "mock")
    seed.main()
    monkeypatch.setenv("TARS_DB", str(tmp_path / "tars.db"))
    from app.db import connect
    con = connect()
    yield con
    con.close()


def slot_id(con, section, day, period):
    return con.execute("SELECT id FROM slots WHERE section=? AND day=? AND period=?",
                       (section, day, period)).fetchone()[0]


def seed_name(user_id):
    """Name for an id as configured in seed_data.json (tests never hardcode names)."""
    data = seed.load_data()
    return {u["id"]: u["name"] for u in data["faculty"] + data["students"] + data["hods"]}[user_id]


def H(user_id):
    return {"X-User-Id": user_id}
