"""Side effects of a committed change: nudges for affected people + live events.

Used by the agent's commit_change tool and by HOD approval, so both paths notify the same way.
"""
import sqlite3

from . import bus, tools
from .db import NUDGE_SELECT, fetch_slots, nudge_dict


def create_nudge(con: sqlite3.Connection, user_id: str, kind: str, title: str, body: str) -> dict:
    with con:
        cur = con.execute("INSERT INTO nudges (user_id, kind, title, body) VALUES (?,?,?,?)",
                          (user_id, kind, title, body))
    nudge = nudge_dict(con.execute(f"{NUDGE_SELECT} WHERE id = ?", (cur.lastrowid,)).fetchone())
    bus.publish("nudge_created", nudge, user_ids=[user_id], hod=False)
    return nudge


def describe(before: dict, after: dict) -> str:
    """Human sentence for students, e.g. 'Data Structures on MON at 09:55 is now with <faculty name>, same room.'"""
    subj = after["subject_name"]
    when_before = f"{before['day']} at {before['start']}"
    if after["status"] == "cancelled":
        return f"{subj} on {when_before} is cancelled."
    moved = (before["day"], before["period"]) != (after["day"], after["period"])
    new_fac = before["faculty_id"] != after["faculty_id"]
    new_room = before["room_id"] != after["room_id"]
    if moved:
        s = f"{subj} moved from {when_before} to {after['day']} at {after['start']} in {after['room_id']}"
        return s + (f" with {after['faculty_name']}." if new_fac else ".")
    if new_fac:
        return (f"{subj} on {when_before} is now with {after['faculty_name']}"
                + (f" in {after['room_id']}." if new_room else ", same room."))
    if new_room:
        return f"{subj} on {when_before} moved to room {after['room_id']}."
    return f"{subj} on {when_before} was updated."


def apply_changes(con: sqlite3.Connection, changes: list[dict]) -> dict:
    """commit_change (validator first; raises ClashError) + nudges + timetable_updated events."""
    ids = sorted({c["slot_id"] for c in changes})
    before = {s["id"]: s for s in fetch_slots(con, f"s.id IN ({','.join('?' * len(ids))})", tuple(ids))}
    out = tools.commit_change(changes, con=con)

    nudges = []
    for after in out["slots"]:
        b = before[after["id"]]
        text = describe(b, after)
        for (uid,) in con.execute("SELECT id FROM users WHERE role = 'student' AND section = ?",
                                  (after["section"],)).fetchall():
            nudges.append(create_nudge(con, uid, "replan", "TARS re-planned your day", text))
        if after["faculty_id"] != b["faculty_id"] and after["status"] != "cancelled":
            nudges.append(create_nudge(
                con, after["faculty_id"], "replan", "You're covering a class",
                f"{after['section']} {after['subject_name']}, {after['day']} {after['start']}–{after['end']} "
                f"in {after['room_id']} (for {b['faculty_name']})."))

    for section in out["sections"]:
        sec_slots = [s for s in out["slots"] if s["section"] == section]
        faculty = {s["faculty_id"] for s in sec_slots} | {before[s["id"]]["faculty_id"] for s in sec_slots}
        bus.publish("timetable_updated", {"section": section, "slot_ids": [s["id"] for s in sec_slots]},
                    sections=[section], user_ids=faculty)
    return {**out, "nudge_ids": [n["id"] for n in nudges]}
