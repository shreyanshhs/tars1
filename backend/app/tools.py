"""Agent tools: plain Python over tars.db. Gemini will call these via function calling later.

Every tool takes an optional `con` (tests / request-scoped connection); otherwise it opens its own.
Return values are JSON-serialisable dicts/lists so they can go straight back to the LLM.
"""
import json
import sqlite3
from typing import Optional

from .db import DAYS, fetch_slots, use_db
from .validator import ClashError, ClashResult, load_slots, validate_clash

ATTENDANCE_THRESHOLD = 75.0
TRIGGERS = {"absence", "room_unavailable", "manual", "event_clash"}
DECISION_STATUSES = {"proposed", "committed", "pending_ack", "acknowledged", "escalated", "rejected"}


def get_timetable(section: Optional[str] = None, faculty_id: Optional[str] = None,
                  day: Optional[str] = None, con: Optional[sqlite3.Connection] = None) -> list[dict]:
    """Slots (contract Slot shape) filtered by any of section / faculty_id / day."""
    where, params = [], []
    for col, val in (("s.section", section), ("s.faculty_id", faculty_id), ("s.day", day)):
        if val is not None:
            where.append(f"{col} = ?")
            params.append(val)
    with use_db(con) as c:
        return fetch_slots(c, " AND ".join(where), tuple(params))


def find_free_rooms(day: str, period: int, kind: Optional[str] = None,
                    con: Optional[sqlite3.Connection] = None) -> list[dict]:
    """Rooms with no non-cancelled slot at day+period, optionally of one kind (classroom|lab|hall)."""
    sql = """SELECT r.id, r.name, r.kind, r.capacity FROM rooms r
             WHERE NOT EXISTS (SELECT 1 FROM slots s WHERE s.room_id = r.id AND s.day = ?
                               AND s.period = ? AND s.status != 'cancelled')"""
    params: list = [day, period]
    if kind:
        sql += " AND r.kind = ?"
        params.append(kind)
    with use_db(con) as c:
        return [dict(r) for r in c.execute(sql + " ORDER BY r.id", params)]


def faculty_loads(con: sqlite3.Connection) -> dict[str, int]:
    """Weekly non-cancelled slot count per faculty."""
    rows = con.execute("""SELECT f.id, COUNT(s.id) FROM faculty f
                          LEFT JOIN slots s ON s.faculty_id = f.id AND s.status != 'cancelled'
                          GROUP BY f.id""")
    return {fid: n for fid, n in rows}


def find_substitute(subject_code: str, day: str, period: int, exclude: Optional[list[str]] = None,
                    con: Optional[sqlite3.Connection] = None) -> Optional[dict]:
    """Best substitute: can teach the subject, free at day+period, under max_load, lowest load.

    Ties broken by faculty id. Returns {faculty_id, name, load, candidates[]} or None.
    """
    exclude = set(exclude or [])
    with use_db(con) as c:
        loads = faculty_loads(c)
        busy = {r[0] for r in c.execute(
            "SELECT faculty_id FROM slots WHERE day = ? AND period = ? AND status != 'cancelled'",
            (day, period))}
        candidates = []
        for r in c.execute("SELECT f.id, u.name, f.subjects, f.max_load FROM faculty f "
                           "JOIN users u ON u.id = f.id"):
            subjects = {x.strip() for x in r["subjects"].split(",")}
            if (subject_code in subjects and r["id"] not in busy and r["id"] not in exclude
                    and loads[r["id"]] < r["max_load"]):
                candidates.append({"faculty_id": r["id"], "name": r["name"], "load": loads[r["id"]]})
    if not candidates:
        return None
    candidates.sort(key=lambda x: (x["load"], x["faculty_id"]))
    return {**candidates[0], "candidates": candidates}


def get_attendance(section: str, subject_code: Optional[str] = None,
                   con: Optional[sqlite3.Connection] = None):
    """One subject → {section, subject_code, percent, below_threshold} (or None); else a list of them."""
    with use_db(con) as c:
        sql = "SELECT section, subject_code, percent FROM attendance WHERE section = ?"
        params: list = [section]
        if subject_code:
            sql += " AND subject_code = ?"
            params.append(subject_code)
        rows = [{**dict(r), "below_threshold": r["percent"] < ATTENDANCE_THRESHOLD}
                for r in c.execute(sql + " ORDER BY rowid", params)]
    if subject_code:
        return rows[0] if rows else None
    return rows


def propose_reschedule(slot_id: int, day: Optional[str] = None, period: Optional[int] = None,
                       con: Optional[sqlite3.Connection] = None) -> Optional[dict]:
    """Find a new day+period for a slot with the same faculty; does NOT write anything.

    Searches the given day/period if provided, else later periods the same day, then the following
    days. Keeps the original room if free, else any free room of the same kind.
    Returns {slot_id, from, to, change} where `change` can be passed to commit_change, or None.
    """
    with use_db(con) as c:
        current = load_slots(c)
        rooms = {r["id"]: r["kind"] for r in c.execute("SELECT id, kind FROM rooms")}
    slot = next((s for s in current if s["id"] == slot_id), None)
    if slot is None:
        raise ValueError(f"unknown slot_id {slot_id}")

    start = DAYS.index(slot["day"])
    day_order = [day] if day else DAYS[start:] + DAYS[:start]
    for d in day_order:
        periods = [period] if period else range(1, 7)
        for p in periods:
            if (d, p) == (slot["day"], slot["period"]):
                continue
            if d == slot["day"] and not period and p < slot["period"]:
                continue  # don't move a class earlier on the same day
            taken = {s["room_id"] for s in current
                     if s["day"] == d and s["period"] == p and s["status"] != "cancelled"}
            room_options = [slot["room_id"]] + sorted(
                r for r, k in rooms.items() if k == rooms[slot["room_id"]] and r != slot["room_id"])
            room = next((r for r in room_options if r not in taken), None)
            if room is None:
                continue
            change = {"slot_id": slot_id, "day": d, "period": p}
            if room != slot["room_id"]:
                change["room_id"] = room
            if validate_clash([change], current_slots=current).ok:
                return {"slot_id": slot_id,
                        "from": {"day": slot["day"], "period": slot["period"], "room_id": slot["room_id"]},
                        "to": {"day": d, "period": p, "room_id": room},
                        "change": change}
    return None


def commit_change(changes: list[dict], con: Optional[sqlite3.Connection] = None) -> dict:
    """Validate, then apply changes atomically. Raises ClashError (→ HTTP 409) if blocked.

    Slots touched get status 'replanned' unless the change sets a status (e.g. 'cancelled').
    Returns {ok, slot_ids, sections, slots} with slots in contract Slot shape.
    """
    changes = list(changes)
    if not changes:
        raise ValueError("no changes to commit")
    with use_db(con) as c:
        result = validate_clash(changes, con=c)
        if not result.ok:
            raise ClashError(result)
        try:
            with c:  # one transaction: all or nothing
                for ch in changes:
                    fields = {k: v for k, v in ch.items() if k != "slot_id"}
                    fields.setdefault("status", "replanned")
                    cols = ", ".join(f"{k} = ?" for k in fields)  # keys whitelisted by validator
                    c.execute(f"UPDATE slots SET {cols} WHERE id = ?", (*fields.values(), ch["slot_id"]))
        except sqlite3.IntegrityError as e:  # DB unique index: last line of defence
            raise ClashError(ClashResult(ok=False, errors=[f"db constraint: {e}"])) from e
        ids = sorted({ch["slot_id"] for ch in changes})
        slots = fetch_slots(c, f"s.id IN ({','.join('?' * len(ids))})", tuple(ids))
    return {"ok": True, "slot_ids": ids, "sections": sorted({s["section"] for s in slots}), "slots": slots}


def log_decision(trigger: str, summary: str, reasoning: str, affected_slot_ids: list[int],
                 status: str = "proposed", incident_id: Optional[int] = None,
                 con: Optional[sqlite3.Connection] = None) -> dict:
    """Insert a row into `decisions` and return it in contract Decision shape."""
    if trigger not in TRIGGERS:
        raise ValueError(f"invalid trigger {trigger!r}")
    if status not in DECISION_STATUSES:
        raise ValueError(f"invalid status {status!r}")
    with use_db(con) as c:
        with c:
            cur = c.execute("INSERT INTO decisions (incident_id, trigger, summary, reasoning, "
                            "affected_slot_ids, status) VALUES (?,?,?,?,?,?)",
                            (incident_id, trigger, summary, reasoning,
                             json.dumps([int(i) for i in affected_slot_ids]), status))
        return get_decision(cur.lastrowid, con=c)


def get_decision(decision_id: int, con: Optional[sqlite3.Connection] = None) -> Optional[dict]:
    """Decision in contract shape, or None."""
    with use_db(con) as c:
        r = c.execute("SELECT id, created_at, trigger, summary, reasoning, affected_slot_ids, status, calendar_link "
                      "FROM decisions WHERE id = ?", (decision_id,)).fetchone()
    if r is None:
        return None
    return {**dict(r), "affected_slot_ids": json.loads(r["affected_slot_ids"] or "[]")}


DECISION_FIELDS = {"summary", "reasoning", "affected_slot_ids", "status", "changes", "calendar_link"}


def update_decision(decision_id: int, con: Optional[sqlite3.Connection] = None, **fields) -> dict:
    """Update an existing decision (summary/reasoning/affected_slot_ids/status/changes)."""
    bad = set(fields) - DECISION_FIELDS
    if bad:
        raise ValueError(f"not updatable: {sorted(bad)}")
    if "status" in fields and fields["status"] not in DECISION_STATUSES:
        raise ValueError(f"invalid status {fields['status']!r}")
    for k in ("affected_slot_ids", "changes"):
        if k in fields and fields[k] is not None:
            fields[k] = json.dumps(fields[k])
    with use_db(con) as c:
        if fields:
            with c:
                c.execute(f"UPDATE decisions SET {', '.join(f'{k} = ?' for k in fields)} WHERE id = ?",
                          (*fields.values(), decision_id))
        return get_decision(decision_id, con=c)
