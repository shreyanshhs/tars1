"""Telegram notifications (polling bot) + escalation timer.

Flow:
  /start → login id → password (passwordless only if TARS_PASSWORDLESS_LOGIN=1) → users.telegram_chat_id saved.
  Agent commits a substitution → each substitute gets the class details with [Accept] [Decline].
    all substitutes Accept           → decision `acknowledged`
    any Decline                       → decision `escalated` + HOD alerted
    no reply within ESCALATION_MINUTES → pending requests `expired`, decision `escalated` + HOD alerted
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
import time
from datetime import datetime, timedelta
from typing import Callable, Optional

from . import auth, bus, tools
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
        if d["status"] == "pending_ack":
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
        """After a restart: re-arm timers for decisions still waiting on substitutes."""
        with use_db() as con:
            rows = con.execute("SELECT r.decision_id, MIN(r.due_at) FROM ack_requests r JOIN decisions d "
                               "ON d.id = r.decision_id WHERE r.status = 'pending' AND d.status = 'pending_ack' "
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
            new = "accepted" if action == "ack" else "declined"
            with con:
                n = con.execute("UPDATE ack_requests SET status = ? WHERE id = ? AND status = 'pending'",
                                (new, rid)).rowcount
            if not n:
                cur = con.execute("SELECT status FROM ack_requests WHERE id = ?", (rid,)).fetchone()[0]
                return f"Already {cur}." + (" The HOD has been alerted." if cur == "expired" else "")
            who = f"{owner['name']} ({req['faculty_id']})"
            classes = "; ".join(class_line(s) for s in self._req_classes(con, req))
            if action == "ack":
                waiting = con.execute("SELECT COUNT(*) FROM ack_requests WHERE decision_id = ? AND status != 'accepted'",
                                      (req["decision_id"],)).fetchone()[0]
                if waiting == 0:
                    self._transition(con, req["decision_id"], "acknowledged",
                                     f"Acknowledged: all substitutes accepted via Telegram (last: {who}).")
                return f"Thanks, you're confirmed: {classes}."
            d = self._transition(con, req["decision_id"], "escalated",
                                 f"Escalated: {who} declined via Telegram ({classes}).")
            if d is None:
                cur = tools.get_decision(req["decision_id"], con=con)["status"]
                return f"Noted, you're not covering it. (Decision #{req['decision_id']} is already {cur}.)"
            self.alert_hod(con, f"⚠️ TARS escalation · Decision #{req['decision_id']}\n"
                                f"{who} declined: {classes}.\nPlease assign someone in the Admin console.")
            return "Noted, you're not covering it. The HOD has been alerted."

    def escalate_if_pending(self, decision_id: int) -> Optional[dict]:
        """Timer job: no reply in time → expire pending requests, escalate, alert HOD. Never raises."""
        try:
            with use_db() as con:
                pending = con.execute("SELECT * FROM ack_requests WHERE decision_id = ? AND status = 'pending'",
                                      (decision_id,)).fetchall()
                if not pending:
                    return None
                with con:
                    con.execute("UPDATE ack_requests SET status = 'expired' WHERE decision_id = ? AND status = 'pending'",
                                (decision_id,))
                minutes = escalation_minutes()
                lines = []
                for r in pending:
                    why = "no reply" if r["chat_id"] else "not linked to Telegram"
                    lines.append(f"{r['faculty_id']} ({why}): "
                                 + "; ".join(class_line(s) for s in self._req_classes(con, r)))
                d = self._transition(con, decision_id, "escalated",
                                     f"Escalated: no Telegram confirmation within {minutes:g} min from "
                                     + ", ".join(r["faculty_id"] for r in pending) + ".")
                if d:
                    self.alert_hod(con, f"⚠️ TARS escalation · Decision #{decision_id}\n"
                                        f"No confirmation within {minutes:g} min:\n" + "\n".join(lines)
                                   + "\nPlease assign someone in the Admin console.")
                return d
        except Exception:
            log.exception("escalation job for decision %s failed", decision_id)
            return None

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
