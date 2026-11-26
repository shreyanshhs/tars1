"""Tests for POST /api/admin/import-timetable and GET /api/admin/timetable-template."""
import csv
import io
from unittest.mock import MagicMock

import pytest
from app import actions, bus, gcal
from app.db import use_db
from app.validator import ClashError
from tests.conftest import H

IMPORT_URL = "/api/admin/import-timetable"
TEMPLATE_URL = "/api/admin/timetable-template"


def _row(section="CSE-A", day="MON", period=1, subject="DS", faculty="F01", room="R101", **kwargs):
    d = {"section": section, "day": day, "period": period, "subject": subject, "faculty": faculty, "room": room}
    d.update(kwargs)
    return d


class TestImportAuth:
    def test_requires_auth(self, client):
        r = client.post(IMPORT_URL, json={"rows": [_row()]})
        assert r.status_code == 401

    def test_student_forbidden(self, client):
        r = client.post(IMPORT_URL, json={"rows": [_row()]}, headers=H("S001"))
        assert r.status_code == 403

    def test_faculty_forbidden(self, client):
        r = client.post(IMPORT_URL, json={"rows": [_row()]}, headers=H("F01"))
        assert r.status_code == 403

    def test_hod_allowed(self, client):
        r = client.post(IMPORT_URL, json={"rows": [_row()]}, headers=H("H01"))
        assert r.status_code == 200

    def test_template_auth(self, client):
        assert client.get(TEMPLATE_URL).status_code == 401
        assert client.get(TEMPLATE_URL, headers=H("S001")).status_code == 403
        assert client.get(TEMPLATE_URL, headers=H("F01")).status_code == 403
        r = client.get(TEMPLATE_URL, headers=H("H01"))
        assert r.status_code == 200
        assert "section,day,period,subject,faculty,room" in r.text


class TestImportDryRunValidation:
    def test_valid_dry_run_preserves_database(self, client):
        before = client.get("/api/timetable?section=CSE-A", headers=H("H01")).json()
        r = client.post(IMPORT_URL, json={"rows": [_row()]}, headers=H("H01"))
        assert r.status_code == 200
        data = r.json()
        assert data["valid"] is True
        assert data["errors"] == []
        assert data["summary"]["total_rows"] == 1
        assert data["summary"]["errors"] == 0
        assert data["preview"] is not None
        assert len(data["preview"]) == 1
        assert data["preview"][0]["subject_code"] == "DS"
        assert data["preview"][0]["faculty_id"] == "F01"
        assert data["preview"][0]["room_id"] == "R101"

        # Verify DB untouched
        after = client.get("/api/timetable?section=CSE-A", headers=H("H01")).json()
        assert len(before) == len(after)

    def test_name_matching_resolution(self, client):
        """Names like 'Data Structures', 'Dr. Ananya Rao', 'Room 101' should resolve to IDs."""
        rows = [
            _row(section="cse-a", day="Monday", period=1,
                 subject="Data Structures", faculty="Dr. Ananya Rao", room="Room 101")
        ]
        r = client.post(IMPORT_URL, json={"rows": rows}, headers=H("H01"))
        assert r.status_code == 200
        data = r.json()
        assert data["valid"] is True
        assert data["preview"][0]["subject_code"] == "DS"
        assert data["preview"][0]["faculty_id"] == "F01"
        assert data["preview"][0]["room_id"] == "R101"

    def test_missing_field_detection(self, client):
        rows = [{"section": "CSE-A", "day": "MON", "period": 1}]
        r = client.post(IMPORT_URL, json={"rows": rows}, headers=H("H01"))
        assert r.status_code == 200
        data = r.json()
        assert data["valid"] is False
        assert any(e["field"] == "subject" and e["type"] == "missing" for e in data["errors"])
        assert any(e["field"] == "faculty" and e["type"] == "missing" for e in data["errors"])
        assert any(e["field"] == "room" and e["type"] == "missing" for e in data["errors"])

    def test_unknown_records(self, client):
        rows = [
            _row(section="ECE-A"),  # unknown section
            _row(subject="Quantum Computing"),  # unknown subject
            _row(faculty="Dr. Unknown Person"),  # unknown faculty
            _row(room="SkyLab 9000"),  # unknown room
        ]
        r = client.post(IMPORT_URL, json={"rows": rows}, headers=H("H01"))
        assert r.status_code == 200
        data = r.json()
        assert data["valid"] is False
        errors = data["errors"]
        assert any("ECE-A" in e["message"] for e in errors)
        assert any("Quantum Computing" in e["message"] for e in errors)
        assert any("Dr. Unknown Person" in e["message"] for e in errors)
        assert any("SkyLab 9000" in e["message"] for e in errors)

    def test_invalid_day_and_period(self, client):
        rows = [
            _row(day="SATURDAY"),
            _row(period=7),
            _row(period=0),
        ]
        r = client.post(IMPORT_URL, json={"rows": rows}, headers=H("H01"))
        data = r.json()
        assert data["valid"] is False
        assert any("SATURDAY" in e["message"] for e in data["errors"])
        assert any("7" in e["message"] for e in data["errors"])
        assert any("0" in e["message"] for e in data["errors"])

    def test_faculty_unqualified_for_subject(self, client):
        # Dr. Meera Iyer (F03) only teaches MATH, cannot teach DS
        rows = [_row(subject="DS", faculty="F03")]
        r = client.post(IMPORT_URL, json={"rows": rows}, headers=H("H01"))
        data = r.json()
        assert data["valid"] is False
        assert any(e["type"] == "mismatch" and "not qualified" in e["message"] for e in data["errors"])

    def test_duplicate_slot_in_file(self, client):
        rows = [
            _row(section="CSE-A", day="MON", period=1, subject="DS", faculty="F01", room="R101"),
            _row(section="CSE-A", day="MON", period=1, subject="MATH", faculty="F03", room="R101"),
        ]
        r = client.post(IMPORT_URL, json={"rows": rows}, headers=H("H01"))
        data = r.json()
        assert data["valid"] is False
        assert any(e["type"] == "duplicate" for e in data["errors"])

    def test_faculty_clash_within_import(self, client):
        # F01 assigned to CSE-A and CSE-B at the exact same day+period
        rows = [
            _row(section="CSE-A", day="MON", period=1, faculty="F01", room="R101"),
            _row(section="CSE-B", day="MON", period=1, faculty="F01", room="R102"),
        ]
        r = client.post(IMPORT_URL, json={"rows": rows}, headers=H("H01"))
        data = r.json()
        assert data["valid"] is False
        assert any(e["type"] == "clash" and e["field"] == "faculty" for e in data["errors"])

    def test_room_clash_within_import(self, client):
        # R101 used by CSE-A and CSE-B at the exact same day+period
        rows = [
            _row(section="CSE-A", day="MON", period=1, faculty="F01", room="R101"),
            _row(section="CSE-B", day="MON", period=1, faculty="F03", subject="MATH", room="R101"),
        ]
        r = client.post(IMPORT_URL, json={"rows": rows}, headers=H("H01"))
        data = r.json()
        assert data["valid"] is False
        assert any(e["type"] == "clash" and e["field"] == "room" for e in data["errors"])

    def test_section_not_in_replace_sections(self, client):
        rows = [_row(section="CSE-B")]
        r = client.post(IMPORT_URL, json={"rows": rows, "replace_sections": ["CSE-A"]}, headers=H("H01"))
        data = r.json()
        assert data["valid"] is False
        assert any("not included in replace_sections" in e["message"] for e in data["errors"])

    def test_cross_section_clash_with_non_replaced_section(self, client):
        # CSE-B has active slots that are NOT being replaced if we only replace CSE-A.
        # Find a slot in CSE-B:
        b_slots = client.get("/api/timetable?section=CSE-B", headers=H("H01")).json()
        if b_slots:
            target = b_slots[0]
            # Try importing a slot for CSE-A that books the same faculty at that same day+period
            rows = [_row(section="CSE-A", day=target["day"], period=target["period"],
                         faculty=target["faculty_id"], subject=target["subject_code"], room="R104")]
            r = client.post(IMPORT_URL, json={"rows": rows, "replace_sections": ["CSE-A"]}, headers=H("H01"))
            data = r.json()
            assert data["valid"] is False
            assert any(e["type"] == "clash" and "already teaching section CSE-B" in e["message"] for e in data["errors"])


class TestImportApply:
    def test_apply_invalid_returns_422_and_does_not_mutate(self, client):
        before = client.get("/api/timetable?section=CSE-A", headers=H("H01")).json()
        rows = [_row(faculty="F99")]
        r = client.post(f"{IMPORT_URL}?dry_run=false", json={"rows": rows}, headers=H("H01"))
        assert r.status_code == 422
        assert r.json()["error"] == "validation"

        after = client.get("/api/timetable?section=CSE-A", headers=H("H01")).json()
        assert len(before) == len(after)

    def test_apply_valid_replaces_target_section_and_preserves_others(self, client):
        before_b = client.get("/api/timetable?section=CSE-B", headers=H("H01")).json()

        # Build a valid replacement for CSE-A using its designated teachers and rooms
        # On MON P1 and P2, F01 teaches CSE-A
        rows = [
            _row(section="CSE-A", day="MON", period=1, subject="DS", faculty="F01", room="R101"),
            _row(section="CSE-A", day="MON", period=2, subject="DSL", faculty="F01", room="LAB1"),
        ]
        r = client.post(f"{IMPORT_URL}?dry_run=false",
                        json={"rows": rows, "replace_sections": ["CSE-A"]},
                        headers=H("H01"))
        assert r.status_code == 200
        data = r.json()
        assert data["valid"] is True
        assert data["imported"] == 2

        # Verify: CSE-A now has exactly 2 slots
        after_a = client.get("/api/timetable?section=CSE-A", headers=H("H01")).json()
        assert len(after_a) == 2
        assert [s["period"] for s in after_a] == [1, 2]

        # Verify: Today endpoint reflects the new slots
        today_res = client.get("/api/today", headers=H("S001")).json()
        if today_res["day"] == "MON":
            assert len(today_res["slots"]) == 2

        # Verify: CSE-B was preserved
        after_b = client.get("/api/timetable?section=CSE-B", headers=H("H01")).json()
        assert len(before_b) == len(after_b)

    def test_apply_replaces_multiple_sections(self, client):
        rows = [
            _row(section="CSE-A", day="MON", period=1, subject="DS", faculty="F01", room="R101"),
            _row(section="CSE-B", day="MON", period=1, subject="OOP", faculty="F02", room="R102"),
        ]
        r = client.post(f"{IMPORT_URL}?dry_run=false",
                        json={"rows": rows, "replace_sections": ["CSE-A", "CSE-B"]},
                        headers=H("H01"))
        assert r.status_code == 200
        data = r.json()
        assert data["valid"] is True
        assert data["imported"] == 2

    def test_demo_reset_after_import(self, client, monkeypatch):
        """HOD reset-demo restores the full seeded timetable."""
        monkeypatch.setenv("TARS_DEMO_MODE", "1")
        # First import a 1-slot timetable
        rows = [_row(section="CSE-A", day="MON", period=1, subject="DS", faculty="F01", room="R101")]
        client.post(f"{IMPORT_URL}?dry_run=false", json={"rows": rows, "replace_sections": ["CSE-A"]}, headers=H("H01"))
        assert len(client.get("/api/timetable?section=CSE-A", headers=H("H01")).json()) == 1

        # Reset demo
        res = client.post("/api/admin/reset-demo", headers=H("H01"))
        assert res.status_code == 200

        # Now CSE-A should have its full week of slots back
        restored = client.get("/api/timetable?section=CSE-A", headers=H("H01")).json()
        assert len(restored) > 1


class TestImportTars1:
    """Behaviour added when the import was ported to tars1."""

    @pytest.fixture(autouse=True)
    def fresh(self, db):
        self.con = db

    def apply(self, client, rows, sections):
        return client.post(f"{IMPORT_URL}?dry_run=false", json={"rows": rows, "replace_sections": sections},
                           headers=H("H01"))

    def test_template_rows_resolve(self, client):
        r = client.get(TEMPLATE_URL, headers=H("H01"))
        assert r.headers["content-type"].startswith("text/csv")
        rows = list(csv.DictReader(io.StringIO(r.text)))
        data = client.post(IMPORT_URL, json={"rows": rows}, headers=H("H01")).json()
        assert [e for e in data["errors"] if e["type"] != "clash"] == []

    def test_replace_section_without_rows_is_rejected(self, client):
        before = client.get("/api/timetable?section=CSE-B", headers=H("H01")).json()
        r = self.apply(client, [_row()], ["CSE-A", "CSE-B"])
        assert r.status_code == 422
        assert any(e["value"] == "CSE-B" and e["type"] == "missing" for e in r.json()["errors"])
        assert client.get("/api/timetable?section=CSE-B", headers=H("H01")).json() == before

    def test_422_lists_row_errors_and_summary(self, client):
        body = self.apply(client, [_row(faculty="F99")], ["CSE-A"]).json()
        assert body["errors"][0]["row"] == 1 and body["summary"]["errors"] == len(body["errors"])

    def test_faculty_losing_classes_are_notified(self, client):
        old = {r[0] for r in self.con.execute("SELECT DISTINCT faculty_id FROM slots WHERE section='CSE-A'")}
        bus.recent.clear()
        assert self.apply(client, [_row()], ["CSE-A"]).status_code == 200
        msgs = [m for m in bus.recent if m["event"] == "timetable_updated"]
        assert len(msgs) == 1 and len(old) > 1 and old <= set(msgs[0]["user_ids"])

    def test_calendar_events_of_replaced_slots_are_deleted(self, client, monkeypatch):
        with self.con:
            for sec in ("CSE-A", "CSE-B"):
                self.con.execute("UPDATE slots SET gcal_event_id=? WHERE id=(SELECT MIN(id) FROM slots WHERE section=?)",
                                 (f"ev-{sec}", sec))
        deleted = []
        monkeypatch.setattr(gcal.calendar, "delete_events", deleted.extend)
        assert self.apply(client, [_row()], ["CSE-A"]).status_code == 200
        assert deleted == ["ev-CSE-A"]

    def test_db_clash_returns_409_and_rolls_back(self, client):
        with self.con:  # simulates a conflicting write landing after validation
            self.con.execute("CREATE TRIGGER late BEFORE INSERT ON slots BEGIN SELECT RAISE(ABORT, 'clash'); END")
        before = client.get("/api/timetable?section=CSE-A", headers=H("H01")).json()
        r = self.apply(client, [_row()], ["CSE-A"])
        assert (r.status_code, r.json()["error"]) == (409, "clash")
        assert client.get("/api/timetable?section=CSE-A", headers=H("H01")).json() == before

    def decision(self, status, section="CSE-A", changes=None):
        sid = self.con.execute("SELECT MIN(id) FROM slots WHERE section=?", (section,)).fetchone()[0]
        with self.con:
            return self.con.execute("INSERT INTO decisions (trigger, summary, affected_slot_ids, status, changes) "
                                    "VALUES ('absence','x',?,?,?)", (f"[{sid}]", status, changes)).lastrowid

    @pytest.mark.parametrize("status", ["proposed", "pending_ack"])
    def test_open_decision_on_replaced_section_blocks_import(self, client, status):
        did = self.decision(status)
        before = client.get("/api/timetable?section=CSE-A", headers=H("H01")).json()
        r = self.apply(client, [_row()], ["CSE-A"])
        assert (r.status_code, r.json()["error"]) == (409, "invalid_state")
        assert str(did) in r.json()["detail"]
        assert client.get("/api/timetable?section=CSE-A", headers=H("H01")).json() == before

    @pytest.mark.parametrize("status", ["proposed", "pending_ack"])
    def test_dry_run_reports_open_decisions(self, client, status):
        did = self.decision(status)
        d = client.post(IMPORT_URL, json={"rows": [_row()], "replace_sections": ["CSE-A"]}, headers=H("H01")).json()
        assert d["valid"] is False and d["preview"] is None and d["summary"]["errors"] == 1
        assert [(e["type"], e["field"], e["value"], e["row"]) for e in d["errors"]] == [("blocked", "decision", str(did), None)]

    def test_dry_run_infers_sections_for_blockers_and_lists_row_errors_too(self, client):
        self.decision("pending_ack")
        d = client.post(IMPORT_URL, json={"rows": [_row(), _row(period=2, faculty="F99")]}, headers=H("H01")).json()
        assert {e["type"] for e in d["errors"]} == {"blocked", "unknown"}

    @pytest.mark.parametrize("status,section", [("pending_ack", "CSE-B"), ("committed", "CSE-A"), ("acknowledged", "CSE-A"),
                                                ("rejected", "CSE-A"), ("escalated", "CSE-A")])
    def test_dry_run_agrees_with_import_when_not_blocked(self, client, status, section):
        self.decision(status, section=section)
        assert client.post(IMPORT_URL, json={"rows": [_row()]}, headers=H("H01")).json()["valid"] is True
        assert self.apply(client, [_row()], ["CSE-A"]).status_code == 200

    def test_failed_calendar_delete_is_logged_and_import_succeeds(self, client, monkeypatch, caplog):
        with self.con:
            self.con.execute("UPDATE slots SET gcal_event_id='ev-1' WHERE id=(SELECT MIN(id) FROM slots WHERE section='CSE-A')")
        svc = MagicMock()
        svc.events().delete.return_value.execute.side_effect = RuntimeError("boom")
        cal = gcal.Calendar(service=svc)
        monkeypatch.setenv("GOOGLE_CALENDAR_ID", "test")
        monkeypatch.setattr(gcal, "calendar", cal)
        assert self.apply(client, [_row()], ["CSE-A"]).status_code == 200
        cal.wait_idle()
        assert "Calendar delete failed for event ev-1" in caplog.text

    def test_calendar_off_is_logged_and_import_succeeds(self, client, caplog):
        with self.con:
            self.con.execute("UPDATE slots SET gcal_event_id='ev-1' WHERE id=(SELECT MIN(id) FROM slots WHERE section='CSE-A')")
        assert self.apply(client, [_row()], ["CSE-A"]).status_code == 200
        assert "calendar is off" in caplog.text and "ev-1" in caplog.text

    def test_reset_demo_still_deletes_its_events(self, client, monkeypatch):
        monkeypatch.setenv("TARS_DEMO_MODE", "1")
        with self.con:
            self.con.execute("UPDATE slots SET gcal_event_id='ev-1' WHERE id=(SELECT MIN(id) FROM slots)")
        deleted = []
        monkeypatch.setattr(gcal.calendar, "delete_events", deleted.extend)
        assert client.post("/api/admin/reset-demo", headers=H("H01")).status_code == 200
        assert deleted == ["ev-1"]

    @pytest.mark.parametrize("status", ["committed", "acknowledged", "rejected", "escalated"])
    def test_other_decisions_do_not_block_import(self, client, status):
        self.decision(status)
        assert self.apply(client, [_row()], ["CSE-A"]).status_code == 200

    def test_open_decision_on_other_section_does_not_block(self, client):
        self.decision("pending_ack", section="CSE-B")
        assert self.apply(client, [_row()], ["CSE-A"]).status_code == 200

    def test_import_works_after_hod_resolves_decision(self, client):
        did = self.decision("pending_ack")
        assert client.post(f"/api/decisions/{did}/approve", headers=H("H01")).status_code == 200
        assert self.apply(client, [_row()], ["CSE-A"]).status_code == 200

    def test_stale_change_is_refused_after_import(self, client):
        sid = self.con.execute("SELECT MIN(id) FROM slots WHERE section='CSE-A'").fetchone()[0]
        assert self.apply(client, [_row()], ["CSE-A"]).status_code == 200
        with pytest.raises(ClashError):
            actions.apply_changes(self.con, [{"slot_id": sid, "status": "cancelled"}])

    def test_calendar_save_finishing_after_import_is_removed(self, client, monkeypatch):
        sid = self.con.execute("SELECT MIN(id) FROM slots WHERE section='CSE-A'").fetchone()[0]
        did = self.decision("committed")
        svc = MagicMock()

        def slow_insert(**_):  # the slot is replaced while Google is saving the event
            with use_db() as c, c:
                c.execute("DELETE FROM slots WHERE id=?", (sid,))
            return {"id": "late-ev", "htmlLink": "http://x"}
        svc.events().insert.return_value.execute.side_effect = slow_insert
        cal = gcal.Calendar(service=svc)
        monkeypatch.setenv("GOOGLE_CALENDAR_ID", "test")
        assert cal._sync(did, [(sid, "moved")], []) == []
        svc.events().delete.assert_called_once_with(calendarId="test", eventId="late-ev")
