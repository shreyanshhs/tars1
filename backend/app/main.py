"""TARS backend: read-only API (contract v0.2.1). Agent, incidents, approvals and SSE come later."""
import json
import logging
import os
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.exceptions import HTTPException as StarletteHTTPException

from sse_starlette.sse import EventSourceResponse

from . import actions, agent, auth, bus, gcal, notify, tools
from . import stream as sse
from .db import DAYS, NUDGE_SELECT, fetch_slots, get_db, iso, now, nudge_dict, use_db
from .models import (AttendanceItem, Day, Decision, ErrorResponse, Event, Faculty, FacultyUpdate,
                     IncidentAccepted, IncidentRequest, LoginRequest, LoginResponse, LogoutResponse, Meta, Nudge, ResetResult, Room, Slot,
                     SnoozeRequest, Stats, StreamTicket,
                     Today, User)
from .validator import ClashError

load_dotenv(Path(__file__).resolve().parents[2] / ".env")  # repo-root .env; fine if missing

@asynccontextmanager
async def lifespan(_: FastAPI):
    """Start/stop the Telegram bot + escalation scheduler. Failures are logged, never fatal."""
    try:
        await notify.notifier.start()
    except Exception:
        logging.getLogger("tars").exception("notifier failed to start")
    yield
    try:
        await notify.notifier.stop()
    except Exception:
        logging.getLogger("tars").exception("notifier failed to stop")


app = FastAPI(title="TARS API", version="0.2.1", lifespan=lifespan)
# ---------- CORS ----------
# Any port on localhost / 127.0.0.1 (Vite moves off 5173 when it's busy, e.g. to 5176).
LOCAL_ORIGIN_REGEX = r"^http://(localhost|127\.0\.0\.1)(:\d{1,5})?$"


def parse_cors_origins(raw: Optional[str]) -> list[str]:
    """CORS_ORIGINS env: comma-separated exact origins. '*' and blanks are ignored (never allow all)."""
    out = []
    for o in (raw or "").split(","):
        o = o.strip().rstrip("/")
        if not o:
            continue
        if "*" in o:
            logging.getLogger("tars.cors").warning("ignoring wildcard CORS origin %r", o)
            continue
        out.append(o)
    return out


def add_cors(target: FastAPI) -> None:
    target.add_middleware(
        CORSMiddleware,
        allow_origin_regex=LOCAL_ORIGIN_REGEX,
        allow_origins=parse_cors_origins(os.environ.get("CORS_ORIGINS")),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


add_cors(app)

# ---------- errors: always {"error", "detail"} ----------
ERROR_CODES = {401: "unauthorized", 403: "forbidden", 404: "not_found", 409: "clash", 422: "validation"}


@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict):  # raise HTTPException(409, {"error": "invalid_state", "detail": ...})
        content = exc.detail
    else:
        content = {"error": ERROR_CODES.get(exc.status_code, "error"), "detail": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content=content, headers=getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    msg = "; ".join(f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors())
    return JSONResponse(status_code=422, content={"error": "validation", "detail": msg})


AUTH_ERRORS = {401: {"model": ErrorResponse}}
HOD_ERRORS = {401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}}

# ---------- auth (v0.5): identity and role come ONLY from a verified signed token ----------
USER_SELECT = "SELECT id AS user_id, usn, name, role, section FROM users"
bearer = HTTPBearer(auto_error=False, description="Session token from POST /api/auth/login")


def unauthorized(detail: str, code: str = "unauthorized") -> HTTPException:
    return HTTPException(401, {"error": code, "detail": detail}, headers={"WWW-Authenticate": "Bearer"})


def user_from_claims(con: sqlite3.Connection, claims: dict) -> User:
    """sub/role/section from the verified token; the DB only supplies display fields (name, usn)
    and rejects tokens of users that no longer exist."""
    row = con.execute("SELECT name, usn FROM users WHERE id = ?", (claims["sub"],)).fetchone()
    if row is None:
        raise unauthorized("Unknown user")
    return User(user_id=claims["sub"], role=claims["role"], section=claims.get("section"),
                name=row["name"], usn=row["usn"])


def session_claims(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
                   con: sqlite3.Connection = Depends(get_db)) -> dict:
    """Verified, non-revoked session token claims. Every authenticated endpoint goes through this."""
    if creds is None or not creds.credentials:
        raise unauthorized("Missing bearer token")
    try:
        claims = auth.verify_session(creds.credentials)
    except auth.AuthError as e:
        raise unauthorized(e.detail)
    if auth.is_revoked(con, claims.get("jti")):
        raise unauthorized("Session revoked")
    return claims


def current_user(claims: dict = Depends(session_claims), con: sqlite3.Connection = Depends(get_db)) -> User:
    return user_from_claims(con, claims)


def require_roles(*roles: str):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, f"Requires role: {' or '.join(roles)}")
        return user
    return dep


require_hod = require_roles("hod")
require_staff = require_roles("faculty", "hod")  # for mutations (incidents etc.), used later


def resolve_section(section: Optional[str], user: User) -> str:
    sec = section or user.section
    if not sec:
        raise HTTPException(422, "section query param is required for faculty/HOD")
    return sec


api = APIRouter(prefix="/api")


def _utc_iso(epoch: int) -> str:
    return datetime.fromtimestamp(epoch, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@api.post("/auth/login", response_model=LoginResponse, responses={401: {"model": ErrorResponse}}, tags=["auth"])
def login(body: LoginRequest, con: sqlite3.Connection = Depends(get_db)):
    """Password login. Passwordless (no/empty password) only when TARS_PASSWORDLESS_LOGIN=1."""
    try:
        row = auth.authenticate(con, body.login_id, body.password)
    except auth.AuthError as e:
        raise unauthorized(e.detail, e.code)
    token, exp = auth.issue_session(row)
    user = User(user_id=row["id"], usn=row["usn"], name=row["name"], role=row["role"], section=row["section"])
    return {"token": token, "token_type": "bearer", "expires_at": _utc_iso(exp), "user": user}


@api.post("/auth/logout", response_model=LogoutResponse, responses=AUTH_ERRORS, tags=["auth"])
def logout(claims: dict = Depends(session_claims), con: sqlite3.Connection = Depends(get_db)):
    """Revoke THIS token (other sessions of the same user stay valid). Its stream tickets stop working
    and its open /stream connections are closed."""
    auth.revoke(con, claims)
    bus.publish(sse.SESSION_REVOKED, {"sid": claims["jti"]}, hod=False)  # internal; never sent to clients
    return {"ok": True}


@api.post("/auth/stream-ticket", response_model=StreamTicket, responses=AUTH_ERRORS, tags=["auth"])
def stream_ticket(claims: dict = Depends(session_claims), user: User = Depends(current_user)):
    """Short-lived (60 s), single-use ticket for GET /stream?ticket=… (EventSource can't send headers)."""
    ticket, exp = auth.issue_stream_ticket({"sub": user.user_id, "role": user.role, "section": user.section,
                                            "jti": claims.get("jti")})
    return {"ticket": ticket, "expires_at": _utc_iso(exp)}


@api.get("/auth/demo-users", response_model=list[User], tags=["auth"])
def demo_users(con: sqlite3.Connection = Depends(get_db)):
    sql = f"{USER_SELECT} ORDER BY CASE role WHEN 'student' THEN 1 WHEN 'hod' THEN 2 ELSE 3 END, id"
    return [dict(r) for r in con.execute(sql)]


@api.get("/me", response_model=User, responses=AUTH_ERRORS, tags=["auth"])
def me(user: User = Depends(current_user)):
    return user


# ---------- schedule ----------
@api.get("/timetable", response_model=list[Slot], responses=AUTH_ERRORS, tags=["schedule"])
def timetable(section: Optional[str] = None, user: User = Depends(current_user),
              con: sqlite3.Connection = Depends(get_db)):
    return fetch_slots(con, "s.section = ?", (resolve_section(section, user),))


@api.get("/timetable/faculty/{faculty_id}", response_model=list[Slot],
         responses={**AUTH_ERRORS, 404: {"model": ErrorResponse}}, tags=["schedule"])
def faculty_timetable(faculty_id: str, _: User = Depends(current_user),
                      con: sqlite3.Connection = Depends(get_db)):
    if con.execute("SELECT 1 FROM faculty WHERE id = ?", (faculty_id,)).fetchone() is None:
        raise HTTPException(404, f"No faculty with id {faculty_id}")
    return fetch_slots(con, "s.faculty_id = ?", (faculty_id,))


@api.get("/rooms", response_model=list[Room], responses=AUTH_ERRORS, tags=["schedule"])
def rooms(day: Day, period: int = Query(ge=1, le=6), _: User = Depends(current_user),
          con: sqlite3.Connection = Depends(get_db)):
    sql = """SELECT r.id, r.name, r.kind, r.capacity,
                    NOT EXISTS (SELECT 1 FROM slots s WHERE s.room_id = r.id AND s.day = ?
                                AND s.period = ? AND s.status != 'cancelled') AS free
             FROM rooms r ORDER BY r.id"""
    return [{**dict(r), "free": bool(r["free"])} for r in con.execute(sql, (day, period))]


def today_day() -> str:
    pinned = os.environ.get("DEMO_DAY", "").strip().upper()
    if pinned in DAYS:
        return pinned
    wd = datetime.now().weekday()
    return DAYS[wd] if wd < 5 else "MON"


def user_nudges(con: sqlite3.Connection, user_id: str) -> list[dict]:
    """Caller's visible nudges: not blocked, not currently snoozed. Newest first."""
    rows = con.execute(f"{NUDGE_SELECT} WHERE user_id = ? AND blocked = 0 "
                       "AND (snoozed_until IS NULL OR snoozed_until <= ?) ORDER BY created_at DESC, id DESC",
                       (user_id, iso(now())))
    return [nudge_dict(r) for r in rows]


@api.get("/today", response_model=Today, responses=AUTH_ERRORS, tags=["schedule"])
def today(user: User = Depends(current_user), con: sqlite3.Connection = Depends(get_db)):
    day = today_day()
    if user.role == "student":
        slots = fetch_slots(con, "s.day = ? AND s.section = ?", (day, user.section))
    elif user.role == "faculty":
        slots = fetch_slots(con, "s.day = ? AND s.faculty_id = ?", (day, user.user_id))
    else:
        slots = fetch_slots(con, "s.day = ?", (day,))
    return {"day": day, "slots": slots, "nudges": user_nudges(con, user.user_id)}


@api.get("/attendance", response_model=list[AttendanceItem], responses=AUTH_ERRORS, tags=["schedule"])
def attendance(section: Optional[str] = None, user: User = Depends(current_user),
               con: sqlite3.Connection = Depends(get_db)):
    rows = con.execute("SELECT subject_code, percent FROM attendance WHERE section = ? ORDER BY rowid",
                       (resolve_section(section, user),))
    return [dict(r) for r in rows]


# ---------- admin ----------
@api.get("/decisions", response_model=list[Decision], responses=HOD_ERRORS, tags=["admin"])
def decisions(_: User = Depends(require_hod), con: sqlite3.Connection = Depends(get_db)):
    rows = con.execute("SELECT id, created_at, trigger, summary, reasoning, affected_slot_ids, status, calendar_link "
                       "FROM decisions ORDER BY created_at DESC, id DESC")
    return [{**dict(r), "affected_slot_ids": json.loads(r["affected_slot_ids"] or "[]")} for r in rows]


@api.get("/stats", response_model=Stats, responses=HOD_ERRORS, tags=["admin"])
def stats(_: User = Depends(require_hod), con: sqlite3.Connection = Depends(get_db)):
    one = lambda sql: con.execute(sql).fetchone()[0]
    return {
        "classes_lost": one("SELECT COUNT(*) FROM slots WHERE status = 'cancelled'"),
        "rescued": one("SELECT COUNT(*) FROM decisions WHERE status IN ('committed','pending_ack','acknowledged')"),
        "nudges_acted": one("SELECT COUNT(*) FROM nudges WHERE read = 1 OR blocked = 1"),
        "avg_response_s": 0,  # filled in once the agent records timings
    }


# ---------- nudges & events ----------
@api.get("/nudges", response_model=list[Nudge], responses=AUTH_ERRORS, tags=["nudges"])
def nudges(user: User = Depends(current_user), con: sqlite3.Connection = Depends(get_db)):
    return user_nudges(con, user.user_id)


def _events(con: sqlite3.Connection, user: User, section: Optional[str] = None,
            event_id: Optional[int] = None) -> list[dict]:
    """Events with clashes_with (vs. the section's / faculty's slots) and the caller's RSVP state."""
    sec = section or user.section
    if sec:
        mine = fetch_slots(con, "s.section = ? AND s.status != 'cancelled'", (sec,))
    elif user.role == "faculty":
        mine = fetch_slots(con, "s.faculty_id = ? AND s.status != 'cancelled'", (user.user_id,))
    else:
        mine = []
    sql = """SELECT e.id, e.title, e.org, e.venue, e.day, e.start, e.end,
                    (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id) AS rsvp_count,
                    EXISTS (SELECT 1 FROM event_rsvps r WHERE r.event_id = e.id AND r.user_id = ?) AS rsvp
             FROM events e""" + (" WHERE e.id = ?" if event_id is not None else "") + " ORDER BY e.id"
    out = []
    for e in con.execute(sql, (user.user_id, event_id) if event_id is not None else (user.user_id,)):
        clashes = [s["id"] for s in mine
                   if s["day"] == e["day"] and s["start"] < e["end"] and e["start"] < s["end"]]
        out.append({**dict(e), "rsvp": bool(e["rsvp"]), "clashes_with": clashes})
    return out


@api.get("/events", response_model=list[Event], responses=AUTH_ERRORS, tags=["events"])
def events(section: Optional[str] = None, user: User = Depends(current_user),
           con: sqlite3.Connection = Depends(get_db)):
    return _events(con, user, section)


require_student = require_roles("student")
RSVP_ERRORS = {**HOD_ERRORS, 404: {"model": ErrorResponse}}


def _event_or_404(con: sqlite3.Connection, user: User, event_id: int) -> dict:
    ev = _events(con, user, event_id=event_id)
    if not ev:
        raise HTTPException(404, f"No event {event_id}")
    return ev[0]


@api.post("/events/{event_id}/rsvp", response_model=Event, responses=RSVP_ERRORS, tags=["events"])
def rsvp_event(event_id: int, user: User = Depends(require_student), con: sqlite3.Connection = Depends(get_db)):
    """Idempotent: RSVPing twice is fine."""
    _event_or_404(con, user, event_id)
    with con:
        con.execute("INSERT OR IGNORE INTO event_rsvps (event_id, user_id) VALUES (?, ?)", (event_id, user.user_id))
    return _event_or_404(con, user, event_id)


@api.delete("/events/{event_id}/rsvp", response_model=Event, responses=RSVP_ERRORS, tags=["events"])
def unrsvp_event(event_id: int, user: User = Depends(require_student), con: sqlite3.Connection = Depends(get_db)):
    """Idempotent: removing a missing RSVP is fine."""
    _event_or_404(con, user, event_id)
    with con:
        con.execute("DELETE FROM event_rsvps WHERE event_id = ? AND user_id = ?", (event_id, user.user_id))
    return _event_or_404(con, user, event_id)


# ---------- mutations ----------
STAFF_ERRORS = {**HOD_ERRORS, 422: {"model": ErrorResponse}}
STATE_ERRORS = {**HOD_ERRORS, 404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}}


@api.post("/incidents", status_code=202, response_model=IncidentAccepted, responses=STAFF_ERRORS,
          tags=["admin"])
def create_incident(body: IncidentRequest, bg: BackgroundTasks, user: User = Depends(require_staff),
                    con: sqlite3.Connection = Depends(get_db)):
    if body.type == "absence":
        if not body.faculty_id or con.execute("SELECT 1 FROM faculty WHERE id = ?", (body.faculty_id,)).fetchone() is None:
            raise HTTPException(422, "absence needs a valid faculty_id")
    elif not body.room_id or con.execute("SELECT 1 FROM rooms WHERE id = ?", (body.room_id,)).fetchone() is None:
        raise HTTPException(422, "room_unavailable needs a valid room_id")
    periods = sorted(set(body.periods))
    if not periods or any(p not in range(1, 7) for p in periods):
        raise HTTPException(422, "periods must be a non-empty list of 1..6")
    slots = agent.affected_slots(con, body.type, body.day, periods, body.faculty_id, body.room_id)
    if not slots:
        raise HTTPException(422, "No scheduled classes are affected by this incident")

    with con:
        inc = con.execute("INSERT INTO incidents (type, reported_by, faculty_id, room_id, day, periods, note) "
                          "VALUES (?,?,?,?,?,?,?)",
                          (body.type, user.user_id, body.faculty_id if body.type == "absence" else None,
                           body.room_id if body.type == "room_unavailable" else None,
                           body.day, json.dumps(periods), body.note)).lastrowid
    d = tools.log_decision(body.type, "TARS is working on it…", None, [s["id"] for s in slots],
                           status="proposed", incident_id=inc, con=con)
    bus.publish("decision_updated", d, user_ids=[user.user_id])
    bg.add_task(agent.run_incident, inc, d["id"])
    return {"incident_id": inc, "decision_id": d["id"], "status": "agent_running"}


def _decision_row(con: sqlite3.Connection, decision_id: int) -> sqlite3.Row:
    row = con.execute("SELECT d.*, i.reported_by FROM decisions d LEFT JOIN incidents i ON i.id = d.incident_id "
                      "WHERE d.id = ?", (decision_id,)).fetchone()
    if row is None:
        raise HTTPException(404, f"No decision {decision_id}")
    return row


def _invalid_state(row: sqlite3.Row, action: str):
    raise HTTPException(409, {"error": "invalid_state",
                              "detail": f"Decision {row['id']} is '{row['status']}' and cannot be {action}"})


@api.post("/decisions/{decision_id}/approve", response_model=Decision, responses=STATE_ERRORS, tags=["admin"])
def approve_decision(decision_id: int, _: User = Depends(require_hod), con: sqlite3.Connection = Depends(get_db)):
    """proposed (with pending changes) → apply them → committed; pending_ack / escalated → acknowledged."""
    row = _decision_row(con, decision_id)
    if row["status"] == "proposed" and row["changes"]:
        try:
            actions.apply_changes(con, json.loads(row["changes"]))
        except ClashError as e:
            raise HTTPException(409, {"error": "clash", "detail": str(e)})
        d = tools.update_decision(decision_id, con=con, status="committed", changes=None)
    elif row["status"] in ("pending_ack", "escalated"):
        d = tools.update_decision(decision_id, con=con, status="acknowledged")
        notify.notifier.cancel_escalation(decision_id)  # HOD confirmed; no Telegram timeout needed
    else:
        _invalid_state(row, "approved")
    bus.publish("decision_updated", d, user_ids=[row["reported_by"]])
    return d


@api.post("/decisions/{decision_id}/reject", response_model=Decision, responses=STATE_ERRORS, tags=["admin"])
def reject_decision(decision_id: int, _: User = Depends(require_hod), con: sqlite3.Connection = Depends(get_db)):
    """proposed (with pending changes) or escalated → rejected. Nothing is applied."""
    row = _decision_row(con, decision_id)
    if not ((row["status"] == "proposed" and row["changes"]) or row["status"] == "escalated"):
        _invalid_state(row, "rejected")
    d = tools.update_decision(decision_id, con=con, status="rejected", changes=None)
    bus.publish("decision_updated", d, user_ids=[row["reported_by"]])
    return d


NUDGE_ERRORS = {**AUTH_ERRORS, 404: {"model": ErrorResponse}}


def _update_own_nudge(con: sqlite3.Connection, user: User, nudge_id: int, set_sql: str, params: tuple) -> dict:
    """Owner-only update; anyone else (or unknown id) gets 404 so ids don't leak."""
    with con:
        n = con.execute(f"UPDATE nudges SET {set_sql} WHERE id = ? AND user_id = ?",
                        (*params, nudge_id, user.user_id)).rowcount
    if not n:
        raise HTTPException(404, f"No nudge {nudge_id} for you")
    return nudge_dict(con.execute(f"{NUDGE_SELECT} WHERE id = ?", (nudge_id,)).fetchone())


@api.post("/nudges/{nudge_id}/read", response_model=Nudge, responses=NUDGE_ERRORS, tags=["nudges"])
def read_nudge(nudge_id: int, user: User = Depends(current_user), con: sqlite3.Connection = Depends(get_db)):
    return _update_own_nudge(con, user, nudge_id, "read = 1", ())


@api.post("/nudges/{nudge_id}/snooze", response_model=Nudge, responses={**NUDGE_ERRORS, 422: {"model": ErrorResponse}},
          tags=["nudges"])
def snooze_nudge(nudge_id: int, body: SnoozeRequest, user: User = Depends(current_user),
                 con: sqlite3.Connection = Depends(get_db)):
    """Hide from GET /nudges for `minutes` (1..10080). Snoozing again replaces the previous time."""
    until = iso(now() + timedelta(minutes=body.minutes))
    return _update_own_nudge(con, user, nudge_id, "snoozed_until = ?", (until,))


@api.post("/nudges/{nudge_id}/block", response_model=Nudge, responses=NUDGE_ERRORS, tags=["nudges"])
def block_nudge(nudge_id: int, user: User = Depends(current_user), con: sqlite3.Connection = Depends(get_db)):
    """Hide permanently from GET /nudges (counts as acted on in /stats)."""
    return _update_own_nudge(con, user, nudge_id, "blocked = 1", ())


# ---------- faculty directory ----------
def _faculty(con: sqlite3.Connection, faculty_id: Optional[str] = None) -> list[dict]:
    loads = tools.faculty_loads(con)
    sql = "SELECT f.id, u.name, f.subjects, f.max_load FROM faculty f JOIN users u ON u.id = f.id"
    rows = con.execute(sql + (" WHERE f.id = ?" if faculty_id else "") + " ORDER BY f.id",
                       (faculty_id,) if faculty_id else ())
    return [{"faculty_id": r["id"], "name": r["name"], "max_load": r["max_load"], "load": loads.get(r["id"], 0),
             "subjects": [s.strip() for s in r["subjects"].split(",") if s.strip()]} for r in rows]


@api.get("/faculty", response_model=list[Faculty], responses=AUTH_ERRORS, tags=["faculty"])
def list_faculty(_: User = Depends(current_user), con: sqlite3.Connection = Depends(get_db)):
    return _faculty(con)


@api.patch("/faculty/{faculty_id}", response_model=Faculty,
           responses={**HOD_ERRORS, 404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}}, tags=["faculty"])
def rename_faculty(faculty_id: str, body: FacultyUpdate, _: User = Depends(require_hod),
                   con: sqlite3.Connection = Depends(get_db)):
    """Rename a faculty member. Every Slot's faculty_name follows (it is joined live), so the
    sections they teach get timetable_updated to refetch."""
    if not _faculty(con, faculty_id):
        raise HTTPException(404, f"No faculty with id {faculty_id}")
    with con:
        con.execute("UPDATE users SET name = ? WHERE id = ?", (body.name, faculty_id))
    by_section: dict[str, list[int]] = {}
    for s in fetch_slots(con, "s.faculty_id = ?", (faculty_id,)):
        by_section.setdefault(s["section"], []).append(s["id"])
    for section, ids in sorted(by_section.items()):
        bus.publish("timetable_updated", {"section": section, "slot_ids": ids},
                    sections=[section], user_ids=[faculty_id])
    return _faculty(con, faculty_id)[0]


# ---------- demo support (v0.4) ----------
def demo_mode() -> bool:
    return os.environ.get("TARS_DEMO_MODE", "").strip() == "1"


def require_demo_mode() -> None:
    """Checked before auth: with demo mode off the reset endpoint doesn't exist (404 for everyone)."""
    if not demo_mode():
        raise HTTPException(404, "Not Found")


@api.get("/meta", response_model=Meta, responses=AUTH_ERRORS, tags=["meta"])
def meta(_: User = Depends(current_user), con: sqlite3.Connection = Depends(get_db)):
    return {"demo_mode": demo_mode(), "days": DAYS,
            "periods": [dict(r) for r in con.execute("SELECT period, start, end FROM periods ORDER BY period")],
            "incident_types": ["absence", "room_unavailable"]}


@api.post("/admin/reset-demo", response_model=ResetResult,
          responses={**HOD_ERRORS, 404: {"model": ErrorResponse}}, tags=["admin"])
def reset_demo(_demo: None = Depends(require_demo_mode), _: User = Depends(require_hod),
               con: sqlite3.Connection = Depends(get_db)):
    """Restore the seeded timetable; clear incidents/decisions/nudges/RSVPs; cancel escalation timers.
    Telegram links (users.telegram_chat_id) are kept. Only touches the database, never .env."""
    from . import seed
    timers = notify.notifier.cancel_all_escalations()
    gcal.calendar.wait_idle(timeout=10)  # let in-flight event saves land, so none is orphaned in the calendar
    event_ids = [r[0] for r in con.execute("SELECT gcal_event_id FROM slots WHERE gcal_event_id IS NOT NULL")]
    slots = seed.reset_demo(con)
    gcal.calendar.delete_events(event_ids)  # only events TARS created; background, never blocks the reset
    logging.getLogger("tars").info("demo reset: %d slots restored, %d escalation timer(s) cancelled", slots, timers)
    bus.publish("demo_reset", {}, everyone=True)
    return {"status": "reset", "slots": slots}


# ---------- live updates ----------
@api.get("/stream", response_class=EventSourceResponse, tags=["stream"],
         responses={200: {"content": {"text/event-stream": {}},
                          "description": "SSE: timetable_updated, decision_updated, nudge_created, agent_step, demo_reset, ping"},
                     **AUTH_ERRORS})
async def stream(ticket: Optional[str] = None):
    """EventSource can't send headers: authenticate with a single-use ticket from POST /auth/stream-ticket."""
    if not ticket:
        raise unauthorized("Missing stream ticket")
    try:
        claims = auth.redeem_stream_ticket(ticket)
    except auth.AuthError as e:
        raise unauthorized(e.detail)
    with use_db() as con:
        if auth.is_revoked(con, claims.get("sid")):
            raise unauthorized("Session revoked")
        user = user_from_claims(con, claims)
    return EventSourceResponse(sse.event_stream(user, sid=claims.get("sid")), ping=sse.PING_SECONDS,
                               ping_message_factory=sse.ping_event)


app.include_router(api)


@app.get("/health", include_in_schema=False)
def health():
    return {"ok": True}
