import React, { useState } from 'react';
import { useTars } from '../../../context/TarsContext';

interface ClassSession {
  id: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  time: string;
  period: string;
  room: string;
  instructor: string;
  mode: 'in_person' | 'hybrid_planned';
  liveUrl?: string; // Only populated if genuine verified URL is supplied
  description: string;
}

const SCHEDULED_SESSIONS: ClassSession[] = [
  {
    id: 'ses-ai-thu-p4',
    subjectCode: '1BAI103',
    subjectName: 'Intro to AI & Machine Learning',
    section: 'CSE-10',
    time: '11:35 AM – 12:30 PM',
    period: 'P4 (Thursday)',
    room: 'SJB-104',
    instructor: 'Mr. Syed Matheen Pasha (Substitute Cover)',
    mode: 'hybrid_planned',
    description: 'Core lecture covering supervised learning, linear regression cost functions, and gradient descent intuition.',
  },
  {
    id: 'ses-lab-thu-p6p7',
    subjectCode: 'PLC LAB',
    subjectName: 'Python Programming Lab',
    section: 'CSE-10',
    time: '2:20 PM – 4:10 PM',
    period: 'P6–P7 (Thursday)',
    room: 'Lab 511C',
    instructor: 'Mrs. Geetha P L (Lead Lab Faculty)',
    mode: 'in_person',
    description: 'Hands-on laboratory session for file processing, CSV parsing, and Python exception handling exercises.',
  },
  {
    id: 'ses-db-fri-p2',
    subjectCode: '1BCSE102',
    subjectName: 'Database Management Systems',
    section: 'CSE-10',
    time: '9:25 AM – 10:20 AM',
    period: 'P2 (Friday)',
    room: 'SJB-104',
    instructor: 'Prof. Chaitra D B',
    mode: 'hybrid_planned',
    description: 'Relational algebra, projection, Cartesian product, and normalization principles (1NF to 3NF).',
  },
];

export const GoogleMeetView: React.FC = () => {
  const { role } = useTars();
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-surface text-on-surface font-body antialiased">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-10 bg-surface border-b border-outline-variant px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="font-headline text-headline-lg text-on-surface">Google Meet</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 tracking-wide uppercase">
              Beta Preview
            </span>
          </div>
          <p className="font-body text-body-sm text-on-surface-muted">
            Institutional video conferencing and hybrid class scheduling for BMSIT CSE
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-label text-label-sm text-on-surface-muted px-2.5 py-1 rounded bg-surface-container border border-outline-variant">
            Role: <span className="text-on-surface font-semibold capitalize">{role}</span>
          </span>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 px-6 lg:px-8 py-6 max-w-[1200px] w-full mx-auto flex flex-col gap-6">
        {/* Prominent Truthful Disclosure Alert */}
        <section
          aria-label="Beta disclosure"
          className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[22px] text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true">
              info
            </span>
            <div className="flex flex-col gap-0.5 text-xs sm:text-sm">
              <span className="font-semibold">Beta Prototype — Live Google Workspace meeting creation is not active.</span>
              <span className="opacity-90">
                Scheduled hybrid class sessions are listed below for timetable coordination. Meeting URLs are not generated arbitrarily; live Google Meet room provisioning requires institutional Google Workspace admin credentials planned for production release.
              </span>
            </div>
          </div>
        </section>

        {/* Section: Scheduled Class Sessions */}
        <section aria-label="Scheduled sessions" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-title text-title-md text-on-surface">Scheduled Class Sessions</h2>
              <p className="font-body text-body-sm text-on-surface-muted">
                Timetable slots configured for in-person and planned hybrid streaming
              </p>
            </div>
            <span className="text-xs text-on-surface-muted font-medium">
              3 sessions indexed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SCHEDULED_SESSIONS.map((session) => (
              <div
                key={session.id}
                className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col justify-between gap-4 hover:border-primary/40 transition-colors shadow-xs"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-surface-container text-on-surface-variant font-mono">
                      {session.subjectCode}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                        session.mode === 'hybrid_planned'
                          ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                      }`}
                    >
                      {session.mode === 'hybrid_planned' ? 'Hybrid Planned' : 'In-Person Lab'}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-title text-title-sm text-on-surface leading-tight">
                      {session.subjectName}
                    </h3>
                    <p className="font-body text-body-xs text-on-surface-muted mt-1">
                      Section {session.section} · {session.period}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1 text-xs text-on-surface-variant pt-2 border-t border-outline-variant/60">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-on-surface-muted">schedule</span>
                      <span>{session.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-on-surface-muted">meeting_room</span>
                      <span>{session.room}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-on-surface-muted">person</span>
                      <span className="truncate">{session.instructor}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-outline-variant flex items-center justify-between gap-2">
                  {session.liveUrl ? (
                    <a
                      href={session.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-hover transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">videocam</span>
                      <span>Join Meeting</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedSession(session)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors border border-outline-variant cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px] text-primary">visibility</span>
                      <span>Preview Details</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section: Architecture & Prototype Limitations */}
        <section aria-label="Architecture details" className="bg-surface-container-low border border-outline-variant rounded-lg p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">hub</span>
            <h2 className="font-title text-title-sm text-on-surface">How Google Meet Integrates with TARS</h2>
          </div>
          <p className="font-body text-body-sm text-on-surface-variant leading-relaxed">
            In the BMSIT CSE production architecture, TARS synchronizes with Google Calendar via the server service account. When a faculty member is granted approved leave and classes are replanned to substitute teachers, TARS can automatically schedule Google Meet hybrid bridge rooms for students who need remote accessibility.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="p-3 rounded bg-surface-container-lowest border border-outline-variant flex flex-col gap-1">
              <span className="font-semibold text-on-surface">1. Calendar Sync</span>
              <span className="text-on-surface-muted">Events are synced via Google Calendar API with slot and decision IDs.</span>
            </div>
            <div className="p-3 rounded bg-surface-container-lowest border border-outline-variant flex flex-col gap-1">
              <span className="font-semibold text-on-surface">2. Video Bridge (Planned)</span>
              <span className="text-on-surface-muted">Google Meet links will be generated with campus single sign-on access.</span>
            </div>
            <div className="p-3 rounded bg-surface-container-lowest border border-outline-variant flex flex-col gap-1">
              <span className="font-semibold text-on-surface">3. Student Access</span>
              <span className="text-on-surface-muted">Students will see direct join links on their Today schedule feed.</span>
            </div>
          </div>
        </section>
      </main>

      {/* Session Details Preview Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-2xl flex flex-col gap-4 text-on-surface animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-outline-variant pb-3">
              <div>
                <span className="text-[11px] font-mono text-primary font-bold">
                  {selectedSession.subjectCode} · {selectedSession.section}
                </span>
                <h3 className="font-title text-title-md text-on-surface">
                  {selectedSession.subjectName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="text-on-surface-muted hover:text-on-surface p-1 rounded hover:bg-surface-container transition-colors"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2.5 text-xs">
              <div className="p-3 rounded bg-surface-container-low border border-outline-variant flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="text-on-surface-muted">Scheduled Slot:</span>
                  <span className="font-semibold text-on-surface">{selectedSession.period}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-muted">Time:</span>
                  <span className="font-semibold text-on-surface">{selectedSession.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-muted">Assigned Room:</span>
                  <span className="font-semibold text-on-surface">{selectedSession.room}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-muted">Lead Faculty:</span>
                  <span className="font-semibold text-on-surface">{selectedSession.instructor}</span>
                </div>
              </div>

              <div className="p-3 rounded bg-surface-container text-on-surface-variant flex flex-col gap-1">
                <span className="font-semibold text-on-surface">Course Context:</span>
                <span>{selectedSession.description}</span>
              </div>

              {/* Explicit Truthful Notice */}
              <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-start gap-2 text-[11px]">
                <span className="material-symbols-outlined text-[15px] shrink-0 mt-0.5">lock</span>
                <span>
                  Live video conferencing link is not active for this preview. Live meeting URL generation will activate upon deployment with domain-verified Google Workspace service credentials.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 rounded text-xs font-semibold bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
