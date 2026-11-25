import React from 'react';
import rawTodayData from '../../../mock/student_today.json';
import rawHomeData from '../../../mock/student_home.json';
import {
  Sparkles,
  AlertTriangle,
  Award,
  Clock,
  MapPin,
} from 'lucide-react';

interface StudentTimelineSlot {
  id: number;
  period: string;
  time: string;
  subject_code: string;
  subject_name: string;
  subject_type: string;
  room?: string;
  faculty?: string;
  original_faculty?: string;
  changed?: boolean;
  substitute?: string;
  status: 'completed' | 'active' | 'upcoming';
  is_lab?: boolean;
}

const todayData = rawTodayData as unknown as {
  date: string;
  day: string;
  now_time: string;
  student: { name: string; section: string; usn: string };
  timeline: StudentTimelineSlot[];
  tars_brief: { title: string; message: string; time_saved_hours: number };
  needs_you: { title: string; subject: string; current_pct: number; target_pct: number; classes_needed: number; note: string };
  free_time_events: Array<{ id: string; title: string; time: string; venue: string; registered: boolean }>;
};

const homeData = rawHomeData as unknown as {
  attendance_summary: Array<{ subject_code: string; subject: string; percentage: number; status: string; note: string }>;
  upcoming_deadlines: Array<{ title: string; due_date: string; status: string }>;
};

export const StudentHomeView: React.FC = () => {
  return (
    <div className="flex-1 min-w-0 flex flex-col bg-slate-50/50">
      {/* Header bar */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-8 py-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Thursday, 26 November 2026</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
            Good morning, {todayData.student.name}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Section {todayData.student.section} · USN {todayData.student.usn}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            Now {todayData.now_time}
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 px-8 py-6 max-w-6xl w-full mx-auto space-y-6">
        {/* Row 1: Today's Horizontal Schedule Timeline at TOP */}
        <section aria-label="Today's schedule" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Today's Schedule</h2>
              <span className="text-xs text-slate-400">8:30 AM – 4:10 PM</span>
            </div>
            <span className="text-xs font-medium text-slate-500">BMSIT CSE-10</span>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex items-stretch gap-3 min-w-[760px]">
              {todayData.timeline.map((slot) => {
                const isCurrent = slot.status === 'active';
                const isPassed = slot.status === 'completed';

                return (
                  <div
                    key={slot.id}
                    className={`flex-1 min-w-[140px] p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      isCurrent
                        ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500 shadow-md transform -translate-y-0.5'
                        : isPassed
                        ? 'bg-slate-50/60 border-slate-200 opacity-60'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[11px] font-mono text-slate-400 font-medium">P{slot.period}</span>
                        {isPassed && (
                          <span className="text-[10px] font-semibold text-emerald-600">Done</span>
                        )}
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-indigo-700 px-1.5 py-0.2 rounded-full bg-indigo-100">
                            Now
                          </span>
                        )}
                        {slot.changed && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 ring-2 ring-white" title="Changed by TARS" />
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">{slot.subject_name}</h4>
                      <p className="text-[11px] text-slate-500 mt-1">{slot.time}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100/80">
                      <p className="text-[11px] text-slate-600 font-medium truncate">
                        {slot.substitute ? slot.substitute : slot.faculty}
                      </p>
                      {slot.room && (
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {slot.room}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Row 2: TARS Brief & "Needs You" (soft indigo glow) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* TARS Brief */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">TARS Daily Brief</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {todayData.tars_brief.message}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Optimized by Autonomous Agent</span>
              <span className="font-semibold text-indigo-600">Saved 3.2 hrs faculty time</span>
            </div>
          </div>

          {/* Needs you Card (with soft indigo glow) */}
          <div className="bg-gradient-to-br from-indigo-50/90 to-white border border-indigo-200/90 rounded-2xl p-6 shadow-sm flex flex-col justify-between ring-1 ring-indigo-200">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Action Needed</span>
                <Award className="w-4 h-4 text-indigo-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-1.5">
                Upload NPTEL Certificate — Due 30 Nov
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Prof. Chaitra D B requested NAAC/NBA certification proofs for 1st Sem CSE.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-indigo-600 font-medium">Auto-scanned by TARS Vision</span>
              <button className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs">
                Upload Proof
              </button>
            </div>
          </div>
        </section>

        {/* Row 3: My Attendance Summary & Free Time Events */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Attendance Section */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">My Attendance</h3>
              <span className="text-xs text-slate-400">Contineo Target: 75%</span>
            </div>

            <div className="space-y-3">
              {homeData.attendance_summary.map((att) => {
                const isDanger = att.percentage < 75;

                return (
                  <div key={att.subject_code} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{att.subject}</span>
                      <span
                        className={`font-bold tabular-nums ${
                          isDanger ? 'text-red-600' : 'text-slate-900'
                        }`}
                      >
                        {att.percentage}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isDanger ? 'bg-red-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${att.percentage}%` }}
                      />
                    </div>

                    <p className={`text-[11px] ${isDanger ? 'text-red-600 font-semibold flex items-center gap-1' : 'text-slate-400'}`}>
                      {isDanger && <AlertTriangle className="w-3 h-3 text-red-500" />}
                      {att.note}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Events matching free time & upcoming */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Events Matching Free Time</h3>
              <p className="text-xs text-slate-500">TARS verified zero lecture clashes.</p>

              {todayData.free_time_events.map((ev) => (
                <div key={ev.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="flex items-start justify-between">
                    <h4 className="text-xs font-bold text-slate-900">{ev.title}</h4>
                    <span className="text-[10px] font-semibold text-emerald-600 px-1.5 py-0.5 rounded bg-emerald-50">
                      0 clashes
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 flex items-center gap-2">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {ev.time}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {ev.venue}</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Upcoming Deadlines</h3>
              <div className="space-y-2">
                {homeData.upcoming_deadlines.map((dl, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                    <span className="font-medium text-slate-700">{dl.title}</span>
                    <span className="text-slate-500 font-mono">{dl.due_date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default StudentHomeView;
