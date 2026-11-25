import React, { useState } from 'react';
import { useTars } from '../../context/TarsContext';
import {
  Filter,
  Share2,
  MoreVertical,
  Calendar,
  CheckCircle2,
  RotateCcw,
  Info,
} from 'lucide-react';

export const NudgesView: React.FC = () => {
  const { nudges, selectedNudgeId, setSelectedNudgeId, handleNudgeAction } = useTars();
  const [filterActive, setFilterActive] = useState(false);
  const [isReevaluating, setIsReevaluating] = useState(false);

  const selectedNudge = nudges.find((n) => n.id === selectedNudgeId) || nudges[0];

  const triggerReevaluate = () => {
    setIsReevaluating(true);
    setTimeout(() => {
      setIsReevaluating(false);
    }, 800);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Top telemetry bar */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200/80 gap-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-sm font-bold text-slate-900">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Autonomous Intervention Engine</span>
          </div>
          <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-md">
            STREAM: LIVE
          </span>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-md">
            QUEUE-HEALTH: OPTIMAL (99.8%)
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="hidden md:flex items-center space-x-2 text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded border border-slate-200/60">
            <span>J / K NAVIGATE</span>
            <span>•</span>
            <span>ENTER EXECUTE</span>
          </div>

          <button
            onClick={triggerReevaluate}
            disabled={isReevaluating}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-all"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-indigo-600 ${isReevaluating ? 'animate-spin' : ''}`} />
            <span>{isReevaluating ? 'Re-evaluating...' : 'Re-evaluate'}</span>
          </button>
        </div>
      </div>

      {/* Split master-detail layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Inbox Column (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-sm">Inbox</h3>
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
                {nudges.filter((n) => n.status === 'pending').length}
              </span>
            </div>
            <button
              onClick={() => setFilterActive(!filterActive)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
            >
              <Filter className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* List items */}
          <div className="divide-y divide-slate-100">
            {nudges.map((nudge) => {
              const isSelected = nudge.id === selectedNudgeId;
              const isResolved = nudge.status !== 'pending';

              const dotColor =
                nudge.category === 'DEADLINE'
                  ? 'bg-rose-500'
                  : nudge.category === 'ATTENDANCE'
                  ? 'bg-amber-500'
                  : 'bg-indigo-500';

              return (
                <div
                  key={nudge.id}
                  onClick={() => setSelectedNudgeId(nudge.id)}
                  className={`p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600'
                      : 'hover:bg-slate-50/80 border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <div className="flex items-center space-x-1.5 font-bold">
                      <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                      <span className="text-slate-600">{nudge.category}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500 font-mono">{nudge.courseCode}</span>
                    </div>
                    <span className="text-slate-400 font-medium">{nudge.dueText}</span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-xs mt-1">{nudge.title}</h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{nudge.snippet}</p>

                  {isResolved && (
                    <div className="mt-2 inline-flex items-center space-x-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{nudge.status === 'blocked' ? 'Blocked on Calendar' : nudge.status}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Detail Column (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
          {/* Header metadata */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2 text-xs font-bold text-rose-600">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span className="uppercase">{selectedNudge.category} INTERVENTION</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-600 font-mono">{selectedNudge.courseCode}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 font-normal">Due {selectedNudge.dueText}</span>
            </div>

            <div className="flex items-center space-x-2 text-slate-400">
              <button className="p-1 hover:text-slate-600 hover:bg-slate-100 rounded">
                <Share2 className="w-4 h-4" />
              </button>
              <button className="p-1 hover:text-slate-600 hover:bg-slate-100 rounded">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Headline & Body */}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{selectedNudge.headline}</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{selectedNudge.description}</p>
          </div>

          {/* Recommended Plan */}
          <div className="space-y-3 pt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Recommended Plan</div>

            {/* Step 01 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start space-x-3.5">
              <span className="font-mono text-xs font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md mt-0.5">
                01
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-800">{selectedNudge.plan.slotTitle}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{selectedNudge.plan.slotDesc}</p>
              </div>
            </div>

            {/* Step 02 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start space-x-3.5">
              <span className="font-mono text-xs font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md mt-0.5">
                02
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-800">{selectedNudge.plan.setupTitle}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{selectedNudge.plan.setupDesc}</p>
              </div>
            </div>

            {/* Step 03 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start space-x-3.5">
              <span className="font-mono text-xs font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md mt-0.5">
                03
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-800">{selectedNudge.plan.sanctuaryTitle}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{selectedNudge.plan.sanctuaryDesc}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            {selectedNudge.status === 'blocked' ? (
              <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Blocked 10:00–11:00 AM on Calendar</span>
              </div>
            ) : selectedNudge.status === 'completed' ? (
              <div className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-slate-500" />
                <span>Marked Done</span>
              </div>
            ) : (
              <>
                <button
                  onClick={() => handleNudgeAction(selectedNudge.id, 'block')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-2 transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Block 10:00–11:00 AM on Calendar</span>
                </button>
                <button
                  onClick={() => handleNudgeAction(selectedNudge.id, 'snooze')}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                >
                  Snooze (2h)
                </button>
                <button
                  onClick={() => handleNudgeAction(selectedNudge.id, 'done')}
                  className="px-3.5 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold transition-colors"
                >
                  Mark Done
                </button>
              </>
            )}
          </div>

          {/* Escalation watchdog disclaimer */}
          <div className="pt-4 border-t border-slate-100 flex items-start space-x-2 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
            <p>
              TARS will coordinate with Dr. Arvind Swaminathan if this intervention is deferred consecutively.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
