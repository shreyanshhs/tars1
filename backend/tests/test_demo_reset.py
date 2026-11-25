"""v0.4: repeatable demo (POST /admin/reset-demo, demo_reset SSE event, GET /meta)."""
import os
from pathlib import Path

import pytest
from conftest import H, seed_name, slot_id
from fastapi.testclient import TestClient
from test_agent import DEMO, FakeClient, demo_script
from test_notify import CHAT, FakeTelegram, link_all
from test_stream import USERS

from app import agent, bus, notify, tools
from app import stream as sse


@pytest.fixture
def api(db):
    from app.main import app
    return TestClient(app)


@pytest.fixture
def tg(db, monkeypatch):
    fake = FakeTelegram()
    n = notify.Notifier(sender=fake)
    n.start_scheduler()
    monkeypatch.setattr(notify, "notifier", n)
    monkeypatch.setattr(agent, "make_client", lambda: FakeClient(demo_script(db)))
    yield fake, n
    n.scheduler.shutdown(wait=False)


@pytest.fixture
def demo_on(monkeypatch):
    monkeypatch.setenv("TARS_DEMO_MODE", "1")


def reset(api, uid="H01"):
    return api.post("/api/admin/reset-demo", headers=H(uid) if uid else {})


def count(db, table):
    return db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


# ---------- gating ----------
@pytest.mark.parametrize("value", [None, "", "0", "true", "yes"])
def test_reset_is_404_unless_demo_mode_is_exactly_1(api, monkeypatch, value):
    if value is None:
        monkeypatch.delenv("TARS_DEMO_MODE", raising=False)
    else:
        monkeypatch.setenv("TARS_DEMO_MODE", value)
    for uid in ("H01", "S001", None):  # 404 for everyone, before auth: the endpoint "doesn't exist"
        r = reset(api, uid)
        assert r.status_code == 404 and r.json()["error"] == "not_found"


def test_reset_hod_only(api, demo_on):
    assert reset(api, None).status_code == 401
    for uid in ("S001", "F01", "F08"):
        r = reset(api, uid)
        assert r.status_code == 403 and r.json()["error"] == "forbidden"
    r = reset(api)
    assert r.status_code == 200 and r.json() == {"status": "reset", "slots": 72}


# ---------- the reset itself ----------
def test_reset_restores_everything_but_keeps_telegram_links(api, db, tg, demo_on):
    fake, n = tg
    fresh_slots = tools.get_timetable(con=db)
    link_all(n)
    db.execute("UPDATE users SET telegram_chat_id = '555' WHERE id = 'S001'")
    db.commit()

    # make a mess: demo incident (+ Telegram requests + timer), RSVP, snooze, rename
    did = api.post("/api/incidents", json=DEMO, headers=H("H01")).json()["decision_id"]
    assert tools.get_decision(did, con=db)["status"] == "pending_ack"
    assert n.scheduler.get_job(f"escalate-{did}") is not None
    old_rid = db.execute("SELECT id FROM ack_requests WHERE faculty_id = 'F08'").fetchone()[0]
    api.post("/api/events/1/rsvp", headers=H("S001"))
    nid = api.get("/api/nudges", headers=H("S001")).json()[0]["id"]
    api.post(f"/api/nudges/{nid}/snooze", json={"minutes": 30}, headers=H("S001"))
    api.patch("/api/faculty/F08", json={"name": "Renamed"}, headers=H("H01"))
    assert tools.get_timetable(con=db) != fresh_slots

    env = Path(__file__).resolve().parents[2] / ".env"
    env_mtime = env.stat().st_mtime if env.exists() else None
    bus.recent.clear()
    assert reset(api).json() == {"status": "reset", "slots": 72}

    assert tools.get_timetable(con=db) == fresh_slots           # same slots, same ids, all scheduled
    for t in ("incidents", "decisions", "nudges", "event_rsvps", "ack_requests"):
        assert count(db, t) == 0, t
    links = dict(db.execute("SELECT id, telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL").fetchall())
    assert links == {"F07": CHAT["F07"], "F08": CHAT["F08"], "H01": CHAT["H01"], "S001": "555"}
    assert [j.id for j in n.scheduler.get_jobs()] == []          # escalation timers cancelled
    assert next(f for f in api.get("/api/faculty", headers=H("H01")).json() if f["faculty_id"] == "F08")["name"] \
        == seed_name("F08")                                      # seeded names come back
    assert all(e["rsvp_count"] == 0 for e in api.get("/api/events", headers=H("S001")).json())
    assert api.get("/api/stats", headers=H("H01")).json() == {
        "classes_lost": 0, "rescued": 0, "nudges_acted": 0, "avg_response_s": 0}
    assert (env.stat().st_mtime if env.exists() else None) == env_mtime  # .env untouched

    msgs = [m for m in bus.recent if m["event"] == "demo_reset"]
    assert len(msgs) == 1 and msgs[0]["data"] == {} and msgs[0]["everyone"]
    assert all(sse.can_see(u, msgs[0]) for u in USERS.values())   # every role/section receives it

    # a stale Accept button from before the reset must not act on anything
    assert "no longer exists" in n.handle_button(CHAT["F08"], f"ack:{old_rid}")
    assert fake.to(CHAT["H01"]) == []                            # nothing escalated by the reset


def test_demo_works_again_after_reset(api, db, tg, demo_on):
    fake, n = tg
    link_all(n)
    for run in (1, 2, 3):
        fake.sent.clear()
        r = api.post("/api/incidents", json=DEMO, headers=H("H01"))
        assert r.status_code == 202, run
        did = r.json()["decision_id"]
        assert did == 1                                           # ids restart: same demo every time
        assert tools.get_decision(did, con=db)["status"] == "pending_ack"
        ds = next(s for s in tools.get_timetable(section="CSE-A", day="MON", con=db) if s["period"] == 2)
        assert ds["id"] == slot_id(db, "CSE-A", "MON", 2) == 23 and ds["faculty_id"] == "F08"
        assert {m["chat_id"] for m in fake.sent} == {CHAT["F07"], CHAT["F08"]}  # phones still linked
        rid = db.execute("SELECT id FROM ack_requests WHERE faculty_id = 'F08'").fetchone()[0]
        assert "confirmed" in n.handle_button(CHAT["F08"], f"ack:{rid}")
        assert reset(api).status_code == 200


def test_reset_without_telegram_or_scheduler(api, db, demo_on, monkeypatch):
    monkeypatch.setattr(notify, "notifier", notify.Notifier())  # token off, scheduler never started
    monkeypatch.setattr(agent, "make_client", lambda: FakeClient(demo_script(db)))
    api.post("/api/incidents", json=DEMO, headers=H("H01"))
    assert reset(api).json()["slots"] == 72 and count(db, "decisions") == 0


def test_reset_reaches_live_sse_clients(demo_on, db):
    """demo_reset goes out on the stream to a student in an unrelated section (proves 'everyone')."""
    import asyncio
    from app.main import app

    async def scenario():
        gen = sse.event_stream(USERS["S002"])
        nxt = asyncio.ensure_future(gen.__anext__())
        await asyncio.sleep(0.05)                                  # subscribed
        await asyncio.to_thread(lambda: TestClient(app).post("/api/admin/reset-demo", headers=H("H01")))
        ev = await asyncio.wait_for(nxt, 5)
        await gen.aclose()
        return ev

    ev = asyncio.run(scenario())
    assert ev.event == "demo_reset" and ev.data == "{}"


# ---------- /meta ----------
def test_meta(api, monkeypatch):
    monkeypatch.delenv("TARS_DEMO_MODE", raising=False)
    m = api.get("/api/meta", headers=H("S001")).json()
    assert m["demo_mode"] is False
    assert m["days"] == ["MON", "TUE", "WED", "THU", "FRI"]
    assert [p["period"] for p in m["periods"]] == [1, 2, 3, 4, 5, 6]
    assert m["periods"][1] == {"period": 2, "start": "09:55", "end": "10:50"}
    assert m["incident_types"] == ["absence", "room_unavailable"]
    monkeypatch.setenv("TARS_DEMO_MODE", "1")
    assert api.get("/api/meta", headers=H("F01")).json()["demo_mode"] is True
    assert api.get("/api/meta").status_code == 401


def test_422_detail_is_user_safe(api):
    """Contract v0.4: 422 detail is plain text that's safe to show (no traceback, no internals)."""
    cases = [
        api.post("/api/incidents", json={**DEMO, "faculty_id": "F08", "periods": [2]}, headers=H("H01")),
        api.post("/api/incidents", json={**DEMO, "periods": [9]}, headers=H("H01")),
        api.post("/api/incidents", json={**DEMO, "day": "SUN"}, headers=H("H01")),
        api.patch("/api/faculty/F08", json={"name": " "}, headers=H("H01")),
    ]
    for r in cases:
        body = r.json()
        assert r.status_code == 422 and body["error"] == "validation" and set(body) == {"error", "detail"}
        assert isinstance(body["detail"], str) and body["detail"]
        assert not any(bad in body["detail"] for bad in ("Traceback", "File \"", "sqlite", ".py", "/Users/"))
