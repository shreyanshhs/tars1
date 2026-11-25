import json

import pytest
from conftest import H
from fastapi.testclient import TestClient

from app import bus, seed


@pytest.fixture
def api(db):
    from app.main import app
    return TestClient(app)


def test_list_faculty(api):
    fac = api.get("/api/faculty", headers=H("S001")).json()  # any logged-in role may read
    assert [f["faculty_id"] for f in fac] == [f"F0{i}" for i in range(1, 9)]
    f08 = next(f for f in fac if f["faculty_id"] == "F08")
    assert f08["subjects"] == ["DS", "MATH"] and f08["load"] == 5 and f08["max_load"] == 18
    assert set(f08) == {"faculty_id", "name", "subjects", "max_load", "load"}
    assert api.get("/api/faculty").status_code == 401


def test_rename_faculty_hod_only(api):
    body = {"name": "New Name"}
    assert api.patch("/api/faculty/F08", json=body, headers=H("S001")).status_code == 403
    assert api.patch("/api/faculty/F08", json=body, headers=H("F08")).status_code == 403
    assert api.patch("/api/faculty/F08", json=body).status_code == 401
    assert api.patch("/api/faculty/F99", json=body, headers=H("H01")).status_code == 404


def test_rename_faculty_validation(api):
    for bad in ({"name": "   "}, {"name": "x" * 81}, {}, {"name": 5}):
        r = api.patch("/api/faculty/F08", json=bad, headers=H("H01"))
        assert r.status_code == 422 and r.json()["error"] == "validation", bad


def test_rename_faculty_propagates_and_emits(api, db):
    bus.recent.clear()
    r = api.patch("/api/faculty/F08", json={"name": "  Dr. Renamed Person  "}, headers=H("H01"))
    assert r.status_code == 200 and r.json()["name"] == "Dr. Renamed Person" and r.json()["faculty_id"] == "F08"

    # every place the name is read from now shows the new one
    assert api.get("/api/me", headers=H("F08")).json()["name"] == "Dr. Renamed Person"
    slots = api.get("/api/timetable/faculty/F08", headers=H("S001")).json()
    assert slots and all(s["faculty_name"] == "Dr. Renamed Person" for s in slots)
    assert next(u for u in api.get("/api/auth/demo-users").json() if u["user_id"] == "F08")["name"] == "Dr. Renamed Person"

    # one timetable_updated per section F08 teaches, with exactly F08's slot ids, to that section + F08 + HOD
    expected = {}
    for s in slots:
        expected.setdefault(s["section"], set()).add(s["id"])
    msgs = [m for m in bus.recent if m["event"] == "timetable_updated"]
    assert {m["data"]["section"]: set(m["data"]["slot_ids"]) for m in msgs} == expected
    assert all(m["sections"] == [m["data"]["section"]] and m["user_ids"] == ["F08"] and m["hod"] for m in msgs)


def test_rename_faculty_without_slots_emits_nothing(api, db):
    db.execute("DELETE FROM slots WHERE faculty_id = 'F07'")
    db.commit()
    bus.recent.clear()
    assert api.patch("/api/faculty/F07", json={"name": "Someone"}, headers=H("H01")).status_code == 200
    assert not [m for m in bus.recent if m["event"] == "timetable_updated"]


def test_names_come_from_seed_data_json(tmp_path, monkeypatch):
    """Renaming in seed_data.json (no code change) flows into the DB, the API and the mock text."""
    data = seed.load_data()
    for f in data["faculty"]:
        if f["id"] == "F08":
            f["name"] = "Prof. Edited Injson"
    for s in data["students"]:
        if s["id"] == "S001":
            s["name"] = "Edited Student"
    path = tmp_path / "seed_data.json"
    path.write_text(json.dumps(data))
    monkeypatch.setattr(seed, "DATA", path)
    monkeypatch.setattr(seed, "DB", tmp_path / "tars.db")
    monkeypatch.setattr(seed, "MOCK", tmp_path / "mock")
    monkeypatch.setenv("TARS_DB", str(tmp_path / "tars.db"))
    monkeypatch.setenv("TARS_DEMO_PASSWORD", "pw-for-tests")
    seed.main()

    from app.main import app
    api = TestClient(app)
    login = api.post("/api/auth/login", json={"login_id": "1AB25CS001", "password": "pw-for-tests"}).json()
    assert login["user"]["name"] == "Edited Student"
    assert next(f for f in api.get("/api/faculty", headers=H("H01")).json() if f["faculty_id"] == "F08")["name"] \
        == "Prof. Edited Injson"
    mock = tmp_path / "mock"
    assert "Prof. Edited Injson" in (mock / "stream_events.json").read_text()
    assert "Prof. Injson" in (mock / "decisions.json").read_text()  # short form in prose
    assert json.loads((mock / "me.json").read_text())["name"] == "Edited Student"
