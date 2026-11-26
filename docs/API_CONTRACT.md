# TARS — API Contract (v0.6)

Shared source of truth for frontend and backend in `tars1`. It describes the `backend` branch.
Mock responses: `frontend/src/mock/*.json` (`python3 app/seed.py` also writes `docs/mock/`, which git ignores).
Machine-readable schema: `docs/openapi.json`, generated from the app; if the two disagree, `openapi.json` wins.

> **BEHAVIOUR CHANGE, HOD approval first:** an incident only creates a proposal. The timetable, nudges, Telegram and Calendar
> are untouched until the HOD approves; rejecting changes nothing. Without Gemini a rule-based fallback proposes instead.
> Faculty may report only their own absence. A Telegram decline or missed deadline withdraws that cover. New: `POST /decisions/{id}/close`,
> status `closed_unresolved`, and four `/stats` fields. `rescued` is stricter. Nothing was removed or renamed.
>
> **Demo data:** `TARS_SEED=bmsit` seeds BMSIT CSE-10: real timetable structure, **simulated** leave and eligibility, placeholder
> names, no attendance. `seed_bmsit.json` states the source of every item and its limits. Sections named `BUSY-…` only mark a
> teacher as busy; don't show them as timetables.
> With `TARS_SEED=bmsit` (set it both when seeding and when running the server):
> - periods are 1–7; the default data has 1–6. Switching datasets needs a re-seed; a demo reset alone isn't enough.
> - **Labs are immutable in time:** lab classes are never proposed for a move, by Gemini or fallback, so the two halves of a lab
>   can't be split. Substitution, a room change or a cancellation can still be proposed for one half; the HOD decides.
> - Orientation (WED P5) and Proctoring (FRI P6) are stored as classes, so nothing is moved there.
> - `subject_code` starting with `UNCONFIRMED-` (THU P5) marks an entry the sources disagree about. It is **not a confirmed class
>   and not free time**: show `subject_name` as it is. Its time, teacher and room are busy; it is never moved or substituted.
> - Teachers named "Teacher not confirmed (…)" are placeholders. Eligibility of F_SMP for 1BAI103 (MON P5, TUE P2, THU P4) is a
>   demo assumption; F_GPL as the only lab cover is a demo choice. Co-faculty aren't modelled and look free.
> - With no attendance, a cancellation may be proposed before a substitute was tried. Only the HOD can apply it.
> - Rejected proposals aren't remembered, so reporting again can propose the same thing.
>
> **tars1 timetable import:** `replace_sections` may not name a section with no rows · the 422 body lists `errors` and
> `summary` · 409 `clash` if the timetable changed mid-import · 409 `invalid_state` while a decision is open for the section · faculty who lose classes also get `timetable_updated` ·
> calendar events TARS created for replaced slots are deleted.

> **v0.6 (additive):** `Decision.calendar_link` (Google Calendar link once the slot is in the calendar) ·
> calendar progress arrives as `agent_step` lines with `phase: "dispatch"` · `POST /auth/logout` now really revokes
> the token (then 401 `"Session revoked"`; its stream tickets and open streams end too) ·
> `POST /admin/import-timetable` (`?dry_run=true|false`) · `GET /admin/timetable-template` · HOD entity normalization (matches IDs & natural names) & clash verification · atomic replacement on commit with SSE `timetable_updated`.
>
> **v0.5 (BREAKING: auth):** login needs a password and returns `{token, token_type, expires_at, user}` ·
> every request sends `Authorization: Bearer <token>` (`X-User-Id` is ignored) · SSE uses
> `POST /auth/stream-ticket` + `/stream?ticket=…` (`?user_id=` removed) · new error code `invalid_credentials`.
>
> **v0.4 (additive):** `GET /meta` · `POST /admin/reset-demo` (demo mode only) · SSE `demo_reset` ·
> 422 `detail` is user-safe text.
>
> **v0.3 (additive, nothing removed or renamed):** `agent_step.phase` · Nudge `snoozed_until` + `blocked`,
> `POST /nudges/{id}/snooze`, `POST /nudges/{id}/block`, `GET /nudges` hides blocked/snoozed ·
> Event `rsvp` + `rsvp_count`, `POST|DELETE /events/{id}/rsvp` · `/stats.nudges_acted` also counts blocked.
Base URL: `http://localhost:8000/api`  ·  All bodies JSON  ·  Times are `HH:MM`, days are `MON..FRI`.
**Auth (v0.5):** `POST /auth/login` with `{login_id, password}` → `{token, …}`. Send `Authorization: Bearer <token>` on
**every** other request. Identity and role (`student` | `faculty` | `hod`) come only from the signed token; `X-User-Id`
is ignored. Tokens expire (default 12 h, `expires_at`); on any `401` drop the token and show the login screen.
**Exception:** `EventSource` can't send headers, so get a single-use 60 s ticket from `POST /auth/stream-ticket` and open
`/stream?ticket=<ticket>` (see the stream section). Public endpoints: `POST /auth/login`, `GET /auth/demo-users`.

---

## Core objects

```jsonc
// Slot  (one cell of the timetable)
{
  "id": 12,
  "day": "MON",
  "period": 3,                 // 1..6 by default, 1..7 with TARS_SEED=bmsit; see GET /meta
  "start": "11:15", "end": "12:10",
  "section": "CSE-A",
  "subject_code": "DS",
  "subject_name": "Data Structures",
  "faculty_id": "F01", "faculty_name": "<faculty name>",   // live from users.name; can change (PATCH /faculty)
  "room_id": "R102",
  "status": "scheduled"        // scheduled | replanned | cancelled
}

// Decision  (one entry in the audit log)
{
  "id": 7,
  "created_at": "2026-11-25T10:42:00",
  "trigger": "absence",        // absence | room_unavailable | manual | event_clash
  "summary": "[Gemini] CSE-A DS (MON P2) reassigned to <faculty name> (lowest load, free) in R101",  // free text, frozen at write time
  "reasoning": "CSE-A attendance in DS is 71% (<75%), so cancel was rejected...",
  "affected_slot_ids": [12],
  "status": "pending_ack",     // proposed | committed | pending_ack | acknowledged | escalated | rejected | closed_unresolved
  "calendar_link": null        // v0.6: "https://www.google.com/calendar/event?eid=…" once saved, else null
}

// Nudge  (card on Today / Nudges screen)
{ "id": 3, "user_id": "S001", "kind": "replan|deadline|free_slot|event",
  "title": "TARS re-planned your day", "body": "...", "created_at": "...", "read": false,
  "snoozed_until": null,       // v0.3: ISO local time ("2026-11-25T11:15:00") while snoozed, else null
  "blocked": false }           // v0.3: true once the owner blocked it

// Event  (events hub)
{ "id": 2, "title": "CyberSec Workshop", "org": "CyberSec Student Chapter",
  "venue": "Main Auditorium", "day": "WED", "start": "14:00", "end": "16:00",
  "clashes_with": [ /* Slot ids for the caller's section */ ],
  "rsvp": false,               // v0.3: has the caller RSVPed (always false for faculty/HOD)
  "rsvp_count": 0 }            // v0.3: total RSVPs

// Faculty  (v0.2.2: faculty directory / HOD rename)
{ "faculty_id": "F08", "name": "<faculty name>",
  "subjects": ["DS", "MATH"],  // subject codes they can teach
  "max_load": 18, "load": 5 }  // load = current weekly non-cancelled slots
```

**Names are data, not contract (v0.2.2).** All people/room/subject names come from `backend/app/seed_data.json`
(and HOD renames at runtime). The frontend must never hardcode or match on a name: key everything on ids
(`user_id`, `faculty_id`, `room_id`, `subject_code`) and display whatever `name` / `faculty_name` the API returns.
Ids (`S001…`, `F01…F08`, `H01`) are stable.

---

## Endpoints

| Method | Path | Who | Purpose | Screen |
|---|---|---|---|---|
| POST | `/auth/login` | public | Log in with USN / staff ID + password → token (v0.5) | login |
| POST | `/auth/logout` | all | Revoke this session's token → `{ "ok": true }` (v0.5; revokes since v0.6) | navbar / profile |
| POST | `/auth/stream-ticket` | all | Single-use 60 s ticket for `/stream` (v0.5) | live refresh |
| GET | `/auth/demo-users` | public | List of seeded users for the demo role switcher | login / role picker |
| GET | `/me` | all | Current user + role + section | sidebar |
| GET | `/timetable?section=CSE-A` | all | Week of Slots for a section | Schedule (weekly matrix) |
| GET | `/timetable/faculty/{faculty_id}` | all | Faculty's week | Schedule → Faculty tab |
| GET | `/rooms?day=MON&period=3` | all | Rooms + `free: bool` | Schedule → Rooms tab |
| GET | `/today` | all | Today's Slots for caller + nudges | Today |
| GET | `/faculty` | all | Faculty directory (`Faculty[]`, by id) | Schedule → Faculty tab, Admin |
| PATCH | `/faculty/{faculty_id}` | hod | Rename: body `{ "name": "..." }` → `Faculty` | Admin |
| GET | `/attendance?section=CSE-A` | all | `[{subject_code, percent}]` | Today → Attendance Matrix |
| POST | `/incidents` | faculty, hod | Report disruption → starts agent | Admin Console form |
| GET | `/decisions` | hod | Audit log, newest first | Admin → Audit & Logs |
| POST | `/decisions/{id}/approve` | hod | Apply a proposal, or acknowledge | HOD dashboard |
| POST | `/decisions/{id}/reject` | hod | Reject | HOD dashboard |
| POST | `/decisions/{id}/close` | hod | Close an escalation as unresolved, with a reason | HOD dashboard |
| GET | `/nudges` | all | Caller's nudges | Nudges |
| POST | `/nudges/{id}/read` | all | Mark done | Nudges |
| POST | `/nudges/{id}/snooze` | owner | Hide for `{ "minutes": n }` (v0.3) | Nudges |
| POST | `/nudges/{id}/block` | owner | Hide for good (v0.3) | Nudges |
| GET | `/events?section=CSE-A` | all | Events + clash info + RSVP state | Events |
| POST | `/events/{id}/rsvp` | student | RSVP (v0.3) | Events |
| DELETE | `/events/{id}/rsvp` | student | Cancel RSVP (v0.3) | Events |
| GET | `/stats` | hod | KPIs, see `GET /stats` below | Admin KPI cards |
| GET | `/stream?ticket=…` | ticket | **SSE** live updates (see below) | all (live refresh) |
| GET | `/meta` | all | Form options + `demo_mode` (v0.4) | Admin incident form, reset button |
| POST | `/admin/reset-demo` | hod | Restore the seeded demo (v0.4; only when demo mode is on) | Admin |
| GET | `/nptel/requests` | all | NPTEL requests; students only their section | NPTEL |
| GET | `/nptel/requests/{id}/submissions?status=` | all | Rows; students only their own | NPTEL |
| POST | `/nptel/requests/{id}/nudge` | requesting faculty, hod | In-app reminder to pending students | NPTEL |
| GET | `/admin/timetable-template` | hod | Download timetable import CSV template | Admin Import |
| POST | `/admin/import-timetable` | hod | Validate (`dry_run=true`) or atomically import (`dry_run=false`) a timetable | Admin Import |

### POST `/auth/login`  (v0.5)
```jsonc
// request: students use USN, staff use staff ID (case-insensitive, spaces trimmed)
{ "login_id": "1AB25CS001", "password": "…" }      // or "F01" / "H01"
// response 200
{ "token": "eyJ…​.…",                 // opaque; send as  Authorization: Bearer <token>
  "token_type": "bearer",
  "expires_at": "2026-11-25T22:42:00Z", // ISO 8601 UTC
  "user": { "user_id": "S001",
            "usn": "1AB25CS001",       // null for faculty/HOD
            "name": "<student name>",
            "role": "student",         // student | faculty | hod
            "section": "CSE-A" } }     // null for faculty/HOD
// 401 → { "error": "invalid_credentials", "detail": "Wrong login id or password" }   (same for unknown id)
// 401 → { "error": "invalid_credentials", "detail": "Password required" }           (password missing/empty)
```
The demo password for every seeded user is set by the backend operator (`TARS_DEMO_PASSWORD` in `.env`); it is never in
the repo. Passwordless login (omit `password`) works only when the backend runs with `TARS_PASSWORDLESS_LOGIN=1`.
`GET /me` returns the same `user` object. Keep the token in memory or `sessionStorage`; never put it in a URL.

### POST `/auth/logout`  (v0.5; server-side revocation since v0.6)
Request: empty body, header `Authorization: Bearer <token>`. Response 200: `{ "ok": true }`.
The backend **revokes that token** (its id is stored server-side until the token would have expired, and survives
restarts and the demo reset). Afterwards, for that token only:
- every request → `401 { "error": "unauthorized", "detail": "Session revoked" }` (including a second logout);
- stream tickets it issued are refused with the same 401, and its **open `/stream` connections are closed** by the server.

Other sessions of the same user (another tab/phone with a different token) stay logged in. Frontend: call logout, then
drop the token and close your EventSource regardless of the response (a 401 here just means it was already invalid).

**USN ↔ user_id mapping:** `users.usn` column (unique, students only). `user_id` is the internal primary key (`S001`, `F01`, `H01`).
The frontend never uses the USN after login; it only uses `user_id`.

| login_id | user_id | role | section |
|---|---|---|---|
| 1AB25CS001 | S001 | student | CSE-A |
| 1AB25CS002 | S002 | student | CSE-B |
| 1AB25CS003 | S003 | student | CSE-C |
| F01 … F08 | F01 … F08 | faculty | – |
| H01 | H01 | hod | – |

`GET /auth/demo-users` (public) returns the same list as `[{user_id, usn, name, role, section}]` so the login screen can
offer them; it never includes passwords or tokens. Switching role = logging in again as that user.

### POST `/auth/stream-ticket`  (v0.5, any logged-in user)
No body. Response 200: `{ "ticket": "…", "expires_at": "2026-11-25T10:43:03Z" }`. The ticket is valid for **60 s** and
**one** connection; it carries the caller's identity from their session.

### GET `/me`
Same shape as the login response.

### GET `/faculty`  ·  PATCH `/faculty/{faculty_id}`  (v0.2.2)
```jsonc
// GET → 200: Faculty[] ordered by faculty_id
// PATCH request (hod only): name is trimmed, 1–80 chars
{ "name": "New Display Name" }
// PATCH response 200: the updated Faculty
// errors: 401 · 403 (not hod) · 404 unknown faculty_id · 422 empty/too long
```
After a rename the backend emits `timetable_updated` once per section that faculty teaches
(`slot_ids` = that faculty's slots in the section), to that section + the faculty + HOD.
Every `Slot.faculty_name`, `/me`, `/auth/demo-users` and `/faculty` reflect the new name immediately.
Existing Decision `summary`/`reasoning` and Nudge `body` texts are history and keep the old name.

### Optional `section` query param (v0.2.1)
`/timetable`, `/attendance` and `/events` take `?section=`. If omitted, the caller's own section is used.
If omitted and the caller has no section (faculty/HOD): `/timetable` and `/attendance` → `422`; `/events` computes `clashes_with` against the faculty's own slots (HOD: `[]`).

### GET `/rooms?day=MON&period=3`  (v0.2.1)
A period outside the timetable → 422. `capacity: 0` = not recorded.
```jsonc
// response 200: every room, free = no non-cancelled slot in that room at day+period
[ { "id": "R104", "name": "Room 104 (spare)", "kind": "classroom", "capacity": 60, "free": true } ]
// kind: classroom | lab | hall
```

### GET `/today`  (v0.2.1)
```jsonc
// response 200
{ "day": "MON",              // today's weekday; Sat/Sun → MON. Backend may pin it via DEMO_DAY env.
  "slots": [ /* Slot[] for today: student → own section, faculty → own slots, hod → all */ ],
  "nudges": [ /* Nudge[] for the caller, newest first */ ] }
```

### Error body
All errors use `{ "error": "<code>", "detail": "<text>" }` with codes `invalid_credentials` (401, login only; v0.5),
`unauthorized` (401: missing / invalid / expired / revoked token or stream ticket; the response has `WWW-Authenticate: Bearer`),
`forbidden` (403: valid token, wrong role), `not_found` (404), `validation` (422), `clash` (409), `invalid_state` (409).
Frontend rule: `401` → clear the token and show login (except on the login form itself) · `403` → "not allowed" message.
**422 `detail` is safe to show to users (v0.4):** a plain, human-readable sentence (e.g. "No scheduled classes are affected
by this incident", or for malformed input "body.periods.0: Input should be less than or equal to 6"). It never contains stack
traces, file paths, SQL or secrets, so the incident form can display it as-is next to the submit button.

### GET `/meta`  (v0.4, any logged-in user)
Static options for building forms, plus whether to show the demo reset button. Faculty come from `GET /faculty`, rooms from `GET /rooms`.
```jsonc
{ "demo_mode": false,                                   // true only when the backend runs with TARS_DEMO_MODE=1
  "days": ["MON", "TUE", "WED", "THU", "FRI"],
  "periods": [ { "period": 1, "start": "09:00", "end": "09:55" }, /* … 6 periods, 7 with bmsit */ ],
  "incident_types": ["absence", "room_unavailable"] }
```

### POST `/admin/reset-demo`  (v0.4, hod, demo mode only)
No body. Restores the seeded timetable (same slot ids as a fresh seed) and seeded names; clears incidents, decisions,
nudges, RSVPs and Telegram confirmations; cancels pending escalation timers. **Keeps Telegram links**, so phones don't relink.
```jsonc
// response 200
{ "status": "reset", "slots": 72 }
// errors: 404 when demo mode is off (for everyone, checked first) · 401 · 403 not hod
```
Then every connected client gets SSE `demo_reset`. Show the button only if `GET /meta` says `demo_mode: true`.

### GET `/admin/timetable-template`  (hod only)
No body. Returns `text/csv` attachment `tars_timetable_template.csv` with standard columns: `section,day,period,subject,faculty,room`. Errors: 401 · 403 not hod.

### POST `/admin/import-timetable`  (hod only)
Import a college timetable from parsed CSV or Excel rows.
Query param: `dry_run=true` (default: validate & preview without saving) or `dry_run=false` (validate, atomically replace slots for replaced sections, and emit `timetable_updated`).

```jsonc
// request body
{
  "rows": [
    {
      "section": "CSE-A",            // matched case-insensitively to existing sections
      "day": "MON",                  // MON..FRI (also "Monday", "Mon")
      "period": 1,                   // a period from GET /meta
      "subject": "DS",               // subject code (e.g. "DS") or name (e.g. "Data Structures")
      "faculty": "F01",              // faculty id (e.g. "F01") or name (e.g. "Dr. Ananya Rao")
      "room": "R101"                 // room id (e.g. "R101") or name (e.g. "Room 101")
    }
  ],
  "replace_sections": ["CSE-A"]      // optional: which sections to replace (defaults to all sections in rows)
}

// response 200 (dry_run=true, valid)
{
  "valid": true,
  "errors": [],
  "summary": { "total_rows": 72, "sections": ["CSE-A", "CSE-B", "CSE-C"], "errors": 0 },
  "imported": null,
  "preview": [ /* array of canonical Slot objects */ ]
}

// response 200 (dry_run=true, validation failed)
{
  "valid": false,
  "errors": [
    {
      "row": 3,
      "field": "faculty",
      "value": "Dr. Unknown",
      "type": "unknown",             // missing | unknown | invalid | mismatch | duplicate | clash | blocked
      "message": "Unknown faculty 'Dr. Unknown'"
    }
  ],
  "summary": { "total_rows": 72, "sections": ["CSE-A"], "errors": 1 },
  "imported": null,
  "preview": null
}

// response 200 (dry_run=false, successful import)
{
  "valid": true,
  "errors": [],
  "summary": { "total_rows": 72, "sections": ["CSE-A"], "errors": 0 },
  "imported": 72,
  "preview": [ /* array of canonical Slot objects */ ]
}

// response 422 (dry_run=false, row validation failed; nothing saved)
{
  "error": "validation",
  "detail": "Import validation failed with 1 error(s)",
  "errors": [ /* same objects as above */ ],
  "summary": { "total_rows": 72, "sections": ["CSE-A"], "errors": 1 }
}
// Malformed body (e.g. no rows, non-numeric period): 422 with only error + detail, also when dry_run=true.
// 409 { "error": "clash", "detail": "…" }: the timetable changed during the import; nothing saved.
// 409 { "error": "invalid_state", "detail": "Resolve open decision(s) 7 …" }: nothing saved (rule 8). A dry run lists each
//   as { row: null, field: "decision", value: "7", type: "blocked" } with valid=false.
// 401 · 403 not hod
```

**Validation & Safety Guarantees:**
1. Fields matched against canonical database records (`subjects`, `faculty`, `rooms`, `users`, `periods`).
2. Faculty capability checked: faculty member must have the subject code listed in `faculty.subjects`.
3. Intra-file clash detection: checks for duplicate section slots, faculty double-booking, and room double-booking within the imported rows.
4. Cross-section clash detection: checks against active slots of sections *not* being replaced.
5. Atomic replacement: on `dry_run=false`, all slots of `replace_sections` are deleted and the new ones inserted in a
   single transaction. If validation fails or any error occurs, nothing changes.
6. Every section in `replace_sections` needs at least one row, so an import can't empty a section by accident.
7. SSE `timetable_updated` per replaced section, to its students, HOD, and every faculty member who gained or lost a class.
8. A `proposed` or `pending_ack` decision affecting a replaced section blocks the import (409 `invalid_state`) and makes a dry run `valid: false`:
   HOD decides it first, or waits for the substitutes (or their deadline) or a running agent to finish.
9. New slots get new ids; `preview` ids are only row numbers (1, 2, …), so refetch `/timetable` after importing.
   Closed decisions keep their old `affected_slot_ids`.


### POST `/incidents`
```jsonc
// request
{ "type": "absence",                 // absence | room_unavailable
  "faculty_id": "F03",               // for absence
  "room_id": null,                   // for room_unavailable
  "day": "MON", "periods": [3, 4],
  "note": "Fever, out today" }
// response 202
{ "incident_id": 5, "decision_id": 7, "status": "agent_running" }
```
Errors: `403` if role is student, or faculty reporting someone else's absence (HOD may report for anyone) · `422` if the
faculty/room is unknown or no scheduled class is affected.
The agent runs in the background, so a clash found while planning can't return `409` here: the agent tries another
option, and if it can't resolve a slot the decision ends `escalated`. Follow progress via `agent_step` / `decision_updated`.

**Decision lifecycle:** incident → proposal → HOD approves or rejects → timetable update (on approval only).

| Status | Meaning | Timetable |
|---|---|---|
| `proposed` | agent still running ("TARS is working on it…"), or a proposal waits for the HOD | unchanged |
| `committed` | HOD approved, no Telegram reply awaited | changed |
| `pending_ack` | HOD approved, substitutes asked on Telegram | changed |
| `acknowledged` | every substitute asked accepted (or the HOD closed a `pending_ack` with no request waiting) | unchanged by acknowledging |
| `escalated` | some class has no confirmed cover: nothing found, only a PARTIAL proposal, declined, or no reply | see below |
| `rejected` | HOD rejected | unchanged |
| `closed_unresolved` | HOD closed an escalation without coverage, with a reason; final | unchanged by closing |

**Source:** `summary` starts with `[Gemini]` or `[Rule-based fallback]`, and `reasoning` says why fallback ran. Fallback runs when
Gemini has no key, fails or doesn't finish: it discards any Gemini output and applies the same rules with the substitute finder,
else another free room (room incidents), else a move. It never cancels. If it finds nothing: `escalated`, no source label.
If Gemini finishes but leaves a class uncovered, that class escalates without fallback.

**Google Calendar (v0.6):** after the HOD approves a substitution or move, the backend creates (or updates) one event per
slot in the department calendar: title like `DS (CSE-A): <faculty name> approved as substitute (not confirmed)`, on the **next occurrence** of the slot's weekday (today if that
period hasn't ended yet, otherwise up to 7 days ahead; never in the past),
period times in Asia/Kolkata, room as location, decision id + summary in the description. It runs in the background, so
`calendar_link` is `null` at first and arrives a moment later via `decision_updated`. Show "Slot secured in calendar"
(linking to `calendar_link`) once it's non-null. Progress shows in the TARS feed as `agent_step` (`step: "act"`,
`phase: "dispatch"`): "Calendar: saving 2 event(s) in the background", then "Calendar event created: …" (or "updated: …",
or "Calendar: could not save … (logged, schedule unaffected)"); these can arrive after the `done` step. If Calendar isn't
configured, nothing is sent and `calendar_link` stays `null`. The demo reset deletes the events TARS created.

**Telegram (backend-only):** after HOD approval each substitute gets Accept / Decline. All accept → `acknowledged`.
- **Decline:** the class goes back to the original faculty (`scheduled`), its Calendar event is deleted, the decision becomes
  `escalated` (even if the HOD had acknowledged), and `reasoning` gains "UNRESOLVED slots [...]". Earlier reasoning and the
  declined request are kept. Students get a "Cover not confirmed" nudge; `timetable_updated` is sent. If the original faculty
  has another class then, the slot can't be given back and the reasoning asks for a manual change.
- **Assigning someone else:** POST `/incidents` again for that faculty, day and period. The new proposal never offers a slot to
  someone who declined it (until a demo reset). Approve it as usual; the first decision stays as history.
- **No reply within `ESCALATION_MINUTES`:** those requests become `expired` and only those covers are withdrawn, as for a decline;
  accepted covers stay. Decision `escalated`, HOD and students told, history kept. A late Accept is refused. Someone who
  expired may be proposed again. The deadline keeps running after HOD approval and after someone else declines.
- **Wording:** HOD approval is never presented as the substitute's acceptance, with or without Telegram. Students get
  "Substitute approved, not confirmed" and substitutes "HOD approved you as substitute: not confirmed"; the Calendar title says
  the same. These aren't rewritten if the substitute accepts later.
- **No bot token:** approval goes straight to `committed`, unconfirmed: `reasoning` says "NOT CONFIRMED" and it counts as
  `pending_confirmation`, never `rescued`. There is no web endpoint for a substitute to accept.

### POST `/decisions/{id}/approve`  ·  POST `/decisions/{id}/reject`  (hod, v0.2.1)
No body. Response 200: the updated Decision.
- approve, with pending changes → applies them in one transaction. `proposed` → `committed` or `pending_ack`; a PARTIAL
  `escalated` applies what it covers and **stays `escalated`**. 409 `clash` if they no longer fit or a class changed since; nothing is applied and it stays as it was.
- approve never answers for a substitute: `pending_ack` with unanswered requests → 409 `invalid_state` ("waits for F08 to answer").
  With none waiting → `acknowledged`.
- reject: pending changes (`proposed` or PARTIAL `escalated`) → `rejected` (nothing applied).
- `escalated` without pending changes can't be approved or rejected (409). The HOD can close it.
- Any other state → `409 { "error": "invalid_state", "detail": "..." }` (this includes a decision whose agent is still running). Unknown id → 404.

### POST `/decisions/{id}/close`  (hod)
Body `{ "reason": "…" }` (3–500 characters after trimming). Response 200: the Decision with status `closed_unresolved`; who, when
and why are appended to `reasoning`. Only `escalated`, with no proposal left to decide and no substitute left to answer, else
409 `invalid_state`. It changes no slots, isn't an approval, and is final. 401 · 403 not hod · 404 · 422 bad reason.
The same absence can still be reported again.

### NPTEL  (read and remind only)
Fields match the frontend's `NptelRequest` and `NptelSubmission`; ids are numbers. `status`: pending | verified | flagged.
Seeded rows exist only with `TARS_SEED=bmsit` and are **simulated**: show the title and flags as they are. No certificate is checked by
the backend, and there is **no upload and no recommendations endpoint** (404): keep those as labelled mocks.
`nudge` → `{ "nudged_count": n }`, the nudges really created now: students without an account, or with an unread reminder, aren't counted.
Errors: 401 · 403 (nudge by anyone else) · 404 · 422 bad id or status.

### GET `/stats`  (hod)
All but the last two and `classes_lost` count **decisions**. One decision can be in `cancelled` and one other group.

| Field | Meaning |
|---|---|
| `rescued` | substitute coverage committed, **every** substitute accepted, and no class of the decision cancelled |
| `pending_confirmation` | substitute coverage committed, but not every substitute has accepted (waiting, or Telegram off) |
| `cancelled` | the HOD approved at least one cancellation |
| `escalated` | unresolved coverage needing intervention, including PARTIAL approvals |
| `closed_unresolved` | closed by the HOD without coverage |
| `classes_lost` | cancelled classes (slots) in the timetable now |
| `nudges_acted` | nudges read or blocked |
| `avg_response_s` | always 0 for now |

HOD approval alone never counts as rescued. Moves and room changes without a substitute are in none of these groups.

### POST `/nudges/{id}/read`  (v0.2.1)
No body. Response 200: the updated Nudge (`read: true`). Only the nudge's owner; anyone else gets 404.

### POST `/nudges/{id}/snooze`  ·  POST `/nudges/{id}/block`  (v0.3, owner only)
```jsonc
// snooze request: 1 ≤ minutes ≤ 10080 (one week); snoozing again replaces the time
{ "minutes": 30 }
// block: no body
// response 200 (both): the updated Nudge
// errors: 401 · 404 if the nudge isn't yours (also for HOD) or doesn't exist · 422 bad minutes
```
`GET /nudges` (and `GET /today`'s `nudges`) only return nudges that are **not blocked** and **not currently snoozed**.
A snoozed nudge reappears on the next fetch after `snoozed_until`; no SSE event is sent when a snooze ends,
so refetch `/nudges` when you want it to resurface (e.g. on focus or every few minutes).
Blocked nudges never come back and count toward `/stats.nudges_acted`.

### POST `/events/{id}/rsvp`  ·  DELETE `/events/{id}/rsvp`  (v0.3, students only)
No body. Response 200: the updated Event (`rsvp`, `rsvp_count`, `clashes_with` for the caller's section).
Both are idempotent (RSVPing twice or cancelling a missing RSVP is fine). Errors: 401 · 403 faculty/HOD · 404 unknown event.

### GET `/stream?ticket=<ticket>`  (Server-Sent Events)
- **Auth (v0.5):** a ticket from `POST /auth/stream-ticket`. Missing, invalid, expired or already-used ticket → `401`
  (`detail`: "Missing stream ticket" / "Invalid token" / "Stream ticket expired" / "Stream ticket already used").
  `?user_id=` no longer works.
- **Content-Type:** `text/event-stream`. Server sends `event: ping` with `data: {}` every 15 s as a keep-alive. Ignore it.
- **Reconnect (v0.5, changed):** don't rely on EventSource's auto-reconnect: it reuses the same URL, the used ticket gets a
  `401`, and the browser stops. On `error`: `es.close()`, get a new ticket, open a new EventSource (back off a few seconds;
  if the ticket request itself returns 401 the session expired → login). After reconnecting, refetch `/timetable`,
  `/nudges` and `/decisions` once, because events missed while disconnected are not replayed.
- **Format:** each message is `event: <name>` + `data: <one-line JSON>`.
- **Who receives what:** students only get events for their own section/user. Faculty get events about their own slots. HOD gets everything.

| event | payload | who gets it | frontend action |
|---|---|---|---|
| `timetable_updated` | `{ "section": "CSE-A", "slot_ids": [12, 13] }` | that section + affected faculty + HOD | refetch `/timetable` |
| `decision_updated` | Decision object | HOD + reporting faculty | update the audit log row |
| `nudge_created` | Nudge object | that user | show toast + add to the Nudges list |
| `agent_step` | `{ "decision_id": 7, "step": "perceive" \| "reason" \| "tool_call" \| "act" \| "done" \| "error", "phase": "signal" \| "evaluate" \| "match" \| "constraints" \| "resolve" \| "dispatch" \| "escalate", "text": "find_substitute(DS, MON P2) -> <faculty name> (load 5)", "ts": "2026-11-25T10:42:03" }` | HOD + reporting faculty | append to the "TARS thinking" feed; light up `phase` in the re-planning flow |
| `demo_reset` | `{}` (v0.4) | everyone | drop local state (feed, toasts, selections) and refetch everything (`/timetable`, `/today`, `/nudges`, `/events`, `/decisions`, `/stats`); decision ids restart at 1 |
| `ping` | `{}` | everyone | ignore |

**`agent_step.phase` (v0.3)** maps every step onto the UI's re-planning flow. `step` is unchanged.

| phase | emitted for | typical `step` |
|---|---|---|
| `signal` | incident received | `perceive` |
| `evaluate` | reading timetable / attendance (`get_timetable`, `get_attendance`) | `tool_call`, `reason` |
| `match` | `find_substitute`, `find_free_rooms`, `propose_reschedule` | `tool_call` |
| `constraints` | 75% rule, can-teach, absent-faculty, no-swap checks ("Constraints OK: …" or "Rule check failed: …") | `reason`, `tool_call` |
| `resolve` | clash validator: "validate_clash(n change(s)) -> OK…" or "-> clash: …" | `tool_call` |
| `dispatch` | `commit_change` (proposes only), `log_decision`; after approval: "HOD approved. Committed …", Telegram, Calendar | `tool_call`, `act` |
| `escalate` | errors, change sent to HOD for approval, `done` for `escalated` / `proposed` | `error`, `act`, `done` |

Free-text model commentary (`step: "reason"`) takes the phase TARS is currently in (`evaluate` before any tool ran).
Phases normally progress in that order, but they can repeat (e.g. one `match`→`dispatch` cycle per slot,
or `constraints` again after a rejected plan). Treat `phase` as "what TARS is doing now", not a strict state machine.

Example frontend code (v0.5):
```ts
const auth = { Authorization: `Bearer ${token}` };              // on every fetch
async function openStream(): Promise<EventSource> {
  const r = await fetch(`${API}/auth/stream-ticket`, { method: 'POST', headers: auth });
  if (r.status === 401) { logout(); throw new Error('session expired'); }
  const { ticket } = await r.json();
  const es = new EventSource(`${API}/stream?ticket=${encodeURIComponent(ticket)}`);
  es.addEventListener('timetable_updated', e => { const d = JSON.parse(e.data); /* refetch */ });
  es.addEventListener('agent_step', e => { /* append to feed */ });
  es.onerror = () => { es.close(); setTimeout(() => openStream().then(refetchAll), 3000); };  // new ticket each time
  return es;
}
```

---

## Rules both sides rely on
1. **Only faculty/hod can change the schedule** (RBAC). Students can only RSVP and manage their own nudges.
2. **Clash validator is code, not LLM**: no faculty, room or section may hold two slots in the same day+period.
3. If a section's attendance in that subject is **< 75%**, the agent must try substitute → reschedule before cancel.
4. **Nothing changes before HOD approval.** Then the substitute gets a Telegram message with Accept/Decline. **No reply within `ESCALATION_MINUTES` (default 2) → escalate to HOD.**
5. Every agent action writes a Decision with `reasoning`.
