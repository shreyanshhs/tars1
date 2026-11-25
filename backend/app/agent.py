"""TARS agent: Gemini function-calling loop (Perceive → Reason → Act) over app/tools.py.

The LLM only *chooses*; every rule that matters is also enforced here in code:
  - only slots affected by the incident may change; no swaps (each change must be valid on its own)
  - substitutes must be able to teach the subject and can't be the absent faculty
  - no cancelling a <75% attendance class before substitute AND reschedule were tried and failed
  - cancellations are never applied directly: they become a proposal for HOD approval
  - commit goes through the clash validator (tools.commit_change)
Gemini unavailable / failing → the decision is marked `escalated` with a clean message. Never raises.
"""
import json
import logging
import os
from datetime import datetime
from typing import Any, Optional

from . import actions, bus, gcal, notify, tools
from .db import fetch_slots, use_db
from .validator import ClashError, validate_clash

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
   Cancellations are not applied immediately; they are sent to the HOD for approval.
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
    ("commit_change", "Apply changes after the clash validator. Cancellations go to the HOD for approval.",
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
        self.proposed: list[dict] = []          # cancellations awaiting HOD
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
        sub = tools.find_substitute(subject_code, day, int(period), exclude=exclude, con=self.con)
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
        if absent and fac == absent and ch.get("day", slot["day"]) == self.inc["day"]:
            return f"slot {sid}: {absent} is absent on {self.inc['day']}; substitute or move to another day"
        if self.inc["type"] == "room_unavailable" and ch.get("room_id", slot["room_id"]) == self.inc["room_id"] \
                and ch.get("day", slot["day"]) == self.inc["day"] and ch.get("period", slot["period"]) in self.inc["periods"]:
            return f"slot {sid}: room {self.inc['room_id']} is unavailable then"
        single = validate_clash([ch], con=self.con)  # each change valid on its own → no swaps
        if not single.ok:
            return f"slot {sid}: {single.detail} (swaps are not allowed; only moves into free cells)"
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

        result: dict[str, Any] = {"ok": True}
        if edits:
            check = validate_clash(edits, con=self.con)
            self.step("tool_call", f"validate_clash({len(edits)} change(s)) -> "
                      + ("OK, no section/faculty/room clash" if check.ok else f"clash: {check.detail}"),
                      phase="resolve")
            if not check.ok:
                return {"ok": False, "error": "clash", "detail": check.detail}
            try:
                out = actions.apply_changes(self.con, edits)  # validates again inside the write transaction
            except ClashError as e:
                self.step("tool_call", f"validate_clash -> clash: {e}", phase="resolve")
                return {"ok": False, "error": "clash", "detail": str(e)}
            for s in out["slots"]:
                orig = self.slots[s["id"]]
                # compare with the original slot: models often echo unchanged day/period
                if s["faculty_id"] != orig["faculty_id"] or self.handled.get(s["id"]) == "substituted":
                    self.handled[s["id"]] = "substituted"
                elif (s["day"], s["period"]) != (orig["day"], orig["period"]):
                    self.handled[s["id"]] = "moved"
                else:
                    self.handled[s["id"]] = "room_changed"
            result.update(committed_slot_ids=out["slot_ids"], students_notified=len(out["nudge_ids"]))
            self.pending_acts.append(("dispatch", f"Committed {len(edits)} change(s), sent {len(out['nudge_ids'])} "
                                      f"nudge(s): " + "; ".join(actions.describe(self.slots[s["id"]], s)
                                                                for s in out["slots"])))
        if cancels:
            self.proposed += cancels
            for c in cancels:
                self.handled[c["slot_id"]] = "cancel_proposed"
            result["awaiting_hod_approval"] = [c["slot_id"] for c in cancels]
            self.pending_acts.append(("escalate", f"Cancellation of slot(s) {[c['slot_id'] for c in cancels]} "
                                                  f"sent to HOD for approval"))
        return result

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

    def notify_substitutes(self) -> None:
        """Telegram Accept/Decline to each substitute (after the final status is written, so a fast
        Accept can't be overwritten). No-op when Telegram is off; never raises."""
        sub_ids = sorted(sid for sid, how in self.handled.items() if how == "substituted")
        if not sub_ids:
            return
        try:
            reqs = notify.notifier.request_acks(self.decision_id, sub_ids, con=self.con)
        except Exception:
            log.exception("could not send Telegram ack requests")
            return
        if reqs:
            sent = [r["faculty_id"] for r in reqs if r["message_id"]]
            unsent = [r["faculty_id"] for r in reqs if not r["message_id"]]
            self.step("act", "Telegram: asked " + (", ".join(sent) or "nobody")
                      + f" to confirm (reply within {notify.escalation_minutes():g} min)"
                      + (f"; not reachable: {', '.join(unsent)}" if unsent else ""), phase="dispatch")

    def sync_calendar(self) -> None:
        """Queue Google Calendar create/update for every substitution or move (background; never raises)."""
        slots = sorted((sid, how) for sid, how in self.handled.items() if how in ("substituted", "moved", "room_changed"))
        try:
            fut = gcal.calendar.sync_slots(self.decision_id, slots, self.audience)
        except Exception:
            log.exception("could not queue calendar sync")
            return
        if fut is not None:
            self.step("act", f"Calendar: saving {len(slots)} event(s) in the background", phase="dispatch")

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
        if failure or unresolved:
            status = "escalated"
        elif self.proposed:
            status = "proposed"
        elif "substituted" in self.handled.values():
            status = "pending_ack"  # substitute must acknowledge (Telegram step comes later)
        else:
            status = "committed"

        done = "; ".join(f"slot {sid} {how}" for sid, how in self.handled.items()) or "no changes applied"
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
        affected = sorted(self.handled) or sorted(self.slots)
        d = tools.update_decision(self.decision_id, con=self.con, summary=summary, reasoning=reasoning,
                                  status=status, affected_slot_ids=affected,
                                  changes=self.proposed or None)
        bus.publish("decision_updated", d, user_ids=self.audience)
        self.notify_substitutes()
        self.sync_calendar()
        self.step("error" if failure else "done", summary if failure else f"Decision #{d['id']}: {status}",
                  phase="escalate" if status in ("escalated", "proposed") else "dispatch")
        return d


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
                return run.finish(failure=f"Gemini unavailable ({e})")
            except Exception as e:
                log.exception("agent loop failed")
                return run.finish(failure=f"Gemini error ({type(e).__name__}: {str(e)[:160]})")
            return run.finish()
    except Exception:  # last resort: DB problems etc. Keep the server alive.
        log.exception("run_incident crashed")
        try:
            tools.update_decision(decision_id, summary="TARS agent crashed. Manual action needed.",
                                  reasoning="Internal error while running the agent; see server log.",
                                  status="escalated")
        except Exception:
            log.exception("could not mark decision escalated")
        return None
