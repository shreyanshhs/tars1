import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Bookmark, CalendarDays, Check, Plus, Search, Sparkles } from 'lucide-react'
import qrcode from './vendor/qrcode.mjs'
import { categories, clashesFor, events, student } from '../../../mock/eventsData'
import type { CampusEvent, Category, EventTicket, Registration } from '../../../mock/eventsData'
import './events.css'

const filters = ['All', 'Clash-free', 'Saved', 'Registered'] as const
type Filter = typeof filters[number]
type Result = { event: CampusEvent; ticket: EventTicket; qr: string }
const fmtDate = (date: string) => new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', timeZone:'UTC' }).format(new Date(date))
const fmtTime = (time: string) => new Intl.DateTimeFormat('en-US', { hour:'numeric', minute:'2-digit',timeZone:'UTC' }).format(new Date('2000-01-01T'+time+'Z'))
const formValue = (data: FormData, key: string) => String(data.get(key) ?? '').trim()

function Poster({ event }: { event: CampusEvent }) {
  return <div className="event-poster" data-category={event.category}>
    {event.poster && <img src={event.poster} alt="" onError={e => { e.currentTarget.hidden = true }} />}
    <strong>{event.title}</strong>
    <span className="event-category">{event.category}</span><span className="event-date">{fmtDate(event.date)}</span>
  </div>
}

export default function Events({ canPost = false }: { canPost?: boolean }) {
  const [list, setList] = useState(events)
  const [saved, setSaved] = useState<string[]>(['cyber'])
  const [tickets, setTickets] = useState<Record<string, Result>>({})
  const [filter, setFilter] = useState<Filter>('All')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [active, setActive] = useState<CampusEvent>()
  const [result, setResult] = useState<Result>()
  const [members, setMembers] = useState<string[]>([])
  const [memberInput, setMemberInput] = useState('')
  const [visiblePoster, setVisiblePoster] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const registration = useRef<HTMLDialogElement>(null)
  const posting = useRef<HTMLDialogElement>(null)
  const success = useRef<HTMLDialogElement>(null)
  const clash = active && clashesFor(active)[0]
  const visible = list.filter(event => {
    const matchesSearch = [event.title, event.organiser, event.venue].join(' ').toLowerCase().includes(search.trim().toLowerCase())
    return matchesSearch && (filter === 'All' || (filter === 'Clash-free' && !clashesFor(event).length)
      || (filter === 'Saved' && saved.includes(event.id)) || (filter === 'Registered' && Boolean(tickets[event.id])))
  })

  function openEvent(event: CampusEvent) {
    if (tickets[event.id]) {
      setResult(tickets[event.id])
      success.current?.showModal()
      return
    }
    setActive(event)
    setError('')
    setMembers([])
    setMemberInput('')
    registration.current?.showModal()
  }

  function addMember() {
    const value = memberInput.trim().toUpperCase()
    if (!/^[A-Z0-9-]{4,30}$/.test(value) || members.includes(value) || value === student.usn || members.length >= 3) {
      setError('Enter a unique team member USN. You can add up to three.')
      return
    }
    setMembers([...members, value])
    setMemberInput('')
    setError('')
  }

  function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!active || busy || tickets[active.id]) return
    if (memberInput.trim()) {
      setError('Add the typed USN to your team before registering.')
      return
    }
    const data = new FormData(e.currentTarget)
    const payload: Registration = {
      event_id: active.id, phone: formValue(data,'phone'), team_name: formValue(data,'team_name'), members,
      tshirt: formValue(data,'tshirt'), note: formValue(data,'note'),
      add_to_schedule: data.has('add_to_schedule'), request_permission: Boolean(clash) && data.has('request_permission'),
    }
    setBusy(true)
    setError('')
    try {
      const id = crypto.randomUUID()
      const ticket: EventTicket = { ticket_id:id, event_id:active.id, event_title:active.title,
        attendee_name:student.name, usn:student.usn, issued_at:new Date().toISOString(), qr_payload:`tars:demo:${active.id}:${id}`,
        add_to_schedule:payload.add_to_schedule, request_permission:payload.request_permission }
      const qr = qrcode(0, 'M')
      qr.addData(ticket.qr_payload)
      qr.make()
      const next = { event:active, ticket, qr:qr.createDataURL(8, 32) }
      setTickets(current => ({ ...current, [active.id]:next }))
      setResult(next)
      registration.current?.close()
      success.current?.showModal()
    } catch {
      setError('Could not create the ticket. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function loadPoster(file?: File) {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5_000_000) {
      setError('Choose a PNG, JPEG or WebP poster under 5 MB.')
      return
    }
    const payload = await file.arrayBuffer()
    const imgUrl = URL.createObjectURL(new Blob([payload], { type:file.type }))
    setVisiblePoster(imgUrl)
    setError('')
  }

  function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const date = formValue(data,'date')
    const start = formValue(data,'start')
    const end = formValue(data,'end')
    const title = formValue(data,'title')
    const organiser = formValue(data,'organiser')
    const venue = formValue(data,'venue')
    if (!title || !organiser || !venue || end <= start) {
      setError('Enter an event name, organiser and venue. End time must be after start time.')
      return
    }
    setList(current => [{ id:crypto.randomUUID(), title, organiser, venue, date, start, endDate:date, end,
      category:formValue(data,'category') as Category, poster:visiblePoster,
      description:formValue(data,'description'), registeredCount:0 }, ...current])
    setFilter('All')
    setSearch('')
    setStatus(`${title} published in demo.`)
    posting.current?.close()
  }

  return <section className="campus-events" aria-label="Campus events">
    <header className="events-header">
      <div><h1>Campus events</h1><p>TARS checks every event against your {student.section} timetable.</p></div>
      <div className="event-actions">
        <label className="event-search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} aria-label="Search events" placeholder="Search events…"/></label>
        {canPost && <button className="primary" onClick={() => { setVisiblePoster(''); setError(''); posting.current?.querySelector('form')?.reset(); posting.current?.showModal() }}><Plus size={17}/> Post an event</button>}
      </div>
    </header>
    <nav className="event-tabs" aria-label="Event filters">{filters.map(tab => <button key={tab} aria-pressed={filter === tab} onClick={() => setFilter(tab)}>{tab}</button>)}</nav>
    {status && <p className="event-status" role="status">{status}</p>}
    <div className="events-layout">
      <section className="event-grid" aria-label="Events">
        {visible.length === 0 && <p>No events match this view.</p>}
        {visible.map(event => {
          const clashes = clashesFor(event)
          const ticket = tickets[event.id]
          return <article key={event.id}><Poster event={event}/>
            <div className="event-info"><h2>{event.title}</h2><p>{event.organiser}</p><p>{event.venue} · {fmtTime(event.start)}{event.date !== event.endDate ? ' · 24 hrs' : ''}</p>
              <span className={clashes.length ? 'clash' : 'clear'}>{clashes.length ? (ticket?.ticket.request_permission ? 'Attendance permission requested (demo)' : `Clashes with ${clashes[0].label}`) : 'No timetable clash'}</span></div>
            <div className="event-card-footer"><small>{event.registeredCount + Number(Boolean(ticket))} registered</small>
              <button className="icon" aria-label={saved.includes(event.id) ? 'Remove bookmark' : 'Bookmark event'} aria-pressed={saved.includes(event.id)} onClick={() => setSaved(current => current.includes(event.id) ? current.filter(id => id !== event.id) : [...current,event.id])}><Bookmark size={17} fill={saved.includes(event.id) ? 'currentColor' : 'none'}/></button>
              <button className={ticket ? 'outline' : 'primary'} onClick={() => openEvent(event)}>{ticket ? 'View ticket' : 'Register'}</button></div>
          </article>
        })}
      </section>
      <aside className="event-week"><section><h2><CalendarDays size={17}/> Your week</h2>
        {list.filter(event => tickets[event.id]?.ticket.add_to_schedule || saved.includes(event.id)).slice(0,4).map(event => <p key={event.id}><b>{fmtDate(event.date)}</b> · {event.title}</p>)}
        {!list.some(event => tickets[event.id]?.ticket.add_to_schedule || saved.includes(event.id)) && <p>Saved and scheduled events appear here.</p>}
      </section><section className="event-insight"><h2><Sparkles size={17}/> TARS insight</h2><p>{list.filter(event => !clashesFor(event).length).length} events fit your sample timetable.</p></section></aside>
    </div>

    <dialog ref={registration} className="event-dialog" onCancel={e => { if (busy) e.preventDefault() }}>
      {active && <div className="registration-layout"><Poster event={active}/><form key={active.id} onSubmit={register}>
        <h2>Register for {active.title}</h2><p>{fmtDate(active.date)} · {active.venue}</p>
        <div className="event-fields"><label>Full name<input readOnly value={student.name}/></label><label>USN<input readOnly value={student.usn}/></label>
          <label>Section<input readOnly value={student.section}/></label><label>Email<input readOnly value={student.email}/></label>
          <label>Phone<input name="phone" type="tel" pattern="[0-9]{10}" required placeholder="Phone number"/></label>
          <label>Team name (optional)<input name="team_name" maxLength={80}/></label></div>
        <label>Team members (up to 3 by USN)<span className="event-inline"><input value={memberInput} onChange={e => setMemberInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMember() } }} placeholder="Enter USN"/><button type="button" onClick={addMember}>Add</button></span></label>
        {members.map(member => <button className="member-chip" type="button" key={member} aria-label={`Remove ${member}`} onClick={() => setMembers(members.filter(item => item !== member))}>{member} ×</button>)}
        <label>T-shirt size<select name="tshirt"><option value="">Select size</option>{['S','M','L','XL'].map(size => <option key={size}>{size}</option>)}</select></label>
        <label>Note for the organisers<textarea name="note" rows={2} maxLength={500}/></label>
        <label className="event-check"><input type="checkbox" name="add_to_schedule" defaultChecked/> Add to my schedule</label>
        {clash && <label className="event-check clash"><input type="checkbox" name="request_permission" defaultChecked/> Request attendance permission for {clash.label} (demo)</label>}
        {error && <p role="alert" className="event-error">{error}</p>}
        <footer><button type="button" disabled={busy} onClick={() => registration.current?.close()}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Registering…' : 'Register'}</button></footer>
      </form></div>}
    </dialog>

    <dialog ref={success} className="event-dialog ticket-dialog">
      {result && <div className="ticket-content"><span className="ticket-check"><Check/></span><h2>You’re registered</h2><h3>{result.event.title}</h3>
        <p>{student.name} · {student.usn} · {student.section}</p><p>{fmtDate(result.event.date)} · {result.event.venue}</p>
        <img alt="Demo ticket QR code" src={result.qr} width="220" height="220"/>
        <p>Show this QR at the demo entry desk</p>
        {result.ticket.add_to_schedule && <p className="clear">Added to your demo schedule</p>}
        <footer><a className="outline" download={`TARS-${result.ticket.ticket_id}.gif`} href={result.qr}>Download ticket</a><button className="primary" onClick={() => success.current?.close()}>Done</button></footer>
      </div>}
    </dialog>

    <dialog ref={posting} className="event-dialog post-drawer">
      <form onSubmit={publish}>
        <h2>Post an event</h2><p>Add an event to the campus calendar.</p>
        <label className="poster-upload" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void loadPoster(e.dataTransfer.files[0]) }}>
          {visiblePoster && <img alt="Poster preview" src={visiblePoster}/>}<span>Drop a poster here · 4:5 recommended</span>
          <input aria-label="Choose poster" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void loadPoster(e.target.files?.[0])}/>
        </label>
        <label>Title<input name="title" required maxLength={100}/></label>
        <label>Organiser<input name="organiser" required maxLength={80}/></label>
        <label>Category<select name="category">{categories.map(category => <option key={category}>{category}</option>)}</select></label>
        <div className="event-fields"><label>Date<input name="date" type="date" required/></label>
          <label>Venue<input name="venue" required maxLength={80}/></label>
          <label>Start<input name="start" type="time" required/></label><label>End<input name="end" type="time" required/></label></div>
        <label>Description<textarea name="description" rows={3} maxLength={500}/></label>
        <p className="event-insight">TARS checks the event time against the sample timetable.</p>
        {error && <p role="alert" className="event-error">{error}</p>}
        <footer><button type="button" onClick={() => posting.current?.close()}>Cancel</button><button className="primary">Publish</button></footer>
      </form>
    </dialog>
  </section>
}
