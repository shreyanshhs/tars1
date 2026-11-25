import os

import pytest
from conftest import H, slot_id
from fastapi.testclient import TestClient
from google.genai import types

from app import agent, bus, tools

DEMO = {"type": "absence", "faculty_id": "F01", "day": "MON", "periods": [1, 2], "note": "Fever"}


# ---------- fake Gemini ----------
def fc(name, **args):
    return types.Part(function_call=types.FunctionCall(name=name, args=args))


def text(t):
    return types.Part.from_text(text=t)


def last_results(contents):
    """Function results the agent sent back in the previous turn, by tool name."""
    return {p.function_response.name: p.function_response.response["result"] for p in contents[-1].parts}


class FakeClient:
    def __init__(self, script):
        self.models = self
        self.script = list(script)
        self.seen = []

    def generate_content(self, model, contents, config):
        self.seen.append(list(contents))
        step = self.script.pop(0)
        if isinstance(step, Exception):
            raise step
        parts = step(contents) if callable(step) else step
        return types.GenerateContentResponse(
            candidates=[types.Candidate(content=types.Content(role="model", parts=parts))])


def demo_script(con):
    ds, dsl = slot_id(con, "CSE-A", "MON", 2), slot_id(con, "CSE-A", "MON", 1)
    return [
        [fc("get_attendance", section="CSE-A", subject_code="DS"),
         fc("get_attendance", section="CSE-A", subject_code="DSL")],
        [text("DS is at 71%, below 75%, so cancel is not an option. Looking for substitutes."),
         fc("find_substitute", subject_code="DS", day="MON", period=2, exclude=["F01"])],
        lambda c: [fc("find_substitute", subject_code="DSL", day="MON", period=1, exclude=["F01"])],
        # commit what find_substitute actually returned (like a real model would)
        lambda c: [fc("commit_change", changes=[
            {"slot_id": ds, "faculty_id": c[-3].parts[0].function_response.response["result"]["faculty_id"]},
            {"slot_id": dsl, "faculty_id": last_results(c)["find_substitute"]["faculty_id"]}])],
        [fc("log_decision", summary="F01 absent MON: CSE-A DS → F08, DSL → F07",
            reasoning="CSE-A DS attendance is 71% (<75%), so cancelling was rejected. F08 teaches DS, "
                      "is free MON P2 and has the lowest load (5).")],
        [text("Both classes covered.")],
    ]


@pytest.fixture
def api(db):
    from app.main import app
    return TestClient(app)


@pytest.fixture
def fake(monkeypatch):
    holder = {}

    def install(script):
        holder["client"] = FakeClient(script)
        monkeypatch.setattr(agent, "make_client", lambda: holder["client"])
        return holder["client"]
    return install


# ---------- the demo ----------
def test_demo_f01_absent_ends_with_f08_on_ds(api, db, fake):
    fake(demo_script(db))
    bus.recent.clear()
    r = api.post("/api/incidents", json=DEMO, headers=H("H01"))
    assert r.status_code == 202 and r.json()["status"] == "agent_running"
    did = r.json()["decision_id"]

    ds = next(s for s in tools.get_timetable(section="CSE-A", day="MON", con=db) if s["period"] == 2)
    assert (ds["faculty_id"], ds["status"]) == ("F08", "replanned")
    dsl = next(s for s in tools.get_timetable(section="CSE-A", day="MON", con=db) if s["period"] == 1)
    assert dsl["faculty_id"] == "F07"  # teaches DSL, free MON P1, lowest load

    d = api.get("/api/decisions", headers=H("H01")).json()[0]
    assert d["id"] == did and d["status"] == "pending_ack" and "71%" in d["reasoning"]
    assert sorted(d["affected_slot_ids"]) == sorted([ds["id"], dsl["id"]])

    nudges = api.get("/api/nudges", headers=H("S001")).json()
    assert len(nudges) == 2 and all(n["kind"] == "replan" for n in nudges)
    assert api.get("/api/nudges", headers=H("F08")).json()[0]["title"] == "You're covering a class"
    assert api.get("/api/nudges", headers=H("S002")).json() == []

    events = [m["event"] for m in bus.recent]
    steps = [m["data"]["step"] for m in bus.recent if m["event"] == "agent_step"]
    assert {"timetable_updated", "nudge_created", "decision_updated"} <= set(events)
    assert steps[0] == "perceive" and steps[-1] == "done" and {"reason", "tool_call", "act"} <= set(steps)
    assert any(m["data"]["text"].startswith("find_substitute(DS, MON P2) -> ") and m["data"]["text"].endswith("(load 5)")
               for m in bus.recent if m["event"] == "agent_step")
    assert api.get("/api/stats", headers=H("H01")).json()["rescued"] == 1


# ---------- failure modes ----------
def test_missing_key_logs_clean_error_and_does_not_crash(api, db, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    before = tools.get_timetable(con=db)
    r = api.post("/api/incidents", json=DEMO, headers=H("F01"))
    assert r.status_code == 202
    d = api.get("/api/decisions", headers=H("H01")).json()[0]
    assert d["status"] == "escalated" and "GEMINI_API_KEY is not set" in d["summary"]
    assert tools.get_timetable(con=db) == before
    assert api.get("/api/me", headers=H("S001")).status_code == 200  # server alive


def test_gemini_error_midway_keeps_commits_and_escalates(api, db, fake):
    script = demo_script(db)[:4] + [RuntimeError("503 UNAVAILABLE")]
    fake(script)
    api.post("/api/incidents", json=DEMO, headers=H("H01"))
    d = api.get("/api/decisions", headers=H("H01")).json()[0]
    assert d["status"] == "escalated" and "503 UNAVAILABLE" in d["summary"]
    assert "substituted" in d["reasoning"]  # what it managed is recorded
    assert tools.get_timetable(faculty_id="F08", day="MON", con=db)  # the commit stayed


def test_overloaded_model_falls_back_to_next(api, db, fake, monkeypatch):
    from google.genai import errors
    monkeypatch.setenv("GEMINI_MODEL", "busy-model,backup-model")
    overloaded = errors.ServerError(503, {"error": {"code": 503, "message": "high demand", "status": "UNAVAILABLE"}})
    client = fake([overloaded] + demo_script(db))
    models_used = []
    orig = client.generate_content
    client.generate_content = lambda model, contents, config: (models_used.append(model), orig(model, contents, config))[1]
    api.post("/api/incidents", json=DEMO, headers=H("H01"))
    assert api.get("/api/decisions", headers=H("H01")).json()[0]["status"] == "pending_ack"
    assert models_used[:2] == ["busy-model", "backup-model"] and set(models_used[1:]) == {"backup-model"}


def test_non_transient_error_does_not_fall_back(api, db, fake, monkeypatch):
    from google.genai import errors
    monkeypatch.setenv("GEMINI_MODEL", "a,b")
    fake([errors.ClientError(400, {"error": {"code": 400, "message": "bad request", "status": "INVALID_ARGUMENT"}})])
    api.post("/api/incidents", json=DEMO, headers=H("H01"))
    d = api.get("/api/decisions", headers=H("H01")).json()[0]
    assert d["status"] == "escalated" and "400" in d["summary"]


def test_model_that_never_stops_is_cut_off(api, db, fake):
    fake([[fc("get_attendance", section="CSE-A", subject_code="DS")]] * agent.MAX_TURNS)
    api.post("/api/incidents", json=DEMO, headers=H("H01"))
    d = api.get("/api/decisions", headers=H("H01")).json()[0]
    assert d["status"] == "escalated" and "did not finish" in d["summary"]


# ---------- rules enforced in code ----------
@pytest.fixture
def run(db):
    inc = {"id": 1, "type": "absence", "faculty_id": "F01", "room_id": None, "day": "MON",
           "periods": [1, 2], "note": None, "reported_by": "H01"}
    d = tools.log_decision("absence", "running", None, [], con=db)
    return agent.AgentRun(db, inc, d["id"])


def test_rule_no_cancel_below_75_before_trying(run, db):
    ds = slot_id(db, "CSE-A", "MON", 2)
    r = run.dispatch("commit_change", {"changes": [{"slot_id": ds, "status": "cancelled"}]})
    assert r["ok"] is False and "71" in r["detail"] and "find_substitute" in r["detail"]
    run.no_substitute.add(ds)
    assert run.dispatch("commit_change", {"changes": [{"slot_id": ds, "status": "cancelled"}]})["ok"] is False
    run.no_reschedule.add(ds)  # both failed → now allowed (as a proposal)
    r = run.dispatch("commit_change", {"changes": [{"slot_id": ds, "status": "cancelled"}]})
    assert r["ok"] and r["awaiting_hod_approval"] == [ds]


def test_rule_no_swaps(run, db):
    ds, dsl = slot_id(db, "CSE-A", "MON", 2), slot_id(db, "CSE-A", "MON", 1)
    r = run.dispatch("commit_change", {"changes": [
        {"slot_id": ds, "period": 1, "faculty_id": "F08"}, {"slot_id": dsl, "period": 2, "faculty_id": "F07"}]})
    assert r["ok"] is False and "swaps are not allowed" in r["detail"]
    assert tools.get_timetable(faculty_id="F08", day="MON", con=db)[0]["period"] != 2  # unchanged


def test_rule_guards(run, db):
    ds = slot_id(db, "CSE-A", "MON", 2)
    other = slot_id(db, "CSE-B", "MON", 2)
    assert "not affected" in run.dispatch("commit_change", {"changes": [{"slot_id": other, "faculty_id": "F08"}]})["detail"]
    assert "cannot teach" in run.dispatch("commit_change", {"changes": [{"slot_id": ds, "faculty_id": "F03"}]})["detail"]
    assert "absent on MON" in run.dispatch("commit_change", {"changes": [{"slot_id": ds, "period": 6}]})["detail"]
    assert run.dispatch("find_substitute", {"subject_code": "DS", "day": "MON", "period": 2})["faculty_id"] == "F08"
    assert run.dispatch("nope", {})["error"].startswith("unknown tool")
    assert run.dispatch("get_attendance", {"section": "CSE-A"})["error"].startswith("bad arguments")


def test_substitution_with_echoed_day_period_is_still_a_substitution(run, db):
    # real Gemini echoes unchanged fields; that must not count as a move
    ds = slot_id(db, "CSE-A", "MON", 2)
    assert run.dispatch("commit_change", {"changes": [
        {"slot_id": ds, "faculty_id": "F08", "day": "MON", "period": 2, "room_id": "R101"}]})["ok"]
    assert run.handled[ds] == "substituted"


def test_step_text_format(api, db, fake):
    fake(demo_script(db))
    bus.recent.clear()
    api.post("/api/incidents", json=DEMO, headers=H("H01"))
    steps = [(m["data"]["step"], m["data"]["text"]) for m in bus.recent if m["event"] == "agent_step"]
    assert any(s == "tool_call" and t.startswith("find_substitute(DS, MON P2) -> ") and t.endswith("(load 5)")
               for s, t in steps)
    i = next(i for i, (s, t) in enumerate(steps) if t.startswith("commit_change"))
    assert steps[i + 1][0] == "act"  # act follows its tool_call


def test_reschedule_for_absence_avoids_absence_day(run, db):
    ds = slot_id(db, "CSE-A", "MON", 2)
    p = run.dispatch("propose_reschedule", {"slot_id": ds})
    assert p["to"]["day"] != "MON"
    r = run.dispatch("commit_change", {"changes": [p["change"]]})
    assert r["ok"] and run.handled[ds] == "moved"


# ---------- approve / reject / nudges ----------
def _proposed_cancel(run, db):
    dsl = slot_id(db, "CSE-A", "MON", 1)  # DSL attendance 92% → cancel allowed as a proposal
    assert run.dispatch("commit_change", {"changes": [{"slot_id": dsl, "status": "cancelled"}]})["ok"]
    ds = slot_id(db, "CSE-A", "MON", 2)
    assert run.dispatch("commit_change", {"changes": [{"slot_id": ds, "faculty_id": "F08"}]})["ok"]
    d = run.finish()
    assert d["status"] == "proposed"
    return d, dsl


def test_approve_applies_proposed_cancellation(api, run, db):
    d, dsl = _proposed_cancel(run, db)
    assert api.post(f"/api/decisions/{d['id']}/approve", headers=H("F01")).status_code == 403
    r = api.post(f"/api/decisions/{d['id']}/approve", headers=H("H01"))
    assert r.status_code == 200 and r.json()["status"] == "committed"
    assert db.execute("SELECT status FROM slots WHERE id = ?", (dsl,)).fetchone()[0] == "cancelled"
    assert any("cancelled" in n["body"] for n in api.get("/api/nudges", headers=H("S001")).json())
    r = api.post(f"/api/decisions/{d['id']}/approve", headers=H("H01"))
    assert r.status_code == 409 and r.json()["error"] == "invalid_state"


def test_reject_leaves_timetable(api, run, db):
    d, dsl = _proposed_cancel(run, db)
    r = api.post(f"/api/decisions/{d['id']}/reject", headers=H("H01"))
    assert r.status_code == 200 and r.json()["status"] == "rejected"
    assert db.execute("SELECT status FROM slots WHERE id = ?", (dsl,)).fetchone()[0] == "scheduled"
    assert api.post("/api/decisions/999/reject", headers=H("H01")).status_code == 404


def test_approve_pending_ack_acknowledges(api, db, fake):
    fake(demo_script(db))
    did = api.post("/api/incidents", json=DEMO, headers=H("H01")).json()["decision_id"]
    assert api.post(f"/api/decisions/{did}/reject", headers=H("H01")).status_code == 409
    assert api.post(f"/api/decisions/{did}/approve", headers=H("H01")).json()["status"] == "acknowledged"


def test_incident_validation(api):
    assert api.post("/api/incidents", json=DEMO, headers=H("S001")).status_code == 403
    assert api.post("/api/incidents", json={**DEMO, "faculty_id": "F99"}, headers=H("H01")).status_code == 422
    r = api.post("/api/incidents", json={**DEMO, "faculty_id": "F08", "periods": [2]}, headers=H("H01"))
    assert r.status_code == 422 and "No scheduled classes" in r.json()["detail"]
    r = api.post("/api/incidents", json={"type": "room_unavailable", "day": "MON", "periods": [1]}, headers=H("H01"))
    assert r.status_code == 422


def test_nudge_read(api, db, fake):
    fake(demo_script(db))
    api.post("/api/incidents", json=DEMO, headers=H("H01"))
    n = api.get("/api/nudges", headers=H("S001")).json()[0]
    assert api.post(f"/api/nudges/{n['id']}/read", headers=H("S002")).status_code == 404  # not theirs
    r = api.post(f"/api/nudges/{n['id']}/read", headers=H("S001"))
    assert r.status_code == 200 and r.json()["read"] is True
    assert api.get("/api/stats", headers=H("H01")).json()["nudges_acted"] == 1


# ---------- real Gemini (opt-in: TARS_LIVE=1) ----------
@pytest.mark.skipif(os.environ.get("TARS_LIVE") != "1", reason="set TARS_LIVE=1 to call real Gemini")
def test_live_demo_with_gemini(api, db):
    from pathlib import Path
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    did = api.post("/api/incidents", json=DEMO, headers=H("H01")).json()["decision_id"]
    d = tools.get_decision(did, con=db)
    print("\nLIVE decision:", d["status"], "|", d["summary"], "\n", d["reasoning"])
    for m in bus.recent:
        if m["event"] == "agent_step" and m["data"]["decision_id"] == did:
            print(f"  [{m['data']['step']}] {m['data']['text']}")
    ds = next(s for s in tools.get_timetable(section="CSE-A", day="MON", con=db) if s["period"] == 2)
    assert ds["faculty_id"] == "F08"
