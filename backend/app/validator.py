"""Clash validator: plain Python, never the LLM.

A *change* edits one existing slot:
    {"slot_id": 23, "faculty_id": "F08"}                 # substitute
    {"slot_id": 23, "day": "TUE", "period": 5}           # reschedule
    {"slot_id": 23, "room_id": "R104"}                   # room swap
    {"slot_id": 23, "status": "cancelled"}               # cancel
validate_clash() applies all changes in memory on top of the current timetable and checks that
no section, faculty or room holds two non-cancelled slots in the same day+period.
The DB unique indexes (schema.sql) remain the last line of defence.
"""
import sqlite3
from dataclasses import dataclass, field
from typing import Iterable, Optional

from .db import DAYS, use_db

EDITABLE = {"faculty_id", "room_id", "day", "period", "status"}
STATUSES = {"scheduled", "replanned", "cancelled"}
PERIODS = range(1, 7)
CHECKS = (("section", "section"), ("faculty", "faculty_id"), ("room", "room_id"))


@dataclass
class ClashResult:
    ok: bool
    clashes: list[dict] = field(default_factory=list)  # {kind, day, period, key, slot_ids}
    errors: list[str] = field(default_factory=list)    # malformed changes

    @property
    def detail(self) -> str:
        parts = list(self.errors)
        parts += [f"{c['kind']} {c['key']} double-booked {c['day']} P{c['period']} (slots {c['slot_ids']})"
                  for c in self.clashes]
        return "; ".join(parts) or "ok"

    def to_dict(self) -> dict:
        return {"ok": self.ok, "clashes": self.clashes, "errors": self.errors, "detail": self.detail}


class ClashError(Exception):
    def __init__(self, result: ClashResult):
        super().__init__(result.detail)
        self.result = result


def load_slots(con: sqlite3.Connection) -> list[dict]:
    return [dict(r) for r in con.execute(
        "SELECT id, day, period, section, subject_code, faculty_id, room_id, status FROM slots")]


def validate_clash(changes: Iterable[dict], current_slots: Optional[list[dict]] = None,
                   con: Optional[sqlite3.Connection] = None) -> ClashResult:
    """Check the timetable that would result from applying `changes`.

    `current_slots` lets callers (and tests) pass the timetable directly; otherwise it is read
    from `con` (or a fresh connection to tars.db).
    """
    if current_slots is None:
        with use_db(con) as c:
            current_slots = load_slots(c)

    state = {s["id"]: dict(s) for s in current_slots}
    errors: list[str] = []
    for ch in changes:
        sid = ch.get("slot_id")
        if sid not in state:
            errors.append(f"unknown slot_id {sid!r}")
            continue
        bad = set(ch) - EDITABLE - {"slot_id"}
        if bad:
            errors.append(f"slot {sid}: fields not editable: {sorted(bad)}")
            continue
        if "day" in ch and ch["day"] not in DAYS:
            errors.append(f"slot {sid}: invalid day {ch['day']!r}")
            continue
        if "period" in ch and ch["period"] not in PERIODS:
            errors.append(f"slot {sid}: invalid period {ch['period']!r}")
            continue
        if "status" in ch and ch["status"] not in STATUSES:
            errors.append(f"slot {sid}: invalid status {ch['status']!r}")
            continue
        state[sid].update({k: v for k, v in ch.items() if k != "slot_id"})

    clashes: list[dict] = []
    for kind, col in CHECKS:
        seen: dict[tuple, list[int]] = {}
        for s in state.values():
            if s["status"] == "cancelled":
                continue
            seen.setdefault((s["day"], s["period"], s[col]), []).append(s["id"])
        for (day, period, key), ids in seen.items():
            if len(ids) > 1:
                clashes.append({"kind": kind, "day": day, "period": period, "key": key,
                                "slot_ids": sorted(ids)})

    clashes.sort(key=lambda c: (DAYS.index(c["day"]), c["period"], c["kind"], str(c["key"])))
    return ClashResult(ok=not clashes and not errors, clashes=clashes, errors=errors)
