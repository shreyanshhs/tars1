import React, { useState, useMemo } from 'react';
import { useTars } from '../../../context/TarsContext';
import rawScheduleData from '../../../mock/schedule_cse10.json';
import { ChevronLeft, ChevronRight, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';

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
  holiday_name?: string;
  slots: SlotData[];
}

interface ScheduleData {
  section: string;
  room: string;
  semester: string;
  week_label: string;
  days: DayData[];
}

const scheduleData: ScheduleData = rawScheduleData as unknown as ScheduleData;

const glowStyles: Record<string, React.CSSProperties> = {
  'room-pill-emerald': {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    border: '1px solid #10B981',
    color: '#059669',
    boxShadow: '0 0 10px rgba(16, 185, 129, 0.45)',
  },
  'room-pill-orange': {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    border: '1px solid #F97316',
    color: '#D97706',
    boxShadow: '0 0 10px rgba(249, 115, 22, 0.45)',
  },
  'room-pill-indigo': {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    border: '1px solid #4F46E5',
    color: '#4338CA',
    boxShadow: '0 0 10px rgba(79, 70, 229, 0.45)',
  },
  'room-pill-blue': {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    border: '1px solid #2563EB',
    color: '#1D4ED8',
    boxShadow: '0 0 10px rgba(37, 99, 235, 0.45)',
  },
  'room-pill-slate': {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    border: '1px solid #475569',
    color: '#334155',
    boxShadow: '0 0 10px rgba(71, 85, 105, 0.45)',
  },
  'room-pill-violet': {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    border: '1px solid #7C3AED',
    color: '#6D28D9',
    boxShadow: '0 0 10px rgba(124, 58, 237, 0.45)',
  },
};

const subjectColorClasses: Record<string, { bg: string; text: string }> = {
  python: { bg: 'bg-[#EEF2FF]', text: 'text-[#3730A3]' },
  ai: { bg: 'bg-[#F5F3FF]', text: 'text-[#5B21B6]' },
  maths: { bg: 'bg-[#EFF6FF]', text: 'text-[#1E40AF]' },
  chem: { bg: 'bg-[#F0FDFA]', text: 'text-[#115E59]' },
  esc: { bg: 'bg-[#F1F5F9]', text: 'text-[#334155]' },
  english: { bg: 'bg-[#FFFBEB]', text: 'text-[#92400E]' },
  break: { bg: 'bg-[#F1F5F9]', text: 'text-[#475569]' },
};

export const ScheduleWeekView: React.FC<{
  onSwitchView?: (view: 'week' | 'day') => void;
  activeView?: 'week' | 'day';
}> = ({ onSwitchView, activeView = 'week' }) => {
  const [selectedSlot, setSelectedSlot] = useState<SlotData | null>(null);
  const { hasActiveLeave, hodApproved, liveTimetable, timetableStatus } = useTars();
  const isLiveMode = timetableStatus === 'live';
  const isMockMode = timetableStatus === 'mock';

  const processedDays = useMemo(() => {
    return scheduleData.days.map((day) => {
      if (day.day_code !== 'THU' && day.day_code !== 'thu') return day;
      return {
        ...day,
        slots: day.slots.map((slot) => {
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
              faculty: 'Prof. Chaitra D B', // Reconciled strictly to F_CDB baseline
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
    });
  }, [liveTimetable, hasActiveLeave, hodApproved, isLiveMode, isMockMode]);

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-white relative">
      {/* Header bar */}
      <header className="px-8 pt-6 pb-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {scheduleData.week_label}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>Section {scheduleData.section} ({scheduleData.semester}) · Room {scheduleData.room}</span>
            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium border border-slate-200 text-slate-600 bg-slate-50">
              {timetableStatus === 'live' ? 'Authoritative Backend' : timetableStatus === 'mock' ? 'Offline Demo Schedule' : 'Offline Baseline'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Week navigation */}
          <div className="inline-flex items-center rounded-lg bg-slate-50 border border-slate-200 p-0.5 text-xs">
            <button
              type="button"
              aria-label="Previous week"
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
              aria-label="Next week"
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

      {/* Unconfirmed P5 Slot callout modal/banner when clicked */}
      {selectedSlot && selectedSlot.unconfirmed && (
        <div className="mx-8 mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-950">
                {selectedSlot.subject_name} · Slot Occupied &amp; Unconfirmed
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Period 5 (12:30–1:25) is treated as busy (occupied by Mrs. Geetha P L) due to timetable data mismatch with faculty master. TARS will not propose conflicting substitutions.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedSlot(null)}
            className="text-xs text-amber-700 hover:text-amber-900 font-medium px-2 py-0.5 rounded hover:bg-amber-100 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Changed class details callout modal/banner when slot clicked */}
      {selectedSlot && selectedSlot.changed && (
        <div className="mx-8 mt-4 p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200/90 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-indigo-950">
                {selectedSlot.subject_name} · Schedule Updated by TARS
              </p>
              <p className="text-xs text-indigo-800 mt-0.5">
                {selectedSlot.change_note || `Covered by ${selectedSlot.substitute}`} (Approved by HOD Dr. Surekha K B · Substitute confirmation pending).
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedSlot(null)}
            className="text-xs text-indigo-600 hover:text-indigo-900 font-medium px-2 py-0.5 rounded hover:bg-indigo-100 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Calendar Grid */}
      <main className="flex-1 px-8 pb-10 pt-4 overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Day Headers Row: 64px for time label + 6 day columns */}
          <div className="grid grid-cols-[64px_repeat(6,minmax(0,1fr))] items-end pb-3">
            <div />
            {processedDays.map((day) => (
              <div key={day.date} className="text-center flex flex-col items-center">
                <span
                  className={`text-5xl tabular-nums font-medium tracking-tight ${
                    day.is_today
                      ? 'text-slate-900 font-bold'
                      : day.is_holiday
                      ? 'text-slate-400'
                      : 'text-slate-500'
                  }`}
                >
                  {day.day_number}
                </span>
                <span
                  className={`text-xs lowercase mt-0.5 font-medium ${
                    day.is_today ? 'text-slate-900 font-bold' : 'text-slate-500'
                  }`}
                >
                  {day.day_code}
                </span>
                <span
                  className={`w-px h-2 mt-1.5 ${
                    day.is_today ? 'bg-slate-900' : 'bg-slate-200'
                  }`}
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>

          {/* Time & Slots Grid: 
              Rows: 
              1: P1 8:30 (96px)
              2: P2 9:25 (96px)
              3: Tea break (32px)
              4: P3 10:40 (96px)
              5: P4 11:35 (96px)
              6: P5 12:30 (96px)
              7: Lunch break (36px)
              8: P6 2:20 (96px)
              9: P7 3:15 (96px)
          */}
          <div className="grid grid-cols-[64px_repeat(6,minmax(0,1fr))] grid-rows-[96px_96px_32px_96px_96px_96px_36px_96px_96px] relative">
            {/* Soft tint for Today's Column (col-5: Thu 26) */}
            <div
              className="row-start-1 row-span-9 col-start-5 bg-indigo-50/25 rounded-xl pointer-events-none"
              aria-hidden="true"
            />

            {/* Horizontal Hour Lines */}
            <div className="row-start-1 col-start-2 col-span-6 border-t border-slate-100 pointer-events-none" />
            <div className="row-start-2 col-start-2 col-span-6 border-t border-slate-100 pointer-events-none" />
            <div className="row-start-4 col-start-2 col-span-6 border-t border-slate-100 pointer-events-none" />
            <div className="row-start-5 col-start-2 col-span-6 border-t border-slate-100 pointer-events-none" />
            <div className="row-start-6 col-start-2 col-span-6 border-t border-slate-100 pointer-events-none" />
            <div className="row-start-8 col-start-2 col-span-6 border-t border-slate-100 pointer-events-none" />
            <div className="row-start-9 col-start-2 col-span-6 border-t border-slate-100 pointer-events-none" />

            {/* Tea Break Dashed Divider */}
            <div className="row-start-3 col-start-1 pr-3 flex items-center justify-end">
              <span className="text-xs text-slate-400 font-medium lowercase">tea</span>
            </div>
            <div className="row-start-3 col-start-2 col-span-6 flex items-center pointer-events-none">
              <div className="w-full border-t border-dashed border-slate-300" />
            </div>

            {/* Lunch Break Dashed Divider */}
            <div className="row-start-7 col-start-1 pr-3 flex items-center justify-end">
              <span className="text-xs text-slate-400 font-medium lowercase">lunch</span>
            </div>
            <div className="row-start-7 col-start-2 col-span-6 flex items-center pointer-events-none">
              <div className="w-full border-t border-dashed border-slate-300" />
            </div>

            {/* Left Column Time Labels */}
            <div className="row-start-1 col-start-1 pr-3 pt-2 text-right">
              <span className="text-xs text-slate-400 tabular-nums font-medium">8:30 am</span>
            </div>
            <div className="row-start-2 col-start-1 pr-3 pt-2 text-right">
              <span className="text-xs text-slate-400 tabular-nums font-medium">9:25</span>
            </div>
            <div className="row-start-4 col-start-1 pr-3 pt-2 text-right">
              <span className="text-xs text-slate-400 tabular-nums font-medium">10:40</span>
            </div>
            <div className="row-start-5 col-start-1 pr-3 pt-2 text-right">
              <span className="text-xs text-slate-400 tabular-nums font-medium">11:35</span>
            </div>
            <div className="row-start-6 col-start-1 pr-3 pt-2 text-right">
              <span className="text-xs text-slate-400 tabular-nums font-medium">12:30</span>
            </div>
            <div className="row-start-8 col-start-1 pr-3 pt-2 text-right">
              <span className="text-xs text-slate-400 tabular-nums font-medium">2:20 pm</span>
            </div>
            <div className="row-start-9 col-start-1 pr-3 pt-2 text-right">
              <span className="text-xs text-slate-400 tabular-nums font-medium">3:15</span>
            </div>

            {/* Render slots per day */}
            {processedDays.map((day, dayIndex) => {
              const colIndex = dayIndex + 2; // col-start-2 to col-start-7

              // If holiday (Friday 27)
              if (day.is_holiday) {
                return (
                  <div
                    key={`holiday-${day.date}`}
                    style={{ gridColumnStart: colIndex }}
                    className="row-start-1 row-span-9 p-1.5"
                  >
                    <div className="h-full rounded-xl bg-slate-100 p-4 flex flex-col items-center justify-center text-center">
                      <span className="text-sm font-semibold text-slate-600">Holiday</span>
                      <span className="text-xs text-slate-400 mt-1">{day.holiday_name}</span>
                    </div>
                  </div>
                );
              }

              return day.slots.map((slot) => {
                let rowStart = 1;
                if (slot.period_start === 1) rowStart = 1;
                else if (slot.period_start === 2) rowStart = 2;
                else if (slot.period_start === 3) rowStart = 4;
                else if (slot.period_start === 4) rowStart = 5;
                else if (slot.period_start === 5) rowStart = 6;
                else if (slot.period_start === 6) rowStart = 8;
                else if (slot.period_start === 7) rowStart = 9;

                const rowSpan = slot.span > 1 ? 2 : 1;
                const colors = subjectColorClasses[slot.subject_type] || {
                  bg: 'bg-slate-100',
                  text: 'text-slate-800',
                };
                const pillStyle = slot.room_pill ? glowStyles[slot.room_pill] : undefined;

                const isThuP4 = day.is_today && slot.period_start === 4;

                return (
                  <div
                    key={slot.id}
                    style={{
                      gridRowStart: rowStart,
                      gridRowEnd: `span ${rowSpan}`,
                      gridColumnStart: colIndex,
                    }}
                    className="p-1 relative group cursor-pointer"
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {/* Indigo 'Now' line at 11:47 AM on Thursday P4 */}
                    {isThuP4 && (
                      <div
                        className="absolute left-0 right-0 top-3 z-10 flex items-center pointer-events-none"
                        aria-hidden="true"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 -ml-1 shrink-0 ring-2 ring-white" />
                        <div className="h-0.5 flex-1 bg-indigo-600" />
                      </div>
                    )}

                    <div
                      className={`h-full rounded-xl ${colors.bg} p-2.5 flex flex-col justify-between transition-all duration-150 group-hover:shadow-sm relative`}
                    >
                      {/* Changed indicator dot */}
                      {slot.changed && (
                        <span
                          title={slot.change_note || 'Changed by TARS'}
                          className="w-2.5 h-2.5 rounded-full bg-indigo-600 absolute top-3 right-3 ring-2 ring-white animate-pulse"
                          aria-hidden="true"
                        />
                      )}

                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span
                          className={`text-sm font-semibold tracking-tight truncate ${colors.text}`}
                        >
                          {slot.subject_name}
                        </span>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {slot.time}
                        </span>
                      </div>

                      {/* Room tag with glow if lab or designated room */}
                      {slot.room && (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span
                            style={pillStyle}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium tracking-wide whitespace-nowrap ${
                              !pillStyle ? 'bg-white/90 text-slate-600 border border-slate-200' : ''
                            }`}
                          >
                            {slot.room}
                          </span>
                          {slot.changed && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-indigo-700 font-semibold bg-white/90 px-1.5 py-0.5 rounded-full border border-indigo-200">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              TARS
                            </span>
                          )}
                          {slot.unconfirmed && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-800 font-semibold bg-amber-100/90 px-1.5 py-0.5 rounded-full border border-amber-300">
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                              Unconfirmed
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            })}
          </div>
        </div>
      </main>
    </div>
  );
};
