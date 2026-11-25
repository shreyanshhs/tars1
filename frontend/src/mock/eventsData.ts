import type { EventRegistrationPayload, EventTicket as ApiEventTicket } from '../types/api'

export const categories = ['Tech', 'Hackathon', 'Careers', 'Culture', 'Workshop', 'Club'] as const
export type Category = typeof categories[number]
export type CampusEvent = {
  id: string; title: string; organiser: string; category: Category; date: string;
  start: string; endDate: string; end: string; venue: string; description: string;
  poster: string; registeredCount: number;
}
export const student = {
  name: 'Aarav Demo', usn: 'DEMO-CSE10-001', section: 'CSE-10', email: 'aarav@example.test',
}
export const events: CampusEvent[] = [
  { id:'cyber', title:'CyberSec Workshop: Intro to CTFs', organiser:'CyberSec Student Chapter', category:'Tech', date:'2026-12-02', start:'14:20', endDate:'2026-12-02', end:'16:10', venue:'Seminar Hall', description:'An introductory campus workshop.', poster:'/posters/cyber.webp', registeredCount:48 },
  { id:'mars', title:'Martian 1.0 — Agentic AI Hackathon', organiser:'BMSIT', category:'Hackathon', date:'2026-11-25', start:'10:30', endDate:'2026-11-26', end:'10:30', venue:'APJ Abdul Kalam Lab', description:'A 24-hour campus hackathon.', poster:'', registeredCount:124 },
  { id:'placement', title:'Placement talk: Product companies', organiser:'Placement Cell', category:'Careers', date:'2026-12-12', start:'10:40', endDate:'2026-12-12', end:'11:35', venue:'Main Auditorium', description:'Recruiting and interview preparation.', poster:'', registeredCount:64 },
  { id:'culture', title:'Cultural fest auditions', organiser:'Cultural Committee', category:'Culture', date:'2026-12-04', start:'15:15', endDate:'2026-12-04', end:'16:10', venue:'Open Air Theatre', description:'Auditions for the campus festival.', poster:'', registeredCount:26 },
  { id:'nptel', title:'NPTEL orientation', organiser:'CSE Department', category:'Workshop', date:'2026-12-03', start:'12:30', endDate:'2026-12-03', end:'13:25', venue:'SJB-104', description:'Course selection and certificate submission.', poster:'', registeredCount:31 },
  { id:'chess', title:'Chess club weekly meet', organiser:'Chess Club', category:'Club', date:'2026-12-12', start:'14:20', endDate:'2026-12-12', end:'15:15', venue:'Library Hall', description:'Weekly open chess meet.', poster:'', registeredCount:18 },
]
const timetable = [
  { date: '2026-11-25', start: '11:35', end: '12:30', label: 'Chemistry (P4)' },
  { date: '2026-11-26', start: '08:30', end: '09:25', label: 'Chemistry (P1)' },
  { date: '2026-12-02', start: '14:20', end: '16:10', label: 'Skill lab (P6–P7)' },
  { date: '2026-12-03', start: '11:35', end: '12:30', label: 'Intro to AI (P4)' },
]
export function clashesFor(event: CampusEvent) {
  return timetable.filter(slot =>
    `${event.date}T${event.start}` < `${slot.date}T${slot.end}` &&
    `${slot.date}T${slot.start}` < `${event.endDate}T${event.end}`,
  )
}
export type Registration = EventRegistrationPayload
export type EventTicket = ApiEventTicket & Pick<Registration, 'add_to_schedule' | 'request_permission'>
