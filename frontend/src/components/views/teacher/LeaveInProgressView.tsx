import React, { useState } from 'react';
import { useTars } from '../../../context/TarsContext';
import { CoverRequestCard } from './CoverRequestCard';

interface LeaveInProgressViewProps {
  onBackToHome: () => void;
  onSwitchToHod?: () => void;
  onCancelLeave?: () => void;
}

export const LeaveInProgressView: React.FC<LeaveInProgressViewProps> = ({
  onBackToHome,
  onSwitchToHod,
  onCancelLeave,
}) => {
  const {
    simStep,
    advanceSimulation,
    resetSimulation,
    hodApproved,
    leaveDate,
    leaveType,
    backendStatus,
    backendMode,
    aiCovered,
    labCovered,
    simulatedLabStatus,
  } = useTars();

  const isLiveMode = backendStatus === 'connected' && backendMode === 'live';
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);

  const isAiCovered = aiCovered || simStep >= 3;
  const isHodApproved = hodApproved || simStep >= 4;

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-surface text-on-surface font-body antialiased">
      {/* Top Bar (Stitch Leave In Progress Header) */}
      <header className="sticky top-0 z-10 bg-surface border-b border-outline-variant px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-label-md text-on-surface-variant hover:bg-surface-container border border-outline-variant transition-colors duration-state-change cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Teacher Home</span>
          </button>
          <div className="h-4 w-px bg-outline-variant"></div>
          <h1 className="font-headline text-headline-lg text-on-surface tabular-nums" data-design-text-token="headline-lg">
            Leave · {leaveDate}
          </h1>
          {/* Status Badge */}
          {isHodApproved ? (
            <span
              role="status"
              className="inline-flex items-center px-2.5 py-1 rounded-full bg-status-done-bg text-status-done border border-status-done-border font-label text-label-sm"
            >
              Approved
            </span>
          ) : (
            <span
              role="status"
              className="inline-flex items-center px-2.5 py-1 rounded-full bg-status-active-bg text-status-active border border-status-active-border font-label text-label-sm"
            >
              In progress
            </span>
          )}
        </div>

        {/* Demo Interactive Controls Bar */}
        <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-1.5 rounded-lg border border-outline-variant text-xs shadow-2xs">
          {isLiveMode ? (
            <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
              <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
              <span className="font-medium text-[11px]">Live Backend Connected: Approvals must be executed via HOD</span>
            </div>
          ) : (
            <>
              <span className="font-semibold text-on-surface-muted uppercase tracking-wider text-[10px]">
                Demo Simulation:
              </span>
              {!isAiCovered ? (
                <button
                  type="button"
                  onClick={advanceSimulation}
                  className="px-2.5 py-1 rounded bg-primary text-white font-medium hover:bg-primary-hover transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">check</span>
                  <span>[Demo Simulation] Pasha Accepts AI Cover</span>
                </button>
              ) : !isHodApproved ? (
                <button
                  type="button"
                  onClick={advanceSimulation}
                  className="px-2.5 py-1 rounded bg-status-done text-white font-medium hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  <span>[Demo Simulation] Dr. Surekha Approves</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resetSimulation}
                  className="px-2.5 py-1 rounded bg-surface-container text-on-surface-variant font-medium hover:bg-surface-container-high transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                  <span>Reset Stepper</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => setShowCoverModal(true)}
            className="px-2 py-1 rounded text-on-surface-variant border border-outline-variant hover:bg-surface-container transition-colors cursor-pointer"
          >
            Preview Geetha's Card
          </button>

          {onSwitchToHod && (
            <button
              type="button"
              onClick={onSwitchToHod}
              className="px-2 py-1 rounded text-primary font-semibold border border-subject-python-border bg-primary-soft hover:bg-primary-soft/80 transition-colors cursor-pointer"
            >
              View in HOD Approvals →
            </button>
          )}
        </div>
      </header>

      {/* Main Grid (Exact Google Stitch Layout) */}
      <main className="flex-1 px-6 lg:px-8 py-6 max-w-[1360px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column: Vertical Stepper + Affected Class Cards + What Happens Next */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-5">
          {/* Vertical Stepper Card */}
          <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-7 flex-1 flex flex-col justify-center">
            <ol className="flex flex-col" aria-label="Leave approval progress">
              {/* Step 1: Done */}
              <li className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-primary text-on-primary shrink-0">
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      check
                    </span>
                  </span>
                  <div className="w-0.5 flex-1 bg-primary my-1.5"></div>
                </div>
                <div className="pb-8 flex flex-col gap-1">
                  <h2 className="font-title text-title-md text-on-surface" data-design-text-token="title-md">
                    Leave applied
                  </h2>
                  <p className="font-body text-body-md text-on-surface-muted tabular-nums" data-design-text-token="body-md">
                    2 classes affected on {leaveDate} · {leaveType} logged · 9:02 AM
                  </p>
                </div>
              </li>

              {/* Step 2: Done */}
              <li className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-primary text-on-primary shrink-0">
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      check
                    </span>
                  </span>
                  <div className={`w-0.5 flex-1 my-1.5 ${isAiCovered ? 'bg-primary' : 'bg-outline-variant'}`}></div>
                </div>
                <div className="pb-8 flex flex-col gap-1">
                  <h2 className="font-title text-title-md text-on-surface" data-design-text-token="title-md">
                    {labCovered ? 'Python lab covered' : 'Python lab coverage pending'}
                  </h2>
                  <p className="font-body text-body-md text-on-surface-muted tabular-nums text-pretty" data-design-text-token="body-md">
                    {labCovered
                      ? 'Mrs. Geetha P L accepted (Simulated) · co-faculty for Thu P6–P7'
                      : simulatedLabStatus === 'declined'
                      ? 'Mrs. Geetha P L declined cover for Thu P6–P7'
                      : 'Mrs. Geetha P L identified · co-faculty candidate for Thu P6–P7 · Awaiting acceptance'}
                  </p>
                </div>
              </li>

              {/* Step 3: Active / Done */}
              <li className="flex gap-4">
                <div className="flex flex-col items-center">
                  {isAiCovered ? (
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-primary text-on-primary shrink-0">
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        check
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-primary ring-8 ring-primary-soft shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-on-primary"></span>
                    </span>
                  )}
                  <div className={`w-0.5 flex-1 my-1.5 ${isHodApproved ? 'bg-primary' : 'bg-outline-variant'}`}></div>
                </div>
                <div className="pb-8 flex flex-col gap-1">
                  <h2
                    className={`font-title text-title-md ${
                      isAiCovered ? 'text-on-surface' : 'text-primary'
                    }`}
                    data-design-text-token="title-md"
                  >
                    {isAiCovered ? 'Intro to AI covered' : 'Finding cover for Intro to AI'}
                  </h2>
                  <p className="font-body text-body-md text-on-surface-variant text-pretty" data-design-text-token="body-md">
                    {isAiCovered
                      ? 'Mr. Syed Matheen Pasha accepted (simulated) · free Thu P4 in SJB-104 (Weekly load: 11/18 units)'
                      : 'Autonomous search assigned Mr. Syed Matheen Pasha (lowest load, free Thu P4 in SJB-104)…'}
                  </p>
                </div>
              </li>

              {/* Step 4: Upcoming / Done */}
              <li className="flex gap-4">
                <div className="flex flex-col items-center">
                  {isHodApproved ? (
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-status-done text-white shrink-0">
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        check
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-surface-container-lowest border border-outline shrink-0">
                      <span className="w-2 h-2 rounded-full bg-outline"></span>
                    </span>
                  )}
                  <div className={`w-0.5 flex-1 my-1.5 ${isHodApproved ? 'bg-status-done' : 'bg-outline-variant'}`}></div>
                </div>
                <div className="pb-8 flex flex-col gap-1">
                  <h2
                    className={`font-title text-title-md ${
                      isHodApproved ? 'text-status-done font-bold' : isAiCovered ? 'text-status-waiting font-semibold' : 'text-on-surface-variant'
                    }`}
                    data-design-text-token="title-md"
                  >
                    {isHodApproved ? 'Approved by HOD' : 'HOD approval'}
                  </h2>
                  <p className="font-body text-body-md text-on-surface-muted text-pretty" data-design-text-token="body-md">
                    {isHodApproved
                      ? 'Dr. Surekha K B approved. Reasoning verified · Substitute confirmation pending.'
                      : isAiCovered
                      ? 'Consolidated card sent to Dr. Surekha K B · ready for sign-off.'
                      : 'Dr. Surekha K B gets one card when all classes are covered'}
                  </p>
                </div>
              </li>

              {/* Step 5: Upcoming (last) / Done */}
              <li className="flex gap-4">
                <div className="flex flex-col items-center">
                  {isHodApproved ? (
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-status-done text-white shrink-0">
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        check
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-surface-container-lowest border border-outline shrink-0">
                      <span className="w-2 h-2 rounded-full bg-outline"></span>
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <h2
                    className={`font-title text-title-md ${
                      isHodApproved ? 'text-on-surface font-bold' : 'text-on-surface-variant'
                    }`}
                    data-design-text-token="title-md"
                  >
                    Students notified
                  </h2>
                  <p className="font-body text-body-md text-on-surface-muted text-pretty" data-design-text-token="body-md">
                    {isHodApproved
                      ? 'CSE-10 section timetable updated with "Changed by TARS" markers (substitute confirmation pending).'
                      : 'CSE-10 gets the updated timetable upon HOD approval'}
                  </p>
                </div>
              </li>
            </ol>
          </article>

          {/* Two Class Cards Side by Side (Exact Stitch Layout) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
            {/* Python lab card */}
            <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col justify-between gap-4 h-full">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-subject-python-bg border border-subject-python-border text-subject-python-text font-label text-label-sm"
                    data-design-text-token="label-sm"
                  >
                    Python lab
                  </span>
                  <span className="font-label text-label-sm text-on-surface-muted">511C</span>
                </div>
                <p className="font-title text-title-sm text-on-surface tabular-nums" data-design-text-token="title-sm">
                  CSE-10 · Thu P6–P7 · 2:20–4:10
                </p>
              </div>
              <div>
                <span
                  role="status"
                  className={`inline-flex items-center px-2.5 py-1 rounded-full ${
                    isHodApproved || labCovered
                      ? 'bg-status-done-bg text-status-done border border-status-done-border'
                      : simulatedLabStatus === 'declined'
                      ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                      : 'bg-status-waiting-bg text-status-waiting border border-status-waiting-border'
                  }`}
                >
                  <span className="font-label text-label-sm" data-design-text-token="label-sm">
                    {isHodApproved
                      ? 'Mrs. Geetha P L (HOD approved · Pending confirmation)'
                      : labCovered
                      ? 'Mrs. Geetha P L (Cover accepted · Simulated)'
                      : simulatedLabStatus === 'declined'
                      ? 'Mrs. Geetha P L (Cover declined)'
                      : 'Mrs. Geetha P L (Candidate identified · Awaiting acceptance)'}
                  </span>
                </span>
              </div>
            </article>

            {/* Intro to AI card */}
            <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col justify-between gap-4 h-full">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-subject-ai-bg border border-subject-ai-border text-subject-ai-text font-label text-label-sm"
                    data-design-text-token="label-sm"
                  >
                    Intro to AI
                  </span>
                  <span className="font-label text-label-sm text-on-surface-muted">SJB-104</span>
                </div>
                <p className="font-title text-title-sm text-on-surface tabular-nums" data-design-text-token="title-sm">
                  CSE-10 · Thu P4 · 11:35–12:30
                </p>
              </div>
              <div>
                {isAiCovered ? (
                  <span
                    role="status"
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-status-done-bg text-status-done border border-status-done-border"
                  >
                    <span className="font-label text-label-sm" data-design-text-token="label-sm">
                      {isHodApproved ? 'Mr. Syed Matheen Pasha (HOD approved · Pending confirmation)' : 'Covered by Mr. Syed Matheen Pasha'}
                    </span>
                  </span>
                ) : (
                  <span
                    role="status"
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-status-waiting-bg text-status-waiting border border-status-waiting-border"
                  >
                    <span className="font-label text-label-sm" data-design-text-token="label-sm">
                      Waiting for reply (SMP)
                    </span>
                  </span>
                )}
              </div>
            </article>
          </div>

          {/* What Happens Next Card */}
          <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-1 max-w-prose">
              <h2 className="font-title text-title-md text-on-surface" data-design-text-token="title-md">
                What happens next
              </h2>
              <p className="font-body text-body-md text-on-surface-variant text-pretty" data-design-text-token="body-md">
                {isHodApproved
                  ? 'Leave request is fully approved by Dr. Surekha K B. Timetables are updated and students have been notified (substitute confirmation pending).'
                  : (isAiCovered && labCovered)
                  ? 'Both classes are covered (simulated acceptance). Consolidated card has been dispatched to Dr. Surekha K B for 1-tap sign-off.'
                  : isAiCovered
                  ? 'Intro to AI covered by Mr. Syed Matheen Pasha. Awaiting Python Lab cover confirmation from Mrs. Geetha P L.'
                  : labCovered
                  ? 'Python Lab covered by Mrs. Geetha P L. Awaiting Intro to AI cover confirmation from Mr. Syed Matheen Pasha.'
                  : 'Awaiting substitute responses from Mr. Syed Matheen Pasha (AI) and Mrs. Geetha P L (Lab)...'}
              </p>
            </div>
            {onCancelLeave && (
              <button
                type="button"
                onClick={onCancelLeave}
                className="self-start sm:self-center shrink-0 font-label text-label-md text-on-surface-muted hover:text-status-attention transition-colors duration-state-change whitespace-nowrap cursor-pointer"
                data-design-text-token="label-md"
              >
                Cancel leave request
              </button>
            )}
          </article>
        </div>

        {/* Right Column: TARS Activity Feed */}
        <aside className="lg:col-span-5 flex flex-col">
          <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col gap-4 h-full">
            <header className="flex items-center justify-between gap-3 pb-3 border-b border-outline-variant">
              <h2 className="font-title text-title-md text-on-surface" data-design-text-token="title-md">
                TARS activity
              </h2>
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="toggle-tech-details"
                  type="checkbox"
                  checked={showTechDetails}
                  onChange={(e) => setShowTechDetails(e.target.checked)}
                  className="w-4 h-4 rounded-sm border-outline text-primary focus:ring-primary cursor-pointer"
                />
                <span className="font-label text-label-sm text-on-surface-variant" data-design-text-token="label-sm">
                  Show technical details
                </span>
              </label>
            </header>

            <ul className="flex flex-col divide-y divide-outline-variant">
              {/* Event 1 */}
              <li className="py-3 first:pt-0 flex flex-col gap-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-body text-body-md text-on-surface" data-design-text-token="body-md">
                    Found 2 classes on Thursday
                  </p>
                  <span className="font-label text-label-sm text-on-surface-muted tabular-nums shrink-0" data-design-text-token="label-sm">
                    9:02 AM
                  </span>
                </div>
                {showTechDetails && (
                  <span className="font-body text-body-sm text-on-surface-muted tabular-nums bg-surface-container-low px-2 py-1 rounded">
                    timetable.query(faculty="CDB", day="THU") → 2 slots
                  </span>
                )}
              </li>

              {/* Event 2 */}
              <li className="py-3 flex flex-col gap-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-body text-body-md text-on-surface" data-design-text-token="body-md">
                    Assigned Mrs. Geetha P L to Python lab
                  </p>
                  <span className="font-label text-label-sm text-on-surface-muted tabular-nums shrink-0" data-design-text-token="label-sm">
                    9:03 AM
                  </span>
                </div>
                {showTechDetails && (
                  <span className="font-body text-body-sm text-on-surface-muted tabular-nums bg-surface-container-low px-2 py-1 rounded">
                    heuristics.co_faculty_match(course="1BPLC105B", slot="P6-P7") → GPL
                  </span>
                )}
              </li>

              {/* Event 3 */}
              <li className="py-3 flex flex-col gap-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-body text-body-md text-on-surface" data-design-text-token="body-md">
                    Queried AI faculty availability for P4
                  </p>
                  <span className="font-label text-label-sm text-on-surface-muted tabular-nums shrink-0" data-design-text-token="label-sm">
                    9:04 AM
                  </span>
                </div>
                {showTechDetails && (
                  <span className="font-body text-body-sm text-on-surface-muted tabular-nums bg-surface-container-low px-2 py-1 rounded">
                    candidates.rank(subject="1BAI103", free_slot="P4", min_load=true)
                  </span>
                )}
              </li>

              {/* Event 4 */}
              <li className="py-3 flex flex-col gap-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-body text-body-md text-on-surface" data-design-text-token="body-md">
                    {isAiCovered
                      ? 'Mr. Syed Matheen Pasha accepted cover'
                      : 'Mr. Syed Matheen Pasha ranked #1 (Load: 11/18)'}
                  </p>
                  <span className="font-label text-label-sm text-on-surface-muted tabular-nums shrink-0" data-design-text-token="label-sm">
                    {isAiCovered ? '9:06 AM' : '9:05 AM'}
                  </span>
                </div>
                {showTechDetails && (
                  <span className="font-body text-body-sm text-on-surface-muted tabular-nums bg-surface-container-low px-2 py-1 rounded">
                    {isAiCovered
                      ? 'substitute.confirm(id="smp", slot="P4", course="1BAI103")'
                      : 'notification.dispatch(to="smp", channel="push")'}
                  </span>
                )}
              </li>

              {/* Event 5 (if HOD approved) */}
              {isHodApproved && (
                <li className="py-3 flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-body text-body-md text-status-done font-medium" data-design-text-token="body-md">
                      Consolidated approval signed by Dr. Surekha K B
                    </p>
                    <span className="font-label text-label-sm text-on-surface-muted tabular-nums shrink-0" data-design-text-token="label-sm">
                      11:42 AM
                    </span>
                  </div>
                  {showTechDetails && (
                    <span className="font-body text-body-sm text-on-surface-muted tabular-nums bg-surface-container-low px-2 py-1 rounded">
                      hod.signoff(status="APPROVED", note="Consolidated cover verified")
                    </span>
                  )}
                </li>
              )}
            </ul>
          </article>
        </aside>
      </main>

      {/* Geetha Preview Modal */}
      {showCoverModal && (
        <CoverRequestCard
          isModal={true}
          onClose={() => setShowCoverModal(false)}
          onAccept={() => setShowCoverModal(false)}
          onDecline={() => setShowCoverModal(false)}
        />
      )}
    </div>
  );
};
