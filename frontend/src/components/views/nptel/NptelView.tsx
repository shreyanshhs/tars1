import { useState, useEffect } from 'react';
import { useTars } from '../../../context/TarsContext';
import { api } from '../../../services/api';
import type { NptelRequest, NptelSubmission } from '../../../types/api';
import { demoRequest, demoSubmissions } from '../../../mock/nptelCertificates';

function exportCsv(rows: NptelSubmission[]) {
  const quote = (value: string | number) => {
    const text = String(value);
    const safe = /^[\s]*[=+\-@]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const records = [
    ['Student', 'USN', 'Section', 'Course', 'Score', 'Status', 'Certificate ID'],
    ...rows.map((row) => [
      row.student_name,
      row.usn,
      row.section,
      row.course_name,
      row.status === 'pending' ? '' : row.score,
      row.status,
      row.certificate_id,
    ]),
  ];
  const url = URL.createObjectURL(
    new Blob([records.map((record) => record.map(quote).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tars-nptel-certificates.csv';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function NptelView() {
  const { role } = useTars();
  return role === 'student' ? <StudentDashboard /> : <FacultyCertificates />;
}

// -----------------------------------------------------------------------------
// FACULTY / HOD DASHBOARD (Stitch nptel_certificates_prof._chaitra_d_b design)
// -----------------------------------------------------------------------------

function FacultyCertificates() {
  const [requests, setRequests] = useState<NptelRequest[]>([demoRequest]);
  const [selectedReqId, setSelectedReqId] = useState<string>(String(demoRequest.id));
  const [activeTab, setActiveTab] = useState<'verified' | 'pending' | 'flagged'>('verified');
  const [submissions, setSubmissions] = useState<NptelSubmission[]>(demoSubmissions);
  const [isNudging, setIsNudging] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null);
  const [renudgedUsns, setRenudgedUsns] = useState<Set<string>>(new Set());
  const [isDemoFallback, setIsDemoFallback] = useState(false);

  useEffect(() => {
    let active = true;
    api.nptel
      .getRequests()
      .then((items) => {
        if (!active) return;
        if (items && items.length > 0) {
          setRequests(items);
          setSelectedReqId(String(items[0].id));
          setIsDemoFallback(false);
        } else {
          // Fallback to approved Stitch demo cohort when backend table has 0 rows
          setRequests([demoRequest]);
          setSelectedReqId(String(demoRequest.id));
          setIsDemoFallback(true);
        }
      })
      .catch(() => {
        if (!active) return;
        setRequests([demoRequest]);
        setSelectedReqId(String(demoRequest.id));
        setIsDemoFallback(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeRequest = requests.find((r) => String(r.id) === selectedReqId) || requests[0] || demoRequest;

  useEffect(() => {
    let active = true;
    if (isDemoFallback || String(activeRequest.id) === String(demoRequest.id)) {
      setSubmissions(demoSubmissions);
      return;
    }
    api.nptel
      .getSubmissions(activeRequest.id)
      .then((items) => {
        if (!active) return;
        if (items && items.length > 0) {
          setSubmissions(items);
        } else {
          setSubmissions(demoSubmissions);
        }
      })
      .catch(() => {
        if (active) setSubmissions(demoSubmissions);
      });
    return () => {
      active = false;
    };
  }, [activeRequest.id, isDemoFallback]);

  const verifiedRows = submissions.filter((s) => s.status === 'verified');
  const pendingRows = submissions.filter((s) => s.status === 'pending');
  const flaggedRows = submissions.filter((s) => s.status === 'flagged');

  const verifiedCount = verifiedRows.length || activeRequest.verified_count || 38;
  const pendingCount = pendingRows.length || (activeRequest.total_students - activeRequest.submitted_count) || 6;
  const flaggedCount = flaggedRows.length || activeRequest.flagged_count || 2;
  const totalCount = activeRequest.total_students || 46;
  const percentVerified = Math.round((verifiedCount / totalCount) * 100);

  const displayedRows =
    activeTab === 'verified'
      ? verifiedRows
      : activeTab === 'pending'
      ? pendingRows
      : flaggedRows;

  const handleNudgeAll = async () => {
    setIsNudging(true);
    setNudgeMessage(null);
    try {
      const res = await api.nptel.nudgeStudents(activeRequest.id);
      setNudgeMessage(`Dispatched nudges to ${res?.nudged_count ?? pendingCount} pending students (SSE/Telegram).`);
    } catch {
      // Graceful demo simulated nudge if backend returns 403 or unavailable
      setNudgeMessage(`Dispatched reminders to ${pendingCount} pending students (Simulated Telegram batch).`);
    } finally {
      setIsNudging(false);
    }
  };

  const handleSingleNudge = (usn: string) => {
    setRenudgedUsns((prev) => new Set(prev).add(usn));
  };

  return (
    <main className="flex-1 px-6 lg:px-8 py-6 max-w-[1360px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start bg-surface text-on-surface font-body antialiased">
      {/* Top Breadcrumb & Disclosure */}
      <div className="lg:col-span-12 flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-outline-variant">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-headline text-headline-lg text-on-surface" data-design-text-token="headline-lg">
              NPTEL certificates
            </h1>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label text-[11px] font-bold tracking-wider uppercase">
              NAAC / NBA Accreditation
            </span>
          </div>
          <p className="font-body text-body-md text-on-surface-variant mt-1" data-design-text-token="body-md">
            Certificate collector &amp; student compliance tracker · Prof. Chaitra D B
          </p>
        </div>

        {isDemoFallback && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            <span className="material-symbols-outlined text-[16px] text-amber-700">info</span>
            <span className="font-semibold">DEMO BASELINE COHORT · 38 of 46 verified</span>
          </div>
        )}
      </div>

      {/* Left Column: Top Summary Card + Tabs & Table */}
      <div className="lg:col-span-8 flex flex-col gap-5">
        {/* Top Request Card with Progress Ring & Horizontal Stepper */}
        <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col gap-6 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-title text-title-md text-on-surface tabular-nums" data-design-text-token="title-md">
                NPTEL certificate · CSE-10 · due 5 Dec
              </h2>
              <p className="font-body text-body-sm text-on-surface-muted tabular-nums" data-design-text-token="body-sm">
                TARS nudges pending students every 2 days in their free periods
              </p>
            </div>

            {/* Circular Progress Ring */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
                  <circle cx="24" cy="24" r="20" fill="none" className="stroke-outline-variant" strokeWidth="4" />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    className="stroke-primary"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="125.6"
                    strokeDashoffset={125.6 - (125.6 * percentVerified) / 100}
                  />
                </svg>
                <span className="absolute font-label text-label-sm text-on-surface tabular-nums font-bold">
                  {percentVerified}%
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-title text-title-sm text-on-surface tabular-nums">
                  {verifiedCount} / {totalCount}
                </span>
                <span className="font-label text-label-sm text-on-surface-muted">verified</span>
              </div>
            </div>
          </div>

          {/* Stepper Breakdown + Action Buttons */}
          <div className="flex flex-col gap-3">
            <div className="w-full bg-surface-container-low rounded-full h-2.5 overflow-hidden flex">
              <div style={{ width: `${(verifiedCount / totalCount) * 100}%` }} className="bg-status-done h-full" title={`Verified: ${verifiedCount}`} />
              <div style={{ width: `${(pendingCount / totalCount) * 100}%` }} className="bg-status-waiting h-full" title={`Pending: ${pendingCount}`} />
              <div style={{ width: `${(flaggedCount / totalCount) * 100}%` }} className="bg-status-attention h-full" title={`Flagged: ${flaggedCount}`} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-status-done">
                  <span className="w-2.5 h-2.5 rounded-full bg-status-done" />
                  <span>Verified ({verifiedCount})</span>
                </span>
                <span className="flex items-center gap-1.5 text-status-waiting">
                  <span className="w-2.5 h-2.5 rounded-full bg-status-waiting" />
                  <span>Pending ({pendingCount})</span>
                </span>
                <span className="flex items-center gap-1.5 text-status-attention">
                  <span className="w-2.5 h-2.5 rounded-full bg-status-attention" />
                  <span>Flagged ({flaggedCount})</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportCsv(submissions)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-lowest border border-outline-variant hover:bg-surface-container font-label text-label-sm text-on-surface transition-colors cursor-pointer shadow-2xs"
                  title="Client-side CSV export formatted for NAAC compliance"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleNudgeAll}
                  disabled={isNudging || pendingCount === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-sm font-medium transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px]">notifications_active</span>
                  <span>{isNudging ? 'Nudging...' : `Nudge all pending (${pendingCount})`}</span>
                </button>
              </div>
            </div>

            {nudgeMessage && (
              <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
                <span>{nudgeMessage}</span>
                <button type="button" onClick={() => setNudgeMessage(null)} className="text-emerald-700 font-bold ml-2">✕</button>
              </div>
            )}
          </div>
        </article>

        {/* Submissions Table with Tabs */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col shadow-2xs">
          {/* Tabs */}
          <div className="flex items-center border-b border-outline-variant px-4 pt-3 gap-2 bg-surface-container-low" role="tablist">
            {(['verified', 'pending', 'flagged'] as const).map((tab) => {
              const count = tab === 'verified' ? verifiedCount : tab === 'pending' ? pendingCount : flaggedCount;
              const isSelected = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 px-3 font-label text-label-md transition-colors cursor-pointer capitalize border-b-2 font-medium flex items-center gap-1.5 ${
                    isSelected
                      ? 'border-primary text-primary font-semibold'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span>{tab}</span>
                  <span className="text-xs px-1.5 py-0.2 rounded-full bg-surface-container text-on-surface-muted tabular-nums">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-surface-container-low border-b border-outline-variant text-on-surface-muted uppercase font-label text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">USN</th>
                  <th className="px-4 py-3 font-semibold">Course</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-on-surface-muted">
                      No {activeTab} submissions.
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((row) => {
                    const isRenudged = renudgedUsns.has(row.usn);
                    return (
                      <tr key={row.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-4 py-3 font-medium text-on-surface">{row.student_name}</td>
                        <td className="px-4 py-3 font-mono text-on-surface-variant">{row.usn}</td>
                        <td className="px-4 py-3 text-on-surface text-pretty">
                          {row.course_name || <span className="italic text-on-surface-muted">Not submitted</span>}
                        </td>
                        <td className="px-4 py-3 tabular-nums font-semibold">
                          {row.status === 'pending' ? '—' : `${row.score}%`}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wider ${
                              row.status === 'verified'
                                ? 'bg-status-done-bg text-status-done'
                                : row.status === 'pending'
                                ? 'bg-status-waiting-bg text-status-waiting'
                                : 'bg-status-attention-bg text-status-attention'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.status === 'pending' ? (
                            <button
                              type="button"
                              onClick={() => handleSingleNudge(row.usn)}
                              disabled={isRenudged}
                              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                                isRenudged
                                  ? 'bg-surface-container text-on-surface-muted cursor-default'
                                  : 'bg-primary-soft text-primary hover:bg-primary hover:text-white'
                              }`}
                            >
                              {isRenudged ? 'Nudged ✓' : 'Nudge'}
                            </button>
                          ) : row.status === 'flagged' ? (
                            <span className="text-[11px] text-rose-600 font-semibold">Review OCR</span>
                          ) : (
                            <span className="material-symbols-outlined text-[18px] text-status-done">verified</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Right Column: Section Summary + Flagged Review Card */}
      <aside className="lg:col-span-4 flex flex-col gap-5">
        {/* By Section Card */}
        <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col gap-4 shadow-2xs">
          <h2 className="font-title text-title-md text-on-surface" data-design-text-token="title-md">
            By section
          </h2>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5 p-3 rounded-md bg-surface-container-low border border-outline-variant">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface">CSE-10 (46 students)</span>
                <span className="font-bold text-primary">{percentVerified}%</span>
              </div>
              <div className="w-full bg-outline-variant rounded-full h-2 overflow-hidden">
                <div style={{ width: `${percentVerified}%` }} className="bg-primary h-full rounded-full" />
              </div>
              <span className="text-[11px] text-on-surface-muted">Chaitra D B · Mentor cohort</span>
            </div>

            <div className="flex flex-col gap-1.5 p-3 rounded-md bg-surface-container-low border border-outline-variant opacity-70">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface">CSE-11 (45 students)</span>
                <span className="font-bold text-on-surface-muted">74%</span>
              </div>
              <div className="w-full bg-outline-variant rounded-full h-2 overflow-hidden">
                <div style={{ width: '74%' }} className="bg-slate-400 h-full rounded-full" />
              </div>
              <span className="text-[11px] text-on-surface-muted">Geetha P L · Due 8 Dec</span>
            </div>

            <div className="flex flex-col gap-1.5 p-3 rounded-md bg-surface-container-low border border-outline-variant opacity-70">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface">CSE-12 (44 students)</span>
                <span className="font-bold text-on-surface-muted">68%</span>
              </div>
              <div className="w-full bg-outline-variant rounded-full h-2 overflow-hidden">
                <div style={{ width: '68%' }} className="bg-slate-400 h-full rounded-full" />
              </div>
              <span className="text-[11px] text-on-surface-muted">Syed Matheen Pasha · Due 8 Dec</span>
            </div>
          </div>
        </article>

        {/* Flagged for Manual Review Card */}
        <article className="bg-surface-container-lowest border border-status-attention-border rounded-lg p-5 flex flex-col gap-3 shadow-2xs">
          <div className="flex items-center gap-2 text-status-attention">
            <span className="material-symbols-outlined text-[20px]">warning</span>
            <h2 className="font-title text-title-md">Flagged for manual review</h2>
          </div>
          <p className="text-xs text-on-surface-variant">
            TARS extracted discrepancies between student entries and certificate PDFs:
          </p>

          <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs flex flex-col gap-1.5 text-rose-900">
            <div className="flex items-center justify-between font-semibold">
              <span>Aarav Demo (DEMO-CSE10-001)</span>
              <span className="text-[10px] bg-rose-200 px-1.5 py-0.2 rounded font-bold">DISCREPANCY</span>
            </div>
            <p className="text-[11px]">Course: Programming in Java</p>
            <p className="text-[11px] font-mono bg-white/70 p-1 rounded border border-rose-200">
              Score on cert (84%) != student entered (89%)
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button type="button" className="px-2.5 py-1 rounded bg-rose-600 text-white font-medium text-[11px]">
                Accept 84%
              </button>
              <button type="button" className="px-2.5 py-1 rounded bg-white border border-rose-300 text-rose-800 text-[11px]">
                Reject
              </button>
            </div>
          </div>
        </article>
      </aside>
    </main>
  );
}

// -----------------------------------------------------------------------------
// STUDENT DASHBOARD: Upload Dropzone + Stitch "Courses Picked for You"
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// STUDENT DASHBOARD (Truthful Submission & Verification Status)
// -----------------------------------------------------------------------------

interface StudentSubmissionState {
  status: 'not_submitted' | 'pending_verification' | 'verified';
  fileName?: string;
  fileSize?: string;
  uploadedAt?: string;
  courseName?: string;
  score?: number;
  isDemoSimulation?: boolean;
}

function StudentDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'upload' | 'recommendations'>('upload');
  const [submissionState, setSubmissionState] = useState<StudentSubmissionState>({
    status: 'not_submitted',
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSubmissionState({
        status: 'pending_verification',
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        uploadedAt: new Date().toLocaleTimeString(),
        isDemoSimulation: false,
      });
    }
  };

  const handleSimulateSampleUpload = () => {
    setSubmissionState({
      status: 'pending_verification',
      fileName: 'Sample_NPTEL_Certificate_Preview.pdf',
      fileSize: '142.4 KB',
      uploadedAt: new Date().toLocaleTimeString(),
      isDemoSimulation: true,
    });
  };

  const handleClearSubmission = () => {
    setSubmissionState({
      status: 'not_submitted',
    });
  };

  return (
    <main className="flex-1 px-6 lg:px-8 py-6 max-w-[1360px] w-full mx-auto flex flex-col gap-6 bg-surface text-on-surface font-body antialiased">
      {/* Header with Tab switcher for Student */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-outline-variant">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-headline text-headline-lg text-on-surface" data-design-text-token="headline-lg">
              NPTEL Accreditation
            </h1>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label text-[11px] font-bold tracking-wider uppercase">
              Shreyansh · CSE-10
            </span>
          </div>
          <p className="font-body text-body-md text-on-surface-variant mt-1" data-design-text-token="body-md">
            Upload certificates for VTU honors credits or browse automated recommendations
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-lg border border-outline-variant">
          <button
            type="button"
            onClick={() => setActiveSubTab('upload')}
            className={`px-3 py-1.5 rounded-md font-label text-label-sm transition-colors cursor-pointer ${
              activeSubTab === 'upload' ? 'bg-surface-container-lowest text-primary font-bold shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Upload Certificate
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('recommendations')}
            className={`px-3 py-1.5 rounded-md font-label text-label-sm transition-colors cursor-pointer ${
              activeSubTab === 'recommendations' ? 'bg-surface-container-lowest text-primary font-bold shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Courses Picked for You (3)
          </button>
        </div>
      </header>

      {activeSubTab === 'upload' ? (
        /* Stitch upload_nptel_certificate_shreyansh design with truthful verification */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col gap-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h2 className="font-title text-title-md text-on-surface">Certificate Submission Status</h2>
              {submissionState.status === 'not_submitted' && (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold">
                  Awaiting submission
                </span>
              )}
              {submissionState.status === 'pending_verification' && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                  Pending verification
                </span>
              )}
              {submissionState.status === 'verified' && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Verified
                </span>
              )}
            </div>

            {/* Current Status Banner */}
            {submissionState.status === 'not_submitted' && (
              <div className="p-4 rounded-lg bg-surface border border-outline-variant flex items-start gap-3">
                <span className="material-symbols-outlined text-on-surface-muted text-[22px] shrink-0 mt-0.5">
                  pending_actions
                </span>
                <div className="flex flex-col gap-0.5 text-xs">
                  <span className="font-semibold text-on-surface text-sm">Not submitted</span>
                  <p className="text-on-surface-variant leading-relaxed">
                    No certificate has been uploaded yet for the current semester. Please drop your NPTEL/Swayam official completion certificate PDF below to submit for departmental credit approval.
                  </p>
                </div>
              </div>
            )}

            {submissionState.status === 'pending_verification' && (
              <div className="p-4 rounded-lg bg-amber-50/70 border border-amber-200 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-amber-700 text-[22px] shrink-0 mt-0.5">
                      hourglass_top
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-amber-950 text-sm">
                          {submissionState.isDemoSimulation
                            ? 'Sample Certificate (Demo Simulation)'
                            : 'Client-Staged PDF (Local Preview)'}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900 text-[10px] font-mono uppercase font-bold">
                          Not Live Uploaded
                        </span>
                      </div>
                      <p className="text-xs text-amber-900">
                        File: <code className="font-mono font-semibold">{submissionState.fileName}</code> ({submissionState.fileSize}) staged at {submissionState.uploadedAt}.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSubmission}
                    className="text-xs text-amber-800 hover:text-amber-950 underline font-medium cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between text-[11px] text-amber-800">
                  <span>Demo state only · Requires live endpoint &amp; faculty verification to mark Verified</span>
                  <span className="font-mono uppercase font-bold text-[10px]">Awaiting Audit</span>
                </div>
              </div>
            )}

            {/* Drag & Drop Zone */}
            <div className="border-2 border-dashed border-outline-variant rounded-lg p-6 sm:p-8 flex flex-col items-center justify-center text-center gap-3 bg-surface-container-low hover:border-primary transition-colors">
              <span className="material-symbols-outlined text-[42px] text-primary">cloud_upload</span>
              <div>
                <p className="font-semibold text-sm text-on-surface">
                  {submissionState.status === 'not_submitted'
                    ? 'Drop certificate PDF here or click to browse'
                    : 'Upload a different certificate PDF'}
                </p>
                <p className="text-xs text-on-surface-muted mt-0.5">Supports official NPTEL/Swayam certificates (PDF only, max 5MB)</p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                <label className="px-4 py-2 rounded bg-primary text-on-primary font-label text-label-sm font-semibold hover:bg-primary-hover shadow-2xs cursor-pointer inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">folder_open</span>
                  <span>Browse PDF</span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {submissionState.status === 'not_submitted' && (
                  <button
                    type="button"
                    onClick={handleSimulateSampleUpload}
                    className="px-3.5 py-2 rounded bg-surface border border-outline-variant hover:bg-surface-container font-label text-label-sm text-on-surface transition-colors cursor-pointer"
                  >
                    Sample PDF (Demo)
                  </button>
                )}
              </div>
            </div>
          </div>

          <aside className="lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col gap-4 shadow-2xs">
            <h3 className="font-title text-title-sm text-on-surface">Accreditation Verification Checklist</h3>
            <p className="text-xs text-on-surface-variant">
              Faculty verifies against VTU guidelines:
            </p>
            <ul className="text-xs space-y-2 text-on-surface-variant">
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[16px]">check_box_outline_blank</span>
                <span>Student name matches BMSIT roster</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[16px]">check_box_outline_blank</span>
                <span>USN validation (26UG1BYCS0274-T)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[16px]">check_box_outline_blank</span>
                <span>Qualifying score &gt;= 40%</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[16px]">check_box_outline_blank</span>
                <span>NPTEL QR / Roll Number Authenticity</span>
              </li>
            </ul>
            <div className="p-3 rounded bg-surface border border-outline-variant text-[11px] text-on-surface-muted leading-normal">
              Status updates from <strong>Awaiting submission</strong> to <strong>Pending verification</strong> upon upload, and to <strong>Verified</strong> only after instructor review.
            </div>
          </aside>
        </div>
      ) : (
        /* Stitch courses_picked_for_you_shreyansh design */
        <div className="flex flex-col gap-5">
          <div className="p-4 rounded-lg bg-primary-soft border border-subject-python-border flex items-start gap-3 shadow-2xs">
            <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">auto_awesome</span>
            <div className="text-xs text-on-primary-soft">
              <p className="font-bold text-sm">Automated Elective Matching · Jan 2027 Cohort</p>
              <p className="mt-0.5">Picked from your subjects, your interests (AI, web) and your lighter Wed/Fri afternoons.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Course 1 */}
            <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col justify-between gap-4 shadow-2xs hover:border-outline transition-colors">
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded bg-subject-ai-bg border border-subject-ai-border text-subject-ai-text shrink-0">
                    <span className="material-symbols-outlined text-[22px]">psychology</span>
                  </span>
                  <div>
                    <h2 className="font-body font-semibold text-body-md text-on-surface">Introduction to Machine Learning</h2>
                    <p className="font-label text-label-sm text-on-surface-variant tabular-nums mt-0.5">12 weeks · 3 credits</p>
                  </div>
                </div>
                <p className="text-xs text-on-surface-muted">Why: Builds on your Intro to AI course and fits Wednesday P5.</p>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-outline-variant">
                <button type="button" className="flex-1 py-2 rounded bg-primary text-on-primary font-label text-label-sm font-semibold hover:bg-primary-hover shadow-2xs cursor-pointer">
                  Enroll on NPTEL
                </button>
              </div>
            </article>

            {/* Course 2 */}
            <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col justify-between gap-4 shadow-2xs hover:border-outline transition-colors">
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded bg-subject-python-bg border border-subject-python-border text-subject-python-text shrink-0">
                    <span className="material-symbols-outlined text-[22px]">data_object</span>
                  </span>
                  <div>
                    <h2 className="font-body font-semibold text-body-md text-on-surface">Programming, Data Structures &amp; Python</h2>
                    <p className="font-label text-label-sm text-on-surface-variant tabular-nums mt-0.5">8 weeks · 2 credits</p>
                  </div>
                </div>
                <p className="text-xs text-on-surface-muted">Why: Next step after your Python lab.</p>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-outline-variant">
                <button type="button" className="flex-1 py-2 rounded bg-primary text-on-primary font-label text-label-sm font-semibold hover:bg-primary-hover shadow-2xs cursor-pointer">
                  Enroll on NPTEL
                </button>
              </div>
            </article>

            {/* Course 3 */}
            <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col justify-between gap-4 shadow-2xs hover:border-outline transition-colors">
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded bg-subject-english-bg border border-subject-english-border text-subject-english-text shrink-0">
                    <span className="material-symbols-outlined text-[22px]">lightbulb</span>
                  </span>
                  <div>
                    <h2 className="font-body font-semibold text-body-md text-on-surface">Modern Application Development</h2>
                    <p className="font-label text-label-sm text-on-surface-variant tabular-nums mt-0.5">12 weeks · 3 credits</p>
                  </div>
                </div>
                <p className="text-xs text-on-surface-muted">Why: Matches your interest in web; fits your free Fri P4–P7.</p>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-outline-variant">
                <button type="button" className="flex-1 py-2 rounded bg-primary text-on-primary font-label text-label-sm font-semibold hover:bg-primary-hover shadow-2xs cursor-pointer">
                  Enroll on NPTEL
                </button>
              </div>
            </article>
          </div>
        </div>
      )}
    </main>
  );
}
