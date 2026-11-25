from conftest import slot_id

from app.validator import validate_clash


def S(id, day, period, section, faculty, room, status="scheduled"):
    return dict(id=id, day=day, period=period, section=section, subject_code="DS",
                faculty_id=faculty, room_id=room, status=status)


BASE = [
    S(1, "MON", 1, "CSE-A", "F01", "R101"),
    S(2, "MON", 2, "CSE-B", "F02", "R102"),
    S(3, "MON", 2, "CSE-A", "F03", "R101"),
]


def test_clean_timetable_ok():
    assert validate_clash([], current_slots=BASE).ok


def test_deliberate_double_booking_fails_all_three_kinds():
    # Move slot 3 (CSE-A, R101) to MON P1 with F01 → collides with slot 1 on section, faculty AND room.
    r = validate_clash([{"slot_id": 3, "period": 1, "faculty_id": "F01"}], current_slots=BASE)
    assert not r.ok
    assert {c["kind"] for c in r.clashes} == {"section", "faculty", "room"}
    assert all(c["slot_ids"] == [1, 3] and (c["day"], c["period"]) == ("MON", 1) for c in r.clashes)
    assert "double-booked MON P1" in r.detail


def test_faculty_clash_only():
    r = validate_clash([{"slot_id": 2, "faculty_id": "F03"}], current_slots=BASE)
    assert not r.ok and [c["kind"] for c in r.clashes] == ["faculty"] and r.clashes[0]["key"] == "F03"


def test_room_clash_only():
    r = validate_clash([{"slot_id": 2, "room_id": "R101"}], current_slots=BASE)
    assert [c["kind"] for c in r.clashes] == ["room"]


def test_clash_between_two_changes():
    # each change alone is fine; together they double-book F05 at MON P2
    changes = [{"slot_id": 2, "faculty_id": "F05"}, {"slot_id": 3, "faculty_id": "F05"}]
    assert validate_clash(changes[:1], current_slots=BASE).ok
    r = validate_clash(changes, current_slots=BASE)
    assert not r.ok and r.clashes[0]["slot_ids"] == [2, 3]


def test_swap_is_ok():
    changes = [{"slot_id": 2, "faculty_id": "F03"}, {"slot_id": 3, "faculty_id": "F02"}]
    assert validate_clash(changes, current_slots=BASE).ok


def test_cancelled_slots_ignored():
    slots = BASE + [S(4, "MON", 1, "CSE-A", "F01", "R101", status="cancelled")]
    assert validate_clash([], current_slots=slots).ok
    # cancelling slot 1 frees MON P1 for slot 3
    r = validate_clash([{"slot_id": 1, "status": "cancelled"}, {"slot_id": 3, "period": 1}], current_slots=BASE)
    assert r.ok


def test_malformed_changes_rejected():
    r = validate_clash([{"slot_id": 99, "faculty_id": "F01"},
                        {"slot_id": 1, "section": "CSE-B"},
                        {"slot_id": 1, "day": "SUN"},
                        {"slot_id": 1, "period": 9},
                        {"slot_id": 1, "status": "gone"}], current_slots=BASE)
    assert not r.ok and len(r.errors) == 5 and not r.clashes


def test_seeded_db_is_clash_free_and_detects_real_double_booking(db):
    assert validate_clash([], con=db).ok
    ds = slot_id(db, "CSE-A", "MON", 2)  # CSE-A DS, F01
    assert validate_clash([{"slot_id": ds, "faculty_id": "F08"}], con=db).ok
    # F05 teaches CSE-B DLD at MON P2 → double booking
    r = validate_clash([{"slot_id": ds, "faculty_id": "F05"}], con=db)
    assert not r.ok and r.clashes[0]["kind"] == "faculty" and r.clashes[0]["key"] == "F05"
