"""
TARS seed: builds tars.db (clash-free timetable) and exports mock JSON for the frontend to docs/mock/.
All data (names, rooms, subjects, assignments, attendance, events) lives in seed_data.json:
edit that file, never this one. Run from the repo root:   python3 backend/app/seed.py
Standard library only (python-dotenv is used when run as a script, to read TARS_DEMO_PASSWORD).
"""
import json, os, random, sqlite3
from pathlib import Path

try:
    from . import auth          # imported as app.seed
except ImportError:
    import auth                 # run as a script: python3 app/seed.py

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "backend" / "tars.db"
SCHEMA = Path(__file__).with_name("schema.sql")
DATA = Path(__file__).with_name("seed_data.json")
MOCK = ROOT / "docs" / "mock"  # mock API responses for the frontend (backend never writes into frontend/)
DAYS = ["MON", "TUE", "WED", "THU", "FRI"]


def load_data(path: Path = None) -> dict:
    return json.loads((path or DATA).read_text(encoding="utf-8"))


def build_timetable(data: dict) -> list[tuple]:
    """Greedy random placement with retries; guarantees no section/faculty/room clash."""
    seed = data.get("timetable_seed", 7)
    hours = {s["code"]: s["hours_per_week"] for s in data["subjects"]}
    labs = {s["code"] for s in data["subjects"] if s["is_lab"]}
    lab_rooms = [r["id"] for r in data["rooms"] if r["kind"] == "lab"]
    periods = [p["period"] for p in data["periods"]]
    rng = random.Random(seed)
    for _ in range(500):
        busy_fac, busy_room, slots, ok = set(), set(), [], True
        for section, cfg in data["sections"].items():
            subj_map = cfg["teachers"]
            todo = [s for s, n in hours.items() for _ in range(n)]
            rng.shuffle(todo)
            cells = [(d, p) for d in DAYS for p in periods]
            rng.shuffle(cells)
            per_day = {}
            for subj in todo:
                fac = subj_map[subj]
                placed = False
                for cell in cells:
                    d, p = cell
                    if (d, subj) in per_day and subj not in labs and per_day[(d, subj)] >= 1:
                        continue  # max 1 theory class of a subject per day
                    if (fac, d, p) in busy_fac:
                        continue
                    rooms = lab_rooms if subj in labs else [cfg["home_room"]]
                    room = next((r for r in rooms if (r, d, p) not in busy_room), None)
                    if room is None:
                        continue
                    busy_fac.add((fac, d, p)); busy_room.add((room, d, p))
                    per_day[(d, subj)] = per_day.get((d, subj), 0) + 1
                    slots.append((d, p, section, subj, fac, room))
                    cells.remove(cell); placed = True
                    break
                if not placed:
                    ok = False; break
            if not ok:
                break
        if ok:
            return slots
        seed += 1; rng = random.Random(seed)
    raise RuntimeError("could not build a clash-free timetable")


def main():
    data = load_data()
    DB.unlink(missing_ok=True)
    con = sqlite3.connect(DB)
    con.executescript(SCHEMA.read_text())
    cur = con.cursor()
    cur.executemany("INSERT INTO periods VALUES (?,?,?)", [(p["period"], p["start"], p["end"]) for p in data["periods"]])
    cur.executemany("INSERT INTO subjects VALUES (?,?,?)", [(s["code"], s["name"], int(s["is_lab"])) for s in data["subjects"]])
    cur.executemany("INSERT INTO rooms VALUES (?,?,?,?)", [(r["id"], r["name"], r["kind"], r["capacity"]) for r in data["rooms"]])
    for f in data["faculty"]:
        cur.execute("INSERT INTO users (id,name,role) VALUES (?,?, 'faculty')", (f["id"], f["name"]))
        cur.execute("INSERT INTO faculty (id,subjects,max_load) VALUES (?,?,?)",
                    (f["id"], ",".join(f["subjects"]), f.get("max_load", 18)))
    cur.executemany("INSERT INTO users (id,name,role,section,usn) VALUES (?,?,'student',?,?)",
                    [(s["id"], s["name"], s["section"], s["usn"]) for s in data["students"]])
    cur.executemany("INSERT INTO users (id,name,role) VALUES (?,?,'hod')", [(h["id"], h["name"]) for h in data["hods"]])
    for sec, m in data["attendance"].items():
        cur.executemany("INSERT INTO attendance VALUES (?,?,?)", [(sec, s, v) for s, v in m.items()])
    cur.executemany("INSERT INTO events (title,org,venue,day,start,end) VALUES (?,?,?,?,?,?)",
                    [(e["title"], e["org"], e["venue"], e["day"], e["start"], e["end"]) for e in data["events"]])
    cur.executemany("INSERT INTO slots (day,period,section,subject_code,faculty_id,room_id) VALUES (?,?,?,?,?,?)",
                    build_timetable(data))
    apply_demo_password(con, keep_if_unset=False)
    con.commit()
    export_mock(con, data)

    demo = data["demo"]
    rows = con.execute("SELECT period, section, subject_code FROM slots WHERE faculty_id=? AND day=? ORDER BY period",
                       (demo["absent_faculty"], demo["day"])).fetchall()
    n = con.execute("SELECT COUNT(*) FROM slots").fetchone()[0]
    print(f"OK  tars.db created with {n} slots, 0 clashes (enforced by unique indexes)")
    print(f"Demo: {demo['absent_faculty']} absent {demo['day']} -> affects {[tuple(r) for r in rows]}")
    print(f"Mock JSON written to {MOCK}")
    con.close()


RESET_TABLES = ("event_rsvps", "ack_requests", "nudges", "decisions", "incidents", "slots", "attendance", "events")


def reset_demo(con, data: dict = None) -> int:
    """Restore the seeded state in place (used by POST /admin/reset-demo). Returns the slot count.

    Clears incidents, decisions, nudges, RSVPs and Telegram ack requests; rebuilds slots, attendance and
    events from seed_data.json with the same deterministic timetable and ids as a fresh seed. Users,
    faculty, rooms, subjects and periods are upserted from the JSON, so users.telegram_chat_id (phone
    links) is kept. Never touches .env or any secret. One transaction: all or nothing.
    """
    data = data or load_data()
    with con:
        for t in RESET_TABLES:  # children first (foreign keys)
            con.execute(f"DELETE FROM {t}")
        # ids restart like a fresh seed (DS demo slot stays 23), EXCEPT ack_requests: old Telegram
        # buttons ("ack:<id>") from a previous run must not hit a new run's request.
        restart = tuple(t for t in RESET_TABLES if t != "ack_requests")
        con.execute(f"DELETE FROM sqlite_sequence WHERE name IN ({','.join('?' * len(restart))})", restart)
        con.executemany("INSERT INTO periods VALUES (?,?,?) ON CONFLICT(period) DO UPDATE SET start=excluded.start, "
                        "end=excluded.end", [(p["period"], p["start"], p["end"]) for p in data["periods"]])
        con.executemany("INSERT INTO subjects VALUES (?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name, "
                        "is_lab=excluded.is_lab", [(s["code"], s["name"], int(s["is_lab"])) for s in data["subjects"]])
        con.executemany("INSERT INTO rooms VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, "
                        "kind=excluded.kind, capacity=excluded.capacity",
                        [(r["id"], r["name"], r["kind"], r["capacity"]) for r in data["rooms"]])
        people = ([(f["id"], f["name"], "faculty", None, None) for f in data["faculty"]]
                  + [(s["id"], s["name"], "student", s["section"], s["usn"]) for s in data["students"]]
                  + [(h["id"], h["name"], "hod", None, None) for h in data["hods"]])
        # upsert keeps telegram_chat_id (not in the SET list); seeded names come back if they were renamed
        con.executemany("INSERT INTO users (id,name,role,section,usn) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE "
                        "SET name=excluded.name, role=excluded.role, section=excluded.section, usn=excluded.usn", people)
        con.executemany("INSERT INTO faculty (id,subjects,max_load) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE "
                        "SET subjects=excluded.subjects, max_load=excluded.max_load",
                        [(f["id"], ",".join(f["subjects"]), f.get("max_load", 18)) for f in data["faculty"]])
        for sec, m in data["attendance"].items():
            con.executemany("INSERT INTO attendance VALUES (?,?,?)", [(sec, s, v) for s, v in m.items()])
        con.executemany("INSERT INTO events (title,org,venue,day,start,end) VALUES (?,?,?,?,?,?)",
                        [(e["title"], e["org"], e["venue"], e["day"], e["start"], e["end"]) for e in data["events"]])
        con.executemany("INSERT INTO slots (day,period,section,subject_code,faculty_id,room_id) VALUES (?,?,?,?,?,?)",
                        build_timetable(data))
        apply_demo_password(con, keep_if_unset=True)
    return con.execute("SELECT COUNT(*) FROM slots").fetchone()[0]


def apply_demo_password(con, keep_if_unset: bool) -> bool:
    """Hash TARS_DEMO_PASSWORD (from .env, never hardcoded) for every user, each with its own salt.
    Unset: seed leaves users without a password; reset keeps whatever hashes exist."""
    pw = os.environ.get("TARS_DEMO_PASSWORD", "")
    if not pw:
        if not keep_if_unset:
            print("WARNING: TARS_DEMO_PASSWORD not set: users have no password. Set it in .env and re-run, "
                  "or enable TARS_PASSWORDLESS_LOGIN=1 for local testing.")
        return False
    ids = [r[0] for r in con.execute("SELECT id FROM users")]
    con.executemany("UPDATE users SET password_hash = ? WHERE id = ?", [(auth.hash_password(pw), i) for i in ids])
    return True


def short_name(name: str) -> str:
    """'Prof. A B' -> 'Prof. B' for prose; plain names unchanged."""
    parts = name.split()
    return f"{parts[0]} {parts[-1]}" if len(parts) > 2 and parts[0].endswith(".") else name


def export_mock(con, data: dict):
    con.row_factory = sqlite3.Row
    MOCK.mkdir(parents=True, exist_ok=True)
    names = {u["id"]: u["name"] for u in data["faculty"] + data["students"] + data["hods"]}
    demo = data["demo"]
    absent, sub, student = names[demo["absent_faculty"]], names[demo["substitute"]], demo["student"]
    # the demo class itself (CSE-A DS with the absent faculty), so mock text matches the real timetable
    ds = con.execute("SELECT s.period, p.start, s.id FROM slots s JOIN periods p USING(period) WHERE s.section=? "
                     "AND s.subject_code=? AND s.day=? AND s.faculty_id=?",
                     (demo["section"], demo["subject"], demo["day"], demo["absent_faculty"])).fetchone()
    when, at, ds_id = f"{demo['day']} P{ds[0]}", ds[1], ds[2]  # e.g. "MON P2", "09:55", 23
    q = """SELECT s.id, s.day, s.period, p.start, p.end, s.section, s.subject_code,
                  sub.name AS subject_name, s.faculty_id, u.name AS faculty_name, s.room_id, s.status
           FROM slots s JOIN periods p USING(period) JOIN subjects sub ON sub.code=s.subject_code
           JOIN users u ON u.id=s.faculty_id WHERE s.section=? ORDER BY
           CASE s.day WHEN 'MON' THEN 1 WHEN 'TUE' THEN 2 WHEN 'WED' THEN 3 WHEN 'THU' THEN 4 ELSE 5 END, s.period"""
    for sec in data["sections"]:
        rows = [dict(r) for r in con.execute(q, (sec,))]
        (MOCK / f"timetable_{sec}.json").write_text(json.dumps(rows, indent=2))
    (MOCK / "attendance_CSE-A.json").write_text(json.dumps(
        [{"subject_code": s, "percent": v} for s, v in data["attendance"]["CSE-A"].items()], indent=2))
    me = next(s for s in data["students"] if s["id"] == student)
    (MOCK / "me.json").write_text(json.dumps({"user_id": me["id"], "usn": me["usn"], "name": me["name"],
                                              "role": "student", "section": me["section"]}, indent=2))
    demo_users = [dict(user_id=s["id"], usn=s["usn"], name=s["name"], role="student", section=s["section"])
                  for s in data["students"]]
    demo_users += [dict(user_id=h["id"], usn=None, name=h["name"], role="hod", section=None) for h in data["hods"]]
    demo_users += [dict(user_id=f["id"], usn=None, name=f["name"], role="faculty", section=None) for f in data["faculty"]]
    (MOCK / "demo_users.json").write_text(json.dumps(demo_users, indent=2))
    sid = demo["substitute"]
    step = lambda ts, st, ph, text: {"event": "agent_step", "data": {"decision_id": 1, "step": st, "phase": ph,
                                                                     "text": text, "ts": f"2026-11-25T10:42:{ts}"}}
    (MOCK / "stream_events.json").write_text(json.dumps([
        step("01", "perceive", "signal", f"{absent} absent MON: 2 slots affected (CSE-A P1 DSL, P2 DS)"),
        step("02", "tool_call", "evaluate", "get_attendance(CSE-A, DS) -> 71%"),
        step("03", "tool_call", "match", f"find_substitute(DS, {when}) -> {sub} (load 5)"),
        step("03", "reason", "constraints", f"Constraints OK: slot {ds_id}: CSE-A DS attendance 71% < 75%: cancel blocked, {sid} can teach DS"),
        step("04", "tool_call", "resolve", "validate_clash(1 change(s)) -> OK, no section/faculty/room clash"),
        step("04", "tool_call", "dispatch", "commit_change(1 change(s)) -> ok"),
        step("04", "act", "dispatch", f"Committed 1 change(s), sent 2 nudge(s): Data Structures on {when.split()[0]} at {at} is now with {sub}, same room."),
        {"event": "timetable_updated", "data": {"section": "CSE-A", "slot_ids": [1, 2]}},
        {"event": "nudge_created", "data": {"id": 3, "user_id": student, "kind": "replan", "title": "TARS re-planned your day", "body": f"DS at {at} is now with {sub}.", "created_at": "2026-11-25T10:42:05", "read": False, "snoozed_until": None, "blocked": False}},
        step("05", "act", "dispatch", "Calendar: saving 1 event(s) in the background"),
        step("06", "done", "dispatch", "Decision #1: pending_ack"),
        step("07", "act", "dispatch", f"Calendar event created: DS (CSE-A): {sub} substituting, DS (CSE-A) {when.split()[0]} {at}"),
    ], indent=2))
    (MOCK / "events.json").write_text(json.dumps(
        [dict(id=i + 1, **e, clashes_with=[], rsvp=False, rsvp_count=0) for i, e in enumerate(data["events"])], indent=2))
    (MOCK / "decisions.json").write_text(json.dumps([{
        "id": 1, "created_at": "2026-11-25T10:42:00", "trigger": "absence",
        "summary": f"{absent} absent: CSE-A DS ({when}) reassigned to {sub} in R101",
        "reasoning": f"CSE-A DS attendance is 71% (<75%), so cancelling was rejected. {short_name(sub)} teaches DS, is free {when} and has the lowest weekly load (5).",
        "affected_slot_ids": [1], "status": "pending_ack",
        "calendar_link": "https://calendar.example/mock-event"}], indent=2))  # v0.6 (placeholder, not a real event)
    (MOCK / "nudges.json").write_text(json.dumps([
        {"id": 1, "user_id": student, "kind": "replan", "title": "TARS re-planned your day",
         "body": f"DS at {at} is now with {sub}, same room.", "created_at": "2026-11-25T10:43:00", "read": False, "snoozed_until": None, "blocked": False},
        {"id": 2, "user_id": student, "kind": "free_slot", "title": "Free slot recommended",
         "body": "You're free 14:40–15:35. DS assignment due tomorrow; block it?", "created_at": "2026-11-25T09:00:00", "read": False, "snoozed_until": None, "blocked": False}], indent=2))
    (MOCK / "login.json").write_text(json.dumps({  # v0.5 POST /auth/login (placeholder token, not valid)
        "token": "mock-token-not-valid", "token_type": "bearer", "expires_at": "2026-11-25T22:42:00Z",
        "user": {"user_id": me["id"], "usn": me["usn"], "name": me["name"], "role": "student",
                 "section": me["section"]}}, indent=2))
    (MOCK / "stream_ticket.json").write_text(json.dumps({  # v0.5 POST /auth/stream-ticket
        "ticket": "mock-ticket-not-valid", "expires_at": "2026-11-25T10:43:03Z"}, indent=2))
    (MOCK / "meta.json").write_text(json.dumps({  # v0.4 GET /meta (demo_mode true so the reset button shows)
        "demo_mode": True, "days": DAYS, "periods": data["periods"],
        "incident_types": ["absence", "room_unavailable"]}, indent=2))
    (MOCK / "stats.json").write_text(json.dumps({"classes_lost": 0, "rescued": 4, "nudges_acted": 17, "avg_response_s": 38}, indent=2))


if __name__ == "__main__":
    try:
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env")   # only to read TARS_DEMO_PASSWORD; nothing is written back
    except ImportError:
        pass
    main()
