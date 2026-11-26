import React, { useState } from 'react';
import { useTars } from '../../../context/TarsContext';

export const ApprovalsView: React.FC = () => {
  const {
    hasActiveLeave,
    leaveDate,
    leaveType,
    labCovered,
    aiCovered,
    simulatedAiStatus,
    simulatedLabStatus,
    hodApproved,
    hodApprovalTime,
    approveHod,
    rejectHod,
    backendDecisionId,
    resetDemo,
  } = useTars();

  const [showReasoning, setShowReasoning] = useState(false);
  const [selectedRange, setSelectedRange] = useState<'Today' | '7D' | 'Semester'>('Today');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const allClassesCovered = labCovered && aiCovered;

  const handleApprove = async () => {
    setError(null);
    setIsBusy(true);
    try {
      if (!backendDecisionId) {
        throw new Error('Cannot approve: No active backend decision ID.');
      }
      await approveHod(backendDecisionId, note);
    } catch (err: any) {
      setError(err?.message || 'Approval failed');
    } finally {
      setIsBusy(false);
    }
  };

  const handleReject = async () => {
    setError(null);
    setIsBusy(true);
    try {
      if (!backendDecisionId) {
        throw new Error('Cannot reject: No active backend decision ID.');
      }
      await rejectHod(backendDecisionId, note);
    } catch (err: any) {
      setError(err?.message || 'Rejection failed');
    } finally {
      setIsBusy(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset demo baseline? This will restore 46 timetable slots and clear all decisions.')) {
      return;
    }
    setError(null);
    setIsBusy(true);
    setResetSuccess(null);
    try {
      await resetDemo();
      setResetSuccess('Demo baseline cleanly restored (46 slots active, decisions cleared).');
    } catch (err: any) {
      setError(err?.message || 'Demo reset failed');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-surface text-on-surface font-body antialiased">
      {/* Top Bar (Exact Stitch Approvals Header) */}
      <header className="sticky top-0 z-10 bg-surface border-b border-outline-variant px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-headline text-headline-lg text-on-surface" data-design-text-token="headline-lg">
            Approvals
          </h1>
          {/* Waiting Badge (Counts live pending approvals only; excludes static demo fixtures) */}
          <span
            role="status"
            className="inline-flex items-center px-2.5 py-1 rounded-full bg-status-waiting-bg text-status-waiting border border-status-waiting-border tabular-nums font-label text-label-sm"
          >
            {hasActiveLeave && !hodApproved ? '1 waiting' : '0 waiting'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Chips */}
          <div className="flex items-center gap-1.5" role="group" aria-label="Date range">
            {(['Today', '7D', 'Semester'] as const).map((range) => {
              const isSelected = selectedRange === range;
              return (
                <button
                  key={range}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedRange(range)}
                  className={`range-chip inline-flex items-center px-3 py-1.5 rounded-full transition-colors duration-state-change font-label text-label-md cursor-pointer ${
                    isSelected
                      ? 'bg-primary-soft text-primary border border-subject-python-border'
                      : 'bg-surface-container-low text-on-surface-variant border border-outline-variant hover:bg-surface-container'
                  }`}
                >
                  {range}
                </button>
              );
            })}
          </div>

          {/* COMPONENT: searchbar-standard */}
          <form
            role="search"
            onSubmit={(e) => e.preventDefault()}
            className="relative flex items-center w-64 bg-surface-container-lowest border border-outline-variant rounded-full px-3.5 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-soft transition-colors duration-state-change"
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

          {/* COMPONENT: button-icon */}
          <button
            type="button"
            onClick={handleReset}
            disabled={isBusy}
            title="Reset demo baseline"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-low text-on-surface border border-outline-variant hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-600 transition-colors text-xs font-medium cursor-pointer disabled:opacity-50 shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            <span>{isBusy ? 'Resetting...' : 'Reset Demo'}</span>
          </button>

          <button
            type="button"
            aria-label="Notifications"
            className="relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-surface-container-lowest text-on-surface-variant border border-outline-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-state-change ease-state-change shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              notifications
            </span>
            <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-primary" aria-hidden="true"></span>
          </button>
        </div>
      </header>

      {/* Main Grid (Exact Google Stitch Layout) */}
      <main className="flex-1 px-6 lg:px-8 py-6 max-w-[1360px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Alerts */}
        <div className="lg:col-span-12 flex flex-col gap-2">
          {error && (
            <div className="p-3.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-body-sm flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-xs font-semibold underline">Dismiss</button>
            </div>
          )}
          {resetSuccess && (
            <div className="p-3.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-body-sm flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>{resetSuccess}</span>
              </div>
              <button onClick={() => setResetSuccess(null)} className="text-xs font-semibold underline">Dismiss</button>
            </div>
          )}
        </div>

        {/* Left Column: Approval Cards */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* Approval Card 1 (Prof. Chaitra D B - Ready to approve or Approved) */}
          {hasActiveLeave && (
            <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col gap-4 shadow-2xs">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary-soft text-primary font-label text-label-sm shrink-0" data-design-text-token="label-sm">
                    CD
                  </span>
                  <h2 className="font-title text-title-md text-on-surface tabular-nums" data-design-text-token="title-md">
                    Prof. Chaitra D B · Leave · {leaveDate} · {leaveType}
                  </h2>
                </div>
                {hodApproved ? (
                  <span
                    role="status"
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-status-done-bg text-status-done border border-status-done-border font-label text-label-sm"
                  >
                    Approved
                  </span>
                ) : allClassesCovered ? (
                  <span
                    role="status"
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-status-done-bg text-status-done border border-status-done-border font-label text-label-sm"
                  >
                    Ready
                  </span>
                ) : (
                  <span
                    role="status"
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-status-waiting-bg text-status-waiting border border-status-waiting-border font-label text-label-sm"
                  >
                    Awaiting substitute
                  </span>
                )}
              </header>

              {/* Class Cover Rows */}
              <div className="flex flex-col divide-y divide-outline-variant rounded-md border border-outline-variant bg-surface-container-low">
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <p className="font-body text-body-md text-on-surface tabular-nums" data-design-text-token="body-md">
                    {aiCovered
                      ? 'Intro to AI · P4 → Mr. Syed Matheen Pasha (accepted)'
                      : simulatedAiStatus === 'declined'
                      ? 'Intro to AI · P4 → Declined by Mr. Syed Matheen Pasha (SMP)'
                      : 'Intro to AI · P4 → Waiting for Mr. Syed Matheen Pasha (SMP)'}
                  </p>
                  <span
                    className={`material-symbols-outlined text-[18px] shrink-0 ${
                      aiCovered
                        ? 'text-status-done'
                        : simulatedAiStatus === 'declined'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-status-waiting animate-spin'
                    }`}
                    aria-hidden="true"
                  >
                    {aiCovered ? 'check_circle' : simulatedAiStatus === 'declined' ? 'cancel' : 'schedule'}
                  </span>
                </div>
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <p className="font-body text-body-md text-on-surface tabular-nums" data-design-text-token="body-md">
                    {labCovered
                      ? 'Python lab · P6–P7 → Mrs. Geetha P L (accepted)'
                      : simulatedLabStatus === 'declined'
                      ? 'Python lab · P6–P7 → Declined by Mrs. Geetha P L (GPL)'
                      : 'Python lab · P6–P7 → Waiting for Mrs. Geetha P L (GPL)'}
                  </p>
                  <span
                    className={`material-symbols-outlined text-[18px] shrink-0 ${
                      labCovered
                        ? 'text-status-done'
                        : simulatedLabStatus === 'declined'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-status-waiting animate-spin'
                    }`}
                    aria-hidden="true"
                  >
                    {labCovered ? 'check_circle' : simulatedLabStatus === 'declined' ? 'cancel' : 'schedule'}
                  </span>
                </div>
              </div>

              {/* Insight Row */}
              {allClassesCovered ? (
                <div className="px-4 py-2.5 rounded-md bg-status-done-bg border border-status-done-border flex items-center gap-2.5 text-status-done">
                  <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">
                    verified
                  </span>
                  <p className="font-label text-label-md" data-design-text-token="label-md">
                    All classes covered · Subject-eligible substitutes assigned
                  </p>
                </div>
              ) : simulatedAiStatus === 'declined' || simulatedLabStatus === 'declined' ? (
                <div className="px-4 py-2.5 rounded-md bg-rose-500/10 border border-rose-500/20 flex items-center gap-2.5 text-rose-700 dark:text-rose-300">
                  <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">
                    error
                  </span>
                  <p className="font-label text-label-md" data-design-text-token="label-md">
                    Substitute declined. Approval blocked until all classes covered.
                  </p>
                </div>
              ) : (
                <div className="px-4 py-2.5 rounded-md bg-status-waiting-bg border border-status-waiting-border flex items-center gap-2.5 text-status-waiting">
                  <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">
                    schedule
                  </span>
                  <p className="font-label text-label-md" data-design-text-token="label-md">
                    Awaiting substitute confirmation. {(aiCovered ? 1 : 0) + (labCovered ? 1 : 0)} of 2 classes covered.
                  </p>
                </div>
              )}

              {/* Collapsible TARS Reasoning */}
              <div>
                <button
                  id="btn-toggle-reasoning"
                  type="button"
                  aria-expanded={showReasoning}
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="inline-flex items-center gap-1.5 font-label text-label-sm text-on-surface-muted hover:text-primary transition-colors duration-state-change cursor-pointer"
                  data-design-text-token="label-sm"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    {showReasoning ? 'expand_less' : 'expand_more'}
                  </span>
                  <span>See TARS reasoning</span>
                </button>
                {showReasoning && (
                  <div id="tars-reasoning-panel" className="mt-2.5 p-3.5 rounded-md bg-surface-container-low border border-outline-variant">
                    <p className="font-body text-body-sm text-on-surface-variant text-pretty" data-design-text-token="body-sm">
                      Mrs. Geetha P L co-teaches CSE-10 Python lab and is free Thu P6–P7. Mr. Syed Matheen Pasha has handled Intro to AI tutorials for CSE-10 and has the lowest weekly load (11 periods). Both confirmed in app.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Row */}
              <footer className="flex flex-wrap items-center gap-3 pt-1">
                {hodApproved ? (
                  <div className="w-full px-3.5 py-2.5 rounded bg-status-done-bg border border-status-done-border text-status-done flex items-center justify-between gap-2">
                    <span className="font-label text-label-md">
                      Approved by Dr. Surekha K B (HOD, CSE) · Approved at {hodApprovalTime || '11:42 AM'} · HOD approved · Substitute confirmation pending
                    </span>
                    <span className="font-label text-label-sm bg-white px-2 py-0.5 rounded border border-status-done-border font-bold">
                      Locked
                    </span>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={!allClassesCovered}
                      className={`inline-flex items-center justify-center px-6 py-2.5 rounded transition-colors duration-state-change cursor-pointer ${
                        allClassesCovered
                          ? 'bg-primary text-on-primary hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary'
                          : 'bg-surface-container text-on-surface-muted cursor-not-allowed border border-outline-variant'
                      }`}
                    >
                      <span className="font-label text-label-lg" data-design-text-token="label-lg">
                        Approve
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleReject}
                      className="inline-flex items-center justify-center px-5 py-2.5 rounded bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-state-change cursor-pointer"
                    >
                      <span className="font-label text-label-lg" data-design-text-token="label-lg">
                        Reject
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowNoteInput(!showNoteInput)}
                      className="inline-flex items-center justify-center px-3 py-2.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors duration-state-change cursor-pointer"
                    >
                      <span className="font-label text-label-md" data-design-text-token="label-md">
                        {showNoteInput ? 'Cancel note' : 'Add note'}
                      </span>
                    </button>

                    {showNoteInput && (
                      <div className="w-full mt-2">
                        <input
                          type="text"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Add a remark (e.g. Approved. Please ensure tutorial sheets are shared)"
                          className="w-full text-xs p-2.5 rounded border border-outline-variant bg-surface-container-lowest focus:outline-none focus:border-primary"
                        />
                        <p className="text-[11px] text-on-surface-muted italic mt-1">(Local note only — not stored by backend API)</p>
                      </div>
                    )}
                  </>
                )}
              </footer>
            </article>
          )}

          {/* Approval Card 2 (Amber — demo preview fixture, straight from Stitch) */}
          <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col gap-4 shadow-2xs">
            {/* Demo Preview Header Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded bg-surface-container-low border border-outline-variant">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label text-[11px] font-bold tracking-wider uppercase">
                DEMO PREVIEW — NOT LIVE
              </span>
              <span className="text-[11px] text-on-surface-muted italic">
                Illustrative scenario without an active backend decision
              </span>
            </div>

            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-status-waiting-bg text-status-waiting border border-status-waiting-border font-label text-label-sm shrink-0" data-design-text-token="label-sm">
                  GP
                </span>
                <h2 className="font-title text-title-md text-on-surface tabular-nums" data-design-text-token="title-md">
                  Mrs. Rekha Menon · Leave · Mon 7 Dec
                </h2>
              </div>
              <span
                role="status"
                className="inline-flex items-center px-2.5 py-1 rounded-full bg-status-waiting-bg text-status-waiting border border-status-waiting-border font-label text-label-sm"
              >
                No cover free
              </span>
            </header>

            <div className="px-4 py-3 rounded-md bg-surface-container-low border border-outline-variant">
              <p className="font-body text-body-md text-on-surface tabular-nums" data-design-text-token="body-md">
                Python remedial · CSE-10 · P6 → no substitute free
              </p>
            </div>

            {/* Amber TARS Suggestion */}
            <div className="p-3.5 rounded-md bg-status-waiting-bg border border-status-waiting-border flex items-start gap-2.5 text-status-waiting">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5" aria-hidden="true">
                auto_awesome
              </span>
              <p className="font-label text-label-md tabular-nums text-pretty" data-design-text-token="label-md">
                TARS suggestion: Move to Sat 12 Dec P3 (section, teacher and room free)
              </p>
            </div>

            <footer className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                disabled
                title="Disabled: Illustrative scenario without an active backend decision"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded bg-primary text-on-primary opacity-50 cursor-not-allowed transition-colors duration-state-change"
              >
                <span className="font-label text-label-lg" data-design-text-token="label-lg">
                  Approve move
                </span>
              </button>

              <button
                type="button"
                disabled
                title="Disabled: Illustrative scenario without an active backend decision"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded bg-surface-container-lowest text-on-surface border border-outline-variant opacity-50 cursor-not-allowed transition-colors duration-state-change"
              >
                <span className="font-label text-label-lg" data-design-text-token="label-lg">
                  Cancel class
                </span>
              </button>

              <button
                type="button"
                disabled
                title="Disabled: Illustrative scenario without an active backend decision"
                className="inline-flex items-center justify-center px-3 py-2.5 rounded text-on-surface-variant opacity-50 cursor-not-allowed transition-colors duration-state-change"
              >
                <span className="font-label text-label-md" data-design-text-token="label-md">
                  Review
                </span>
              </button>
            </footer>
          </article>
        </div>

        {/* Right Column: Today in CSE + Recently Approved (Stitch Exact Layout) */}
        <aside className="lg:col-span-4 flex flex-col gap-5">
          {/* Today in CSE Card */}
          <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col gap-4">
            <h2 className="font-title text-title-md text-on-surface" data-design-text-token="title-md">
              Today in CSE
            </h2>

            <div className="flex flex-col divide-y divide-outline-variant">
              <div className="py-2.5 first:pt-0 flex items-center justify-between gap-3">
                <span className="font-label text-label-md text-on-surface-variant" data-design-text-token="label-md">
                  Classes today
                </span>
                <span className="font-headline text-headline-md text-on-surface tabular-nums" data-design-text-token="headline-md">
                  42
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-3">
                <span className="font-label text-label-md text-on-surface-variant" data-design-text-token="label-md">
                  Changed by TARS
                </span>
                <span className="font-headline text-headline-md text-primary tabular-nums" data-design-text-token="headline-md">
                  3
                </span>
              </div>
              <div className="py-2.5 last:pb-0 flex items-center justify-between gap-3">
                <span className="font-label text-label-md text-on-surface-variant" data-design-text-token="label-md">
                  Cancelled
                </span>
                <span className="font-headline text-headline-md text-status-done tabular-nums" data-design-text-token="headline-md">
                  0
                </span>
              </div>
            </div>
          </article>

          {/* Recently Approved Card */}
          <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col gap-4">
            <h2 className="font-title text-title-md text-on-surface" data-design-text-token="title-md">
              Recently approved
            </h2>

            <ul className="flex flex-col divide-y divide-outline-variant">
              <li className="py-3 first:pt-0 flex items-start gap-3">
                <span className="material-symbols-outlined text-[18px] text-status-done shrink-0 mt-0.5" aria-hidden="true">
                  check_circle
                </span>
                <div className="min-w-0">
                  <p className="font-title text-title-sm text-on-surface tabular-nums" data-design-text-token="title-sm">
                    Dr. Kavitha S · Leave · Tue 25 Nov
                  </p>
                  <p className="font-body text-body-sm text-on-surface-muted" data-design-text-token="body-sm">
                    2 classes covered · approved 8:40 AM
                  </p>
                </div>
              </li>
              <li className="py-3 flex items-start gap-3">
                <span className="material-symbols-outlined text-[18px] text-status-done shrink-0 mt-0.5" aria-hidden="true">
                  check_circle
                </span>
                <div className="min-w-0">
                  <p className="font-title text-title-sm text-on-surface tabular-nums" data-design-text-token="title-sm">
                    Mr. Arun Kumar · Official duty · Wed 26 Nov
                  </p>
                  <p className="font-body text-body-sm text-on-surface-muted" data-design-text-token="body-sm">
                    1 class covered by substitute · approved yesterday
                  </p>
                </div>
              </li>
              <li className="py-3 last:pb-0 flex items-start gap-3">
                <span className="material-symbols-outlined text-[18px] text-status-done shrink-0 mt-0.5" aria-hidden="true">
                  check_circle
                </span>
                <div className="min-w-0">
                  <p className="font-title text-title-sm text-on-surface tabular-nums" data-design-text-token="title-sm">
                    NPTEL verification · CSE-10
                  </p>
                  <p className="font-body text-body-sm text-on-surface-muted" data-design-text-token="body-sm">
                    38 certificates signed off · Mon 24 Nov
                  </p>
                </div>
              </li>
            </ul>
          </article>
        </aside>
      </main>
    </div>
  );
};
