import pytest
from conftest import slot_id

from app import tools
from app.validator import ClashError, validate_clash


def test_get_timetable_filters(db):
    mon_a = tools.get_timetable(section="CSE-A", day="MON", con=db)
    assert [s["period"] for s in mon_a] == sorted(s["period"] for s in mon_a)
    assert all(s["section"] == "CSE-A" and s["day"] == "MON" for s in mon_a)
    assert len(tools.get_timetable(faculty_id="F08", con=db)) == 5
    assert len(tools.get_timetable(con=db)) == 72


def test_find_free_rooms(db):
    free = {r["id"] for r in tools.find_free_rooms("MON", 1, con=db)}
    assert "LAB1" not in free and "R104" in free and "HALL" in free
    labs = tools.find_free_rooms("MON", 1, kind="lab", con=db)
    assert all(r["kind"] == "lab" for r in labs)


def test_find_substitute_demo_returns_f08(db):
    sub = tools.find_substitute("DS", "MON", 2, con=db)
    assert sub["faculty_id"] == "F08" and sub["load"] == 5
    assert [c["faculty_id"] for c in sub["candidates"]] == ["F08", "F02"]  # F01 busy (it's her class)


def test_find_substitute_exclude_busy_and_none(db):
    assert tools.find_substitute("DS", "MON", 2, exclude=["F08"], con=db)["faculty_id"] == "F02"
    assert tools.find_substitute("DS", "MON", 2, exclude=["F08", "F02"], con=db) is None
    assert tools.find_substitute("NOPE", "MON", 2, con=db) is None
    # F05 is busy MON P2 (CSE-B DLD) → never offered for DLD then
    sub = tools.find_substitute("DLD", "MON", 2, con=db)
    assert sub and "F05" not in {c["faculty_id"] for c in sub["candidates"]}


def test_get_attendance(db):
    ds = tools.get_attendance("CSE-A", "DS", con=db)
    assert ds == {"section": "CSE-A", "subject_code": "DS", "percent": 71, "below_threshold": True}
    assert tools.get_attendance("CSE-A", "DLD", con=db)["below_threshold"] is False
    assert len(tools.get_attendance("CSE-A", con=db)) == 6
    assert tools.get_attendance("CSE-Z", "DS", con=db) is None


def test_propose_reschedule_is_valid_and_read_only(db):
    sid = slot_id(db, "CSE-A", "MON", 2)
    p = tools.propose_reschedule(sid, con=db)
    assert p["from"] == {"day": "MON", "period": 2, "room_id": "R101"}
    assert (p["to"]["day"], p["to"]["period"]) != ("MON", 2)
    assert validate_clash([p["change"]], con=db).ok
    assert tools.get_timetable(section="CSE-A", day="MON", con=db)[1]["id"] == sid  # nothing written


def test_propose_reschedule_pinned_cell(db):
    sid = slot_id(db, "CSE-A", "MON", 2)
    # MON P1 is taken by CSE-A's own DSL → impossible
    assert tools.propose_reschedule(sid, day="MON", period=1, con=db) is None
    with pytest.raises(ValueError):
        tools.propose_reschedule(99999, con=db)


def test_commit_substitute_demo(db):
    sid = slot_id(db, "CSE-A", "MON", 2)
    sub = tools.find_substitute("DS", "MON", 2, con=db)
    out = tools.commit_change([{"slot_id": sid, "faculty_id": sub["faculty_id"]}], con=db)
    assert out["ok"] and out["slot_ids"] == [sid] and out["sections"] == ["CSE-A"]
    s = out["slots"][0]
    assert (s["faculty_id"], s["status"]) == ("F08", "replanned")
    assert tools.faculty_loads(db)["F08"] == 6


def test_commit_rejects_double_booking_and_writes_nothing(db):
    sid = slot_id(db, "CSE-A", "MON", 2)
    before = tools.get_timetable(con=db)
    with pytest.raises(ClashError) as e:
        tools.commit_change([{"slot_id": sid, "faculty_id": "F05"}], con=db)  # F05 busy MON P2
    assert e.value.result.clashes[0]["kind"] == "faculty"
    assert tools.get_timetable(con=db) == before


def test_commit_calls_validator_first(db, monkeypatch):
    from app.validator import ClashResult
    calls = []

    def fake(changes, **kw):
        calls.append(changes)
        return ClashResult(ok=False, errors=["blocked by test"])

    monkeypatch.setattr(tools, "validate_clash", fake)
    sid = slot_id(db, "CSE-A", "MON", 2)
    with pytest.raises(ClashError):
        tools.commit_change([{"slot_id": sid, "faculty_id": "F08"}], con=db)
    assert calls and tools.get_timetable(con=db)[0]["status"] == "scheduled"
    assert tools.find_substitute("DS", "MON", 2, con=db)["load"] == 5  # F08 untouched


def test_commit_reschedule_and_cancel(db):
    sid = slot_id(db, "CSE-A", "MON", 2)
    p = tools.propose_reschedule(sid, con=db)
    s = tools.commit_change([p["change"]], con=db)["slots"][0]
    assert (s["day"], s["period"], s["status"]) == (p["to"]["day"], p["to"]["period"], "replanned")
    s = tools.commit_change([{"slot_id": sid, "status": "cancelled"}], con=db)["slots"][0]
    assert s["status"] == "cancelled"
    with pytest.raises(ValueError):
        tools.commit_change([], con=db)


def test_log_decision(db):
    d = tools.log_decision("absence", "CSE-A DS MON P2 → F08",
                           "Attendance 71% < 75%, so cancel rejected; F08 free, lowest load.",
                           [23], status="pending_ack", con=db)
    assert set(d) == {"id", "created_at", "trigger", "summary", "reasoning", "affected_slot_ids", "status", "calendar_link"}
    assert d["affected_slot_ids"] == [23] and d["status"] == "pending_ack"
    assert db.execute("SELECT COUNT(*) FROM decisions").fetchone()[0] == 1
    with pytest.raises(ValueError):
        tools.log_decision("meteor", "x", "y", [], con=db)
    with pytest.raises(ValueError):
        tools.log_decision("absence", "x", "y", [], status="maybe", con=db)
