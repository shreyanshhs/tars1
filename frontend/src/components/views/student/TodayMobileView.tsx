import React from 'react';
import rawTodayData from '../../../mock/student_today.json';
import {
  Bell,
  ArrowRightLeft,
  Clock,
  MapPin,
  CheckCircle2,
  Award,
  AlertTriangle,
  Home,
  Calendar,
  User,
} from 'lucide-react';

export const TodayMobileView: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 max-w-md mx-auto border-x border-slate-200">
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between gap-3 shadow-xs">
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Thursday 26 Nov · 5 classes</p>
          <h1 className="text-lg font-bold text-slate-900">Good morning, Shreyansh</h1>
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-600 border border-slate-200"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-600" />
        </button>
      </header>

      {/* Main Mobile Feed */}
      <main className="flex-1 px-4 py-4 space-y-4 pb-20">
        {/* Amber Substitute Alert Banner */}
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-900 shadow-xs">
          <ArrowRightLeft className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <p className="text-xs font-semibold leading-relaxed">
            P4 Intro to AI will be taken by Mr. Syed Matheen Pasha today — Prof. Chaitra is on approved leave.
          </p>
        </div>

        {/* In Class Now Card */}
        <article className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[11px] font-bold">
              In class now
            </span>
            <span className="text-xs font-semibold text-blue-900 tabular-nums">Ends in 8 min</span>
          </div>
          <h2 className="text-base font-bold text-blue-950">Maths (MATLAB)</h2>
          <p className="text-xs text-blue-800 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-600" /> 10:40–11:35 · Shakuntala Devi lab
          </p>
        </article>

        {/* Vertical Timeline */}
        <section aria-label="Today's timeline" className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Today's Timeline</h3>

          <ul className="space-y-2.5 text-xs">
            <li className="flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-400 w-10">8:30</span>
                <span>Chemistry · SJB-104</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                Done
              </span>
            </li>

            <li className="flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-400 w-10">9:25</span>
                <span>Constitution (ICO) · SJB-104</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                Done
              </span>
            </li>

            <li className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-100 text-slate-600 text-[11px]">
              <span className="font-mono">10:20–10:40</span>
              <span className="font-medium">Tea Break</span>
            </li>

            <li className="flex items-center justify-between font-semibold text-slate-900">
              <div className="flex items-center gap-2">
                <span className="font-mono text-indigo-600 w-10">10:40</span>
                <span>Maths (MATLAB)</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                Now
              </span>
            </li>

            <li className="flex items-center justify-between text-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-500 w-10">11:35</span>
                <span className="font-medium">Intro to AI · Mr. Syed Matheen</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                Next
              </span>
            </li>

            <li className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-100 text-slate-600 text-[11px]">
              <span className="font-mono">1:25–2:20</span>
              <span className="font-medium">Lunch Break (1st Year)</span>
            </li>

            <li className="flex items-center justify-between text-slate-700">
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-500 w-10">2:20</span>
                <span>Python lab · Room 511C</span>
              </div>
              <span className="text-[10px] text-slate-400">Mrs. Geetha</span>
            </li>
          </ul>
        </section>

        {/* Needs You Card */}
        <article className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3 shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-indigo-600 uppercase">Needs you</span>
            <p className="text-xs font-bold text-slate-900 mt-0.5">Upload NPTEL certificate</p>
            <p className="text-[11px] text-slate-500">Due 30 Nov · AI / Cloud course</p>
          </div>
          <button className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold shrink-0">
            Upload
          </button>
        </article>

        {/* My Attendance */}
        <section aria-label="My attendance" className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">My Attendance</h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-700">Python</span>
              <span className="font-semibold text-slate-900">88%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-700">Intro to AI</span>
              <span className="font-semibold text-slate-900">82%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-red-600 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Chemistry
              </span>
              <span className="font-bold text-red-600">72%</span>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 px-6 py-2.5 flex items-center justify-around text-slate-500 text-[11px]">
        <button className="flex flex-col items-center gap-1 text-indigo-600 font-semibold">
          <Home className="w-4 h-4" />
          <span>Today</span>
        </button>
        <button className="flex flex-col items-center gap-1 hover:text-slate-900">
          <Calendar className="w-4 h-4" />
          <span>Schedule</span>
        </button>
        <button className="flex flex-col items-center gap-1 hover:text-slate-900">
          <Award className="w-4 h-4" />
          <span>NPTEL</span>
        </button>
        <button className="flex flex-col items-center gap-1 hover:text-slate-900">
          <User className="w-4 h-4" />
          <span>Profile</span>
        </button>
      </nav>
    </div>
  );
};

export default TodayMobileView;
