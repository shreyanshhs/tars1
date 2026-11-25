import React, { useState } from 'react';
import { useTars } from '../../context/TarsContext';
import {
  RotateCcw,
  Calendar,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';

export const ScheduleView: React.FC = () => {
  const { scheduleSlots, facultyStatuses, roomStatuses } = useTars();
  const [viewMode, setViewMode] = useState<'week' | 'day' | 'faculty' | 'rooms'>('week');
  const [calendarSynced, setCalendarSynced] = useState(false);
  const [isReevaluating, setIsReevaluating] = useState(false);

  const days: ('MON' | 'TUE' | 'WED' | 'THU' | 'FRI')[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const dayNumbers: Record<string, string> = {
    MON: '17',
    TUE: '18',
    WED: '19',
    THU: '20',
    FRI: '21',
  };

  const timeRows = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];

  const handleSyncCalendar = () => {
    setCalendarSynced(true);
    setTimeout(() => setCalendarSynced(false), 2500);
  };

  const handleReevaluate = () => {
    setIsReevaluating(true);
    setTimeout(() => setIsReevaluating(false), 900);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200/80 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Academic Schedule: Section CSE-A</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Week 12: Nov 17 – Nov 22, 2024 • B.Tech Computer Science &amp; Engineering
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* View Toggles */}
          <div className="flex items-center bg-slate-200/70 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'week' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Week view
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'day' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Day view
            </button>
            <button
              onClick={() => setViewMode('faculty')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'faculty' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Faculty
            </button>
            <button
              onClick={() => setViewMode('rooms')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'rooms' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rooms
            </button>
          </div>

          {/* Week navigator */}
          <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs">
            <button className="p-1 hover:bg-slate-100 rounded text-slate-500">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-semibold text-slate-700 px-1.5">Current</span>
            <button className="p-1 hover:bg-slate-100 rounded text-slate-500">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Re-evaluate CTA */}
          <button
            onClick={handleReevaluate}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isReevaluating ? 'animate-spin' : ''}`} />
            <span>Re-evaluate</span>
          </button>
        </div>
      </div>

      {/* Legend & Interval bar */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 bg-white border border-slate-200/80 px-4 py-2.5 rounded-xl shadow-xs">
        <div className="flex items-center space-x-5">
          <span className="text-[11px] font-bold uppercase text-slate-400">Legend</span>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-300"></span>
            <span>Lecture</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-700"></span>
            <span>Lab</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600"></span>
            <span className="font-semibold text-indigo-700">TARS Re-planned</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
            <span>Cancelled</span>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-400">Grid: 45 min intervals</div>
      </div>

      {/* Main Grid & Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Weekly Matrix Grid (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs overflow-x-auto">
          {/* Matrix Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 min-w-[600px]">
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-sm">Weekly Matrix</h3>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                CSE-A • Sem 1
              </span>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <span className="flex items-center space-x-1 text-rose-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>Rm 302 Locked</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center space-x-1 text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Grid Synced</span>
              </span>
            </div>
          </div>

          {/* Timetable Table */}
          <div className="mt-4 min-w-[620px]">
            {/* Table Header */}
            <div className="grid grid-cols-6 gap-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">
              <div>Time</div>
              {days.map((day) => (
                <div key={day} className="flex flex-col items-center">
                  <span className="text-[11px] text-slate-400">{day}</span>
                  <span className="text-sm font-extrabold text-slate-800">{dayNumbers[day]}</span>
                </div>
              ))}
            </div>

            {/* Time Slot Rows */}
            <div className="divide-y divide-slate-100 mt-1">
              {timeRows.map((time) => {
                if (time === '12:00') {
                  return (
                    <div key={time} className="py-2.5 my-1">
                      <div className="w-full bg-amber-50/70 border border-amber-200/70 rounded-xl py-2 px-4 text-center text-xs font-semibold text-amber-800 flex items-center justify-center space-x-2">
                        <span>🍴</span>
                        <span>Recess &amp; Refectory Window (12:00 – 13:00)</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={time} className="grid grid-cols-6 gap-2 py-2 items-stretch">
                    {/* Time Label */}
                    <div className="flex items-center justify-center font-mono text-xs font-semibold text-slate-400">
                      {time}
                    </div>

                    {/* 5 Day Cells */}
                    {days.map((day) => {
                      const slot = scheduleSlots.find((s) => s.time === time && s.day === day);
                      if (!slot) {
                        return (
                          <div
                            key={day}
                            className="p-2 rounded-xl bg-slate-50/50 border border-dashed border-slate-200 text-center text-[10px] text-slate-400 flex items-center justify-center min-h-[64px]"
                          >
                            Free
                          </div>
                        );
                      }

                      const isReplaced = slot.status === 're-planned';
                      const isLocked = slot.room === 'Rm 302';

                      return (
                        <div
                          key={day}
                          className={`p-2 rounded-xl border text-left flex flex-col justify-between transition-all min-h-[68px] ${
                            isReplaced
                              ? 'bg-indigo-50/80 border-indigo-300 shadow-xs ring-1 ring-indigo-200'
                              : isLocked
                              ? 'bg-rose-50/50 border-rose-200'
                              : 'bg-white border-slate-200/80 hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <h5 className="font-bold text-slate-900 text-[11px] truncate">{slot.subject}</h5>
                              {isReplaced && (
                                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">{slot.room}</span>
                          </div>
                          <div className="text-[10px] font-medium text-slate-500 truncate mt-1">
                            {slot.faculty}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer of Matrix */}
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center space-x-1.5 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Push &amp; Digital Signage in sync</span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => alert('Printing Section CSE-A weekly PDF timetable...')}
                className="hover:text-slate-800 transition-colors"
              >
                Print PDF
              </button>
              <button
                onClick={() => alert('Timetable rules: Max 28 contact hrs/wk, 1 lab block daily, min 1 recess window.')}
                className="hover:text-slate-800 transition-colors"
              >
                Timetable Rules
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Faculty & Rooms Status (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Faculty Status */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Faculty Status</h3>
              <span className="text-[11px] text-slate-400">4 Monitored</span>
            </div>

            <div className="mt-3.5 space-y-3">
              {facultyStatuses.map((fac) => (
                <div key={fac.name} className="flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          fac.status === 'Active'
                            ? 'bg-emerald-500'
                            : fac.status === 'Away'
                            ? 'bg-rose-500'
                            : fac.status === 'Available'
                            ? 'bg-emerald-400'
                            : 'bg-slate-400'
                        }`}
                      ></span>
                      <span className="font-bold text-slate-800">{fac.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 ml-3.5">{fac.location}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      fac.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : fac.status === 'Away'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : fac.status === 'Available'
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {fac.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Rooms & Labs */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Rooms &amp; Labs</h3>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                98% Normal
              </span>
            </div>

            <div className="mt-3.5 space-y-3">
              {roomStatuses.map((rm) => (
                <div key={rm.name} className="flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          rm.status === 'In Use'
                            ? 'bg-blue-500'
                            : rm.status === 'Locked'
                            ? 'bg-rose-500'
                            : rm.status === 'Available'
                            ? 'bg-emerald-500'
                            : 'bg-slate-400'
                        }`}
                      ></span>
                      <span className="font-bold text-slate-800">{rm.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 ml-3.5">{rm.note}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      rm.status === 'In Use'
                        ? 'bg-blue-50 text-blue-700'
                        : rm.status === 'Locked'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : rm.status === 'Available'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {rm.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Sync & Export */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Sync &amp; Export</h3>

            <button
              onClick={handleSyncCalendar}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center space-x-2 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{calendarSynced ? 'Synced to Google Calendar ✓' : 'Sync to Calendar'}</span>
            </button>

            <button
              onClick={() => alert('Downloading official CSE-A schedule timetable PDF...')}
              className="w-full py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>

            <div className="pt-2 text-center">
              <button
                onClick={() => alert('Feed URL copied to clipboard: webcal://campus.tars.internal/csea.ics')}
                className="text-xs font-semibold text-indigo-600 hover:underline inline-flex items-center space-x-1"
              >
                <span>Feed URL Copy Link</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>No schedule conflicts remaining</span>
          </span>
          <span className="text-slate-300">•</span>
          <span>Attendance: 94.2%</span>
        </div>

        <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Live</span>
        </div>
      </div>
    </div>
  );
};
