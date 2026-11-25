import React, { useState, useEffect } from 'react';
import rawDecisions from '../../../mock/decisions.json';
import {
  Code,
  Brain,
  Code2,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface DecisionOption {
  teacher_id: string;
  teacher_name: string;
  free: boolean;
  can_teach: boolean;
  load: number;
  result: 'accepted' | 'declined' | 'rejected' | 'candidate';
  rejection_reason?: string;
}

interface DecisionRule {
  name: string;
  ok: boolean;
  detail?: string;
}

interface DecisionStep {
  at: string;
  text: string;
}

interface DecisionCase {
  id: string;
  created_at: string;
  summary: string;
  status: string;
  outcomes: string[];
  why: string[];
  options: DecisionOption[];
  rules: DecisionRule[];
  steps: DecisionStep[];
  tool_calls: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result: unknown;
  }>;
}

const decisionsList = rawDecisions as unknown as DecisionCase[];

export const TarsActivityView: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'today' | '7d' | 'semester'>('7d');
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [expandedCase, setExpandedCase] = useState(true);
  const [liveSteps, setLiveSteps] = useState<DecisionStep[]>(decisionsList[0]?.steps || []);

  // Coordinate SSE stream contract with Anshul (Event: decision.step)
  useEffect(() => {
    const handleSSE = (e: Event) => {
      const custom = e as CustomEvent<{ type: string; payload?: { step?: DecisionStep } }>;
      if (custom.detail?.type === 'decision.step' && custom.detail.payload?.step) {
        setLiveSteps((prev) => [...prev, custom.detail.payload!.step!]);
      }
    };

    window.addEventListener('tars:sse', handleSSE);
    return () => window.removeEventListener('tars:sse', handleSSE);
  }, []);

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[#F8FAFC]">
      {/* Top Header matching Stitch tars_activity_dr._surekha_k_b */}
      <header className="sticky top-0 z-10 bg-[#F8FAFC] border-b border-[#E2E8F0] px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">TARS activity</h1>
          <p className="text-sm text-[#475569]">Every decision TARS made, and why.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Timeframe pill */}
          <div className="inline-flex items-center rounded-full bg-[#F1F5F9] p-1 border border-[#E2E8F0]" role="group" aria-label="Timeframe">
            <button
              type="button"
              onClick={() => setTimeRange('today')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                timeRange === 'today'
                  ? 'bg-white text-[#0F172A] border border-[#E2E8F0] shadow-xs'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                timeRange === '7d'
                  ? 'bg-white text-[#0F172A] border border-[#E2E8F0] shadow-xs'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              7D
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('semester')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                timeRange === 'semester'
                  ? 'bg-white text-[#0F172A] border border-[#E2E8F0] shadow-xs'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              Semester
            </button>
          </div>

          {/* Filter dropdown */}
          <select
            aria-label="Filter cases"
            className="rounded-lg bg-white border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#0F172A] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
          >
            <option>All cases</option>
            <option>Leave &amp; cover</option>
            <option>NPTEL</option>
            <option>Events</option>
          </select>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 px-6 lg:px-8 py-6 max-w-[1360px] w-full mx-auto flex flex-col gap-6">

        {/* Top Row: 4 Stat Tiles */}
        <section aria-label="Activity summary" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <article className="bg-white border border-[#E2E8F0] rounded-2xl p-5 flex flex-col gap-1 shadow-xs">
            <p className="text-xs font-medium text-[#64748B]">Classes covered</p>
            <p className="text-3xl font-bold tracking-tight text-[#0F172A] tabular-nums">12</p>
          </article>
          <article className="bg-white border border-[#E2E8F0] rounded-2xl p-5 flex flex-col gap-1 shadow-xs">
            <p className="text-xs font-medium text-[#64748B]">Avg time to cover</p>
            <p className="text-3xl font-bold tracking-tight text-[#0F172A] tabular-nums">1 m 48 s</p>
          </article>
          <article className="bg-white border border-[#E2E8F0] rounded-2xl p-5 flex flex-col gap-1 shadow-xs">
            <p className="text-xs font-medium text-[#64748B]">HOD taps per leave</p>
            <p className="text-3xl font-bold tracking-tight text-[#0F172A] tabular-nums">1</p>
          </article>
          <article className="bg-white border border-[#E2E8F0] rounded-2xl p-5 flex flex-col gap-1 shadow-xs">
            <p className="text-xs font-medium text-[#64748B]">Clashes created</p>
            <p className="text-3xl font-bold tracking-tight text-[#15803D] tabular-nums">0</p>
          </article>
        </section>

        {/* Decision Cases List */}
        <section aria-label="Decision cases" className="flex flex-col gap-4">

          {/* Expanded Case: Leave · Prof. Chaitra D B · Thu 3 Dec */}
          <article className="bg-white border border-[#E2E8F0] rounded-2xl p-6 flex flex-col gap-5 shadow-xs">
            <header className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E2E8F0]">
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setExpandedCase(!expandedCase)}
              >
                {expandedCase ? (
                  <ChevronDown className="w-5 h-5 text-[#4F46E5]" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-[#64748B]" />
                )}

                {/* TARS SVG Monogram Logo */}
                <svg width="28" height="28" viewBox="0 0 64 64" fill="none" className="shrink-0" aria-hidden="true">
                  <rect x="4" y="4" width="56" height="56" rx="16" fill="#FFFFFF" stroke="#4F46E5" strokeWidth="4" />
                  <path d="M18.5 34.5C20.5 28.5 25.5 28.5 27.5 34.5" stroke="#4F46E5" strokeWidth="4" strokeLinecap="round" />
                  <path d="M36.5 34.5C38.5 28.5 43.5 28.5 45.5 34.5" stroke="#4F46E5" strokeWidth="4" strokeLinecap="round" />
                </svg>

                <h2 className="text-base font-bold text-[#0F172A] tabular-nums">
                  Leave · Prof. Chaitra D B · Thu 3 Dec
                </h2>
              </div>

              <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] text-xs font-semibold">
                Approved
              </span>
            </header>

            {expandedCase && (
              <div className="flex flex-col gap-5">
                {/* Outcomes */}
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-[#64748B]">Outcomes</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE] text-[#5B21B6] shrink-0">
                        <Brain className="w-4 h-4" />
                      </span>
                      <p className="text-sm text-[#0F172A] font-medium tabular-nums">
                        Intro to AI · P4 → Mr. Syed Matheen Pasha
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#EEF2FF] border border-[#C7D2FE] text-[#3730A3] shrink-0">
                        <Code2 className="w-4 h-4" />
                      </span>
                      <p className="text-sm text-[#0F172A] font-medium tabular-nums">
                        Python lab · P6–P7 → Mrs. Geetha P L
                      </p>
                    </div>
                  </div>
                </div>

                {/* Why this choice + Rules checked */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-7 flex flex-col gap-2.5">
                    <p className="text-xs font-medium text-[#64748B]">Why this choice</p>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start gap-2.5">
                        <Sparkles className="w-4 h-4 text-[#4F46E5] shrink-0 mt-0.5" />
                        <p className="text-sm text-[#0F172A]">
                          Mrs. Geetha co-teaches this lab and is free P6–P7 (load 13/18).
                        </p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <Sparkles className="w-4 h-4 text-[#4F46E5] shrink-0 mt-0.5" />
                        <p className="text-sm text-[#0F172A]">
                          Mr. Syed Matheen Pasha is free P4 and teaches 1st-year sections.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-5 flex flex-col gap-2.5">
                    <p className="text-xs font-medium text-[#64748B]">Rules checked</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] text-xs font-medium">
                        No clashes ✓
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] text-xs font-medium">
                        Not on leave day ✓
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] text-xs font-medium tabular-nums">
                        Attendance 78% — cancel not needed ✓
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] text-xs font-medium">
                        HOD approval ✓
                      </span>
                    </div>
                  </div>
                </div>

                {/* Options considered */}
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-[#64748B]">Options considered</p>
                  <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                        <tr>
                          <th className="px-3.5 py-2.5 text-[#64748B] font-medium">Teacher</th>
                          <th className="px-3.5 py-2.5 text-[#64748B] font-medium">Free?</th>
                          <th className="px-3.5 py-2.5 text-[#64748B] font-medium">Can teach?</th>
                          <th className="px-3.5 py-2.5 text-[#64748B] font-medium">Load</th>
                          <th className="px-3.5 py-2.5 text-[#64748B] font-medium">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] text-xs text-[#0F172A]">
                        <tr>
                          <td className="px-3.5 py-2.5">Mrs. Shabeena Lylath</td>
                          <td className="px-3.5 py-2.5 text-[#475569]">yes</td>
                          <td className="px-3.5 py-2.5 text-[#475569]">yes</td>
                          <td className="px-3.5 py-2.5 text-[#475569] tabular-nums">12</td>
                          <td className="px-3.5 py-2.5">
                            <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] text-xs font-medium">
                              Declined
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3.5 py-2.5 font-semibold text-[#0F172A]">Mr. Syed Matheen Pasha</td>
                          <td className="px-3.5 py-2.5 text-[#475569]">yes</td>
                          <td className="px-3.5 py-2.5 text-[#475569]">yes</td>
                          <td className="px-3.5 py-2.5 text-[#475569] tabular-nums">14</td>
                          <td className="px-3.5 py-2.5">
                            <span className="px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] text-xs font-semibold">
                              Accepted
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3.5 py-2.5 text-[#94A3B8]">Mr. Raghavendra S</td>
                          <td className="px-3.5 py-2.5 text-[#94A3B8]">no — teaching CSE-12</td>
                          <td className="px-3.5 py-2.5 text-[#94A3B8]">—</td>
                          <td className="px-3.5 py-2.5 text-[#94A3B8]">—</td>
                          <td className="px-3.5 py-2.5">
                            <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#94A3B8] text-xs font-medium">
                              Skipped
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Timeline */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-[#64748B]">Timeline</p>
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#15803D] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] animate-pulse" />
                      Live Stream Active
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs tabular-nums">
                    {liveSteps.map((step, idx) => (
                      <React.Fragment key={idx}>
                        <span className="text-[#475569]">
                          <strong className="font-semibold text-[#0F172A]">{step.at}</strong> {step.text}
                        </span>
                        {idx < liveSteps.length - 1 && (
                          <span className="text-[#94A3B8]" aria-hidden="true">→</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Technical Details Toggle */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowTechDetails(!showTechDetails)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#4F46E5] transition-colors"
                  >
                    <Code className="w-4 h-4" />
                    <span>{showTechDetails ? 'Hide technical details' : 'Show technical details'}</span>
                  </button>

                  {showTechDetails && (
                    <pre className="mt-2.5 p-3.5 rounded-xl bg-[#0F172A] text-[#F8FAFC] border border-[#334155] font-mono text-xs overflow-x-auto leading-relaxed">
{`find_substitutes(section="CSE-10", date="2026-12-03", periods=["P4","P6-P7"])
send_request(to=["Mrs. Geetha P L", "Mr. Syed Matheen Pasha"])
propose_change(leave_id="LV-1042", status="ready_for_hod")
validate(rules=["no_clashes", "not_on_leave", "attendance_threshold_75"])`}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </article>

          {/* Collapsed Past Cases */}
          <article className="bg-white border border-[#E2E8F0] rounded-xl px-6 py-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <ChevronRight className="w-5 h-5 text-[#94A3B8] shrink-0" />
              <svg width="28" height="28" viewBox="0 0 64 64" fill="none" className="shrink-0" aria-hidden="true">
                <rect x="4" y="4" width="56" height="56" rx="16" fill="#FFFFFF" stroke="#4F46E5" strokeWidth="4" />
                <path d="M18.5 34.5C20.5 28.5 25.5 28.5 27.5 34.5" stroke="#4F46E5" strokeWidth="4" strokeLinecap="round" />
              </svg>
              <h3 className="text-sm font-semibold text-[#0F172A] truncate">
                Leave · Dr. Udayabhanu · Wed 18 Nov
              </h3>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] text-xs font-semibold">
              Approved
            </span>
          </article>

          <article className="bg-white border border-[#E2E8F0] rounded-xl px-6 py-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <ChevronRight className="w-5 h-5 text-[#94A3B8] shrink-0" />
              <svg width="28" height="28" viewBox="0 0 64 64" fill="none" className="shrink-0" aria-hidden="true">
                <rect x="4" y="4" width="56" height="56" rx="16" fill="#FFFFFF" stroke="#4F46E5" strokeWidth="4" />
                <path d="M18.5 34.5C20.5 28.5 25.5 28.5 27.5 34.5" stroke="#4F46E5" strokeWidth="4" strokeLinecap="round" />
              </svg>
              <h3 className="text-sm font-semibold text-[#0F172A] truncate">
                Leave · Mrs. Geetha P L · Mon 10 Nov
              </h3>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] text-xs font-semibold">
              Approved
            </span>
          </article>

        </section>
      </main>
    </div>
  );
};

export default TarsActivityView;
