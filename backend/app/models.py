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
    status: Literal["proposed", "committed", "pending_ack", "acknowledged", "escalated", "rejected",
                    "closed_unresolved"]
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
    """Decision counts; see docs/API_CONTRACT.md for the definitions."""
    classes_lost: int             # cancelled classes (slots)
    rescued: int                  # substitutes committed and every one accepted; no cancelled class
    pending_confirmation: int     # committed, but not every substitute has accepted
    cancelled: int                # decisions with an approved cancellation
    escalated: int                # unresolved coverage needing intervention (includes PARTIAL)
    closed_unresolved: int        # closed by the HOD without coverage
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


class CloseRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)

    @field_validator("reason", mode="before")
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


class NptelRequest(BaseModel):
    """Seeded requests are simulated (the title says so)."""
    id: int
    faculty_id: str
    faculty_name: str
    title: str
    item: str
    sections: list[str]
    due_date: str            # YYYY-MM-DD
    total_students: int
    submitted_count: int     # verified + flagged
    verified_count: int
    flagged_count: int
    created_at: str


class NptelSubmission(BaseModel):
    id: int
    request_id: int
    student_name: str
    usn: str
    section: str
    course_name: str
    score: int
    certificate_id: str
    status: Literal["pending", "verified", "flagged"]
    uploaded_at: str
    flags: list[str] = []


class NptelNudgeResult(BaseModel):
    nudged_count: int        # nudges really created now; students without an account or already reminded aren't counted


class ImportRow(BaseModel):
    section: str
    day: str
    period: int
    subject: Optional[str] = None
    subject_code: Optional[str] = None
    faculty: Optional[str] = None
    faculty_id: Optional[str] = None
    room: Optional[str] = None
    room_id: Optional[str] = None


class ImportRequest(BaseModel):
    rows: list[ImportRow] = Field(min_length=1)
    replace_sections: Optional[list[str]] = None


class ImportValidationError(BaseModel):
    row: Optional[int] = None
    field: Optional[str] = None
    value: Optional[str] = None
    type: str
    message: str


class ImportSummary(BaseModel):
    total_rows: int
    sections: list[str]
    errors: int


class ImportResult(BaseModel):
    valid: bool
    errors: list[ImportValidationError] = []
    summary: ImportSummary
    imported: Optional[int] = None
    preview: Optional[list[Slot]] = None


class ImportErrorResponse(ErrorResponse):
    """422 from the import. errors/summary are set only when the rows themselves failed validation."""
    errors: Optional[list[ImportValidationError]] = None
    summary: Optional[ImportSummary] = None
