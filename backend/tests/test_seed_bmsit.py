"""BMSIT CSE-10 dataset (TARS_SEED=bmsit): real structure, simulated leave and eligibility."""
import json
import re

import pytest
from conftest import H, approve, slot_id
from fastapi.testclient import TestClient

from app import actions, agent, bus, gcal, notify, seed, tools
from app import stream as sse
from app.db import period_numbers
from app.models import User

LEAVE = {"type": "absence", "faculty_id": "F_CDB", "day": "THU", "periods": [4, 6, 7]}
DATA = json.loads(seed.DATASETS["bmsit"].read_text(encoding="utf-8"))


@pytest.fixture
def bmsit(monkeypatch, tmp_path):
    monkeypatch.setenv("TARS_SEED", "bmsit")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setattr(seed, "DB", tmp_path / "tars.db")
    monkeypatch.setattr(seed, "MOCK", tmp_path / "mock")
    seed.main()
    monkeypatch.setenv("TARS_DB", str(tmp_path / "tars.db"))
    from app.db import connect
    con = connect()
    yield con
    con.close()


@pytest.fixture
def api(bmsit):
    from app.main import app
    return TestClient(app)


def thu(con):
    return {s["period"]: s["faculty_id"] for s in tools.get_timetable(section="CSE-10", day="THU", con=con)}


def decision(api):
    return api.get("/api/decisions", headers=H("H_SKB")).json()[0]


# ---------- data rules ----------
def test_every_item_says_where_it_comes_from():
    for key in ("subjects", "faculty", "students", "hods", "rooms", "slots", "nptel"):
        assert DATA[key] and all(x.get("_basis", "").strip() for x in DATA[key]), key
    by_id = {f["id"]: f for f in DATA["faculty"]}
    assert "DEMO ASSUMPTION" in by_id["F_SMP"]["_basis"] and "MON P5, TUE P2" in by_id["F_SMP"]["_basis"]
    assert "DEMO CHOICE" in by_id["F_GPL"]["_basis"] and "not modelled" in by_id["F_GPL"]["_basis"]
    limits = " ".join(DATA["_limits"])
    assert "nothing enforces Thursday only" in limits and "co-faculty look free" in limits


def test_no_invented_or_personal_data():
    assert DATA["attendance"] == {} and DATA["events"] == []
    assert "F_SDB" not in json.dumps(DATA)
    assert all(r["capacity"] == 0 for r in DATA["rooms"])                       # not recorded
    for f in DATA["faculty"]:
        assert f["name"].startswith(("Faculty ", "Teacher not confirmed")), f["name"]
        assert "max_load" not in f
    assert [x["name"] for x in DATA["hods"] + DATA["students"]] == ["HOD (CSE)", "Demo student"]
    assert [s["usn"] for s in DATA["students"]] == ["26UG1BYCS0000-T"]


def test_no_teacher_means_placeholder_for_one_subject_only():
    for f in DATA["faculty"]:
        if f["id"].startswith("F_TBC_"):
            assert len(f["subjects"]) == 1 and "PLACEHOLDER" in f["_basis"]


def test_eligibility_is_exactly_what_was_agreed():
    can = lambda code: sorted(f["id"] for f in DATA["faculty"] if code in f["subjects"])
    assert can("1BAI103") == ["F_CDB", "F_SMP"] and can("PLC LAB") == ["F_CDB", "F_GPL"]


def test_thursday_and_periods(bmsit):
    t = thu(bmsit)
    assert (t[4], t[6], t[7]) == ("F_CDB", "F_CDB", "F_CDB")
    assert t[5] == "F_GPL"                                                      # unconfirmed, see below
    assert [(r["period"], r["start"], r["end"]) for r in bmsit.execute("SELECT * FROM periods")] == [
        (1, "08:30", "09:25"), (2, "09:25", "10:20"), (3, "10:40", "11:35"), (4, "11:35", "12:30"),
        (5, "12:30", "13:25"), (6, "14:20", "15:15"), (7, "15:15", "16:10")]
    ai = {(s["day"], s["period"]) for s in tools.get_timetable(section="CSE-10", con=bmsit) if s["subject_code"] == "1BAI103"}
    assert ai == {("MON", 5), ("TUE", 2), ("THU", 4)}                           # matched by clock time


def p5(con):
    return next(s for s in tools.get_timetable(section="CSE-10", day="THU", con=con) if s["period"] == 5)


def test_thu_p5_is_visible_and_labelled_not_confirmed_or_free(api, bmsit):
    s = next(x for x in api.get("/api/timetable?section=CSE-10", headers=H("S0000")).json()
             if (x["day"], x["period"]) == ("THU", 5))
    assert s["subject_name"] == "Python (Unconfirmed \u2014 timetable data mismatch)"
    assert s["subject_code"] == "UNCONFIRMED-PLC"                               # not the official 1BPLC105B
    row = next(x for x in DATA["slots"] if (x["day"], x["period"], x["section"]) == ("THU", 5, "CSE-10"))
    assert row["_basis"].startswith("UNCONFIRMED") and "neither confirmed nor free" in " ".join(DATA["_limits"])


def test_nothing_is_proposed_into_thu_p5(api, bmsit):
    """Section, teacher and room are all busy then."""
    ai, mon = slot_id(bmsit, "CSE-10", "THU", 4), slot_id(bmsit, "CSE-10", "MON", 4)
    for sid in (ai, mon):
        assert tools.propose_reschedule(sid, day="THU", period=5, con=bmsit) is None
        assert not tools.validate_clash([{"slot_id": sid, "day": "THU", "period": 5, "room_id": "306"}], con=bmsit).ok
    assert tools.find_substitute("PLC LAB", "THU", 5, exclude=["F_CDB"], con=bmsit) is None
    assert "SJB-104" not in {r["id"] for r in tools.find_free_rooms("THU", 5, con=bmsit)}
    r = _run(bmsit, [4]).dispatch("commit_change", {"changes": [{"slot_id": ai, "period": 5}]})
    assert r["ok"] is False


def test_thu_p5_itself_is_never_moved_or_substituted(api, bmsit):
    before = tools.get_timetable(con=bmsit)
    r = api.post("/api/incidents", json={"type": "absence", "faculty_id": "F_GPL", "day": "THU", "periods": [5]}, headers=H("F_GPL"))
    assert r.status_code == 202
    d = decision(api)
    assert d["status"] == "escalated" and proposal(bmsit, d["id"]) == [] and tools.get_timetable(con=bmsit) == before
    sid = p5(bmsit)["id"]
    run = agent.AgentRun(bmsit, {"id": 1, "type": "absence", "faculty_id": "F_GPL", "room_id": None, "day": "THU", "periods": [5],
                                 "note": None, "reported_by": "H_SKB"}, d["id"])
    for change in ({"day": "TUE", "period": 7}, {"faculty_id": "F_SMP"}, {"faculty_id": "F_CDB"}):
        assert run.dispatch("commit_change", {"changes": [{"slot_id": sid, **change}]})["ok"] is False
    assert run.dispatch("propose_reschedule", {"slot_id": sid}) is None


def test_thu_p5_does_not_change_the_demo(api, bmsit):
    did = report(api, "F_CDB", periods=(4, 6, 7))["id"]
    assert approve(api, did, H("H_SKB"))["status"] == "committed"
    t = thu(bmsit)
    assert (t[4], t[5], t[6], t[7]) == ("F_SMP", "F_GPL", "F_GPL", "F_GPL")


def test_smp_is_eligible_on_all_three_days_not_only_thursday(bmsit):
    for day, period in (("MON", 5), ("TUE", 2), ("THU", 4)):
        assert tools.find_substitute("1BAI103", day, period, exclude=["F_CDB"], con=bmsit)["faculty_id"] == "F_SMP"


def test_other_known_classes_make_teachers_busy(bmsit):
    busy = lambda f: {(s["day"], s["period"]) for s in tools.get_timetable(faculty_id=f, con=bmsit)}
    assert {("MON", 6), ("MON", 7), ("TUE", 3), ("WED", 6), ("FRI", 1)} <= busy("F_CDB")
    assert {("MON", 1), ("MON", 6), ("WED", 4), ("THU", 2), ("FRI", 3)} <= busy("F_GPL")


def test_attendance_is_absent(api):
    assert api.get("/api/attendance?section=CSE-10", headers=H("H_SKB")).json() == []


# ---------- the demo ----------
def test_leave_proposes_smp_and_gpl_and_changes_nothing_until_approved(api, bmsit):
    before = tools.get_timetable(con=bmsit)
    assert api.post("/api/incidents", json=LEAVE, headers=H("F_CDB")).status_code == 202
    d = decision(api)
    assert d["status"] == "proposed" and d["summary"].startswith("[Rule-based fallback]")
    assert tools.get_timetable(con=bmsit) == before
    assert approve(api, d["id"], H("H_SKB"))["status"] == "committed"
    t = thu(bmsit)
    assert (t[4], t[6], t[7]) == ("F_SMP", "F_GPL", "F_GPL")
    s = api.get("/api/stats", headers=H("H_SKB")).json()
    assert s["pending_confirmation"] == 1 and s["rescued"] == 0


def nudges(api, uid):
    return api.get("/api/nudges", headers=H(uid)).json()


def test_messages_say_hod_approved_and_not_confirmed(api, bmsit):
    did = report(api, "F_CDB", periods=(4, 6, 7))["id"]
    assert all(nudges(api, u) == [] for u in ("S0000", "F_SMP", "F_GPL"))       # nothing is said before approval
    assert approve(api, did, H("H_SKB"))["status"] == "committed"
    got = nudges(api, "S0000")
    assert len(got) == 3 and {n["title"] for n in got} == {"Substitute approved, not confirmed"}
    assert all("the HOD approved Faculty" in n["body"] and "has not confirmed yet" in n["body"] for n in got)
    for uid, count in (("F_SMP", 1), ("F_GPL", 2)):
        mine = nudges(api, uid)
        assert len(mine) == count
        for n in mine:
            assert n["title"] == "HOD approved you as substitute: not confirmed"
            assert "the HOD's approval, not your acceptance" in n["body"] and "tell the HOD" in n["body"]
    d = tools.get_decision(did, con=bmsit)                                       # wording and status agree
    assert d["status"] == "committed" and "NOT CONFIRMED" in d["reasoning"]
    s = api.get("/api/stats", headers=H("H_SKB")).json()
    assert (s["pending_confirmation"], s["rescued"]) == (1, 0)


IMPLIES_ACCEPTANCE = re.compile(r"is now with|covering a class|will (take|cover)|has accepted|accepted by|\bsubstituting\b|"
                                r"(?<!not )(?<!not been )\bconfirmed\b(?! yet)", re.I)


@pytest.mark.parametrize("bad", ["DS is now with F08", "You're covering a class", "F08 accepted by phone", "F08 substituting",
                                 "Your class is confirmed", "F08 will cover it"])
def test_the_check_below_catches_bad_wording(bad):
    assert IMPLIES_ACCEPTANCE.search(bad)


def test_nothing_students_or_substitutes_can_see_implies_acceptance(api, bmsit):
    bus.recent.clear()
    did = report(api, "F_CDB", periods=(4, 6, 7))["id"]
    approve(api, did, H("H_SKB"))
    users = {u: User(user_id=u, name=u, role=r, section=s) for u, r, s in
             (("S0000", "student", "CSE-10"), ("F_SMP", "faculty", None), ("F_GPL", "faculty", None))}
    texts = [n["title"] + " | " + n["body"] for u in users for n in nudges(api, u)]
    for m in bus.recent:                                                         # live updates too
        if any(sse.can_see(u, m) for u in users.values()):
            texts.append(json.dumps(m["data"]))
    texts += [m["data"]["text"] for m in bus.recent if m["event"] == "agent_step" and "HOD approved" in m["data"]["text"]]
    assert len(texts) > 8
    for t in texts:
        assert not IMPLIES_ACCEPTANCE.search(t), t


def test_moves_and_cancellations_keep_their_wording(bmsit):
    s = tools.get_timetable(section="CSE-10", day="THU", con=bmsit)[0]
    assert actions.describe(s, {**s, "status": "cancelled"}).endswith("is cancelled.")
    moved = actions.describe(s, {**s, "day": "TUE", "period": 7, "start": "15:15"})
    assert "moved from" in moved and "HOD approved" not in moved and "confirmed" not in moved
    assert "moved to room 306" in actions.describe(s, {**s, "room_id": "306"})


def test_calendar_title_is_not_confirmed(bmsit):
    s = tools.get_timetable(section="CSE-10", day="THU", con=bmsit)[0]
    body = gcal.event_body(s, "substituted", {"id": 1, "status": "committed", "summary": "", "reasoning": ""}, None)
    assert body["summary"].endswith("approved as substitute (not confirmed)") and not IMPLIES_ACCEPTANCE.search(body["summary"])


def test_wording_is_the_same_with_telegram_until_the_substitute_accepts(api, bmsit, monkeypatch):
    n = notify.Notifier(sender=lambda chat, text, buttons: 1)
    n.start_scheduler()
    monkeypatch.setattr(notify, "notifier", n)
    try:
        with bmsit:
            bmsit.execute("UPDATE users SET telegram_chat_id = id")
        did = report(api, "F_CDB", periods=(4,))["id"]
        assert approve(api, did, H("H_SKB"))["status"] == "pending_ack"
        assert [x["title"] for x in nudges(api, "F_SMP")] == ["HOD approved you as substitute: not confirmed"]
        rid = bmsit.execute("SELECT id FROM ack_requests WHERE decision_id = ?", (did,)).fetchone()[0]
        assert "confirmed" in n.handle_button("F_SMP", f"ack:{rid}")             # only a real answer says so
        assert tools.get_decision(did, con=bmsit)["status"] == "acknowledged"
        assert api.get("/api/stats", headers=H("H_SKB")).json()["rescued"] == 1
    finally:
        n.scheduler.shutdown(wait=False)


def test_reject_changes_nothing(api, bmsit):
    before = tools.get_timetable(con=bmsit)
    did = api.post("/api/incidents", json=LEAVE, headers=H("F_CDB")).json()["decision_id"]
    assert api.post(f"/api/decisions/{did}/reject", headers=H("H_SKB")).status_code == 200
    assert tools.get_timetable(con=bmsit) == before


def test_gpl_declining_the_lab_escalates_with_no_other_cover(api, bmsit, monkeypatch):
    n = notify.Notifier(sender=lambda chat, text, buttons: 1)
    n.start_scheduler()
    monkeypatch.setattr(notify, "notifier", n)
    try:
        with bmsit:
            bmsit.execute("UPDATE users SET telegram_chat_id = id")
        did = api.post("/api/incidents", json=LEAVE, headers=H("F_CDB")).json()["decision_id"]
        approve(api, did, H("H_SKB"))
        rid = bmsit.execute("SELECT id FROM ack_requests WHERE faculty_id = 'F_GPL'").fetchone()[0]
        n.handle_button("F_GPL", f"dec:{rid}")
        assert tools.get_decision(did, con=bmsit)["status"] == "escalated"
        t = thu(bmsit)
        assert (t[4], t[6], t[7]) == ("F_SMP", "F_CDB", "F_CDB")               # the lab has no cover; P4 is untouched
        run = agent.AgentRun(bmsit, {"id": 1, "type": "absence", "faculty_id": "F_CDB", "room_id": None, "day": "THU",
                                     "periods": [6, 7], "note": None, "reported_by": "H_SKB"}, did)
        assert run.t_find_substitute("PLC LAB", "THU", 6) is None
    finally:
        n.scheduler.shutdown(wait=False)


def report(api, who="H_SKB", periods=(6, 7)):
    api.post("/api/incidents", json={**LEAVE, "periods": list(periods)}, headers=H(who))
    return decision(api)


def proposal(con, did):
    return json.loads(con.execute("SELECT changes FROM decisions WHERE id = ?", (did,)).fetchone()[0] or "[]")


@pytest.fixture
def lab_declined(api, bmsit, monkeypatch):
    """HOD approved F_GPL for the lab and F_GPL declined."""
    n = notify.Notifier(sender=lambda chat, text, buttons: 1)
    n.start_scheduler()
    monkeypatch.setattr(notify, "notifier", n)
    with bmsit:
        bmsit.execute("UPDATE users SET telegram_chat_id = id")
    did = report(api, "F_CDB")["id"]
    approve(api, did, H("H_SKB"))
    rid = bmsit.execute("SELECT id FROM ack_requests WHERE decision_id = ?", (did,)).fetchone()[0]
    n.handle_button("F_GPL", f"dec:{rid}")
    yield did
    n.scheduler.shutdown(wait=False)


def test_retry_after_decline_never_repeats_gpl_and_changes_nothing_by_itself(api, bmsit, lab_declined):
    before = tools.get_timetable(con=bmsit)
    for _ in range(3):
        d = report(api)
        assert proposal(bmsit, d["id"]) == []
        assert tools.get_timetable(con=bmsit) == before
        if d["status"] == "proposed":
            api.post(f"/api/decisions/{d['id']}/reject", headers=H("H_SKB"))
    assert tools.get_decision(lab_declined, con=bmsit)["status"] == "escalated"  # history stays
    assert tools.get_timetable(con=bmsit) == before


def test_retry_after_gpl_declines_only_escalates(api, bmsit, lab_declined):
    """Labs aren't moved: with nobody else eligible there is nothing to propose, however often it is reported."""
    before = tools.get_timetable(con=bmsit)
    for _ in range(3):
        d = report(api)
        assert d["status"] == "escalated" and proposal(bmsit, d["id"]) == []
        assert api.post(f"/api/decisions/{d['id']}/approve", headers=H("H_SKB")).status_code == 409
        r = api.post(f"/api/decisions/{d['id']}/close", json={"reason": "No cover for the lab"}, headers=H("H_SKB"))
        assert r.json()["status"] == "closed_unresolved"
    assert tools.get_timetable(con=bmsit) == before


def test_demo_path_decline_then_close_unresolved(api, bmsit, lab_declined):
    before = tools.get_timetable(con=bmsit)
    r = api.post(f"/api/decisions/{lab_declined}/close", json={"reason": "F_GPL declined"}, headers=H("H_SKB"))
    if r.status_code == 409:                                                    # F_SMP hasn't answered P4 yet
        rid = bmsit.execute("SELECT id FROM ack_requests WHERE faculty_id = 'F_SMP'").fetchone()[0]
        notify.notifier.handle_button("F_SMP", f"ack:{rid}")
        r = api.post(f"/api/decisions/{lab_declined}/close", json={"reason": "F_GPL declined"}, headers=H("H_SKB"))
    assert r.status_code == 200 and r.json()["status"] == "closed_unresolved"
    assert tools.get_timetable(con=bmsit) == before
    s = api.get("/api/stats", headers=H("H_SKB")).json()
    assert (s["closed_unresolved"], s["rescued"]) == (1, 0)


def _run(con, periods, day="THU"):
    did = tools.log_decision("absence", "running", None, [], con=con)["id"]
    return agent.AgentRun(con, {"id": 1, "type": "absence", "faculty_id": "F_CDB", "room_id": None, "day": day,
                                "periods": list(periods), "note": None, "reported_by": "H_SKB"}, did)


def test_gemini_cannot_move_a_lab_either(bmsit):
    run, lab = _run(bmsit, [6, 7]), slot_id(bmsit, "CSE-10", "THU", 6)
    assert run.dispatch("propose_reschedule", {"slot_id": lab}) is None
    for change in ({"day": "TUE", "period": 7}, {"period": 5}, {"day": "FRI"}):
        r = run.dispatch("commit_change", {"changes": [{"slot_id": lab, **change}]})
        assert r["ok"] is False and not run.proposed
    both = [{"slot_id": slot_id(bmsit, "CSE-10", "THU", p), "day": "TUE", "period": p + 1} for p in (6,)]
    assert run.dispatch("commit_change", {"changes": both})["ok"] is False
    assert run.dispatch("commit_change", {"changes": [{"slot_id": lab, "faculty_id": "F_GPL", "day": "THU", "period": 6}]})["ok"]


def test_lab_moves_still_work_with_the_default_data(db, monkeypatch):
    monkeypatch.setenv("TARS_SEED", "")
    d = tools.log_decision("absence", "x", None, [], con=db)["id"]
    run = agent.AgentRun(db, {"id": 1, "type": "absence", "faculty_id": "F01", "room_id": None, "day": "MON", "periods": [1],
                              "note": None, "reported_by": "H01"}, d)
    assert run.dispatch("propose_reschedule", {"slot_id": slot_id(db, "CSE-A", "MON", 1)}) is not None


@pytest.mark.parametrize("day,period,code", [("WED", 5, "ORIENTATION"), ("FRI", 6, "PROCTORING")])
def test_orientation_and_proctoring_are_busy(bmsit, day, period, code):
    row = next(s for s in tools.get_timetable(section="CSE-10", day=day, con=bmsit) if s["period"] == period)
    assert row["subject_code"] == code
    ai = slot_id(bmsit, "CSE-10", "THU", 4)
    assert tools.propose_reschedule(ai, day=day, period=period, con=bmsit) is None
    r = _run(bmsit, [4]).dispatch("commit_change", {"changes": [{"slot_id": ai, "day": day, "period": period}]})
    assert r["ok"] is False


def test_known_limit_a_rejected_theory_move_is_proposed_again(api, bmsit, monkeypatch):
    """KNOWN LIMIT, stated in _limits: rejections aren't remembered. Theory classes only; labs never move."""
    monkeypatch.setattr(tools, "find_substitute", lambda *a, **k: None)
    first = report(api, periods=[4])
    assert first["status"] == "proposed"
    changes = proposal(bmsit, first["id"])
    api.post(f"/api/decisions/{first['id']}/reject", headers=H("H_SKB"))
    second = report(api, periods=[4])
    assert second["id"] != first["id"] and proposal(bmsit, second["id"]) == changes


def test_known_limit_unanswered_gpl_is_offered_again(api, bmsit, monkeypatch):
    """No answer is not a decline: after the deadline F_GPL may be proposed again."""
    n = notify.Notifier(sender=lambda chat, text, buttons: 1)
    n.start_scheduler()
    monkeypatch.setattr(notify, "notifier", n)
    try:
        with bmsit:
            bmsit.execute("UPDATE users SET telegram_chat_id = id")
        did = report(api, "F_CDB")["id"]
        approve(api, did, H("H_SKB"))
        n.escalate_if_pending(did)
        assert {c["faculty_id"] for c in proposal(bmsit, report(api)["id"])} == {"F_GPL"}
    finally:
        n.scheduler.shutdown(wait=False)


def test_cancellation_without_attendance_still_needs_the_hod(api, bmsit):
    """KNOWN LIMIT: with no attendance a cancellation may be proposed early. It is never applied without approval."""
    lab = slot_id(bmsit, "CSE-10", "THU", 6)
    did = tools.log_decision("absence", "running", None, [lab], con=bmsit)["id"]
    run = agent.AgentRun(bmsit, {"id": 1, "type": "absence", "faculty_id": "F_CDB", "room_id": None, "day": "THU",
                                 "periods": [6], "note": None, "reported_by": "F_CDB"}, did)
    before = tools.get_timetable(con=bmsit)
    assert run.dispatch("commit_change", {"changes": [{"slot_id": lab, "status": "cancelled"}]})["ok"]
    assert run.finish()["status"] == "proposed" and tools.get_timetable(con=bmsit) == before
    for who in ("F_CDB", "F_GPL", "S0000"):
        assert api.post(f"/api/decisions/{did}/approve", headers=H(who)).status_code == 403
    assert tools.get_timetable(con=bmsit) == before
    assert approve(api, did, H("H_SKB"))["status"] == "committed"
    s = api.get("/api/stats", headers=H("H_SKB")).json()
    assert (s["cancelled"], s["rescued"]) == (1, 0)


def test_fallback_never_proposes_a_cancellation(api, bmsit, lab_declined):
    assert all(c.get("status") != "cancelled" for c in proposal(bmsit, report(api)["id"]))


def test_reset_restores_bmsit(api, bmsit, monkeypatch):
    monkeypatch.setenv("TARS_DEMO_MODE", "1")
    before = tools.get_timetable(con=bmsit)
    did = api.post("/api/incidents", json=LEAVE, headers=H("F_CDB")).json()["decision_id"]
    approve(api, did, H("H_SKB"))
    assert api.post("/api/admin/reset-demo", headers=H("H_SKB")).json()["slots"] == len(DATA["slots"])
    assert tools.get_timetable(con=bmsit) == before


# ---------- period limit ----------
def test_period_7_with_bmsit(api, bmsit):
    assert period_numbers(bmsit) == [1, 2, 3, 4, 5, 6, 7]
    assert api.get("/api/rooms?day=THU&period=7", headers=H("H_SKB")).status_code == 200
    assert api.get("/api/rooms?day=THU&period=8", headers=H("H_SKB")).status_code == 422
    r = api.post("/api/incidents", json={**LEAVE, "periods": [8]}, headers=H("F_CDB"))
    assert r.status_code == 422 and "1..7" in r.json()["detail"]
    assert len(api.get("/api/meta", headers=H("H_SKB")).json()["periods"]) == 7
    lab = slot_id(bmsit, "CSE-10", "THU", 7)
    assert tools.validate_clash([{"slot_id": lab, "day": "TUE", "period": 7}], con=bmsit).ok
    assert not tools.validate_clash([{"slot_id": lab, "day": "TUE", "period": 8}], con=bmsit).ok
    assert tools.propose_reschedule(lab, day="TUE", period=7, con=bmsit)["to"]["period"] == 7


def test_period_7_is_refused_with_the_default_data(db):
    from app.main import app
    api = TestClient(app)
    assert api.get("/api/rooms?day=MON&period=6", headers=H("H01")).status_code == 200
    for p in (0, 7):
        assert api.get(f"/api/rooms?day=MON&period={p}", headers=H("H01")).status_code == 422
    r = api.post("/api/incidents", json={"type": "absence", "faculty_id": "F01", "day": "MON", "periods": [7]}, headers=H("H01"))
    assert r.status_code == 422 and "1..6" in r.json()["detail"]
    ds = slot_id(db, "CSE-A", "MON", 2)
    assert not tools.validate_clash([{"slot_id": ds, "day": "FRI", "period": 7}], con=db).ok
    assert tools.propose_reschedule(ds, day="FRI", period=7, con=db) is None


def test_default_dataset_is_unchanged_and_unknown_is_refused(monkeypatch):
    monkeypatch.setenv("TARS_SEED", "")
    assert seed.load_data()["faculty"][0]["id"] == "F01"
    monkeypatch.setenv("TARS_SEED", "nope")
    with pytest.raises(ValueError, match="unknown TARS_SEED"):
        seed.load_data()
