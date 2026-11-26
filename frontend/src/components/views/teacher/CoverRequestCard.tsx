import React, { useState } from 'react';

interface CoverRequestCardProps {
  onAccept: () => void;
  onDecline: () => void;
  onClose?: () => void;
  isModal?: boolean;
}

export const CoverRequestCard: React.FC<CoverRequestCardProps> = ({
  onAccept,
  onDecline,
  onClose,
  isModal = false,
}) => {
  const [decision, setDecision] = useState<'pending' | 'accepted' | 'declined'>('pending');

  const handleAccept = () => {
    setDecision('accepted');
    setTimeout(() => {
      onAccept();
      if (onClose) onClose();
    }, 1200);
  };

  const handleDecline = () => {
    setDecision('declined');
    setTimeout(() => {
      onDecline();
      if (onClose) onClose();
    }, 1200);
  };

  const cardContent = (
    <div className="w-full max-w-[420px] bg-surface flex flex-col gap-5 font-body">
      {isModal && (
        <header className="flex items-center justify-between pb-2 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-primary text-on-primary font-headline text-label-md shrink-0">
              T
            </span>
            <span className="font-title text-title-sm text-on-surface">TARS · Cover Request</span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </header>
      )}

      <div className="flex flex-col gap-1">
        <h1 className="font-headline text-headline-lg text-on-surface text-balance" data-design-text-token="headline-lg">
          Can you cover a class?
        </h1>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
          <span className="material-symbols-outlined text-[15px]">science</span>
          <span>[Demo Simulation] Standalone substitute response preview</span>
        </div>
      </div>

      {/* Cover Request Card */}
      <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-subject-python-bg border border-subject-python-border text-subject-python-text font-label text-label-sm" data-design-text-token="label-sm">
            Python lab
          </span>
          <span className="font-label text-label-sm text-on-surface-muted tabular-nums" data-design-text-token="label-sm">
            Thu P6–P7
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="font-title text-title-md text-on-surface tabular-nums text-pretty" data-design-text-token="title-md">
            CSE-10 · Thursday 3 December · 2:20–4:10 PM · Room 511C
          </p>
          <p className="font-body text-body-md text-on-surface-variant" data-design-text-token="body-md">
            For Prof. Chaitra D B (on leave)
          </p>
        </div>

        {/* TARS Insight Row */}
        <div className="p-3.5 rounded-md bg-primary-soft border border-subject-python-border flex items-start gap-2.5">
          <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5" aria-hidden="true">
            auto_awesome
          </span>
          <p className="font-body text-body-sm text-on-primary-soft tabular-nums text-pretty" data-design-text-token="body-sm">
            Why you: you co-teach this lab and you're free Thu P6–P7. This week's load: 13 periods.
          </p>
        </div>
      </article>

      {/* Action Buttons */}
      <div id="mobile-cover-actions" className="flex flex-col gap-3">
        {decision === 'pending' ? (
          <>
            <button
              id="btn-mobile-accept"
              type="button"
              onClick={handleAccept}
              className="w-full inline-flex items-center justify-center px-4 py-3.5 rounded-md bg-primary text-on-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors duration-state-change cursor-pointer shadow-sm"
            >
              <span className="font-label text-label-lg" data-design-text-token="label-lg">
                Accept
              </span>
            </button>

            <button
              id="btn-mobile-decline"
              type="button"
              onClick={handleDecline}
              className="w-full inline-flex items-center justify-center px-4 py-3.5 rounded-md bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors duration-state-change cursor-pointer"
            >
              <span className="font-label text-label-lg" data-design-text-token="label-lg">
                Decline
              </span>
            </button>
          </>
        ) : decision === 'accepted' ? (
          <div className="w-full p-3.5 rounded-md bg-status-done-bg border border-status-done-border text-status-done flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              check_circle
            </span>
            <span className="font-label text-label-md">Accepted · added to your Thursday schedule</span>
          </div>
        ) : (
          <div className="w-full p-3.5 rounded-md bg-surface-container border border-outline-variant text-on-surface-variant flex items-center justify-center">
            <span className="font-label text-label-md">Declined · TARS is asking the next teacher</span>
          </div>
        )}
      </div>

      <p className="font-body text-body-sm text-on-surface-muted text-center text-pretty px-2" data-design-text-token="body-sm">
        If you decline, TARS asks the next teacher. No need to reply to anyone else.
      </p>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-on-surface/30 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-surface p-6 rounded-lg border border-outline-variant shadow-2xl">
          {cardContent}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[884px] flex flex-col bg-surface max-w-[390px] mx-auto border-x border-outline-variant p-4">
      {cardContent}
    </div>
  );
};
