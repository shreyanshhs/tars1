import React, { useState } from 'react';
import rawDecisions from '../../../mock/decisions.json';
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Code,
  CheckCircle2,
  Brain,
  ShieldCheck,
  Check,
  X,
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
  const [expandedCaseId, setExpandedCaseId] = useState<string>(decisionsList[0]?.id || 'dec_001');
  const [showTechDetails, setShowTechDetails] = useState<boolean>(false);
  const [timeRange, setTimeRange] = useState<'today' | '7d' | 'semester'>('today');

  const mainCase = decisionsList[0];

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-slate-50/50">
      {/* Top Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-8 py-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">TARS activity</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              Explainable AI (XAI)
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Every autonomous rescheduling decision TARS made, with mathematical rule validation and audit logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Timeframe Switcher */}
          <div className="inline-flex items-center rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setTimeRange('today')}
              className={`px-3 py-1 rounded-md transition-colors ${
                timeRange === 'today'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1 rounded-md transition-colors ${
                timeRange === '7d'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setTimeRange('semester')}
              className={`px-3 py-1 rounded-md transition-colors ${
                timeRange === 'semester'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semester
            </button>
          </div>

          <select className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option>All decision cases</option>
            <option>Leave &amp; cover</option>
            <option>NPTEL verifications</option>
            <option>Event clash checks</option>
          </select>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 px-8 py-6 max-w-6xl w-full mx-auto space-y-6">
        {/* Top 4 Stat Tiles */}
        <section aria-label="Activity summary metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <article className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <p className="text-xs font-medium text-slate-500">Classes covered</p>
            <p className="text-3xl font-bold tracking-tight text-slate-900 mt-1 tabular-nums">12</p>
            <p className="text-[11px] text-emerald-600 mt-1 font-medium">100% resolution rate</p>
          </article>

          <article className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <p className="text-xs font-medium text-slate-500">Avg time to cover</p>
            <p className="text-3xl font-bold tracking-tight text-slate-900 mt-1 tabular-nums">1 m 48 s</p>
            <p className="text-[11px] text-slate-400 mt-1">vs 45 min manual baseline</p>
          </article>

          <article className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <p className="text-xs font-medium text-slate-500">HOD taps per leave</p>
            <p className="text-3xl font-bold tracking-tight text-slate-900 mt-1 tabular-nums">1</p>
            <p className="text-[11px] text-indigo-600 mt-1 font-medium">Single bundled sign-off</p>
          </article>

          <article className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <p className="text-xs font-medium text-slate-500">Clashes created</p>
            <p className="text-3xl font-bold tracking-tight text-emerald-600 mt-1 tabular-nums">0</p>
            <p className="text-[11px] text-emerald-600 mt-1 font-medium">Verified by constraint engine</p>
          </article>
        </section>

        {/* Decisions Case Feed */}
        <section className="space-y-4">
          {mainCase && (
            <article className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
              {/* Case Header */}
              <header className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setExpandedCaseId(expandedCaseId === mainCase.id ? '' : mainCase.id)}
                >
                  <button className="text-slate-400 hover:text-slate-700">
                    {expandedCaseId === mainCase.id ? (
                      <ChevronDown className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Leave Substitution · Prof. Chaitra D B (Thu 26 Nov)
                    </h2>
                    <p className="text-xs text-slate-500">Case ID: {mainCase.id} · CSE-10 Section</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    HOD Approved &amp; Committed
                  </span>
                </div>
              </header>

              {expandedCaseId === mainCase.id && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Resolved Outcomes */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                      Substituted Outcomes
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-4 rounded-xl bg-violet-50/50 border border-violet-200 flex items-start gap-3">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100 text-violet-700 shrink-0 text-xs font-bold">
                          P4
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-violet-950">
                            Intro to AI → Mr. Syed Matheen Pasha
                          </p>
                          <p className="text-xs text-violet-700 mt-0.5">
                            Room SJB-104 (11:35 AM – 12:30 PM). 0 clashes.
                          </p>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200 flex items-start gap-3">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 shrink-0 text-xs font-bold">
                          P6-7
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-indigo-950">
                            Python Lab → Mrs. Geetha P L
                          </p>
                          <p className="text-xs text-indigo-700 mt-0.5">
                            Lab 511C, Sir CV Raman Block (14:20 – 16:10). Co-faculty priority.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Why this choice (Plain English Rationale) & Rules Checked */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Why this choice */}
                    <div className="lg:col-span-7 space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Why this choice (Plain English Explainability)
                      </h3>
                      <div className="space-y-2.5 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
                        {mainCase.why.map((reason, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                            <p className="leading-relaxed">{reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rules Checked Chips */}
                    <div className="lg:col-span-5 space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Programmatic Constraints Verified
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {mainCase.rules.map((rule, idx) => (
                          <span
                            key={idx}
                            title={rule.detail}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            {rule.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Options Considered Table */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Options Considered (Candidate Matrix)
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                          <tr>
                            <th className="px-4 py-3">Teacher</th>
                            <th className="px-4 py-3">Free in Slot?</th>
                            <th className="px-4 py-3">Subject Competency?</th>
                            <th className="px-4 py-3">Weekly Load</th>
                            <th className="px-4 py-3">Resolution Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {mainCase.options.map((opt) => (
                            <tr key={opt.teacher_id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-3 font-semibold text-slate-900">
                                {opt.teacher_name}
                              </td>
                              <td className="px-4 py-3">
                                {opt.free ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                    <Check className="w-3.5 h-3.5" /> Yes
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                                    <X className="w-3.5 h-3.5" /> No (Clash)
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {opt.can_teach ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                    <Check className="w-3.5 h-3.5" /> Verified
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono tabular-nums text-slate-600">
                                {opt.load} hrs/wk
                              </td>
                              <td className="px-4 py-3">
                                {opt.result === 'accepted' ? (
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                                    Accepted
                                  </span>
                                ) : opt.result === 'declined' ? (
                                  <span
                                    title={opt.rejection_reason}
                                    className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold border border-amber-200 cursor-help"
                                  >
                                    Declined: {opt.rejection_reason}
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                    {opt.result}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Step Timeline */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Autonomous Execution Timeline
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      {mainCase.steps.map((st, i) => (
                        <React.Fragment key={i}>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-slate-800">{st.at}</span>
                            <span className="text-slate-600">{st.text}</span>
                          </div>
                          {i < mainCase.steps.length - 1 && (
                            <span className="text-slate-400 font-bold" aria-hidden="true">
                              →
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Collapsed Technical Tool Calls Box */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowTechDetails(!showTechDetails)}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
                    >
                      <Code className="w-4 h-4 text-slate-400" />
                      <span>{showTechDetails ? 'Hide technical audit calls' : 'Show technical audit calls (Monospace tool trace)'}</span>
                    </button>

                    {showTechDetails && (
                      <div className="mt-3 p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 space-y-2">
                        {mainCase.tool_calls.map((call, i) => (
                          <div key={i} className="border-b border-slate-800/80 pb-2 last:border-0 last:pb-0">
                            <span className="text-indigo-400 font-bold">{call.name}</span>
                            <span className="text-slate-400">({JSON.stringify(call.arguments)})</span>
                            <span className="text-emerald-400 block mt-0.5 ml-4">
                              → {JSON.stringify(call.result)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </article>
          )}

          {/* Secondary Collapsed Decisions for History */}
          <article className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-3">
              <ChevronRight className="w-5 h-5 text-slate-400" />
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  NPTEL Accreditation Verification Batch · 18 Certificates Extracted
                </p>
                <p className="text-xs text-slate-400">Yesterday 4:15 PM · 16 Verified, 2 Flagged (Name Mismatch)</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              Logged
            </span>
          </article>
        </section>
      </main>
    </div>
  );
};

export default TarsActivityView;
