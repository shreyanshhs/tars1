import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { checkBackendHealth, api, IDENTITY_ADAPTER } from '../services/api';
import type { TimetableSlot } from '../types/api';
import type {
  Role,
  ViewTab,
  Nudge,
  TodayTimelineItem,
  AttendanceCourse,
  CampusEvent,
  RadarEvent,
  ScheduleGridSlot,
  FacultyStatus,
  RoomStatus,
  ReasoningLog,
  RelocationDiff,
} from '../types/tars';

interface TarsContextType {
  role: Role;
  setRole: (role: Role, facultyId?: string) => void;
  currentView: ViewTab;
  setCurrentView: (view: ViewTab) => void;
  unreadNudgesCount: number;

  // Today state
  autonomousScheduleBannerVisible: boolean;
  dismissAutonomousBanner: () => void;
  acceptAutonomousBanner: () => void;
  timelineItems: TodayTimelineItem[];
  acceptTimelineSlot: (id: string) => void;
  attendanceCourses: AttendanceCourse[];

  // Nudges state
  nudges: Nudge[];
  selectedNudgeId: string;
  setSelectedNudgeId: (id: string) => void;
  handleNudgeAction: (id: string, action: 'block' | 'snooze' | 'done') => void;

  // Events state
  events: CampusEvent[];
  radarEvents: RadarEvent[];
  rsvpEvent: (id: string) => void;

  // Schedule state
  scheduleSlots: ScheduleGridSlot[];
  facultyStatuses: FacultyStatus[];
  roomStatuses: RoomStatus[];
  liveTimetable: TimetableSlot[] | null;
  timetableStatus: 'loading' | 'live' | 'mock' | 'unavailable';
  refreshTimetable: () => Promise<void>;

  // Persona / Faculty identity
  activeFacultyId: string;
  setActiveFacultyId: (id: string) => void;

  // Substitute Acceptance state (Safeguards 1-10)
  simulatedCoverStatus: 'pending' | 'accepted' | 'declined';
  simulatedCoverDecisionId: number | null;
  simulatedAiStatus: 'pending' | 'accepted' | 'declined';
  simulatedLabStatus: 'pending' | 'accepted' | 'declined';
  acceptSubstituteCover: (target?: 'ai' | 'lab') => void;
  declineSubstituteCover: (target?: 'ai' | 'lab') => void;
  acceptAiCover: () => void;
  declineAiCover: () => void;
  acceptLabCover: () => void;
  declineLabCover: () => void;

  // Slice 1: Teacher Leave & Substitute state
  hasActiveLeave: boolean;
  leaveDate: string;
  leaveType: string;
  leaveReason: string;
  labCovered: boolean;
  aiCovered: boolean;
  hodApproved: boolean;
  hodApprovalTime: string | null;
  studentNotified: boolean;
  simStep: number;
  applyLeave: (date?: string, type?: string, reason?: string) => void;
  cancelLeave: () => void;
  setSimStep: (step: number) => void;
  advanceSimulation: () => void;
  resetSimulation: () => void;
  approveHod: (decisionId?: number | string, note?: string) => Promise<void>;
  rejectHod: (decisionId?: number | string, note?: string) => Promise<void>;
  resetDemo: () => Promise<boolean>;
  backendStatus: 'connected' | 'offline';
  backendMode: 'live' | 'offline_demo';
  backendIncidentId: number | null;
  backendDecisionId: number | null;

  // Admin state
  incidentText: string;
  setIncidentText: (text: string) => void;
  reasoningLogs: ReasoningLog[];
  isReplanRunning: boolean;
  relocationDiff: RelocationDiff;
  triggerTarsReplan: (customIncident?: string) => void;
  nudgeAllFaculty: () => void;
  facultyNudgeTriggered: boolean;
  kpiStats: {
    autoReplans: number;
    classesLost: number;
    nudgesActedOn: number;
    recoveredAtt: number;
  };
}

const initialNudges: Nudge[] = [
  {
    id: 'nudge-1',
    category: 'DEADLINE',
    courseCode: 'CSE102',
    dueText: 'Tomorrow, 23:59 IST',
    title: 'DS assignment due tomorrow',
    snippet: 'Free 10:00–11:00 AM block available due to faculty rescheduling.',
    headline: 'DS Assignment #4: Self-Balancing Binary Trees',
    description:
      'AVL Trees and Red-Black tree insertion, balance rotations, and validation benchmark suite. Free 60-minute window available this morning from 10:00–11:00 AM due to faculty rescheduling.',
    targetSlot: '10:00 AM – 11:00 AM',
    plan: {
      slotTitle: 'Target Execution Slot: Today, 10:00 AM – 11:00 AM',
      slotDesc: 'Utilizes the free Digital Electronics slot with zero calendar conflicts.',
      setupTitle: 'Setup & Core Structure',
      setupDesc: 'Fork repository, implement AVL helper methods, and run sanity unit tests 1–4.',
      sanctuaryTitle: 'Recommended Sanctuary: Quiet Study Hub',
      sanctuaryDesc: 'Central Library 2nd Floor - 34 dB noise level with verified open power outlets.',
    },
    status: 'pending',
  },
  {
    id: 'nudge-2',
    category: 'ATTENDANCE',
    courseCode: 'CSE104',
    dueText: 'Today',
    title: 'Data Structures attendance at 76%',
    snippet: 'Missing today\'s 2:00 PM lecture will drop below 75% threshold.',
    headline: 'Critical Attendance Alert: CS102 Data Structures',
    description:
      'Your current attendance is 76.0% (1 missed class away from the mandatory 75% threshold). Dr. Menon will take roll at 14:00 in Room 504.',
    targetSlot: '14:00 PM – 15:30 PM',
    plan: {
      slotTitle: 'Required Attendance: 14:00 PM - 15:30 PM',
      slotDesc: 'Room 504 (North Block). Rescheduled session with Dr. Menon.',
      setupTitle: 'Pre-lecture Material',
      setupDesc: 'Review Chapter 8: B-Trees and indexing architectures before attending.',
      sanctuaryTitle: 'Sanctuary Route',
      sanctuaryDesc: 'North Block Rm 504 is a 3-minute walk from Central Library.',
    },
    status: 'pending',
  },
  {
    id: 'nudge-3',
    category: 'PACING',
    courseCode: 'MTH201',
    dueText: '6d left',
    title: 'Calculus II exam in 6 days',
    snippet: '3 of 5 units covered at current pace; 45 practice questions remaining.',
    headline: 'Exam Readiness Pacing: MTH201 Multivariable Calculus',
    description:
      'Historical cohort data shows students who solve Problem Set 3 within the next 48 hours score 22% higher on the final exam.',
    targetSlot: 'Weekend Study Block',
    plan: {
      slotTitle: 'Target Prep Slot: Saturday, 10:00 AM – 13:00 PM',
      slotDesc: 'Deep work block dedicated to Taylor Series and Partial Derivatives.',
      setupTitle: 'Problem Set 3 Verification',
      setupDesc: 'Complete offline worksheet sections A & B.',
      sanctuaryTitle: 'Recommended Sanctuary: Math Dept Common Room',
      sanctuaryDesc: 'TA office hours active Saturday morning.',
    },
    status: 'pending',
  },
];

const initialTimeline: TodayTimelineItem[] = [
  {
    id: 'tl-1',
    time: '09:00 – 10:00',
    title: 'Engineering Maths: Multivariable Calculus',
    subtitle: 'Room 302 • Prof. Sharma',
    location: 'Room 302',
    status: 'Completed',
  },
  {
    id: 'tl-2',
    time: '10:00 – 11:00',
    title: 'DS Assignment Study Block',
    subtitle: 'Self Balancing Trees (AVL/Red Black) - Desk #14 reserved',
    location: 'Reading Room 3',
    status: 'Free Slot Recommended',
    isStudyBlock: true,
    isLocked: false,
  },
  {
    id: 'tl-3',
    time: '11:30 – 13:00',
    title: 'Open Lab Hours / Library Slot',
    subtitle: 'Tech Tower 2nd Floor - CPU workstation reserved',
    location: 'Tech Tower 2nd Floor',
    status: 'Flexible',
  },
  {
    id: 'tl-4',
    time: '14:00 – 15:30',
    title: 'Data Structures & Algorithms (CS102)',
    subtitle: 'Prof. Sharma • Room 302',
    location: 'North Block Rm 504',
    status: 'Confirmed',
  },
  {
    id: 'tl-5',
    time: '16:30 – 18:00',
    title: 'CTF Workshop: Web Exploitation',
    subtitle: 'Seminar Hall 1 - Organized by CyberSoc',
    location: 'Seminar Hall 1',
    status: 'Confirmed',
  },
];

const initialAttendance: AttendanceCourse[] = [
  { id: 'att-1', name: 'Engineering Maths', percentage: 88.0 },
  {
    id: 'att-2',
    name: 'Data Structures & Algo',
    percentage: 76.0,
    thresholdWarning: '1 miss from threshold • Next class 2:00 PM',
  },
  { id: 'att-3', name: 'Digital Logic Design', percentage: 84.0 },
  { id: 'att-4', name: 'Environmental Studies', percentage: 92.0 },
];

const initialEvents: CampusEvent[] = [
  {
    id: 'ev-1',
    title: 'CTF Workshop: Binary Exploitation',
    category: 'CyberSec Student Chapter',
    dateBadge: 'Nov 20 • 4:30 PM',
    time: '4:30 PM',
    location: 'Seminar Hall 1 • Tech Park',
    clashStatus: 'free',
    clashText: "You're free • 2 hr window available",
    rsvpStatus: 'none',
    actionLabel: 'RSVP to Workshop',
    bannerGradient: 'from-blue-900 to-indigo-950',
  },
  {
    id: 'ev-2',
    title: 'Martian 1.0 Campus Hackathon',
    category: 'E-Cell & Dept of Computing',
    dateBadge: 'Nov 25 • 10:30 AM',
    time: '10:30 AM',
    location: 'Tech Park Innovation Hub',
    clashStatus: 'elective',
    clashText: 'Registration closes in 2 days',
    pool: 'Pool: ₹1.5L',
    rsvpStatus: 'none',
    actionLabel: 'Register Team',
    bannerGradient: 'from-amber-900 to-stone-900',
  },
  {
    id: 'ev-3',
    title: 'Pre-Placement Keynote & Talk',
    category: 'Campus Career Cell',
    dateBadge: 'Nov 28 • 2:00 PM',
    time: '2:00 PM',
    location: 'Main Auditorium',
    clashStatus: 'clash',
    clashText: 'Clashes with Physics Lab',
    registrationNote: 'Swap Lab option available',
    rsvpStatus: 'none',
    actionLabel: 'View & Join Waitlist',
    bannerGradient: 'from-slate-800 to-blue-950',
  },
];

const initialRadar: RadarEvent[] = [
  {
    id: 'rd-1',
    datetime: 'Dec 02 • 3:00 PM',
    typeBadge: 'Free Slot',
    title: 'ACM Distinguished Lecture: Quantum...',
    location: 'CS Hall 3 - Dr. V. Raman',
    actionText: 'Add to Calendar',
  },
  {
    id: 'rd-2',
    datetime: 'Dec 05 • 11:00 AM',
    typeBadge: 'Elective',
    title: 'Winter Robotics Showcase & Drone Trials',
    location: 'Football Ground Arena',
    actionText: 'Explore Slot',
  },
  {
    id: 'rd-3',
    datetime: 'Nov 22 • 6:00 PM',
    typeBadge: 'Evening',
    title: 'Open Mic & Cultural Jam Session',
    location: 'Student Amphitheater',
    actionText: 'Set Reminder',
  },
];

const initialScheduleSlots: ScheduleGridSlot[] = [
  // 09:00
  { id: 's-1', time: '09:00', day: 'MON', subject: 'Maths IV', room: 'Rm 402', faculty: 'Dr. Sharma' },
  { id: 's-2', time: '09:00', day: 'TUE', subject: 'Digital Logic', room: 'Rm 301', faculty: 'Prof. Gupta' },
  { id: 's-3', time: '09:00', day: 'WED', subject: 'Env Studies', room: 'Audi 2', faculty: 'Dr. Mukherjee' },
  { id: 's-4', time: '09:00', day: 'THU', subject: 'Maths IV', room: 'Rm 402', faculty: 'Dr. Sharma' },
  { id: 's-5', time: '09:00', day: 'FRI', subject: 'Digital Logic', room: 'Rm 301', faculty: 'Prof. Gupta' },
  // 10:00
  { id: 's-6', time: '10:00', day: 'MON', subject: 'Data Structures', room: 'Rm 302', faculty: 'Dr. Rao' },
  { id: 's-7', time: '10:00', day: 'TUE', subject: 'COA Architecture', room: 'Rm 401', faculty: 'Prof. Sengupta' },
  { id: 's-8', time: '10:00', day: 'WED', subject: 'Data Structures', room: 'Rm 302', faculty: 'Dr. Rao' },
  { id: 's-9', time: '10:00', day: 'THU', subject: 'Data Structures', room: 'Rm 302', faculty: 'Dr. Rao', status: 'normal' },
  { id: 's-10', time: '10:00', day: 'FRI', subject: 'COA Architecture', room: 'Rm 401', faculty: 'Prof. Sengupta' },
  // 11:00
  { id: 's-11', time: '11:00', day: 'MON', subject: 'Env Studies', room: 'Audi 2', faculty: 'Dr. Mukherjee' },
  { id: 's-12', time: '11:00', day: 'TUE', subject: 'Maths IV', room: 'Rm 402', faculty: 'Dr. Sharma' },
  { id: 's-13', time: '11:00', day: 'WED', subject: 'COA Architecture', room: 'Rm 401', faculty: 'Prof. Sengupta' },
  { id: 's-14', time: '11:00', day: 'THU', subject: 'Env Studies', room: 'Audi 2', faculty: 'Dr. Mukherjee' },
  { id: 's-15', time: '11:00', day: 'FRI', subject: 'Maths IV', room: 'Rm 402', faculty: 'Dr. Sharma' },
  // 12:00 (Recess)
  { id: 's-recess', time: '12:00', day: 'MON', subject: 'Recess & Refectory Window', room: 'Campus Core', faculty: 'All Students' },
  // 13:00
  { id: 's-16', time: '13:00', day: 'MON', subject: 'DS Lab B1', room: 'Tech Lab 3', faculty: 'Dr. Rao / TAs' },
  { id: 's-17', time: '13:00', day: 'TUE', subject: 'Seminar Prep', room: 'Rm 201', faculty: 'Peer Review' },
  { id: 's-18', time: '13:00', day: 'WED', subject: 'Web Eng', room: 'Rm 304', faculty: 'Prof. Verma' },
  { id: 's-19', time: '13:00', day: 'THU', subject: 'COA Architecture', room: 'Rm 401', faculty: 'Prof. Sengupta' },
  { id: 's-20', time: '13:00', day: 'FRI', subject: 'DS Lab B2', room: 'Tech Lab 3', faculty: 'Dr. Rao / TAs' },
  // 14:00
  { id: 's-21', time: '14:00', day: 'MON', subject: 'DS Lab B2', room: 'Tech Lab 3', faculty: 'Dr. Rao / TAs' },
  { id: 's-22', time: '14:00', day: 'TUE', subject: 'DL Design Lab', room: 'Hardware Lab 1', faculty: 'Prof. Gupta' },
  { id: 's-23', time: '14:00', day: 'WED', subject: 'Project Studio', room: 'Design Bay C', faculty: 'Faculty Panel' },
  { id: 's-24', time: '14:00', day: 'THU', subject: 'Data Structures', room: 'North Block Rm 504', faculty: 'Dr. Rao', status: 'normal' },
  { id: 's-25', time: '14:00', day: 'FRI', subject: 'Project Studio', room: 'Design Bay C', faculty: 'Faculty Panel' },
  // 15:00
  { id: 's-26', time: '15:00', day: 'MON', subject: 'Remedial Math', room: 'Rm 402', faculty: 'Dr. Sharma' },
  { id: 's-27', time: '15:00', day: 'TUE', subject: 'Sports & Wellness', room: 'Sports Complex', faculty: 'Coach Peter' },
  { id: 's-28', time: '15:00', day: 'WED', subject: 'Coding League', room: 'Tech Lab 1', faculty: 'ACM Chapter' },
  { id: 's-29', time: '15:00', day: 'THU', subject: 'Robotics Workshop', room: 'Maker Space', faculty: 'Dr. Paul' },
  { id: 's-30', time: '15:00', day: 'FRI', subject: 'Sports & Wellness', room: 'Sports Complex', faculty: 'Coach Peter' },
];

const initialFacultyStatus: FacultyStatus[] = [
  { name: 'Dr. Menon', location: 'Rm 504 • Teaching CSE-A', note: 'OS / Algorithms Lead', status: 'Active' },
  { name: 'Dr. Rao', location: 'Medical Leave • Reassigned', note: 'Data Structures', status: 'Away' },
  { name: 'Dr. Sharma', location: 'Cabin 204 • Free after 11:00', note: 'Applied Mathematics', status: 'Available' },
  { name: 'Dr. Arvind', location: 'Office hours 15:00–17:00', note: 'Student Academic Advisor', status: 'Advising' },
];

const initialRoomStatus: RoomStatus[] = [
  { name: 'Room 504', note: 'CSE-A allocated (14:00)', status: 'In Use' },
  { name: 'Room 302', note: 'Projector maintenance', status: 'Locked' },
  { name: 'Tech Park Lab 3', note: '42 workstations ready', status: 'Available' },
  { name: 'Seminar Hall 1', note: 'CyberSec (16:00)', status: 'Reserved' },
];

const initialLogs: ReasoningLog[] = [
  {
    id: 'log-1',
    timestamp: '09:14:02.110',
    tag: 'SIGNAL',
    message: 'Ingested leave notification from Faculty Portal for Dr. K. Rao (Computer Science).',
  },
  {
    id: 'log-2',
    timestamp: '09:14:02.430',
    tag: 'GRAPH',
    message: 'Evaluated schedule dependency DAG: Identified 3 affected classes spanning CSE-A and CSE-C cohorts.',
  },
  {
    id: 'log-3',
    timestamp: '09:14:03.015',
    tag: 'HEURISTIC',
    message: 'Scanned 18 faculty availability slots. Candidate match: Dr. Menon selected (Status: FREE, Domain: OS/Algorithms, Current Load: 12 hrs/wk - lowest load in CSE).',
  },
  {
    id: 'log-4',
    timestamp: '09:14:03.680',
    tag: 'CONSTRAINT',
    message: 'Relocated CSE-A Data Structures from 10:00 to 14:00. Room reallocation: Room 504 assigned. (Note: Room 302 blacklisted - overhead projector optical failure).',
  },
  {
    id: 'log-5',
    timestamp: '09:14:04.220',
    tag: 'CONFLICT',
    message: 'Auto-resolved 2 elective collisions (12 cross-enrolled students in Physics Elective Lab, 1 faculty invigilation duty mapped).',
  },
  {
    id: 'log-6',
    timestamp: '09:14:05.105',
    tag: 'DISPATCH',
    message: 'Generated proactive timetable diffs. Dispatched Telegram & Mobile push alerts to 124 students and 2 faculty members via MessageQueue.',
  },
  {
    id: 'log-7',
    timestamp: '09:14:06.315',
    tag: 'ESCALATION',
    message: 'Status: Awaiting student/faculty acknowledgement. Auto-escalation watchdog armed: Escalates to HOD Dr. V. Sharma in 28:42 min.',
  },
  {
    id: 'log-8',
    timestamp: '09:14:07.000',
    tag: 'IDLE',
    message: '[AUTONOMOUS AGENT IDLE - LISTENING ON WEBHOOKS...]',
  },
];

const initialDiff: RelocationDiff = {
  original: {
    time: '10:00 – 11:30 AM',
    statusBadge: 'CANCELLED',
    course: 'Data Structures & Algorithms',
    faculty: 'Dr. K. Rao (Medical Leave)',
    room: 'Room 302',
  },
  optimized: {
    time: '14:00 – 15:30 PM',
    statusBadge: 'RESCHEDULED',
    routedBadge: 'TARS ROUTED',
    course: 'Data Structures & Algorithms',
    faculty: 'Dr. Menon (Stand-in)',
    room: 'Room 504 Confirmed',
  },
};

const TarsContext = createContext<TarsContextType | undefined>(undefined);

export const TarsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const resetRequestedRef = React.useRef(
    typeof window !== 'undefined' && window.location.search.includes('reset=1')
  );

  if (resetRequestedRef.current) {
    try {
      localStorage.removeItem('tars_has_leave');
      localStorage.removeItem('tars_hod_approved');
      localStorage.removeItem('tars_hod_approval_time');
      localStorage.removeItem('tars_student_notified');
      localStorage.removeItem('tars_sim_step');
      localStorage.removeItem('tars_incident_id');
      localStorage.removeItem('tars_decision_id');
      localStorage.removeItem('tars_token');
      localStorage.removeItem('tars_active_faculty_id');
      localStorage.removeItem('tars_simulated_cover_acceptance');
    } catch {
      // ignore
    }
  }
  const [role, setRoleState] = useState<Role>(() => {
    try {
      return (localStorage.getItem('tars_role') as Role) || 'faculty';
    } catch {
      return 'faculty';
    }
  });
  const [activeFacultyId, setActiveFacultyIdState] = useState<string>(() => {
    try {
      return localStorage.getItem('tars_active_faculty_id') || 'F_CDB';
    } catch {
      return 'F_CDB';
    }
  });

  const setActiveFacultyId = (id: string) => {
    try {
      localStorage.setItem('tars_active_faculty_id', id);
    } catch {
      // ignore
    }
    setActiveFacultyIdState(id);
  };

  const [currentView, setCurrentViewState] = useState<ViewTab>(() => {
    try {
      return (localStorage.getItem('tars_view') as ViewTab) || 'home';
    } catch {
      return 'home';
    }
  });

  const loginForRole = async (r: Role, facultyId?: string, password?: string) => {
    let loginId = IDENTITY_ADAPTER.roleLoginId[r];
    if (r === 'faculty') {
      loginId = facultyId || activeFacultyId || 'F_CDB';
    }
    const pw = password || (typeof localStorage !== 'undefined' ? localStorage.getItem(`tars_pw_${loginId}`) : null) || 'bmsit';
    try {
      const res = await api.auth.login(loginId, pw);
      if (res && res.token) {
        setBackendStatus('connected');
        setBackendMode('live');
        return true;
      }
    } catch (err) {
      console.warn(`[TARS Auth] Live login failed for ${loginId} (${r}); maintaining offline demo fallback:`, err);
    }
    return false;
  };

  const setRole = (r: Role, facultyId?: string, password?: string) => {
    try {
      localStorage.setItem('tars_role', r);
      if (r === 'faculty' && facultyId) {
        localStorage.setItem('tars_active_faculty_id', facultyId);
        setActiveFacultyIdState(facultyId);
      }
    } catch {
      // ignore storage error
    }
    setRoleState(r);
    loginForRole(r, facultyId, password).then(() => {
      refreshTimetable();
    });
  };

  const setCurrentView = (v: ViewTab) => {
    try {
      localStorage.setItem('tars_view', v);
    } catch {
      // ignore storage error
    }
    setCurrentViewState(v);
  };
  const [autonomousScheduleBannerVisible, setAutonomousScheduleBannerVisible] = useState(false);
  const [timelineItems, setTimelineItems] = useState<TodayTimelineItem[]>(initialTimeline);
  const [nudges, setNudges] = useState<Nudge[]>(initialNudges);
  const [selectedNudgeId, setSelectedNudgeId] = useState<string>('nudge-1');
  const [events, setEvents] = useState<CampusEvent[]>(initialEvents);
  const [radarEvents] = useState<RadarEvent[]>(initialRadar);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleGridSlot[]>(initialScheduleSlots);
  const [facultyStatuses] = useState<FacultyStatus[]>(initialFacultyStatus);
  const [roomStatuses] = useState<RoomStatus[]>(initialRoomStatus);
  const [attendanceCourses] = useState<AttendanceCourse[]>(initialAttendance);
  const [liveTimetable, setLiveTimetable] = useState<TimetableSlot[] | null>(null);
  const [timetableStatus, setTimetableStatus] = useState<'loading' | 'live' | 'mock' | 'unavailable'>('loading');

  const refreshTimetable = useCallback(async () => {
    try {
      const health = await checkBackendHealth();
      if (health.online) {
        setBackendStatus('connected');
        setBackendMode(health.mode);
        const data = await api.schedule.getTimetable('CSE-10');
        if (Array.isArray(data) && data.length > 0) {
          const validSlots = data.filter((s) => s.section === 'CSE-10' && !s.section.startsWith('BUSY-'));
          const normalizedSlots = validSlots.map((s) => {
            if (s.faculty_id === 'F_SMP' || s.faculty_name === 'Faculty SMP') {
              return { ...s, faculty_name: 'Mr. Syed Matheen Pasha' };
            }
            if (s.faculty_id === 'F_GPL' || s.faculty_name === 'Faculty GPL') {
              return { ...s, faculty_name: 'Mrs. Geetha P L' };
            }
            return s;
          });
          setLiveTimetable(normalizedSlots);
          setTimetableStatus('live');
          return;
        }
        setLiveTimetable(null);
        setTimetableStatus('unavailable');
      } else {
        setBackendStatus('offline');
        setBackendMode('offline_demo');
        const mockData = await api.schedule.getTimetable('CSE-10');
        setLiveTimetable(mockData);
        setTimetableStatus('mock');
      }
    } catch {
      setLiveTimetable(null);
      setTimetableStatus('unavailable');
    }
  }, []);

  // Slice 1: Teacher Leave & Substitute state (Safeguards 1-10)
  interface SimulatedCoverRecord {
    decisionId: number | null;
    incidentId: number | null;
    aiStatus: 'pending' | 'accepted' | 'declined';
    labStatus: 'pending' | 'accepted' | 'declined';
    timestamp: string | null;
    label: string;
  }

  const [simulatedCoverState, setSimulatedCoverState] = useState<SimulatedCoverRecord>(() => {
    try {
      const stored = localStorage.getItem('tars_simulated_cover_acceptance');
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          decisionId: parsed.decisionId ?? null,
          incidentId: parsed.incidentId ?? null,
          aiStatus: parsed.aiStatus || 'pending',
          labStatus: parsed.labStatus || 'pending',
          timestamp: parsed.timestamp || null,
          label: parsed.label || 'Simulated acceptance — Telegram not connected',
        };
      }
    } catch {
      // ignore
    }
    return {
      decisionId: null,
      incidentId: null,
      aiStatus: 'pending',
      labStatus: 'pending',
      timestamp: null,
      label: 'Simulated acceptance — Telegram not connected',
    };
  });

  const [hasActiveLeave, setHasActiveLeaveState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tars_has_leave') === 'true';
    } catch {
      return false;
    }
  });

  const [leaveDate, setLeaveDate] = useState<string>(() => {
    try {
      return localStorage.getItem('tars_leave_date') || 'Thursday, 3 Dec 2026';
    } catch {
      return 'Thursday, 3 Dec 2026';
    }
  });

  const [leaveType, setLeaveType] = useState<string>(() => {
    try {
      return localStorage.getItem('tars_leave_type') || 'Medical Leave';
    } catch {
      return 'Medical Leave';
    }
  });

  const [leaveReason, setLeaveReason] = useState<string>(() => {
    try {
      return localStorage.getItem('tars_leave_reason') || 'High fever and viral infection';
    } catch {
      return 'High fever and viral infection';
    }
  });

  const [simStep, setSimStepState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tars_sim_step');
      return saved ? parseInt(saved, 10) : 2;
    } catch {
      return 2;
    }
  });

  const [hodApproved, setHodApprovedState] = useState<boolean>(() => {
    try {
      const hasLeave = localStorage.getItem('tars_has_leave') === 'true';
      return hasLeave && localStorage.getItem('tars_hod_approved') === 'true';
    } catch {
      return false;
    }
  });

  const [hodApprovalTime, setHodApprovalTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem('tars_hod_approval_time') || null;
    } catch {
      return null;
    }
  });

  const [studentNotified, setStudentNotified] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tars_student_notified') === 'true';
    } catch {
      return false;
    }
  });

  const [backendStatus, setBackendStatus] = useState<'connected' | 'offline'>('offline');
  const [backendMode, setBackendMode] = useState<'live' | 'offline_demo'>('offline_demo');
  const [backendIncidentId, setBackendIncidentId] = useState<number | null>(() => {
    const id = localStorage.getItem('tars_incident_id');
    return id ? Number(id) : null;
  });
  const [backendDecisionId, setBackendDecisionId] = useState<number | null>(() => {
    const id = localStorage.getItem('tars_decision_id');
    return id ? Number(id) : null;
  });

  useEffect(() => {
    if (resetRequestedRef.current) {
      resetRequestedRef.current = false;
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      api.auth.login('H_SKB').then(async (res) => {
        if (res && res.token) {
          try {
            await fetch('http://127.0.0.1:8000/api/admin/reset-demo', {
              method: 'POST',
              headers: { Authorization: `Bearer ${res.token}` },
            });
            loginForRole(role).then(() => {
              refreshTimetable();
            });
          } catch {
            // ignore
          }
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    checkBackendHealth().then((health) => {
      setBackendStatus(health.online ? 'connected' : 'offline');
      setBackendMode(health.mode);
      if (health.online) {
        loginForRole(role).then(() => {
          refreshTimetable();
        });
      } else {
        refreshTimetable();
      }
    });
  }, [role, refreshTimetable]);

  const acceptCover = (target: 'ai' | 'lab' = 'ai') => {
    const currentDecId =
      backendDecisionId ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('tars_decision_id')
        ? Number(localStorage.getItem('tars_decision_id'))
        : null);
    const currentIncId =
      backendIncidentId ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('tars_incident_id')
        ? Number(localStorage.getItem('tars_incident_id'))
        : null);

    setSimulatedCoverState((prev) => {
      const isSameDec = currentDecId !== null && prev.decisionId === currentDecId;
      const nextAi = target === 'ai' ? 'accepted' : (isSameDec ? prev.aiStatus : 'pending');
      const nextLab = target === 'lab' ? 'accepted' : (isSameDec ? prev.labStatus : 'pending');
      const record: SimulatedCoverRecord = {
        decisionId: currentDecId,
        incidentId: currentIncId,
        aiStatus: nextAi,
        labStatus: nextLab,
        timestamp: new Date().toISOString(),
        label: 'Simulated acceptance — Telegram not connected',
      };
      try {
        localStorage.setItem('tars_simulated_cover_acceptance', JSON.stringify(record));
      } catch {
        // ignore
      }
      return record;
    });
    setSimStepState(3);
  };

  const declineCover = (target: 'ai' | 'lab' = 'ai') => {
    const currentDecId =
      backendDecisionId ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('tars_decision_id')
        ? Number(localStorage.getItem('tars_decision_id'))
        : null);
    const currentIncId =
      backendIncidentId ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('tars_incident_id')
        ? Number(localStorage.getItem('tars_incident_id'))
        : null);

    setSimulatedCoverState((prev) => {
      const isSameDec = currentDecId !== null && prev.decisionId === currentDecId;
      const nextAi = target === 'ai' ? 'declined' : (isSameDec ? prev.aiStatus : 'pending');
      const nextLab = target === 'lab' ? 'declined' : (isSameDec ? prev.labStatus : 'pending');
      const record: SimulatedCoverRecord = {
        decisionId: currentDecId,
        incidentId: currentIncId,
        aiStatus: nextAi,
        labStatus: nextLab,
        timestamp: new Date().toISOString(),
        label: 'Simulated acceptance — Telegram not connected',
      };
      try {
        localStorage.setItem('tars_simulated_cover_acceptance', JSON.stringify(record));
      } catch {
        // ignore
      }
      return record;
    });
    setSimStepState(2);
  };

  const acceptSubstituteCover = (target: 'ai' | 'lab' = 'ai') => acceptCover(target);
  const declineSubstituteCover = (target: 'ai' | 'lab' = 'ai') => declineCover(target);
  const acceptAiCover = () => acceptCover('ai');
  const declineAiCover = () => declineCover('ai');
  const acceptLabCover = () => acceptCover('lab');
  const declineLabCover = () => declineCover('lab');

  // Safeguard 4 & 5: Tie BOTH acceptance records to exact active incident ID and backend decision ID.
  // In live mode, null decision IDs must NEVER count as valid acceptance.
  const activeDecId =
    backendDecisionId ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('tars_decision_id')
      ? Number(localStorage.getItem('tars_decision_id'))
      : null);

  const activeIncId =
    backendIncidentId ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('tars_incident_id')
      ? Number(localStorage.getItem('tars_incident_id'))
      : null);

  const isLiveDecisionValid =
    backendMode === 'live' && backendStatus === 'connected'
      ? (activeDecId !== null &&
         simulatedCoverState.decisionId === activeDecId &&
         activeIncId !== null &&
         simulatedCoverState.incidentId === activeIncId)
      : true;

  const aiCovered =
    hasActiveLeave &&
    isLiveDecisionValid &&
    simulatedCoverState.aiStatus === 'accepted';

  // Safeguard 5 & 6: Active leave alone NEVER counts as lab coverage. Geetha must explicitly accept.
  const labCovered =
    hasActiveLeave &&
    isLiveDecisionValid &&
    simulatedCoverState.labStatus === 'accepted';

  const setSimStep = (step: number) => {
    if (backendStatus === 'connected' && backendMode === 'live') {
      // In live mode, simulation step changes must not grant live approval
      setSimStepState(step);
      return;
    }
    try {
      localStorage.setItem('tars_sim_step', step.toString());
      if (step >= 4) {
        localStorage.setItem('tars_hod_approved', 'true');
        setHodApprovedState(true);
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        localStorage.setItem('tars_hod_approval_time', time);
        setHodApprovalTime(time);
        localStorage.setItem('tars_student_notified', 'true');
        setStudentNotified(true);
      }
    } catch {
      // ignore
    }
    setSimStepState(step);
  };

  const advanceSimulation = () => {
    const next = simStep === 2 ? 3 : 4;
    setSimStep(next);
  };

  const resetSimulation = () => {
    setSimStep(2);
    setHodApprovedState(false);
    setHodApprovalTime(null);
    setStudentNotified(false);
    try {
      localStorage.removeItem('tars_hod_approved');
      localStorage.removeItem('tars_hod_approval_time');
      localStorage.removeItem('tars_student_notified');
      localStorage.removeItem('tars_simulated_cover_acceptance');
    } catch {
      // ignore
    }
    setSimulatedCoverState({
      decisionId: null,
      incidentId: null,
      aiStatus: 'pending',
      labStatus: 'pending',
      timestamp: null,
      label: 'Simulated acceptance — Telegram not connected',
    });
    refreshTimetable();
  };

  const applyLeave = async (date?: string, type?: string, reason?: string) => {
    const d = date || 'Thursday, 3 Dec 2026';
    const t = type || 'Medical Leave';
    const r = reason || 'High fever and viral infection';

    // Ensure we have a valid bearer token for F_CDB before calling live incident creation
    await loginForRole('faculty', 'F_CDB');

    // Call api.leave.applyLeave to attempt live backend POST /api/incidents
    const res = await api.leave.applyLeave({ date: d, type: t, reason: r });
    if (res && res.decision_id) {
      setBackendStatus('connected');
      setBackendMode('live');
      setBackendIncidentId(res.incident_id || null);
      setBackendDecisionId(res.decision_id);
      setHasActiveLeaveState(true);
      setLeaveDate(d);
      setLeaveType(t);
      setLeaveReason(r);
      setSimStepState(2);
      setHodApprovedState(false);
      setHodApprovalTime(null);
      setStudentNotified(false);

      setSimulatedCoverState({
        decisionId: res.decision_id,
        incidentId: res.incident_id || null,
        aiStatus: 'pending',
        labStatus: 'pending',
        timestamp: null,
        label: 'Simulated acceptance — Telegram not connected',
      });

      try {
        localStorage.setItem('tars_has_leave', 'true');
        localStorage.setItem('tars_leave_date', d);
        localStorage.setItem('tars_leave_type', t);
        localStorage.setItem('tars_leave_reason', r);
        localStorage.setItem('tars_sim_step', '2');
        localStorage.setItem('tars_decision_id', res.decision_id.toString());
        if (res.incident_id) {
          localStorage.setItem('tars_incident_id', res.incident_id.toString());
        }
        localStorage.removeItem('tars_hod_approved');
        localStorage.removeItem('tars_hod_approval_time');
        localStorage.removeItem('tars_student_notified');
      } catch {
        // ignore
      }
      return res;
    } else if (backendMode === 'offline_demo' || import.meta.env.VITE_USE_MOCK !== 'false') {
      setHasActiveLeaveState(true);
      setLeaveDate(d);
      setLeaveType(t);
      setLeaveReason(r);
      setSimStepState(2);
      setHodApprovedState(false);
      setHodApprovalTime(null);
      setStudentNotified(false);
      return res;
    } else {
      throw new Error('Leave submission failed: Backend did not return a valid decision ID');
    }
  };

  const cancelLeave = () => {
    setHasActiveLeaveState(false);
    setSimStepState(2);
    setHodApprovedState(false);
    setHodApprovalTime(null);
    setStudentNotified(false);
    setBackendIncidentId(null);
    setBackendDecisionId(null);
    setSimulatedCoverState({
      decisionId: null,
      incidentId: null,
      aiStatus: 'pending',
      labStatus: 'pending',
      timestamp: null,
      label: 'Simulated acceptance — Telegram not connected',
    });
    try {
      localStorage.removeItem('tars_has_leave');
      localStorage.removeItem('tars_leave_date');
      localStorage.removeItem('tars_leave_type');
      localStorage.removeItem('tars_leave_reason');
      localStorage.removeItem('tars_sim_step');
      localStorage.removeItem('tars_hod_approved');
      localStorage.removeItem('tars_hod_approval_time');
      localStorage.removeItem('tars_student_notified');
      localStorage.removeItem('tars_simulated_cover_acceptance');
      localStorage.removeItem('tars_incident_id');
      localStorage.removeItem('tars_decision_id');
    } catch {
      // ignore
    }
    refreshTimetable();
  };

  const approveHod = async (decisionId?: number | string, note?: string) => {
    let targetId = decisionId ? Number(decisionId) : (backendDecisionId || (typeof localStorage !== 'undefined' ? Number(localStorage.getItem('tars_decision_id')) : null));
    if (!targetId) {
      throw new Error('Cannot approve: No valid backend decision ID provided.');
    }

    if (backendStatus === 'connected' && backendMode === 'live') {
      await loginForRole('hod');
      const res = await api.approvals.approve(targetId);
      if (res.success) {
        setHodApprovedState(true);
        setSimStepState(4);
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setHodApprovalTime(time);
        setStudentNotified(true);
        try {
          localStorage.setItem('tars_hod_approved', 'true');
          localStorage.setItem('tars_sim_step', '4');
          localStorage.setItem('tars_hod_approval_time', time);
          localStorage.setItem('tars_student_notified', 'true');
        } catch {
          // ignore
        }
        await refreshTimetable();
        return;
      }
      throw new Error(`Approval failed for decision ${targetId}`);
    }

    // Offline demo fallback only
    setHodApprovedState(true);
    setSimStepState(4);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setHodApprovalTime(time);
    setStudentNotified(true);
    try {
      localStorage.setItem('tars_hod_approved', 'true');
      localStorage.setItem('tars_sim_step', '4');
      localStorage.setItem('tars_hod_approval_time', time);
      localStorage.setItem('tars_student_notified', 'true');
      if (note) localStorage.setItem('tars_hod_note', note);
    } catch {
      // ignore
    }
    await refreshTimetable();
  };

  const rejectHod = async (decisionId?: number | string, note?: string) => {
    let targetId = decisionId ? Number(decisionId) : (backendDecisionId || (typeof localStorage !== 'undefined' ? Number(localStorage.getItem('tars_decision_id')) : null));
    if (!targetId) {
      throw new Error('Cannot reject: No valid backend decision ID provided.');
    }

    if (backendStatus === 'connected' && backendMode === 'live') {
      await loginForRole('hod');
      const res = await api.approvals.reject(targetId);
      if (res.success) {
        setHasActiveLeaveState(false);
        setHodApprovedState(false);
        setBackendDecisionId(null);
        setBackendIncidentId(null);
        try {
          localStorage.removeItem('tars_has_leave');
          localStorage.removeItem('tars_hod_approved');
          localStorage.removeItem('tars_decision_id');
          localStorage.removeItem('tars_incident_id');
        } catch {
          // ignore
        }
        await refreshTimetable();
        return;
      }
      throw new Error(`Rejection failed for decision ${targetId}`);
    }

    // Offline demo fallback only
    setHasActiveLeaveState(false);
    setHodApprovedState(false);
    try {
      localStorage.removeItem('tars_has_leave');
      localStorage.setItem('tars_hod_approved', 'false');
      localStorage.removeItem('tars_hod_approval_time');
      if (note) localStorage.setItem('tars_hod_note', note);
    } catch {
      // ignore
    }
    await refreshTimetable();
  };

  const resetDemo = async (): Promise<boolean> => {
    await loginForRole('hod');
    const res = await api.admin.resetDemo();
    if (res && (res.status === 'reset' || res.status === 'ok')) {
      setHasActiveLeaveState(false);
      setHodApprovedState(false);
      setBackendDecisionId(null);
      setBackendIncidentId(null);
      setStudentNotified(false);
      setSimulatedCoverState({
        decisionId: null,
        incidentId: null,
        aiStatus: 'pending',
        labStatus: 'pending',
        timestamp: null,
        label: 'Simulated acceptance — Telegram not connected',
      });
      try {
        localStorage.removeItem('tars_has_leave');
        localStorage.removeItem('tars_hod_approved');
        localStorage.removeItem('tars_decision_id');
        localStorage.removeItem('tars_incident_id');
        localStorage.removeItem('tars_simulated_cover_acceptance');
        localStorage.removeItem('tars_hod_approval_time');
      } catch {
        // ignore
      }
      await refreshTimetable();
      return true;
    }
    throw new Error('Demo reset failed on backend');
  };

  // Admin state
  const [incidentText, setIncidentText] = useState('Dr. Rao absent tomorrow (21 Nov) due to medical leave');
  const [reasoningLogs, setReasoningLogs] = useState<ReasoningLog[]>(initialLogs);
  const [isReplanRunning, setIsReplanRunning] = useState(false);
  const [relocationDiff, setRelocationDiff] = useState<RelocationDiff>(initialDiff);
  const [facultyNudgeTriggered, setFacultyNudgeTriggered] = useState(false);
  const [kpiStats, setKpiStats] = useState({
    autoReplans: 38,
    classesLost: 0,
    nudgesActedOn: 212,
    recoveredAtt: 17,
  });

  const unreadNudgesCount = useMemo(() => {
    return nudges.filter((n) => n.status === 'pending').length;
  }, [nudges]);

  const dismissAutonomousBanner = () => {
    setAutonomousScheduleBannerVisible(false);
  };

  const acceptAutonomousBanner = () => {
    setAutonomousScheduleBannerVisible(false);
    // Lock the 10:00-11:00 study block on Today's timeline
    setTimelineItems((prev) =>
      prev.map((item) =>
        item.id === 'tl-2'
          ? { ...item, status: 'Confirmed', isLocked: true, subtitle: 'Locked: Self Balancing Trees Study Block' }
          : item,
      ),
    );
    // Also resolve Nudge #1
    setNudges((prev) =>
      prev.map((n) => (n.id === 'nudge-1' ? { ...n, status: 'blocked' } : n)),
    );
  };

  const acceptTimelineSlot = (id: string) => {
    setTimelineItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: 'Confirmed', isLocked: true, subtitle: 'Locked & Confirmed on Calendar' }
          : item,
      ),
    );
  };

  const handleNudgeAction = (id: string, action: 'block' | 'snooze' | 'done') => {
    setNudges((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          if (action === 'block') {
            // Also lock study block
            acceptTimelineSlot('tl-2');
            return { ...n, status: 'blocked' };
          }
          if (action === 'snooze') return { ...n, status: 'snoozed' };
          if (action === 'done') return { ...n, status: 'completed' };
        }
        return n;
      }),
    );
  };

  const rsvpEvent = (id: string) => {
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id === id) {
          const nextStatus = ev.rsvpStatus === 'rsvpd' ? 'none' : 'rsvpd';
          return {
            ...ev,
            rsvpStatus: nextStatus,
            actionLabel: nextStatus === 'rsvpd' ? 'Attending ✓' : 'RSVP to Workshop',
          };
        }
        return ev;
      }),
    );
  };

  const triggerTarsReplan = (customIncident?: string) => {
    const textToRun = customIncident || incidentText;
    setIsReplanRunning(true);
    setReasoningLogs([]);

    const steps: { tag: ReasoningLog['tag']; message: string; delay: number }[] = [
      {
        tag: 'SIGNAL',
        message: `Ingested incident trigger: "${textToRun}". Webhook priority high.`,
        delay: 200,
      },
      {
        tag: 'GRAPH',
        message: 'Traversing campus schedule DAG: Identified 2 conflicting lecture blocks in CSE section A & B.',
        delay: 700,
      },
      {
        tag: 'HEURISTIC',
        message: 'Scanning faculty workload heuristic index... Selected Dr. Menon (Current load: 12 hrs/wk - lowest in Dept).',
        delay: 1300,
      },
      {
        tag: 'CONSTRAINT',
        message: 'Evaluating Room 504 allocation. Room 302 projector fault confirmed. Constraint solver solved 14 parameters.',
        delay: 1900,
      },
      {
        tag: 'CONFLICT',
        message: '0 student elective collisions detected. Digital signage and timetable sync lock acquired.',
        delay: 2500,
      },
      {
        tag: 'DISPATCH',
        message: 'Dispatched automated timetable diffs to 124 students and mobile push notifications via MessageQueue.',
        delay: 3100,
      },
      {
        tag: 'ESCALATION',
        message: 'Status: Awaiting student/faculty acknowledgement. Auto-escalation watchdog armed: Escalates to HOD Dr. V. Sharma in 30:00 min.',
        delay: 3600,
      },
      {
        tag: 'IDLE',
        message: '[AUTONOMOUS AGENT IDLE - LISTENING ON WEBHOOKS...]',
        delay: 4000,
      },
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
        setReasoningLogs((prev) => [
          ...prev,
          {
            id: `log-${Date.now()}-${index}`,
            timestamp: timeStr,
            tag: step.tag,
            message: step.message,
          },
        ]);

        if (index === steps.length - 1) {
          setIsReplanRunning(false);
          // Increment Auto Re-plans KPI
          setKpiStats((prev) => ({ ...prev, autoReplans: prev.autoReplans + 1 }));
          // Ensure Today's autonomous banner is active
          setAutonomousScheduleBannerVisible(true);
          setRelocationDiff({
            original: {
              time: '10:00 – 11:30 AM',
              statusBadge: 'CANCELLED',
              course: 'Data Structures & Algorithms',
              faculty: textToRun.includes('Dr. Rao') ? 'Dr. K. Rao (Medical Leave)' : 'Faculty Lead (Incident)',
              room: 'Room 302',
            },
            optimized: {
              time: '14:00 – 15:30 PM',
              statusBadge: 'RESCHEDULED',
              routedBadge: 'TARS ROUTED',
              course: 'Data Structures & Algorithms',
              faculty: 'Dr. Menon (Stand-in)',
              room: 'Room 504 Confirmed',
            },
          });
          setScheduleSlots((prev) =>
            prev.map((s) =>
              s.id === 's-9'
                ? { ...s, status: 're-planned', subject: 'DS Study Block', note: 'Freed slot' }
                : s.id === 's-24'
                ? { ...s, status: 're-planned', subject: 'Data Structures', faculty: 'Dr. Menon (Sub)', room: 'North Block Rm 504' }
                : s,
            ),
          );
        }
      }, step.delay);
    });
  };

  const nudgeAllFaculty = () => {
    setFacultyNudgeTriggered(true);
    setKpiStats((prev) => ({ ...prev, nudgesActedOn: prev.nudgesActedOn + 5 }));
  };

  return (
    <TarsContext.Provider
      value={{
        role,
        setRole,
        currentView,
        setCurrentView,
        unreadNudgesCount,
        autonomousScheduleBannerVisible,
        dismissAutonomousBanner,
        acceptAutonomousBanner,
        timelineItems,
        acceptTimelineSlot,
        attendanceCourses,
        nudges,
        selectedNudgeId,
        setSelectedNudgeId,
        handleNudgeAction,
        events,
        radarEvents,
        rsvpEvent,
        scheduleSlots,
        facultyStatuses,
        roomStatuses,
        liveTimetable,
        timetableStatus,
        refreshTimetable,
        incidentText,
        setIncidentText,
        reasoningLogs,
        isReplanRunning,
        relocationDiff,
        triggerTarsReplan,
        nudgeAllFaculty,
        facultyNudgeTriggered,
        kpiStats,
        hasActiveLeave,
        leaveDate,
        leaveType,
        leaveReason,
        labCovered,
        aiCovered,
        hodApproved,
        hodApprovalTime,
        studentNotified,
        simStep,
        applyLeave,
        cancelLeave,
        setSimStep,
        advanceSimulation,
        resetSimulation,
        approveHod,
        rejectHod,
        resetDemo,
        activeFacultyId,
        setActiveFacultyId,
        simulatedCoverStatus: simulatedCoverState.aiStatus,
        simulatedCoverDecisionId: simulatedCoverState.decisionId,
        simulatedAiStatus: simulatedCoverState.aiStatus,
        simulatedLabStatus: simulatedCoverState.labStatus,
        acceptSubstituteCover,
        declineSubstituteCover,
        acceptAiCover,
        declineAiCover,
        acceptLabCover,
        declineLabCover,
        backendStatus,
        backendMode,
        backendIncidentId,
        backendDecisionId,
      }}
    >
      {children}
    </TarsContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTars = () => {
  const context = useContext(TarsContext);
  if (!context) {
    throw new Error('useTars must be used within a TarsProvider');
  }
  return context;
};
