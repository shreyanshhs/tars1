import React, { useState } from 'react';
import {
  Sparkles,
  Award,
  Calendar,
  CheckCircle2,
  Bell,
  ArrowRight,
  FlaskConical,
  Scale,
  Brain,
  Code2,
  Calculator,
  MessageSquare,
} from 'lucide-react';

export const StudentHomeView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChip, setActiveChip] = useState<'free' | 'events' | 'attendance' | null>(null);

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[#F8FAFC]">
      {/* Top Bar matching Stitch student_home_shreyansh_cse_10 */}
      <header className="sticky top-0 z-10 bg-[#F8FAFC] border-b border-[#E2E8F0] px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium text-[#64748B]">Thursday, 26 November</p>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Good morning, Shreyansh</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Search bar with auto_awesome icon and ⌘K */}
          <div className="relative flex items-center w-72 sm:w-80 bg-white border border-[#E2E8F0] rounded-full px-3.5 py-2 focus-within:border-[#4F46E5] focus-within:ring-2 focus-within:ring-[#EEF2FF] transition-all">
            <Sparkles className="w-4 h-4 text-[#4F46E5] mr-2 shrink-0" />
            <input
              type="text"
              aria-label="Ask TARS anything"
              placeholder="Ask TARS anything…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-0 p-0 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:ring-0 focus:outline-none"
            />
            <kbd className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569] text-[11px] font-mono border border-[#E2E8F0] shrink-0">
              ⌘K
            </kbd>
          </div>

          {/* Notifications Button */}
          <button
            type="button"
            aria-label="Notifications"
            className="relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-white text-[#475569] border border-[#E2E8F0] hover:bg-[#F1F5F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] transition-colors shrink-0"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#4F46E5]" />
          </button>
        </div>
      </header>

      {/* Main Dashboard Grid */}
      <main className="flex-1 px-6 lg:px-8 py-6 max-w-[1360px] w-full mx-auto flex flex-col gap-6">

        {/* Row 1: Today's Horizontal Schedule Timeline (8:30 AM – 4:10 PM) */}
        <section aria-label="Today's schedule">
          <article className="bg-white border border-[#E2E8F0] rounded-2xl p-6 flex flex-col gap-5 shadow-xs">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-[#0F172A]">Today's schedule</h2>
                <span className="text-sm text-[#64748B] tabular-nums">8:30 AM – 4:10 PM</span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE] text-xs font-semibold tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] animate-pulse" />
                Now 11:05
              </span>
            </header>

            {/* Horizontal Timeline Track */}
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[1040px] flex flex-col gap-2">
                <div className="relative h-36 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-3">

                  {/* Now 11:05 vertical marker line */}
                  <div
                    className="absolute top-0 bottom-0 z-20 flex flex-col items-center pointer-events-none"
                    style={{ left: '38.5%' }}
                    aria-hidden="true"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-[#4F46E5] -mt-1 ring-2 ring-white" />
                    <div className="w-0.5 flex-1 bg-[#4F46E5]" />
                  </div>

                  {/* 8:30–9:25 Chemistry · SJB-104 (Done) */}
                  <div
                    className="absolute top-3 bottom-3 rounded-lg bg-[#F0FDFA]/60 border border-[#99F6E4]/70 px-3 py-2.5 flex flex-col justify-between overflow-hidden"
                    style={{ left: '0.5%', width: '11.8%' }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white/70 border border-[#99F6E4] text-[#115E59] shrink-0">
                        <FlaskConical className="w-4 h-4" />
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-[#115E59]" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#115E59] leading-tight">Chemistry</p>
                      <p className="text-xs text-[#475569] tabular-nums leading-tight mt-0.5">8:30–9:25</p>
                      <p className="text-xs text-[#64748B] leading-tight">SJB-104</p>
                    </div>
                  </div>

                  {/* 9:25–10:20 Constitution (ICO) · SJB-104 (Done) */}
                  <div
                    className="absolute top-3 bottom-3 rounded-lg bg-[#FFFBEB]/60 border border-[#FDE68A]/70 px-3 py-2.5 flex flex-col justify-between overflow-hidden"
                    style={{ left: '13.0%', width: '12.2%' }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white/70 border border-[#FDE68A] text-[#92400E] shrink-0">
                        <Scale className="w-4 h-4" />
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-[#92400E]" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#92400E] leading-tight">Constitution</p>
                      <p className="text-xs text-[#475569] tabular-nums leading-tight mt-0.5">9:25–10:20</p>
                      <p className="text-xs text-[#64748B] leading-tight">SJB-104</p>
                    </div>
                  </div>

                  {/* 10:20–10:40 Tea (quiet grey) */}
                  <div
                    className="absolute top-3 bottom-3 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] px-2 py-2 flex flex-col justify-center items-center text-center overflow-hidden"
                    style={{ left: '25.9%', width: '4.5%' }}
                  >
                    <p className="text-xs font-medium text-[#64748B] lowercase">Tea</p>
                  </div>

                  {/* 10:40–11:35 Maths · MATLAB · Shakuntala Devi lab (CURRENT - blue glow + raised) */}
                  <div
                    className="absolute top-3 bottom-3 z-10 -translate-y-1 rounded-lg bg-[#EFF6FF] border border-[#2563EB] px-3 py-2.5 flex flex-col justify-between overflow-hidden shadow-lg"
                    style={{ left: '31.1%', width: '16.0%', boxShadow: '0 0 20px rgba(37, 99, 235, 0.25)' }}
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white border border-[#BFDBFE] text-[#1E40AF] shrink-0">
                      <Calculator className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="font-bold text-sm text-[#1E40AF] leading-tight">Maths · MATLAB</p>
                      <p className="text-xs text-[#1E40AF] tabular-nums leading-tight mt-0.5">10:40–11:35</p>
                      <p className="text-xs text-[#1E40AF] leading-tight font-medium">Shakuntala Devi lab</p>
                    </div>
                  </div>

                  {/* 11:35–12:30 Intro to AI · SJB-104 */}
                  <div
                    className="absolute top-3 bottom-3 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE] px-3 py-2.5 flex flex-col justify-between overflow-hidden"
                    style={{ left: '47.8%', width: '13.0%' }}
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white border border-[#DDD6FE] text-[#5B21B6] shrink-0">
                      <Brain className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="font-semibold text-sm text-[#5B21B6] leading-tight">Intro to AI</p>
                      <p className="text-xs text-[#5B21B6] tabular-nums leading-tight mt-0.5">11:35–12:30</p>
                      <p className="text-xs text-[#64748B] leading-tight">SJB-104</p>
                    </div>
                  </div>

                  {/* 12:30–1:25 Free P5 */}
                  <div
                    className="absolute top-3 bottom-3 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] px-2 py-2 flex flex-col justify-center items-center text-center overflow-hidden"
                    style={{ left: '61.5%', width: '7.0%' }}
                  >
                    <p className="text-xs font-medium text-[#64748B] leading-tight">Free P5</p>
                    <p className="text-[11px] text-[#94A3B8] tabular-nums mt-0.5">12:30</p>
                  </div>

                  {/* 1:25–2:20 Lunch */}
                  <div
                    className="absolute top-3 bottom-3 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] px-2 py-2 flex flex-col justify-center items-center text-center overflow-hidden"
                    style={{ left: '69.2%', width: '7.0%' }}
                  >
                    <p className="text-xs font-medium text-[#64748B] leading-tight">Lunch</p>
                    <p className="text-[11px] text-[#94A3B8] tabular-nums mt-0.5">1:25</p>
                  </div>

                  {/* 2:20–4:10 Python lab · 511C */}
                  <div
                    className="absolute top-3 bottom-3 rounded-lg bg-[#EEF2FF] border border-[#C7D2FE] px-3 py-2.5 flex flex-col justify-between overflow-hidden"
                    style={{ left: '76.9%', width: '22.6%' }}
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white border border-[#C7D2FE] text-[#3730A3] shrink-0">
                      <Code2 className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="font-semibold text-sm text-[#3730A3] leading-tight">Python lab</p>
                      <p className="text-xs text-[#3730A3] tabular-nums leading-tight mt-0.5">2:20–4:10</p>
                      <p className="text-xs text-[#4F46E5] leading-tight font-medium">Room 511C · Mrs. Geetha</p>
                    </div>
                  </div>
                </div>

                {/* Time Axis Labels */}
                <div className="relative h-5 text-xs text-[#94A3B8] tabular-nums font-medium">
                  <span className="absolute left-0">8:30 AM</span>
                  <span className="absolute" style={{ left: '19.6%' }}>10:00</span>
                  <span className="absolute" style={{ left: '39.1%' }}>11:30</span>
                  <span className="absolute" style={{ left: '58.7%' }}>1:00 PM</span>
                  <span className="absolute" style={{ left: '78.3%' }}>2:30</span>
                  <span className="absolute right-0">4:10 PM</span>
                </div>
              </div>
            </div>

            {/* Next Class Strip with Changed Pill */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE] text-[#5B21B6] shrink-0">
                  <Brain className="w-4 h-4" />
                </span>
                <p className="text-sm text-[#0F172A] font-medium truncate">
                  Next: Intro to AI · 11:35 · SJB-104 · Mr. Syed Matheen Pasha
                </p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] text-xs font-semibold shrink-0">
                  Changed
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#94A3B8] shrink-0" />
            </div>
          </article>
        </section>

        {/* Row 2: TARS Brief (7 cols) + Needs you (5 cols) */}
        <section aria-label="Morning brief and action items" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

          {/* Row 2 Left: TARS Brief */}
          <article className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-2xl p-6 flex flex-col justify-between gap-5 h-full shadow-xs">
            <div className="flex flex-col gap-3">
              <header className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#EEF2FF] text-[#4F46E5]">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <h2 className="text-lg font-bold text-[#0F172A]">TARS brief · 8:15 AM</h2>
                </div>
              </header>

              <p className="text-sm text-[#334155] leading-relaxed max-w-prose">
                Your P4 Intro to AI is with Mr. Syed Matheen Pasha today, your NPTEL certificate is due 5 Dec, and Chemistry attendance is at 72% — attend all Chemistry classes this week to get back above 75%.
              </p>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E2E8F0]">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveChip(activeChip === 'free' ? null : 'free')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    activeChip === 'free'
                      ? 'bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]'
                      : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                  }`}
                >
                  My free periods (P5)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChip(activeChip === 'events' ? null : 'events')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    activeChip === 'events'
                      ? 'bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]'
                      : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                  }`}
                >
                  Events that fit my day
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChip(activeChip === 'attendance' ? null : 'attendance')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    activeChip === 'attendance'
                      ? 'bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]'
                      : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                  }`}
                >
                  Attendance
                </button>
              </div>
            </footer>
          </article>

          {/* Row 2 Right: Needs you (2) Card with soft indigo glow */}
          <article
            className="lg:col-span-5 bg-white border border-[#4F46E5] rounded-2xl p-6 flex flex-col justify-between gap-5 h-full"
            style={{ boxShadow: '0 0 24px rgba(79, 70, 229, 0.2)' }}
          >
            <header className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-[#0F172A]">Needs you (2)</h2>
              <span className="w-2.5 h-2.5 rounded-full bg-[#4F46E5] animate-ping" />
            </header>

            <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#EEF2FF] border border-[#C7D2FE] text-[#4F46E5] shrink-0">
                  <Award className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A] truncate">
                    Upload NPTEL certificate · due 5 Dec
                  </p>
                  <p className="text-xs text-[#64748B] mt-0.5 truncate">
                    The Joy of Computing using Python · 12-week course
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#4F46E5] text-white text-xs font-semibold hover:bg-[#4338CA] transition-colors shadow-xs"
              >
                Upload
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs text-[#64748B] hover:text-[#4F46E5] transition-colors flex items-center gap-2 cursor-pointer">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#EEF2FF] border border-[#C7D2FE] text-[#3730A3] shrink-0">
                  <Code2 className="w-3.5 h-3.5" />
                </span>
                <span>+1 more · Python lab record due Fri →</span>
              </span>
            </div>
          </article>
        </section>

        {/* Row 3: My attendance (5 cols) + Events (4 cols) + Coming up (3 cols) */}
        <section aria-label="Attendance, fitting events, and upcoming dates" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

          {/* Row 3 Left: My attendance */}
          <article className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-2xl p-6 flex flex-col gap-4 h-full shadow-xs">
            <header className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-[#0F172A]">My attendance</h2>
              <span className="text-xs text-[#64748B] hover:text-[#4F46E5] cursor-pointer">All 9 subjects →</span>
            </header>

            <ul className="flex flex-col divide-y divide-[#E2E8F0]">
              {/* Chemistry 72% (Below 75% red alert) */}
              <li className="py-3 first:pt-0 last:pb-0 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#F0FDFA] border border-[#99F6E4] text-[#115E59] shrink-0">
                      <FlaskConical className="w-4 h-4" />
                    </span>
                    <span className="text-sm font-semibold text-[#0F172A] truncate">Chemistry (CHE)</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA] text-xs font-semibold">
                      Below 75%
                    </span>
                    <span className="text-sm font-bold text-[#B91C1C] tabular-nums">72%</span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                  <div className="h-full rounded-full bg-[#B91C1C]" style={{ width: '72%' }} />
                </div>
                <p className="text-xs text-[#B91C1C] font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#4F46E5]" />
                  <span>Attend 3 more classes to reach 75%</span>
                </p>
              </li>

              {/* Python (PLC) 88% */}
              <li className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#EEF2FF] border border-[#C7D2FE] text-[#3730A3] shrink-0">
                    <Code2 className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[#0F172A] font-medium truncate">Python (PLC)</span>
                      <span className="text-xs text-[#475569] font-bold tabular-nums">88%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                      <div className="h-full rounded-full bg-[#4F46E5]" style={{ width: '88%' }} />
                    </div>
                  </div>
                </div>
              </li>

              {/* Intro to AI (ETC-I) 84% */}
              <li className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE] text-[#5B21B6] shrink-0">
                    <Brain className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[#0F172A] font-medium truncate">Intro to AI (ETC-I)</span>
                      <span className="text-xs text-[#475569] font-bold tabular-nums">84%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                      <div className="h-full rounded-full bg-[#4F46E5]" style={{ width: '84%' }} />
                    </div>
                  </div>
                </div>
              </li>

              {/* Maths (MAT) 81% */}
              <li className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E40AF] shrink-0">
                    <Calculator className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[#0F172A] font-medium truncate">Maths (MAT)</span>
                      <span className="text-xs text-[#475569] font-bold tabular-nums">81%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                      <div className="h-full rounded-full bg-[#4F46E5]" style={{ width: '81%' }} />
                    </div>
                  </div>
                </div>
              </li>

              {/* English (ENGL) 92% */}
              <li className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[#0F172A] font-medium truncate">English (ENGL)</span>
                      <span className="text-xs text-[#475569] font-bold tabular-nums">92%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                      <div className="h-full rounded-full bg-[#4F46E5]" style={{ width: '92%' }} />
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </article>

          {/* Row 3 Middle: Events that fit your free time */}
          <article className="lg:col-span-4 bg-white border border-[#E2E8F0] rounded-2xl p-6 flex flex-col justify-between gap-4 h-full shadow-xs">
            <header className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-[#0F172A]">Events that fit your free time</h2>
            </header>

            <div className="flex flex-col gap-3 flex-1">
              {/* Event 1 */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-center text-[#4F46E5] shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] text-[10px] font-bold">
                      0 lecture clashes
                    </span>
                    <span className="text-xs text-[#64748B] tabular-nums">Thu 4:15 PM</span>
                  </div>
                  <h3 className="text-sm font-bold text-[#0F172A] truncate">HackSphere 2026 Orientation</h3>
                  <p className="text-xs text-[#64748B]">Sir MV Auditorium · CSE Association</p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
              <span>Verified with CSE-10 schedule</span>
              <span className="text-[#4F46E5] font-semibold cursor-pointer">Browse events →</span>
            </div>
          </article>

          {/* Row 3 Right: Coming up */}
          <article className="lg:col-span-3 bg-white border border-[#E2E8F0] rounded-2xl p-6 flex flex-col justify-between gap-4 h-full shadow-xs">
            <header className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-[#0F172A]">Coming up</h2>
            </header>

            <div className="space-y-3 flex-1 text-xs">
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <p className="font-bold text-[#0F172A]">NPTEL Cloud Computing</p>
                <p className="text-[#64748B] mt-0.5">Deadline: 30 Nov 2026</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#B45309] text-[10px] font-semibold">
                  Upload Pending
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <p className="font-bold text-[#0F172A]">Evaluation of CCA2</p>
                <p className="text-[#64748B] mt-0.5">11–12 Dec 2026</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[#EEF2FF] text-[#4F46E5] text-[10px] font-semibold">
                  Department
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <p className="font-bold text-[#0F172A]">IA2 Assessment Exams</p>
                <p className="text-[#64748B] mt-0.5">21–24 Dec 2026</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#15803D] text-[10px] font-semibold">
                  CIE Assessment
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E2E8F0] text-xs text-[#94A3B8]">
              Academic Calendar AY 2026–27
            </div>
          </article>
        </section>

      </main>
    </div>
  );
};

export default StudentHomeView;
