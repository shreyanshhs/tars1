import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertCircle, Bell, Check, CloudUpload, Download, FileText, Plus, X } from 'lucide-react'
import { useTars } from '../../../context/TarsContext'
import { api } from '../../../services/api'
import type { NptelExtraction, NptelRequest, NptelSubmission } from '../../../types/api'
import { demoExtraction, demoRequest, demoSubmissions } from '../../../mock/nptelCertificates'
import './nptel.css'

const mock = import.meta.env.VITE_USE_MOCK !== 'false'
const statuses = ['verified', 'pending', 'flagged'] as const
const dateLabel = (date: string) => new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', timeZone:'UTC' }).format(new Date(date))
const initialDemoRequests = [demoRequest]

type DemoState = {
  requests: NptelRequest[]
  submissions: NptelSubmission[]
  checks: Record<string, NptelExtraction>
}

// Keeps the demo coherent when changing persona or moving between app views.
let demo: DemoState = { requests:initialDemoRequests, submissions:demoSubmissions, checks:{} }

function exportCsv(rows: NptelSubmission[]) {
  const quote = (value: string | number) => {
    const text = String(value)
    const safe = /^[\s]*[=+\-@]/.test(text) ? "'" + text : text
    return '"' + safe.replaceAll('"', '""') + '"'
  }
  const records = [
    ['Student', 'USN', 'Section', 'Course', 'Score', 'Status', 'Certificate ID'],
    ...rows.map(row => [row.student_name, row.usn, row.section, row.course_name,
      row.status === 'pending' ? '' : row.score, row.status, row.certificate_id]),
  ]
  const url = URL.createObjectURL(new Blob([records.map(record => record.map(quote).join(',')).join('\r\n')], { type:'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'tars-nptel-certificates.csv'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function NptelView() {
  const { role } = useTars()
  return role === 'student' ? <StudentUpload /> : <FacultyCertificates />
}

function useRequests() {
  const [requests, setRequests] = useState<NptelRequest[]>(() => mock ? demo.requests : [])
  const [loading, setLoading] = useState(!mock)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (mock) return
    let active = true
    void api.nptel.getRequests().then(items => {
      if (active) setRequests(items)
    }).catch(() => {
      if (active) setError('Certificate requests could not be loaded.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [attempt])
  function retry() {
    setError('')
    setLoading(true)
    setAttempt(value => value + 1)
  }
  return { requests, setRequests, loading, error, retry }
}

function RequestPicker({ requests, selected, onChange }: {
  requests: NptelRequest[]; selected: string; onChange: (id: string) => void
}) {
  if (requests.length < 2) return null
  return <label className="nptel-field">Certificate request
    <select aria-label="Certificate request" value={selected} onChange={event => onChange(event.target.value)}>
      {requests.map(request => <option key={request.id} value={String(request.id)}>{request.title} · {request.sections.join(', ')}</option>)}
    </select>
  </label>
}

function FacultyCertificates() {
  const { requests, setRequests, loading, error, retry } = useRequests()
  const [selected, setSelected] = useState('')
  const createDialog = useRef<HTMLDialogElement>(null)
  const request = requests.find(item => String(item.id) === selected) ?? requests[0]

  function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title')).trim()
    const section = String(form.get('section'))
    if (!title) return
    const id = crypto.randomUUID()
    const roster = demoSubmissions.filter(row => row.section === section).map(row => ({
      ...row, id:`${id}-${row.id}`, request_id:id, status:'pending' as const, flags:[],
      course_name:'', certificate_id:'', score:0, uploaded_at:'',
    }))
    const next: NptelRequest = { ...demoRequest, id, title, sections:[section],
      due_date:String(form.get('due')), total_students:roster.length,
      submitted_count:0, verified_count:0, flagged_count:0, created_at:new Date().toISOString() }
    demo = { ...demo, requests:[...demo.requests, next], submissions:[...demo.submissions, ...roster] }
    setRequests(demo.requests)
    setSelected(id)
    event.currentTarget.reset()
    createDialog.current?.close()
  }

  return <section className="tars-nptel">
    <header className="nptel-header">
      <div><h1>NPTEL certificates</h1>{mock && <p>Demo data</p>}</div>
      {mock && <button className="nptel-primary" onClick={() => createDialog.current?.showModal()}><Plus size={16}/>New request</button>}
    </header>
    {loading && <p role="status">Loading certificate requests…</p>}
    {error && <p role="alert">{error} <button onClick={retry}>Retry</button></p>}
    {!loading && !error && !request && <p>No certificate requests yet.</p>}
    <RequestPicker requests={requests} selected={String(request?.id ?? '')} onChange={setSelected}/>
    {request && <CertificateDashboard key={request.id} request={request}/>}
    <dialog className="nptel-dialog" ref={createDialog} aria-labelledby="nptel-request-title">
      <form onSubmit={createRequest}>
        <h2 id="nptel-request-title">New certificate request</h2>
        <label className="nptel-field">Title<input name="title" required maxLength={90} pattern=".*\S.*"/></label>
        <label className="nptel-field">Section<select name="section"><option>CSE-10</option></select></label>
        <label className="nptel-field">Due date<input name="due" type="date" required/></label>
        <footer><button type="button" onClick={() => createDialog.current?.close()}>Cancel</button><button className="nptel-primary">Create request</button></footer>
      </form>
    </dialog>
  </section>
}

function CertificateDashboard({ request }: { request: NptelRequest }) {
  const [tab, setTab] = useState<typeof statuses[number]>('verified')
  const [rows, setRows] = useState<NptelSubmission[]>(() => mock ? demo.submissions.filter(row => row.request_id === request.id) : [])
  const [loading, setLoading] = useState(!mock)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [renudged, setRenudged] = useState<string[]>([])
  const [nudged, setNudged] = useState(false)
  const [exported, setExported] = useState(false)
  useEffect(() => {
    if (mock) return
    let active = true
    void api.nptel.getSubmissions(request.id).then(items => {
      if (active) setRows(items)
    }).catch(() => {
      if (active) setLoadError('Submissions could not be loaded.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [attempt, request.id])

  const verified = mock ? rows.filter(row => row.status === 'verified').length : request.verified_count
  const flagged = mock ? rows.filter(row => row.status === 'flagged').length : request.flagged_count
  const pending = mock ? rows.filter(row => row.status === 'pending').length : Math.max(0, request.total_students - request.submitted_count)
  const counts = { verified, pending, flagged }
  const percent = request.total_students ? Math.min(100, Math.round(verified * 100 / request.total_students)) : 0
  const visible = rows.filter(row => row.status === tab)

  async function nudge() {
    setBusy(true)
    setMessage('')
    setActionError('')
    try {
      const result = mock ? { nudged_count:pending } : await api.nptel.nudgeStudents(request.id)
      setMessage(mock ? `Simulated reminders for ${result.nudged_count} pending students.` : `Reminders requested for ${result.nudged_count} students.`)
      setNudged(true)
    } catch {
      setActionError('Reminders could not be requested. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <div className="nptel-summary">
      <div className="nptel-progress" role="img" aria-label={`${percent}% verified`} style={{ background:`conic-gradient(#4f46e5 ${percent}%, #e2e8f0 0)` }}><span>{percent}%</span></div>
      <div className="nptel-summary-copy"><h2>{request.title}</h2><p>{request.sections.join(', ')} · Due {dateLabel(request.due_date)}</p><strong>{verified} / {request.total_students} verified</strong><p>{pending} pending · {flagged} flagged</p></div>
      <button disabled={busy || !pending} onClick={() => void nudge()}><Bell size={16}/>{busy ? 'Requesting…' : 'Nudge pending'}</button>
    </div>
    <ol className="nptel-steps">
      {['Request sent','Students nudged','Uploading','Verified','Exported'].map((label,index) => {
        const done = index === 0 || (index === 2 && verified + flagged > 0) || (index === 3 && percent === 100) || (index === 1 && nudged) || (index === 4 && exported)
        return <li key={label} data-done={done}>{done ? <Check size={14}/> : <span>{index+1}</span>}{label}</li>
      })}
    </ol>
    <div className="nptel-dashboard">
      <section className="nptel-panel">
        <nav className="nptel-tabs" aria-label="Certificate status">
          {statuses.map(status => <button key={status} aria-pressed={tab === status} onClick={() => setTab(status)}>{status} ({counts[status]})</button>)}
        </nav>
        {loading && <p role="status">Loading submissions…</p>}
        {loadError && <p role="alert">{loadError} <button onClick={() => { setLoading(true); setLoadError(''); setAttempt(value => value + 1) }}>Retry</button></p>}
        {!loading && !loadError && (visible.length ? <div className="nptel-table-scroll"><table>
          <thead><tr><th>Student</th><th>USN</th><th>Course</th><th>Score</th><th>Status</th>{tab === 'flagged' && mock && <th>Action</th>}</tr></thead>
          <tbody>{visible.map(row => <tr key={row.id}>
            <td><strong>{row.student_name}</strong>{row.flags?.map(flag => <small key={flag}>{flag}</small>)}</td>
            <td>{row.usn}</td><td>{row.course_name || '—'}</td><td>{row.status === 'pending' ? '—' : `${row.score}%`}</td>
            <td><span className="nptel-status" data-status={row.status}>{row.status}</span></td>
            {tab === 'flagged' && mock && <td><button disabled={renudged.includes(String(row.id))} onClick={() => {
              setRenudged(current => [...current, String(row.id)])
              setMessage(`Simulated re-upload request for ${row.student_name}.`)
            }}>{renudged.includes(String(row.id)) ? 'Requested' : 'Ask to re-upload'}</button></td>}
          </tr>)}</tbody>
        </table></div> : <p className="nptel-empty">No {tab} submissions.</p>)}
      </section>
      <aside className="nptel-panel nptel-section-summary"><h2>By section</h2>
        {request.sections.map(section => {
          const sectionRows = rows.filter(row => row.section === section)
          const count = sectionRows.filter(row => row.status === 'verified').length
          return <div className="nptel-section" key={section}><span>{section} <b>{count} verified</b></span>
            {mock && <progress aria-label={`${section} verified certificates`} value={count} max={sectionRows.length || 1}/>}
          </div>
        })}
        <button disabled={!rows.length || loading || Boolean(loadError)} onClick={() => { exportCsv(rows); setExported(true); setMessage('Certificate CSV downloaded.') }}><Download size={16}/>Export for accreditation (CSV)</button>
      </aside>
    </div>
    {message && <p className="nptel-feedback" role="status">{message}</p>}
    {actionError && <p className="nptel-error" role="alert">{actionError}</p>}
  </>
}

function StudentUpload() {
  const { requests, loading, error, retry } = useRequests()
  const [selected, setSelected] = useState('')
  const request = requests.find(item => String(item.id) === selected) ?? requests[0]
  return <section className="tars-nptel nptel-student">
    <header className="nptel-header"><div><h1>Upload NPTEL certificate</h1>
      {request && <p>Requested by {request.faculty_name} · due {dateLabel(request.due_date)}</p>}
    </div></header>
    {loading && <p role="status">Loading certificate requests…</p>}
    {error && <p role="alert">{error} <button onClick={retry}>Retry</button></p>}
    {!loading && !error && !request && <p>No certificate requests are open.</p>}
    <RequestPicker requests={requests} selected={String(request?.id ?? '')} onChange={setSelected}/>
    {request && <CertificateUpload key={request.id} request={request}/>}
  </section>
}

const certificateTypes = ['application/pdf','image/png','image/jpeg']

function CertificateUpload({ request }: { request: NptelRequest }) {
  const [file, setFile] = useState<File>()
  const [result, setResult] = useState<NptelExtraction | undefined>(() => mock ? demo.checks[String(request.id)] : undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  function choose(next?: File) {
    if (!next || busy) return
    if (!certificateTypes.includes(next.type) || next.size === 0 || next.size > 10_000_000) {
      setError('Choose a PDF, PNG or JPG between 1 byte and 10 MB.')
      return
    }
    setFile(next)
    setError('')
  }

  function clear() {
    setFile(undefined)
    setError('')
    if (input.current) input.current.value = ''
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || busy) return
    setBusy(true)
    setError('')
    try {
      const extraction = mock ? demoExtraction : await api.nptel.uploadCertificate(request.id, file)
      if (!extraction || !['verified', 'flagged', 'mismatch'].includes(extraction.status)) {
        throw new Error('Invalid verification status')
      }
      if (!Array.isArray(extraction.fields)) throw new Error('Missing extraction fields')
      if (mock) {
        demo = {
          ...demo, checks:{ ...demo.checks, [String(request.id)]:extraction },
          submissions:demo.submissions.map(row => row.request_id === request.id && row.usn === 'DEMO-CSE10-001'
            ? { ...row, course_name:String(demoExtraction.fields[2].value), score:88, certificate_id:'DEMO-CERT-39',
              status:'verified', uploaded_at:new Date().toISOString(), flags:[] } : row),
        }
      }
      setResult(extraction)
      clear()
    } catch {
      setError('The certificate could not be checked. Try uploading it again.')
    } finally {
      setBusy(false)
    }
  }

  return <form className="nptel-upload" onSubmit={event => void submit(event)}>
    <label className="nptel-drop" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); choose(event.dataTransfer.files[0]) }}>
      <CloudUpload size={33}/><strong>Tap to upload</strong><span>PDF, PNG or JPG (max 10 MB)</span>
      <input ref={input} type="file" accept="application/pdf,image/png,image/jpeg" disabled={busy} aria-label="Choose certificate" onChange={event => choose(event.target.files?.[0])}/>
    </label>
    {file && <div className="nptel-file"><FileText size={18}/><span>{file.name} · {(file.size / 1000).toFixed(1)} KB</span><button type="button" disabled={busy} aria-label="Remove certificate" onClick={clear}><X size={16}/></button></div>}
    {mock && <p className="nptel-demo-note">Demo mode uses sample certificate results.</p>}
    {busy && <p role="status">Checking certificate…</p>}
    {result && <section className="nptel-result" aria-live="polite" data-status={result.status}>
      <h2>{result.status === 'verified' ? <Check size={19}/> : <AlertCircle size={19}/>} {result.status === 'verified' ? 'Checked by TARS' : 'Needs faculty review'}</h2>
      <dl>{result.fields.map(field => <div key={field.name}><dt>{field.name}</dt><dd>{field.value} {field.ok ? <Check aria-label="Matched" size={15}/> : <AlertCircle aria-label="Needs review" size={15}/>}</dd></div>)}</dl>
    </section>}
    {error && <p role="alert" className="nptel-error">{error}</p>}
    <footer><button type="button" disabled={!file || busy} onClick={clear}>Cancel</button><button className="nptel-primary" disabled={!file || busy}>Submit</button></footer>
  </form>
}
