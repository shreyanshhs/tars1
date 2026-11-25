"""Telegram notifications + escalation, with Telegram mocked (no network)."""
import asyncio
import json
import time
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from conftest import H, slot_id
from fastapi.testclient import TestClient
from test_agent import DEMO, FakeClient, demo_script

from app import agent, bus, notify, tools
from app.db import iso, now

CHAT = {"F07": "700", "F08": "800", "H01": "900"}


class FakeTelegram:
    def __init__(self):
        self.sent, self.fail = [], False

    def __call__(self, chat_id, text, buttons):
        if self.fail:
            raise RuntimeError("telegram down")
        self.sent.append({"chat_id": chat_id, "text": text, "buttons": buttons})
        return 1000 + len(self.sent)

    def to(self, chat):
        return [m for m in self.sent if m["chat_id"] == chat]


@pytest.fixture
def tg(db, monkeypatch):
    fake = FakeTelegram()
    n = notify.Notifier(sender=fake)
    n.start_scheduler()
    monkeypatch.setattr(notify, "notifier", n)
    monkeypatch.setattr(agent, "make_client", lambda: FakeClient(demo_script(db)))
    yield fake, n
    n.scheduler.shutdown(wait=False)


@pytest.fixture
def api(db):
    from app.main import app
    return TestClient(app)


def link_all(n, who=("F07", "F08", "H01")):
    """Simulate phones that already finished /start (the flow itself is tested below)."""
    from app.db import use_db
    with use_db() as con, con:
        for uid in who:
            con.execute("UPDATE users SET telegram_chat_id = ? WHERE id = ?", (CHAT[uid], uid))


def run_demo(api):
    bus.recent.clear()
    r = api.post("/api/incidents", json=DEMO, headers=H("H01"))
    assert r.status_code == 202
    return r.json()["decision_id"]


def status(db, did):
    return tools.get_decision(did, con=db)["status"]


def reqs(db, did):
    return {r["faculty_id"]: dict(r) for r in db.execute("SELECT * FROM ack_requests WHERE decision_id = ?", (did,))}


def updates(did):
    return [m["data"]["status"] for m in bus.recent if m["event"] == "decision_updated" and m["data"]["id"] == did]


def press(n, uid, rid, accept=True):
    return n.handle_button(CHAT[uid], f"{'ack' if accept else 'dec'}:{rid}")


# ---------- linking: /start → login id → password ----------
def linked(db):
    return dict(db.execute("SELECT id, telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL").fetchall())


@pytest.fixture
def demo_password(db, monkeypatch):
    from app import seed
    monkeypatch.setenv("TARS_DEMO_PASSWORD", "pw-for-tests")
    seed.apply_demo_password(db, keep_if_unset=False)
    db.commit()
    return "pw-for-tests"


def test_start_asks_for_id_then_password(tg, db, demo_password):
    _, n = tg
    assert "login id" in n.start_flow("800")
    reply, delete = n.handle_text("800", " f08 ")
    assert "password" in reply.lower() and delete is False and linked(db) == {}
    reply, delete = n.handle_text("800", demo_password)
    assert "Linked to" in reply and "F08" in reply and delete is True       # password message gets deleted
    assert linked(db) == {"F08": "800"}
    assert "password" in n.start_flow("555", "1ab25cs001").lower()           # /start <usn> deep link
    assert "Linked to" in n.handle_text("555", demo_password)[0] and linked(db)["S001"] == "555"


def test_start_wrong_password_or_unknown_id(tg, db, demo_password):
    _, n = tg
    n.start_flow("800"); n.handle_text("800", "F08")
    reply, delete = n.handle_text("800", "wrong")
    assert "Wrong login id or password" in reply and delete is True and linked(db) == {}
    assert n.handle_text("800", demo_password)[0].startswith("Send /start")  # one attempt, then restart
    n.start_flow("800"); n.handle_text("800", "nobody")
    assert "Wrong login id or password" in n.handle_text("800", demo_password)[0]  # same message: no id probing


def test_start_passwordless_only_when_enabled(tg, db, monkeypatch):
    _, n = tg
    n.start_flow("800")
    assert "password" in n.handle_text("800", "F08")[0].lower()              # off by default: asks
    assert "Wrong" in n.handle_text("800", "")[0] and linked(db) == {}       # no password set → can't link
    monkeypatch.setenv("TARS_PASSWORDLESS_LOGIN", "1")
    n.start_flow("800")
    reply, delete = n.handle_text("800", "F08")
    assert "Linked to" in reply and delete is False and linked(db) == {"F08": "800"}


def test_text_without_start_and_expired_flow(tg, db, demo_password, monkeypatch):
    _, n = tg
    assert n.handle_text("800", "F08")[0] == notify.NOT_STARTED_TEXT
    n.start_flow("800")
    monkeypatch.setattr(notify, "LINK_FLOW_SECONDS", -1)
    assert n.handle_text("800", "F08")[0] == notify.NOT_STARTED_TEXT and linked(db) == {}


# ---------- commit → message with buttons ----------
def test_commit_sends_substitutes_accept_decline(tg, api, db):
    fake, n = tg
    link_all(n)
    did = run_demo(api)
    assert status(db, did) == "pending_ack"
    r = reqs(db, did)
    assert set(r) == {"F07", "F08"} and all(x["status"] == "pending" for x in r.values())
    ds = slot_id(db, "CSE-A", "MON", 2)
    assert json.loads(r["F08"]["slot_ids"]) == [ds]

    (m8,) = fake.to("800")
    assert "CSE-A" in m8["text"] and "(DS)" in m8["text"] and "MON 09:55–10:50" in m8["text"] and "R101" in m8["text"]
    assert "F01" in m8["text"] and f"Decision #{did}" in m8["text"] and "2 min" in m8["text"]
    assert m8["buttons"] == [("✅ Accept", f"ack:{r['F08']['id']}"), ("❌ Decline", f"dec:{r['F08']['id']}")]
    assert len(fake.to("700")) == 1 and fake.to("900") == []  # HOD not bothered yet
    assert r["F08"]["message_id"] is not None

    job = n.scheduler.get_job(f"escalate-{did}")
    assert job and abs((job.next_run_time.replace(tzinfo=None) - (now() + timedelta(minutes=2))).total_seconds()) < 10
    step = [m["data"] for m in bus.recent if m["event"] == "agent_step" and m["data"]["text"].startswith("Telegram:")]
    assert step and "F07, F08" in step[0]["text"] and step[0]["phase"] == "dispatch"


# ---------- Accept ----------
def test_accept_by_all_substitutes_acknowledges(tg, api, db):
    fake, n = tg
    link_all(n)
    did = run_demo(api)
    r = reqs(db, did)
    assert "confirmed" in press(n, "F08", r["F08"]["id"])
    assert status(db, did) == "pending_ack"  # F07 still to answer
    assert press(n, "F07", r["F07"]["id"]).startswith("Thanks")
    assert status(db, did) == "acknowledged"
    assert updates(did)[-1] == "acknowledged"
    assert "accepted via Telegram" in tools.get_decision(did, con=db)["reasoning"]
    assert n.scheduler.get_job(f"escalate-{did}") is None  # timer cancelled
    assert fake.to("900") == []


# ---------- Decline ----------
def test_decline_escalates_and_alerts_hod(tg, api, db):
    fake, n = tg
    link_all(n)
    did = run_demo(api)
    r = reqs(db, did)
    assert "HOD has been alerted" in press(n, "F08", r["F08"]["id"], accept=False)
    assert status(db, did) == "escalated" and updates(did)[-1] == "escalated"
    assert "declined via Telegram" in tools.get_decision(did, con=db)["reasoning"]
    (alert,) = fake.to("900")
    assert f"Decision #{did}" in alert["text"] and "F08" in alert["text"] and "declined" in alert["text"]
    assert alert["buttons"] is None
    assert n.scheduler.get_job(f"escalate-{did}") is None
    # F07 accepting afterwards is recorded but doesn't un-escalate
    press(n, "F07", r["F07"]["id"])
    assert status(db, did) == "escalated"


def test_button_guards(tg, api, db):
    _, n = tg
    link_all(n)
    did = run_demo(api)
    rid = reqs(db, did)["F08"]["id"]
    assert "another faculty" in n.handle_button(CHAT["F07"], f"ack:{rid}")   # someone else's request
    assert status(db, did) == "pending_ack" and reqs(db, did)["F08"]["status"] == "pending"
    assert n.handle_button("800", "hack:1") == "Unknown button."
    assert n.handle_button("800", "garbage") == "Unknown button."
    assert "no longer exists" in n.handle_button("800", "ack:9999")
    press(n, "F08", rid)
    assert press(n, "F08", rid) == "Already accepted."                          # double press


# ---------- timeout ----------
def test_no_reply_escalates_and_alerts_hod(tg, api, db):
    fake, n = tg
    link_all(n)
    did = run_demo(api)
    r = reqs(db, did)
    press(n, "F07", r["F07"]["id"])                       # F07 answers, F08 doesn't
    d = n.escalate_if_pending(did)
    assert d["status"] == "escalated" and status(db, did) == "escalated" and updates(did)[-1] == "escalated"
    assert reqs(db, did)["F08"]["status"] == "expired" and reqs(db, did)["F07"]["status"] == "accepted"
    (alert,) = fake.to("900")
    assert "No confirmation within 2 min" in alert["text"] and "F08 (no reply)" in alert["text"]
    assert "Already expired" in press(n, "F08", r["F08"]["id"])     # late press
    assert n.escalate_if_pending(did) is None                       # idempotent
    assert len(fake.to("900")) == 1


def test_timeout_after_acknowledge_does_nothing(tg, api, db):
    fake, n = tg
    link_all(n)
    did = run_demo(api)
    assert api.post(f"/api/decisions/{did}/approve", headers=H("H01")).json()["status"] == "acknowledged"
    assert n.scheduler.get_job(f"escalate-{did}") is None          # HOD approval cancels the timer
    assert n.escalate_if_pending(did) is None and status(db, did) == "acknowledged"
    assert fake.to("900") == []


def test_real_scheduler_fires(tg, api, db, monkeypatch):
    fake, n = tg
    monkeypatch.setenv("ESCALATION_MINUTES", "0.01")  # 0.6 s
    link_all(n)
    did = run_demo(api)
    deadline = time.time() + 10
    while status(db, did) != "escalated":
        assert time.time() < deadline, "escalation timer did not fire"
        time.sleep(0.1)
    assert len(fake.to("900")) == 1


def test_restore_timers_after_restart(tg, db):
    fake, n = tg
    link_all(n)
    d = tools.log_decision("absence", "x", "y", [1], status="pending_ack", con=db)
    db.execute("INSERT INTO ack_requests (decision_id, faculty_id, slot_ids, chat_id, due_at) VALUES (?,?,?,?,?)",
               (d["id"], "F08", "[1]", "800", iso(now() - timedelta(minutes=1))))  # already overdue
    db.commit()
    fresh = notify.Notifier(sender=fake)
    fresh.start_scheduler()
    try:
        fresh.restore_timers()
        deadline = time.time() + 10
        while status(db, d["id"]) != "escalated":
            assert time.time() < deadline
            time.sleep(0.1)
    finally:
        fresh.scheduler.shutdown(wait=False)


# ---------- degraded modes: never crash ----------
def test_unlinked_substitute_still_times_out(tg, api, db):
    fake, n = tg
    link_all(n, who=("F07", "H01"))                 # F08 never did /start
    did = run_demo(api)
    r = reqs(db, did)
    assert r["F08"]["chat_id"] is None and r["F08"]["message_id"] is None and fake.to("800") == []
    assert n.scheduler.get_job(f"escalate-{did}") is not None
    assert "not reachable: F08" in next(m["data"]["text"] for m in bus.recent
                                         if m["event"] == "agent_step" and m["data"]["text"].startswith("Telegram:"))
    n.escalate_if_pending(did)
    assert "F08 (not linked to Telegram)" in fake.to("900")[0]["text"]


def test_send_failure_is_logged_not_raised(tg, api, db):
    fake, n = tg
    link_all(n)
    fake.fail = True
    did = run_demo(api)
    assert status(db, did) == "pending_ack"          # agent finished normally
    assert all(x["message_id"] is None for x in reqs(db, did).values())
    assert n.escalate_if_pending(did)["status"] == "escalated"   # HOD alert fails too, still escalates


def test_hod_not_linked_still_escalates(tg, api, db):
    fake, n = tg
    link_all(n, who=("F07", "F08"))
    did = run_demo(api)
    n.escalate_if_pending(did)
    assert status(db, did) == "escalated" and fake.to("900") == []


def test_no_token_is_a_logged_noop(db, monkeypatch, caplog):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "")
    n = notify.Notifier()
    asyncio.run(n.start())
    assert not n.enabled and n.scheduler is None and "TELEGRAM_BOT_TOKEN not set" in caplog.text
    assert n.request_acks(1, [1]) == [] and n.send("800", "hi") is None
    asyncio.run(n.stop())


def test_bot_start_failure_disables_without_crash(db, monkeypatch, caplog):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123:fake")
    n = notify.Notifier()
    monkeypatch.setattr(n, "_start_bot", AsyncMock(side_effect=RuntimeError("network down")))
    asyncio.run(n.start())
    assert not n.enabled and n.scheduler is None and "failed to start" in caplog.text


def test_invalid_token_logs_one_clear_line(db, monkeypatch, caplog):
    from telegram.error import InvalidToken
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123:fake")
    n = notify.Notifier()
    monkeypatch.setattr(n, "_start_bot", AsyncMock(side_effect=InvalidToken("Not Found")))
    asyncio.run(n.start())
    assert not n.enabled and "rejected TELEGRAM_BOT_TOKEN" in caplog.text and "Traceback" not in caplog.text
    assert "123:fake" not in caplog.text  # token never logged


def test_demo_without_telegram_unchanged(api, db, monkeypatch):
    """Default notifier (no token, not started): demo ends pending_ack exactly as before, no ack rows."""
    monkeypatch.setattr(notify, "notifier", notify.Notifier())
    monkeypatch.setattr(agent, "make_client", lambda: FakeClient(demo_script(db)))
    did = run_demo(api)
    assert status(db, did) == "pending_ack"
    assert db.execute("SELECT COUNT(*) FROM ack_requests").fetchone()[0] == 0
    assert not [m for m in bus.recent if m["event"] == "agent_step" and m["data"]["text"].startswith("Telegram:")]


# ---------- Telegram handler glue (PTB objects faked) ----------
def _update(chat, text=None, data=None):
    msg = SimpleNamespace(text=text or "TARS: can you cover this class?", reply_text=AsyncMock(),
                          chat=SimpleNamespace(id=chat))
    q = SimpleNamespace(data=data, message=msg, answer=AsyncMock(), edit_message_text=AsyncMock()) if data else None
    return SimpleNamespace(effective_chat=SimpleNamespace(id=chat), effective_message=msg, callback_query=q)


def test_handlers(tg, api, db, demo_password):
    _, n = tg
    u = _update(800)
    asyncio.run(n._on_start(u, SimpleNamespace(args=[])))
    assert "login id" in u.effective_message.reply_text.call_args.args[0]
    u = _update(800, text="F08")
    asyncio.run(n._on_text(u, SimpleNamespace()))
    assert "password" in u.effective_message.reply_text.call_args.args[0].lower()
    u = _update(800, text=demo_password)
    u.effective_message.delete = AsyncMock()
    asyncio.run(n._on_text(u, SimpleNamespace()))
    assert "Linked to" in u.effective_message.reply_text.call_args.args[0]
    u.effective_message.delete.assert_awaited_once()                    # password removed from chat
    u = _update(700)
    asyncio.run(n._on_start(u, SimpleNamespace(args=["F07"])))           # /start F07 deep link
    assert "password" in u.effective_message.reply_text.call_args.args[0].lower()
    link_all(n, who=("F07",))

    did = run_demo(api)
    rid = reqs(db, did)["F08"]["id"]
    u = _update(800, data=f"ack:{rid}")
    asyncio.run(n._on_button(u, SimpleNamespace()))
    assert "confirmed" in u.callback_query.answer.call_args.args[0]
    assert "confirmed" in u.callback_query.edit_message_text.call_args.args[0]  # buttons replaced by result
    assert reqs(db, did)["F08"]["status"] == "accepted"
