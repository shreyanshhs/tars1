# TARS — Agentic Campus Assistant

> **BMSIT CSE Department · Martian 1.0 Hackathon Project**  
> *"We asked teachers what they hate doing. TARS does it for them."*

TARS is an agentic campus workflow assistant designed specifically for the Department of Computer Science & Engineering at BMS Institute of Technology & Management (BMSIT), Bengaluru. Rather than replacing the existing college ERP (**Contineo**), TARS operates alongside it as an autonomous administrative agent that eliminates manual paperwork, coordinates substitute faculty during leave, audits accreditation compliance (NPTEL), and interrupts humans only when a decision requires approval.

---

## 1. Problem Statement

Interviews with BMSIT CSE faculty highlighted two critical administrative bottlenecks:
1. **Manual Leave & Substitute Hunting:** When a teacher needs leave, they must manually cross-reference paper timetables, find eligible colleagues who are free during those periods, solicit individual verbal agreements, fill out paper adjustment forms, and queue for physical sign-off from the Head of Department (HOD).
2. **Accreditation Document Chasing:** Faculty in charge of NAAC/NBA accreditation must manually track dozens of student NPTEL certificate submissions, cross-verify scores and roll numbers, and continuously follow up with unverified students.

TARS replaces these manual workflows with an **Explainable Agentic Workflow (XAI)** backed by deterministic timetable conflict validation and human-in-the-loop HOD oversight.

---

## 2. Technology Stack & Architecture

TARS is engineered with a strict separation between autonomous LLM reasoning and deterministic constraint validation:

```
┌─────────────────────────────────────────────────────────────────┐
│                 TARS Frontend (React 19 + Vite)                 │
│  - Tailwind CSS v4 + Lucide Icons + Google Stitch Design System │
│  - Multi-persona RBAC: Student, Faculty (Substitutes), HOD      │
└───────────────────────────────┬─────────────────────────────────┘
                                │ REST API + Server-Sent Events (SSE)
┌───────────────────────────────▼─────────────────────────────────┐
│                    FastAPI Backend (Python 3.11+)               │
│  ┌───────────────────────┐         ┌─────────────────────────┐  │
│  │   LLM Agent Engine    │         │ Deterministic Validator │  │
│  │  - Gemini Function    │◄───────►│  - Zero Room Clashes    │  │
│  │    Calling Loop       │         │  - Zero Teacher Clashes │  │
│  │  - Fallback Chain     │         │  - Lab Block Integrity  │  │
│  └──────────┬────────────┘         └────────────┬────────────┘  │
│             │                                   │               │
│  ┌──────────▼───────────────────────────────────▼────────────┐  │
│  │       SQLite Database (`tars.db`) + Foreign Keys          │  │
│  │   Timetable Slots, Incidents, Decisions, Nudges, Events   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                │                                │
│  ┌─────────────────────────────▼─────────────────────────────┐  │
│  │               External Dispatch Integrations              │  │
│  │  - Google Calendar Sync (Service Account Slot Sync)       │  │
│  │  - Telegram Bot Dispatch (Simulated Fallback)             │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Google Stitch Material Design Tokens.
- **Backend:** FastAPI (Python 3.11+), SQLite with WAL mode and foreign key constraints, `sse-starlette` for live stream updates, `pytest`.
- **Agentic AI:** Google Gemini API (`google-genai`) function calling loop with plain-Python deterministic fallback solver.
- **Explainability (XAI):** Plain-English reasoning logs, considered-and-rejected alternatives, rule constraint checks, and technical audit step timelines.

---

## 3. Core Role Capabilities

| Role | Key Capabilities |
| :--- | :--- |
| **Faculty** | • One-click leave submission with automatic class conflict identification.<br>• Real-time substitute cover request review (Accept / Decline with simulated Telegram alerts).<br>• Account-isolated **Teacher To-Do** checklist (persisted per faculty persona).<br>• NPTEL accreditation collection cohort tracker (38/46 verified demo baseline).<br>• **Google Meet Beta** scheduled hybrid class timetable preview. |
| **Head of Department (HOD)** | • Centralized **Approvals Dashboard** with unified leave and substitute recommendations.<br>• Comprehensive **Explainable AI (XAI)** decision audit detailing evaluated substitutes and rejection reasons.<br>• Department-wide timetable oversight and Section CSE-10 classes audit.<br>• One-tap decision commit that atomically replans affected timetable slots. |
| **Student** | • Personalized **Student Home** and daily schedule feed.<br>• Real-time **"Changed by TARS"** markers showing substitute faculty and room updates.<br>• NPTEL certificate upload preview with client-staged PDF viewer.<br>• Campus event discovery, clash detection against academic slots, and QR pass preview. |

---

## 4. The Verified Leave Workflow

TARS enforces a strict, multi-party agreement workflow before any timetable slot is modified:

```
[1. Faculty Leave Request]
       Prof. Chaitra D B (F_CDB) requests leave for Thursday, 3 December.
       TARS detects affected CSE-10 classes: Intro to AI (P4) and Python Lab (P6–P7).
                              │
                              ▼
[2. Conflict-Free Substitute Discovery]
       TARS evaluates candidate faculty. Deterministic validator verifies:
       - No double-booking of substitute, room, or section.
       - Preserves lab co-faculty pairings (Mrs. Geetha P L for Python Lab).
       - Prefers lowest weekly teaching load (Mr. Syed Matheen Pasha for Intro to AI).
                              │
                              ▼
[3. Independent Substitute Acceptance]
       - P4 Intro to AI: Mr. Syed Matheen Pasha (F_SMP) accepts cover duty.
       - P6–P7 Python Lab: Mrs. Geetha P L (F_GPL) accepts co-faculty cover duty.
                              │
                              ▼
[4. One-Tap HOD Approval]
       Dr. Surekha K B (HOD) reviews Decision #6 card with full XAI reasoning:
       - Plain-English justification of assigned substitutes.
       - List of rejected faculty alternatives with specific conflict grounds.
       HOD clicks "Approve Leave" -> Decision committed atomically in SQLite.
                              │
                              ▼
[5. Real-Time Schedule Update]
       - Slots 21 (P4), 23 (P6), and 24 (P7) transition from `scheduled` to `replanned`.
       - Students immediately see "Changed by TARS · Cover: Prof. Pasha / Mrs. Geetha".
       - Google Calendar sync queues background event creation for affected slots.
```

---

## 5. Explainability (XAI) & Governance Safeguards

TARS adheres to strict ethical and governance principles:
- **What the LLM Recommends:** The LLM agent evaluates free faculty, assesses subject familiarity, and crafts clear, plain-English justifications for the proposed changes.
- **What Deterministic Rules Enforce:** Python constraint validators strictly enforce that no teacher is double-booked, no classes are moved onto a teacher's leave day, lunch and tea breaks remain untouched, and lab sessions remain intact.
- **What the HOD Controls:** **Zero changes are applied to the live timetable without explicit HOD sign-off.** If the HOD rejects a proposal, the timetable remains 100% unaltered.

---

## 6. Honest Feature-Status Matrix

To maintain absolute transparency with evaluators, the operational status of every feature is disclosed below:

| Feature | Implementation Status | Data Source & Mechanism |
| :--- | :--- | :--- |
| **Leave & Substitute Matching** | **Live & Persisted** | FastAPI + SQLite conflict validator (`validator.py`, `agent.py`). |
| **HOD Approvals & Decision Commit** | **Live & Persisted** | Atomic SQLite transaction updating slots to `replanned`. |
| **Timetable Slot Updates (`GET /timetable`)** | **Live & Persisted** | Real BMSIT CSE-10 timetable seeded in SQLite. |
| **Department XAI Decision Timeline** | **Live & Persisted** | Persisted decision logs and evaluation steps in `decisions` table. |
| **Teacher To-Do Checklist** | **Local Persistence** | Client-side `localStorage` isolated by authenticated `facultyId`. |
| **User-Specific Inbox State** | **Local Persistence** | Read, snooze, and block states isolated per user in `localStorage`. |
| **Google Meet Integration** | **Beta Preview** | Scheduled class timetable preview; live Google Workspace room generation is planned for v2.0. |
| **NPTEL Student Upload & Verification** | **Simulated Preview** | Client-side PDF preview with illustrative 38/46 verified cohort fallback. |
| **Telegram Notifications** | **Simulated / Optional** | Logged via event bus; live dispatch activates when `TELEGRAM_BOT_TOKEN` is set. |
| **Google Calendar Sync** | **Live (Creds Dependent)** | Background sync via service account; gracefully disabled when credentials are unset. |
| **Classes & Attendance Modules** | **Design Preview** | Stitch layout preview with explicit "Coming soon / Beta" disclosures. |

---

## 7. Prerequisites & Local Setup

### System Requirements
- **Node.js:** v20.0.0 or higher
- **Python:** v3.11.0 or higher
- **Package Managers:** `npm` and `pip`

### Step 1: Clone & Configure Environment
```bash
git clone https://github.com/shreyanshhs/tars1.git
cd tars1

# Copy environment template
cp .env.example .env
```

Review `.env` settings for local evaluation:
```dotenv
# Demo configuration
TARS_DEMO_MODE=1
TARS_SEED=bmsit
TARS_DEMO_PASSWORD=bmsit
TARS_PASSWORDLESS_LOGIN=0

# AI & External integrations (Optional for offline demo)
GEMINI_API_KEY=
TELEGRAM_BOT_TOKEN=
GOOGLE_CALENDAR_ID=
GOOGLE_SERVICE_ACCOUNT_FILE=backend/service-account.json
```

### Step 2: Backend Setup
```bash
cd backend

# Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt

# Seed the BMSIT CSE-10 demo database
python3 app/seed.py

# Start the FastAPI backend server (Runs on port 8000)
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Backend API available at: `http://127.0.0.1:8000/api` (Swagger UI at `/docs`)*.

### Step 3: Frontend Setup
In a new terminal window:
```bash
cd frontend

# Install frontend dependencies
npm install

# Start the Vite development server (Connects to backend on port 8000)
VITE_USE_MOCK=false npm run dev
```
*Frontend web application available at: `http://localhost:5173/`*.

---

## 8. Demo Personas & Credentials

All accounts are pre-configured in the seeded BMSIT dataset. **These accounts are strictly for hackathon evaluation and testing:**

| Role | Name | Login ID | Demo Password | Persona Context |
| :--- | :--- | :--- | :--- | :--- |
| **Faculty (Lead)** | Prof. Chaitra D B | `F_CDB` | `bmsit` | Assistant Professor, AI/ML (Leave Applicant) |
| **Faculty (Substitute)** | Mr. Syed Matheen Pasha | `F_SMP` | `bmsit` | Assistant Professor, AI (P4 Substitute) |
| **Faculty (Lab Cover)** | Mrs. Geetha P L | `F_GPL` | `bmsit` | Assistant Professor, CSE (P6–P7 Lab Substitute) |
| **HOD** | Dr. Surekha K B | `H_SKB` | `bmsit` | Professor & HOD, CSE (Approver) |
| **Student** | Shreyansh | `S0000` | `bmsit` | Student, Section CSE-10 |

*Quick Persona Switching: Use the user profile avatar in the sidebar footer or top navbar to authenticate and switch between personas instantly.*

---

## 9. Verification & Automated Test Suite

### Running Backend Regression Tests
```bash
cd backend
pytest -v
```
**Verified Result:**
```
====================== 333 passed, 1 skipped in 19.70s ======================
```
- `333 passed`: All unit, API contract, clash validator, agent fallback, stream authentication, and workflow tests pass cleanly.
- `1 skipped`: `test_calendar_sync_disabled_without_creds` (validates graceful fallback when external Google credentials are not mounted).
- `0 failed`.

### Running Frontend Production Build & Type Checking
```bash
cd frontend

# Production Vite build
npx vite build
# Result: ✓ built in 138ms (0 errors)

# Strict TypeScript verification
npx tsc --noEmit
# Result: 0 errors
```

---

## 10. API Specification & Evaluator References

Detailed endpoint documentation and OpenAPI schemas are available in the project repository:
- **Comprehensive API Contract:** [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) — REST endpoints, payload structures, SSE event format, and error schemas.
- **Machine-Readable OpenAPI Specification:** [`docs/openapi.json`](docs/openapi.json).
- **FastAPI Interactive Docs:** `http://localhost:8000/docs` (available when backend is running).

---

## 11. Known Limitations & Roadmap

1. **Google Workspace Administration:** Google Meet video room creation and Google Calendar synchronization require institutional domain administrator credentials. In this prototype, calendar sync is supported via service account, while Meet video room generation is in preview.
2. **Student Contineo Integration:** TARS currently consumes Contineo attendance marks and student profiles as seed fixtures. Production deployment will utilize Contineo SIS REST/SOAP connectors.
3. **Multi-Department Scale:** The current release focuses on the BMSIT CSE department (Sections CSE-8 through CSE-12). Multi-tenancy across all engineering departments is architected for Phase 2.
