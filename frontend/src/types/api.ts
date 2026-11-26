/**
 * Shared API Contract Types for TARS
 *
 * Source of truth for frontend components and backend services.
 * Covers: Auth, Leave & Substitutes, Approvals, Decisions (XAI),
 * Timetable/Schedule, Inbox, NPTEL accreditation, Events, and Insights.
 */

export type Role = 'student' | 'faculty' | 'hod';

export interface User {
  id?: string;
  user_id?: string;
  login_id: string;
  name: string;
  role: Role;
  section?: string | null;
  department?: string;
  designation?: string;
  code?: string;
  usn?: string | null;
  email?: string;
  avatar_url?: string;
}

export interface AuthResponse {
  token: string;
  token_type: string;
  expires_at: string;
  user: User;
}

export interface StreamTicket {
  ticket: string;
  expires_at: string;
}

// ==========================================
// 1. Leave & Substitutes Flow (P0 Core Demo)
// ==========================================

export interface LeaveClass {
  slot_id: number;
  subject_code: string;
  subject_name: string;
  section: string;
  room: string;
  period: number | string;
  time?: string;
  outcome?: 'covered' | 'pending' | 'rescheduled' | 'cancelled';
  substitute_id?: string;
  substitute_name?: string;
}

export interface LeaveStep {
  title: string;
  detail: string;
  status: 'done' | 'in_progress' | 'pending' | 'failed';
  at: string;
}

export interface Leave {
  id: string | number;
  faculty_id: string;
  faculty_name: string;
  date: string;
  type: string; // e.g. "casual" | "sick" | "duty"
  reason: string;
  status: 'draft' | 'finding_substitutes' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
  classes: LeaveClass[];
  steps?: LeaveStep[];
  created_at: string;
  updated_at?: string;
}

export interface CreateLeavePayload {
  date: string;
  type: string;
  reason: string;
}

export interface CoverRequest {
  id: string | number;
  leave_id: string | number;
  slot_id: number;
  requester_id: string;
  requester_name: string;
  date: string;
  period: number | string;
  time: string;
  subject_code: string;
  subject_name: string;
  section: string;
  room: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
}

// ==========================================
// 2. Approvals (HOD)
// ==========================================

export interface Approval {
  id: string | number;
  leave_id: string | number;
  faculty_id: string;
  faculty_name: string;
  date: string;
  reason: string;
  classes_count: number;
  substitutes_summary: string;
  reasoning: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  classes?: LeaveClass[];
  decision_id?: string | number;
}

// ==========================================
// 3. Decisions & Explainability (XAI)
// ==========================================

export interface DecisionOption {
  teacher_id: string;
  teacher_name: string;
  free: boolean;
  can_teach: boolean;
  load: number;
  result: 'accepted' | 'declined' | 'rejected' | 'candidate';
  rejection_reason?: string;
}

export interface DecisionRule {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface DecisionStep {
  at: string;
  text: string;
}

export interface Decision {
  id: string | number;
  created_at: string;
  summary: string;
  status: 'proposed' | 'committed' | 'pending_ack' | 'acknowledged' | 'escalated' | 'rejected';
  outcomes?: string[];
  why?: string[];
  options?: DecisionOption[];
  rules?: DecisionRule[];
  steps?: DecisionStep[];
  tool_calls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result: unknown;
  }>;
  affected_slot_ids?: number[];
  calendar_link?: string | null;
}

export interface DecisionStats {
  covered: number;
  avg_seconds_to_cover: number;
  hod_taps_per_leave: number;
  clashes: number;
}

// ==========================================
// 4. Timetable & Schedule
// ==========================================

export interface TimetableSlot {
  id: number;
  day: string;
  period: number | string;
  start: string;
  end: string;
  section: string;
  subject_code: string;
  subject_name: string;
  faculty_id: string;
  faculty_name: string;
  room_id: string;
  status: 'scheduled' | 'replanned' | 'changed' | 'cancelled';
  original_faculty_name?: string;
  change_note?: string;
}

export interface TodayOverview {
  date: string;
  day: string;
  user: User;
  current_period?: TimetableSlot;
  upcoming_periods: TimetableSlot[];
  alerts: Array<{
    id: string;
    type: 'replan' | 'leave' | 'event' | 'nptel';
    title: string;
    detail: string;
    time: string;
  }>;
}

// ==========================================
// 5. Inbox
// ==========================================

export interface InboxItem {
  id: string | number;
  type: 'leave' | 'cover' | 'approval' | 'nptel' | 'event' | 'system';
  source: string;
  title: string;
  detail: string;
  at: string;
  unread: boolean;
  action?: {
    label: string;
    href?: string;
    action_type?: string;
    payload?: unknown;
  };
}

// ==========================================
// 6. NPTEL Accreditation Collector
// ==========================================

export interface NptelRequest {
  id: string | number;
  faculty_id: string;
  faculty_name: string;
  title: string;
  item: string;
  sections: string[];
  due_date: string;
  total_students: number;
  submitted_count: number;
  verified_count: number;
  flagged_count: number;
  created_at: string;
}

export interface NptelSubmission {
  id: string | number;
  request_id: string | number;
  student_name: string;
  usn: string;
  section: string;
  course_name: string;
  score: number;
  certificate_id: string;
  status: 'pending' | 'verified' | 'flagged';
  uploaded_at: string;
  file_url?: string;
  flags?: string[];
}

export interface NptelExtraction {
  fields: Array<{
    name: string;
    value: string | number;
    ok: boolean;
    confidence?: number;
  }>;
  status: 'verified' | 'flagged' | 'mismatch';
}

export interface NptelRecommendation {
  course_id: string;
  title: string;
  instructor: string;
  institute: string;
  duration_weeks: number;
  relevance: string;
  match_score: number;
}

// ==========================================
// 7. Campus Events
// ==========================================

export interface EventItem {
  id: string | number;
  title: string;
  description: string;
  category: string;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
  poster_url: string;
  organizer: string;
  bookmarked: boolean;
  registered: boolean;
  clash: boolean;
  clash_detail?: string;
  rsvp_count: number;
}

export interface EventRegistrationPayload {
  event_id: string | number;
  phone: string;
  team_name?: string;
  members?: string[];
  tshirt?: string;
  note?: string;
  add_to_schedule: boolean;
  request_permission: boolean;
}

export interface EventTicket {
  ticket_id: string;
  event_id: string | number;
  event_title: string;
  attendee_name: string;
  usn: string;
  qr_payload: string;
  issued_at: string;
}

// ==========================================
// 8. Department Insights
// ==========================================

export interface DepartmentInsights {
  time_saved_hours: number;
  manual_vs_tars: {
    avg_cover_time_manual_min: number;
    avg_cover_time_tars_sec: number;
    nptel_reminders_manual: number;
    nptel_reminders_tars: number;
  };
  nptel_by_section: Array<{
    section: string;
    compliance_pct: number;
    total: number;
    verified: number;
  }>;
  cover_load_by_faculty: Array<{
    faculty_id: string;
    faculty_name: string;
    assigned_covers: number;
    max_load: number;
  }>;
}
