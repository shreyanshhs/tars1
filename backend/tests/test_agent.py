import os

import pytest
from conftest import H, approve, slot_id
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
    assert api.get("/api/decisions", headers=H("H01")).json()[0]["status"] == "proposed"
    assert approve(api, did)["status"] == "committed"

    ds = next(s for s in tools.get_timetable(section="CSE-A", day="MON", con=db) if s["period"] == 2)
    assert (ds["faculty_id"], ds["status"]) == ("F08", "replanned")
    dsl = next(s for s in tools.get_timetable(section="CSE-A", day="MON", con=db) if s["period"] == 1)
    assert dsl["faculty_id"] == "F07"  # teaches DSL, free MON P1, lowest load

    d = api.get("/api/decisions", headers=H("H01")).json()[0]
    assert d["id"] == did and d["status"] == "committed" and "71%" in d["reasoning"] and d["summary"].startswith("[Gemini]")
    assert sorted(d["affected_slot_ids"]) == sorted([ds["id"], dsl["id"]])

    nudges = api.get("/api/nudges", headers=H("S001")).json()
    assert len(nudges) == 2 and all(n["kind"] == "replan" for n in nudges)
    assert api.get("/api/nudges", headers=H("F08")).json()[0]["title"] == "HOD approved you as substitute: not confirmed"
    assert api.get("/api/nudges", headers=H("S002")).json() == []

    events = [m["event"] for m in bus.recent]
    steps = [m["data"]["step"] for m in bus.recent if m["event"] == "agent_step"]
    assert {"timetable_updated", "nudge_created", "decision_updated"} <= set(events)
    assert steps[0] == "perceive" and "done" in steps and steps[-1] == "act" and {"reason", "tool_call", "act"} <= set(steps)
    assert any(m["data"]["text"].startswith("find_substitute(DS, MON P2) -> ") and m["data"]["text"].endswith("(load 5)")
               for m in bus.recent if m["event"] == "agent_step")
    assert api.get("/api/stats", headers=H("H01")).json()["rescued"] == 0   # nobody confirmed (Telegram off)
    assert kpis(api)["pending_confirmation"] == 1 and "NOT CONFIRMED" in decision(api)["reasoning"]


# ---------- failure modes ----------
def decision(api):
    return api.get("/api/decisions", headers=H("H01")).json()[0]


def is_fallback(d, reason):
    return (d["status"] == "proposed" and d["summary"].startswith("[Rule-based fallback]")
            and "[Gemini]" not in d["summary"] and reason in d["reasoning"])


def test_missing_key_uses_fallback_and_changes_nothing(api, db, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    before = tools.get_timetable(con=db)
    r = api.post("/api/incidents", json=DEMO, headers=H("F01"))
    assert r.status_code == 202
    d = decision(api)
    assert is_fallback(d, "GEMINI_API_KEY is not set")
    assert tools.get_timetable(con=db) == before
    approve(api, d["id"])
    got = {s["period"]: s["faculty_id"] for s in tools.get_timetable(section="CSE-A", day="MON", con=db)}
    assert (got[1], got[2]) == ("F07", "F08")  # same answer as the existing substitute finder
    assert api.get("/api/me", headers=H("S001")).status_code == 200  # server alive


def test_gemini_error_midway_discards_its_proposals_and_falls_back(api, db, fake):
    before = tools.get_timetable(con=db)
    fake(demo_script(db)[:4] + [RuntimeError("503 UNAVAILABLE")])
    api.post("/api/incidents", json=DEMO, headers=H("H01"))
    assert is_fallback(decision(api), "503 UNAVAILABLE")
    assert tools.get_timetable(con=db) == before


def test_overloaded_model_falls_back_to_next(api, db, fake, monkeypatch):
    from google.genai import errors
    monkeypatch.setenv("GEMINI_MODEL", "busy-model,backup-model")
    overloaded = errors.ServerError(503, {"error": {"code": 503, "message": "high demand", "status": "UNAVAILABLE"}})
    client = fake([overloaded] + demo_script(db))
    models_used = []
    orig = client.generate_content
    client.generate_content = lambda model, contents, config: (models_used.append(model), orig(model, contents, config))[1]
    api.post("/api/incidents", json=DEMO, headers=H("H01"))
    assert api.get("/api/decisions", headers=H("H01")).json()[0]["summary"].startswith("[Gemini]")
    assert models_used[:2] == ["busy-model", "backup-model"] and set(models_used[1:]) == {"backup-model"}


def test_non_transient_error_does_not_fall_back(api, db, fake, monkeypatch):
    from google.genai import errors
    monkeypatch.setenv("GEMINI_MODEL", "a,b")
    fake([errors.ClientError(400, {"error": {"code": 400, "message": "bad request", "status": "INVALID_ARGUMENT"}})])
    api.post("/api/incidents", json=DEMO, headers=H("H01"))
    assert is_fallback(decision(api), "400")


def test_model_that_never_stops_is_cut_off(api, db, fake):
    fake([[fc("get_attendance", section="CSE-A", subject_code="DS")]] * agent.MAX_TURNS)
    api.post("/api/incidents", json=DEMO, headers=H("H01"))
    assert is_fallback(decision(api), "did not finish")


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


def slots_now(db):
    return tools.get_timetable(con=db)


@pytest.mark.parametrize("gemini", [True, False])
def test_approval_gate(api, db, fake, monkeypatch, gemini):
    if gemini:
        fake(demo_script(db))
    else:
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    before = slots_now(db)
    bus.recent.clear()
    did = api.post("/api/incidents", json=DEMO, headers=H("F01")).json()["decision_id"]
    assert slots_now(db) == before and decision(api)["status"] == "proposed"
    assert not {"timetable_updated", "nudge_created"} & {m["event"] for m in bus.recent}
    for uid in ("S001", "F01", "F08"):
        assert api.post(f"/api/decisions/{did}/approve", headers=H(uid)).status_code == 403
    assert slots_now(db) == before
    assert approve(api, did)["status"] == "committed"
    after = slots_now(db)
    assert after != before
    for action in ("approve", "reject"):  # decided once
        assert api.post(f"/api/decisions/{did}/{action}", headers=H("H01")).json()["error"] == "invalid_state"
    assert slots_now(db) == after


def test_rejection_leaves_everything_unchanged(api, db, fake):
    fake(demo_script(db))
    before = slots_now(db)
    did = api.post("/api/incidents", json=DEMO, headers=H("F01")).json()["decision_id"]
    bus.recent.clear()
    assert api.post(f"/api/decisions/{did}/reject", headers=H("H01")).json()["status"] == "rejected"
    assert slots_now(db) == before
    assert api.post(f"/api/decisions/{did}/approve", headers=H("H01")).status_code == 409
    assert slots_now(db) == before and {m["event"] for m in bus.recent} == {"decision_updated"}
    assert db.execute("SELECT COUNT(*) FROM nudges").fetchone()[0] == 0


def test_failed_approval_rolls_back_slots_and_status(api, db, fake):
    fake(demo_script(db))
    did = api.post("/api/incidents", json=DEMO, headers=H("F01")).json()["decision_id"]
    before = slots_now(db)
    dsl = slot_id(db, "CSE-A", "MON", 1)
    with db:  # second slot's update fails after the first went through
        db.execute(f"CREATE TRIGGER boom BEFORE UPDATE ON slots WHEN OLD.id = {dsl} BEGIN SELECT RAISE(ABORT, 'x'); END")
    r = api.post(f"/api/decisions/{did}/approve", headers=H("H01"))
    assert (r.status_code, r.json()["error"]) == (409, "clash")
    assert slots_now(db) == before and decision(api)["status"] == "proposed"
    with db:
        db.execute("DROP TRIGGER boom")
    assert approve(api, did)["status"] == "committed"  # still approvable


def test_clash_since_proposal_is_refused(api, db, fake):
    fake(demo_script(db))
    did = api.post("/api/incidents", json=DEMO, headers=H("F01")).json()["decision_id"]
    with db:  # the proposed substitute got another class at that time
        db.execute("UPDATE slots SET day = 'MON', period = 2, faculty_id = 'F08' WHERE id = "
                   "(SELECT id FROM slots WHERE section = 'CSE-B' AND day = 'MON' AND period = 2)")
    before = slots_now(db)
    r = api.post(f"/api/decisions/{did}/approve", headers=H("H01"))
    assert (r.status_code, r.json()["error"]) == (409, "clash")
    assert slots_now(db) == before and decision(api)["status"] == "proposed"
    assert api.post(f"/api/decisions/{did}/reject", headers=H("H01")).json()["status"] == "rejected"


def test_second_proposal_for_same_classes_cannot_overwrite_first(api, db, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    a, b = (api.post("/api/incidents", json=DEMO, headers=H("F01")).json()["decision_id"] for _ in range(2))
    approve(api, a)
    after = slots_now(db)
    assert api.post(f"/api/decisions/{b}/approve", headers=H("H01")).status_code == 409
    assert slots_now(db) == after


def test_external_failure_after_approval_does_not_undo_it(api, db, fake, monkeypatch):
    fake(demo_script(db))
    did = api.post("/api/incidents", json=DEMO, headers=H("F01")).json()["decision_id"]
    def boom(*a, **k):
        raise RuntimeError("calendar down")
    monkeypatch.setattr(agent.gcal.calendar, "sync_slots", boom)
    before = slots_now(db)
    assert approve(api, did)["status"] == "committed" and slots_now(db) != before


def test_approve_pending_ack_acknowledges(api, db):
    did = tools.log_decision("absence", "x", "y", [1], status="pending_ack", con=db)["id"]
    assert api.post(f"/api/decisions/{did}/reject", headers=H("H01")).status_code == 409
    assert approve(api, did)["status"] == "acknowledged"


def kpis(api):
    s = api.get("/api/stats", headers=H("H01")).json()
    return {k: s[k] for k in ("rescued", "pending_confirmation", "cancelled", "escalated", "closed_unresolved")}


def kpi(**nonzero):
    return {**dict.fromkeys(("rescued", "pending_confirmation", "cancelled", "escalated", "closed_unresolved"), 0), **nonzero}


SUB, MOVE, CANCEL = "substituted", "moved", "cancelled"


@pytest.mark.parametrize("status,applied,acks,want", [
    ("proposed", {}, [], {}),
    ("rejected", {}, [], {}),
    ("pending_ack", {1: SUB}, ["pending"], {"pending_confirmation": 1}),
    ("pending_ack", {1: SUB, 2: SUB}, ["accepted", "pending"], {"pending_confirmation": 1}),
    ("committed", {1: SUB}, [], {"pending_confirmation": 1}),                        # Telegram off
    ("acknowledged", {1: SUB}, [], {"pending_confirmation": 1}),                     # HOD only, nobody accepted
    ("acknowledged", {1: SUB, 2: SUB}, ["accepted"], {"pending_confirmation": 1}),   # slot 2 was never asked
    ("acknowledged", {1: SUB, 2: SUB}, ["accepted", "accepted"], {"rescued": 1}),
    ("acknowledged", {1: SUB, 2: MOVE}, ["accepted"], {"rescued": 1}),
    ("acknowledged", {1: SUB, 2: CANCEL}, ["accepted"], {"cancelled": 1}),           # a cancelled class isn't rescued
    ("pending_ack", {1: SUB, 2: CANCEL}, ["pending"], {"pending_confirmation": 1, "cancelled": 1}),
    ("committed", {1: CANCEL}, [], {"cancelled": 1}),
    ("committed", {1: MOVE}, [], {}),                                                # no substitute involved
    ("acknowledged", {}, [], {}),
    ("escalated", {}, [], {"escalated": 1}),
    ("escalated", {1: SUB}, ["accepted"], {"escalated": 1}),                         # PARTIAL
    ("escalated", {1: SUB, 2: SUB}, ["accepted", "expired"], {"escalated": 1}),
    ("escalated", {1: SUB, 2: CANCEL}, ["declined"], {"escalated": 1, "cancelled": 1}),
    ("closed_unresolved", {1: SUB}, ["accepted"], {"closed_unresolved": 1}),
])
def test_kpi_definitions(api, db, status, applied, acks, want):
    did = tools.log_decision("absence", "x", "y", [1], status=status, con=db)["id"]
    with db:
        for sid, kind in applied.items():
            db.execute("INSERT INTO applied_changes VALUES (?,?,?)", (did, sid, kind))
        for i, a in enumerate(acks, 1):
            db.execute("INSERT INTO ack_requests (decision_id, faculty_id, slot_ids, due_at, status) VALUES (?,?,?,'x',?)",
                       (did, f"F0{i + 6}", f"[{i}]", a))
    assert kpis(api) == kpi(**want)


def test_kpis_through_the_real_flow_without_telegram(api, db, fake, run):
    fake(demo_script(db))
    did = api.post("/api/incidents", json=DEMO, headers=H("F01")).json()["decision_id"]
    assert kpis(api) == kpi()
    approve(api, did)
    assert kpis(api) == kpi(pending_confirmation=1)
    rows = {r[0]: r[1] for r in db.execute("SELECT slot_id, kind FROM applied_changes WHERE decision_id = ?", (did,))}
    assert rows == {slot_id(db, "CSE-A", "MON", p): "substituted" for p in (1, 2)}


def test_approved_cancellation_is_cancelled_not_rescued(api, run, db):
    d, _ = _proposed_cancel(run, db)
    assert kpis(api)["cancelled"] == 0                # only proposed
    approve(api, d["id"])
    k = kpis(api)
    assert k["cancelled"] == 1 and k["rescued"] == 0
    assert api.get("/api/stats", headers=H("H01")).json()["classes_lost"] == 1


# ---------- HOD closes an escalation ----------
def escalated(db):
    return tools.log_decision("absence", "x", "first line", [1], status="escalated", con=db)["id"]


def close(api, did, reason="No one available, class combined with CSE-B", who="H01"):
    return api.post(f"/api/decisions/{did}/close", json={"reason": reason}, headers=H(who))


def test_close_unresolved(api, db):
    did, before = escalated(db), slots_now(db)
    bus.recent.clear()
    r = close(api, did)
    assert r.status_code == 200 and r.json()["status"] == "closed_unresolved"
    d = tools.get_decision(did, con=db)
    assert d["reasoning"].startswith("first line") and "Closed unresolved by H01 at " in d["reasoning"]
    assert "Reason: No one available" in d["reasoning"]
    assert slots_now(db) == before and {m["event"] for m in bus.recent} == {"decision_updated"}
    assert kpis(api) == kpi(closed_unresolved=1)
    for action in ("approve", "reject"):              # final, and never an approval
        assert api.post(f"/api/decisions/{did}/{action}", headers=H("H01")).status_code == 409
    assert close(api, did).status_code == 409
    assert tools.get_decision(did, con=db) == d


@pytest.mark.parametrize("reason", ["", "   ", "ab", "x" * 501])
def test_close_needs_a_reason(api, db, reason):
    did = escalated(db)
    assert close(api, did, reason).status_code == 422
    assert api.post(f"/api/decisions/{did}/close", headers=H("H01")).status_code == 422
    assert tools.get_decision(did, con=db)["status"] == "escalated"


def test_close_hod_only_and_unknown(api, db):
    did = escalated(db)
    for who in ("S001", "F01"):
        assert close(api, did, who=who).status_code == 403
    assert close(api, 999).status_code == 404 and tools.get_decision(did, con=db)["status"] == "escalated"


@pytest.mark.parametrize("status", ["proposed", "committed", "pending_ack", "acknowledged", "rejected"])
def test_only_escalated_can_be_closed(api, db, status):
    did = tools.log_decision("absence", "x", "y", [1], status=status, con=db)["id"]
    assert close(api, did).status_code == 409 and tools.get_decision(did, con=db)["status"] == status


def test_cannot_close_with_proposal_or_answers_outstanding(api, db):
    did = escalated(db)
    with db:
        db.execute("UPDATE decisions SET changes = '[]' WHERE id = ?", (did,))
    assert close(api, did).status_code == 409
    with db:
        db.execute("UPDATE decisions SET changes = NULL WHERE id = ?", (did,))
        db.execute("INSERT INTO ack_requests (decision_id, faculty_id, slot_ids, due_at) VALUES (?, 'F08', '[1]', 'x')", (did,))
    assert close(api, did).status_code == 409
    with db:
        db.execute("UPDATE ack_requests SET status = 'expired'")
    assert close(api, did).status_code == 200


def test_database_seeded_before_this_version_gets_the_table(api, db):
    from app.db import ensure_tables
    with db:
        db.execute("DROP TABLE applied_changes")
    before = slots_now(db)
    ensure_tables()
    ensure_tables()
    assert kpis(api) == kpi() and slots_now(db) == before


# ---------- fallback ----------
# ---------- fallback ----------
def test_fallback_never_gives_one_teacher_two_classes_at_once(run, db):
    agent.run_fallback(run, "test")
    slots = [(run.slots[c["slot_id"]]["period"], c["faculty_id"]) for c in run.proposed if "faculty_id" in c]
    assert len(slots) == len(set(slots))
    sub = run.t_find_substitute("DS", "MON", 2)
    assert sub is None or sub["faculty_id"] not in {f for p, f in slots if p == 2}


def test_fallback_respects_max_load_including_proposals(run, db):
    with db:
        db.execute("UPDATE faculty SET max_load = (SELECT COUNT(*) FROM slots WHERE faculty_id = 'F08') WHERE id = 'F08'")
    agent.run_fallback(run, "test")
    assert "F08" not in {c.get("faculty_id") for c in run.proposed}


def test_fallback_moves_class_when_no_substitute(run, db, monkeypatch):
    monkeypatch.setattr(tools, "find_substitute", lambda *a, **k: None)
    agent.run_fallback(run, "test")
    assert run.proposed and all("status" not in c and c["day"] != "MON" for c in run.proposed)
    d = run.finish()
    assert d["status"] == "proposed" and "[Rule-based fallback" in d["summary"]


def test_fallback_room_incident(api, db, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    before = slots_now(db)
    api.post("/api/incidents", json={"type": "room_unavailable", "room_id": "R101", "day": "MON", "periods": [2]},
             headers=H("H01"))
    d = decision(api)
    assert is_fallback(d, "GEMINI_API_KEY") and slots_now(db) == before
    approve(api, d["id"])
    assert not [s for s in slots_now(db) if (s["room_id"], s["day"], s["period"]) == ("R101", "MON", 2)]


def test_nothing_found_escalates_without_claiming_a_source(api, db, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(tools, "find_substitute", lambda *a, **k: None)
    monkeypatch.setattr(tools, "propose_reschedule", lambda *a, **k: None)
    before = slots_now(db)
    api.post("/api/incidents", json=DEMO, headers=H("F01"))
    d = decision(api)
    assert d["status"] == "escalated" and "no option" in d["summary"] and "[Gemini]" not in d["summary"]
    for action in ("approve", "reject"):  # nothing to decide: it stays visibly escalated
        assert api.post(f"/api/decisions/{d['id']}/{action}", headers=H("H01")).status_code == 409
    assert decision(api)["status"] == "escalated" and slots_now(db) == before
    assert kpis(api) == kpi(escalated=1)


def test_partial_result_escalates_and_names_uncovered_slot(api, db, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    real = tools.find_substitute
    monkeypatch.setattr(tools, "find_substitute", lambda code, *a, **k: None if code == "DSL" else real(code, *a, **k))
    monkeypatch.setattr(tools, "propose_reschedule", lambda *a, **k: None)
    api.post("/api/incidents", json=DEMO, headers=H("F01"))
    d = decision(api)
    dsl, ds = slot_id(db, "CSE-A", "MON", 1), slot_id(db, "CSE-A", "MON", 2)
    assert d["status"] == "escalated" and f"Unresolved slots [{dsl}]" in d["reasoning"] and "PARTIAL" in d["summary"]
    assert sorted(d["affected_slot_ids"]) == sorted([ds, dsl])
    assert approve(api, d["id"])["status"] == "escalated"       # authorised, but not fully covered
    for action in ("approve", "reject"):
        assert api.post(f"/api/decisions/{d['id']}/{action}", headers=H("H01")).status_code == 409
    assert decision(api)["status"] == "escalated" and kpis(api) == kpi(escalated=1)
    got = {s["id"]: s["faculty_id"] for s in slots_now(db)}
    assert (got[ds], got[dsl]) == ("F08", "F01")


def test_incident_validation(api):
    assert api.post("/api/incidents", json=DEMO, headers=H("S001")).status_code == 403
    assert api.post("/api/incidents", json={**DEMO, "faculty_id": "F99"}, headers=H("H01")).status_code == 422
    r = api.post("/api/incidents", json={**DEMO, "faculty_id": "F08", "periods": [2]}, headers=H("H01"))
    assert r.status_code == 422 and "No scheduled classes" in r.json()["detail"]
    r = api.post("/api/incidents", json={"type": "room_unavailable", "day": "MON", "periods": [1]}, headers=H("H01"))
    assert r.status_code == 422


def test_faculty_can_report_only_their_own_absence(api, db):
    other = {"type": "absence", "faculty_id": "F01", "day": "MON", "periods": [1, 2]}
    r = api.post("/api/incidents", json=other, headers=H("F02"))
    assert r.status_code == 403 and r.json()["error"] == "forbidden"
    assert api.post("/api/incidents", json={**other, "faculty_id": None}, headers=H("F02")).status_code == 403
    assert api.post("/api/incidents", json={**other, "faculty_id": "f01"}, headers=H("F01")).status_code == 403
    assert api.post("/api/incidents", json=other, headers=H("S001")).status_code == 403
    for t in ("incidents", "decisions"):
        assert db.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] == 0


@pytest.mark.parametrize("reporter", ["F01", "H01"])
def test_own_absence_and_hod_on_behalf_allowed(api, db, monkeypatch, reporter):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    r = api.post("/api/incidents", json=DEMO, headers=H(reporter))
    assert r.status_code == 202
    row = db.execute("SELECT faculty_id, reported_by FROM incidents").fetchone()
    assert tuple(row) == ("F01", reporter)


def test_faculty_can_still_report_a_room(api, db, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    body = {"type": "room_unavailable", "room_id": "R101", "day": "MON", "periods": [2]}
    assert api.post("/api/incidents", json=body, headers=H("F02")).status_code == 202


def test_substitute_and_move_together_is_refused(run, db):
    ds = slot_id(db, "CSE-A", "MON", 2)
    p = run.dispatch("propose_reschedule", {"slot_id": ds})["change"]
    r = run.dispatch("commit_change", {"changes": [{**p, "faculty_id": "F08"}]})
    assert r["ok"] is False and not run.proposed


def test_nudge_read(api, db, fake):
    fake(demo_script(db))
    approve(api, api.post("/api/incidents", json=DEMO, headers=H("H01")).json()["decision_id"])
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
    approve(api, did)
    d = tools.get_decision(did, con=db)
    assert d["summary"].startswith("[Gemini]")  # a fallback result must not pass as a live Gemini test
    print("\nLIVE decision:", d["status"], "|", d["summary"], "\n", d["reasoning"])
    for m in bus.recent:
        if m["event"] == "agent_step" and m["data"]["decision_id"] == did:
            print(f"  [{m['data']['step']}] {m['data']['text']}")
    ds = next(s for s in tools.get_timetable(section="CSE-A", day="MON", con=db) if s["period"] == 2)
    assert ds["faculty_id"] == "F08"
