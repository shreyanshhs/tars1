import React from 'react';
import { useTars } from '../../context/TarsContext';
import {
  CheckCircle2,
  Sparkles,
  MapPin,
  Calendar,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export const TodayView: React.FC = () => {
  const {
    autonomousScheduleBannerVisible,
    dismissAutonomousBanner,
    acceptAutonomousBanner,
    timelineItems,
    acceptTimelineSlot,
    attendanceCourses,
    setCurrentView,
  } = useTars();

  const isStudyBlockLocked = timelineItems.find((i) => i.id === 'tl-2')?.isLocked;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top greeting header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Good morning, Shreyansh</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            B.Tech CSE Semester 1 • Section A • Academic Week 12
          </p>
        </div>
        <div className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200/70 rounded-full text-emerald-700 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Synced with campus schedule</span>
        </div>
      </div>

      {/* Main Grid: Left 2 cols, Right 1 col */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Autonomous Schedule Update Banner */}
          {autonomousScheduleBannerVisible ? (
            <div className="relative overflow-hidden rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-white p-5 shadow-xs">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2 text-indigo-700 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Autonomous Schedule Update</span>
                </div>
                <span className="text-[11px] font-medium text-indigo-600/90 bg-indigo-100/60 px-2 py-0.5 rounded-full border border-indigo-200/50">
                  High confidence (99.8%)
                </span>
              </div>

              <div className="mt-3">
                <h2 className="text-lg font-bold text-slate-900">TARS re-planned your day</h2>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Dr. Rao is absent today. Your 10:00 AM Data Structures class has been moved to 2:00 PM in Room 504,
                  leaving your morning block free.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={acceptAutonomousBanner}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Block 10–11 for Assignment</span>
                </button>
                <button
                  onClick={dismissAutonomousBanner}
                  className="px-3 py-2 text-slate-500 hover:text-slate-800 text-xs font-medium transition-colors"
                >
                  Dismiss
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-indigo-100/80 flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                <span className="flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>0 clashes detected</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>Room 504 (North Block)</span>
                </span>
                <span>•</span>
                <span>Dr. Menon substituting</span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>
                  {isStudyBlockLocked
                    ? '10:00–11:00 AM study slot locked on calendar. Rescheduled 14:00 PM lecture confirmed.'
                    : 'Schedule alert dismissed. Daily agenda synced.'}
                </span>
              </div>
              <button
                onClick={() => dismissAutonomousBanner()}
                className="text-[11px] underline text-emerald-700 font-medium"
              >
                Hide
              </button>
            </div>
          )}

          {/* Today's Schedule Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Today&apos;s Schedule</h3>
                <span className="text-[11px] text-slate-400">09:00 – 18:00 Campus Operatives</span>
              </div>
              <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                <span>05:31:17 PM</span>
              </div>
            </div>

            {/* Vertical timeline */}
            <div className="mt-4 space-y-3.5">
              {timelineItems.map((item) => {
                const isStudy = item.isStudyBlock;
                const isLocked = item.isLocked;

                return (
                  <div
                    key={item.id}
                    className={`relative p-3.5 rounded-xl border transition-all ${
                      isStudy
                        ? 'bg-indigo-50/50 border-indigo-200/90 shadow-xs'
                        : item.status === 'Completed'
                        ? 'bg-slate-50/60 border-slate-200/60 opacity-80'
                        : item.status === 'Rescheduled'
                        ? 'bg-purple-50/40 border-purple-200/70'
                        : 'bg-white border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="mt-0.5">
                          {item.status === 'Completed' ? (
                            <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px]">
                              ✓
                            </div>
                          ) : isStudy ? (
                            <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] shadow-xs">
                              ★
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-semibold text-slate-500">{item.time}</span>
                            {item.status === 'Free Slot Recommended' && !isLocked && (
                              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.2 rounded-full">
                                Free Slot Recommended
                              </span>
                            )}
                            {item.status === 'Rescheduled' && (
                              <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.2 rounded-full">
                                Rescheduled
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm mt-0.5">{item.title}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">{item.subtitle}</p>
                        </div>
                      </div>

                      {/* Right Tag / Action */}
                      <div className="text-right flex-shrink-0">
                        {isStudy ? (
                          isLocked ? (
                            <span className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Locked Slot</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => acceptTimelineSlot(item.id)}
                              className="px-3 py-1 bg-white hover:bg-indigo-50 border border-indigo-300 text-indigo-700 rounded-lg text-xs font-semibold shadow-xs transition-colors"
                            >
                              Accept &amp; Lock Slot
                            </button>
                          )
                        ) : (
                          <div className="flex flex-col items-end">
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                                item.status === 'Completed'
                                  ? 'bg-slate-100 text-slate-600'
                                  : item.status === 'Confirmed'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                                  : item.status === 'Flexible'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'text-slate-500'
                              }`}
                            >
                              {item.status}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-1">{item.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Attendance, Deadlines, Campus Event */}
        <div className="space-y-6">
          {/* Attendance Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Attendance Matrix</h3>
              <span className="text-[11px] text-slate-400">Min 75% req</span>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">81.4%</span>
                <span className="ml-2 text-xs font-semibold text-emerald-600">+0.6%</span>
              </div>
              <div className="flex items-center space-x-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Good Standing</span>
              </div>
            </div>

            {/* Courses progress */}
            <div className="mt-5 space-y-3">
              {attendanceCourses.map((c) => {
                const isWarning = c.percentage < 80;
                return (
                  <div key={c.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{c.name}</span>
                      <span className={`font-bold ${isWarning ? 'text-rose-600' : 'text-slate-700'}`}>
                        {c.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isWarning ? 'bg-rose-500' : 'bg-indigo-600'}`}
                        style={{ width: `${c.percentage}%` }}
                      ></div>
                    </div>
                    {c.thresholdWarning && (
                      <div className="mt-1 flex items-center space-x-1 text-[10px] text-rose-600 font-medium">
                        <AlertCircle className="w-3 h-3" />
                        <span>{c.thresholdWarning}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-right">
              <button
                onClick={() => setCurrentView('schedule')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center space-x-1"
              >
                <span>Forecast &amp; leaves</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Upcoming Deadlines</h3>
              <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                3 pending
              </span>
            </div>

            <div className="mt-3.5 space-y-3">
              <div
                onClick={() => setCurrentView('nudges')}
                className="p-3 rounded-xl bg-slate-50/80 hover:bg-indigo-50/60 border border-slate-200/60 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">DS Lab Assignment 4</span>
                  <span className="text-[10px] font-bold text-rose-600">Tomorrow, 11:59 PM</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Self Balancing BST rotation validation - GitHub</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Maths Problem Set 3</span>
                  <span className="text-[10px] font-bold text-slate-500">Nov 23</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Taylor Series &amp; Partial Derivatives - Offline</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">CTF Team Registration</span>
                  <span className="text-[10px] font-bold text-slate-500">Nov 22</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Team roster lockdown (max 4 members)</p>
              </div>
            </div>
          </div>

          {/* Campus Event Card */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-[11px] text-indigo-300">
              <span className="uppercase tracking-wider font-semibold">Campus Event</span>
              <span>Nov 25–26</span>
            </div>
            <h4 className="text-base font-bold mt-2 text-white">Martian 1.0 Hackathon</h4>
            <p className="text-xs text-slate-300 mt-1">
              38-hour autonomous software sprint on distributed sensor grids.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Pool: ₹1.5L</span>
              <button
                onClick={() => setCurrentView('events')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1"
              >
                <span>Register</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
