import React, { createContext, useContext, useState, useMemo } from 'react';
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
  setRole: (role: Role) => void;
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
    subtitle: 'Dr. Menon (Substitute) - B Trees & Indexing architectures',
    location: 'North Block Rm 504',
    status: 'Rescheduled',
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
  { id: 's-9', time: '10:00', day: 'THU', subject: 'DS Study Block', room: 'Reading Rm 3', faculty: 'Self Paced', status: 're-planned', note: 'Freed from Dr. Rao leave' },
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
  { id: 's-24', time: '14:00', day: 'THU', subject: 'Data Structures', room: 'North Block Rm 504', faculty: 'Dr. Menon (Sub)', status: 're-planned', note: 'Moved from 10:00 AM' },
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
  const [role, setRole] = useState<Role>('student');
  const [currentView, setCurrentView] = useState<ViewTab>('today');
  const [autonomousScheduleBannerVisible, setAutonomousScheduleBannerVisible] = useState(true);
  const [timelineItems, setTimelineItems] = useState<TodayTimelineItem[]>(initialTimeline);
  const [nudges, setNudges] = useState<Nudge[]>(initialNudges);
  const [selectedNudgeId, setSelectedNudgeId] = useState<string>('nudge-1');
  const [events, setEvents] = useState<CampusEvent[]>(initialEvents);
  const [radarEvents] = useState<RadarEvent[]>(initialRadar);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleGridSlot[]>(initialScheduleSlots);
  const [facultyStatuses] = useState<FacultyStatus[]>(initialFacultyStatus);
  const [roomStatuses] = useState<RoomStatus[]>(initialRoomStatus);
  const [attendanceCourses] = useState<AttendanceCourse[]>(initialAttendance);

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
        incidentText,
        setIncidentText,
        reasoningLogs,
        isReplanRunning,
        relocationDiff,
        triggerTarsReplan,
        nudgeAllFaculty,
        facultyNudgeTriggered,
        kpiStats,
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
