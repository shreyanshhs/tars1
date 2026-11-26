export type Role = 'student' | 'faculty' | 'hod';

export type ViewTab =
  | 'home'
  | 'today'
  | 'inbox'
  | 'schedule'
  | 'leave'
  | 'cover'
  | 'approvals'
  | 'nptel'
  | 'events'
  | 'activity'
  | 'insights'
  | 'classes'
  | 'attendance'
  | 'admin'
  | 'nudges'
  | 'help'
  | 'settings'
  | 'meet';

export type NudgeCategory = 'DEADLINE' | 'ATTENDANCE' | 'PACING';

export type NudgeStatus = 'pending' | 'blocked' | 'snoozed' | 'completed';

export interface Nudge {
  id: string;
  category: NudgeCategory;
  courseCode: string;
  dueText: string;
  title: string;
  snippet: string;
  headline: string;
  description: string;
  targetSlot: string;
  plan: {
    slotTitle: string;
    slotDesc: string;
    setupTitle: string;
    setupDesc: string;
    sanctuaryTitle: string;
    sanctuaryDesc: string;
  };
  status: NudgeStatus;
}

export type TimelineStatus =
  | 'Completed'
  | 'Free Slot Recommended'
  | 'Flexible'
  | 'Rescheduled'
  | 'Confirmed';

export interface TodayTimelineItem {
  id: string;
  time: string;
  title: string;
  subtitle: string;
  location: string;
  status: TimelineStatus;
  isStudyBlock?: boolean;
  isLocked?: boolean;
}

export interface AttendanceCourse {
  id: string;
  name: string;
  percentage: number;
  thresholdWarning?: string;
}

export interface CampusEvent {
  id: string;
  title: string;
  category: string;
  dateBadge: string;
  time: string;
  location: string;
  clashStatus: 'free' | 'clash' | 'elective';
  clashText: string;
  pool?: string;
  registrationNote?: string;
  rsvpStatus: 'none' | 'rsvpd' | 'waitlisted';
  actionLabel: string;
  bannerGradient: string;
}

export interface RadarEvent {
  id: string;
  datetime: string;
  typeBadge: string;
  title: string;
  location: string;
  actionText: string;
}

export interface ScheduleGridSlot {
  id: string;
  time: string;
  day: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI';
  subject: string;
  room: string;
  faculty: string;
  status?: 'normal' | 're-planned' | 'cancelled';
  note?: string;
}

export interface FacultyStatus {
  name: string;
  location: string;
  note: string;
  status: 'Active' | 'Away' | 'Available' | 'Advising';
}

export interface RoomStatus {
  name: string;
  note: string;
  status: 'In Use' | 'Locked' | 'Available' | 'Reserved';
}

export interface ReasoningLog {
  id: string;
  timestamp: string;
  tag: 'SIGNAL' | 'GRAPH' | 'HEURISTIC' | 'CONSTRAINT' | 'CONFLICT' | 'DISPATCH' | 'ESCALATION' | 'IDLE';
  message: string;
}

export interface RelocationDiff {
  original: {
    time: string;
    statusBadge: string;
    course: string;
    faculty: string;
    room: string;
  };
  optimized: {
    time: string;
    statusBadge: string;
    routedBadge: string;
    course: string;
    faculty: string;
    room: string;
  };
}
