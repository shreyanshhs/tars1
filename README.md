# TARS — Agentic Campus Assistant

TARS is an agentic campus assistant for the BMSIT CSE department. An LLM agent handles teachers' administrative workload—such as finding qualified timetable substitutes during leave and managing accreditation certificate collection—and escalates only when high-level human approval or decisions are needed.

## Features
- **Leave & Substitute Resolution**: Automated substitute matching with conflict validation and one-tap HOD approvals.
- **Explainable Decisions (XAI)**: Comprehensive reasoning audit logs detailing candidate evaluation, constraints, and timeline.
- **Accreditation & Certificate Collector**: Multi-modal NPTEL certificate verification and compliance tracking.
- **Timetable & Events**: Real-time BMSIT schedule sync and event registration with conflict awareness.

## Architecture
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons
- **Backend**: FastAPI (Python 3.11+) + SQLite + Gemini API + Server-Sent Events (SSE)

## Getting Started

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
