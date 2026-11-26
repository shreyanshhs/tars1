"""Telegram notifications (polling bot) + escalation timer.

Flow:
  /start → login id → password (passwordless only if TARS_PASSWORDLESS_LOGIN=1) → users.telegram_chat_id saved.
  HOD approves a substitution → each substitute gets the class details with [Accept] [Decline].
    all substitutes Accept           → decision `acknowledged`
    any Decline                       → that cover is withdrawn (slot back to the original faculty),
                                        decision `escalated` + HOD and students told
    no reply within ESCALATION_MINUTES → unanswered requests `expired`, only those covers withdrawn,
                                        decision `escalated` + HOD and students told
  Every status change emits `decision_updated`.

Safety: no TELEGRAM_BOT_TOKEN → everything here is a logged no-op (no sends, no timer), so the
demo behaves exactly as without Telegram. Send failures are logged, never raised.
Threads: the bot runs on FastAPI's event loop; the agent and the APScheduler job run on worker
threads and hand coroutines to the loop with run_coroutine_threadsafe.
"""
import asyncio
import json
import logging
import os
import sqlite3
import time
from datetime import datetime, timedelta
from typing import Callable, Optional

from . import actions, auth, bus, gcal, tools
from .db import fetch_slots, iso, now, use_db

log = logging.getLogger("tars.notify")

# (chat_id, text, buttons[(label, callback_data)]) -> message_id. Injected in tests.
Sender = Callable[[str, str, Optional[list]], Optional[int]]

START_TEXT = ("Hi, I'm TARS, your campus scheduling assistant.\n"
              "Reply with your login id: your USN (e.g. 1AB25CS001) or staff ID (e.g. F08, H01).")
PASSWORD_TEXT = "Now send your password. I'll delete that message as soon as I've read it."
NOT_STARTED_TEXT = "Send /start to link this chat to your TARS account."
LINK_FLOW_SECONDS = 300  # an unfinished /start expires after 5 min


def escalation_minutes() -> float:
    try:
        return max(float(os.environ.get("ESCALATION_MINUTES", "2")), 0.0)
    except ValueError:
        return 2.0


def class_line(s: dict) -> str:
    return (f"{s['section']} {s['subject_name']} ({s['subject_code']}), "
            f"{s['day']} {s['start']}–{s['end']}, room {s['room_id']}")


def _on_loop(loop: Optional[asyncio.AbstractEventLoop]) -> bool:
    try:
        return asyncio.get_running_loop() is loop
    except RuntimeError:
        return False


class Notifier:
    def __init__(self, sender: Optional[Sender] = None):
        self._sender = sender
        self.app = None        # telegram.ext.Application when polling
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.scheduler = None  # APScheduler BackgroundScheduler
        self._flows: dict[str, dict] = {}  # chat_id -> /start progress (login id, then password)

    @property
    def enabled(self) -> bool:
        return self._sender is not None or self.app is not None

    # ---------- lifecycle (FastAPI lifespan) ----------
    async def start(self) -> None:
        self.loop = asyncio.get_running_loop()
        token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
        if self._sender is None:
            if not token:
                log.warning("TELEGRAM_BOT_TOKEN not set: Telegram notifications and escalation timer disabled")
                return
            try:
                await self._start_bot(token)
            except Exception as e:
                if type(e).__name__ == "InvalidToken":  # config mistake, not a bug: one clear line
                    log.error("Telegram rejected TELEGRAM_BOT_TOKEN (InvalidToken); check it with @BotFather. "
                              "Telegram notifications and escalation timer disabled")
                else:
                    log.exception("Telegram bot failed to start: notifications disabled")
                self.app = None
                return
        self.start_scheduler()
        self.restore_timers()

    async def stop(self) -> None:
        if self.scheduler is not None:
            try:
                self.scheduler.shutdown(wait=False)
            except Exception:
                log.exception("scheduler shutdown failed")
            self.scheduler = None
        if self.app is not None:
            app, self.app = self.app, None
            for step in (app.updater.stop, app.stop, app.shutdown):
                try:
                    await step()
                except Exception:
                    log.exception("Telegram shutdown step failed")

    async def _start_bot(self, token: str) -> None:
        from telegram.ext import Application, CallbackQueryHandler, CommandHandler, MessageHandler, filters
        app = Application.builder().token(token).build()
        app.add_handler(CommandHandler("start", self._on_start))
        app.add_handler(CallbackQueryHandler(self._on_button))
        app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self._on_text))
        app.add_error_handler(self._on_error)
        await app.initialize()
        await app.start()
        await app.updater.start_polling(drop_pending_updates=True)
        self.app = app
        log.info("Telegram bot polling as @%s", app.bot.username)

    def start_scheduler(self) -> None:
        if self.scheduler is None:
            from apscheduler.schedulers.background import BackgroundScheduler
            self.scheduler = BackgroundScheduler(daemon=True)
            self.scheduler.start()

    # ---------- sending ----------
    def send(self, chat_id, text: str, buttons: Optional[list] = None) -> Optional[int]:
        """Send from any non-loop thread. Returns message_id, or None if not sent (never raises)."""
        if not chat_id:
            return None
        try:
            if self._sender is not None:
                return self._sender(str(chat_id), text, buttons)
            if self.app is None or self.loop is None:
                return None
            if _on_loop(self.loop):
                raise RuntimeError("send() called on the event loop thread; wrap the caller in asyncio.to_thread")
            from telegram import InlineKeyboardButton, InlineKeyboardMarkup
            markup = (InlineKeyboardMarkup([[InlineKeyboardButton(t, callback_data=d) for t, d in buttons]])
                      if buttons else None)
            coro = self.app.bot.send_message(chat_id=int(chat_id), text=text, reply_markup=markup)
            return asyncio.run_coroutine_threadsafe(coro, self.loop).result(timeout=20).message_id
        except Exception:
            log.exception("Telegram send to chat %s failed", chat_id)
            return None

    def alert_hod(self, con, text: str) -> int:
        chats = [r[0] for r in con.execute(
            "SELECT telegram_chat_id FROM users WHERE role = 'hod' AND telegram_chat_id IS NOT NULL")]
        if not chats:
            log.warning("No HOD has linked Telegram; escalation alert not delivered: %s", text.splitlines()[0])
        return sum(self.send(c, text) is not None for c in chats)

    # ---------- linking: /start → login id → password (same rules as the web login) ----------
    def link(self, login_id: str, password: Optional[str], chat_id) -> str:
        with use_db() as con:
            try:
                r = auth.authenticate(con, login_id, password)
            except auth.AuthError:
                return "Wrong login id or password. Send /start to try again."
            with con:
                con.execute("UPDATE users SET telegram_chat_id = ? WHERE id = ?", (str(chat_id), r["id"]))
        log.info("Telegram chat linked to %s", r["id"])
        return f"Linked to {r['name']} ({r['id']}, {r['role']}). TARS will message you here."

    def start_flow(self, chat_id, arg: Optional[str] = None) -> str:
        """/start, or /start <login id> (deep link)."""
        self._flows[str(chat_id)] = {"stage": "id", "at": time.time()}
        return self.handle_text(chat_id, arg)[0] if arg else START_TEXT

    def handle_text(self, chat_id, text: Optional[str]) -> tuple[str, bool]:
        """A plain message in the link flow. Returns (reply, delete_users_message)."""
        key = str(chat_id)
        flow = self._flows.get(key)
        if flow is None or time.time() - flow["at"] > LINK_FLOW_SECONDS:
            self._flows.pop(key, None)
            return NOT_STARTED_TEXT, False
        if flow["stage"] == "id":
            login_id = (text or "").strip()
            if auth.passwordless_enabled():
                self._flows.pop(key, None)
                return self.link(login_id, None, chat_id), False
            self._flows[key] = {"stage": "password", "login_id": login_id, "at": time.time()}
            return PASSWORD_TEXT, False
        self._flows.pop(key, None)  # password stage: one attempt, then /start again
        return self.link(flow["login_id"], text or "", chat_id), True

    # ---------- ack requests ----------
    def request_acks(self, decision_id: int, slot_ids: list[int], con=None) -> list[dict]:
        """Ask each substitute (current faculty of `slot_ids`) to Accept/Decline; start the timer."""
        if not self.enabled:
            log.info("Telegram disabled: no ack request for decision %s", decision_id)
            return []
        if not slot_ids:
            return []
        out = []
        with use_db(con) as c:
            d = c.execute("SELECT d.status, i.faculty_id AS absent FROM decisions d "
                          "LEFT JOIN incidents i ON i.id = d.incident_id WHERE d.id = ?", (decision_id,)).fetchone()
            absent = c.execute("SELECT name FROM users WHERE id = ?", (d["absent"],)).fetchone() if d["absent"] else None
            slots = fetch_slots(c, f"s.id IN ({','.join('?' * len(slot_ids))})", tuple(slot_ids))
            by_fac: dict[str, list[dict]] = {}
            for s in slots:
                by_fac.setdefault(s["faculty_id"], []).append(s)
            minutes = escalation_minutes()
            due = now() + timedelta(minutes=minutes)
            for fid, ss in sorted(by_fac.items()):
                chat = c.execute("SELECT telegram_chat_id FROM users WHERE id = ?", (fid,)).fetchone()[0]
                with c:
                    rid = c.execute("INSERT INTO ack_requests (decision_id, faculty_id, slot_ids, chat_id, due_at) "
                                    "VALUES (?,?,?,?,?)", (decision_id, fid, json.dumps([s["id"] for s in ss]),
                                                           chat, iso(due))).lastrowid
                mid = None
                if chat:
                    text = ("TARS: can you cover this class?\n"
                            + "\n".join(f"• {class_line(s)}" for s in ss)
                            + (f"\nFor: {absent['name']} ({d['absent']}), absent" if absent else "")
                            + f"\nDecision #{decision_id}. Please reply within {minutes:g} min.")
                    mid = self.send(chat, text, [("✅ Accept", f"ack:{rid}"), ("❌ Decline", f"dec:{rid}")])
                    with c:
                        c.execute("UPDATE ack_requests SET message_id = ? WHERE id = ?", (mid, rid))
                else:
                    log.warning("%s has not linked Telegram (/start); cannot ask them to confirm", fid)
                out.append({"id": rid, "faculty_id": fid, "chat_id": chat, "message_id": mid,
                            "slot_ids": [s["id"] for s in ss]})
        if out:  # also for a PARTIAL approval, which stays escalated
            self.schedule_escalation(decision_id, due)
        return out

    def schedule_escalation(self, decision_id: int, run_at: datetime) -> None:
        if self.scheduler is None:
            log.warning("scheduler not running: no escalation timer for decision %s", decision_id)
            return
        self.scheduler.add_job(self.escalate_if_pending, "date", run_date=max(run_at, now()),
                               args=[decision_id], id=f"escalate-{decision_id}",
                               replace_existing=True, misfire_grace_time=None)

    def cancel_escalation(self, decision_id: int) -> None:
        if self.scheduler is None:
            return
        try:
            self.scheduler.remove_job(f"escalate-{decision_id}")
        except Exception:
            pass  # already ran or never scheduled

    def cancel_all_escalations(self) -> int:
        """Demo reset: drop every pending escalation timer. Returns how many were removed."""
        if self.scheduler is None:
            return 0
        jobs = [j for j in self.scheduler.get_jobs() if j.id.startswith("escalate-")]
        for j in jobs:
            try:
                j.remove()
            except Exception:
                pass
        return len(jobs)

    def restore_timers(self) -> None:
        """After a restart: re-arm timers for every request still waiting for an answer."""
        with use_db() as con:
            rows = con.execute("SELECT r.decision_id, MIN(r.due_at) FROM ack_requests r JOIN decisions d "
                               "ON d.id = r.decision_id WHERE r.status = 'pending' "
                               "GROUP BY r.decision_id").fetchall()
        for decision_id, due in rows:
            self.schedule_escalation(decision_id, datetime.fromisoformat(due))
        if rows:
            log.info("restored %d escalation timer(s)", len(rows))

    def _transition(self, con, decision_id: int, status: str, note: str) -> Optional[dict]:
        """pending_ack → status, atomically (a timer and a button press can race). Emits decision_updated."""
        with con:
            n = con.execute("UPDATE decisions SET status = ?, reasoning = COALESCE(reasoning, '') || ? "
                            "WHERE id = ? AND status = 'pending_ack'", (status, "\n\n" + note, decision_id)).rowcount
        if not n:
            return None
        self.cancel_escalation(decision_id)
        d = tools.get_decision(decision_id, con=con)
        reporter = con.execute("SELECT i.reported_by FROM decisions d JOIN incidents i ON i.id = d.incident_id "
                               "WHERE d.id = ?", (decision_id,)).fetchone()
        bus.publish("decision_updated", d, user_ids=[reporter[0]] if reporter else [])
        return d

    def _req_classes(self, con, req) -> list[dict]:
        ids = json.loads(req["slot_ids"])
        return fetch_slots(con, f"s.id IN ({','.join('?' * len(ids))})", tuple(ids)) if ids else []

    def _withdraw_cover(self, con, req) -> tuple[list[dict], list[dict], list[str]]:
        """Inside the caller's transaction: give the declined classes back to the faculty they were taken from.

        Only slots this substitute still holds at the incident's time. Returns (withdrawn, stuck, event ids);
        `stuck` = the original faculty has another class then, so the slot can't be given back.
        """
        inc = con.execute("SELECT i.* FROM incidents i JOIN decisions d ON d.incident_id = i.id WHERE d.id = ?",
                          (req["decision_id"],)).fetchone()
        if inc is None or inc["type"] != "absence":
            return [], [], []
        done, stuck, events = [], [], []
        for s in self._req_classes(con, req):
            if s["faculty_id"] != req["faculty_id"] or s["status"] == "cancelled" or s["day"] != inc["day"] \
                    or s["period"] not in json.loads(inc["periods"]):
                continue
            eid = con.execute("SELECT gcal_event_id FROM slots WHERE id = ?", (s["id"],)).fetchone()[0]
            con.execute("SAVEPOINT give_back")
            try:
                con.execute("UPDATE slots SET faculty_id = ?, status = 'scheduled', gcal_event_id = NULL WHERE id = ?",
                            (inc["faculty_id"], s["id"]))
            except sqlite3.IntegrityError:
                con.execute("ROLLBACK TO give_back")
                stuck.append(s)
            else:
                done.append(s)
                events += [eid] if eid else []
            con.execute("RELEASE give_back")
        return done, stuck, events

    def _escalate(self, con, decision_id: int, note: str, withdrawn: list[tuple], events: list[str]) -> str:
        """Inside the caller's transaction: append `note` + the unresolved slots to the history and escalate."""
        done = [s["id"] for _, d, _ in withdrawn for s in d]
        if done:
            note += f" Cover withdrawn, UNRESOLVED slots {done}: report the absence again for a new proposal."
        for req, _, stuck in withdrawn:
            if stuck:
                note += (f" UNRESOLVED slots {[s['id'] for s in stuck]} still show {req['faculty_id']}: "
                         "change them manually.")
        was = con.execute("SELECT status FROM decisions WHERE id = ?", (decision_id,)).fetchone()[0]
        # whatever was recorded before, nobody covers these classes now
        status = "escalated" if was in ("pending_ack", "acknowledged", "committed") else was
        con.execute("UPDATE decisions SET status = ?, reasoning = COALESCE(reasoning, '') || ?, "
                    "calendar_link = CASE WHEN ? THEN NULL ELSE calendar_link END WHERE id = ?",
                    (status, "\n\n" + note, bool(events), decision_id))
        return status

    def _stop_timer_if_answered(self, con, decision_id: int) -> None:
        """The deadline keeps running for substitutes who haven't answered."""
        if not con.execute("SELECT 1 FROM ack_requests WHERE decision_id = ? AND status = 'pending'",
                           (decision_id,)).fetchone():
            self.cancel_escalation(decision_id)

    def _after_withdraw(self, con, decision_id: int, withdrawn: list[tuple], events: list[str]) -> dict:
        """After commit: Calendar cleanup, live updates and student nudges."""
        if events and gcal.calendar.delete_events(events) is None:
            log.error("cover withdrawn: calendar is off; event(s) not deleted: %s", events)
        for req, done, _ in withdrawn:
            for s in done:
                owner = con.execute("SELECT faculty_id FROM slots WHERE id = ?", (s["id"],)).fetchone()
                bus.publish("timetable_updated", {"section": s["section"], "slot_ids": [s["id"]]},
                            sections=[s["section"]], user_ids=[req["faculty_id"], owner[0] if owner else None])
                for (uid,) in con.execute("SELECT id FROM users WHERE role = 'student' AND section = ?",
                                          (s["section"],)).fetchall():
                    actions.create_nudge(con, uid, "replan", "Cover not confirmed",
                                         f"{s['subject_name']} on {s['day']} at {s['start']}: the substitute is not "
                                         "confirmed. The HOD is arranging cover.")
        d = tools.get_decision(decision_id, con=con)
        reporter = con.execute("SELECT i.reported_by FROM decisions d JOIN incidents i ON i.id = d.incident_id "
                               "WHERE d.id = ?", (decision_id,)).fetchone()
        bus.publish("decision_updated", d, user_ids=[reporter[0]] if reporter else [])
        return d

    def _decline(self, con, req, who: str, classes: str) -> Optional[tuple]:
        """Record the decline, withdraw the cover and escalate, all in one transaction. None = not pending."""
        gcal.calendar.wait_idle(timeout=10)  # a save in flight would bring the event back
        with con:
            if not con.execute("UPDATE ack_requests SET status = 'declined' WHERE id = ? AND status = 'pending'",
                               (req["id"],)).rowcount:
                return None
            done, stuck, events = self._withdraw_cover(con, req)
            status = self._escalate(con, req["decision_id"], f"Escalated: {who} declined via Telegram ({classes}).",
                                    [(req, done, stuck)], events)
        # committed: nothing below may undo it
        self._stop_timer_if_answered(con, req["decision_id"])
        self._after_withdraw(con, req["decision_id"], [(req, done, stuck)], events)
        return status, done, stuck

    def handle_button(self, chat_id, data: str) -> str:
        """Accept/Decline pressed. Returns the text to show the faculty member."""
        try:
            action, rid = (data or "").split(":")
            rid = int(rid)
            assert action in ("ack", "dec")
        except Exception:
            return "Unknown button."
        with use_db() as con:
            req = con.execute("SELECT * FROM ack_requests WHERE id = ?", (rid,)).fetchone()
            if req is None:
                return "This request no longer exists."
            owner = con.execute("SELECT name, telegram_chat_id FROM users WHERE id = ?", (req["faculty_id"],)).fetchone()
            if str(owner["telegram_chat_id"]) != str(chat_id):
                return "This request is for another faculty member."
            who = f"{owner['name']} ({req['faculty_id']})"
            classes = "; ".join(class_line(s) for s in self._req_classes(con, req))
            declined = None
            if action == "ack":
                with con:
                    n = con.execute("UPDATE ack_requests SET status = 'accepted' WHERE id = ? AND status = 'pending'",
                                    (rid,)).rowcount
            else:
                declined = self._decline(con, req, who, classes)
                n = declined is not None
            if not n:
                cur = con.execute("SELECT status FROM ack_requests WHERE id = ?", (rid,)).fetchone()[0]
                return f"Already {cur}." + (" The HOD has been alerted." if cur == "expired" else "")
            if action == "ack":
                waiting = con.execute("SELECT COUNT(*) FROM ack_requests WHERE decision_id = ? AND status != 'accepted'",
                                      (req["decision_id"],)).fetchone()[0]
                if waiting == 0:
                    self._transition(con, req["decision_id"], "acknowledged",
                                     f"Acknowledged: all substitutes accepted via Telegram (last: {who}).")
                return f"Thanks, you're confirmed: {classes}."
            status, done, stuck = declined
            if status != "escalated":
                return f"Noted, you're not covering it. (Decision #{req['decision_id']} is already {status}.)"
            self.alert_hod(con, f"⚠️ TARS escalation · Decision #{req['decision_id']}\n{who} declined: {classes}.\n"
                           + ("Cover withdrawn. Report the absence again to get another substitute." if done and not stuck
                              else "Please assign someone in the Admin console."))
            return "Noted, you're not covering it. The HOD has been alerted."

    def escalate_if_pending(self, decision_id: int) -> Optional[dict]:
        """Deadline job: expire unanswered requests and withdraw only those covers, in one transaction.

        Accepted covers stay. Never raises; on failure nothing changed and it tries again in a minute.
        """
        try:
            with use_db() as con:
                gcal.calendar.wait_idle(timeout=10)  # a save in flight would bring an event back
                minutes = escalation_minutes()
                with con:
                    con.execute("BEGIN IMMEDIATE")  # a late Accept waits for this, then finds `expired`
                    pending = con.execute("SELECT * FROM ack_requests WHERE decision_id = ? AND status = 'pending' "
                                          "ORDER BY id", (decision_id,)).fetchall()
                    if not pending:
                        return None
                    con.execute("UPDATE ack_requests SET status = 'expired' WHERE decision_id = ? AND status = 'pending'",
                                (decision_id,))
                    lines, withdrawn, events = [], [], []
                    for r in pending:
                        why = "no reply" if r["chat_id"] else "not linked to Telegram"
                        lines.append(f"{r['faculty_id']} ({why}): "
                                     + "; ".join(class_line(s) for s in self._req_classes(con, r)))
                        done, stuck, ev = self._withdraw_cover(con, r)
                        withdrawn.append((r, done, stuck))
                        events += ev
                    self._escalate(con, decision_id, f"Escalated: no Telegram confirmation within {minutes:g} min from "
                                   + ", ".join(r["faculty_id"] for r in pending) + ".", withdrawn, events)
                d = self._after_withdraw(con, decision_id, withdrawn, events)
                self.alert_hod(con, f"⚠️ TARS escalation · Decision #{decision_id}\n"
                                    f"No confirmation within {minutes:g} min:\n" + "\n".join(lines)
                               + "\nCover withdrawn. Report the absence again to get a substitute.")
                return d
        except Exception:
            log.exception("escalation job for decision %s failed", decision_id)
            self._retry_if_pending(decision_id)
            return None

    def _retry_if_pending(self, decision_id: int) -> None:
        try:
            with use_db() as con:
                if con.execute("SELECT 1 FROM ack_requests WHERE decision_id = ? AND status = 'pending'",
                               (decision_id,)).fetchone():
                    self.schedule_escalation(decision_id, now() + timedelta(minutes=1))
        except Exception:
            log.exception("could not re-arm the deadline for decision %s", decision_id)

    # ---------- Telegram handlers (thin async wrappers) ----------
    async def _on_start(self, update, context) -> None:
        arg = context.args[0] if context.args else None
        text = await asyncio.to_thread(self.start_flow, update.effective_chat.id, arg)
        await update.effective_message.reply_text(text)

    async def _on_text(self, update, context) -> None:
        reply, delete = await asyncio.to_thread(self.handle_text, update.effective_chat.id,
                                                update.effective_message.text)
        if delete:  # it was a password: don't leave it in the chat history
            try:
                await update.effective_message.delete()
            except Exception:
                log.warning("could not delete the password message in chat %s", update.effective_chat.id)
        await update.effective_message.reply_text(reply)

    async def _on_button(self, update, context) -> None:
        q = update.callback_query
        text = await asyncio.to_thread(self.handle_button, q.message.chat.id, q.data)
        try:
            await q.answer(text[:190])
            await q.edit_message_text(f"{q.message.text}\n\n{text}")  # also removes the buttons
        except Exception:
            log.exception("could not update the Telegram message")

    async def _on_error(self, update, context) -> None:
        log.error("Telegram handler error: %s", context.error)


notifier = Notifier()
