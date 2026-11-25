import json

from app import seed


def test_mock_text_matches_real_demo_slot(db, tmp_path):
    """Mock decision/nudge/stream text must name the real period and time of the demo DS class."""
    demo = seed.load_data()["demo"]
    period, start = db.execute(
        "SELECT s.period, p.start FROM slots s JOIN periods p USING(period) WHERE s.section=? AND "
        "s.subject_code=? AND s.day=? AND s.faculty_id=?",
        (demo["section"], demo["subject"], demo["day"], demo["absent_faculty"])).fetchone()
    when = f"{demo['day']} P{period}"
    mock = tmp_path / "mock"  # the db fixture seeds with MOCK pointed here

    decision = json.loads((mock / "decisions.json").read_text())[0]
    assert f"({when})" in decision["summary"] and f"is free {when}" in decision["reasoning"]
    nudge = json.loads((mock / "nudges.json").read_text())[0]
    assert nudge["body"].startswith(f"DS at {start} ")
    stream = (mock / "stream_events.json").read_text()
    assert f"find_substitute(DS, {when})" in stream and f"DS at {start} " in stream
