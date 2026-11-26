import React, { useState, useEffect } from 'react';
import { useTars } from '../../context/TarsContext';

export const NudgesView: React.FC = () => {
  const { nudges, selectedNudgeId, setSelectedNudgeId, handleNudgeAction, setCurrentView, role, activeFacultyId } = useTars();
  const [activeFilter, setActiveFilter] = useState<'all' | 'needs_action' | 'updates'>('all');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Authenticated user ID for demo-level frontend isolation
  const userId = role === 'hod' ? 'H_SKB' : role === 'student' ? 'S0000' : (activeFacultyId || 'F_CDB');

  const [userOverrides, setUserOverrides] = useState<Record<string, 'pending' | 'completed' | 'snoozed' | 'blocked'>>(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(`tars_inbox_overrides_${userId}`);
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {};
  });

  // Reload user-specific inbox overrides when switching accounts
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(`tars_inbox_overrides_${userId}`);
        setUserOverrides(saved ? JSON.parse(saved) : {});
      } catch {
        setUserOverrides({});
      }
    }
  }, [userId]);

  const userNudges = nudges.map((n) => {
    const override = userOverrides[n.id];
    return override ? { ...n, status: override } : n;
  });

  const selectedNudge = userNudges.find((n) => n.id === selectedNudgeId) || userNudges[0];

  const handleAction = (id: string, action: 'done' | 'snooze' | 'block') => {
    const newStatus: 'pending' | 'completed' | 'snoozed' | 'blocked' =
      action === 'done' ? 'completed' : action === 'snooze' ? 'snoozed' : 'blocked';
    setUserOverrides((prev) => {
      const next: Record<string, 'pending' | 'completed' | 'snoozed' | 'blocked'> = { ...prev, [id]: newStatus };
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(`tars_inbox_overrides_${userId}`, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });

    // Keep existing backend nudge functionality intact
    handleNudgeAction(id, action);

    setActionFeedback(
      action === 'done'
        ? `Nudge completed for account ${userId}.`
        : action === 'snooze'
        ? `Nudge snoozed for account ${userId}.`
        : `Notification dismissed for account ${userId}.`,
    );
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const filteredNudges = userNudges.filter((n) => {
    if (activeFilter === 'needs_action') return n.status === 'pending';
    if (activeFilter === 'updates') return n.status !== 'pending';
    return true;
  });

  return (
    <main className="flex-1 min-w-0 flex flex-col lg:flex-row bg-surface text-on-surface font-body antialiased">
      {/* Left Column: Inbox List (420px) */}
      <section className="w-full lg:w-[420px] shrink-0 bg-surface-container-lowest border-r border-outline-variant flex flex-col shadow-2xs">
        {/* List Header */}
        <header className="px-6 pt-6 pb-4 border-b border-outline-variant flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h1 className="font-headline text-headline-md text-on-surface" data-design-text-token="headline-md">
                Inbox
              </h1>
              <span
                className="px-2.5 py-0.5 rounded-full bg-primary-soft text-on-primary-soft font-label text-label-sm tabular-nums font-semibold"
                data-design-text-token="label-sm"
              >
                {userNudges.filter((n) => n.status === 'pending').length} new
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-mono uppercase font-bold">
                {userId} · INBOX
              </span>
            </div>
          </div>

          {/* Account isolation disclosure */}
          <div className="px-2.5 py-1 rounded bg-surface-container border border-outline-variant text-[11px] font-label text-on-surface-variant flex items-center justify-between">
            <span>Isolated state for <strong className="text-on-surface">{userId}</strong></span>
            <span className="text-[10px] uppercase font-mono text-on-surface-muted">Demo Isolation</span>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 pt-1">
            {(['all', 'needs_action', 'updates'] as const).map((filter) => {
              const label =
                filter === 'all'
                  ? 'All'
                  : filter === 'needs_action'
                  ? 'Needs action'
                  : 'Updates';
              const isSelected = activeFilter === filter;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`px-3 py-1 rounded-full text-xs font-label transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-white font-semibold shadow-2xs'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </header>

        {/* Inbox Items List */}
        <div className="flex flex-col divide-y divide-outline-variant overflow-y-auto max-h-[calc(100vh-170px)]">
          {filteredNudges.length === 0 ? (
            <div className="p-8 text-center text-on-surface-muted text-xs">
              <span className="material-symbols-outlined text-[28px] text-on-surface-muted mb-2 block">inbox</span>
              No items in this folder.
            </div>
          ) : (
            filteredNudges.map((nudge) => {
              const isSelected = nudge.id === selectedNudge?.id;
              const isPending = nudge.status === 'pending';

              return (
                <article
                  key={nudge.id}
                  onClick={() => setSelectedNudgeId(nudge.id)}
                  className={`p-4 flex items-start gap-3.5 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-primary-soft/40 border-l-4 border-l-primary'
                      : 'hover:bg-surface-container-low'
                  }`}
                >
                  {/* Category Icon */}
                  <span
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${
                      isPending
                        ? 'bg-status-waiting-bg text-status-waiting border border-status-waiting-border'
                        : 'bg-status-done-bg text-status-done border border-status-done-border'
                    }`}
                    aria-hidden="true"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {nudge.category === 'ATTENDANCE'
                        ? 'fact_check'
                        : nudge.category === 'PACING'
                        ? 'menu_book'
                        : 'auto_awesome'}
                    </span>
                  </span>

                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-label text-label-sm text-on-surface-muted capitalize">
                        {nudge.category}
                      </span>
                      <span className="font-body text-body-sm text-on-surface-muted tabular-nums text-[11px]">
                        {nudge.dueText || 'Today'}
                      </span>
                    </div>

                    <h2
                      className={`font-title text-title-sm truncate ${
                        isPending ? 'text-on-surface font-semibold' : 'text-on-surface-variant'
                      }`}
                      data-design-text-token="title-sm"
                    >
                      {nudge.title}
                    </h2>

                    <p className="font-body text-body-sm text-on-surface-muted line-clamp-2 text-pretty text-xs">
                      {nudge.snippet || nudge.description}
                    </p>
                  </div>

                  {isPending && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" title="Unread" />
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* Right Column: Detail Pane */}
      <section className="flex-1 min-w-0 p-6 lg:p-8 flex flex-col gap-6">
        {actionFeedback && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between animate-in fade-in">
            <span>{actionFeedback}</span>
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
          </div>
        )}

        {selectedNudge ? (
          <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 lg:p-8 flex flex-col gap-6 shadow-2xs">
            {/* Detail Header */}
            <header className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-outline-variant">
              <div className="flex items-start gap-3.5">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary-soft text-primary border border-status-active-border shrink-0">
                  <span className="material-symbols-outlined text-[22px]">mail</span>
                </span>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label text-[11px] font-bold uppercase">
                      {selectedNudge.category}
                    </span>
                    <span className="text-xs text-on-surface-muted">
                      {selectedNudge.dueText || 'Today · Dispatch confirmed'}
                    </span>
                  </div>
                  <h2 className="font-headline text-headline-md text-on-surface text-balance">
                    {selectedNudge.headline || selectedNudge.title}
                  </h2>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAction(selectedNudge.id, 'snooze')}
                  className="px-3 py-1.5 rounded bg-surface-container-lowest border border-outline-variant hover:bg-surface-container text-on-surface font-label text-label-sm transition-colors cursor-pointer"
                  title="Remind me in next free period"
                >
                  Snooze
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(selectedNudge.id, 'done')}
                  className="px-4 py-1.5 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-sm font-semibold transition-colors cursor-pointer shadow-2xs"
                >
                  Acknowledge
                </button>
              </div>
            </header>

            {/* Context Card */}
            <div className="p-4 rounded-lg bg-surface-container-low border border-outline-variant flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                <span>TARS Autonomous Context</span>
              </div>
              <p className="font-body text-body-md text-on-surface leading-relaxed text-pretty">
                {selectedNudge.description}
              </p>
              {selectedNudge.targetSlot && (
                <p className="text-xs font-mono text-on-surface-muted pt-1 border-t border-outline-variant/60">
                  Target slot: {selectedNudge.targetSlot}
                </p>
              )}
            </div>

            {/* Recommended Action Plan */}
            {selectedNudge.plan && (
              <div className="flex flex-col gap-3">
                <h3 className="font-title text-title-sm text-on-surface">Suggested plan of action</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-md bg-surface-container-lowest border border-outline-variant flex flex-col gap-1">
                    <span className="font-semibold text-on-surface">{selectedNudge.plan.slotTitle}</span>
                    <span className="text-on-surface-muted">{selectedNudge.plan.slotDesc}</span>
                  </div>
                  <div className="p-3 rounded-md bg-surface-container-lowest border border-outline-variant flex flex-col gap-1">
                    <span className="font-semibold text-on-surface">{selectedNudge.plan.setupTitle}</span>
                    <span className="text-on-surface-muted">{selectedNudge.plan.setupDesc}</span>
                  </div>
                  <div className="p-3 rounded-md bg-surface-container-lowest border border-outline-variant flex flex-col gap-1">
                    <span className="font-semibold text-on-surface">{selectedNudge.plan.sanctuaryTitle}</span>
                    <span className="text-on-surface-muted">{selectedNudge.plan.sanctuaryDesc}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Quick Links */}
            <footer className="pt-4 border-t border-outline-variant flex items-center justify-between text-xs text-on-surface-muted">
              <span>Nudge ID: {selectedNudge.id} · Persisted via SQLite nudges</span>
              <button
                type="button"
                onClick={() => setCurrentView('schedule')}
                className="text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View Schedule</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </footer>
          </article>
        ) : (
          <div className="py-20 text-center text-on-surface-muted">
            <p>Select a message from the inbox to read.</p>
          </div>
        )}
      </section>
    </main>
  );
};
