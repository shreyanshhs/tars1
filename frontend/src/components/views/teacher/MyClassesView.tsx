import React from 'react';

export const MyClassesView: React.FC = () => {
  return (
    <main className="flex-1 min-w-0 p-6 lg:p-8 flex flex-col gap-6 bg-surface text-on-surface font-body antialiased">
      {/* Page Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-outline-variant">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-headline text-headline-lg text-on-surface" data-design-text-token="headline-lg">
              My classes
            </h1>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label text-[11px] font-bold tracking-wider uppercase">
              BMSIT CSE
            </span>
          </div>
          <p className="font-body text-body-md text-on-surface-variant mt-1" data-design-text-token="body-md">
            Enrolled course sections and lab batches for Prof. Chaitra D B
          </p>
        </div>
      </header>

      {/* Indigo-Tinted Top Banner (Preserves Stitch 'Coming soon' disclosure) */}
      <div className="px-5 py-3.5 rounded-lg bg-primary-soft border border-status-active-border flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[18px] text-primary shrink-0" aria-hidden="true">
            auto_awesome
          </span>
          <p className="font-body text-body-md text-on-primary-soft" data-design-text-token="body-md">
            Created automatically from your timetable — no setup needed
          </p>
        </div>
        <span
          className="px-2.5 py-1 rounded-full bg-surface-container-lowest border border-status-active-border font-label text-label-sm text-primary shrink-0 font-semibold"
          data-design-text-token="label-sm"
        >
          Coming soon
        </span>
      </div>

      {/* Main Grid + Right Deadlines Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        {/* Class Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5" aria-label="Class sections">
          {/* Card 1: Intro to AI · CSE-10 (Violet) */}
          <article className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col shadow-2xs hover:border-outline transition-colors">
            <div className="h-1.5 bg-subject-ai-bg border-b border-subject-ai-border"></div>
            <div className="p-5 flex flex-col gap-3 flex-1">
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-subject-ai-bg border border-subject-ai-border text-subject-ai-text shrink-0">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    psychology
                  </span>
                </span>
                <span
                  className="px-2 py-0.5 rounded-full bg-primary-soft text-on-primary-soft font-label text-label-sm whitespace-nowrap shrink-0"
                  data-design-text-token="label-sm"
                >
                  2 new posts
                </span>
              </div>
              <h2 className="font-title text-title-md text-on-surface" data-design-text-token="title-md">
                Intro to AI · CSE-10
              </h2>
              <div className="flex flex-col gap-1">
                <p className="font-body text-body-md text-on-surface-variant tabular-nums" data-design-text-token="body-md">
                  46 students
                </p>
                <p className="font-body text-body-sm text-on-surface-muted tabular-nums" data-design-text-token="body-sm">
                  Next: Thu 11:35 · Room 302
                </p>
              </div>
            </div>
          </article>

          {/* Card 2: Python lab · CSE-10 (Indigo) */}
          <article className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col shadow-2xs hover:border-outline transition-colors">
            <div className="h-1.5 bg-subject-python-bg border-b border-subject-python-border"></div>
            <div className="p-5 flex flex-col gap-3 flex-1">
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-subject-python-bg border border-subject-python-border text-subject-python-text shrink-0">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    code
                  </span>
                </span>
              </div>
              <h2 className="font-title text-title-md text-on-surface" data-design-text-token="title-md">
                Python lab · CSE-10
              </h2>
              <div className="flex flex-col gap-1">
                <p className="font-body text-body-md text-on-surface-variant tabular-nums" data-design-text-token="body-md">
                  46 students
                </p>
                <p className="font-body text-body-sm text-on-surface-muted tabular-nums" data-design-text-token="body-sm">
                  Thu 2:20 · Room 511C
                </p>
              </div>
            </div>
          </article>

          {/* Card 3: Python lab · CSE-11 (Indigo) */}
          <article className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col shadow-2xs hover:border-outline transition-colors">
            <div className="h-1.5 bg-subject-python-bg border-b border-subject-python-border"></div>
            <div className="p-5 flex flex-col gap-3 flex-1">
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-subject-python-bg border border-subject-python-border text-subject-python-text shrink-0">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    code
                  </span>
                </span>
              </div>
              <h2 className="font-title text-title-md text-on-surface" data-design-text-token="title-md">
                Python lab · CSE-11
              </h2>
              <div className="flex flex-col gap-1">
                <p className="font-body text-body-md text-on-surface-variant tabular-nums" data-design-text-token="body-md">
                  45 students
                </p>
                <p className="font-body text-body-sm text-on-surface-muted tabular-nums" data-design-text-token="body-sm">
                  Fri 8:30 · Room 511C
                </p>
              </div>
            </div>
          </article>

          {/* Card 4: Web Technology lab · K1/K2 (Amber) */}
          <article className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col shadow-2xs hover:border-outline transition-colors">
            <div className="h-1.5 bg-subject-english-bg border-b border-subject-english-border"></div>
            <div className="p-5 flex flex-col gap-3 flex-1">
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-subject-english-bg border border-subject-english-border text-subject-english-text shrink-0">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    language
                  </span>
                </span>
              </div>
              <h2 className="font-title text-title-md text-on-surface" data-design-text-token="title-md">
                Web Technology lab · K1/K2
              </h2>
              <div className="flex flex-col gap-1">
                <p className="font-body text-body-md text-on-surface-variant tabular-nums" data-design-text-token="body-md">
                  Mon 8:30 · Room 306
                </p>
              </div>
            </div>
          </article>

          {/* Card 5: C++ lab · 3L1 (Slate) */}
          <article className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col shadow-2xs hover:border-outline transition-colors">
            <div className="h-1.5 bg-subject-esc-bg border-b border-subject-esc-border"></div>
            <div className="p-5 flex flex-col gap-3 flex-1">
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-subject-esc-bg border border-subject-esc-border text-subject-esc-text shrink-0">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    terminal
                  </span>
                </span>
              </div>
              <h2 className="font-title text-title-md text-on-surface" data-design-text-token="title-md">
                C++ lab · 3L1
              </h2>
              <div className="flex flex-col gap-1">
                <p className="font-body text-body-md text-on-surface-variant tabular-nums" data-design-text-token="body-md">
                  Wed 1:25 · Room BSN306
                </p>
              </div>
            </div>
          </article>
        </section>

        {/* Right Panel: Upcoming Deadlines */}
        <aside className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col gap-5 shadow-2xs">
          <h2 className="font-title text-title-md text-on-surface" data-design-text-token="title-md">
            Upcoming deadlines
          </h2>

          <ul className="flex flex-col divide-y divide-outline-variant">
            <li className="pb-3.5 flex flex-col gap-1">
              <span className="font-title text-title-sm text-on-surface" data-design-text-token="title-sm">
                Python lab record
              </span>
              <span className="font-body text-body-sm text-on-surface-variant tabular-nums" data-design-text-token="body-sm">
                CSE-10 · due Fri
              </span>
            </li>
            <li className="pt-3.5 flex flex-col gap-1">
              <span className="font-title text-title-sm text-on-surface" data-design-text-token="title-sm">
                AI assignment 2
              </span>
              <span className="font-body text-body-sm text-on-surface-variant tabular-nums" data-design-text-token="body-sm">
                CSE-10 · due 8 Dec
              </span>
            </li>
          </ul>

          <div className="p-3.5 rounded-md bg-surface-container-low border border-outline-variant flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5" aria-hidden="true">
              auto_awesome
            </span>
            <p className="font-body text-body-sm text-on-surface-variant text-pretty" data-design-text-token="body-sm">
              TARS nudges students in their free periods.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
};
