"""NPTEL requests: read and remind only. Seeded rows are simulated."""
import pytest
from conftest import H
from test_seed_bmsit import api, bmsit  # noqa: F401  (fixtures)

from app import tools
from app.db import ensure_tables

R = "/api/nptel/requests"


def first(api, who="H_SKB"):
    return api.get(R, headers=H(who)).json()[0]


def nudges(api):
    return api.get("/api/nudges", headers=H("S0000")).json()


def test_request_matches_the_frontend_type_and_is_labelled(api):
    r = first(api)
    assert set(r) == {"id", "faculty_id", "faculty_name", "title", "item", "sections", "due_date", "total_students",
                      "submitted_count", "verified_count", "flagged_count", "created_at"}
    assert (r["total_students"], r["submitted_count"], r["verified_count"], r["flagged_count"]) == (6, 4, 3, 1)
    assert "simulated" in r["title"] and r["sections"] == ["CSE-10"] and r["faculty_name"] == "Faculty GPL"


def test_submissions_match_the_frontend_type_and_filter(api):
    rid = first(api)["id"]
    rows = api.get(f"{R}/{rid}/submissions", headers=H("F_CDB")).json()
    assert len(rows) == 6 and set(rows[0]) == {"id", "request_id", "student_name", "usn", "section", "course_name", "score",
                                               "certificate_id", "status", "uploaded_at", "flags"}
    assert all("Simulated demo data" in x["flags"] and x["student_name"].startswith("Demo student") for x in rows)
    for status, n in (("verified", 3), ("flagged", 1), ("pending", 2)):
        got = api.get(f"{R}/{rid}/submissions?status={status}", headers=H("H_SKB")).json()
        assert len(got) == n and {x["status"] for x in got} == {status}
    assert api.get(f"{R}/{rid}/submissions?status=nope", headers=H("H_SKB")).status_code == 422


def test_students_see_only_their_section_and_their_own_row(api, bmsit):
    rid = first(api, "S0000")["id"]
    rows = api.get(f"{R}/{rid}/submissions", headers=H("S0000")).json()
    assert [x["usn"] for x in rows] == ["26UG1BYCS0000-T"]
    assert api.get(f"{R}/{rid}/submissions?status=verified", headers=H("S0000")).json() == []
    with bmsit:
        bmsit.execute("UPDATE nptel_requests SET sections = '[\"CSE-99\"]'")
    assert api.get(R, headers=H("S0000")).json() == []
    assert api.get(f"{R}/{rid}/submissions", headers=H("S0000")).status_code == 404


@pytest.mark.parametrize("who,code", [("S0000", 403), ("F_CDB", 403), ("F_SMP", 403), ("F_GPL", 200), ("H_SKB", 200)])
def test_who_may_remind(api, who, code):
    assert api.post(f"{R}/{first(api)['id']}/nudge", headers=H(who)).status_code == code
    assert len(nudges(api)) == (1 if code == 200 else 0)


def test_reminder_counts_only_real_nudges_and_does_not_repeat(api, bmsit):
    url, before = f"{R}/{first(api)['id']}/nudge", tools.get_timetable(con=bmsit)
    assert api.post(url, headers=H("F_GPL")).json() == {"nudged_count": 1}        # two pending, one has an account
    assert api.post(url, headers=H("F_GPL")).json() == {"nudged_count": 0}        # still unread
    (n,) = nudges(api)
    assert n["kind"] == "deadline" and "2026-12-15" in n["body"] and "simulated" in n["body"]
    api.post(f"/api/nudges/{n['id']}/read", headers=H("S0000"))
    assert api.post(url, headers=H("H_SKB")).json() == {"nudged_count": 1}
    assert tools.get_timetable(con=bmsit) == before


def test_login_needed_unknown_ids_and_no_fake_upload(api):
    rid = first(api)["id"]
    for method, url in (("get", R), ("get", f"{R}/{rid}/submissions"), ("post", f"{R}/{rid}/nudge")):
        assert getattr(api, method)(url).status_code == 401
    assert api.get(f"{R}/999/submissions", headers=H("H_SKB")).status_code == 404
    assert api.post(f"{R}/999/nudge", headers=H("H_SKB")).status_code == 404
    assert api.get(f"{R}/abc/submissions", headers=H("H_SKB")).status_code == 422
    assert api.post(f"{R}/{rid}/upload", headers=H("S0000")).status_code in (404, 405)   # nothing pretends to check a file


def test_reset_restores_requests(api, bmsit, monkeypatch):
    monkeypatch.setenv("TARS_DEMO_MODE", "1")
    before = first(api)
    with bmsit:
        bmsit.execute("DELETE FROM nptel_submissions")
    api.post("/api/admin/reset-demo", headers=H("H_SKB"))
    assert first(api) == before


def test_default_data_has_none(db):
    from fastapi.testclient import TestClient
    from app.main import app
    assert TestClient(app).get(R, headers=H("H01")).json() == []


def test_older_database_gets_the_tables_without_losing_data(api, bmsit):
    with bmsit:
        bmsit.execute("DROP TABLE nptel_submissions")
        bmsit.execute("DROP TABLE nptel_requests")
    before = tools.get_timetable(con=bmsit)
    ensure_tables()
    ensure_tables()
    assert api.get(R, headers=H("H_SKB")).json() == [] and tools.get_timetable(con=bmsit) == before
