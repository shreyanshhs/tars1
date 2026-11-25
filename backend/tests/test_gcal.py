"""Google Calendar sync with the Google client mocked (no network, no real calendar)."""
import logging
import threading
import time
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

import pytest
from conftest import H, slot_id
from fastapi.testclient import TestClient
from test_agent import DEMO, FakeClient, demo_script

from app import agent, bus, gcal, tools

CAL = "test-calendar-id"


class FakeHttpError(Exception):
    def __init__(self, status):
        super().__init__(f"HTTP {status}")
        self.status_code = status


class _Req:
    def __init__(self, fn):
        self.fn = fn

    def execute(self):
        return self.fn()


class FakeEvents:
    """Mimics service.events() with an in-memory calendar."""

    def __init__(self):
        self.store, self.calls, self.n = {"someone-elses-event": {"summary": "Staff meeting"}}, [], 0
        self.fail_insert = self.fail_patch = self.fail_delete = None
        self.delay = 0.0
        self.lock = threading.Lock()

    def _new_id(self):
        with self.lock:
            self.n += 1
            return f"ev{self.n}"

    def insert(self, calendarId, body):
        def run():
            time.sleep(self.delay)
            self.calls.append(("insert", calendarId, None, body))
            if self.fail_insert:
                raise self.fail_insert
            eid = self._new_id()
            self.store[eid] = body
            return {"id": eid, "htmlLink": f"https://calendar.example/event?eid={eid}", **body}
        return _Req(run)

    def patch(self, calendarId, eventId, body):
        def run():
            self.calls.append(("patch", calendarId, eventId, body))
            if self.fail_patch:
                raise self.fail_patch
            if eventId not in self.store:
                raise FakeHttpError(404)
            self.store[eventId] = body
            return {"id": eventId, "htmlLink": f"https://calendar.example/event?eid={eventId}", **body}
        return _Req(run)

    def delete(self, calendarId, eventId):
        def run():
            self.calls.append(("delete", calendarId, eventId, None))
            if self.fail_delete:
                raise self.fail_delete
            if self.store.pop(eventId, None) is None:
                raise FakeHttpError(410)
            return ""
        return _Req(run)

    def of(self, kind):
        return [c for c in self.calls if c[0] == kind]


class FakeService:
    def __init__(self):
        self.ev = FakeEvents()

    def events(self):
        return self.ev


@pytest.fixture
def cal(db, monkeypatch):
    monkeypatch.setenv("GOOGLE_CALENDAR_ID", CAL)
    svc = FakeService()
    c = gcal.Calendar(service=svc)
    monkeypatch.setattr(gcal, "calendar", c)
    monkeypatch.setattr(agent, "make_client", lambda: FakeClient(demo_script(db)))
    yield c, svc.ev
    c.wait_idle()


@pytest.fixture
def api(db):
    from app.main import app
    return TestClient(app)


def run_demo(api, cal_obj):
    bus.recent.clear()
    did = api.post("/api/incidents", json=DEMO, headers=H("H01")).json()["decision_id"]
    cal_obj.wait_idle()
    return did


def steps(did):
    return [m["data"] for m in bus.recent if m["event"] == "agent_step" and m["data"]["decision_id"] == did]


# ---------- event content ----------
def ist(y, m, d, hh=12, mm=0):
    return datetime(y, m, d, hh, mm, tzinfo=ZoneInfo("Asia/Kolkata"))


def test_slot_date_is_next_occurrence():
    wed = ist(2026, 11, 25)                                                    # Wednesday noon
    assert gcal.slot_date("MON", "10:50", wed) == date(2026, 11, 30)           # Monday already passed → next week
    assert gcal.slot_date("FRI", "10:50", wed) == date(2026, 11, 27)           # later this week
    assert gcal.slot_date("THU", "09:55", wed) == date(2026, 11, 26)           # tomorrow
    assert gcal.slot_date("TUE", "15:35", wed) == date(2026, 12, 1)            # yesterday → 6 days ahead
    assert gcal.slot_date("MON", "10:50", ist(2026, 11, 29)) == date(2026, 11, 30)   # Sunday → tomorrow
    assert gcal.slot_date("MON", "10:50", ist(2026, 11, 28)) == date(2026, 11, 30)   # Saturday → Monday


def test_slot_date_today_until_the_period_ends():
    # Monday 23 Nov, DS period P2 = 09:55–10:50
    assert gcal.slot_date("MON", "10:50", ist(2026, 11, 23, 8, 0)) == date(2026, 11, 23)    # before class
    assert gcal.slot_date("MON", "10:50", ist(2026, 11, 23, 10, 0)) == date(2026, 11, 23)   # during class
    assert gcal.slot_date("MON", "10:50", ist(2026, 11, 23, 10, 49)) == date(2026, 11, 23)  # last minute
    assert gcal.slot_date("MON", "10:50", ist(2026, 11, 23, 10, 50)) == date(2026, 11, 30)  # ended → next week
    assert gcal.slot_date("MON", "10:50", ist(2026, 11, 23, 18, 0)) == date(2026, 11, 30)
    assert all(gcal.slot_date(d, "12:00", ist(2026, 11, 25)) >= date(2026, 11, 25) for d in gcal.DAYS)  # never past


def test_slot_date_uses_india_time_not_server_time():
    # 23:30 UTC Sunday = 05:00 IST Monday → Monday's class is today in India
    utc_sun_night = datetime(2026, 11, 22, 23, 30, tzinfo=timezone.utc)
    assert gcal.slot_date("MON", "10:50", utc_sun_night.astimezone(ZoneInfo("Asia/Kolkata"))) == date(2026, 11, 23)


def test_event_body(db):
    ds = tools.get_timetable(section="CSE-A", day="MON", con=db)[1]
    decision = {"id": 7, "status": "pending_ack", "summary": "DS covered", "reasoning": "71% < 75%. " * 400}
    b = gcal.event_body({**ds, "faculty_name": "Sub Name"}, "substituted", decision, "Room 101", now=ist(2026, 11, 25))
    assert b["summary"] == "DS (CSE-A): Sub Name substituting"
    assert b["start"] == {"dateTime": "2026-11-30T09:55:00", "timeZone": "Asia/Kolkata"}   # next Monday
    assert b["end"] == {"dateTime": "2026-11-30T10:50:00", "timeZone": "Asia/Kolkata"}
    early_mon = gcal.event_body(ds, "substituted", decision, None, now=ist(2026, 11, 23, 9, 0))
    assert early_mon["start"]["dateTime"] == "2026-11-23T09:55:00"                         # same day, before class
    assert b["location"] == "Room 101 (R101)"
    assert b["description"].startswith("TARS decision #7 (pending_ack)\nDS covered")
    assert len(b["description"]) < 1700                                           # reasoning truncated
    assert b["extendedProperties"]["private"] == {"tars": "1", "tars_slot_id": str(ds["id"]), "tars_decision_id": "7"}
    moved = gcal.event_body(ds, "moved", decision, None, now=ist(2026, 11, 25))
    assert "rescheduled" in moved["summary"] and moved["location"] == "R101"


# ---------- agent → calendar ----------
def test_demo_creates_events_and_sets_calendar_link(api, db, cal):
    c, ev = cal
    did = run_demo(api, c)
    inserts = ev.of("insert")
    assert len(inserts) == 2 and all(x[1] == CAL for x in inserts)
    titles = sorted(x[3]["summary"] for x in inserts)
    assert titles[0].startswith("DS (CSE-A): ") and titles[0].endswith(" substituting")
    assert titles[1].startswith("DSL (CSE-A): ")
    ds = slot_id(db, "CSE-A", "MON", 2)
    ds_body = next(x[3] for x in inserts if x[3]["summary"].startswith("DS ("))
    assert ds_body["start"]["dateTime"].endswith("T09:55:00") and ds_body["start"]["timeZone"] == "Asia/Kolkata"
    assert gcal.slot_date("MON", "10:50").isoformat() in ds_body["start"]["dateTime"]
    assert ds_body["start"]["dateTime"][:10] >= datetime.now(ZoneInfo("Asia/Kolkata")).date().isoformat()  # not in the past
    assert f"TARS decision #{did}" in ds_body["description"]
    ids = dict(db.execute("SELECT id, gcal_event_id FROM slots WHERE gcal_event_id IS NOT NULL").fetchall())
    assert set(ids) == {ds, slot_id(db, "CSE-A", "MON", 1)} and len(set(ids.values())) == 2

    d = tools.get_decision(did, con=db)
    assert d["status"] == "pending_ack" and d["calendar_link"].startswith("https://calendar.example/event?eid=ev")
    assert api.get("/api/decisions", headers=H("H01")).json()[0]["calendar_link"] == d["calendar_link"]
    upd = [m["data"] for m in bus.recent if m["event"] == "decision_updated" and m["data"].get("calendar_link")]
    assert upd and upd[-1]["calendar_link"] == d["calendar_link"]
    s = steps(did)
    assert any(x["text"] == "Calendar: saving 2 event(s) in the background" and x["phase"] == "dispatch" for x in s)
    created = [x for x in s if x["text"].startswith("Calendar event created:")]
    assert len(created) == 2 and all(x["phase"] == "dispatch" for x in created)


def test_later_change_updates_instead_of_duplicating(api, db, cal):
    c, ev = cal
    did = run_demo(api, c)
    ds = slot_id(db, "CSE-A", "MON", 2)
    eid = db.execute("SELECT gcal_event_id FROM slots WHERE id = ?", (ds,)).fetchone()[0]
    c.sync_slots(did, [(ds, "substituted")], ["H01"]).result(5)
    assert len(ev.of("insert")) == 2                                       # no new event
    (patch,) = ev.of("patch")
    assert patch[2] == eid and db.execute("SELECT gcal_event_id FROM slots WHERE id = ?", (ds,)).fetchone()[0] == eid
    assert any(x["text"].startswith("Calendar event updated:") for x in steps(did))


def test_event_deleted_in_google_is_recreated(api, db, cal):
    c, ev = cal
    did = run_demo(api, c)
    ds = slot_id(db, "CSE-A", "MON", 2)
    old = db.execute("SELECT gcal_event_id FROM slots WHERE id = ?", (ds,)).fetchone()[0]
    ev.store.pop(old)                                                       # someone deleted it in Google
    c.sync_slots(did, [(ds, "substituted")], []).result(5)
    new = db.execute("SELECT gcal_event_id FROM slots WHERE id = ?", (ds,)).fetchone()[0]
    assert new != old and new in ev.store and len(ev.of("insert")) == 3


# ---------- never slows down or breaks the agent ----------
def test_slow_calendar_does_not_block_the_agent(api, db, cal):
    c, ev = cal
    ev.delay = 1.5
    t0 = time.time()
    r = api.post("/api/incidents", json=DEMO, headers=H("H01"))
    elapsed = time.time() - t0
    did = r.json()["decision_id"]
    assert elapsed < 1.2, elapsed                                           # agent finished without waiting
    assert tools.get_decision(did, con=db)["status"] == "pending_ack"
    assert tools.get_decision(did, con=db)["calendar_link"] is None         # not yet
    c.wait_idle()
    assert tools.get_decision(did, con=db)["calendar_link"] is not None     # arrives later


def test_api_failure_is_logged_not_raised(api, db, cal, caplog):
    c, ev = cal
    ev.fail_insert = FakeHttpError(500)
    did = run_demo(api, c)
    d = tools.get_decision(did, con=db)
    assert d["status"] == "pending_ack" and d["calendar_link"] is None
    assert db.execute("SELECT COUNT(*) FROM slots WHERE gcal_event_id IS NOT NULL").fetchone()[0] == 0
    assert "Calendar insert failed" in caplog.text and CAL not in caplog.text
    assert any(x["text"].startswith("Calendar: could not save") and x["phase"] == "dispatch" for x in steps(did))


def test_disabled_without_calendar_id(api, db, monkeypatch, caplog):
    monkeypatch.setenv("GOOGLE_CALENDAR_ID", "")
    c = gcal.Calendar()                                                    # no service injected
    monkeypatch.setattr(gcal, "calendar", c)
    monkeypatch.setattr(agent, "make_client", lambda: FakeClient(demo_script(db)))
    did = run_demo(api, c)
    assert tools.get_decision(did, con=db)["status"] == "pending_ack"
    assert not [x for x in steps(did) if x["text"].startswith("Calendar")]
    assert "Google Calendar disabled: GOOGLE_CALENDAR_ID not set" in caplog.text


def test_disabled_when_key_file_missing(db, monkeypatch, caplog, tmp_path):
    monkeypatch.setenv("GOOGLE_CALENDAR_ID", CAL)
    monkeypatch.setenv("GOOGLE_SERVICE_ACCOUNT_FILE", str(tmp_path / "nope.json"))
    c = gcal.Calendar()
    assert c.enabled() is False and c.sync_slots(1, [(1, "substituted")], []) is None
    assert "service account key file not found" in caplog.text
    assert CAL not in caplog.text and "nope.json" not in caplog.text       # no ids or paths in logs


def test_bad_credentials_disable_without_crash(db, monkeypatch, caplog, tmp_path):
    bad = tmp_path / "key.json"
    bad.write_text("{not json")
    monkeypatch.setenv("GOOGLE_CALENDAR_ID", CAL)
    monkeypatch.setenv("GOOGLE_SERVICE_ACCOUNT_FILE", str(bad))
    c = gcal.Calendar()
    assert c.enabled() is False and "could not load Google credentials" in caplog.text


def test_key_path_resolves_from_repo_root_not_cwd(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("GOOGLE_SERVICE_ACCOUNT_FILE", "backend/service-account.json")
    assert gcal.key_file_path() == gcal.ROOT / "backend" / "service-account.json"
    assert gcal.ROOT == gcal.Path(__file__).resolve().parents[2]
    monkeypatch.setenv("GOOGLE_SERVICE_ACCOUNT_FILE", str(tmp_path / "abs.json"))
    assert gcal.key_file_path() == tmp_path / "abs.json"
    monkeypatch.setenv("GOOGLE_SERVICE_ACCOUNT_FILE", "")
    assert gcal.key_file_path() is None


# ---------- demo reset cleans up only TARS events ----------
def test_reset_deletes_only_events_tars_created(api, db, cal, monkeypatch):
    monkeypatch.setenv("TARS_DEMO_MODE", "1")
    c, ev = cal
    run_demo(api, c)
    created = {x for x in ev.store if x.startswith("ev")}
    assert len(created) == 2
    assert api.post("/api/admin/reset-demo", headers=H("H01")).json()["slots"] == 72
    c.wait_idle()
    assert {x[2] for x in ev.of("delete")} == created                      # exactly TARS's events
    assert set(ev.store) == {"someone-elses-event"}                         # other events untouched
    assert db.execute("SELECT COUNT(*) FROM slots WHERE gcal_event_id IS NOT NULL").fetchone()[0] == 0
    run_demo(api, c)                                                         # next run creates fresh events
    assert len([x for x in ev.store if x.startswith("ev")]) == 2


def test_reset_right_after_demo_leaves_no_orphans(api, db, cal, monkeypatch):
    """Reset while event saves are still in flight: it waits for them, then deletes all of them."""
    monkeypatch.setenv("TARS_DEMO_MODE", "1")
    c, ev = cal
    ev.delay = 0.5
    api.post("/api/incidents", json=DEMO, headers=H("H01"))          # saves now running in the background
    assert api.post("/api/admin/reset-demo", headers=H("H01")).status_code == 200
    c.wait_idle()
    assert set(ev.store) == {"someone-elses-event"}                     # both TARS events deleted


def test_reset_survives_calendar_delete_errors(api, db, cal, monkeypatch, caplog):
    monkeypatch.setenv("TARS_DEMO_MODE", "1")
    c, ev = cal
    run_demo(api, c)
    ev.fail_delete = FakeHttpError(503)
    assert api.post("/api/admin/reset-demo", headers=H("H01")).status_code == 200
    c.wait_idle()
    assert "Calendar delete failed" in caplog.text
