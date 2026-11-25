"""SSE plumbing for GET /stream: bus messages → per-user filtered ServerSentEvents.

Who sees what (docs/API_CONTRACT.md):
  timetable_updated → that section + affected faculty + HOD
  decision_updated  → HOD + reporting faculty
  nudge_created     → that user only
  agent_step        → HOD + reporting faculty
  demo_reset        → everyone (v0.4)
  ping              → everyone (sent by sse-starlette every PING_SECONDS)
Publishers put the audience on each message (bus.publish sections/user_ids/hod); this module only filters.
"""
import asyncio
import json
import logging
from typing import AsyncIterator, Optional

from sse_starlette.event import ServerSentEvent

from . import bus
from .models import User

log = logging.getLogger("tars.stream")

PING_SECONDS = 15.0
SESSION_REVOKED = "_session_revoked"  # internal bus event: close this session's open streams
QUEUE_MAX = 1000  # per connection; a stuck client drops events instead of growing memory


def ping_event() -> ServerSentEvent:
    return ServerSentEvent(event="ping", data="{}")


def can_see(user: User, msg: dict) -> bool:
    if msg.get("everyone") or user.user_id in msg["user_ids"]:
        return True
    if user.role == "hod":
        return msg["hod"]
    if user.role == "student":
        return user.section is not None and user.section in msg["sections"]
    return False  # faculty: only messages naming them (their slots, their incidents, their nudges)


async def event_stream(user: User, sid: Optional[str] = None) -> AsyncIterator[ServerSentEvent]:
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_MAX)

    def put(msg: dict) -> None:
        try:
            queue.put_nowait(msg)
        except asyncio.QueueFull:
            log.warning("stream queue full for %s; dropping %s", user.user_id, msg["event"])

    def on_message(msg: dict) -> None:  # called from any thread
        if msg["event"] == SESSION_REVOKED:  # never forwarded; ends our stream if it's our session
            if sid and msg["data"].get("sid") == sid:
                loop.call_soon_threadsafe(put, None)
            return
        if can_see(user, msg):
            loop.call_soon_threadsafe(put, msg)

    bus.subscribe(on_message)
    try:
        while True:
            msg = await queue.get()
            if msg is None:  # session logged out
                return
            yield ServerSentEvent(event=msg["event"], data=json.dumps(msg["data"], separators=(",", ":")))
    finally:
        bus.unsubscribe(on_message)
