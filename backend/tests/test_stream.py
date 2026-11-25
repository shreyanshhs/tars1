import json
import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import httpx
import pytest
import uvicorn
from conftest import H
from fastapi.testclient import TestClient
from test_agent import DEMO, FakeClient, demo_script

from app import agent, bus
from app import stream as sse
from app.models import User

USERS = {
    "S001": User(user_id="S001", name="s", role="student", section="CSE-A"),
    "S002": User(user_id="S002", name="s", role="student", section="CSE-B"),
    "F01": User(user_id="F01", name="f", role="faculty"),   # absent, reported it
    "F08": User(user_id="F08", name="f", role="faculty"),   # substitute
    "F05": User(user_id="F05", name="f", role="faculty"),   # uninvolved
    "H01": User(user_id="H01", name="h", role="hod"),
}


@pytest.fixture
def demo_messages(db, monkeypatch):
    """Run the demo (F01 reports own absence) and return what was published on the bus."""
    monkeypatch.setattr(agent, "make_client", lambda: FakeClient(demo_script(db)))
    from app.main import app
    bus.recent.clear()
    assert TestClient(app).post("/api/incidents", json=DEMO, headers=H("F01")).status_code == 202
    return list(bus.recent)


def visible(uid, msgs):
    return [m for m in msgs if sse.can_see(USERS[uid], m)]


def kinds(uid, msgs):
    return {m["event"] for m in visible(uid, msgs)}


def test_student_sees_only_own_section_and_own_nudges(demo_messages):
    seen = visible("S001", demo_messages)
    assert {m["event"] for m in seen} == {"timetable_updated", "nudge_created"}
    assert all(m["data"]["section"] == "CSE-A" for m in seen if m["event"] == "timetable_updated")
    assert all(m["data"]["user_id"] == "S001" for m in seen if m["event"] == "nudge_created")
    assert kinds("S002", demo_messages) == set()  # other section: nothing


def test_faculty_sees_own_slots_and_own_incident_only(demo_messages):
    assert kinds("F01", demo_messages) == {"timetable_updated", "decision_updated", "agent_step"}  # reporter
    f08 = visible("F08", demo_messages)
    assert {m["event"] for m in f08} == {"timetable_updated", "nudge_created"}  # substitute: slot + own nudge
    assert all(m["data"]["user_id"] == "F08" for m in f08 if m["event"] == "nudge_created")
    assert kinds("F05", demo_messages) == set()


def test_hod_sees_everything_except_other_peoples_nudges(demo_messages):
    seen = visible("H01", demo_messages)
    assert {m["event"] for m in seen} == {"timetable_updated", "decision_updated", "agent_step"}
    n_steps = sum(m["event"] == "agent_step" for m in demo_messages)
    assert sum(m["event"] == "agent_step" for m in seen) == n_steps


def test_stream_rejects_user_id_param(client):
    # v0.5: ?user_id= is gone; without a ticket the stream is closed even for a real user id
    r = client.get("/api/stream?user_id=H01")
    assert r.status_code == 401 and r.json() == {"error": "unauthorized", "detail": "Missing stream ticket"}
    assert client.get("/api/stream").status_code == 401


# ---------- end to end: real server, real EventSource-style clients ----------
@pytest.fixture
def server(db, monkeypatch):
    monkeypatch.setattr(sse, "PING_SECONDS", 0.3)
    monkeypatch.setattr(agent, "make_client", lambda: FakeClient(demo_script(db)))
    from app.main import app
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    srv = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning",
                                        timeout_graceful_shutdown=1))
    t = threading.Thread(target=srv.run, daemon=True)
    t.start()
    deadline = time.time() + 10
    while not srv.started:
        assert time.time() < deadline, "server did not start"
        time.sleep(0.05)
    yield f"http://127.0.0.1:{port}/api"
    srv.should_exit = True
    t.join(5)


def collect(url, seconds):
    """Read SSE frames for `seconds`; returns [(event, data)] and the response headers."""
    out, event = [], None
    with httpx.Client(timeout=5) as c, c.stream("GET", url) as r:
        assert r.status_code == 200
        headers = dict(r.headers)
        end = time.time() + seconds
        for line in r.iter_lines():
            if line.startswith("event:"):
                event = line[6:].strip()
            elif line.startswith("data:"):
                out.append((event, json.loads(line[5:].strip())))
            if time.time() > end:
                break
    return out, headers


def wait_for(cond, seconds=5):
    end = time.time() + seconds
    while not cond():
        assert time.time() < end
        time.sleep(0.05)


def test_live_stream_end_to_end(server):
    bus.recent.clear()
    who = ["S001", "S002", "H01", "F08"]
    with ThreadPoolExecutor(len(who)) as ex:
        tickets = {u: httpx.post(f"{server}/auth/stream-ticket", headers=H(u)).json()["ticket"] for u in who}
        futures = {u: ex.submit(collect, f"{server}/stream?ticket={tickets[u]}", 3) for u in who}
        wait_for(lambda: len(bus._listeners) == len(who))  # all subscribed before the incident
        r = httpx.post(f"{server}/incidents", json=DEMO, headers=H("H01"), timeout=10)
        assert r.status_code == 202
        results = {u: f.result() for u, f in futures.items()}

    s001, headers = results["S001"]
    assert headers["content-type"].startswith("text/event-stream")
    assert ("ping", {}) in s001  # keep-alive, data: {}
    assert {e for e, _ in s001} == {"ping", "timetable_updated", "nudge_created"}
    tu = next(d for e, d in s001 if e == "timetable_updated")
    assert tu["section"] == "CSE-A" and len(tu["slot_ids"]) == 2
    assert all(d["user_id"] == "S001" and "read" in d for e, d in s001 if e == "nudge_created")

    assert {e for e, _ in results["S002"][0]} == {"ping"}  # other section: only pings

    hod = results["H01"][0]
    assert {e for e, _ in hod} == {"ping", "timetable_updated", "decision_updated", "agent_step"}
    steps = [d for e, d in hod if e == "agent_step"]
    assert steps[0]["step"] == "perceive" and steps[-1]["step"] == "done"
    assert set(steps[0]) == {"decision_id", "step", "phase", "text", "ts"} and steps[0]["phase"] == "signal"
    final = [d for e, d in hod if e == "decision_updated"][-1]
    assert final["status"] == "pending_ack" and set(final) == {
        "id", "created_at", "trigger", "summary", "reasoning", "affected_slot_ids", "status", "calendar_link"}

    f08 = {e for e, _ in results["F08"][0]}
    assert f08 == {"ping", "timetable_updated", "nudge_created"}

    wait_for(lambda: len(bus._listeners) == 0)  # disconnects unsubscribe (no leaks)
