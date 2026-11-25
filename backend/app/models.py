"""Pydantic models. Names and fields are the API contract (docs/API_CONTRACT.md v0.2.1); do not rename."""
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

Day = Literal["MON", "TUE", "WED", "THU", "FRI"]
Role = Literal["student", "faculty", "hod"]


class LoginRequest(BaseModel):
    login_id: str
    password: Optional[str] = None   # v0.5: required unless the backend runs with TARS_PASSWORDLESS_LOGIN=1


class User(BaseModel):
    user_id: str
    usn: Optional[str] = None
    name: str
    role: Role
    section: Optional[str] = None


class LoginResponse(BaseModel):
    """v0.5: send `Authorization: Bearer <token>` on every request."""
    token: str
    token_type: Literal["bearer"]
    expires_at: str                  # ISO 8601 UTC, e.g. "2026-11-25T22:42:00Z"
    user: "User"


class StreamTicket(BaseModel):
    """v0.5: single-use, 60 s. Open EventSource(`/api/stream?ticket=${ticket}`) right away."""
    ticket: str
    expires_at: str


class LogoutResponse(BaseModel):
    ok: bool = True


class Slot(BaseModel):
    id: int
    day: Day
    period: int
    start: str
    end: str
    section: str
    subject_code: str
    subject_name: str
    faculty_id: str
    faculty_name: str
    room_id: str
    status: Literal["scheduled", "replanned", "cancelled"]


class Decision(BaseModel):
    id: int
    created_at: str
    trigger: Literal["absence", "room_unavailable", "manual", "event_clash"]
    summary: str
    reasoning: Optional[str] = None
    affected_slot_ids: list[int]
    status: Literal["proposed", "committed", "pending_ack", "acknowledged", "escalated", "rejected"]
    calendar_link: Optional[str]     # v0.6: Google Calendar htmlLink once the slot is in the calendar, else null


class Nudge(BaseModel):
    id: int
    user_id: str
    kind: Literal["replan", "deadline", "free_slot", "event"]
    title: str
    body: Optional[str] = None
    created_at: str
    read: bool
    snoozed_until: Optional[str]          # v0.3: ISO local time, hidden from GET /nudges until then
    blocked: bool                         # v0.3: owner blocked it; hidden from GET /nudges


class SnoozeRequest(BaseModel):
    minutes: int = Field(ge=1, le=7 * 24 * 60)


class Event(BaseModel):
    id: int
    title: str
    org: Optional[str] = None
    venue: Optional[str] = None
    day: Day
    start: str
    end: str
    clashes_with: list[int]
    rsvp: bool                # v0.3: has the caller RSVPed
    rsvp_count: int           # v0.3: total RSVPs


class Room(BaseModel):
    id: str
    name: str
    kind: Literal["classroom", "lab", "hall"]
    capacity: int
    free: bool


class AttendanceItem(BaseModel):
    subject_code: str
    percent: float


class Today(BaseModel):
    day: Day
    slots: list[Slot]
    nudges: list[Nudge]


class Stats(BaseModel):
    classes_lost: int
    rescued: int
    nudges_acted: int
    avg_response_s: float


class Faculty(BaseModel):
    faculty_id: str
    name: str
    subjects: list[str]       # subject codes they can teach
    max_load: int
    load: int                 # current weekly non-cancelled slots


class FacultyUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name", mode="before")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v


class IncidentRequest(BaseModel):
    type: Literal["absence", "room_unavailable"]
    faculty_id: Optional[str] = None
    room_id: Optional[str] = None
    day: Day
    periods: list[int]
    note: Optional[str] = None


class IncidentAccepted(BaseModel):
    incident_id: int
    decision_id: int
    status: Literal["agent_running"]


class Period(BaseModel):
    period: int
    start: str
    end: str


class Meta(BaseModel):
    """v0.4: static options for forms + whether the demo reset button should show."""
    demo_mode: bool
    days: list[Day]
    periods: list[Period]
    incident_types: list[Literal["absence", "room_unavailable"]]


class ResetResult(BaseModel):
    status: Literal["reset"]
    slots: int


class ErrorResponse(BaseModel):
    error: str
    detail: str
