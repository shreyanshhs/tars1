import React, { useState } from 'react';
import { useTars } from '../../context/TarsContext';
import {
  Zap,
  AlertTriangle,
  CheckCircle2,
  Send,
  Wrench,
} from 'lucide-react';

export const AdminConsoleView: React.FC = () => {
  const {
    incidentText,
    setIncidentText,
    reasoningLogs,
    isReplanRunning,
    relocationDiff,
    triggerTarsReplan,
    nudgeAllFaculty,
    facultyNudgeTriggered,
    kpiStats,
  } = useTars();

  const [blastRadiusModal, setBlastRadiusModal] = useState(false);
  const [ticketRaised, setTicketRaised] = useState(false);

  const presets = [
    { label: '+ Quick Room Lockout', text: 'Room 302 locked out due to projector optical handshake failure.' },
    { label: '+ Equipment Failure', text: 'Hardware Lab 1 FPGA benches down for scheduled circuit calibration.' },
    { label: '+ Surprise Guest Lecture', text: 'Guest Lecture by Google DeepMind researcher scheduled for 15:00 PM.' },
  ];

  const handlePresetClick = (presetText: string) => {
    setIncidentText(presetText);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200/80 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Mission Control</h1>
            <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded border border-slate-300/60">
              CLUSTER-SOUTH-01
            </span>
          </div>
          <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
            <span className="font-medium text-slate-600">
              Autonomous Campus Scheduling &amp; Real-Time Conflict Resolution Engine
            </span>
            <span className="text-slate-300">•</span>
            <span>Scope: CSE (Sem 1-8)</span>
            <span className="text-slate-300">•</span>
            <span>Sync: 12s ago</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>ENGINE STATE: AUTONOMOUS INTERVENTION ACTIVE</span>
        </div>
      </div>

      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider">
            <span>Auto Re-plans (30D)</span>
            <span className="px-1.5 py-0.2 rounded font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
              OPTIMAL
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{kpiStats.autoReplans}</span>
            <span className="text-xs font-semibold text-emerald-600">+12 vs. prev</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>vs. manual avg</span>
            <span className="font-semibold text-slate-700">100% matched</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider">
            <span>Classes Lost</span>
            <span className="px-1.5 py-0.2 rounded font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
              100% SLA
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{kpiStats.classesLost}</span>
            <span className="text-xs font-medium text-slate-400">/ 1,480 total</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>0 hrs dropped</span>
            <span className="font-semibold text-emerald-600">zero downtime</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider">
            <span>Nudges Acted On</span>
            <span className="px-1.5 py-0.2 rounded font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200">
              PROACTIVE
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{kpiStats.nudgesActedOn}</span>
            <span className="text-xs font-semibold text-indigo-600">84.8% conv</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Response latency</span>
            <span className="font-semibold text-slate-700">&lt; 32 min window</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider">
            <span>Recovered &gt;75% Att.</span>
            <span className="px-1.5 py-0.2 rounded font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
              RESCUED
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{kpiStats.recoveredAtt}</span>
            <span className="text-xs font-medium text-slate-400">students flagged</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>At-risk protocol</span>
            <span className="font-semibold text-emerald-600">0 recidivism</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left 8 cols, Right 4 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns */}
        <div className="lg:col-span-8 space-y-6">
          {/* Incident Reporter Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-slate-900 text-sm">Report Schedule Disruption / Incident</h3>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-500 font-medium">Manual Override</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200">
                  WhatsApp Webhook
                </span>
              </div>
            </div>

            {/* Incident Text Area */}
            <div className="relative">
              <textarea
                rows={2}
                value={incidentText}
                onChange={(e) => setIncidentText(e.target.value)}
                placeholder="Enter incident or simulated disruption..."
                className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none pr-8"
              />
              {incidentText && (
                <button
                  onClick={() => setIncidentText('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase text-slate-400">Inject Preset:</span>
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handlePresetClick(p.text)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Actions Bar */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
              <div className="flex items-center space-x-1.5 text-xs text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Constraint Solver Engine v4.2 Ready</span>
              </div>

              <div className="flex items-center space-x-2.5">
                <button
                  onClick={() => setBlastRadiusModal(!blastRadiusModal)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Simulate Blast Radius
                </button>

                <button
                  onClick={() => triggerTarsReplan()}
                  disabled={isReplanRunning}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-all disabled:opacity-50"
                >
                  <Zap className={`w-3.5 h-3.5 ${isReplanRunning ? 'animate-bounce' : ''}`} />
                  <span>{isReplanRunning ? 'TARS Re-planning...' : '⚡ Let TARS re-plan'}</span>
                </button>
              </div>
            </div>

            {/* Blast radius simulator panel */}
            {blastRadiusModal && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="font-bold text-slate-800">Simulated Blast Radius Analysis:</div>
                <div className="text-slate-600">
                  • 1 faculty absence affects <strong>124 students</strong> across CSE-A &amp; CSE-C.
                </div>
                <div className="text-slate-600">
                  • Relocation to 14:00 PM requires shifting open lab time. Zero elective clashes.
                </div>
              </div>
            )}
          </div>

          {/* Live Reasoning Trace Card */}
          <div className="bg-slate-950 text-slate-200 rounded-2xl border border-slate-800 p-5 shadow-md font-mono text-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-[11px]">
              <div className="flex items-center space-x-3">
                <span className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Live Reasoning Trace (#9084)</span>
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">Constraints Solved (14)</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">Telemetry</span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-slate-400">4.2 s execution</span>
                <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-bold">
                  SUCCESS
                </span>
              </div>
            </div>

            {/* Log streams */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {reasoningLogs.map((log) => {
                const tagColor =
                  log.tag === 'SIGNAL'
                    ? 'text-purple-400 bg-purple-950/60 border-purple-800/80'
                    : log.tag === 'GRAPH'
                    ? 'text-blue-400 bg-blue-950/60 border-blue-800/80'
                    : log.tag === 'HEURISTIC'
                    ? 'text-cyan-400 bg-cyan-950/60 border-cyan-800/80'
                    : log.tag === 'CONSTRAINT'
                    ? 'text-amber-400 bg-amber-950/60 border-amber-800/80'
                    : log.tag === 'CONFLICT'
                    ? 'text-rose-400 bg-rose-950/60 border-rose-800/80'
                    : log.tag === 'DISPATCH'
                    ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/80'
                    : log.tag === 'ESCALATION'
                    ? 'text-yellow-400 bg-yellow-950/60 border-yellow-800/80'
                    : 'text-slate-400 bg-slate-900 border-slate-800';

                return (
                  <div key={log.id} className="leading-relaxed flex items-start space-x-2">
                    <span className="text-slate-500 select-none flex-shrink-0">[{log.timestamp}]</span>
                    {log.tag !== 'IDLE' && (
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border flex-shrink-0 ${tagColor}`}>
                        {log.tag}
                      </span>
                    )}
                    <span className={log.tag === 'IDLE' ? 'text-slate-500 font-semibold' : 'text-slate-300'}>
                      {log.message}
                    </span>
                  </div>
                );
              })}
              {isReplanRunning && (
                <div className="text-indigo-400 animate-pulse font-semibold">
                  &gt; Computing optimal heuristic slot matrix...
                </div>
              )}
            </div>
          </div>

          {/* Proposed Relocation Diff */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Proposed Relocation Diff (Pre-Approved)</h3>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                ZERO STUDENT CONFLICTS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Original Slot */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Original Slot</div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-700">{relocationDiff.original.time}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    {relocationDiff.original.statusBadge}
                  </span>
                </div>
                <h4 className="font-bold text-slate-800 text-sm mt-1">{relocationDiff.original.course}</h4>
                <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
                  <span>{relocationDiff.original.faculty}</span>
                  <span className="font-mono">{relocationDiff.original.room}</span>
                </div>
              </div>

              {/* Optimized Slot */}
              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Optimized Slot</div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-indigo-950">{relocationDiff.optimized.time}</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                      {relocationDiff.optimized.statusBadge}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                      {relocationDiff.optimized.routedBadge}
                    </span>
                  </div>
                </div>
                <h4 className="font-bold text-slate-900 text-sm mt-1">{relocationDiff.optimized.course}</h4>
                <div className="text-xs text-slate-600 flex items-center justify-between pt-1">
                  <span className="font-medium text-indigo-900">{relocationDiff.optimized.faculty}</span>
                  <span className="font-mono font-semibold text-emerald-700">{relocationDiff.optimized.room}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Columns: Operational Intel, Pending Actions, Heatmap */}
        <div className="lg:col-span-4 space-y-6">
          {/* Operational Intel */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Operational Intel</h3>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                HARDWARE BOTTLENECK
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 text-xs">ROOM 302 Caused 6 of 38 Reschedules</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Recurring hardware fault: HDMI / Ceiling Projector optical handshake fails consistently on Tuesday &amp;
                Friday afternoons.
              </p>
              <div className="text-[11px] text-rose-600 font-semibold pt-1">
                Accumulated downtime: 9 hrs instruction lost
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={() => setTicketRaised(true)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center space-x-1"
              >
                <Wrench className="w-3 h-3" />
                <span>{ticketRaised ? 'Ticket #8843 Raised ✓' : 'Raise Repair Ticket'}</span>
              </button>
              <button
                onClick={() => alert('Viewing diagnostic hardware logs for Room 302...')}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Logs →
              </button>
            </div>
          </div>

          {/* Pending Actions */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Pending Actions</h3>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                ACTION REQUIRED
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              5 faculty haven&apos;t submitted internal evaluation marks. Institutional accreditation deadline in 2 days
              (22 Nov).
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800">Dr. A. Sen</span>
                  <div className="text-[10px] text-slate-400">Dept. Mathematics - Calculus II</div>
                </div>
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                  Overdue 4d
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800">Dr. P. Iyer</span>
                  <div className="text-[10px] text-slate-400">Dept. Physics - Quantum Mech</div>
                </div>
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                  Overdue 2d
                </span>
              </div>

              <div className="text-[11px] text-slate-400 pl-1">+ 3 other faculty (Dr. Joshi, Dr. Bhat, Dr. Nair)</div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={nudgeAllFaculty}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {facultyNudgeTriggered ? 'Dispatched WhatsApp & Email Nudges ✓' : '▶ Nudge all 5 via WhatsApp & Email'}
                </span>
              </button>
              <div className="text-center">
                <button
                  onClick={() => alert('Template: "Dear Faculty, reminder to upload internal marks before Nov 22 to prevent institutional accreditation penalty."')}
                  className="text-[11px] text-slate-500 hover:text-slate-800 hover:underline"
                >
                  Preview Automated Nudge Template
                </button>
              </div>
            </div>
          </div>

          {/* Room Disruption Heatmap */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Room Disruption Heatmap</h3>
              <span className="font-mono text-[10px] text-slate-400">WK51-57</span>
            </div>

            {/* Heatmap Matrix */}
            <div className="space-y-1.5 text-[11px]">
              <div className="grid grid-cols-7 gap-1 text-center font-bold text-slate-400">
                <div>Room</div>
                <div>M</div>
                <div>T</div>
                <div>W</div>
                <div>T</div>
                <div>F</div>
                <div>S</div>
              </div>

              {[
                { name: 'RM 1', vals: [0, 1, 0, 0, 1, 0] },
                { name: 'RM 2', vals: [1, 0, 2, 0, 0, 0] },
                { name: 'RM 3', vals: [2, 7, 1, 2, 8, 0] }, // Room 302 critical hotspot
                { name: 'RM 4', vals: [0, 0, 1, 0, 0, 0] },
                { name: 'Lab 1', vals: [0, 1, 0, 0, 0, 0] },
                { name: 'Audi 1', vals: [0, 0, 0, 1, 0, 0] },
              ].map((row) => (
                <div key={row.name} className="grid grid-cols-7 gap-1 items-center">
                  <div className="font-mono text-[10px] text-slate-500">{row.name}</div>
                  {row.vals.map((v, i) => {
                    const color =
                      v === 0
                        ? 'bg-slate-100 text-slate-400'
                        : v < 3
                        ? 'bg-emerald-100 text-emerald-800 font-bold'
                        : v < 6
                        ? 'bg-amber-200 text-amber-900 font-bold'
                        : 'bg-rose-500 text-white font-extrabold';
                    return (
                      <div
                        key={i}
                        className={`h-5 rounded flex items-center justify-center text-[10px] ${color}`}
                        title={`${row.name} Day ${i + 1}: ${v} disruptions`}
                      >
                        {v > 0 ? v : ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
              <span>Scale: 0 (stable)</span>
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded bg-slate-200"></span>
                <span className="w-2 h-2 rounded bg-emerald-200"></span>
                <span className="w-2 h-2 rounded bg-amber-300"></span>
                <span className="w-2 h-2 rounded bg-rose-500"></span>
              </div>
              <span className="text-rose-600 font-bold">8+ (Critical Hotspot)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
