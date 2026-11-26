import React from 'react';
import { useTars } from '../../context/TarsContext';

export const TodayView: React.FC = () => {
  const {
    hasActiveLeave,
    hodApproved,
    hodApprovalTime,
    backendStatus,
    liveTimetable,
    timetableStatus,
    setCurrentView,
  } = useTars();

  const isLiveMode = timetableStatus === 'live';
  const isMockMode = timetableStatus === 'mock';

  const liveMatchP4 = liveTimetable?.find(
    (s) => (s.day === 'THU' || s.day === 'thu') && (s.period === 4 || s.period === '4' || s.period === 'P4')
  );
  const isP4Replanned = isLiveMode
    ? liveMatchP4?.status === 'replanned'
    : isMockMode && hasActiveLeave && hodApproved;

  const liveMatchLab = liveTimetable?.find(
    (s) => (s.day === 'THU' || s.day === 'thu') && (s.period === '6-7' || s.period === 6 || s.period === 7 || s.period === 'P6-P7')
  );
  const isLabReplanned = isLiveMode
    ? liveMatchLab?.status === 'replanned'
    : isMockMode && hasActiveLeave && hodApproved;

  const isAnyReplanned = isP4Replanned || isLabReplanned;

  return (
    <div className="flex-1 min-w-0 flex flex-col font-body antialiased bg-surface text-on-surface">
      {/* Top Bar */}
      <header className="sticky top-0 z-10 bg-surface border-b border-outline-variant px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <p className="font-label text-label-sm text-on-surface-muted" data-design-text-token="label-sm">
            Thursday, 26 November
          </p>
          <h1 className="font-headline text-headline-lg text-on-surface text-balance" data-design-text-token="headline-lg">
            Good morning, Shreyansh
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Ask TARS searchbar */}
          <form
            role="search"
            className="relative flex items-center w-64 sm:w-80 bg-surface-container-lowest border border-outline-variant rounded-full px-3.5 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-soft transition-colors duration-state-change"
            onSubmit={(e) => e.preventDefault()}
          >
            <span className="material-symbols-outlined text-[18px] text-primary mr-2" aria-hidden="true">
              auto_awesome
            </span>
            <input
              id="tars-search"
              type="search"
              aria-label="Ask TARS anything"
              placeholder="Ask TARS anything…"
              className="w-full bg-transparent border-0 p-0 text-body-md text-on-surface placeholder:text-on-surface-muted focus:ring-0 focus:outline-none"
            />
            <kbd className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-label text-label-sm border border-outline-variant shrink-0">
              ⌘K
            </kbd>
          </form>

          {/* Backend Status Badge */}
          {backendStatus === 'connected' ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-label text-label-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Backend: Connected</span>
            </div>
          ) : (
            <div
              title="Backend offline at http://localhost:8000. Running in high-fidelity interactive demo mode."
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-label text-label-sm"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Demo Mode (Backend Offline)</span>
            </div>
          )}

          {/* Notifications Icon Button */}
          <button
            type="button"
            aria-label="Notifications"
            className="relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-surface-container-lowest text-on-surface-variant border border-outline-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-state-change shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              notifications
            </span>
            <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-primary" aria-hidden="true"></span>
          </button>
        </div>
      </header>

      {/* Dashboard Main Content */}
      <main className="flex-1 px-6 lg:px-8 py-6 max-w-[1360px] w-full mx-auto flex flex-col gap-5">
        {/* Row 2: Today's Horizontal Timeline (8:30 AM - 4:10 PM) */}
        <section aria-label="Today's schedule">
          <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col gap-5">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="font-headline text-headline-md text-on-surface" data-design-text-token="headline-md">
                  Today's schedule
                </h2>
                <span className="font-body text-body-sm text-on-surface-muted tabular-nums" data-design-text-token="body-sm">
                  8:30 AM – 4:10 PM · Section CSE-10
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-soft text-primary border border-subject-python-border font-label text-label-sm tabular-nums" data-design-text-token="label-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true"></span>
                Now 11:05
              </span>
            </header>

            {/* Horizontal Timeline Track */}
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[1040px] flex flex-col gap-2">
                <div className="relative h-36 rounded-md bg-surface-container-low border border-outline-variant px-2 py-3">
                  {/* Now 11:05 vertical marker */}
                  <div
                    className="absolute top-0 bottom-0 z-20 flex flex-col items-center pointer-events-none"
                    style={{ left: '38.5%' }}
                    aria-hidden="true"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary -mt-1"></div>
                    <div className="w-px flex-1 bg-primary"></div>
                  </div>

                  {/* 8:30–9:25 Chemistry · SJB-104 (Done) */}
                  <div
                    className="absolute top-3 bottom-3 rounded bg-subject-chem-bg/60 border border-subject-chem-border/60 px-3 py-2.5 flex flex-col justify-between overflow-hidden"
                    style={{ left: '0.5%', width: '11.8%' }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded bg-surface-container-lowest/60 border border-subject-chem-border/60 text-subject-chem-text shrink-0">
                        <span className="material-symbols-outlined text-[18px]">science</span>
                      </span>
                      <span className="material-symbols-outlined text-[16px] text-subject-chem-text" aria-label="Completed">
                        check_circle
                      </span>
                    </div>
                    <div>
                      <p className="font-body font-semibold text-body-lg text-on-surface-variant leading-tight">Chemistry</p>
                      <p className="font-body text-label-sm text-on-surface-variant tabular-nums leading-tight">8:30–9:25</p>
                      <p className="font-body text-label-sm text-on-surface-variant leading-tight">SJB-104</p>
                    </div>
                  </div>

                  {/* 9:25–10:20 Constitution (ICO) · SJB-104 (Done) */}
                  <div
                    className="absolute top-3 bottom-3 rounded bg-subject-english-bg/60 border border-subject-english-border/60 px-3 py-2.5 flex flex-col justify-between overflow-hidden"
                    style={{ left: '13.0%', width: '12.2%' }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded bg-surface-container-lowest/60 border border-subject-english-border/60 text-subject-english-text shrink-0">
                        <span className="material-symbols-outlined text-[18px]">balance</span>
                      </span>
                      <span className="material-symbols-outlined text-[16px] text-subject-english-text" aria-label="Completed">
                        check_circle
                      </span>
                    </div>
                    <div>
                      <p className="font-body font-semibold text-body-lg text-on-surface-variant leading-tight">Constitution</p>
                      <p className="font-body text-label-sm text-on-surface-variant tabular-nums leading-tight">9:25–10:20</p>
                      <p className="font-body text-label-sm text-on-surface-variant leading-tight">SJB-104</p>
                    </div>
                  </div>

                  {/* 10:20–10:40 Tea break */}
                  <div
                    className="absolute top-3 bottom-3 rounded bg-break-bg border border-break-border px-2 py-2 flex flex-col justify-center items-center text-center overflow-hidden"
                    style={{ left: '25.9%', width: '4.5%' }}
                    title="Tea break · 10:20–10:40"
                  >
                    <p className="font-label text-label-sm text-break-text leading-tight">Tea</p>
                  </div>

                  {/* 10:40–11:35 Maths · MATLAB (CURRENT) */}
                  <div
                    className="absolute top-3 bottom-3 z-10 -translate-y-0.5 rounded bg-subject-maths-bg border border-subject-maths-text px-3 py-2.5 flex flex-col justify-between overflow-hidden shadow-md"
                    style={{ left: '31.1%', width: '16.0%' }}
                  >
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded bg-surface-container-lowest border border-subject-maths-border text-subject-maths-text shrink-0">
                      <span className="material-symbols-outlined text-[18px]">functions</span>
                    </span>
                    <div>
                      <p className="font-body font-semibold text-body-lg text-subject-maths-text leading-tight">Maths · MATLAB</p>
                      <p className="font-body text-label-sm text-subject-maths-text tabular-nums leading-tight">10:40–11:35</p>
                      <p className="font-body text-label-sm text-subject-maths-text leading-tight">Shakuntala Devi lab</p>
                    </div>
                  </div>

                  {/* 11:35–12:30 Intro to AI · SJB-104 (P4 - Dynamically reflects HOD Approval) */}
                  <div
                    className={`absolute top-3 bottom-3 rounded px-3 py-2.5 flex flex-col justify-between overflow-hidden transition-all ${
                      isP4Replanned
                        ? 'bg-status-done-bg border-2 border-status-done shadow-md'
                        : 'bg-subject-ai-bg border border-subject-ai-border'
                    }`}
                    style={{ left: '47.8%', width: '13.0%' }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`inline-flex items-center justify-center w-9 h-9 rounded bg-surface-container-lowest border shrink-0 ${
                          isP4Replanned
                            ? 'border-status-done text-status-done'
                            : 'border-subject-ai-border text-subject-ai-text'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {isP4Replanned ? 'person_check' : 'psychology'}
                        </span>
                      </span>
                      {isP4Replanned && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-status-done text-white text-[9px] font-bold tracking-wider uppercase">
                          Cover
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-body font-semibold text-body-lg text-on-surface leading-tight">Intro to AI</p>
                      <p className="font-body text-label-sm text-on-surface tabular-nums leading-tight">11:35–12:30</p>
                      <p className="font-body text-label-sm font-medium text-on-surface truncate leading-tight">
                        {isP4Replanned
                          ? (liveMatchP4?.faculty_name ? `${liveMatchP4.faculty_name} (HOD approved)` : 'Mr. Syed Matheen Pasha (HOD approved)')
                          : 'Prof. Chaitra D B'}
                      </p>
                    </div>
                  </div>

                  {/* 12:30–1:25 P5 Python (Unconfirmed — Data Mismatch, Occupied) */}
                  <div
                    className="absolute top-3 bottom-3 rounded bg-amber-50/80 border border-amber-200 px-1.5 py-1.5 flex flex-col justify-center items-center text-center overflow-hidden"
                    style={{ left: '61.5%', width: '7.0%' }}
                    title="12:30–1:25 · Python (Unconfirmed — Data Mismatch) · SJB-104 · Mrs. Geetha P L (Busy)"
                  >
                    <p className="font-label text-[11px] font-semibold text-amber-900 leading-tight">P5 (Busy)</p>
                    <p className="font-body text-[10px] text-amber-800 tabular-nums leading-tight mt-0.5">Unconfirmed</p>
                  </div>

                  {/* 1:25–2:20 Lunch */}
                  <div
                    className="absolute top-3 bottom-3 rounded bg-break-bg border border-break-border px-2 py-2 flex flex-col justify-center items-center text-center overflow-hidden"
                    style={{ left: '69.2%', width: '7.0%' }}
                  >
                    <p className="font-label text-label-sm text-break-text leading-tight">Lunch</p>
                    <p className="font-body text-label-sm text-break-text tabular-nums leading-tight mt-0.5">1:25</p>
                  </div>

                  {/* 2:20–4:10 Python lab · 511C (P6-P7 - Dynamically reflects HOD Approval) */}
                  <div
                    className={`absolute top-3 bottom-3 rounded px-3 py-2.5 flex flex-col justify-between overflow-hidden transition-all ${
                      isLabReplanned
                        ? 'bg-status-done-bg border-2 border-status-done shadow-md'
                        : 'bg-subject-python-bg border border-subject-python-border'
                    }`}
                    style={{ left: '76.9%', width: '22.6%' }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`inline-flex items-center justify-center w-9 h-9 rounded bg-surface-container-lowest border shrink-0 ${
                          isLabReplanned
                            ? 'border-status-done text-status-done'
                            : 'border-subject-python-border text-subject-python-text'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {isLabReplanned ? 'verified_user' : 'data_object'}
                        </span>
                      </span>
                      {isLabReplanned && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-status-done text-white text-[10px] font-bold tracking-wider uppercase">
                          HOD Approved
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-body font-semibold text-body-lg text-on-surface leading-tight">Python lab</p>
                      <p className="font-body text-label-sm text-on-surface tabular-nums leading-tight">2:20–4:10 · 511C</p>
                      <p className="font-body text-label-sm font-medium text-on-surface truncate leading-tight">
                        {isLabReplanned
                          ? (liveMatchLab?.faculty_name ? `${liveMatchLab.faculty_name} (HOD approved · Pending confirmation)` : 'Mrs. Geetha P L (HOD approved · Pending confirmation)')
                          : 'Prof. Chaitra D B'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Time Axis Labels */}
                <div className="relative h-5 font-label text-label-sm text-on-surface-muted tabular-nums">
                  <span className="absolute left-0">8:30 AM</span>
                  <span className="absolute" style={{ left: '19.6%' }}>
                    10:00
                  </span>
                  <span className="absolute" style={{ left: '39.1%' }}>
                    11:30
                  </span>
                  <span className="absolute" style={{ left: '58.7%' }}>
                    1:00 PM
                  </span>
                  <span className="absolute" style={{ left: '78.3%' }}>
                    2:30
                  </span>
                  <span className="absolute right-0">4:10 PM</span>
                </div>
              </div>
            </div>
          </article>
        </section>

        {/* Row 1: TARS Brief (left wide) + Needs you (2) (right) */}
        <section aria-label="Morning brief and action items" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Row 1 Left: TARS Brief */}
          <article className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col justify-between gap-5 h-full">
            <div className="flex flex-col gap-4">
              <header className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-soft text-primary">
                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                  </span>
                  <h2 className="font-headline text-headline-md text-on-surface tabular-nums" data-design-text-token="headline-md">
                    {isAnyReplanned ? 'TARS Autonomous Update · Verified' : 'TARS brief · 8:15 AM'}
                  </h2>
                </div>
                {isAnyReplanned && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-status-done-bg text-status-done border border-status-done-border font-label text-label-sm font-semibold">
                    HOD approved · Substitute confirmation pending
                  </span>
                )}
              </header>

              {isAnyReplanned ? (
                <div className="flex flex-col gap-2 bg-emerald-50/60 border border-emerald-200/80 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">verified</span>
                    <span>Prof. Chaitra D B is on approved leave today</span>
                  </div>
                  <p className="font-body text-body-md text-emerald-900 leading-relaxed">
                    TARS re-planned your timetable: <strong>P4 Intro to AI (11:35 AM, SJB-104)</strong> has been assigned to{' '}
                    <strong>{liveMatchP4?.faculty_name || 'Mr. Syed Matheen Pasha'}</strong>. <strong>P6–P7 Python Lab (2:20 PM, 511C)</strong> is assigned to{' '}
                    <strong>{liveMatchLab?.faculty_name || 'Mrs. Geetha P L'}</strong> (HOD approved · Substitute confirmation pending).
                  </p>
                  <p className="text-[11px] text-emerald-700/90 font-medium">
                    HOD approved · Substitute confirmation pending (Signed off by HOD Dr. Surekha K B at {hodApprovalTime || '11:45 AM'}).
                  </p>
                </div>
              ) : (
                <p className="font-body text-body-lg text-on-surface text-pretty max-w-prose" data-design-text-token="body-lg">
                  Your P4 Intro to AI is with Prof. Chaitra D B today at 11:35 in SJB-104, your NPTEL certificate is due 5
                  Dec, and Chemistry attendance is at 72% — attend all Chemistry classes this week to get back above 75%.
                </p>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-outline-variant">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentView('schedule')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant border border-outline-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
                >
                  <span className="font-label text-label-md">My free periods</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('events')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant border border-outline-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
                >
                  <span className="font-label text-label-md">Events that fit my day</span>
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant border border-outline-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
                >
                  <span className="font-label text-label-md">Attendance</span>
                </button>
              </div>
            </footer>
          </article>

          {/* Row 1 Right: Needs you (2) */}
          <article
            className="lg:col-span-5 bg-surface-container-lowest border border-primary rounded-lg p-6 flex flex-col justify-between gap-5 h-full shadow-sm"
          >
            <header className="flex items-center justify-between gap-3">
              <h2 className="font-headline text-headline-md text-on-surface tabular-nums" data-design-text-token="headline-md">
                Needs you (2)
              </h2>
            </header>

            <div className="flex items-center justify-between gap-3 p-3.5 rounded-md bg-surface-container-low border border-outline-variant">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-primary-soft border border-subject-python-border text-primary shrink-0">
                  <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
                </span>
                <div className="min-w-0">
                  <p className="font-title text-title-sm text-on-surface tabular-nums text-pretty" data-design-text-token="title-sm">
                    Upload NPTEL certificate · due 5 Dec
                  </p>
                  <p className="font-body text-body-sm text-on-surface-muted mt-0.5" data-design-text-token="body-sm">
                    The Joy of Computing using Python · 12-week course
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => alert('Opening NPTEL Certificate uploader...')}
                className="shrink-0 inline-flex items-center justify-center px-3.5 py-2 rounded bg-primary text-on-primary hover:bg-primary-hover transition-colors cursor-pointer"
              >
                <span className="font-label text-label-md">Upload</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => alert('Opening Python lab record checklist...')}
                className="font-label text-label-sm text-on-surface-muted hover:text-primary transition-colors flex items-center gap-2 cursor-pointer text-left"
              >
                <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-subject-python-bg border border-subject-python-border text-subject-python-text shrink-0">
                  <span className="material-symbols-outlined text-[14px]">data_object</span>
                </span>
                <span>+1 more · Python lab record due Fri →</span>
              </button>
            </div>
          </article>
        </section>

        {/* Row 3: My attendance (left) + Events that fit your free time (middle) + Coming up (right) */}
        <section aria-label="Attendance, fitting events, and upcoming dates" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Row 3 Left: My attendance */}
          <article className="lg:col-span-5 bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col gap-5 h-full">
            <header className="flex items-center justify-between gap-3">
              <h2 className="font-headline text-headline-md text-on-surface" data-design-text-token="headline-md">
                My attendance
              </h2>
              <span className="font-label text-label-sm text-on-surface-muted">
                Section CSE-10
              </span>
            </header>

            <ul className="flex flex-col divide-y divide-outline-variant">
              {/* Chemistry 72% */}
              <li className="py-3 first:pt-0 last:pb-0 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-subject-chem-bg border border-subject-chem-border text-subject-chem-text shrink-0">
                      <span className="material-symbols-outlined text-[18px]">science</span>
                    </span>
                    <span className="font-title text-title-sm text-on-surface truncate" data-design-text-token="title-sm">
                      Chemistry (CHE)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-status-attention-bg text-status-attention border border-status-attention-border font-label text-label-sm">
                      Below 75%
                    </span>
                    <span className="font-title text-title-sm text-status-attention tabular-nums" data-design-text-token="title-sm">
                      72%
                    </span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                  <div className="h-full rounded-full bg-status-attention" style={{ width: '72%' }}></div>
                </div>
                <p className="font-body text-body-sm text-on-surface-muted flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-primary">auto_awesome</span>
                  <span>Attend 3 more classes to reach 75%</span>
                </p>
              </li>

              {/* Python (PLC) 88% */}
              <li className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-subject-python-bg border border-subject-python-border text-subject-python-text shrink-0">
                    <span className="material-symbols-outlined text-[18px]">data_object</span>
                  </span>
                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-body text-body-sm text-on-surface truncate">Python (PLC)</span>
                      <span className="font-label text-label-sm text-on-surface tabular-nums">88%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: '88%' }}></div>
                    </div>
                  </div>
                </div>
              </li>

              {/* Intro to AI (ETC-I) 84% */}
              <li className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-subject-ai-bg border border-subject-ai-border text-subject-ai-text shrink-0">
                    <span className="material-symbols-outlined text-[18px]">psychology</span>
                  </span>
                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-body text-body-sm text-on-surface truncate">Intro to AI (ETC-I)</span>
                      <span className="font-label text-label-sm text-on-surface tabular-nums">84%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: '84%' }}></div>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </article>

          {/* Row 3 Middle: Events that fit your free time */}
          <article className="lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col justify-between gap-4 h-full">
            <header className="flex items-center justify-between gap-3">
              <h2 className="font-headline text-headline-md text-on-surface" data-design-text-token="headline-md">
                Events for free time
              </h2>
              <span className="font-label text-label-sm text-primary font-medium">Self-study block (Evening)</span>
            </header>

            <div className="p-3.5 rounded-md bg-surface-container-low border border-outline-variant flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary-soft text-primary font-label text-[11px] font-semibold">
                  Hackathon
                </span>
                <span className="text-xs text-on-surface-muted tabular-nums">4:30 PM Today</span>
              </div>
              <p className="font-title text-title-sm text-on-surface font-semibold">
                ACM Web3 Hackathon Kickoff
              </p>
              <p className="font-body text-body-sm text-on-surface-muted">
                Student Amphitheater · Evening session
              </p>
            </div>

            <button
              type="button"
              onClick={() => setCurrentView('events')}
              className="w-full py-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label text-label-md transition-colors text-center cursor-pointer"
            >
              Explore all campus events →
            </button>
          </article>

          {/* Row 3 Right: Coming up */}
          <article className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col justify-between gap-4 h-full">
            <header className="flex items-center justify-between gap-3">
              <h2 className="font-headline text-headline-md text-on-surface" data-design-text-token="headline-md">
                Coming up
              </h2>
            </header>

            <div className="flex flex-col gap-3">
              <div className="p-3 rounded-md bg-surface-container-low border border-outline-variant flex flex-col gap-1">
                <span className="font-label text-[11px] text-amber-700 font-semibold">Tomorrow · Fri</span>
                <p className="font-title text-title-sm text-on-surface">Python Lab Record</p>
                <p className="text-xs text-on-surface-muted">Submission to Lab In-charge</p>
              </div>

              <div className="p-3 rounded-md bg-surface-container-low border border-outline-variant flex flex-col gap-1">
                <span className="font-label text-[11px] text-primary font-semibold">5 Dec · Next Week</span>
                <p className="font-title text-title-sm text-on-surface">NPTEL Certificate</p>
                <p className="text-xs text-on-surface-muted">Portal deadline</p>
              </div>
            </div>

            <p className="text-xs text-on-surface-muted text-center pt-1">
              Synced with BMSIT Academic Calendar
            </p>
          </article>
        </section>
      </main>
    </div>
  );
};

export default TodayView;
