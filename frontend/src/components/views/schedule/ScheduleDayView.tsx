import React, { useMemo } from 'react';
import { useTars } from '../../../context/TarsContext';
import rawScheduleData from '../../../mock/schedule_cse10.json';
import { ChevronLeft, ChevronRight, Sparkles, CheckCircle2, Clock, MapPin, User as UserIcon, AlertTriangle } from 'lucide-react';

interface SlotData {
  id: number;
  period: string;
  period_start: number;
  span: number;
  time: string;
  subject_code: string;
  subject_name: string;
  subject_type: string;
  is_lab?: boolean;
  room?: string;
  room_pill?: string;
  faculty?: string;
  original_faculty?: string;
  changed?: boolean;
  substitute?: string;
  change_note?: string;
  status?: string;
  unconfirmed?: boolean;
}

interface DayData {
  date: string;
  day_code: string;
  day_number: string;
  is_today: boolean;
  is_holiday: boolean;
  slots: SlotData[];
}

interface ScheduleData {
  section: string;
  room: string;
  semester: string;
  week_label: string;
  days: DayData[];
}

const scheduleData = rawScheduleData as unknown as ScheduleData;

export const ScheduleDayView: React.FC<{
  onSwitchView?: (view: 'week' | 'day') => void;
  activeView?: 'week' | 'day';
}> = ({ onSwitchView, activeView = 'day' }) => {
  const { hasActiveLeave, hodApproved, liveTimetable, timetableStatus } = useTars();
  const isLiveMode = timetableStatus === 'live';
  const isMockMode = timetableStatus === 'mock';

  const rawToday = scheduleData.days.find((d) => d.is_today) || scheduleData.days[3];
  const todayData = useMemo(() => {
    return {
      ...rawToday,
      slots: rawToday.slots.map((slot) => {
        // Thursday P4: 11:35 - 12:30 Intro to AI
        if (slot.id === 119 || slot.id === 104 || slot.period_start === 4) {
          const liveMatch = liveTimetable?.find(
            (s) => (s.day === 'THU' || s.day === 'thu') && (s.period === 4 || s.period === '4' || s.period === 'P4')
          );
          const isSlotReplanned = isLiveMode
            ? liveMatch?.status === 'replanned'
            : isMockMode && hasActiveLeave && hodApproved;

          if (isSlotReplanned) {
            const subFaculty = liveMatch?.faculty_name || 'Mr. Syed Matheen Pasha';
            return {
              ...slot,
              faculty: subFaculty,
              original_faculty: 'Prof. Chaitra D B',
              changed: true,
              status: 're-planned',
              substitute: subFaculty,
              change_note: 'HOD approved · Substitute confirmation pending',
            };
          }
          return {
            ...slot,
            faculty: 'Prof. Chaitra D B',
            original_faculty: undefined,
            changed: false,
            status: 'scheduled',
            substitute: undefined,
            change_note: undefined,
          };
        }

        // Thursday P5: 12:30 - 1:25 Python (Unconfirmed - Timetable Data Mismatch)
        if (slot.id === 120 || slot.period_start === 5) {
          return {
            ...slot,
            subject_code: 'UNCONFIRMED-PLC',
            subject_name: 'Python (Unconfirmed — timetable data mismatch)',
            faculty: 'Mrs. Geetha P L',
            unconfirmed: true,
            status: 'scheduled',
            changed: false,
            substitute: undefined,
            change_note: undefined,
          };
        }

        // Thursday P6-P7: 2:20 - 4:10 Python Lab
        if (slot.id === 121 || slot.id === 106 || slot.period_start === 6) {
          const liveMatch = liveTimetable?.find(
            (s) =>
              (s.day === 'THU' || s.day === 'thu') &&
              (s.period === '6-7' || s.period === 6 || s.period === 7 || s.period === 'P6-P7')
          );
          const isSlotReplanned = isLiveMode
            ? liveMatch?.status === 'replanned'
            : isMockMode && hasActiveLeave && hodApproved;

          if (isSlotReplanned) {
            const subFaculty = liveMatch?.faculty_name || 'Mrs. Geetha P L';
            return {
              ...slot,
              faculty: subFaculty,
              original_faculty: 'Prof. Chaitra D B',
              changed: true,
              status: 're-planned',
              substitute: subFaculty,
              change_note: 'HOD approved · Substitute confirmation pending',
            };
          }
          return {
            ...slot,
            faculty: 'Prof. Chaitra D B', // Reconciled to F_CDB baseline!
            original_faculty: undefined,
            changed: false,
            status: 'scheduled',
            substitute: undefined,
            change_note: undefined,
          };
        }

        return slot;
      }),
    };
  }, [rawToday, liveTimetable, hasActiveLeave, hodApproved, isLiveMode, isMockMode]);

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-white relative">
      {/* Header bar */}
      <header className="px-8 pt-6 pb-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            Thursday, 26 November 2026
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>Section {scheduleData.section} ({scheduleData.semester}) · Today's Timetable</span>
            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium border border-slate-200 text-slate-600 bg-slate-50">
              {timetableStatus === 'live' ? 'Authoritative Backend' : timetableStatus === 'mock' ? 'Offline Demo Schedule' : 'Offline Baseline'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Day navigation */}
          <div className="inline-flex items-center rounded-lg bg-slate-50 border border-slate-200 p-0.5 text-xs">
            <button
              type="button"
              className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="px-2.5 py-1 rounded text-slate-900 font-medium hover:bg-white transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day / Week Switcher */}
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => onSwitchView?.('day')}
              className={`px-3 py-1 rounded transition-colors ${
                activeView === 'day'
                  ? 'bg-white text-indigo-600 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => onSwitchView?.('week')}
              className={`px-3 py-1 rounded transition-colors ${
                activeView === 'week'
                  ? 'bg-white text-indigo-600 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </header>

      {/* Timetable API unavailable alert */}
      {timetableStatus === 'unavailable' && (
        <div className="mx-8 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Timetable API unavailable · Displaying verified baseline schedule</span>
          </div>
          <span className="text-[11px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Baseline Mode</span>
        </div>
      )}

      {/* Main Single Wide Column */}
      <main className="flex-1 max-w-4xl px-8 py-6 space-y-4">
        {todayData.slots.map((slot) => {
          const isCurrent = slot.period_start === 4;

          return (
            <div
              key={slot.id}
              className={`p-5 rounded-2xl border transition-all duration-150 ${
                isCurrent
                  ? 'bg-indigo-50/40 border-indigo-200 shadow-sm ring-1 ring-indigo-300'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 shrink-0">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Period</span>
                    <span className="text-lg font-bold text-slate-900 tabular-nums">{slot.period}</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{slot.subject_name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                        {slot.subject_code}
                      </span>
                      {slot.changed && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          Changed by TARS
                        </span>
                      )}
                      {slot.unconfirmed && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Occupied · Unconfirmed
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {slot.time}
                      </span>
                      {slot.room && (
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {slot.room}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                        {slot.faculty}
                        {slot.original_faculty && (
                          <span className="text-slate-400 line-through ml-1">
                            (was {slot.original_faculty})
                          </span>
                        )}
                      </span>
                    </div>

                    {slot.change_note && (
                      <div className="mt-3 p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-900 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>{slot.change_note}</span>
                      </div>
                    )}

                    {slot.unconfirmed && (
                      <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Period 5 is treated as busy (occupied by Mrs. Geetha P L) due to timetable data mismatch with faculty master. TARS will not propose conflicting substitutions.</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  {isCurrent ? (
                    <span className="px-2.5 py-1 rounded-full bg-indigo-600 text-white text-xs font-medium">
                      Active Now
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                      {slot.period_start < 4 ? 'Completed' : 'Upcoming'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
};
