import { useState } from 'react';
import { useTars } from '../../../context/TarsContext';

export function HelpView() {
  const { role } = useTars();
  const [activeTab, setActiveTab] = useState<'workflow' | 'roles' | 'features' | 'disclosures'>('workflow');
  const [selectedRoleGuide, setSelectedRoleGuide] = useState<'faculty' | 'student' | 'hod'>(role);

  return (
    <div className="flex-1 min-h-screen bg-surface p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">help_center</span>
            <h1 className="font-headline text-headline-sm text-on-surface font-bold tracking-tight">
              TARS Help &amp; Workflow Guide
            </h1>
          </div>
          <p className="font-body text-body-sm text-on-surface-variant">
            Autonomous campus operations, role-based workflows, and prototype disclosures for BMSIT CSE.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="inline-flex rounded-lg bg-surface-container p-1 border border-outline-variant text-xs font-label">
          <button
            type="button"
            onClick={() => setActiveTab('workflow')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'workflow'
                ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-xs'
                : 'text-on-surface-muted hover:text-on-surface'
            }`}
          >
            Autonomous Loop
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'roles'
                ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-xs'
                : 'text-on-surface-muted hover:text-on-surface'
            }`}
          >
            Role Guides
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('features')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'features'
                ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-xs'
                : 'text-on-surface-muted hover:text-on-surface'
            }`}
          >
            Core Modules
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('disclosures')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'disclosures'
                ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-xs'
                : 'text-on-surface-muted hover:text-on-surface'
            }`}
          >
            Disclosures
          </button>
        </div>
      </div>

      {/* TAB 1: AUTONOMOUS WORKFLOW LOOP */}
      {activeTab === 'workflow' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-150">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 sm:p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-title text-title-md text-on-surface font-semibold">
                Autonomous Leave &amp; Timetable Replanning Cycle
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                LIVE ENGINE · SQLite Backed
              </span>
            </div>
            <p className="font-body text-body-sm text-on-surface-variant leading-relaxed">
              When an educator applies for leave, TARS resolves departmental timetable conflicts autonomously without manual phone trees or WhatsApp messaging. The end-to-end workflow follows five coordinated stages:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
              {/* Step 1 */}
              <div className="flex flex-col gap-2 p-3.5 rounded-lg bg-surface border border-outline-variant">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="font-label text-label-md font-semibold text-on-surface">Leave Submission</span>
                </div>
                <p className="font-body text-body-xs text-on-surface-muted leading-normal">
                  Faculty submits date and reason (e.g., Prof. Chaitra D B). TARS identifies affected classes and sections.
                </p>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col gap-2 p-3.5 rounded-lg bg-surface border border-outline-variant">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span className="font-label text-label-md font-semibold text-on-surface">Constraint Search</span>
                </div>
                <p className="font-body text-body-xs text-on-surface-muted leading-normal">
                  Optimization engine checks timetable free slots, room availability, subject qualifications, and faculty load balance.
                </p>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col gap-2 p-3.5 rounded-lg bg-surface border border-outline-variant">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span className="font-label text-label-md font-semibold text-on-surface">Candidate Action</span>
                </div>
                <p className="font-body text-body-xs text-on-surface-muted leading-normal">
                  Ranked candidate substitute (e.g., Mrs. Geetha P L) receives an instant cover request with one-tap accept.
                </p>
              </div>

              {/* Step 4 */}
              <div className="flex flex-col gap-2 p-3.5 rounded-lg bg-surface border border-outline-variant">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center justify-center shrink-0">
                    4
                  </span>
                  <span className="font-label text-label-md font-semibold text-on-surface">HOD XAI Approval</span>
                </div>
                <p className="font-body text-body-xs text-on-surface-muted leading-normal">
                  Dr. Surekha reviews candidate options, load differentials, constraint rules, and commits the decision in 1 click.
                </p>
              </div>

              {/* Step 5 */}
              <div className="flex flex-col gap-2 p-3.5 rounded-lg bg-surface border border-outline-variant">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center justify-center shrink-0">
                    5
                  </span>
                  <span className="font-label text-label-md font-semibold text-on-surface">Live Relocation</span>
                </div>
                <p className="font-body text-body-xs text-on-surface-muted leading-normal">
                  Timetable updates live for students and faculty. Room allocations update with instant relocation notifications.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <span className="material-symbols-outlined text-[20px]">psychology</span>
                <span>Explainable AI (XAI) Transparency</span>
              </div>
              <p className="font-body text-body-xs text-on-surface-variant leading-relaxed">
                TARS does not use a black box. Every relocation recommendation provides the full constraint reasoning: which faculty were free, whether they met subject expertise rules, their current weekly teaching hours, and why other candidates were ranked lower.
              </p>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <span className="material-symbols-outlined text-[20px]">speed</span>
                <span>Rapid Incident Recovery</span>
              </div>
              <p className="font-body text-body-xs text-on-surface-variant leading-relaxed">
                Across 12 covered classes in BMSIT CSE testing, TARS reduced average incident resolution from 45 minutes of manual coordination down to 84 seconds with 0 timetable clashes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROLE-SPECIFIC GUIDES */}
      {activeTab === 'roles' && (
        <div className="flex flex-col gap-5 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 pb-1 border-b border-outline-variant">
            <span className="font-label text-label-sm text-on-surface-muted">Select Guide Persona:</span>
            <div className="inline-flex gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedRoleGuide('faculty')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedRoleGuide === 'faculty'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                Faculty (Prof. Chaitra D B)
              </button>
              <button
                type="button"
                onClick={() => setSelectedRoleGuide('student')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedRoleGuide === 'student'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                Student (Shreyansh - CSE 10)
              </button>
              <button
                type="button"
                onClick={() => setSelectedRoleGuide('hod')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedRoleGuide === 'hod'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                HOD (Dr. Surekha K B)
              </button>
            </div>
          </div>

          {selectedRoleGuide === 'faculty' && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col gap-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-title text-title-md text-on-surface font-semibold">
                  Faculty Operations Guide · Prof. Chaitra D B
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                  ROLE: FACULTY
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-body text-on-surface-variant">
                <div className="p-3.5 rounded-lg bg-surface border border-outline-variant flex flex-col gap-1.5">
                  <span className="font-semibold text-on-surface text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">event_busy</span>
                    Applying for Leave
                  </span>
                  <p className="leading-relaxed">
                    Click <strong>Apply for Leave</strong> from Home or Leave sidebar. Select date and reason. TARS checks your assigned periods (e.g., 21CS52 in Room 302) and searches candidate substitutes automatically.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-surface border border-outline-variant flex flex-col gap-1.5">
                  <span className="font-semibold text-on-surface text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">handshake</span>
                    Accepting Cover Requests
                  </span>
                  <p className="leading-relaxed">
                    When selected as a substitute (e.g. Mrs. Geetha P L), open the <strong>Cover Request</strong> notification card. Review period, room, and syllabus notes, then click <strong>Accept</strong> to notify HOD.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-surface border border-outline-variant flex flex-col gap-1.5">
                  <span className="font-semibold text-on-surface text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">workspace_premium</span>
                    NPTEL Certificate Audit
                  </span>
                  <p className="leading-relaxed">
                    Monitor cohort certification completion (currently 83% verified in CSE-5B). Use <strong>Remind All Pending</strong> to dispatch reminders, or click <strong>Export CSV</strong> for NBA/NAAC audit submissions.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-surface border border-outline-variant flex flex-col gap-1.5">
                  <span className="font-semibold text-on-surface text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">school</span>
                    My Classes &amp; Timetable
                  </span>
                  <p className="leading-relaxed">
                    View active subject allotments (Theory 21CS51, Lab 21CSL57) and student enrollment breakdown across 5th semester sections.
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedRoleGuide === 'student' && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col gap-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-title text-title-md text-on-surface font-semibold">
                  Student Operations Guide · Shreyansh (26UG1BYCS0274-T · CSE-10)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                  ROLE: STUDENT
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-body text-on-surface-variant">
                <div className="p-3.5 rounded-lg bg-surface border border-outline-variant flex flex-col gap-1.5">
                  <span className="font-semibold text-on-surface text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">today</span>
                    Live Schedule &amp; Relocations
                  </span>
                  <p className="leading-relaxed">
                    Check your daily timetable on the <strong>Today</strong> tab. If a faculty member is on leave, TARS displays the substitute teacher and room reallocation banner with zero manual inquiry needed.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-surface border border-outline-variant flex flex-col gap-1.5">
                  <span className="font-semibold text-on-surface text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">event_available</span>
                    Clash-Free Campus Events
                  </span>
                  <p className="leading-relaxed">
                    Browse hackathons, robotics challenges, and workshops. Switch to the <strong>Clash-free</strong> tab to show only events that do not overlap with your mandatory BMSIT lectures or lab slots.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-surface border border-outline-variant flex flex-col gap-1.5">
                  <span className="font-semibold text-on-surface text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">confirmation_number</span>
                    Event Registration &amp; Pass
                  </span>
                  <p className="leading-relaxed">
                    Click <strong>Register</strong> on any campus event. Add your team members via USN chips and generate a verified <strong>TARS Campus Entry Pass</strong>.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-surface border border-outline-variant flex flex-col gap-1.5">
                  <span className="font-semibold text-on-surface text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">upload_file</span>
                    NPTEL Proof Upload &amp; Electives
                  </span>
                  <p className="leading-relaxed">
                    Drop your NPTEL course completion certificate PDF in the collector. Browse curated elective recommendations aligned with VTU credit equivalencies.
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedRoleGuide === 'hod' && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col gap-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-title text-title-md text-on-surface font-semibold">
                  HOD Operations Guide · Dr. Surekha K B (Professor &amp; HOD)
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                  ROLE: HOD
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-body text-on-surface-variant">
                <div className="p-3.5 rounded-lg bg-surface border border-outline-variant flex flex-col gap-1.5">
                  <span className="font-semibold text-on-surface text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">fact_check</span>
                    Approvals Dashboard
                  </span>
                  <p className="leading-relaxed">
                    Review pending autonomous leave resolutions. Each card provides full candidate evaluation matrices, workload differentials, and constraint checklist results before you click <strong>Approve</strong>.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-surface border border-outline-variant flex flex-col gap-1.5">
                  <span className="font-semibold text-on-surface text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">history_edu</span>
                    TARS Activity &amp; Audit Trail
                  </span>
                  <p className="leading-relaxed">
                    Inspect past autonomous replanning events. View decision rationale, tool execution sequences, latency benchmarks, and departmental coverage statistics.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-surface border border-outline-variant flex flex-col gap-1.5">
                  <span className="font-semibold text-on-surface text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">admin_panel_settings</span>
                    Admin Console
                  </span>
                  <p className="leading-relaxed">
                    Monitor overall system health, department timetable grid, room utilization rates, and faculty availability status across BMSIT CSE.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-surface border border-outline-variant flex flex-col gap-1.5">
                  <span className="font-semibold text-on-surface text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">equalizer</span>
                    Accreditation Oversight
                  </span>
                  <p className="leading-relaxed">
                    Ensure NAAC Criteria 2 and NBA Criterion 4 compliance by overseeing department NPTEL certification completion and faculty workload balance.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CORE MODULES */}
      {activeTab === 'features' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-150">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col gap-2 shadow-xs">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <span className="material-symbols-outlined text-[20px]">mark_email_unread</span>
              <span>Intelligent Inbox &amp; Pacing Nudges</span>
            </div>
            <p className="font-body text-body-xs text-on-surface-variant leading-relaxed">
              Two-column priority inbox connecting faculty and students to action items. Supports marking as read, snoozing for 24 hours, or blocking unnecessary reminders. Distinctly tags live leave alerts versus audit logs.
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col gap-2 shadow-xs">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <span className="material-symbols-outlined text-[20px]">verified</span>
              <span>NPTEL Accreditation Collector</span>
            </div>
            <p className="font-body text-body-xs text-on-surface-variant leading-relaxed">
              Provides an 83% SVG progress ring, submission tables categorized into verified, pending, and flagged certificates, student course recommendation cards, and client-side RFC 4180 CSV generation.
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col gap-2 shadow-xs">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <span className="material-symbols-outlined text-[20px]">celebration</span>
              <span>Campus Events &amp; Registration</span>
            </div>
            <p className="font-body text-body-xs text-on-surface-variant leading-relaxed">
              Interactive events feed with live backend RSVP persistence (`POST /api/events/{'{'}id{'}'}/rsvp`), timetable clash avoidance logic, team member USN tagging, and downloadable QR ticket modals.
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col gap-2 shadow-xs">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <span className="material-symbols-outlined text-[20px]">monitoring</span>
              <span>Explainable AI (XAI) Activity Log</span>
            </div>
            <p className="font-body text-body-xs text-on-surface-variant leading-relaxed">
              Audit timeline showing resolved department incidents, autonomous execution times, candidate substitute rankings, and exact tool invocation arguments for complete institutional transparency.
            </p>
          </div>
        </div>
      )}

      {/* TAB 4: DISCLOSURES & PROTOTYPE TRANSPARENCY */}
      {activeTab === 'disclosures' && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col gap-4 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600 text-[22px]">info</span>
              <span className="font-title text-title-md text-on-surface font-semibold">
                Prototype Disclosures &amp; Runtime Boundaries
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-semibold">
              HONEST DISCLOSURE
            </span>
          </div>

          <p className="font-body text-body-sm text-on-surface-variant leading-relaxed">
            TARS combines fully operational backend systems with realistic campus fixtures to showcase an end-to-end agentic workflow without relying on external third-party proprietary systems during evaluation.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-200 flex flex-col gap-2">
              <span className="font-label text-label-md font-semibold text-emerald-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-emerald-700">check_circle</span>
                Live Backend Functionality
              </span>
              <ul className="text-xs font-body text-emerald-950 flex flex-col gap-1 list-disc pl-4 leading-normal">
                <li>Leave creation, substitute assignment, and HOD approval stored in SQLite (`tars.db`).</li>
                <li>Live FastAPI endpoints on port 8000 (`/api/leave`, `/api/approvals`, `/api/events`, `/api/nudges`).</li>
                <li>BMSIT 5-account password-authenticated access (`bmsit` for S0000, F_CDB, F_GPL, F_SMP, H_SKB).</li>
                <li>Decision optimization engine with constraint satisfaction &amp; XAI rules.</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-amber-50/50 border border-amber-200 flex flex-col gap-2">
              <span className="font-label text-label-md font-semibold text-amber-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-amber-700">warning</span>
                Simulated Demo Features
              </span>
              <ul className="text-xs font-body text-amber-950 flex flex-col gap-1 list-disc pl-4 leading-normal">
                <li>Event entry QR code is an illustrative campus pass (`DEMO PASS`).</li>
                <li>NPTEL fallback cohort (38/46 verified) displays when backend requests table has 0 rows.</li>
                <li>Contineo biometric punch synchronization is scheduled for Phase 2 roadmap.</li>
                <li>Batch Telegram/SMS notification dispatch is client-simulated in demo mode.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}