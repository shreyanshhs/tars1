import React, { useState } from 'react';
import { useTars } from '../../context/TarsContext';

interface StitchEvent {
  id: string;
  title: string;
  category: string;
  categoryColor: string;
  org: string;
  dayNum: string;
  month: string;
  time: string;
  location: string;
  clashStatus: 'free' | 'clash';
  clashBadgeText: string;
  clashBadgeColor: string;
  registeredCount: number;
  initialSaved: boolean;
  initialRegistered: boolean;
  bannerGradient: string;
  icon: string;
}

const STITCH_EVENTS: StitchEvent[] = [
  {
    id: 'ev-cybersec',
    title: 'CyberSec Workshop: Intro to CTFs',
    category: 'Tech',
    categoryColor: 'bg-primary-soft text-primary border-status-active-border',
    org: 'CyberSec Student Chapter',
    dayNum: '2',
    month: 'DEC',
    time: '2:20–4:10 PM',
    location: 'Seminar Hall',
    clashStatus: 'clash',
    clashBadgeText: 'Clashes with Skill lab (P6–P7)',
    clashBadgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    registeredCount: 128,
    initialSaved: true,
    initialRegistered: false,
    bannerGradient: 'from-indigo-700 via-slate-800 to-slate-900',
    icon: 'terminal',
  },
  {
    id: 'ev-martian',
    title: 'Martian 1.0 — Agentic AI Hackathon',
    category: 'Hackathon',
    categoryColor: 'bg-amber-50 text-amber-800 border-amber-200',
    org: 'BMSIT Main Auditorium',
    dayNum: '25',
    month: 'NOV',
    time: '24 hrs',
    location: 'Main Auditorium',
    clashStatus: 'free',
    clashBadgeText: 'Clash-free — holiday on 27 Nov',
    clashBadgeColor: 'bg-status-done-bg text-status-done border-status-done-border',
    registeredCount: 118,
    initialSaved: false,
    initialRegistered: true,
    bannerGradient: 'from-amber-600 via-orange-800 to-stone-900',
    icon: 'smart_toy',
  },
  {
    id: 'ev-placement',
    title: 'Placement talk: Product companies',
    category: 'Careers',
    categoryColor: 'bg-blue-50 text-blue-800 border-blue-200',
    org: 'Placement Cell',
    dayNum: '5',
    month: 'DEC',
    time: '10:40 AM',
    location: 'Main Auditorium',
    clashStatus: 'free',
    clashBadgeText: 'No clash',
    clashBadgeColor: 'bg-surface-container text-on-surface-variant border-outline-variant',
    registeredCount: 86,
    initialSaved: false,
    initialRegistered: false,
    bannerGradient: 'from-blue-600 via-indigo-800 to-slate-900',
    icon: 'work',
  },
  {
    id: 'ev-rajyotsava',
    title: 'Kannada Rajyotsava celebration',
    category: 'Culture',
    categoryColor: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    org: 'Cultural Committee',
    dayNum: '4',
    month: 'DEC',
    time: '3:15 PM',
    location: 'Open Air Theatre',
    clashStatus: 'free',
    clashBadgeText: 'No clash',
    clashBadgeColor: 'bg-surface-container text-on-surface-variant border-outline-variant',
    registeredCount: 142,
    initialSaved: false,
    initialRegistered: false,
    bannerGradient: 'from-red-600 via-orange-700 to-yellow-600',
    icon: 'celebration',
  },
  {
    id: 'ev-nptel',
    title: 'NPTEL orientation',
    category: 'Workshop',
    categoryColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    org: 'Prof. Chaitra D B',
    dayNum: '3',
    month: 'DEC',
    time: '12:30 PM',
    location: 'SJB-104',
    clashStatus: 'free',
    clashBadgeText: 'Fits your free P5',
    clashBadgeColor: 'bg-status-done-bg text-status-done border-status-done-border',
    registeredCount: 41,
    initialSaved: false,
    initialRegistered: false,
    bannerGradient: 'from-teal-600 via-emerald-800 to-slate-900',
    icon: 'school',
  },
  {
    id: 'ev-chess',
    title: 'Chess club weekly meet',
    category: 'Club',
    categoryColor: 'bg-stone-100 text-stone-800 border-stone-300',
    org: 'Chess Club',
    dayNum: '5',
    month: 'DEC',
    time: '2:20 PM',
    location: 'Library hall',
    clashStatus: 'free',
    clashBadgeText: 'No clash',
    clashBadgeColor: 'bg-surface-container text-on-surface-variant border-outline-variant',
    registeredCount: 19,
    initialSaved: false,
    initialRegistered: false,
    bannerGradient: 'from-zinc-700 via-stone-800 to-stone-900',
    icon: 'extension',
  },
];

export const EventsView: React.FC = () => {
  const { rsvpEvent, role } = useTars();
  const isHod = role === 'hod';
  const [activeTab, setActiveTab] = useState<'All' | 'Clash-free' | 'Saved' | 'Registered'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(['ev-cybersec']));
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(() => new Set(['ev-martian']));
  const [postModalOpen, setPostModalOpen] = useState(false);

  // Stitch Registration Modal & Success Ticket State
  const [registeringEvent, setRegisteringEvent] = useState<StitchEvent | null>(null);
  const [ticketModalEvent, setTicketModalEvent] = useState<StitchEvent | null>(null);
  const [teamMembers, setTeamMembers] = useState<string[]>(['26UG1BYCS0281-T', '26UG1BYCS0295-T']);
  const [teamMemberInput, setTeamMemberInput] = useState('');
  const [teamName, setTeamName] = useState('NullPointers');

  const toggleBookmark = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleOpenRegisterOrTicket = (ev: StitchEvent) => {
    if (isHod) return; // Role restriction: HOD does not register or generate entry tickets
    if (registeredIds.has(ev.id)) {
      // Already registered: show the confirmed ticket pass
      setTicketModalEvent(ev);
    } else {
      // Not yet registered: open the Stitch 2-column registration form
      setRegisteringEvent(ev);
    }
  };

  const handleConfirmRegistration = () => {
    if (!registeringEvent) return;
    const ev = registeringEvent;

    setRegisteredIds((prev) => new Set(prev).add(ev.id));

    // Call genuine TarsContext rsvpEvent to persist state
    try {
      rsvpEvent(ev.id);
    } catch {
      // Graceful local handling
    }

    setRegisteringEvent(null);
    setTicketModalEvent(ev);
  };

  const handleCancelRegistration = (ev: StitchEvent) => {
    setRegisteredIds((prev) => {
      const next = new Set(prev);
      next.delete(ev.id);
      return next;
    });
    try {
      rsvpEvent(ev.id);
    } catch {
      // Graceful local handling
    }
    setTicketModalEvent(null);
  };

  const handleAddTeamMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (teamMemberInput.trim() && teamMembers.length < 3) {
      setTeamMembers([...teamMembers, teamMemberInput.trim().toUpperCase()]);
      setTeamMemberInput('');
    }
  };

  const handleRemoveTeamMember = (usn: string) => {
    setTeamMembers(teamMembers.filter((m) => m !== usn));
  };

  const filteredEvents = STITCH_EVENTS.filter((ev) => {
    if (activeTab === 'Clash-free' && ev.clashStatus !== 'free') return false;
    if (activeTab === 'Saved' && !savedIds.has(ev.id)) return false;
    if (activeTab === 'Registered' && !registeredIds.has(ev.id)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        ev.title.toLowerCase().includes(q) ||
        ev.category.toLowerCase().includes(q) ||
        ev.org.toLowerCase().includes(q) ||
        ev.location.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <main className="flex-1 min-w-0 p-6 flex flex-col gap-6 bg-surface text-on-surface font-body antialiased">
      {/* Header + Search + Post an event + Tabs */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="font-headline text-headline-lg text-on-surface" data-design-text-token="headline-lg">
                Campus events
              </h1>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label text-[11px] font-bold tracking-wider uppercase">
                Timetable Synced
              </span>
            </div>
            <p className="font-body text-body-md text-on-surface-variant" data-design-text-token="body-md">
              TARS checks every event against your CSE-10 timetable.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Bar */}
            <div className="w-60 flex items-center gap-2.5 px-3.5 py-2 rounded bg-surface-container-lowest border border-outline-variant focus-within:border-primary">
              <span className="material-symbols-outlined text-[18px] text-on-surface-muted shrink-0" aria-hidden="true">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events…"
                aria-label="Search events"
                className="w-full bg-transparent border-0 p-0 font-body text-body-md text-on-surface placeholder:text-on-surface-muted focus:ring-0 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-on-surface-muted hover:text-on-surface text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Post an event */}
            <button
              type="button"
              onClick={() => setPostModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-primary text-on-primary font-label text-label-md hover:bg-primary-hover transition-colors duration-state-change whitespace-nowrap cursor-pointer shadow-2xs"
              data-design-text-token="label-md"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                add
              </span>
              <span>Post an event</span>
            </button>
          </div>
        </div>

        {/* Tabs: All | Clash-free | Saved | Registered */}
        <div className="flex items-center gap-2 border-b border-outline-variant pb-2 overflow-x-auto" role="tablist" aria-label="Event filters">
          {((isHod ? ['All', 'Clash-free', 'Saved'] : ['All', 'Clash-free', 'Saved', 'Registered']) as Array<'All' | 'Clash-free' | 'Saved' | 'Registered'>).map((tab) => {
            const isSelected = activeTab === tab;
            const count =
              tab === 'All'
                ? STITCH_EVENTS.length
                : tab === 'Clash-free'
                ? STITCH_EVENTS.filter((e) => e.clashStatus === 'free').length
                : tab === 'Saved'
                ? savedIds.size
                : registeredIds.size;

            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded transition-colors duration-state-change font-label text-label-md flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-surface-container-lowest border border-outline-variant text-on-surface font-semibold shadow-2xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                data-design-text-token="label-md"
              >
                <span>{tab}</span>
                <span className={`text-[11px] px-1.5 py-0.2 rounded-full tabular-nums ${
                  isSelected ? 'bg-primary-soft text-primary font-bold' : 'bg-surface-container text-on-surface-muted'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Event Cards Grid + Right "Your Week" Column */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-6 items-start">
        {/* Event Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch">
          {filteredEvents.length === 0 ? (
            <div className="col-span-full py-12 px-4 text-center bg-surface-container-lowest border border-outline-variant rounded-lg">
              <span className="material-symbols-outlined text-[32px] text-on-surface-muted">event_busy</span>
              <p className="text-on-surface font-medium mt-2">No campus events match this filter</p>
              <button
                type="button"
                onClick={() => { setActiveTab('All'); setSearchQuery(''); }}
                className="mt-3 text-xs text-primary underline cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filteredEvents.map((ev) => {
              const isSaved = savedIds.has(ev.id);
              const isRegistered = registeredIds.has(ev.id);

              return (
                <article
                  key={ev.id}
                  className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 flex flex-col gap-3 h-full shadow-2xs hover:border-outline transition-colors"
                >
                  {/* Poster Graphic Header */}
                  <div className={`relative aspect-[16/10] rounded-md overflow-hidden bg-gradient-to-br ${ev.bannerGradient} flex flex-col justify-between p-3 text-white shadow-inner`}>
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-xs text-white font-label text-label-sm border border-white/20">
                        {ev.category}
                      </span>
                      <div className="px-2 py-1 rounded bg-black/50 backdrop-blur-xs text-center flex flex-col items-center border border-white/20">
                        <span className="font-headline text-title-md tabular-nums leading-none font-bold">
                          {ev.dayNum}
                        </span>
                        <span className="font-label text-[10px] uppercase tracking-wider text-slate-200">
                          {ev.month}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-end justify-between">
                      <span className="material-symbols-outlined text-[28px] opacity-70">
                        {ev.icon}
                      </span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="px-1 flex flex-col justify-between gap-3 flex-1">
                    <div className="flex flex-col gap-1.5">
                      <p className="font-body font-semibold text-body-md text-on-surface text-balance leading-snug">
                        {ev.title}
                      </p>
                      <p className="font-body text-body-sm text-on-surface-variant">
                        {ev.org}
                      </p>
                      <p className="font-body text-body-sm text-on-surface-muted tabular-nums flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">location_on</span>
                        <span>{ev.location} · {ev.time}</span>
                      </p>

                      {/* Timetable Clash Badge */}
                      <span className={`self-start mt-1 px-2.5 py-1 rounded-md border text-xs font-medium ${ev.clashBadgeColor}`}>
                        {ev.clashBadgeText}
                      </span>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="pt-2.5 border-t border-outline-variant flex flex-col gap-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-body text-label-sm text-on-surface-muted tabular-nums">
                            {ev.registeredCount + (isRegistered && !ev.initialRegistered ? 1 : 0)} registered
                          </span>
                        </div>
                        {!isHod ? (
                          <button
                            type="button"
                            onClick={() => handleOpenRegisterOrTicket(ev)}
                            className="font-label text-label-sm text-on-surface-variant hover:text-on-surface whitespace-nowrap cursor-pointer underline"
                          >
                            {isRegistered ? 'View ticket →' : 'Details →'}
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-surface-container border border-outline-variant text-[11px] font-mono uppercase text-on-surface-variant font-semibold">
                            HOD Oversight
                          </span>
                        )}
                      </div>

                      {!isHod && (
                        <div className="flex items-center gap-2">
                          {/* Bookmark Button (Local / Simulated) */}
                          <button
                            type="button"
                            title={isSaved ? 'Saved to wishlist (local simulation)' : 'Save to wishlist (local simulation)'}
                            aria-label="Save to wishlist"
                            aria-pressed={isSaved}
                            onClick={() => toggleBookmark(ev.id)}
                            className={`inline-flex items-center justify-center w-9 h-8 rounded border transition-colors shrink-0 cursor-pointer ${
                              isSaved
                                ? 'bg-primary-soft border-status-active-border text-primary'
                                : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:text-on-surface'
                            }`}
                          >
                            <span
                              className="material-symbols-outlined text-[18px]"
                              style={{ fontVariationSettings: isSaved ? "'FILL' 1" : "'FILL' 0" }}
                              aria-hidden="true"
                            >
                              bookmark
                            </span>
                          </button>

                          {/* Register / Registered Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenRegisterOrTicket(ev)}
                            className={`flex-1 py-1.5 rounded font-label text-label-sm transition-colors duration-state-change cursor-pointer font-medium flex items-center justify-center gap-1.5 ${
                              isRegistered
                                ? 'bg-status-done-bg border border-status-done-border text-status-done hover:bg-emerald-100'
                                : 'bg-primary text-on-primary hover:bg-primary-hover shadow-2xs'
                            }`}
                          >
                            {isRegistered ? (
                              <>
                                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                <span>Registered ✓</span>
                              </>
                            ) : (
                              <span>Register</span>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>

        {/* Right Column: "Your week" (Calendar Schedule Clash Highlight) */}
        <aside className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col gap-4 shadow-2xs w-full">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
            <h2 className="font-title text-title-md text-on-surface" data-design-text-token="title-md">
              Your week
            </h2>
            <span className="text-[11px] font-mono text-on-surface-muted uppercase">CSE-10</span>
          </div>

          <p className="text-xs text-on-surface-variant">
            Live schedule check against enrolled periods:
          </p>

          <div className="flex flex-col divide-y divide-outline-variant text-xs">
            <div className="py-2.5 first:pt-0 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-on-surface">MON 24 NOV</span>
                <span className="text-on-surface-muted">All classes active</span>
              </div>
              <span className="text-on-surface-variant">6 periods scheduled</span>
            </div>

            <div className="py-2.5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-on-surface">TUE 25 NOV</span>
                <span className="px-1.5 py-0.2 rounded bg-status-done-bg text-status-done text-[10px] font-bold">ATTENDING</span>
              </div>
              <span className="text-on-surface-variant font-medium text-primary">Martian 1.0 Hackathon (24 hrs)</span>
            </div>

            <div className="py-2.5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-on-surface">WED 2 DEC</span>
                <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">CLASH</span>
              </div>
              <span className="text-rose-700">CyberSec Intro (P6–P7 Skill Lab)</span>
            </div>

            <div className="py-2.5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-on-surface">THU 3 DEC</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">FREE P5</span>
              </div>
              <span className="text-on-surface-variant">NPTEL Orientation (12:30 PM)</span>
            </div>

            <div className="py-2.5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-on-surface">FRI 4 DEC</span>
                <span className="text-on-surface-muted">No clash</span>
              </div>
              <span className="text-on-surface-variant">Kannada Rajyotsava (3:15 PM)</span>
            </div>

            <div className="py-2.5 last:pb-0 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-on-surface">SAT 5 DEC</span>
                <span className="text-on-surface-muted">No clash</span>
              </div>
              <span className="text-on-surface-variant">Placement Talk (10:40 AM)</span>
            </div>
          </div>
        </aside>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* APPROVED STITCH TWO-COLUMN EVENT REGISTRATION MODAL                */}
      {/* (from event_registration_shreyansh_cse_10/code.html)               */}
      {/* ------------------------------------------------------------------- */}
      {registeringEvent && !isHod && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reg-modal-title"
            className="w-full max-w-3xl bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] shadow-2xl animate-in fade-in duration-150"
          >
            {/* Left Column: Poster + Event Summary + Timetable Clash Chip */}
            <div className="p-5 bg-surface-container-low border-r border-outline-variant flex flex-col justify-between gap-3.5">
              <div className="flex flex-col gap-3">
                <div className={`aspect-[16/10] rounded-md overflow-hidden bg-gradient-to-br ${registeringEvent.bannerGradient} p-3 text-white flex flex-col justify-between shadow-inner`}>
                  <span className="px-2 py-0.5 rounded-full bg-black/40 text-[11px] self-start font-semibold">
                    {registeringEvent.category}
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="material-symbols-outlined text-[24px] opacity-80">{registeringEvent.icon}</span>
                    <span className="font-bold text-xs uppercase">{registeringEvent.dayNum} {registeringEvent.month}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <p id="reg-modal-title" className="font-body font-semibold text-body-md text-on-surface text-balance">
                    {registeringEvent.title}
                  </p>
                  <p className="font-body text-body-sm text-on-surface-variant">
                    {registeringEvent.org}
                  </p>
                  <p className="font-body text-body-sm text-on-surface-muted tabular-nums">
                    {registeringEvent.dayNum} {registeringEvent.month} · {registeringEvent.time}
                  </p>
                  <p className="font-body text-body-sm text-on-surface-muted">
                    {registeringEvent.location}
                  </p>
                </div>
              </div>

              {/* Clash Warning Chip from Stitch */}
              <span className={`px-2.5 py-1.5 rounded-md border font-body font-medium text-xs text-pretty ${registeringEvent.clashBadgeColor}`}>
                {registeringEvent.clashStatus === 'clash'
                  ? 'Clashes with Skill lab P6–P7 — you\'ll need permission'
                  : 'Clash-free — auto-checked with CSE-10 timetable'}
              </span>
            </div>

            {/* Right Column: Pre-filled Profile + Event Fields */}
            <div className="p-6 flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-title text-title-md text-on-surface">Event registration</span>
                    <span className="px-2 py-0.5 rounded-full bg-primary-soft text-on-primary-soft font-label text-label-sm font-semibold">
                      Filled from your profile
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRegisteringEvent(null)}
                    aria-label="Close modal"
                    className="inline-flex items-center justify-center w-8 h-8 rounded text-on-surface-variant hover:bg-surface-container cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                {/* Pre-filled Profile Strip */}
                <div className="p-3.5 rounded-md bg-surface-container-low border border-outline-variant grid grid-cols-2 sm:grid-cols-[1fr_1.45fr_0.75fr] gap-3 text-xs">
                  <div className="flex flex-col">
                    <span className="font-label text-label-sm text-on-surface-muted">Name</span>
                    <span className="font-title text-title-sm text-on-surface font-semibold">Shreyansh</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label text-label-sm text-on-surface-muted">USN</span>
                    <span className="font-mono font-semibold text-on-surface tabular-nums">26UG1BYCS0274-T</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label text-label-sm text-on-surface-muted">Section</span>
                    <span className="font-title text-title-sm text-on-surface font-semibold">CSE-10</span>
                  </div>
                  <div className="flex flex-col col-span-2">
                    <span className="font-label text-label-sm text-on-surface-muted">Email</span>
                    <span className="text-on-surface font-mono text-[11px]">shreyansh.cs26@bmsit.in</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="font-label text-label-sm text-on-surface-muted">Phone</label>
                    <input
                      type="text"
                      disabled
                      value="+91 98450 23190"
                      className="w-full px-2 py-1 rounded border border-outline bg-surface-container-lowest font-body text-body-sm text-on-surface tabular-nums"
                    />
                  </div>
                </div>

                {/* Team Name & Team Members Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="font-label text-label-sm text-on-surface-variant font-medium">Team name (optional)</label>
                    <input
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded border border-outline bg-surface-container-lowest font-body text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <form onSubmit={handleAddTeamMember} className="flex flex-col gap-1">
                    <label className="font-label text-label-sm text-on-surface-variant font-medium">Add teammate USN (max 3)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="Add USN…"
                        value={teamMemberInput}
                        onChange={(e) => setTeamMemberInput(e.target.value)}
                        className="w-full px-3 py-1.5 rounded border border-outline bg-surface-container-lowest font-body text-on-surface placeholder:text-on-surface-muted focus:border-primary focus:ring-1 focus:ring-primary uppercase font-mono"
                      />
                      <button
                        type="submit"
                        disabled={teamMembers.length >= 3 || !teamMemberInput.trim()}
                        className="px-2 py-1.5 rounded bg-surface-container border border-outline-variant font-semibold hover:bg-surface-container-high cursor-pointer disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                  </form>
                </div>

                {/* Team Member Chips */}
                <div className="flex flex-wrap items-center gap-2">
                  {teamMembers.map((usn) => (
                    <span
                      key={usn}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container border border-outline-variant font-mono text-[11px] text-on-surface tabular-nums"
                    >
                      {usn}
                      <button
                        type="button"
                        onClick={() => handleRemoveTeamMember(usn)}
                        className="text-on-surface-muted hover:text-on-surface cursor-pointer"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <span className="text-[11px] text-on-surface-muted italic">
                    (Team USN chips are simulated demo tags)
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-outline-variant">
                <span className="text-[11px] text-on-surface-muted">
                  Persists to <code className="bg-surface-container px-1 py-0.5 rounded">POST /api/events/{registeringEvent.id}/rsvp</code>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRegisteringEvent(null)}
                    className="px-4 py-2 rounded text-xs text-on-surface-variant hover:bg-surface-container cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRegistration}
                    className="px-5 py-2 rounded text-xs bg-primary text-on-primary hover:bg-primary-hover font-semibold transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Complete Registration</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* APPROVED STITCH QR ENTRY PASS MODAL                                 */}
      {/* (from event_registration_success_ticket/code.html)                  */}
      {/* ------------------------------------------------------------------- */}
      {ticketModalEvent && !isHod && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-2xl flex flex-col items-center gap-4 text-on-surface animate-in fade-in duration-150 text-center">
            <div className="w-full flex items-center justify-between border-b border-outline-variant pb-2">
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                Registration Confirmed
              </span>
              <button
                type="button"
                onClick={() => setTicketModalEvent(null)}
                className="text-on-surface-muted hover:text-on-surface text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col items-center gap-1">
              <h3 className="font-headline text-headline-md text-on-surface">{ticketModalEvent.title}</h3>
              <p className="text-xs text-on-surface-variant">{ticketModalEvent.org}</p>
              <p className="text-xs text-on-surface-muted mt-0.5">{ticketModalEvent.dayNum} {ticketModalEvent.month} · {ticketModalEvent.time} · {ticketModalEvent.location}</p>
            </div>

            {/* ~240px Centered QR Ticket Graphic from Stitch */}
            <div className="w-56 h-56 rounded-xl bg-white border-2 border-outline-variant p-4 flex flex-col items-center justify-center gap-2 shadow-inner">
              <span className="material-symbols-outlined text-[108px] text-slate-900 leading-none">
                qr_code_2
              </span>
              <span className="font-mono text-[11px] font-bold text-slate-700 tracking-wider">
                TARS:EV:{ticketModalEvent.id}:SHREYANSH
              </span>
            </div>

            <div className="w-full p-2.5 rounded bg-surface-container-low border border-outline-variant text-[11px] text-on-surface-muted flex flex-col gap-0.5">
              <span className="font-semibold text-on-surface">DEMO PASS · Illustrative campus entry ticket</span>
              <span>Attendee: Shreyansh (26UG1BYCS0274-T · CSE-10)</span>
            </div>

            <div className="w-full flex items-center gap-2 pt-2 border-t border-outline-variant">
              <button
                type="button"
                onClick={() => handleCancelRegistration(ticketModalEvent)}
                className="flex-1 py-2 rounded text-xs border border-rose-300 text-rose-700 hover:bg-rose-50 font-medium cursor-pointer"
              >
                Cancel RSVP
              </button>
              <button
                type="button"
                onClick={() => setTicketModalEvent(null)}
                className="flex-1 py-2 rounded text-xs bg-primary text-on-primary font-semibold hover:bg-primary-hover shadow-2xs cursor-pointer"
              >
                Save Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post an Event Modal (Explicitly Disclosed as Demo Preview) */}
      {postModalOpen && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-2xl flex flex-col gap-4 text-on-surface animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_circle</span>
                <h3 className="font-title text-title-md">Post an Event</h3>
              </div>
              <button
                type="button"
                onClick={() => setPostModalOpen(false)}
                className="text-on-surface-muted hover:text-on-surface text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <p className="font-bold uppercase tracking-wider text-[10px]">DEMO PREVIEW — NOT LIVE</p>
              <p className="mt-0.5">Event posting is an illustrative club coordinator workflow. Backend creation endpoint is not live.</p>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Event Title</label>
                <input
                  type="text"
                  placeholder="e.g. AI Agents Workshop"
                  disabled
                  value="Agentic AI Workshop 2026"
                  className="w-full p-2 rounded border border-outline-variant bg-surface-container-low text-on-surface opacity-80"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Organizing Body</label>
                <input
                  type="text"
                  placeholder="e.g. ACM / IEEE Student Branch"
                  disabled
                  value="BMSIT ACM Chapter"
                  className="w-full p-2 rounded border border-outline-variant bg-surface-container-low text-on-surface opacity-80"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Date &amp; Venue</label>
                <input
                  type="text"
                  placeholder="e.g. Dec 10 · Seminar Hall"
                  disabled
                  value="10 Dec · Seminar Hall 2"
                  className="w-full p-2 rounded border border-outline-variant bg-surface-container-low text-on-surface opacity-80"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant">
              <button
                type="button"
                onClick={() => setPostModalOpen(false)}
                className="px-4 py-2 rounded text-xs text-on-surface-variant hover:bg-surface-container cursor-pointer"
              >
                Close Preview
              </button>
              <button
                type="button"
                disabled
                title="Illustrative workflow only"
                className="px-4 py-2 rounded text-xs bg-primary text-on-primary opacity-50 cursor-not-allowed font-semibold"
              >
                Submit Event (Simulated)
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
