"""Agent step phase, nudge management, and event RSVP test suite."""
from datetime import timedelta

import pytest
from conftest import H, slot_id
from fastapi.testclient import TestClient
from test_agent import DEMO, FakeClient, demo_script

from app import actions, agent, bus, tools
from app.db import iso, now


@pytest.fixture
def api(db):
    from app.main import app
    return TestClient(app)


def steps():
    return [m["data"] for m in bus.recent if m["event"] == "agent_step"]


# ---------- 1. phase on agent_step ----------
def test_demo_phases_follow_the_ui_flow(api, db, monkeypatch):
    monkeypatch.setattr(agent, "make_client", lambda: FakeClient(demo_script(db)))
    bus.recent.clear()
    api.post("/api/incidents", json=DEMO, headers=H("H01"))
    s = steps()
    assert all(x["phase"] in agent.PHASES for x in s)
    assert s[0]["step"] == "perceive" and s[0]["phase"] == "signal"
    assert s[-1]["step"] == "done" and s[-1]["phase"] == "escalate"  # waits for HOD

    by_text = lambda prefix: next(x for x in s if x["text"].startswith(prefix))
    assert by_text("get_attendance(")["phase"] == "evaluate"
    assert by_text("find_substitute(DS, MON P2)")["phase"] == "match"
    cons = by_text("Constraints OK")
    assert cons["phase"] == "constraints" and cons["step"] == "reason"
    assert "71% < 75%: cancel blocked" in cons["text"] and "F08 can teach DS" in cons["text"]
    res = by_text("validate_clash(")
    assert res["phase"] == "resolve" and res["step"] == "tool_call" and "OK" in res["text"]
    assert by_text("Change(s) to slot(s)")["phase"] == "escalate"
    assert not any("Committed" in x["text"] for x in s)  # nothing applied before approval
    assert by_text("commit_change(")["phase"] == "dispatch"
    # model commentary takes the current stage: early text = evaluate, closing text = dispatch (no jump back)
    assert by_text("DS is at 71%")["phase"] == "evaluate"
    assert by_text("Both classes covered")["phase"] == "dispatch"

    # first appearance of each phase follows the UI order
    first = {}
    for i, x in enumerate(s):
        first.setdefault(x["phase"], i)
    assert sorted(first, key=first.get) == list(agent.PHASES)


def test_error_run_is_escalate(api, db, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(agent.tools, "find_substitute", lambda *a, **k: None)  # fallback finds nothing either
    monkeypatch.setattr(agent.tools, "propose_reschedule", lambda *a, **k: None)
    bus.recent.clear()
    api.post("/api/incidents", json=DEMO, headers=H("H01"))
    last = steps()[-1]
    assert last["step"] == "error" and last["phase"] == "escalate"


@pytest.fixture
def run(db):
    inc = {"id": 1, "type": "absence", "faculty_id": "F01", "room_id": None, "day": "MON",
           "periods": [1, 2], "note": None, "reported_by": "H01"}
    d = tools.log_decision("absence", "running", None, [], con=db)
    return agent.AgentRun(db, inc, d["id"])


def test_rule_violation_is_constraints(run, db):
    bus.recent.clear()
    r = run.dispatch("commit_change", {"changes": [{"slot_id": slot_id(db, "CSE-A", "MON", 2), "status": "cancelled"}]})
    assert agent.tool_phase("commit_change", r) == "constraints"
    s = steps()
    assert s[-1]["phase"] == "constraints" and s[-1]["text"].startswith("Rule check failed")
    assert agent.tool_phase("commit_change", {"ok": False, "error": "clash"}) == "resolve"
    assert agent.tool_phase("find_free_rooms", []) == "match"
    assert agent.tool_phase("whatever", None) == "evaluate"


def test_cancel_proposal_is_escalate(run, db):
    bus.recent.clear()
    dsl = slot_id(db, "CSE-A", "MON", 1)  # 92%: cancel allowed, goes to HOD
    run.dispatch("commit_change", {"changes": [{"slot_id": dsl, "status": "cancelled"}]})
    run.flush_acts()
    run.finish()
    s = steps()
    assert "cancel allowed" in next(x for x in s if x["phase"] == "constraints")["text"]
    assert [x["phase"] for x in s if x["step"] == "act"] == ["escalate"]
    assert s[-1]["step"] == "done" and s[-1]["phase"] == "escalate"  # unresolved DS → escalated


# ---------- 2. nudge snooze / block ----------
@pytest.fixture
def nudges(db):
    a = actions.create_nudge(db, "S001", "free_slot", "Free slot", "You're free 14:40")
    b = actions.create_nudge(db, "S001", "deadline", "DS due", "Assignment due tomorrow")
    return a, b


def ids(api, uid="S001", path="/api/nudges"):
    body = api.get(path, headers=H(uid)).json()
    return [n["id"] for n in (body["nudges"] if path == "/api/today" else body)]


def test_nudge_new_fields(api, nudges):
    n = api.get("/api/nudges", headers=H("S001")).json()[0]
    assert n["snoozed_until"] is None and n["blocked"] is False


def test_snooze_hides_until_time_passes(api, nudges, monkeypatch):
    a, b = nudges
    t0 = now()
    r = api.post(f"/api/nudges/{a['id']}/snooze", json={"minutes": 30}, headers=H("S001"))
    assert r.status_code == 200
    until = r.json()["snoozed_until"]
    assert iso(t0 + timedelta(minutes=30)) <= until <= iso(now() + timedelta(minutes=30))
    assert ids(api) == [b["id"]] and ids(api, path="/api/today") == [b["id"]]

    import app.main as main
    monkeypatch.setattr(main, "now", lambda: t0 + timedelta(minutes=31))
    assert sorted(ids(api)) == sorted([a["id"], b["id"]])  # back after the snooze


def test_snooze_validation(api, nudges):
    a, _ = nudges
    for bad in ({"minutes": 0}, {"minutes": -5}, {"minutes": 10081}, {}, {"minutes": "soon"}):
        r = api.post(f"/api/nudges/{a['id']}/snooze", json=bad, headers=H("S001"))
        assert r.status_code == 422 and r.json()["error"] == "validation", bad


def test_block_hides_for_good_and_counts_as_acted(api, nudges):
    a, b = nudges
    r = api.post(f"/api/nudges/{a['id']}/block", headers=H("S001"))
    assert r.status_code == 200 and r.json()["blocked"] is True
    assert ids(api) == [b["id"]]
    assert api.get("/api/stats", headers=H("H01")).json()["nudges_acted"] == 1


def test_snooze_block_owner_only(api, nudges):
    a, _ = nudges
    for path, body in ((f"/api/nudges/{a['id']}/snooze", {"minutes": 5}), (f"/api/nudges/{a['id']}/block", None)):
        assert api.post(path, json=body, headers=H("S002")).status_code == 404  # someone else's
        assert api.post(path, json=body, headers=H("H01")).status_code == 404  # even HOD
        assert api.post(path, json=body).status_code == 401
    assert api.post("/api/nudges/9999/block", headers=H("S001")).status_code == 404
    assert len(ids(api)) == 2  # nothing changed


# ---------- 3. event RSVP ----------
def ev(api, uid, eid):
    return next(e for e in api.get("/api/events", headers=H(uid)).json() if e["id"] == eid)


def test_events_have_rsvp_fields(api):
    assert all(e["rsvp"] is False and e["rsvp_count"] == 0 for e in api.get("/api/events", headers=H("S001")).json())


def test_rsvp_flow(api):
    r = api.post("/api/events/1/rsvp", headers=H("S001"))
    assert r.status_code == 200 and (r.json()["rsvp"], r.json()["rsvp_count"]) == (True, 1)
    assert "clashes_with" in r.json() and r.json()["id"] == 1
    assert api.post("/api/events/1/rsvp", headers=H("S001")).json()["rsvp_count"] == 1  # idempotent
    assert (ev(api, "S002", 1)["rsvp"], ev(api, "S002", 1)["rsvp_count"]) == (False, 1)  # per caller
    assert api.post("/api/events/1/rsvp", headers=H("S002")).json()["rsvp_count"] == 2
    assert ev(api, "H01", 1)["rsvp_count"] == 2 and ev(api, "S001", 2)["rsvp_count"] == 0

    r = api.delete("/api/events/1/rsvp", headers=H("S001"))
    assert r.status_code == 200 and (r.json()["rsvp"], r.json()["rsvp_count"]) == (False, 1)
    assert api.delete("/api/events/1/rsvp", headers=H("S001")).json()["rsvp_count"] == 1  # idempotent


def test_rsvp_students_only(api):
    for uid in ("F01", "H01"):
        assert api.post("/api/events/1/rsvp", headers=H(uid)).status_code == 403
        assert api.delete("/api/events/1/rsvp", headers=H(uid)).status_code == 403
    assert api.post("/api/events/1/rsvp").status_code == 401
    assert api.post("/api/events/999/rsvp", headers=H("S001")).status_code == 404
    assert api.delete("/api/events/999/rsvp", headers=H("S001")).status_code == 404


def test_openapi_new_fields_required(api):
    schemas = api.get("/openapi.json").json()["components"]["schemas"]
    assert {"snoozed_until", "blocked"} <= set(schemas["Nudge"]["required"])
    assert {"rsvp", "rsvp_count"} <= set(schemas["Event"]["required"])
    paths = api.get("/openapi.json").json()["paths"]
    assert {"/api/nudges/{nudge_id}/snooze", "/api/nudges/{nudge_id}/block", "/api/events/{event_id}/rsvp"} <= set(paths)
    assert {"post", "delete"} <= set(paths["/api/events/{event_id}/rsvp"])
