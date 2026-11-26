import React, { useState } from 'react';
import { useTars } from '../../../context/TarsContext';

interface ApplyForLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (leaveId: string) => void;
}

export const ApplyForLeaveModal: React.FC<ApplyForLeaveModalProps> = ({
  isOpen,
  onClose,
  onSubmitSuccess,
}) => {
  const { hasActiveLeave, applyLeave } = useTars();
  const [selectedDate, setSelectedDate] = useState('2026-12-03');
  const [leaveType, setLeaveType] = useState('Personal');
  const [reason, setReason] = useState('Family function & personal commitment');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Timetable lookup for selected date (Thursday 3 Dec)
  const isThursday = selectedDate === '2026-12-03' || selectedDate.includes('Thu') || new Date(selectedDate).getDay() === 4;

  const affectedClasses = isThursday
    ? [
        {
          code: '1BAI103',
          name: 'Intro to AI',
          section: 'CSE-10',
          period: 'P4 11:35–12:30',
          room: 'SJB-104',
          type: 'ai',
        },
        {
          code: '1BPLC105B',
          name: 'Python lab',
          section: 'CSE-10',
          period: 'P6–P7 2:20–4:10',
          room: '511C',
          type: 'python',
        },
      ]
    : [
        {
          code: '1BAI103',
          name: 'Intro to AI',
          section: 'CSE-10',
          period: 'P2 9:25–10:20',
          room: 'SJB-104',
          type: 'ai',
        },
        {
          code: 'BCSL504',
          name: 'Web Tech Lab',
          section: 'K2',
          period: 'P3–P4 10:40–12:30',
          room: '306',
          type: 'python',
        },
      ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const sanitizedReason = reason.trim() || `${leaveType} Leave Application`;
      const dateLabels: Record<string, string> = {
        '2026-12-03': 'Thursday, 3 Dec 2026',
        '2026-12-04': 'Friday, 4 Dec 2026',
        '2026-12-08': 'Tuesday, 8 Dec 2026',
        '2026-12-09': 'Wednesday, 9 Dec 2026',
      };
      const formattedDate = dateLabels[selectedDate] || selectedDate;
      await applyLeave(formattedDate, leaveType, sanitizedReason);

      setIsSubmitting(false);
      onClose();
      onSubmitSuccess('leave_submitted');
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err?.message || 'Failed to submit leave request');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-on-surface/30 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-modal-title"
    >
      <div className="w-full max-w-xl bg-surface-container-lowest border border-outline-variant rounded-lg p-6 sm:p-7 flex flex-col gap-5 shadow-2xl">
        {/* Modal Header */}
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 id="leave-modal-title" className="font-headline text-headline-md text-on-surface" data-design-text-token="headline-md">
              Apply for leave
            </h1>
            <p className="font-body text-body-md text-on-surface-variant text-pretty" data-design-text-token="body-md">
              TARS will find substitutes and send it to the HOD. You don't need to arrange anything.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-surface-container-lowest text-on-surface-variant border border-outline-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-state-change shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              close
            </span>
          </button>
        </header>

        {/* Active Leave Warning */}
        {hasActiveLeave && (
          <div className="p-3.5 rounded-md bg-status-waiting-bg border border-status-waiting-border text-status-waiting flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5" aria-hidden="true">
              warning
            </span>
            <p className="font-body text-body-sm tabular-nums text-pretty">
              <span className="font-semibold">Active leave in progress:</span> Submitting a new request will supersede your active leave workflow.
            </p>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 rounded-md bg-status-attention-bg border border-status-attention-border text-status-attention flex items-center gap-2.5 text-body-sm">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Date Picker + Leave Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="leave-date" className="font-label text-label-md text-on-surface" data-design-text-token="label-md">
                Date
              </label>
              <div className="relative flex items-center bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-soft">
                <span className="material-symbols-outlined text-[18px] text-primary mr-2" aria-hidden="true">
                  calendar_today
                </span>
                <select
                  id="leave-date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-transparent border-0 p-0 font-body text-body-md text-on-surface focus:ring-0 focus:outline-none tabular-nums cursor-pointer"
                >
                  <option value="2026-12-03">Thursday, 3 December 2026</option>
                  <option value="2026-12-04">Friday, 4 December 2026</option>
                  <option value="2026-12-08">Tuesday, 8 December 2026</option>
                  <option value="2026-12-09">Wednesday, 9 December 2026</option>
                </select>
                <span className="material-symbols-outlined text-[18px] text-on-surface-muted ml-1 pointer-events-none" aria-hidden="true">
                  expand_more
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="font-label text-label-md text-on-surface" data-design-text-token="label-md">
                Leave type
              </span>
              <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Leave type">
                {['Personal', 'Medical', 'Official duty'].map((type) => {
                  const isSelected = leaveType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLeaveType(type)}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full transition-colors duration-state-change font-label text-label-md ${
                        isSelected
                          ? 'bg-primary-soft text-primary border border-subject-python-border'
                          : 'bg-surface-container-low text-on-surface-variant border border-outline-variant hover:bg-surface-container'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Optional Reason */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="leave-reason" className="font-label text-label-md text-on-surface" data-design-text-token="label-md">
              Reason <span className="text-on-surface-muted font-body">(optional)</span>
            </label>
            <input
              id="leave-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add a short note for the HOD if needed…"
              className="w-full bg-surface-container-lowest border border-outline-variant rounded px-3.5 py-2 font-body text-body-md text-on-surface placeholder:text-on-surface-muted focus:border-primary focus:ring-2 focus:ring-primary-soft focus:outline-none"
            />
          </div>

          {/* Classes Affected */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-title text-title-sm text-on-surface" data-design-text-token="title-sm">
                Classes affected
              </h2>
              <span className="font-label text-label-sm text-on-surface-muted tabular-nums" data-design-text-token="label-sm">
                {affectedClasses.length} classes auto-filled
              </span>
            </div>

            <div className="flex flex-col divide-y divide-outline-variant rounded-md border border-outline-variant bg-surface-container-low overflow-hidden">
              {affectedClasses.map((cls, idx) => (
                <div key={idx} className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full font-label text-label-sm border ${
                          cls.type === 'python'
                            ? 'bg-subject-python-bg border-subject-python-border text-subject-python-text'
                            : 'bg-subject-ai-bg border-subject-ai-border text-subject-ai-text'
                        }`}
                        data-design-text-token="label-sm"
                      >
                        {cls.name}
                      </span>
                      <span className="font-title text-title-sm text-on-surface tabular-nums" data-design-text-token="title-sm">
                        {cls.name} · {cls.section} · {cls.period} · {cls.room}
                      </span>
                    </div>
                    <p className="font-body text-body-sm text-on-surface-muted" data-design-text-token="body-sm">
                      TARS will find a substitute
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Footer */}
          <footer className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-state-change cursor-pointer"
            >
              <span className="font-label text-label-lg" data-design-text-token="label-lg">
                Cancel
              </span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded bg-primary text-on-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors duration-state-change cursor-pointer shadow-sm disabled:opacity-50"
            >
              <span className="font-label text-label-lg" data-design-text-token="label-lg">
                {isSubmitting ? 'Sending...' : 'Send to TARS'}
              </span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};
