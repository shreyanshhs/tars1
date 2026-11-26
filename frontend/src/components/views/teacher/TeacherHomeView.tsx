import React, { useState, useEffect } from 'react';
import { useTars } from '../../../context/TarsContext';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  tag?: string;
}

const DEFAULT_INITIAL_TODOS: Record<string, TodoItem[]> = {
  F_CDB: [
    { id: 'cdb-1', text: 'Prepare upcoming lecture materials', completed: false, createdAt: '2026-11-26' },
    { id: 'cdb-2', text: 'Review pending academic documentation', completed: false, createdAt: '2026-11-26' },
    { id: 'cdb-3', text: 'Follow up on NPTEL accreditation submissions (Illustrative cohort demo)', completed: false, createdAt: '2026-11-26', tag: 'Illustrative' },
    { id: 'cdb-4', text: 'Prepare the next laboratory exercise', completed: false, createdAt: '2026-11-26' },
  ],
  F_SMP: [
    { id: 'smp-1', text: 'Prepare upcoming lecture materials for AI & Machine Learning', completed: false, createdAt: '2026-11-26' },
    { id: 'smp-2', text: 'Review pending academic documentation', completed: false, createdAt: '2026-11-26' },
    { id: 'smp-3', text: 'Follow up on NPTEL accreditation submissions (Illustrative cohort demo)', completed: false, createdAt: '2026-11-26', tag: 'Illustrative' },
    { id: 'smp-4', text: 'Prepare the next laboratory exercise', completed: false, createdAt: '2026-11-26' },
  ],
  F_GPL: [
    { id: 'gpl-1', text: 'Prepare upcoming lecture materials', completed: false, createdAt: '2026-11-26' },
    { id: 'gpl-2', text: 'Review pending academic documentation', completed: false, createdAt: '2026-11-26' },
    { id: 'gpl-3', text: 'Follow up on NPTEL accreditation submissions (Illustrative cohort demo)', completed: false, createdAt: '2026-11-26', tag: 'Illustrative' },
    { id: 'gpl-4', text: 'Prepare the next laboratory exercise (Python Lab 511C)', completed: false, createdAt: '2026-11-26' },
  ],
};

interface TeacherHomeViewProps {
  onApplyLeave: () => void;
  onViewLeaveProgress: () => void;
  onOpenCoverRequest?: () => void;
  hasActiveLeave?: boolean;
}

export const TeacherHomeView: React.FC<TeacherHomeViewProps> = ({
  onApplyLeave,
  onViewLeaveProgress,
  onOpenCoverRequest,
  hasActiveLeave: propHasActiveLeave,
}) => {
  const {
    hasActiveLeave: contextHasActiveLeave,
    hodApproved,
    leaveDate,
    liveTimetable,
    timetableStatus,
    activeFacultyId,
    simulatedAiStatus,
    simulatedLabStatus,
    acceptAiCover,
    declineAiCover,
    acceptLabCover,
    declineLabCover,
  } = useTars();
  const hasActiveLeave = propHasActiveLeave !== undefined ? propHasActiveLeave : contextHasActiveLeave;
  const isSmp = activeFacultyId === 'F_SMP';
  const isGpl = activeFacultyId === 'F_GPL';

  const isLiveMode = timetableStatus === 'live';
  const isMockMode = timetableStatus === 'mock';

  const liveMatchP4 = liveTimetable?.find(
    (s) => (s.day === 'THU' || s.day === 'thu') && (s.period === 4 || s.period === '4' || s.period === 'P4')
  );
  const isP4Replanned = isLiveMode
    ? liveMatchP4?.status === 'replanned'
    : isMockMode && hasActiveLeave && hodApproved;

  const liveMatchLab = liveTimetable?.find(
    (s) => (s.day === 'THU' || s.day === 'thu') && (s.period === '6-7' || s.period === 6 || s.period === 7 || s.period === 'P6-P7')
  );
  const isLabReplanned = isLiveMode
    ? liveMatchLab?.status === 'replanned'
    : isMockMode && hasActiveLeave && hodApproved;

  const [coverDecision, setCoverDecision] = useState<'pending' | 'accepted' | 'declined'>('pending');
  const [activeChipMessage, setActiveChipMessage] = useState<string | null>(null);

  // Teacher To-Do state (Faculty-Only, isolated by authenticated activeFacultyId via localStorage)
  const currentFacultyId = activeFacultyId || 'F_CDB';
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`tars_teacher_todos_${currentFacultyId}`);
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return DEFAULT_INITIAL_TODOS[currentFacultyId] || DEFAULT_INITIAL_TODOS.F_CDB;
  });
  const [newTodoInput, setNewTodoInput] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const key = `tars_teacher_todos_${currentFacultyId}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          setTodos(JSON.parse(saved));
        } else {
          const initial = DEFAULT_INITIAL_TODOS[currentFacultyId] || DEFAULT_INITIAL_TODOS.F_CDB;
          setTodos(initial);
          localStorage.setItem(key, JSON.stringify(initial));
        }
      } catch {
        // ignore
      }
    }
  }, [currentFacultyId]);

  const saveTodos = (updated: TodoItem[]) => {
    setTodos(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`tars_teacher_todos_${currentFacultyId}`, JSON.stringify(updated));
      } catch {
        // ignore
      }
    }
  };

  const handleToggleTodo = (id: string) => {
    const updated = todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    saveTodos(updated);
  };

  const handleDeleteTodo = (id: string) => {
    const updated = todos.filter((t) => t.id !== id);
    saveTodos(updated);
  };

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTodoInput.trim();
    if (!text) return;
    const newItem: TodoItem = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      text,
      completed: false,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    saveTodos([newItem, ...todos]);
    setNewTodoInput('');
  };

  const handleChipClick = (type: 'free' | 'leave' | 'nptel') => {
    if (type === 'free') {
      setActiveChipMessage('Your free periods today (Thu): P1 (8:30-9:25), P2 (9:25-10:20), P3 (10:40-11:35), P5 (12:30-1:25). Teaching load: 3 periods.');
    } else if (type === 'leave') {
      setActiveChipMessage('No CSE faculty on leave today. Tomorrow (Friday): Kanakadasa Jayanti (College Holiday).');
    } else {
      setActiveChipMessage('NPTEL: 38/46 verified for CSE-10 Python Elite Collection. 8 submissions pending verification.');
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-surface text-on-surface font-body antialiased">
      {/* Top Bar (Stitch Teacher Home Header) */}
      <header className="sticky top-0 z-10 bg-surface border-b border-outline-variant px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <p className="font-label text-label-sm text-on-surface-muted" data-design-text-token="label-sm">
            Thursday, 26 November
          </p>
          <h1 className="font-headline text-headline-lg text-on-surface text-balance" data-design-text-token="headline-lg">
            {isSmp ? 'Good morning, Mr. Syed Matheen Pasha' : 'Good morning, Prof. Chaitra'}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* COMPONENT: searchbar-standard */}
          <form
            role="search"
            onSubmit={(e) => e.preventDefault()}
            className="relative flex items-center w-72 sm:w-80 bg-surface-container-lowest border border-outline-variant rounded-full px-3.5 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-soft transition-colors duration-state-change"
          >
            <span className="material-symbols-outlined text-[18px] text-primary mr-2" aria-hidden="true">
              auto_awesome
            </span>
            <input
              id="tars-search"
              type="search"
              aria-label="Ask TARS anything"
              placeholder="Ask TARS anything…"
              className="w-full bg-transparent border-0 p-0 text-body-md text-on-surface placeholder:text-on-surface-muted focus:ring-0 focus:outline-none"
            />
            <kbd className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-label text-label-sm border border-outline-variant shrink-0">
              ⌘K
            </kbd>
          </form>

          {/* COMPONENT: button-icon */}
          <button
            type="button"
            aria-label="Notifications"
            className="relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-surface-container-lowest text-on-surface-variant border border-outline-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-state-change ease-state-change shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              notifications
            </span>
            <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-primary" aria-hidden="true"></span>
          </button>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="flex-1 px-6 lg:px-8 py-6 max-w-[1360px] w-full mx-auto flex flex-col gap-5">
        {/* Row 1: TARS Brief (left wide) + Needs your decision (right) */}
        <section aria-label="Morning brief and pending decisions" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Row 1 Left: TARS Brief */}
          <article className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col justify-between gap-5 h-full">
            <div className="flex flex-col gap-4">
              <header className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {/* Official Google Stitch TARS Robot SVG Illustration */}
                  <svg width="32" height="32" viewBox="0 0 96 96" fill="none" className="shrink-0" aria-hidden="true">
                    <path d="M48 3L50.3 8.7L56 11L50.3 13.3L48 19L45.7 13.3L40 11L45.7 8.7L48 3Z" fill="#4F46E5" opacity="0.85"></path>
                    <rect x="11" y="47" width="9" height="19" rx="4.5" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1.5"></rect>
                    <rect x="76" y="47" width="9" height="19" rx="4.5" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1.5"></rect>
                    <rect x="20" y="23" width="56" height="62" rx="20" fill="#4F46E5"></rect>
                    <rect x="23" y="25" width="50" height="13" rx="9" fill="#FFFFFF" fillOpacity="0.22"></rect>
                    <ellipse cx="40.5" cy="51" rx="5.5" ry="7.5" fill="#EEF2FF"></ellipse>
                    <ellipse cx="55.5" cy="51" rx="5.5" ry="7.5" fill="#EEF2FF"></ellipse>
                    <circle cx="38.8" cy="48.2" r="1.8" fill="#FFFFFF"></circle>
                    <circle cx="53.8" cy="48.2" r="1.8" fill="#FFFFFF"></circle>
                  </svg>
                  <h2 className="font-title text-title-md text-on-surface tabular-nums" data-design-text-token="title-md">
                    TARS brief · 8:15 AM
                  </h2>
                </div>
              </header>

              <p className="font-body text-body-lg text-on-surface text-pretty max-w-prose" data-design-text-token="body-lg">
                {isSmp
                  ? hasActiveLeave
                    ? 'Prof. Chaitra D B requested you to cover Intro to AI for CSE-10 on Thursday Period 4 (11:35–12:30, Room SJB-104).'
                    : 'You have no pending substitute requests today. Teaching load: 2 periods.'
                  : isGpl
                  ? hasActiveLeave
                    ? 'Prof. Chaitra D B requested you to cover Python Programming Lab for CSE-10 on Thursday Periods 6–7 (2:15–4:05, Room 511C).'
                    : 'You have no pending substitute requests today. Teaching load: 3 periods.'
                  : 'Two things need you today: Mrs. Geetha asked you to cover Python for CSE-10 on Thursday P6–P7, and 6 NPTEL certificates are still pending.'}
              </p>

              {activeChipMessage && (
                <div className="p-3 rounded-md bg-surface-container border border-outline-variant text-body-sm text-on-surface-variant flex items-center justify-between gap-2 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary">info</span>
                    <span>{activeChipMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveChipMessage(null)}
                    className="text-on-surface-muted hover:text-on-surface text-xs font-semibold"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-outline-variant">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleChipClick('free')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant border border-outline-variant hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-state-change ease-state-change"
                >
                  <span className="font-label text-label-md" data-design-text-token="label-md">
                    My free periods
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleChipClick('leave')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant border border-outline-variant hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-state-change ease-state-change"
                >
                  <span className="font-label text-label-md" data-design-text-token="label-md">
                    Who's on leave today?
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleChipClick('nptel')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant border border-outline-variant hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-state-change ease-state-change"
                >
                  <span className="font-label text-label-md" data-design-text-token="label-md">
                    NPTEL status
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleChipClick('free')}
                className="font-label text-label-md text-primary hover:text-primary-hover transition-colors duration-state-change whitespace-nowrap"
                data-design-text-token="label-md"
              >
                Read full brief →
              </button>
            </footer>
          </article>

          {/* Row 1 Right: Needs your decision */}
          <article className="lg:col-span-5 bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col justify-between gap-4 h-full">
            <header className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="font-title text-title-md text-on-surface tabular-nums" data-design-text-token="title-md">
                  {isSmp || isGpl
                    ? hasActiveLeave
                      ? 'Needs your decision (1)'
                      : 'Needs your decision (0)'
                    : 'Needs your decision (2)'}
                </h2>
              </div>
            </header>

            {isSmp ? (
              hasActiveLeave ? (
                <>
                  <div className="flex flex-col gap-2.5 p-3.5 rounded-md bg-surface-container-low border border-outline-variant">
                    <div className="flex items-start gap-2.5">
                      <span
                        className="inline-flex items-center justify-center w-8 h-8 rounded bg-subject-ai-bg border border-subject-ai-border text-subject-ai-text shrink-0"
                        aria-hidden="true"
                      >
                        <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                      </span>
                      <div className="min-w-0">
                        <p className="font-title text-title-sm text-on-surface tabular-nums text-pretty" data-design-text-token="title-sm">
                          Cover request · Intro to AI (1BAI103) · CSE-10 · Thu P4 11:35–12:30 · SJB-104
                        </p>
                        <p className="font-body text-body-sm text-on-surface-muted mt-1 flex items-center gap-1.5" data-design-text-token="body-sm">
                          <span className="material-symbols-outlined text-[15px] text-primary" aria-hidden="true">
                            auto_awesome
                          </span>
                          <span>Requested by Prof. Chaitra D B · You are free P4</span>
                        </p>
                      </div>
                    </div>

                    {/* Safeguard 3 & 9: Explicit simulated acceptance label */}
                    <div className="mt-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-200 text-[11px] font-medium">
                      <span className="material-symbols-outlined text-[14px] shrink-0">info</span>
                      <span>Simulated acceptance — Telegram not connected</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {simulatedAiStatus === 'pending' ? (
                      <div id="decision-actions" className="flex items-center gap-3">
                        <button
                          id="btn-pasha-accept-cover"
                          type="button"
                          onClick={acceptAiCover}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-primary text-on-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors duration-state-change ease-state-change cursor-pointer font-label text-label-md font-semibold"
                        >
                          <span className="material-symbols-outlined text-[16px]">check</span>
                          <span>Accept Cover (Simulated)</span>
                        </button>
                        <button
                          id="btn-pasha-decline-cover"
                          type="button"
                          onClick={declineAiCover}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors duration-state-change ease-state-change cursor-pointer font-label text-label-md font-semibold"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                          <span>Decline</span>
                        </button>
                      </div>
                    ) : simulatedAiStatus === 'accepted' ? (
                      <div className="w-full px-3.5 py-2.5 rounded bg-status-done-bg border border-status-done-border text-status-done flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-label text-label-md font-semibold">Cover accepted · Ready for HOD review</span>
                          <span className="text-[11px] opacity-80">Simulated acceptance — Telegram not connected</span>
                        </div>
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      </div>
                    ) : (
                      <div className="w-full px-3.5 py-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-label text-label-md font-semibold">Cover declined · HOD approval remains blocked</span>
                          <span className="text-[11px] opacity-80">Request unconfirmed</span>
                        </div>
                        <button
                          type="button"
                          onClick={acceptAiCover}
                          className="text-xs text-primary font-semibold underline hover:opacity-80"
                        >
                          Re-evaluate (Accept)
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-on-surface-muted pt-1">
                      <span className="font-label text-label-sm text-on-surface-muted">Intro to AI · Section CSE-10</span>
                      <span className="font-label text-label-sm text-on-surface-muted">Thursday P4</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2 p-4 rounded-md bg-surface-container-low border border-outline-variant text-center">
                  <p className="font-title text-title-sm text-on-surface">No pending cover requests</p>
                  <p className="font-body text-body-sm text-on-surface-muted">
                    All classes covered. You have no pending substitute duties today.
                  </p>
                </div>
              )
            ) : isGpl ? (
              hasActiveLeave ? (
                <>
                  <div className="flex flex-col gap-2.5 p-3.5 rounded-md bg-surface-container-low border border-outline-variant">
                    <div className="flex items-start gap-2.5">
                      <span
                        className="inline-flex items-center justify-center w-8 h-8 rounded bg-subject-python-bg border border-subject-python-border text-subject-python-text shrink-0"
                        aria-hidden="true"
                      >
                        <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                      </span>
                      <div className="min-w-0">
                        <p className="font-title text-title-sm text-on-surface tabular-nums text-pretty" data-design-text-token="title-sm">
                          Cover request · Python Lab (PLC LAB) · CSE-10 · Thu P6–P7 2:15–4:05 · 511C
                        </p>
                        <p className="font-body text-body-sm text-on-surface-muted mt-1 flex items-center gap-1.5" data-design-text-token="body-sm">
                          <span className="material-symbols-outlined text-[15px] text-primary" aria-hidden="true">
                            auto_awesome
                          </span>
                          <span>Requested by Prof. Chaitra D B · Co-faculty · You are free P6–P7</span>
                        </p>
                      </div>
                    </div>

                    {/* Safeguard 3 & 9: Explicit simulated acceptance label */}
                    <div className="mt-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-200 text-[11px] font-medium">
                      <span className="material-symbols-outlined text-[14px] shrink-0">info</span>
                      <span>Simulated acceptance — Telegram not connected</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {simulatedLabStatus === 'pending' ? (
                      <div id="decision-actions-gpl" className="flex items-center gap-3">
                        <button
                          id="btn-geetha-accept-cover"
                          type="button"
                          onClick={acceptLabCover}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-primary text-on-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors duration-state-change ease-state-change cursor-pointer font-label text-label-md font-semibold"
                        >
                          <span className="material-symbols-outlined text-[16px]">check</span>
                          <span>Accept Cover (Simulated)</span>
                        </button>
                        <button
                          id="btn-geetha-decline-cover"
                          type="button"
                          onClick={declineLabCover}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors duration-state-change ease-state-change cursor-pointer font-label text-label-md font-semibold"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                          <span>Decline</span>
                        </button>
                      </div>
                    ) : simulatedLabStatus === 'accepted' ? (
                      <div className="w-full px-3.5 py-2.5 rounded bg-status-done-bg border border-status-done-border text-status-done flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-label text-label-md font-semibold">Cover accepted · Ready for HOD review</span>
                          <span className="text-[11px] opacity-80">Simulated acceptance — Telegram not connected</span>
                        </div>
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      </div>
                    ) : (
                      <div className="w-full px-3.5 py-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-label text-label-md font-semibold">Cover declined · HOD approval remains blocked</span>
                          <span className="text-[11px] opacity-80">Request unconfirmed</span>
                        </div>
                        <button
                          type="button"
                          onClick={acceptLabCover}
                          className="text-xs text-primary font-semibold underline hover:opacity-80"
                        >
                          Re-evaluate (Accept)
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-on-surface-muted pt-1">
                      <span className="font-label text-label-sm text-on-surface-muted">Python Lab (PLC LAB) · Section CSE-10</span>
                      <span className="font-label text-label-sm text-on-surface-muted">Thursday P6–P7</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2 p-4 rounded-md bg-surface-container-low border border-outline-variant text-center">
                  <p className="font-title text-title-sm text-on-surface">No pending cover requests</p>
                  <p className="font-body text-body-sm text-on-surface-muted">
                    All classes covered. You have no pending substitute duties today.
                  </p>
                </div>
              )
            ) : (
              <>
                <div className="flex flex-col gap-2.5 p-3.5 rounded-md bg-surface-container-low border border-outline-variant">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 rounded bg-subject-python-bg border border-subject-python-border text-subject-python-text shrink-0"
                      aria-hidden="true"
                    >
                      <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                    </span>
                    <div className="min-w-0">
                      <p className="font-title text-title-sm text-on-surface tabular-nums text-pretty" data-design-text-token="title-sm">
                        Cover request · Python · CSE-10 · Thu 2:20–4:10 · 511C
                      </p>
                      <p className="font-body text-body-sm text-on-surface-muted mt-1 flex items-center gap-1.5" data-design-text-token="body-sm">
                        <span className="material-symbols-outlined text-[15px] text-primary" aria-hidden="true">
                          auto_awesome
                        </span>
                        <span>You're free then · lowest load this week</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {coverDecision === 'pending' ? (
                    <div id="decision-actions" className="flex items-center gap-3">
                      <button
                        id="btn-accept-cover"
                        type="button"
                        onClick={() => setCoverDecision('accepted')}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-primary text-on-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors duration-state-change ease-state-change cursor-pointer"
                      >
                        <span className="font-label text-label-lg" data-design-text-token="label-lg">
                          Accept
                        </span>
                      </button>
                      <button
                        id="btn-decline-cover"
                        type="button"
                        onClick={() => setCoverDecision('declined')}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors duration-state-change ease-state-change cursor-pointer"
                      >
                        <span className="font-label text-label-lg" data-design-text-token="label-lg">
                          Decline
                        </span>
                      </button>
                    </div>
                  ) : coverDecision === 'accepted' ? (
                    <div className="w-full px-3.5 py-2.5 rounded bg-status-done-bg border border-status-done-border text-status-done flex items-center justify-between gap-2">
                      <span className="font-label text-label-md">Cover accepted · Mrs. Geetha notified</span>
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    </div>
                  ) : (
                    <div className="w-full px-3.5 py-2.5 rounded bg-surface-container border border-outline-variant text-on-surface-variant flex items-center justify-between gap-2">
                      <span className="font-label text-label-md">Declined · TARS will suggest next free faculty</span>
                      <button
                        type="button"
                        onClick={() => setCoverDecision('pending')}
                        className="text-xs text-primary font-semibold underline"
                      >
                        Undo
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-on-surface-muted pt-1">
                    <button
                      type="button"
                      onClick={onOpenCoverRequest}
                      className="font-label text-label-sm text-on-surface-muted hover:text-primary transition-colors duration-state-change cursor-pointer"
                      data-design-text-token="label-sm"
                    >
                      View Geetha's cover card →
                    </button>
                    <span className="font-label text-label-sm text-on-surface-muted">+1 more · NPTEL review →</span>
                  </div>
                </div>
              </>
            )}
          </article>
        </section>

        {/* Row 2: Horizontal Day Timeline (8:30 AM - 4:10 PM, Exact Google Stitch Layout) */}
        <section aria-label="Today's schedule">
          <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col gap-4">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="font-title text-title-md text-on-surface" data-design-text-token="title-md">
                  Today's schedule
                </h2>
                <span className="font-body text-body-sm text-on-surface-muted tabular-nums" data-design-text-token="body-sm">
                  8:30 AM – 4:10 PM
                </span>
              </div>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-soft text-primary border border-subject-python-border font-label text-label-sm tabular-nums"
                data-design-text-token="label-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true"></span>
                Now 11:47
              </span>
            </header>

            {/* Horizontal Timeline Track */}
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[820px] flex flex-col gap-2">
                {/* Timeline Blocks Area */}
                <div className="relative h-24 rounded-md bg-surface-container-low border border-outline-variant px-2 py-3">
                  {/* Now 11:47 vertical marker (42.8% from 8:30 AM to 4:10 PM) */}
                  <div className="absolute top-0 bottom-0 z-10 flex flex-col items-center pointer-events-none" style={{ left: '42.8%' }} aria-hidden="true">
                    <div className="w-2 h-2 rounded-full bg-primary -mt-1"></div>
                    <div className="w-px flex-1 bg-primary"></div>
                  </div>

                  {/* 10:20–10:40 Tea break */}
                  <div
                    className="absolute top-3 bottom-3 rounded bg-break-bg border border-break-border px-2 py-1.5 flex flex-col justify-center overflow-hidden"
                    style={{ left: '23.9%', width: '6.2%' }}
                    title="Tea break · 10:20–10:40"
                  >
                    <p className="font-label text-label-sm text-break-text leading-tight" data-design-text-token="label-sm">
                      Tea
                    </p>
                    <p className="font-body text-label-sm text-break-text tabular-nums leading-tight" data-design-text-token="label-sm">
                      10:20
                    </p>
                  </div>

                  {/* 11:35–12:30 Intro to AI · CSE-10 (Dynamically updates if HOD approves) */}
                  <div
                    className={`absolute top-3 bottom-3 rounded border px-3 py-1.5 flex flex-col justify-center transition-colors ${
                      isP4Replanned
                        ? 'bg-status-done-bg border-status-done-border text-status-done'
                        : 'bg-subject-ai-bg border-subject-ai-border text-subject-ai-text'
                    }`}
                    style={{ left: '39.5%', width: '19.5%' }}
                  >
                    <p className="font-title text-title-sm leading-tight truncate" data-design-text-token="title-sm">
                      {isP4Replanned ? 'Intro to AI (Cover: Prof. Pasha)' : 'Intro to AI · CSE-10'}
                    </p>
                    <p className="font-body text-body-sm tabular-nums leading-tight mt-0.5" data-design-text-token="body-sm">
                      11:35–12:30
                    </p>
                  </div>

                  {/* 12:30–1:25 P5 Python (Unconfirmed — Data Mismatch, Occupied) */}
                  <div
                    className="absolute top-3 bottom-3 rounded bg-amber-50/80 border border-amber-200 px-2 py-1.5 flex flex-col justify-center overflow-hidden"
                    style={{ left: '59.0%', width: '5.1%' }}
                    title="12:30–1:25 · Python (Unconfirmed — Data Mismatch) · SJB-104 · Mrs. Geetha P L (Busy)"
                  >
                    <p className="font-label text-[10px] font-semibold text-amber-900 leading-tight">
                      P5 Busy
                    </p>
                    <p className="font-body text-[9px] text-amber-800 tabular-nums leading-tight mt-0.5">
                      Unconfirmed
                    </p>
                  </div>

                  {/* 1:25–2:20 Lunch */}
                  <div
                    className="absolute top-3 bottom-3 rounded bg-break-bg border border-break-border px-2.5 py-1.5 flex flex-col justify-center"
                    style={{ left: '64.1%', width: '11.2%' }}
                  >
                    <p className="font-label text-label-sm text-break-text leading-tight" data-design-text-token="label-sm">
                      Lunch
                    </p>
                    <p className="font-body text-label-sm text-break-text tabular-nums leading-tight mt-0.5" data-design-text-token="label-sm">
                      1:25–2:20
                    </p>
                  </div>

                  {/* 2:20–4:10 Python lab · CSE-10 · 511C (Dynamically updates if HOD approves) */}
                  <div
                    className={`absolute top-3 bottom-3 rounded border px-3 py-1.5 flex flex-col justify-center transition-colors ${
                      isLabReplanned
                        ? 'bg-status-done-bg border-status-done-border text-status-done'
                        : 'bg-subject-python-bg border-subject-python-border text-subject-python-text'
                    }`}
                    style={{ left: '76.1%', width: '23.4%' }}
                  >
                    <p className="font-title text-title-sm leading-tight truncate" data-design-text-token="title-sm">
                      {isLabReplanned ? 'Python lab (Lead: Mrs. Geetha · HOD approved · Confirmation pending)' : 'Python lab · CSE-10 · 511C'}
                    </p>
                    <p className="font-body text-body-sm tabular-nums leading-tight mt-0.5" data-design-text-token="body-sm">
                      2:20–4:10
                    </p>
                  </div>
                </div>

                {/* Time Axis Labels */}
                <div className="relative h-5 font-label text-label-sm text-on-surface-muted tabular-nums">
                  <span className="absolute left-0" data-design-text-token="label-sm">
                    8:30 AM
                  </span>
                  <span className="absolute" style={{ left: '19.6%' }} data-design-text-token="label-sm">
                    10:00
                  </span>
                  <span className="absolute" style={{ left: '39.1%' }} data-design-text-token="label-sm">
                    11:30
                  </span>
                  <span className="absolute" style={{ left: '58.7%' }} data-design-text-token="label-sm">
                    1:00 PM
                  </span>
                  <span className="absolute" style={{ left: '78.3%' }} data-design-text-token="label-sm">
                    2:30
                  </span>
                  <span className="absolute right-0" data-design-text-token="label-sm">
                    4:10 PM
                  </span>
                </div>
              </div>
            </div>

            {/* Next Class Strip */}
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-md bg-surface-container-low border border-outline-variant">
              <div className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full ${isP4Replanned ? 'bg-status-done' : 'bg-subject-ai-text'} shrink-0`} aria-hidden="true"></span>
                <p className="font-label text-label-md text-on-surface tabular-nums" data-design-text-token="label-md">
                  {isP4Replanned
                    ? 'Next: Intro to AI · 11:35 · SJB-104 (Cover: Prof. Pasha · Confirmation pending)'
                    : 'Next: Intro to AI · 11:35 · SJB-104'}
                </p>
              </div>
              <span className="material-symbols-outlined text-[18px] text-on-surface-muted" aria-hidden="true">
                arrow_forward
              </span>
            </div>
          </article>
        </section>

        {/* Row 3: My requests (left) + Apply for leave (right) */}
        <section aria-label="My requests and leave application" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Row 3 Left: My requests */}
          <article className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col gap-4 h-full">
            <header className="flex items-center justify-between gap-3">
              <h2 className="font-title text-title-md text-on-surface" data-design-text-token="title-md">
                My requests
              </h2>
              {hasActiveLeave && (
                <button
                  type="button"
                  onClick={onViewLeaveProgress}
                  className="font-label text-label-sm text-on-surface-muted hover:text-primary transition-colors duration-state-change"
                  data-design-text-token="label-sm"
                >
                  View live progress →
                </button>
              )}
            </header>

            <ul className="flex flex-col divide-y divide-outline-variant">
              {/* Leave Request Item */}
              {hasActiveLeave ? (
                <li
                  onClick={onViewLeaveProgress}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4 cursor-pointer hover:bg-surface-container-low p-2 rounded transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-surface-container text-on-surface-variant shrink-0" aria-hidden="true">
                      <span className="material-symbols-outlined text-[18px]">event_busy</span>
                    </span>
                    <span className="font-body text-body-md text-on-surface tabular-nums" data-design-text-token="body-md">
                      Leave · {leaveDate}
                    </span>
                  </div>
                  {hodApproved ? (
                    <span
                      role="status"
                      className="inline-flex items-center px-2.5 py-1 rounded-full bg-status-done-bg text-status-done border border-status-done-border shrink-0"
                    >
                      <span className="font-label text-label-sm" data-design-text-token="label-sm">
                        Approved by HOD
                      </span>
                    </span>
                  ) : (
                    <span
                      role="status"
                      className="inline-flex items-center px-2.5 py-1 rounded-full bg-status-waiting-bg text-status-waiting border border-status-waiting-border shrink-0"
                    >
                      <span className="font-label text-label-sm" data-design-text-token="label-sm">
                        Waiting on HOD
                      </span>
                    </span>
                  )}
                </li>
              ) : (
                <li className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4 text-body-sm text-on-surface-muted">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-surface-container text-on-surface-variant shrink-0">
                      <span className="material-symbols-outlined text-[18px]">event_busy</span>
                    </span>
                    <span>No active leave requests</span>
                  </div>
                  <button
                    type="button"
                    onClick={onApplyLeave}
                    className="font-label text-label-sm text-primary hover:text-primary-hover font-semibold"
                  >
                    Apply now →
                  </button>
                </li>
              )}

              {/* NPTEL Request Item */}
              <li className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-surface-container text-on-surface-variant shrink-0" aria-hidden="true">
                    <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
                  </span>
                  <span className="font-body text-body-md text-on-surface tabular-nums" data-design-text-token="body-md">
                    NPTEL · CSE-10
                  </span>
                </div>
                <span
                  role="status"
                  className="inline-flex items-center px-2.5 py-1 rounded-full bg-status-active-bg text-status-active border border-status-active-border tabular-nums shrink-0"
                >
                  <span className="font-label text-label-sm" data-design-text-token="label-sm">
                    38/46 verified
                  </span>
                </span>
              </li>

              {/* Cover Request Item */}
              <li className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-surface-container text-on-surface-variant shrink-0" aria-hidden="true">
                    <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                  </span>
                  <span className="font-body text-body-md text-on-surface tabular-nums" data-design-text-token="body-md">
                    Cover · Mon P4
                  </span>
                </div>
                <span
                  role="status"
                  className="inline-flex items-center px-2.5 py-1 rounded-full bg-status-done-bg text-status-done border border-status-done-border shrink-0"
                >
                  <span className="font-label text-label-sm" data-design-text-token="label-sm">
                    Covered
                  </span>
                </span>
              </li>
            </ul>
          </article>

          {/* Row 3 Right: Apply for leave */}
          <article className="lg:col-span-5 bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col justify-between gap-5 h-full">
            <div className="flex flex-col gap-2">
              <h2 className="font-title text-title-md text-on-surface" data-design-text-token="title-md">
                Need time off?
              </h2>
              <p className="font-body text-body-md text-on-surface-variant text-pretty" data-design-text-token="body-md">
                TARS finds substitutes and handles HOD approval.
              </p>
            </div>

            {(!activeFacultyId || activeFacultyId === 'F_CDB') ? (
              <button
                id="btn-apply-for-leave"
                type="button"
                onClick={onApplyLeave}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-primary text-on-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors duration-state-change ease-state-change cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  event_busy
                </span>
                <span className="font-label text-label-lg" data-design-text-token="label-lg">
                  Apply for leave
                </span>
              </button>
            ) : (
              <div className="p-3.5 rounded bg-surface-container border border-outline-variant text-body-sm text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">info</span>
                <span>Active substitute persona ({activeFacultyId === 'F_SMP' ? 'Mr. Syed Matheen Pasha' : 'Mrs. Geetha P L'}). Switch to Prof. Chaitra D B to submit leave.</span>
              </div>
            )}
          </article>
        </section>

        {/* Row 4: Teacher To-Do (Faculty-Only Checklist, Isolated by Faculty Persona) */}
        <section aria-label="Teacher To-Do list" className="w-full">
          <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col gap-5 shadow-xs">
            <header className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-outline-variant">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <span className="material-symbols-outlined text-[18px]">checklist</span>
                </span>
                <div>
                  <h2 className="font-title text-title-md text-on-surface">
                    Teacher To-Do
                  </h2>
                  <p className="font-body text-body-xs text-on-surface-muted">
                    {isSmp
                      ? "Mr. Syed Matheen Pasha's task checklist"
                      : isGpl
                      ? "Mrs. Geetha P L's task checklist"
                      : "Prof. Chaitra D B's task checklist"} · Isolated by faculty profile
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant text-label-sm font-semibold border border-outline-variant">
                  {todos.filter((t) => t.completed).length} of {todos.length} completed
                </span>
              </div>
            </header>

            {/* Add Task Input Form */}
            <form onSubmit={handleAddTodo} className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={newTodoInput}
                  onChange={(e) => setNewTodoInput(e.target.value)}
                  placeholder="Add a new task (e.g. Grade assignments, follow up with lab students)…"
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-md px-3.5 py-2 text-body-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                type="submit"
                disabled={!newTodoInput.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-on-primary text-xs font-semibold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Add Task</span>
              </button>
            </form>

            {/* Task Items List */}
            {todos.length === 0 ? (
              <p className="text-body-sm text-on-surface-muted text-center py-4">
                No tasks yet. Add a task above to manage your academic to-do list.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-outline-variant/60">
                {todos.map((todo) => (
                  <li
                    key={todo.id}
                    className="py-2.5 flex items-center justify-between gap-3 group hover:bg-surface-container-low/50 px-2 rounded transition-colors"
                  >
                    <label className="flex items-center gap-3 min-w-0 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={() => handleToggleTodo(todo.id)}
                        className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer shrink-0"
                      />
                      <span
                        className={`text-body-sm truncate ${
                          todo.completed
                            ? 'line-through text-on-surface-muted opacity-60'
                            : 'text-on-surface font-medium'
                        }`}
                      >
                        {todo.text}
                      </span>
                      {todo.tag && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 shrink-0 font-medium">
                          {todo.tag}
                        </span>
                      )}
                    </label>

                    <button
                      type="button"
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="p-1 rounded text-on-surface-muted hover:text-rose-600 hover:bg-rose-500/10 transition-colors opacity-80 group-hover:opacity-100 cursor-pointer"
                      title="Delete task"
                      aria-label={`Delete task ${todo.text}`}
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <footer className="pt-2 border-t border-outline-variant/60 flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-muted">
              <span>Local browser persistence · Keyed to {currentFacultyId}</span>
              <span>All classes covered · No active leave tasks pending</span>
            </footer>
          </article>
        </section>
      </main>
    </div>
  );
};
