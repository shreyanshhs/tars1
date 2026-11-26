import React from 'react';

export const HodClassesView: React.FC = () => {
  const sections = [
    {
      id: 'sec-cse10',
      name: 'Section CSE-10',
      semester: '1st Semester · B.E. CSE',
      rooms: ['SJB-104 (Lecture)', '511C (Lab)'],
      studentsCount: 46,
      subjects: [
        { code: '1BAI103', name: 'Intro to AI and Applications', faculty: 'Prof. Chaitra D B / Mr. Syed Matheen Pasha' },
        { code: '1BPLC105B', name: 'Python Programming (Lab)', faculty: 'Prof. Chaitra D B / Mrs. Geetha P L' },
        { code: '1BCHECS102', name: 'Chemistry for CSE', faculty: 'Chemistry Dept' },
        { code: '1BMATC101', name: 'Mathematics-I', faculty: 'Mathematics Dept' },
      ],
      badgeColor: 'border-l-indigo-600',
    },
    {
      id: 'sec-k',
      name: 'Section K (Batches K1 & K2)',
      semester: '5th Semester · B.E. CSE',
      rooms: ['Room 306'],
      studentsCount: 38,
      subjects: [
        { code: 'BCSL504', name: 'Web Technology Lab', faculty: 'Prof. Chaitra D B' },
      ],
      badgeColor: 'border-l-emerald-600',
    },
    {
      id: 'sec-j',
      name: 'Section J',
      semester: '5th Semester · B.E. CSE',
      rooms: ['ROOM-TBC-1'],
      studentsCount: 42,
      subjects: [
        { code: 'CRC', name: 'Career Readiness & Coding', faculty: 'Prof. Chaitra D B' },
      ],
      badgeColor: 'border-l-amber-600',
    },
    {
      id: 'sec-3l1',
      name: 'Section 3L1',
      semester: '3rd Semester · B.E. CSE',
      rooms: ['BSN306'],
      studentsCount: 36,
      subjects: [
        { code: '1BCS302', name: 'Data Structures Lab', faculty: 'Prof. Chaitra D B' },
      ],
      badgeColor: 'border-l-blue-600',
    },
  ];

  return (
    <main className="flex-1 min-w-0 p-6 lg:p-8 flex flex-col gap-6 bg-surface text-on-surface font-body antialiased max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-outline-variant">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-headline text-headline-lg text-on-surface" data-design-text-token="headline-lg">
              Department Classes &amp; Sections
            </h1>
            <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-label text-[11px] font-bold tracking-wider uppercase">
              HOD Oversight
            </span>
          </div>
          <p className="font-body text-body-md text-on-surface-variant mt-1" data-design-text-token="body-md">
            Curriculum sections, classroom allocations and teaching rosters for Dr. Surekha K B (Professor &amp; HOD)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-md bg-surface-container border border-outline-variant text-xs font-mono text-on-surface-variant">
            4 Active Cohorts
          </span>
        </div>
      </header>

      {/* Oversight Banner */}
      <div className="px-5 py-3 rounded-lg bg-surface-container border border-outline-variant flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[20px] text-primary shrink-0" aria-hidden="true">
            apartment
          </span>
          <p className="font-body text-body-sm text-on-surface-variant">
            Section grid derived from BMSIT CSE Master Timetable · Monitored for substitution &amp; relocation compliance
          </p>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold uppercase">
          Illustrative Demo Data — Not Live Institutional Records
        </span>
      </div>

      {/* Section Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5" aria-label="Department sections">
        {sections.map((sec) => (
          <article
            key={sec.id}
            className={`bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col justify-between gap-4 shadow-2xs border-l-4 ${sec.badgeColor}`}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2 border-b border-outline-variant pb-3">
                <div className="flex flex-col">
                  <h2 className="font-title text-title-md font-bold text-on-surface">{sec.name}</h2>
                  <span className="text-xs text-on-surface-variant">{sec.semester}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-surface-container text-xs font-label text-on-surface-variant font-medium tabular-nums">
                  {sec.studentsCount} Students
                </span>
              </div>

              {/* Rooms */}
              <div className="flex items-center gap-2 text-xs text-on-surface-muted">
                <span className="material-symbols-outlined text-[16px]">meeting_room</span>
                <span>Rooms: <strong className="text-on-surface">{sec.rooms.join(', ')}</strong></span>
              </div>

              {/* Subjects Roster */}
              <div className="flex flex-col gap-2 pt-1">
                <span className="text-[11px] font-label uppercase tracking-wider text-on-surface-muted font-semibold">
                  Course Allotments:
                </span>
                <div className="flex flex-col gap-1.5">
                  {sec.subjects.map((sub) => (
                    <div key={sub.code} className="p-2.5 rounded bg-surface border border-outline-variant text-xs flex flex-col gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-on-surface">{sub.name}</span>
                        <code className="text-[10px] font-mono text-on-surface-muted bg-surface-container px-1 py-0.2 rounded">
                          {sub.code}
                        </code>
                      </div>
                      <span className="text-[11px] text-on-surface-variant">Faculty: {sub.faculty}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-outline-variant flex items-center justify-between text-xs text-on-surface-muted">
              <span>Timetable: Active</span>
              <span className="text-primary font-medium text-[11px]">Department Oversight</span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
};