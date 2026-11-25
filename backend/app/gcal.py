"""Google Calendar sync for committed substitutions / moves (service account, background threads).

- One event per slot: the event id is stored on slots.gcal_event_id, so a later change PATCHes the same
  event instead of creating a duplicate (if Google says it's gone, a new one is inserted).
- Date = the next occurrence of the slot's weekday (Asia/Kolkata): today if it's that weekday and the
  period hasn't ended yet, otherwise the next one (up to 7 days ahead). Times from the period table.
- Every call runs on a small thread pool: the agent never waits, and any failure (no creds, no network,
  API error) is logged and reported as an agent_step, never raised.
- Demo reset deletes exactly the events TARS created (the ids it stored), nothing else.
- Never logs the calendar id or anything from the key file.
"""
import logging
import os
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo

from . import bus, tools
from .db import DAYS, fetch_slots, use_db

log = logging.getLogger("tars.gcal")

TZ = "Asia/Kolkata"
SCOPES = ["https://www.googleapis.com/auth/calendar.events"]
ROOT = Path(__file__).resolve().parents[2]   # repo root: relative key paths resolve here, not the cwd


def key_file_path() -> Optional[Path]:
    raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "").strip()
    if not raw:
        return None
    p = Path(raw).expanduser()
    return p if p.is_absolute() else ROOT / p


def slot_date(day: str, end: Optional[str] = None, now: Optional[datetime] = None):
    """Next occurrence of `day` in Asia/Kolkata, today or later (never in the past).
    If today is that weekday, today is used while the period hasn't ended yet (`end` = "HH:MM");
    once it has, the same weekday next week. Without `end`, today counts."""
    now = now or datetime.now(ZoneInfo(TZ))
    ahead = (DAYS.index(day) - now.weekday()) % 7
    if ahead == 0 and end is not None and now.strftime("%H:%M") >= end:
        ahead = 7  # today's period is over: next week
    return now.date() + timedelta(days=ahead)


def _status(e: Exception) -> Optional[int]:
    code = getattr(e, "status_code", None) or getattr(getattr(e, "resp", None), "status", None)
    try:
        return int(code) if code is not None else None
    except (TypeError, ValueError):
        return None


def event_body(slot: dict, kind: str, decision: dict, room_name: Optional[str],
               now: Optional[datetime] = None) -> dict:
    d = slot_date(slot["day"], slot["end"], now).isoformat()
    who = slot["faculty_name"]
    title = {"substituted": f"{slot['subject_code']} ({slot['section']}): {who} substituting",
             "moved": f"{slot['subject_code']} ({slot['section']}): rescheduled, {who}"}.get(
        kind, f"{slot['subject_code']} ({slot['section']}): {who}")
    reasoning = (decision.get("reasoning") or "").strip()
    if len(reasoning) > 1500:
        reasoning = reasoning[:1500].rstrip() + "…"
    description = (f"TARS decision #{decision['id']} ({decision['status']})\n{decision.get('summary') or ''}\n\n"
                   f"{reasoning}\n\n{slot['subject_name']} · {slot['section']} · {slot['day']} P{slot['period']}")
    return {
        "summary": title,
        "location": f"{room_name} ({slot['room_id']})" if room_name else slot["room_id"],
        "description": description.strip(),
        "start": {"dateTime": f"{d}T{slot['start']}:00", "timeZone": TZ},
        "end": {"dateTime": f"{d}T{slot['end']}:00", "timeZone": TZ},
        "extendedProperties": {"private": {"tars": "1", "tars_slot_id": str(slot["id"]),
                                           "tars_decision_id": str(decision["id"])}},
    }


class Calendar:
    def __init__(self, service=None, max_workers: int = 2):
        self._service = service          # injected in tests; built lazily from the key file otherwise
        self._pool = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="gcal")
        self._warned = False
        self._futures: list[Future] = []

    # ---------- config ----------
    @staticmethod
    def calendar_id() -> str:
        return os.environ.get("GOOGLE_CALENDAR_ID", "").strip()

    def service(self):
        if self._service is not None:
            return self._service
        path = key_file_path()
        if not self.calendar_id() or path is None or not path.is_file():
            if not self._warned:
                log.warning("Google Calendar disabled: %s", "GOOGLE_CALENDAR_ID not set" if not self.calendar_id()
                            else "GOOGLE_SERVICE_ACCOUNT_FILE not set" if path is None
                            else "service account key file not found")
                self._warned = True
            return None
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        creds = service_account.Credentials.from_service_account_file(str(path), scopes=SCOPES)
        self._service = build("calendar", "v3", credentials=creds, cache_discovery=False)
        return self._service

    def enabled(self) -> bool:
        if not self.calendar_id():
            if not self._warned:
                log.warning("Google Calendar disabled: GOOGLE_CALENDAR_ID not set")
                self._warned = True
            return False
        try:
            return self.service() is not None
        except Exception:
            log.exception("could not load Google credentials; Calendar disabled")
            return False

    # ---------- public, non-blocking ----------
    def sync_slots(self, decision_id: int, slots: list[tuple[int, str]], audience: list[str]) -> Optional[Future]:
        """Queue create/update for [(slot_id, kind)]; returns the Future (tests wait on it) or None if off."""
        if not slots:
            return None
        if not self.enabled():
            return None
        return self._track(self._pool.submit(self._safe, self._sync, decision_id, slots, audience))

    def delete_events(self, event_ids: list[str]) -> Optional[Future]:
        ids = [e for e in event_ids if e]
        if not ids or not self.enabled():
            return None
        return self._track(self._pool.submit(self._safe, self._delete, ids))

    def _track(self, fut: Future) -> Future:
        self._futures = [f for f in self._futures if not f.done()] + [fut]
        return fut

    def wait_idle(self, timeout: float = 10) -> None:
        """Block until queued calendar jobs finish (tests, shutdown). Never raises."""
        from concurrent.futures import wait
        wait(list(self._futures), timeout=timeout)

    # ---------- workers ----------
    @staticmethod
    def _safe(fn, *args):
        try:
            return fn(*args)
        except Exception:
            log.exception("calendar job failed")
            return None

    def _step(self, decision_id: int, text: str, audience: list[str]) -> None:
        bus.publish("agent_step", {"decision_id": decision_id, "step": "act", "phase": "dispatch", "text": text,
                                   "ts": datetime.now().isoformat(timespec="seconds")}, user_ids=audience)

    def _sync(self, decision_id: int, slots: list[tuple[int, str]], audience: list[str]) -> list[dict]:
        svc, cal = self.service(), self.calendar_id()
        results = []
        with use_db() as con:
            decision = tools.get_decision(decision_id, con=con)
            if decision is None:
                return []
            for slot_id, kind in slots:
                rows = fetch_slots(con, "s.id = ?", (slot_id,))
                if not rows:
                    continue
                slot = rows[0]
                room = con.execute("SELECT name FROM rooms WHERE id = ?", (slot["room_id"],)).fetchone()
                body = event_body(slot, kind, decision, room["name"] if room else None)
                existing = con.execute("SELECT gcal_event_id FROM slots WHERE id = ?", (slot_id,)).fetchone()[0]
                label = f"{slot['subject_code']} ({slot['section']}) {slot['day']} {slot['start']}"
                try:
                    ev, action = None, "created"
                    if existing:
                        try:
                            ev = svc.events().patch(calendarId=cal, eventId=existing, body=body).execute()
                            action = "updated"
                        except Exception as e:
                            if _status(e) not in (404, 410):   # deleted in Google → recreate below
                                raise
                    if ev is None:
                        ev = svc.events().insert(calendarId=cal, body=body).execute()
                except Exception as e:
                    log.error("Calendar %s failed for slot %s: %s (HTTP %s)", "update" if existing else "insert",
                              slot_id, type(e).__name__, _status(e))
                    self._step(decision_id, f"Calendar: could not save {label} (logged, schedule unaffected)", audience)
                    continue
                with con:
                    con.execute("UPDATE slots SET gcal_event_id = ? WHERE id = ?", (ev["id"], slot_id))
                link = ev.get("htmlLink")
                if link and not decision.get("calendar_link"):
                    decision = tools.update_decision(decision_id, con=con, calendar_link=link)
                    reporter = con.execute("SELECT i.reported_by FROM decisions d JOIN incidents i ON i.id = d.incident_id "
                                           "WHERE d.id = ?", (decision_id,)).fetchone()
                    bus.publish("decision_updated", decision, user_ids=[reporter[0]] if reporter else [])
                self._step(decision_id, f"Calendar event {action}: {body['summary']}, {label}", audience)
                results.append({"slot_id": slot_id, "event_id": ev["id"], "action": action, "link": link})
        return results

    def _delete(self, ids: list[str]) -> int:
        svc, cal, n = self.service(), self.calendar_id(), 0
        for eid in ids:
            try:
                svc.events().delete(calendarId=cal, eventId=eid).execute()
                n += 1
            except Exception as e:
                if _status(e) in (404, 410):          # already gone: fine
                    continue
                log.error("Calendar delete failed: %s (HTTP %s)", type(e).__name__, _status(e))
        log.info("demo reset: deleted %d TARS calendar event(s)", n)
        return n


calendar = Calendar()
