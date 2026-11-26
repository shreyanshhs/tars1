import React, { useState, useEffect } from 'react';
import { useTars } from '../../../context/TarsContext';
import { api } from '../../../services/api';

interface DecisionCase {
  id: string;
  title: string;
  subtitle?: string;
  status: 'Approved' | 'Sent' | 'Waiting' | 'Pending';
  statusColor: string;
  icon: string;
  isLive?: boolean;
  outcomes?: Array<{
    subject: string;
    period: string;
    substitute: string;
    icon: string;
    color: string;
  }>;
  reasons?: string[];
  rules?: string[];
  options?: Array<{
    teacher: string;
    free: string;
    canTeach: string;
    load: string | number;
    result: string;
    resultBadge: string;
  }>;
  timeline?: string[];
  techDetails?: string;
}

export const ActivityView: React.FC = () => {
  const { hasActiveLeave, hodApproved, hodApprovalTime } = useTars();
  const [expandedCaseId, setExpandedCaseId] = useState<string>('case-1');
  const [showTechDetails, setShowTechDetails] = useState<boolean>(false);
  const [backendStats, setBackendStats] = useState<{
    covered?: number;
    avg_seconds_to_cover?: number;
    hod_taps_per_leave?: number;
    clashes?: number;
  } | null>(null);

  useEffect(() => {
    // Attempt to load genuine stats from backend decisions service if accessible
    api.decisions.getStats()
      .then((st) => setBackendStats(st))
      .catch(() => {
        // Fallback gracefully to demo baselines
      });
  }, []);

  const cases: DecisionCase[] = [
    {
      id: 'case-1',
      title: 'Leave · Prof. Chaitra D B · Thu 3 Dec',
      status: hodApproved ? 'Approved' : hasActiveLeave ? 'Waiting' : 'Approved',
      statusColor: hodApproved
        ? 'bg-status-done-bg text-status-done border-status-done-border'
        : hasActiveLeave
        ? 'bg-status-waiting-bg text-status-waiting border-status-waiting-border'
        : 'bg-status-done-bg text-status-done border-status-done-border',
      icon: 'auto_awesome',
      isLive: hasActiveLeave,
      outcomes: [
        {
          subject: 'Intro to AI',
          period: 'P4',
          substitute: 'Mr. Syed Matheen Pasha',
          icon: 'psychology',
          color: 'bg-subject-ai-bg text-subject-ai-text border-subject-ai-border',
        },
        {
          subject: 'Python lab',
          period: 'P6–P7',
          substitute: 'Mrs. Geetha P L',
          icon: 'data_object',
          color: 'bg-subject-python-bg text-subject-python-text border-subject-python-border',
        },
      ],
      reasons: [
        'Mrs. Geetha co-teaches this lab and is free P6–P7 (load 13/18).',
        'Mr. Syed Matheen Pasha is free P4 and teaches 1st-year sections.',
      ],
      rules: [
        'No clashes ✓',
        'Not on leave day ✓',
        'Attendance 78% — cancel not needed ✓',
        'HOD approval ✓',
      ],
      options: [
        {
          teacher: 'Mrs. Shabeena Lylath',
          free: 'yes',
          canTeach: 'yes',
          load: 12,
          result: 'Declined',
          resultBadge: 'bg-surface-container text-on-surface-variant',
        },
        {
          teacher: 'Mr. Syed Matheen Pasha',
          free: 'yes',
          canTeach: 'yes',
          load: 14,
          result: 'Accepted',
          resultBadge: 'bg-status-done-bg text-status-done border border-status-done-border',
        },
        {
          teacher: 'Dr. X',
          free: 'no — teaching CSE-12',
          canTeach: '—',
          load: '—',
          result: 'Skipped',
          resultBadge: 'bg-surface-container text-on-surface-variant',
        },
      ],
      timeline: [
        '9:02 AM Leave submitted',
        '9:03 AM Candidates scored',
        '9:05 AM Requests sent',
        '9:09 AM Both accepted',
        `9:11 AM HOD approved${hodApprovalTime ? ` (${hodApprovalTime})` : ''}`,
      ],
      techDetails: `find_substitutes(section="CSE-10", date="2026-12-03", periods=["P4","P6-P7"])
send_request(to=["Mrs. Geetha P L", "Mr. Syed Matheen Pasha"])
propose_change(leave_id="LV-1042", status="${hodApproved ? 'committed' : 'ready_for_hod'}")
validate(rules=["no_clashes", "not_on_leave", "attendance_threshold_75"])`,
    },
    {
      id: 'case-2',
      title: 'NPTEL nudges · CSE-10 · 6 students',
      status: 'Sent',
      statusColor: 'bg-status-active-bg text-status-active border-status-active-border',
      icon: 'workspace_premium',
      reasons: ['6 students in CSE-10 have not submitted proof of course registration for elective credit.'],
      rules: ['Section enrolled ✓', 'Deadline approaching (7 days) ✓'],
      timeline: ['11:45 AM Batch query', '11:46 AM Telegram nudges dispatched to 6 students'],
      techDetails: `dispatch_nptel_nudges(section="CSE-10", count=6, trigger="weekly_cron")`,
    },
    {
      id: 'case-3',
      title: 'Leave · Mrs. Geetha P L · Mon 7 Dec · move to Sat proposed',
      status: 'Waiting',
      statusColor: 'bg-status-waiting-bg text-status-waiting border-status-waiting-border',
      icon: 'more_horiz',
      reasons: ['No substitute free for Python remedial P6. Reschedule candidate identified for Sat 12 Dec P3.'],
      rules: ['Section free on Saturday P3 ✓', 'Teacher free ✓', 'Room 304 free ✓'],
      timeline: ['Yesterday 4:15 PM Leave registered', 'Yesterday 4:18 PM Reschedule proposed to HOD'],
      techDetails: `propose_reschedule(faculty_id="F_GPL", target_day="SAT", target_period=3, status="proposed")`,
    },
    {
      id: 'case-4',
      title: 'Event clash · Martian 1.0 · attendance permission requested',
      status: 'Pending',
      statusColor: 'bg-status-waiting-bg text-status-waiting border-status-waiting-border',
      icon: 'schedule',
      reasons: ['118 students registered for hackathon. 2 students requested waiver for overlapping tutorial.'],
      rules: ['Official college hackathon ✓', 'Waiver threshold < 3 hours ✓'],
      timeline: ['Nov 24 10:00 AM Event ingested', 'Nov 24 11:30 AM Auto-waiver drafted for HOD sign-off'],
      techDetails: `evaluate_event_clashes(event_id="EV-MARTIAN-1", section="CSE-10")`,
    },
  ];

  return (
    <main className="flex-1 px-6 lg:px-8 py-6 max-w-[1360px] w-full mx-auto flex flex-col gap-6 bg-surface text-on-surface font-body antialiased">
      {/* Header with Demo Disclosure */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-outline-variant">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-headline text-headline-lg text-on-surface" data-design-text-token="headline-lg">
              TARS Activity
            </h1>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label text-[11px] font-bold tracking-wider uppercase">
              Audit Logs
            </span>
          </div>
          <p className="font-body text-body-md text-on-surface-variant mt-1" data-design-text-token="body-md">
            Autonomous scheduling decisions, reasoning audits, and dispatch logs · Dr. Surekha K B
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-on-surface-muted italic bg-surface-container-low px-3 py-1.5 rounded border border-outline-variant">
          <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">info</span>
          <span>Showing live decision trace + illustrative scenario fixtures</span>
        </div>
      </header>

      {/* Top Row: 4 Stat Tiles */}
      <section aria-label="Activity summary" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col gap-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="font-label text-label-sm text-on-surface-muted" data-design-text-token="label-sm">Classes covered</p>
            <span className="text-[10px] text-on-surface-muted uppercase font-mono">KPI</span>
          </div>
          <p className="font-headline text-headline-lg text-on-surface tabular-nums" data-design-text-token="headline-lg">
            {backendStats?.covered ?? 12}
          </p>
        </article>

        <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col gap-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="font-label text-label-sm text-on-surface-muted" data-design-text-token="label-sm">Avg time to cover</p>
            <span className="text-[10px] text-on-surface-muted uppercase font-mono">KPI</span>
          </div>
          <p className="font-headline text-headline-lg text-on-surface tabular-nums" data-design-text-token="headline-lg">
            {backendStats?.avg_seconds_to_cover
              ? `${Math.floor(backendStats.avg_seconds_to_cover / 60)} m ${backendStats.avg_seconds_to_cover % 60} s`
              : '1 m 48 s'}
          </p>
        </article>

        <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col gap-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="font-label text-label-sm text-on-surface-muted" data-design-text-token="label-sm">HOD taps per leave</p>
            <span className="text-[10px] text-on-surface-muted uppercase font-mono">KPI</span>
          </div>
          <p className="font-headline text-headline-lg text-on-surface tabular-nums" data-design-text-token="headline-lg">
            {backendStats?.hod_taps_per_leave ?? 1}
          </p>
        </article>

        <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col gap-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="font-label text-label-sm text-on-surface-muted" data-design-text-token="label-sm">Clashes created</p>
            <span className="text-[10px] text-status-done uppercase font-mono">Zero Clash</span>
          </div>
          <p className="font-headline text-headline-lg text-status-done tabular-nums" data-design-text-token="headline-lg">
            {backendStats?.clashes ?? 0}
          </p>
        </article>
      </section>

      {/* Decision Cases List */}
      <section aria-label="Decision cases" className="flex flex-col gap-4">
        {cases.map((c) => {
          const isExpanded = expandedCaseId === c.id;

          return (
            <article
              key={c.id}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 md:p-6 flex flex-col gap-5 shadow-2xs transition-shadow"
            >
              {/* Header / Click to Toggle */}
              <header
                onClick={() => setExpandedCaseId(isExpanded ? '' : c.id)}
                className={`flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none ${
                  isExpanded ? 'pb-4 border-b border-outline-variant' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`material-symbols-outlined text-[20px] transition-transform ${
                      isExpanded ? 'text-primary rotate-180' : 'text-on-surface-muted'
                    }`}
                    aria-hidden="true"
                  >
                    expand_more
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-primary-soft border border-status-active-border flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined text-[18px]">{c.icon}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                    <h2 className="font-title text-title-md text-on-surface tabular-nums" data-design-text-token="title-md">
                      {c.title}
                    </h2>
                    {c.isLive && (
                      <span className="text-[10px] bg-primary text-white px-1.5 py-0.2 rounded font-bold uppercase self-start">
                        Live Decision
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full border font-label text-label-sm ${c.statusColor}`}
                    data-design-text-token="label-sm"
                  >
                    {c.status}
                  </span>
                </div>
              </header>

              {/* Expanded Card Body */}
              {isExpanded && (
                <div className="flex flex-col gap-5 animate-in fade-in duration-150">
                  {/* Outcome Rows */}
                  {c.outcomes && (
                    <div className="flex flex-col gap-2">
                      <p className="font-label text-label-sm text-on-surface-muted" data-design-text-token="label-sm">
                        Outcomes
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {c.outcomes.map((out, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-md bg-surface-container-low border border-outline-variant flex items-center gap-3"
                          >
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 rounded border shrink-0 ${out.color}`}
                              aria-hidden="true"
                            >
                              <span className="material-symbols-outlined text-[18px]">{out.icon}</span>
                            </span>
                            <p className="font-body text-body-md text-on-surface tabular-nums" data-design-text-token="body-md">
                              {out.subject} · {out.period} → <strong className="font-medium">{out.substitute}</strong>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Why this choice + Rules checked */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {c.reasons && (
                      <div className="lg:col-span-7 flex flex-col gap-2.5">
                        <p className="font-label text-label-sm text-on-surface-muted" data-design-text-token="label-sm">
                          Why this choice
                        </p>
                        <div className="flex flex-col gap-2">
                          {c.reasons.map((r, idx) => (
                            <div key={idx} className="flex items-start gap-2.5">
                              <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5" aria-hidden="true">
                                check_circle
                              </span>
                              <p className="font-body text-body-md text-on-surface text-pretty" data-design-text-token="body-md">
                                {r}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {c.rules && (
                      <div className="lg:col-span-5 flex flex-col gap-2.5">
                        <p className="font-label text-label-sm text-on-surface-muted" data-design-text-token="label-sm">
                          Rules verified
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {c.rules.map((rule, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2.5 py-1 rounded-full bg-status-done-bg text-status-done border border-status-done-border font-label text-label-sm"
                              data-design-text-token="label-sm"
                            >
                              {rule}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Options Considered Mini Table */}
                  {c.options && (
                    <div className="flex flex-col gap-2">
                      <p className="font-label text-label-sm text-on-surface-muted" data-design-text-token="label-sm">
                        Substitute ranking &amp; constraints check
                      </p>
                      <div className="overflow-x-auto rounded-md border border-outline-variant">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-surface-container-low border-b border-outline-variant">
                            <tr>
                              <th className="px-3.5 py-2.5 font-label text-label-sm text-on-surface-muted">Teacher</th>
                              <th className="px-3.5 py-2.5 font-label text-label-sm text-on-surface-muted">Free slot?</th>
                              <th className="px-3.5 py-2.5 font-label text-label-sm text-on-surface-muted">Qualified?</th>
                              <th className="px-3.5 py-2.5 font-label text-label-sm text-on-surface-muted">Load</th>
                              <th className="px-3.5 py-2.5 font-label text-label-sm text-on-surface-muted">Result</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant font-body text-body-sm">
                            {c.options.map((opt, idx) => (
                              <tr key={idx}>
                                <td className="px-3.5 py-2.5 text-on-surface font-medium">{opt.teacher}</td>
                                <td className="px-3.5 py-2.5 text-on-surface-variant">{opt.free}</td>
                                <td className="px-3.5 py-2.5 text-on-surface-variant">{opt.canTeach}</td>
                                <td className="px-3.5 py-2.5 text-on-surface-variant tabular-nums">{opt.load}</td>
                                <td className="px-3.5 py-2.5">
                                  <span className={`px-2 py-0.5 rounded-full font-label text-label-sm ${opt.resultBadge}`}>
                                    {opt.result}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Timeline of steps */}
                  {c.timeline && (
                    <div className="flex flex-col gap-2">
                      <p className="font-label text-label-sm text-on-surface-muted" data-design-text-token="label-sm">
                        Resolution timeline
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3.5 rounded-md bg-surface-container-low border border-outline-variant font-body text-body-sm tabular-nums">
                        {c.timeline.map((item, idx) => (
                          <React.Fragment key={idx}>
                            <span className="text-on-surface-variant">
                              <strong className="font-medium text-on-surface">{item.split(' ')[0]} {item.split(' ')[1]}</strong>{' '}
                              {item.split(' ').slice(2).join(' ')}
                            </span>
                            {idx < (c.timeline?.length ?? 0) - 1 && (
                              <span className="text-on-surface-muted" aria-hidden="true">→</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Technical Details Toggle */}
                  {c.techDetails && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowTechDetails(!showTechDetails)}
                        className="inline-flex items-center gap-1.5 font-label text-label-sm text-on-surface-muted hover:text-primary transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">code</span>
                        <span>{showTechDetails ? 'Hide technical dispatch trace' : 'Show technical dispatch trace'}</span>
                      </button>
                      {showTechDetails && (
                        <pre className="mt-2.5 p-3.5 rounded-md bg-slate-900 text-slate-100 border border-slate-700 font-mono text-xs overflow-x-auto leading-relaxed">
                          {c.techDetails}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
};
