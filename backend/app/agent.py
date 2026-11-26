"""TARS agent: Gemini function-calling loop (Perceive → Reason → Act) over app/tools.py.

The LLM only *chooses*; every rule that matters is also enforced here in code:
  - only slots affected by the incident may change; no swaps (each change must be valid on its own)
  - substitutes must be able to teach the subject and can't be the absent faculty
  - no cancelling a <75% attendance class before substitute AND reschedule were tried and failed
  - nothing is applied here: every change is a proposal; HOD approval applies it (apply_approved)
  - every proposal goes through the clash validator, and again when it is applied
Gemini unavailable / failing → the same rules run with the deterministic substitute finder (run_fallback);
if that can't help either, the decision is marked `escalated`. Never raises.
"""
import json
import logging
import os
from datetime import datetime
from typing import Any, Optional

from . import actions, bus, gcal, notify, tools
from .db import DAYS, fetch_slots, period_numbers, use_db
from .validator import ClashError, ClashResult, validate_clash

log = logging.getLogger("tars.agent")

MAX_TURNS = 12
TIMEOUT_MS = 45_000  # per Gemini call
# Fallback chain: on 5xx / timeout the agent moves to the next model. Override with GEMINI_MODEL=a,b,c
DEFAULT_MODELS = "gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.6-flash"


def model_names() -> list[str]:
    return [m.strip() for m in os.environ.get("GEMINI_MODEL", DEFAULT_MODELS).split(",") if m.strip()]


def _is_transient(e: Exception) -> bool:
    """Overloaded / timed-out model → worth trying the next one."""
    code = getattr(e, "code", None)
    if isinstance(code, int) and (code >= 500 or code == 429):
        return True
    return "timeout" in type(e).__name__.lower() or "timed out" in str(e).lower()


SYSTEM_PROMPT = """You are TARS, the timetable agent of a college CSE department. You repair timetable
disruptions (a faculty absence or an unavailable room) using the tools provided. Never invent ids,
names or numbers: look them up with tools.

Work in a loop: PERCEIVE the incident and its affected slots, REASON about each slot, ACT with tools,
and repeat until every affected slot is handled.

Hard rules:
1. For every affected slot, first call get_attendance(section, subject_code).
2. If that attendance is below 75%: NEVER cancel first. Try find_substitute; if it returns none, try
   propose_reschedule; cancel only if both failed.
3. If attendance is 75% or more, still prefer substitute, then reschedule; cancel is the last resort.
4. Never do slot swaps. The only allowed changes are:
   a. substitution: same slot, new faculty_id (a faculty returned by find_substitute), and
   b. a move into a free cell: new day/period (and room_id) taken from propose_reschedule or
      find_free_rooms, and
   c. cancellation: {"slot_id": N, "status": "cancelled"}.
5. Absence: never assign the absent faculty and never move their class onto the day they are absent.
   Pass the absent faculty in find_substitute's `exclude`.
6. Change only the affected slots listed in the incident.
7. commit_change runs the clash validator. If it returns ok=false, pick another option.
   It never edits the timetable: every change is a proposal that the HOD approves or rejects.
8. When every slot is handled, call log_decision exactly once with a one-line summary and a reasoning
   paragraph citing the attendance %, the chosen faculty and their load (or the new time/room), and
   why other options were rejected. Then answer with one short sentence and stop.
"""


def _obj(props: dict, required: list[str]) -> dict:
    return {"type": "object", "properties": props, "required": required}


STR, INT = {"type": "string"}, {"type": "integer"}
DAY = {"type": "string", "enum": ["MON", "TUE", "WED", "THU", "FRI"]}
CHANGE = {"type": "object", "properties": {
    "slot_id": INT, "faculty_id": STR, "room_id": STR, "day": DAY, "period": INT,
    "status": {"type": "string", "enum": ["cancelled"]}}, "required": ["slot_id"]}

TOOL_SPECS = [
    ("get_timetable", "Slots filtered by any of section, faculty_id, day.",
     _obj({"section": STR, "faculty_id": STR, "day": DAY}, [])),
    ("get_attendance", "Attendance % of a section in a subject, with below_threshold (<75%).",
     _obj({"section": STR, "subject_code": STR}, ["section", "subject_code"])),
    ("find_substitute", "Best substitute for subject at day+period: can teach it, is free, lowest weekly "
     "load. Returns null if nobody fits.",
     _obj({"subject_code": STR, "day": DAY, "period": INT,
           "exclude": {"type": "array", "items": STR}}, ["subject_code", "day", "period"])),
    ("find_free_rooms", "Rooms free at day+period, optionally of kind classroom|lab|hall.",
     _obj({"day": DAY, "period": INT, "kind": STR}, ["day", "period"])),
    ("propose_reschedule", "Clash-free new day/period/room for a slot with the same faculty. Read-only. "
     "Returns {from, to, change} or null.",
     _obj({"slot_id": INT, "day": DAY, "period": INT}, ["slot_id"])),
    ("commit_change", "Propose changes (checked by the clash validator) to the HOD. Never edits the timetable.",
     _obj({"changes": {"type": "array", "items": CHANGE}}, ["changes"])),
    ("log_decision", "Record the final decision: one-line summary and full reasoning. Call once at the end.",
     _obj({"summary": STR, "reasoning": STR}, ["summary", "reasoning"])),
]


# UI re-planning flow. Every agent_step carries one of these as "phase" (contract v0.3).
PHASES = ("signal", "evaluate", "match", "constraints", "resolve", "dispatch", "escalate")
DEFAULT_PHASE = {"perceive": "signal", "reason": "evaluate", "tool_call": "evaluate", "act": "dispatch",
                 "done": "dispatch", "error": "escalate"}
TOOL_PHASE = {"get_timetable": "evaluate", "get_attendance": "evaluate",
              "find_substitute": "match", "find_free_rooms": "match", "propose_reschedule": "match",
              "commit_change": "dispatch", "log_decision": "dispatch"}


def tool_phase(name: str, result: Any) -> str:
    if isinstance(result, dict) and result.get("ok") is False:
        if result.get("error") == "rule_violation":
            return "constraints"
        if result.get("error") == "clash":
            return "resolve"
    return TOOL_PHASE.get(name, "evaluate")


class AgentUnavailable(Exception):
    pass


def make_client():
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        raise AgentUnavailable("GEMINI_API_KEY is not set")
    from google import genai
    from google.genai import types
    return genai.Client(api_key=key, http_options=types.HttpOptions(timeout=TIMEOUT_MS))


def affected_slots(con, type: str, day: str, periods: list[int], faculty_id: Optional[str] = None,
                   room_id: Optional[str] = None) -> list[dict]:
    col, val = ("s.faculty_id", faculty_id) if type == "absence" else ("s.room_id", room_id)
    marks = ",".join("?" * len(periods))
    return fetch_slots(con, f"{col} = ? AND s.day = ? AND s.period IN ({marks}) AND s.status != 'cancelled'",
                       (val, day, *periods))


def _short(slot: dict) -> dict:
    return {"slot_id": slot["id"], "day": slot["day"], "period": slot["period"], "start": slot["start"],
            "end": slot["end"], "section": slot["section"], "subject_code": slot["subject_code"],
            "subject_name": slot["subject_name"], "faculty_id": slot["faculty_id"],
            "faculty_name": slot["faculty_name"], "room_id": slot["room_id"], "status": slot["status"]}


class AgentRun:
    """State and tool implementations for one incident."""

    def __init__(self, con, incident: dict, decision_id: int):
        self.con, self.inc, self.decision_id = con, incident, decision_id
        self.slots = {s["id"]: s for s in affected_slots(
            con, incident["type"], incident["day"], incident["periods"],
            incident.get("faculty_id"), incident.get("room_id"))}
        self.handled: dict[int, str] = {}       # slot_id → "substituted" | "moved" | "cancel_proposed"
        self.proposed: list[dict] = []          # all changes awaiting HOD approval
        self.fallback_reason = ""
        self.source = "Gemini"                  # who made the recommendation; "fallback" when Gemini was not used
        self.no_substitute: set[int] = set()    # slots where find_substitute returned null
        self.no_reschedule: set[int] = set()    # slots where propose_reschedule returned null
        self.logged: Optional[dict] = None
        self.final_text = ""
        self.pending_acts: list[tuple[str, str]] = []  # (phase, text) "act" steps, emitted after their tool_call
        self.audience = [incident["reported_by"]]
        self.last_phase: Optional[str] = None

    # ----- events -----
    def step(self, step: str, text: str, phase: Optional[str] = None) -> None:
        if phase is None and step == "reason" and self.last_phase not in (None, "signal"):
            phase = self.last_phase  # model commentary belongs to the stage TARS is in
        phase = phase or DEFAULT_PHASE[step]
        assert phase in PHASES, phase
        self.last_phase = phase
        bus.publish("agent_step", {"decision_id": self.decision_id, "step": step, "phase": phase, "text": text,
                                   "ts": datetime.now().isoformat(timespec="seconds")},
                    user_ids=self.audience)

    def perceive_text(self) -> str:
        i = self.inc
        if i["type"] == "absence":
            who = self.con.execute("SELECT name FROM users WHERE id = ?", (i["faculty_id"],)).fetchone()
            head = (f"Faculty {i['faculty_id']} ({who['name'] if who else '?'}) is absent on {i['day']} "
                    f"periods {i['periods']}.")
        else:
            head = f"Room {i['room_id']} is unavailable on {i['day']} periods {i['periods']}."
        note = f" Note from reporter: {i['note']}" if i.get("note") else ""
        return (f"Incident #{i['id']} ({i['type']}). {head}{note}\nAffected slots:\n"
                + json.dumps([_short(s) for s in self.slots.values()], indent=1)
                + "\nResolve every affected slot following the rules.")

    # ----- tools exposed to the LLM -----
    def t_get_timetable(self, section=None, faculty_id=None, day=None):
        return [_short(s) for s in tools.get_timetable(section, faculty_id, day, con=self.con)]

    def t_get_attendance(self, section, subject_code):
        return tools.get_attendance(section, subject_code, con=self.con) or {"error": "no attendance data"}

    def t_find_substitute(self, subject_code, day, period, exclude=None):
        exclude = list(exclude or [])
        if self.inc["type"] == "absence":
            exclude.append(self.inc["faculty_id"])
        # whoever declined one of these classes on Telegram isn't asked again
        for sid, s in self.slots.items():
            if (s["subject_code"], s["day"], s["period"]) == (subject_code, day, int(period)):
                exclude += self._declined(sid)
        # proposals aren't in the timetable yet, so count them here
        exclude += [c["faculty_id"] for c in self.proposed
                    if "faculty_id" in c and self._when(c) == (day, int(period))]
        sub = tools.find_substitute(subject_code, day, int(period), exclude=exclude, con=self.con)
        if sub:
            extra = [c["faculty_id"] for c in self.proposed if "faculty_id" in c]
            limits = dict(self.con.execute("SELECT id, max_load FROM faculty").fetchall())
            cands = [{**c, "load": c["load"] + extra.count(c["faculty_id"])} for c in sub["candidates"]]
            cands = sorted((c for c in cands if c["load"] < limits[c["faculty_id"]]),
                           key=lambda c: (c["load"], c["faculty_id"]))
            sub = {**cands[0], "candidates": cands} if cands else None
        if sub is None:
            self.no_substitute |= {sid for sid, s in self.slots.items()
                                   if (s["subject_code"], s["day"], s["period"]) == (subject_code, day, int(period))}
        return sub

    def t_find_free_rooms(self, day, period, kind=None):
        return tools.find_free_rooms(day, int(period), kind, con=self.con)

    def t_propose_reschedule(self, slot_id, day=None, period=None):
        slot_id = int(slot_id)
        if slot_id not in self.slots:
            return {"error": f"slot {slot_id} is not affected by this incident"}
        if self.lab_locked(self.slots[slot_id]):
            self.no_reschedule.add(slot_id)
            return None
        day = day or None
        if day is None and self.inc["type"] == "absence":
            # search the other days first: the absent faculty can't teach on the incident day
            p = None
            for d in [d for d in ["MON", "TUE", "WED", "THU", "FRI"] if d != self.inc["day"]]:
                p = tools.propose_reschedule(slot_id, day=d, period=period, con=self.con)
                if p:
                    break
        else:
            p = tools.propose_reschedule(slot_id, day=day, period=period, con=self.con)
        if p is None and day is None and period is None:
            self.no_reschedule.add(slot_id)
        return p

    def _when(self, ch: dict) -> tuple[str, int]:
        slot = self.slots[ch["slot_id"]]
        return ch.get("day", slot["day"]), ch.get("period", slot["period"])

    def lab_locked(self, slot: dict) -> bool:
        """BMSIT demo: labs are never moved, so the two halves of a lab can't be split. Neither is a class whose
        timetable entry is unconfirmed (its time must stay blocked)."""
        if slot["subject_code"].startswith("UNCONFIRMED-"):
            return True
        return os.environ.get("TARS_SEED", "").strip().lower() == "bmsit" and bool(self.con.execute(
            "SELECT is_lab FROM subjects WHERE code = ?", (slot["subject_code"],)).fetchone()[0])

    def _declined(self, slot_id: int) -> set[str]:
        return {r["faculty_id"] for r in self.con.execute(
            "SELECT faculty_id, slot_ids FROM ack_requests WHERE status = 'declined'")
            if slot_id in json.loads(r["slot_ids"])}

    def _check(self, ch: dict) -> Optional[str]:
        """Rule check for one non-cancel change; returns an error string or None."""
        sid = ch["slot_id"]
        slot = self.slots.get(sid)
        if slot is None:
            return f"slot {sid} is not affected by this incident"
        if "status" in ch:
            return f"slot {sid}: status can only be 'cancelled'"
        absent = self.inc.get("faculty_id") if self.inc["type"] == "absence" else None
        fac = ch.get("faculty_id", slot["faculty_id"])
        if "faculty_id" in ch:
            row = self.con.execute("SELECT subjects FROM faculty WHERE id = ?", (fac,)).fetchone()
            if row is None or slot["subject_code"] not in {x.strip() for x in row["subjects"].split(",")}:
                return f"slot {sid}: {fac} cannot teach {slot['subject_code']}"
            if fac != slot["faculty_id"] and fac in self._declined(sid):
                return f"slot {sid}: {fac} declined this class"
        if absent and fac == absent and ch.get("day", slot["day"]) == self.inc["day"]:
            return f"slot {sid}: {absent} is absent on {self.inc['day']}; substitute or move to another day"
        if self.inc["type"] == "room_unavailable" and ch.get("room_id", slot["room_id"]) == self.inc["room_id"] \
                and ch.get("day", slot["day"]) == self.inc["day"] and ch.get("period", slot["period"]) in self.inc["periods"]:
            return f"slot {sid}: room {self.inc['room_id']} is unavailable then"
        if self._when(ch) != (slot["day"], slot["period"]) and self.lab_locked(slot):
            return f"slot {sid}: labs and unconfirmed classes are not moved in this demo; leave it to the HOD"
        single = validate_clash([ch], con=self.con)  # each change valid on its own → no swaps
        if not single.ok:
            return f"slot {sid}: {single.detail} (swaps are not allowed; only moves into free cells)"
        if fac != slot["faculty_id"] and self._when(ch) != (slot["day"], slot["period"]):
            return f"slot {sid}: either substitute or move, not both"  # so a decline can be undone exactly
        return None

    def t_commit_change(self, changes):
        changes = [{k: (int(v) if k in ("slot_id", "period") else v) for k, v in dict(c).items()
                    if v not in (None, "")} for c in (changes or [])]
        if not changes:
            return {"ok": False, "error": "no changes"}
        cancels = [c for c in changes if c.get("status") == "cancelled"]
        edits = [c for c in changes if c.get("status") != "cancelled"]
        errors = [e for e in (self._check(c) for c in edits) if e]
        for c in cancels:
            sid = c["slot_id"]
            slot = self.slots.get(sid)
            if slot is None:
                errors.append(f"slot {sid} is not affected by this incident")
                continue
            att = tools.get_attendance(slot["section"], slot["subject_code"], con=self.con)
            if att and att["below_threshold"] and not (sid in self.no_substitute and sid in self.no_reschedule):
                errors.append(f"slot {sid}: attendance {att['percent']}% < 75%; try find_substitute and "
                              f"propose_reschedule first")
            if set(c) - {"slot_id", "status"}:
                errors.append(f"slot {sid}: a cancellation can't change other fields")
        if errors:
            self.step("reason", "Rule check failed: " + "; ".join(errors), phase="constraints")
            return {"ok": False, "error": "rule_violation", "detail": "; ".join(errors)}
        self.step("reason", "Constraints OK: " + "; ".join(self._constraint_notes(c) for c in changes),
                  phase="constraints")

        # validate together with what is already proposed: the HOD approves everything at once
        redone = {c["slot_id"] for c in changes}
        proposal = [c for c in self.proposed if c["slot_id"] not in redone] + changes
        check = validate_clash(proposal, con=self.con)
        self.step("tool_call", f"validate_clash({len(changes)} change(s)) -> "
                  + ("OK, no section/faculty/room clash" if check.ok else f"clash: {check.detail}"), phase="resolve")
        if not check.ok:
            return {"ok": False, "error": "clash", "detail": check.detail}
        self.proposed = proposal
        for c in changes:
            self.handled[c["slot_id"]] = ("cancel_proposed" if c.get("status") == "cancelled"
                                          else change_kind(self.slots[c["slot_id"]], c))
        ids = [c["slot_id"] for c in changes]
        self.pending_acts.append(("escalate", f"Change(s) to slot(s) {ids} sent to HOD for approval; timetable unchanged"))
        return {"ok": True, "awaiting_hod_approval": ids}

    def _constraint_notes(self, c: dict) -> str:
        """Human summary of the rules a (valid) change satisfied, for the 'constraints' phase."""
        slot = self.slots[c["slot_id"]]
        att = tools.get_attendance(slot["section"], slot["subject_code"], con=self.con)
        pct = f"{slot['section']} {slot['subject_code']} attendance {att['percent']:g}%" if att else "no attendance data"
        if c.get("status") == "cancelled":
            return f"slot {c['slot_id']}: cancel allowed ({pct}" + (
                ", substitute and reschedule both failed)" if att and att["below_threshold"] else " >= 75%)")
        notes = [pct + (" < 75%: cancel blocked" if att and att["below_threshold"] else "")]
        if "faculty_id" in c and c["faculty_id"] != slot["faculty_id"]:
            notes.append(f"{c['faculty_id']} can teach {slot['subject_code']}")
        if (c.get("day", slot["day"]), c.get("period", slot["period"])) != (slot["day"], slot["period"]):
            notes.append(f"move to {c.get('day', slot['day'])} P{c.get('period', slot['period'])}")
        return f"slot {c['slot_id']}: " + ", ".join(notes)

    def flush_acts(self) -> None:
        for phase, text in self.pending_acts:
            self.step("act", text, phase=phase)
        self.pending_acts.clear()

    def t_log_decision(self, summary, reasoning):
        self.logged = {"summary": str(summary)[:300], "reasoning": str(reasoning)}
        tools.update_decision(self.decision_id, con=self.con, **self.logged)
        return {"ok": True}

    def dispatch(self, name: str, args: dict) -> Any:
        fn = getattr(self, f"t_{name}", None)
        if fn is None:
            return {"error": f"unknown tool {name}"}
        try:
            return fn(**args)
        except TypeError as e:
            return {"error": f"bad arguments: {e}"}
        except Exception as e:  # tool bugs go back to the model, not up the stack
            log.exception("tool %s failed", name)
            return {"error": f"{type(e).__name__}: {e}"}

    # ----- wrap-up -----
    def finish(self, failure: Optional[str] = None) -> dict:
        unresolved = [sid for sid in self.slots if sid not in self.handled]
        if failure or unresolved or not self.proposed:
            status = "escalated"  # HOD acts manually; any partial proposal can still be approved
        else:
            status = "proposed"   # waits for HOD; the timetable is unchanged until then

        done = "; ".join(f"slot {sid} {how}" for sid, how in self.handled.items()) or "no changes proposed"
        if failure:
            summary = f"TARS agent could not finish: {failure}. Manual action needed."
            reasoning = f"Agent stopped: {failure}. So far: {done}."
            if self.logged:
                reasoning = self.logged["reasoning"] + "\n\n" + reasoning
        else:
            summary = (self.logged or {}).get("summary") or f"Incident handled: {done}"
            reasoning = (self.logged or {}).get("reasoning") or self.final_text or f"Actions: {done}."
        if unresolved and not failure:
            reasoning += f"\n\nUnresolved slots {unresolved}: escalated to HOD."
        label = "Gemini" if self.source == "Gemini" else "Rule-based fallback"
        if not (failure and not self.proposed):
            partial = "PARTIAL, some classes not covered: " if unresolved and self.proposed else ""
            summary = f"[{label}] {partial}{summary}"
            origin = label if self.source == "Gemini" else f"{label} (no Gemini output used)"
            reasoning = f"Recommendation source: {origin}.{self.fallback_reason}\n\n{reasoning}"
        affected = sorted(self.slots) if unresolved else sorted(self.handled)
        d = tools.update_decision(self.decision_id, con=self.con, summary=summary, reasoning=reasoning,
                                  status=status, affected_slot_ids=affected,
                                  changes=self.proposed or None)
        bus.publish("decision_updated", d, user_ids=self.audience)
        self.step("error" if failure else "done", summary if failure else f"Decision #{d['id']}: {status}",
                  phase="escalate" if status in ("escalated", "proposed") else "dispatch")
        return d


def change_kind(before: dict, ch: dict) -> str:
    """What a non-cancel change does (models often echo unchanged day/period)."""
    if ch.get("faculty_id", before["faculty_id"]) != before["faculty_id"]:
        return "substituted"
    if (ch.get("day", before["day"]), ch.get("period", before["period"])) != (before["day"], before["period"]):
        return "moved"
    return "room_changed"


def run_fallback(run: AgentRun, reason: str) -> None:
    """No LLM: substitute → (other room) → reschedule per slot, through the same checks as Gemini's calls.

    Starts over, so a recommendation is never a mix of both. Never proposes a cancellation: what can't be
    covered is escalated to the HOD.
    """
    run.proposed, run.handled, run.logged, run.final_text = [], {}, None, ""
    run.no_substitute, run.no_reschedule = set(), set()
    run.pending_acts.clear()
    run.source, run.fallback_reason = "fallback", f" Reason: {reason}."
    run.step("reason", f"{reason}. Using the rule-based substitute finder (no AI)", phase="evaluate")
    notes = []
    for sid, slot in sorted(run.slots.items(), key=lambda kv: (kv[1]["period"], kv[0])):
        options = []
        if run.inc["type"] == "absence":
            sub = run.t_find_substitute(slot["subject_code"], slot["day"], slot["period"])
            run.step("tool_call", f"find_substitute({slot['subject_code']}, {slot['day']} P{slot['period']}) -> "
                     + _short_result(sub), phase="match")
            options = [({"slot_id": sid, "faculty_id": c["faculty_id"]},
                        f"{c['name']} ({c['faculty_id']}) can teach {slot['subject_code']}, is free, load {c['load']}")
                       for c in (sub or {}).get("candidates", [])]
        else:
            kind = run.con.execute("SELECT kind FROM rooms WHERE id = ?", (slot["room_id"],)).fetchone()[0]
            options = [({"slot_id": sid, "room_id": r["id"]}, f"room {r['id']} is free")
                       for r in run.t_find_free_rooms(slot["day"], slot["period"], kind)]
        picked = _first_accepted(run, options) or _first_accepted(run, _moves(run, sid))
        where = f"{slot['section']} {slot['subject_code']} {slot['day']} P{slot['period']}"
        notes.append(f"{where}: {picked}" if picked else f"{where}: no valid substitute, room or free slot found")
    if run.proposed:
        run.logged = {"summary": "; ".join(notes)[:300], "reasoning": "\n".join(notes)}


def _moves(run: AgentRun, sid: int):
    slot = run.slots[sid]
    if run.lab_locked(slot):
        return
    for day in [d for d in DAYS if not (run.inc["type"] == "absence" and d == run.inc["day"])]:
        for period in period_numbers(run.con):
            p = tools.propose_reschedule(sid, day=day, period=period, con=run.con)
            if p:
                yield p["change"], (f"move to {day} P{period} in {p['to']['room_id']} with {slot['faculty_name']}")


def _first_accepted(run: AgentRun, options) -> Optional[str]:
    for change, why in options:
        if run.t_commit_change([change])["ok"]:
            run.flush_acts()
            return why
    return None


def apply_approved(con, row) -> dict:
    """HOD approved: apply the decision's changes and its new status in ONE transaction.

    Raises ClashError (nothing changed) if the timetable moved on since the proposal, or LookupError if
    someone else already decided it. Then tells students/faculty, Telegram and Calendar.
    """
    changes = json.loads(row["changes"])
    ids = sorted({c["slot_id"] for c in changes})
    marks = ",".join("?" * len(ids))
    try:
        # opens the transaction; commit_change (inside apply_changes) commits it together with the slots
        # a PARTIAL proposal leaves classes uncovered: what it covers is applied, the decision stays escalated
        if not con.execute("UPDATE decisions SET status = ?, changes = NULL "
                           "WHERE id = ? AND status = ? AND changes = ?",
                           ("escalated" if row["status"] == "escalated" else "committed", row["id"], row["status"], row["changes"])).rowcount:
            raise LookupError("already decided")
        before = {s["id"]: s for s in fetch_slots(con, f"s.id IN ({marks})", tuple(ids))}
        inc = con.execute("SELECT * FROM incidents WHERE id = ?", (row["incident_id"],)).fetchone()
        if inc:
            key = "faculty_id" if inc["type"] == "absence" else "room_id"
            stale = [i for i in ids if i not in before or before[i][key] != inc[key] or before[i]["day"] != inc["day"]
                     or before[i]["period"] not in json.loads(inc["periods"]) or before[i]["status"] == "cancelled"]
            if stale:
                raise ClashError(ClashResult(ok=False, errors=[f"slot(s) {stale} changed since this was proposed"]))
        con.executemany("INSERT INTO applied_changes (decision_id, slot_id, kind) VALUES (?,?,?)",
                        [(row["id"], c["slot_id"], "cancelled" if c.get("status") == "cancelled"
                          else change_kind(before[c["slot_id"]], c)) for c in changes])
        out = actions.apply_changes(con, changes)
    except Exception:
        con.rollback()
        raise

    audience = [row["reported_by"]] if row["reported_by"] else []

    def step(text):
        bus.publish("agent_step", {"decision_id": row["id"], "step": "act", "phase": "dispatch", "text": text,
                                   "ts": datetime.now().isoformat(timespec="seconds")}, user_ids=audience)

    step(f"HOD approved. Committed {len(changes)} change(s), sent {len(out['nudge_ids'])} nudge(s): "
         + "; ".join(actions.describe(before[s["id"]], s) for s in out["slots"]))
    edits = [c for c in changes if c.get("status") != "cancelled"]
    kinds = [(c["slot_id"], change_kind(before[c["slot_id"]], c)) for c in edits]
    subs = [sid for sid, kind in kinds if kind == "substituted"]
    try:  # already committed: an external service must never turn the approval into an error
        if subs and notify.notifier.enabled:
            if row["status"] != "escalated":
                tools.update_decision(row["id"], con=con, status="pending_ack")
            reqs = notify.notifier.request_acks(row["id"], subs, con=con)
            if reqs:
                sent = [r["faculty_id"] for r in reqs if r["message_id"]]
                unsent = [r["faculty_id"] for r in reqs if not r["message_id"]]
                step("Telegram: asked " + (", ".join(sent) or "nobody")
                     + f" to confirm (reply within {notify.escalation_minutes():g} min)"
                     + (f"; not reachable: {', '.join(unsent)}" if unsent else ""))
            elif row["status"] != "escalated":
                tools.update_decision(row["id"], con=con, status="committed")
    except Exception:
        log.exception("could not send Telegram ack requests")
    if subs and not con.execute("SELECT 1 FROM ack_requests WHERE decision_id = ?", (row["id"],)).fetchone():
        with con:
            con.execute("UPDATE decisions SET reasoning = COALESCE(reasoning, '') || ? WHERE id = ?",
                        ("\n\nCommitted but NOT CONFIRMED: no substitute was asked (Telegram off).", row["id"]))
    try:
        if gcal.calendar.sync_slots(row["id"], kinds, audience) is not None:
            step(f"Calendar: saving {len(kinds)} event(s) in the background")
    except Exception:
        log.exception("could not queue calendar sync")
    return tools.get_decision(row["id"], con=con)


def _short_result(result: Any) -> str:
    if result is None:
        return "none"
    if isinstance(result, dict):
        if "faculty_id" in result and "load" in result:
            return f"{result['name']} (load {result['load']})"
        if "percent" in result:
            return f"{result['percent']:g}%"
        if "to" in result:
            t = result["to"]
            return f"{t['day']} P{t['period']} in {t['room_id']}"
        if result.get("ok") is False:
            return f"rejected: {result.get('detail') or result.get('error')}"
        return "ok"
    if isinstance(result, list):
        return f"{len(result)} result(s)"
    return str(result)[:80]


def _fmt_args(args: dict) -> str:
    """Readable call args like the contract example: find_substitute(DS, MON P2)."""
    if "changes" in args:
        return f"{len(args['changes'] or [])} change(s)"
    if "summary" in args:
        return str(args["summary"])[:120]
    parts = [str(args[k]) for k in ("slot_id", "section", "subject_code", "faculty_id", "kind") if args.get(k)]
    if args.get("day"):
        parts.append(f"{args['day']} P{args['period']}" if args.get("period") else str(args["day"]))
    return ", ".join(parts)


def run_loop(run: AgentRun, client) -> None:
    from google.genai import types
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        temperature=0,
        thinking_config=types.ThinkingConfig(thinking_level=os.environ.get("GEMINI_THINKING", "LOW")),
        tools=[types.Tool(function_declarations=[
            types.FunctionDeclaration(name=n, description=d, parameters_json_schema=p) for n, d, p in TOOL_SPECS])],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )
    contents = [types.Content(role="user", parts=[types.Part.from_text(text=run.perceive_text())])]
    models = model_names()
    for _ in range(MAX_TURNS):
        while True:
            try:
                resp = client.models.generate_content(model=models[0], contents=contents, config=config)
                break
            except Exception as e:
                if len(models) > 1 and _is_transient(e):
                    log.warning("model %s failed (%s); falling back to %s", models[0], e, models[1])
                    run.step("reason", f"{models[0]} unavailable, switching to {models[1]}")
                    models = models[1:]
                    continue
                raise
        if not resp.candidates or resp.candidates[0].content is None:
            raise RuntimeError("Gemini returned an empty response")
        content = resp.candidates[0].content
        contents.append(content)  # keep the whole turn (incl. thought signatures)
        parts = content.parts or []
        text = " ".join(p.text for p in parts if p.text and not p.thought).strip()
        calls = [p.function_call for p in parts if p.function_call]
        if text:
            run.final_text = text
            run.step("reason", text[:400])
        if not calls:
            return
        replies = []
        for fc in calls:
            args = dict(fc.args or {})
            result = run.dispatch(fc.name, args)
            run.step("tool_call", f"{fc.name}({_fmt_args(args)}) -> {_short_result(result)}",
                     phase=tool_phase(fc.name, result))
            run.flush_acts()
            replies.append(types.Part.from_function_response(name=fc.name, response={"result": result}))
        contents.append(types.Content(role="user", parts=replies))
    raise RuntimeError(f"agent did not finish within {MAX_TURNS} turns")


def run_incident(incident_id: int, decision_id: int, client=None) -> Optional[dict]:
    """Background-task entry point. Never raises: failures end as an `escalated` decision."""
    try:
        with use_db() as con:
            row = con.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
            inc = {**dict(row), "periods": json.loads(row["periods"])}
            run = AgentRun(con, inc, decision_id)
            run.step("perceive", f"Incident #{incident_id}: {len(run.slots)} slot(s) affected "
                     + ", ".join(f"{s['section']} {s['subject_code']} {s['day']} P{s['period']}"
                                 for s in run.slots.values()))
            try:
                run_loop(run, client or make_client())
            except AgentUnavailable as e:
                reason = f"Gemini unavailable ({e})"
            except Exception as e:
                log.exception("agent loop failed")
                reason = f"Gemini error ({type(e).__name__}: {str(e)[:160]})"
            else:
                return run.finish()
            run_fallback(run, reason)
            return run.finish(failure=None if run.proposed else f"{reason}, and the rule-based fallback found no option")
    except Exception:  # last resort: DB problems etc. Keep the server alive.
        log.exception("run_incident crashed")
        try:
            tools.update_decision(decision_id, summary="TARS agent crashed. Manual action needed.",
                                  reasoning="Internal error while running the agent; see server log.",
                                  status="escalated")
        except Exception:
            log.exception("could not mark decision escalated")
        return None
