"""In-process event bus. /stream (SSE) will subscribe; for now events are kept in `recent`.

Each message: {event, data, sections, user_ids, hod, everyone}. The stream filters per viewer:
student → section in sections or own id in user_ids; faculty → id in user_ids; hod → hod flag.
"""
import logging
import threading
from collections import deque
from typing import Callable, Iterable

log = logging.getLogger("tars.bus")
_listeners: list[Callable[[dict], None]] = []
_lock = threading.Lock()
recent: deque = deque(maxlen=500)


def subscribe(fn: Callable[[dict], None]) -> None:
    with _lock:
        _listeners.append(fn)


def unsubscribe(fn: Callable[[dict], None]) -> None:
    with _lock:
        if fn in _listeners:
            _listeners.remove(fn)


def publish(event: str, data: dict, *, sections: Iterable[str] = (), user_ids: Iterable[str] = (),
            hod: bool = True, everyone: bool = False) -> None:
    msg = {"event": event, "data": data, "sections": sorted(set(sections)),
           "user_ids": sorted({u for u in user_ids if u}), "hod": hod, "everyone": everyone}
    recent.append(msg)
    with _lock:
        listeners = list(_listeners)
    for fn in listeners:
        try:
            fn(msg)
        except Exception:  # a broken listener must never break the agent
            log.exception("bus listener failed")
