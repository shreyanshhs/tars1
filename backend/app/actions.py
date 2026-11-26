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


def _approved(after: dict, where: str = "") -> str:
    name = after["faculty_name"]
    return f"the HOD approved {name} as substitute{where}. {name} has not confirmed yet."


def describe(before: dict, after: dict) -> str:
    """Human sentence for students. HOD approval isn't the substitute's acceptance, so a substitution never reads as settled:
    'Data Structures on MON at 09:55: the HOD approved <faculty name> as substitute, same room. <faculty name> has not
    confirmed yet.'"""
    subj = after["subject_name"]
    when_before = f"{before['day']} at {before['start']}"
    if after["status"] == "cancelled":
        return f"{subj} on {when_before} is cancelled."
    moved = (before["day"], before["period"]) != (after["day"], after["period"])
    new_fac = before["faculty_id"] != after["faculty_id"]
    new_room = before["room_id"] != after["room_id"]
    if moved:
        s = f"{subj} moved from {when_before} to {after['day']} at {after['start']} in {after['room_id']}"
        return s + (f". {_approved(after)}" if new_fac else ".")
    if new_fac:
        return f"{subj} on {when_before}: " + _approved(after, f" in {after['room_id']}" if new_room else ", same room")
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
        substituted = after["faculty_id"] != b["faculty_id"] and after["status"] != "cancelled"
        for (uid,) in con.execute("SELECT id FROM users WHERE role = 'student' AND section = ?",
                                  (after["section"],)).fetchall():
            nudges.append(create_nudge(con, uid, "replan", "Substitute approved, not confirmed" if substituted
                                       else "TARS re-planned your day", text))
        if substituted:
            nudges.append(create_nudge(
                con, after["faculty_id"], "replan", "HOD approved you as substitute: not confirmed",
                f"{after['section']} {after['subject_name']}, {after['day']} {after['start']}–{after['end']} "
                f"in {after['room_id']} (for {b['faculty_name']}). This is the HOD's approval, not your acceptance. "
                "If you can't cover it, tell the HOD."))

    for section in out["sections"]:
        sec_slots = [s for s in out["slots"] if s["section"] == section]
        faculty = {s["faculty_id"] for s in sec_slots} | {before[s["id"]]["faculty_id"] for s in sec_slots}
        bus.publish("timetable_updated", {"section": section, "slot_ids": [s["id"] for s in sec_slots]},
                    sections=[section], user_ids=faculty)
    return {**out, "nudge_ids": [n["id"] for n in nudges]}
