"""TARS backend: read-only API (contract v0.2.1). Agent, incidents, approvals and SSE come later."""
import json
import logging
import os
import re
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal, Optional

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
from .db import DAYS, NUDGE_SELECT, ensure_tables, fetch_slots, get_db, iso, now, nudge_dict, period_numbers, use_db
from .models import (AttendanceItem, CloseRequest, Day, Decision, ErrorResponse, Event, Faculty, FacultyUpdate,
                     ImportErrorResponse, ImportRequest, ImportResult, ImportSummary, ImportValidationError,
                     IncidentAccepted, IncidentRequest, LoginRequest, LoginResponse, LogoutResponse, Meta, NptelNudgeResult, NptelRequest, NptelSubmission,
                     Nudge, ResetResult, Room, Slot,
                     SnoozeRequest, Stats, StreamTicket,
                     Today, User)
from .validator import ClashError

load_dotenv(Path(__file__).resolve().parents[2] / ".env")  # repo-root .env; fine if missing

@asynccontextmanager
async def lifespan(_: FastAPI):
    """Start/stop the Telegram bot + escalation scheduler. Failures are logged, never fatal."""
    try:
        ensure_tables()
    except Exception:
        logging.getLogger("tars").exception("could not check the database tables")
    try:
        await notify.notifier.start()
    except Exception:
        logging.getLogger("tars").exception("notifier failed to start")
    yield
    try:
        await notify.notifier.stop()
    except Exception:
        logging.getLogger("tars").exception("notifier failed to stop")


app = FastAPI(title="TARS API", version="0.6.0", lifespan=lifespan)
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
def rooms(day: Day, period: int = Query(ge=1), _: User = Depends(current_user),
          con: sqlite3.Connection = Depends(get_db)):
    if period not in period_numbers(con):
        raise HTTPException(422, f"period must be 1..{max(period_numbers(con), default=0)}")
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


def _coverage_kpis(con: sqlite3.Connection) -> dict:
    """Decisions per KPI (definitions in docs/API_CONTRACT.md). HOD approval alone never counts as rescued."""
    kinds: dict[int, dict[int, str]] = {}
    for r in con.execute("SELECT decision_id, slot_id, kind FROM applied_changes"):
        kinds.setdefault(r["decision_id"], {})[r["slot_id"]] = r["kind"]
    accepted: dict[int, set[int]] = {}
    for r in con.execute("SELECT decision_id, slot_ids FROM ack_requests WHERE status = 'accepted'"):
        accepted.setdefault(r["decision_id"], set()).update(json.loads(r["slot_ids"]))
    out = dict.fromkeys(("rescued", "pending_confirmation", "cancelled", "escalated", "closed_unresolved"), 0)
    for d in con.execute("SELECT id, status FROM decisions"):
        mine = kinds.get(d["id"], {})
        subs = {s for s, k in mine.items() if k == "substituted"}
        has_cancel = "cancelled" in mine.values()
        out["cancelled"] += has_cancel
        if d["status"] in ("escalated", "closed_unresolved"):
            out[d["status"]] += 1
        elif d["status"] in ("committed", "pending_ack", "acknowledged") and subs:
            if not subs <= accepted.get(d["id"], set()):
                out["pending_confirmation"] += 1
            elif not has_cancel:
                out["rescued"] += 1
    return out


@api.get("/stats", response_model=Stats, responses=HOD_ERRORS, tags=["admin"])
def stats(_: User = Depends(require_hod), con: sqlite3.Connection = Depends(get_db)):
    one = lambda sql: con.execute(sql).fetchone()[0]
    return {
        "classes_lost": one("SELECT COUNT(*) FROM slots WHERE status = 'cancelled'"),
        **_coverage_kpis(con),
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
        if user.role == "faculty" and body.faculty_id != user.user_id:
            raise HTTPException(403, "Faculty can only report their own absence; ask the HOD")
        if not body.faculty_id or con.execute("SELECT 1 FROM faculty WHERE id = ?", (body.faculty_id,)).fetchone() is None:
            raise HTTPException(422, "absence needs a valid faculty_id")
    elif not body.room_id or con.execute("SELECT 1 FROM rooms WHERE id = ?", (body.room_id,)).fetchone() is None:
        raise HTTPException(422, "room_unavailable needs a valid room_id")
    periods = sorted(set(body.periods))
    allowed = period_numbers(con)
    if not periods or any(p not in allowed for p in periods):
        raise HTTPException(422, f"periods must be a non-empty list of 1..{max(allowed, default=0)}")
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
    """Decision with pending changes → apply them now (nothing was applied before) → committed, or pending_ack
    while Telegram asks the substitute (a PARTIAL one stays escalated). Approving never stands in for a
    substitute's answer: pending_ack is acknowledged here only if nobody is left to answer."""
    row = _decision_row(con, decision_id)
    if row["status"] in ("proposed", "escalated") and row["changes"]:
        try:
            d = agent.apply_approved(con, row)
        except ClashError as e:
            raise HTTPException(409, {"error": "clash", "detail": str(e)})
        except LookupError:
            _invalid_state(_decision_row(con, decision_id), "approved")
    elif row["status"] == "pending_ack":
        waiting = [r[0] for r in con.execute("SELECT faculty_id FROM ack_requests WHERE decision_id = ? AND "
                                             "status = 'pending' ORDER BY id", (decision_id,))]
        if waiting:
            raise HTTPException(409, {"error": "invalid_state", "detail":
                                      f"Decision {decision_id} is approved and waits for {', '.join(waiting)} to answer"})
        d = tools.update_decision(decision_id, con=con, status="acknowledged")
    else:
        _invalid_state(row, "approved")
    bus.publish("decision_updated", d, user_ids=[row["reported_by"]])
    return d


@api.post("/decisions/{decision_id}/reject", response_model=Decision, responses=STATE_ERRORS, tags=["admin"])
def reject_decision(decision_id: int, _: User = Depends(require_hod), con: sqlite3.Connection = Depends(get_db)):
    """Pending changes (proposed or PARTIAL escalated) → rejected. Nothing is applied."""
    row = _decision_row(con, decision_id)
    if row["status"] not in ("proposed", "escalated") or not row["changes"]:
        _invalid_state(row, "rejected")
    with con:  # only if nobody approved it meanwhile
        n = con.execute("UPDATE decisions SET status = 'rejected', changes = NULL WHERE id = ? AND status = ?",
                        (decision_id, row["status"])).rowcount
    if not n:
        _invalid_state(_decision_row(con, decision_id), "rejected")
    d = tools.get_decision(decision_id, con=con)
    bus.publish("decision_updated", d, user_ids=[row["reported_by"]])
    return d


@api.post("/decisions/{decision_id}/close", response_model=Decision,
          responses={**STATE_ERRORS, 422: {"model": ErrorResponse}}, tags=["admin"])
def close_decision(decision_id: int, body: CloseRequest, hod: User = Depends(require_hod),
                   con: sqlite3.Connection = Depends(get_db)):
    """escalated → closed_unresolved, with a reason. Not an approval: no slot changes, never counts as rescued."""
    row = _decision_row(con, decision_id)
    if row["status"] != "escalated":
        _invalid_state(row, "closed")
    note = f"\n\nClosed unresolved by {hod.user_id} at {iso(now())}. Reason: {body.reason}"
    with con:  # only if nothing is still open: no pending proposal, no substitute left to answer
        n = con.execute("UPDATE decisions SET status = 'closed_unresolved', reasoning = COALESCE(reasoning, '') || ? "
                        "WHERE id = ? AND status = 'escalated' AND changes IS NULL AND NOT EXISTS "
                        "(SELECT 1 FROM ack_requests WHERE decision_id = ? AND status = 'pending')",
                        (note, decision_id, decision_id)).rowcount
    if not n:
        raise HTTPException(409, {"error": "invalid_state", "detail":
                                  f"Decision {decision_id} still has a proposal to decide or substitutes to answer"})
    d = tools.get_decision(decision_id, con=con)
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


# ---------- timetable import (HOD only) ----------
DAY_ALIASES = {
    "MON": "MON", "MONDAY": "MON",
    "TUE": "TUE", "TUESDAY": "TUE",
    "WED": "WED", "WEDNESDAY": "WED",
    "THU": "THU", "THURSDAY": "THU",
    "FRI": "FRI", "FRIDAY": "FRI",
}


def _clean_str(val: Optional[str]) -> str:
    return (val or "").strip()


def _normalize_name(name: str) -> str:
    """Normalize names for matching: strip common titles (Dr., Prof., etc.) and punctuation."""
    s = name.strip().lower()
    s = re.sub(r"^(dr\.?|prof\.?|mr\.?|ms\.?|mrs\.?)\s+", "", s)
    return re.sub(r"[^a-z0-9]", "", s)


def _open_decisions(con: sqlite3.Connection, sections: list[str]) -> list[int]:
    """Unresolved decisions that affect slots of these sections; they block an import of them."""
    ph = ",".join("?" for _ in sections)
    slot_ids = {r[0] for r in con.execute(f"SELECT id FROM slots WHERE section IN ({ph})", sections)}
    return [d["id"] for d in con.execute("SELECT id, affected_slot_ids FROM decisions "
                                         "WHERE status IN ('proposed', 'pending_ack') ORDER BY id")
            if slot_ids & set(json.loads(d["affected_slot_ids"] or "[]"))]


@api.get("/admin/timetable-template", response_class=Response,
         responses={200: {"content": {"text/csv": {"schema": {"type": "string"}}}, "description": "CSV template"},
                    **HOD_ERRORS}, tags=["admin"])
def get_timetable_template(_: User = Depends(require_hod)):
    """Download a CSV template for importing college timetables."""
    csv_content = (
        "section,day,period,subject,faculty,room\n"
        "CSE-A,MON,1,DS,F01,R101\n"
        "CSE-A,MON,2,MATH,F03,R101\n"
        "CSE-A,MON,3,DLD,F05,R101\n"
        "CSE-A,MON,4,OOP,F02,R101\n"
        "CSE-A,MON,5,COA,F06,R101\n"
        "CSE-A,MON,6,DSL,F01,LAB1\n"
    )
    headers = {"Content-Disposition": 'attachment; filename="tars_timetable_template.csv"'}
    return Response(content=csv_content, media_type="text/csv", headers=headers)


@api.post("/admin/import-timetable", response_model=ImportResult,
          responses={**HOD_ERRORS, 409: {"model": ErrorResponse}, 422: {"model": ImportErrorResponse}}, tags=["admin"])
def import_timetable(body: ImportRequest, dry_run: bool = Query(True),
                     _: User = Depends(require_hod),
                     con: sqlite3.Connection = Depends(get_db)):
    """Import and normalize a timetable from parsed CSV/Excel rows. HOD only.

    Validates section, day, period, subject, faculty, room against DB records,
    checks that faculty are qualified to teach subjects, detects duplicate slots
    and clashes within the file and against non-replaced sections.
    If dry_run=true: returns validation results and preview without saving.
    If dry_run=false: atomically replaces slots for the replaced sections and emits SSE updates.
    """
    errors: list[ImportValidationError] = []

    # 1. Load reference lookups from DB
    # Sections
    db_sections = {r[0] for r in con.execute("SELECT DISTINCT section FROM users WHERE section IS NOT NULL")}
    db_sections |= {r[0] for r in con.execute("SELECT DISTINCT section FROM slots")}
    section_map = {s.upper(): s for s in db_sections}
    # Also support stripped dashes e.g. "CSEA" -> "CSE-A", "CSE A" -> "CSE-A"
    for s in db_sections:
        section_map[s.replace("-", "").replace(" ", "").upper()] = s
        section_map[s.replace("-", " ").upper()] = s

    # Subjects
    subjects_rows = con.execute("SELECT code, name FROM subjects").fetchall()
    subj_code_map = {}
    subj_names = {}
    for r in subjects_rows:
        code, name = r["code"], r["name"]
        subj_names[code] = name
        subj_code_map[code.upper()] = code
        subj_code_map[name.strip().lower()] = code
        subj_code_map[_normalize_name(name)] = code

    # Faculty
    faculty_rows = con.execute(
        "SELECT f.id, u.name, f.subjects FROM faculty f JOIN users u ON u.id = f.id"
    ).fetchall()
    faculty_id_map = {}
    faculty_names = {}
    faculty_subjects = {}
    for r in faculty_rows:
        fid, name, subs = r["id"], r["name"], r["subjects"]
        faculty_names[fid] = name
        faculty_id_map[fid.upper()] = fid
        faculty_id_map[name.strip().lower()] = fid
        faculty_id_map[_normalize_name(name)] = fid
        faculty_subjects[fid] = {s.strip().upper() for s in subs.split(",") if s.strip()}

    # Rooms
    room_rows = con.execute("SELECT id, name FROM rooms").fetchall()
    room_id_map = {}
    room_names = {}
    for r in room_rows:
        rid, name = r["id"], r["name"]
        room_names[rid] = name
        room_id_map[rid.upper()] = rid
        room_id_map[name.strip().lower()] = rid
        room_id_map[_normalize_name(name)] = rid

    # Periods
    period_rows = con.execute("SELECT period, start, end FROM periods ORDER BY period").fetchall()
    period_map = {r["period"]: (r["start"], r["end"]) for r in period_rows}

    # 2. Determine and validate replace_sections
    raw_replace_sections = body.replace_sections
    target_replace_sections: set[str] = set()

    if raw_replace_sections is not None:
        if len(raw_replace_sections) == 0:
            errors.append(ImportValidationError(
                field="replace_sections", type="missing",
                message="replace_sections cannot be empty when provided"
            ))
        for sec in raw_replace_sections:
            norm_sec = section_map.get(sec.strip().upper())
            if not norm_sec:
                errors.append(ImportValidationError(
                    field="replace_sections", value=sec, type="unknown",
                    message=f"Unknown section '{sec}' in replace_sections"
                ))
            else:
                target_replace_sections.add(norm_sec)

    # 3. Per-row validation and normalization
    normalized_rows: list[dict] = []
    seen_section_slots: dict[tuple, int] = {}
    seen_faculty_slots: dict[tuple, int] = {}
    seen_room_slots: dict[tuple, int] = {}

    for i, row in enumerate(body.rows, 1):
        row_has_error = False

        # --- Section ---
        raw_sec = _clean_str(row.section)
        if not raw_sec:
            errors.append(ImportValidationError(row=i, field="section", type="missing", message="Missing section"))
            norm_sec = None
            row_has_error = True
        else:
            norm_sec = section_map.get(raw_sec.upper()) or section_map.get(raw_sec.replace("-", "").replace(" ", "").upper())
            if not norm_sec:
                errors.append(ImportValidationError(row=i, field="section", value=raw_sec, type="unknown",
                                                    message=f"Unknown section '{raw_sec}'"))
                row_has_error = True

        # --- Day ---
        raw_day = _clean_str(row.day)
        if not raw_day:
            errors.append(ImportValidationError(row=i, field="day", type="missing", message="Missing day"))
            norm_day = None
            row_has_error = True
        else:
            norm_day = DAY_ALIASES.get(raw_day.upper())
            if not norm_day:
                errors.append(ImportValidationError(row=i, field="day", value=raw_day, type="invalid",
                                                    message=f"Invalid day '{raw_day}' (must be MON..FRI)"))
                row_has_error = True

        # --- Period ---
        raw_period = row.period
        if raw_period is None:
            errors.append(ImportValidationError(row=i, field="period", type="missing", message="Missing period"))
            norm_period = None
            row_has_error = True
        elif raw_period not in period_map:
            errors.append(ImportValidationError(row=i, field="period", value=str(raw_period), type="invalid",
                                                message=f"Invalid period {raw_period} (must be one of {sorted(period_map)})"))
            norm_period = None
            row_has_error = True
        else:
            norm_period = raw_period

        # --- Subject ---
        raw_subj = _clean_str(row.subject_code or row.subject)
        if not raw_subj:
            errors.append(ImportValidationError(row=i, field="subject", type="missing", message="Missing subject"))
            norm_subj = None
            row_has_error = True
        else:
            norm_subj = (subj_code_map.get(raw_subj.upper()) or
                         subj_code_map.get(raw_subj.lower()) or
                         subj_code_map.get(_normalize_name(raw_subj)))
            if not norm_subj:
                errors.append(ImportValidationError(row=i, field="subject", value=raw_subj, type="unknown",
                                                    message=f"Unknown subject '{raw_subj}'"))
                row_has_error = True

        # --- Faculty ---
        raw_fac = _clean_str(row.faculty_id or row.faculty)
        if not raw_fac:
            errors.append(ImportValidationError(row=i, field="faculty", type="missing", message="Missing faculty"))
            norm_fac = None
            row_has_error = True
        else:
            norm_fac = (faculty_id_map.get(raw_fac.upper()) or
                        faculty_id_map.get(raw_fac.lower()) or
                        faculty_id_map.get(_normalize_name(raw_fac)))
            if not norm_fac:
                errors.append(ImportValidationError(row=i, field="faculty", value=raw_fac, type="unknown",
                                                    message=f"Unknown faculty '{raw_fac}'"))
                row_has_error = True

        # --- Room ---
        raw_room = _clean_str(row.room_id or row.room)
        if not raw_room:
            errors.append(ImportValidationError(row=i, field="room", type="missing", message="Missing room"))
            norm_room = None
            row_has_error = True
        else:
            norm_room = (room_id_map.get(raw_room.upper()) or
                         room_id_map.get(raw_room.lower()) or
                         room_id_map.get(_normalize_name(raw_room)))
            if not norm_room:
                errors.append(ImportValidationError(row=i, field="room", value=raw_room, type="unknown",
                                                    message=f"Unknown room '{raw_room}'"))
                row_has_error = True

        # Capability check: can this faculty teach this subject?
        if norm_fac and norm_subj:
            allowed_subs = faculty_subjects.get(norm_fac, set())
            if norm_subj not in allowed_subs:
                fac_name = faculty_names.get(norm_fac, norm_fac)
                subj_name = subj_names.get(norm_subj, norm_subj)
                errors.append(ImportValidationError(
                    row=i, field="faculty", value=raw_fac, type="mismatch",
                    message=f"Faculty '{fac_name}' ({norm_fac}) is not qualified to teach '{subj_name}' ({norm_subj})"
                ))
                row_has_error = True

        if not row_has_error and norm_sec and norm_day and norm_period and norm_subj and norm_fac and norm_room:
            # Internal Duplicate/Clash Checks within the import
            sec_slot_key = (norm_sec, norm_day, norm_period)
            if sec_slot_key in seen_section_slots:
                prev_row = seen_section_slots[sec_slot_key]
                errors.append(ImportValidationError(
                    row=i, type="duplicate",
                    message=f"Duplicate slot: section {norm_sec} {norm_day} P{norm_period} already assigned in row {prev_row}"
                ))
            else:
                seen_section_slots[sec_slot_key] = i

            fac_slot_key = (norm_fac, norm_day, norm_period)
            if fac_slot_key in seen_faculty_slots:
                prev_row = seen_faculty_slots[fac_slot_key]
                fac_name = faculty_names.get(norm_fac, norm_fac)
                errors.append(ImportValidationError(
                    row=i, type="clash", field="faculty", value=norm_fac,
                    message=f"Faculty clash: {fac_name} ({norm_fac}) double-booked on {norm_day} P{norm_period} (also in row {prev_row})"
                ))
            else:
                seen_faculty_slots[fac_slot_key] = i

            room_slot_key = (norm_room, norm_day, norm_period)
            if room_slot_key in seen_room_slots:
                prev_row = seen_room_slots[room_slot_key]
                rm_name = room_names.get(norm_room, norm_room)
                errors.append(ImportValidationError(
                    row=i, type="clash", field="room", value=norm_room,
                    message=f"Room clash: {rm_name} ({norm_room}) double-booked on {norm_day} P{norm_period} (also in row {prev_row})"
                ))
            else:
                seen_room_slots[room_slot_key] = i

            normalized_rows.append({
                "row_index": i,
                "section": norm_sec,
                "day": norm_day,
                "period": norm_period,
                "subject_code": norm_subj,
                "subject_name": subj_names.get(norm_subj, norm_subj),
                "faculty_id": norm_fac,
                "faculty_name": faculty_names.get(norm_fac, norm_fac),
                "room_id": norm_room,
                "start": period_map[norm_period][0],
                "end": period_map[norm_period][1],
            })

    # Auto-infer replace_sections if not explicitly provided
    detected_sections = sorted({r["section"] for r in normalized_rows})
    if raw_replace_sections is None:
        target_replace_sections = set(detected_sections)
    else:
        # If replace_sections was provided, ensure all rows belong to replace_sections
        for r in normalized_rows:
            if r["section"] not in target_replace_sections:
                errors.append(ImportValidationError(
                    row=r["row_index"], field="section", value=r["section"], type="mismatch",
                    message=f"Section '{r['section']}' is not included in replace_sections {sorted(target_replace_sections)}"
                ))
        # Never wipe a section the file has no rows for (rows with errors are reported on their own).
        named = {section_map.get(_clean_str(r.section).upper())
                 or section_map.get(_clean_str(r.section).replace("-", "").replace(" ", "").upper())
                 for r in body.rows}
        for sec in sorted(target_replace_sections - named):
            errors.append(ImportValidationError(
                field="replace_sections", value=sec, type="missing",
                message=f"Section '{sec}' is in replace_sections but has no rows; its timetable would be emptied"
            ))

    # 4. Cross-section clashes (against sections NOT being replaced)
    if target_replace_sections:
        ph = ",".join("?" for _ in target_replace_sections)
        external_slots = con.execute(
            f"SELECT s.id, s.day, s.period, s.section, s.faculty_id, u.name as faculty_name, "
            f"s.room_id, r.name as room_name "
            f"FROM slots s "
            f"JOIN users u ON u.id = s.faculty_id "
            f"JOIN rooms r ON r.id = s.room_id "
            f"WHERE s.status != 'cancelled' AND s.section NOT IN ({ph})",
            tuple(target_replace_sections)
        ).fetchall()

        # Build lookup tables for non-replaced active slots
        ext_faculty_slots: dict[tuple, sqlite3.Row] = {}
        ext_room_slots: dict[tuple, sqlite3.Row] = {}
        for es in external_slots:
            ext_faculty_slots[(es["faculty_id"], es["day"], es["period"])] = es
            ext_room_slots[(es["room_id"], es["day"], es["period"])] = es

        for r in normalized_rows:
            fac_key = (r["faculty_id"], r["day"], r["period"])
            if fac_key in ext_faculty_slots:
                es = ext_faculty_slots[fac_key]
                errors.append(ImportValidationError(
                    row=r["row_index"], field="faculty", value=r["faculty_id"], type="clash",
                    message=f"Faculty clash: {r['faculty_name']} ({r['faculty_id']}) already teaching "
                            f"section {es['section']} on {r['day']} P{r['period']}"
                ))

            rm_key = (r["room_id"], r["day"], r["period"])
            if rm_key in ext_room_slots:
                es = ext_room_slots[rm_key]
                errors.append(ImportValidationError(
                    row=r["row_index"], field="room", value=r["room_id"], type="clash",
                    message=f"Room clash: {r['room_id']} already occupied by "
                            f"section {es['section']} on {r['day']} P{r['period']}"
                ))

    # 5. Dry run reports what would block the real import (which re-checks inside its transaction → 409)
    if dry_run:
        for did in _open_decisions(con, sorted(target_replace_sections)):
            errors.append(ImportValidationError(
                field="decision", value=str(did), type="blocked",
                message=f"Decision #{did} is unresolved and affects a section being replaced; resolve it before importing"
            ))

    summary = ImportSummary(
        total_rows=len(body.rows),
        sections=sorted(target_replace_sections) if target_replace_sections else detected_sections,
        errors=len(errors)
    )
    valid = len(errors) == 0

    # Build preview if valid
    preview: list[Slot] = []
    if valid:
        day_order = {d: i for i, d in enumerate(DAYS)}
        sorted_rows = sorted(normalized_rows, key=lambda x: (day_order.get(x["day"], 99), x["period"], x["section"]))
        for idx, r in enumerate(sorted_rows, 1):
            preview.append(Slot(
                id=idx,
                day=r["day"],
                period=r["period"],
                start=r["start"],
                end=r["end"],
                section=r["section"],
                subject_code=r["subject_code"],
                subject_name=r["subject_name"],
                faculty_id=r["faculty_id"],
                faculty_name=r["faculty_name"],
                room_id=r["room_id"],
                status="scheduled"
            ))

    if dry_run or not valid:
        if not valid and not dry_run:
            raise HTTPException(422, {
                "error": "validation",
                "detail": f"Import validation failed with {len(errors)} error(s)",
                "errors": [e.model_dump() for e in errors],
                "summary": summary.model_dump()
            })
        return ImportResult(
            valid=valid,
            errors=errors,
            summary=summary,
            preview=preview if valid else None
        )

    # 6. Atomic replace (dry_run=false and valid). Unique indexes catch a timetable that changed since validation.
    target_sections_list = sorted(target_replace_sections)
    ph = ",".join("?" for _ in target_sections_list)
    gcal.calendar.wait_idle(timeout=10)  # let in-flight event saves land, so none is orphaned in the calendar
    try:
        with con:  # any exception below rolls everything back
            con.execute("BEGIN IMMEDIATE")  # no decision or slot can change between this check and the replace
            open_ids = _open_decisions(con, target_sections_list)
            if open_ids:
                raise HTTPException(409, {"error": "invalid_state", "detail":
                                          f"Resolve open decision(s) {', '.join(map(str, open_ids))} for these sections "
                                          "before importing; nothing was saved."})
            old_slots = con.execute(f"DELETE FROM slots WHERE section IN ({ph}) "
                                    "RETURNING section, faculty_id, gcal_event_id", target_sections_list).fetchall()
            con.executemany(
                "INSERT INTO slots (day, period, section, subject_code, faculty_id, room_id, status) "
                "VALUES (?, ?, ?, ?, ?, ?, 'scheduled')",
                [(r["day"], r["period"], r["section"], r["subject_code"], r["faculty_id"], r["room_id"])
                 for r in normalized_rows]
            )
    except sqlite3.IntegrityError:
        raise HTTPException(409, {"error": "clash", "detail": "The timetable changed while importing; nothing was saved. "
                                                               "Run the check again."})
    event_ids = [r["gcal_event_id"] for r in old_slots if r["gcal_event_id"]]
    if event_ids:
        # only events TARS created for replaced slots; background, never blocks or fails the import
        if gcal.calendar.delete_events(event_ids) is None:
            logging.getLogger("tars").error("import: calendar is off; event(s) of replaced slots not deleted: %s", event_ids)

    # 7. SSE: the section, HOD, and every faculty member who gained or lost a class
    for sec in target_sections_list:
        new = con.execute("SELECT id, faculty_id FROM slots WHERE section = ? ORDER BY id", (sec,)).fetchall()
        fac_ids = {r["faculty_id"] for r in new} | {r["faculty_id"] for r in old_slots if r["section"] == sec}
        bus.publish("timetable_updated", {"section": sec, "slot_ids": [r["id"] for r in new]},
                    sections=[sec], user_ids=fac_ids, hod=True)

    return ImportResult(
        valid=True,
        errors=[],
        summary=summary,
        imported=len(normalized_rows),
        preview=preview
    )


# ---------- NPTEL certificate requests: read + remind. No upload, no certificate checking. ----------
NPTEL_ERRORS = {**AUTH_ERRORS, 404: {"model": ErrorResponse}}


def _nptel_requests(con: sqlite3.Connection, user: User, request_id: Optional[int] = None) -> list[dict]:
    """Staff see all requests; students only those for their section. Counts come from the rows."""
    rows = con.execute(
        "SELECT r.*, u.name AS faculty_name, COUNT(s.id) AS total_students, "
        "COALESCE(SUM(s.status != 'pending'), 0) AS submitted_count, "
        "COALESCE(SUM(s.status = 'verified'), 0) AS verified_count, "
        "COALESCE(SUM(s.status = 'flagged'), 0) AS flagged_count "
        "FROM nptel_requests r JOIN users u ON u.id = r.faculty_id LEFT JOIN nptel_submissions s ON s.request_id = r.id "
        "WHERE ? IS NULL OR r.id = ? GROUP BY r.id ORDER BY r.due_date, r.id", (request_id, request_id)).fetchall()
    out = [{**dict(r), "sections": json.loads(r["sections"])} for r in rows]
    return [r for r in out if user.role != "student" or user.section in r["sections"]]


def _nptel_or_404(con: sqlite3.Connection, user: User, request_id: int) -> dict:
    found = _nptel_requests(con, user, request_id)
    if not found:
        raise HTTPException(404, f"No NPTEL request {request_id}")
    return found[0]


@api.get("/nptel/requests", response_model=list[NptelRequest], responses=AUTH_ERRORS, tags=["nptel"])
def nptel_requests(user: User = Depends(current_user), con: sqlite3.Connection = Depends(get_db)):
    return _nptel_requests(con, user)


@api.get("/nptel/requests/{request_id}/submissions", response_model=list[NptelSubmission], responses=NPTEL_ERRORS,
         tags=["nptel"])
def nptel_submissions(request_id: int, status: Optional[Literal["pending", "verified", "flagged"]] = None,
                      user: User = Depends(current_user), con: sqlite3.Connection = Depends(get_db)):
    """Staff: every row. Students: only their own."""
    _nptel_or_404(con, user, request_id)
    rows = con.execute("SELECT * FROM nptel_submissions WHERE request_id = ? AND (? IS NULL OR status = ?) "
                       "AND (? IS NULL OR user_id = ?) ORDER BY id",
                       (request_id, status, status, *[user.user_id if user.role == "student" else None] * 2))
    return [{**dict(r), "flags": json.loads(r["flags"])} for r in rows]


@api.post("/nptel/requests/{request_id}/nudge", response_model=NptelNudgeResult,
          responses={**NPTEL_ERRORS, 403: {"model": ErrorResponse}}, tags=["nptel"])
def nptel_nudge(request_id: int, user: User = Depends(require_staff), con: sqlite3.Connection = Depends(get_db)):
    """In-app reminder to pending students who have an account. The requesting faculty or the HOD only."""
    req = _nptel_or_404(con, user, request_id)
    if user.role == "faculty" and req["faculty_id"] != user.user_id:
        raise HTTPException(403, "Only the faculty who made the request, or the HOD, can send reminders")
    title = f"NPTEL reminder #{request_id}: {req['item']}"[:200]
    pending = con.execute(
        "SELECT s.user_id FROM nptel_submissions s JOIN users u ON u.id = s.user_id AND u.role = 'student' "
        "WHERE s.request_id = ? AND s.status = 'pending' AND NOT EXISTS (SELECT 1 FROM nudges n WHERE n.user_id = s.user_id "
        "AND n.title = ? AND n.read = 0 AND n.blocked = 0)", (request_id, title)).fetchall()
    for (uid,) in pending:
        actions.create_nudge(con, uid, "deadline", title, f"{req['title']}. Due {req['due_date']}.")
    return {"nudged_count": len(pending)}


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
