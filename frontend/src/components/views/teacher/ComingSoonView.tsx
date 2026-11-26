import React from 'react';
import { School, CheckSquare, Sparkles } from 'lucide-react';

interface ComingSoonViewProps {
  feature: 'classes' | 'attendance';
}

export const ComingSoonView: React.FC<ComingSoonViewProps> = ({ feature }) => {
  const isClasses = feature === 'classes';

  return (
    <div className="flex-1 min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-[#CBD5E1] rounded-2xl p-8 flex flex-col items-center text-center gap-4 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5]">
          {isClasses ? <School className="w-7 h-7" /> : <CheckSquare className="w-7 h-7" />}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="inline-flex items-center gap-1 mx-auto px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
            <Sparkles className="w-3 h-3 text-[#4F46E5]" />
            <span>ROADMAP · BETA</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {isClasses ? 'My Classes' : 'Take Attendance'}
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
            {isClasses
              ? 'Google Classroom syncing and course material distribution will be enabled in the next deployment.'
              : 'Direct Contineo biometric sync and batch attendance freeze automation are scheduled for Phase 2.'}
          </p>
        </div>

        <div className="pt-2">
          <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50/70 px-3 py-1.5 rounded-lg border border-indigo-100">
            Current priority: Leave Resolution & Substitution Workflow
          </span>
        </div>
      </div>
    </div>
  );
};
