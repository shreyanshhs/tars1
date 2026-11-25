import type {
  User,
  AuthResponse,
  StreamTicket,
  Leave,
  CreateLeavePayload,
  CoverRequest,
  Approval,
  Decision,
  DecisionStats,
  TimetableSlot,
  TodayOverview,
  InboxItem,
  NptelRequest,
  NptelSubmission,
  NptelExtraction,
  NptelRecommendation,
  EventItem,
  EventRegistrationPayload,
  EventTicket,
  DepartmentInsights,
} from '../types/api';

import demoUserFixtures from '../mock/demo_users.json';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

const demoUsers: User[] = demoUserFixtures.map(({ user_id, role, ...profile }) => {
  if (role !== 'student' && role !== 'faculty' && role !== 'hod') {
    throw new Error(`Invalid role for demo user ${user_id}: ${role}`);
  }
  return { ...profile, id: user_id, role };
});

// Token storage helpers
export function getToken(): string | null {
  return localStorage.getItem('tars_token');
}

export function setToken(token: string): void {
  localStorage.setItem('tars_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('tars_token');
  localStorage.removeItem('tars_user');
}

export function getCurrentUser(): User | null {
  const userStr = localStorage.getItem('tars_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User): void {
  localStorage.setItem('tars_user', JSON.stringify(user));
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent('tars:auth-expired'));
    }
    const errText = await response.text();
    throw new Error(errText || `Request failed with status ${response.status}`);
  }

  return response.json();
}

// ==========================================
// Mock In-Memory State
// ==========================================

const mockLeaves: Leave[] = [
  {
    id: 'leave_cdb_001',
    faculty_id: 'F_CDB',
    faculty_name: 'Prof. Chaitra D B',
    date: '2026-12-03',
    type: 'Casual Leave',
    reason: 'Family function & personal commitment',
    status: 'finding_substitutes',
    classes: [
      {
        slot_id: 104,
        subject_code: '1BAI103',
        subject_name: 'Introduction to AI and Applications',
        section: 'CSE-10',
        room: 'SJB-104',
        period: 4,
        time: '11:35 - 12:30',
        outcome: 'pending',
        substitute_id: 'F_SMP',
        substitute_name: 'Mr. Syed Matheen Pasha',
      },
      {
        slot_id: 106,
        subject_code: '1BPLC105B',
        subject_name: 'Python Programming (Lab)',
        section: 'CSE-10',
        room: '511C',
        period: '6-7',
        time: '14:20 - 16:10',
        outcome: 'covered',
        substitute_id: 'F_GPL',
        substitute_name: 'Mrs. Geetha P L',
      },
    ],
    steps: [
      {
        title: 'Leave request registered',
        detail: 'Prof. Chaitra applied for leave on Thu 3 Dec. 2 classes affected.',
        status: 'done',
        at: '10:41 AM',
      },
      {
        title: 'Lab slot covered by co-faculty',
        detail: 'Python lab (P6-P7) offered to Mrs. Geetha P L (co-faculty). Accepted.',
        status: 'done',
        at: '10:42 AM',
      },
      {
        title: 'Intro to AI candidate search',
        detail: 'Mrs. Shabeena Lylath declined (clash with Web Lab). Request forwarded to Mr. Syed Matheen Pasha.',
        status: 'in_progress',
        at: '10:44 AM',
      },
      {
        title: 'HOD approval submission',
        detail: 'Awaiting substitute confirmation before sending single approval card to Dr. Surekha K B.',
        status: 'pending',
        at: 'Pending',
      },
    ],
    created_at: '2026-11-25T10:41:00Z',
  },
];

const mockCoverRequests: CoverRequest[] = [
  {
    id: 'cover_gpl_01',
    leave_id: 'leave_cdb_001',
    slot_id: 106,
    requester_id: 'F_CDB',
    requester_name: 'Prof. Chaitra D B',
    date: '2026-12-03',
    period: '6-7',
    time: '14:20 - 16:10',
    subject_code: '1BPLC105B',
    subject_name: 'Python Programming (Lab)',
    section: 'CSE-10',
    room: '511C',
    status: 'pending',
    created_at: '2026-11-25T10:42:00Z',
  },
];

const mockApprovals: Approval[] = [
  {
    id: 'app_001',
    leave_id: 'leave_cdb_001',
    faculty_id: 'F_CDB',
    faculty_name: 'Prof. Chaitra D B',
    date: '2026-12-03',
    reason: 'Family function & personal commitment',
    classes_count: 2,
    substitutes_summary: '100% Covered (Mrs. Geetha P L & Mr. Syed Matheen Pasha)',
    reasoning: 'Zero clashes detected. Mrs. Geetha co-teaches CSE-10 Python lab (load: 13/18 units). Mr. Matheen Pasha is free on Thu P4 (load: 11/18 units). Section timetable continuity preserved.',
    status: 'pending',
    created_at: '2026-11-25T10:45:00Z',
    classes: [
      {
        slot_id: 104,
        subject_code: '1BAI103',
        subject_name: 'Intro to AI',
        section: 'CSE-10',
        room: 'SJB-104',
        period: 4,
        time: '11:35 - 12:30',
        outcome: 'covered',
        substitute_name: 'Mr. Syed Matheen Pasha',
      },
      {
        slot_id: 106,
        subject_code: '1BPLC105B',
        subject_name: 'Python Lab',
        section: 'CSE-10',
        room: '511C',
        period: '6-7',
        time: '14:20 - 16:10',
        outcome: 'covered',
        substitute_name: 'Mrs. Geetha P L',
      },
    ],
  },
];

// ==========================================
// Service API Exports
// ==========================================

export const api = {
  // Auth
  auth: {
    async getDemoUsers(): Promise<User[]> {
      if (USE_MOCK) {
        return demoUsers;
      }
      return request<User[]>('/auth/demo-users');
    },

    async login(login_id: string, _password?: string): Promise<AuthResponse> {
      if (USE_MOCK) {
        const user = demoUsers.find((u) => u.login_id === login_id) || {
          id: 'S0274',
          login_id: 'shreyansh',
          name: 'Shreyansh',
          role: 'student' as const,
          section: 'CSE-10',
        };
        const mockResponse: AuthResponse = {
          token: `mock_token_${user.id}_${Date.now()}`,
          token_type: 'Bearer',
          expires_at: new Date(Date.now() + 43200000).toISOString(),
          user,
        };
        setToken(mockResponse.token);
        setCurrentUser(user);
        return mockResponse;
      }
      const res = await request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login_id, password: _password || 'demo' }),
      });
      setToken(res.token);
      setCurrentUser(res.user);
      return res;
    },

    async logout(): Promise<void> {
      if (!USE_MOCK) {
        try {
          await request('/auth/logout', { method: 'POST' });
        } catch {
          // ignore logout errors
        }
      }
      clearToken();
    },

    async getStreamTicket(): Promise<StreamTicket> {
      if (USE_MOCK) {
        return {
          ticket: `mock_ticket_${Date.now()}`,
          expires_at: new Date(Date.now() + 60000).toISOString(),
        };
      }
      return request<StreamTicket>('/auth/stream-ticket', { method: 'POST' });
    },
  },

  // Leave Flow
  leave: {
    async applyLeave(payload: CreateLeavePayload): Promise<Leave> {
      if (USE_MOCK) {
        const user = getCurrentUser();
        const newLeave: Leave = {
          id: `leave_${Date.now()}`,
          faculty_id: user?.id || 'F_CDB',
          faculty_name: user?.name || 'Prof. Chaitra D B',
          date: payload.date,
          type: payload.type,
          reason: payload.reason,
          status: 'finding_substitutes',
          classes: [
            {
              slot_id: 104,
              subject_code: '1BAI103',
              subject_name: 'Introduction to AI and Applications',
              section: 'CSE-10',
              room: 'SJB-104',
              period: 4,
              time: '11:35 - 12:30',
              outcome: 'pending',
              substitute_id: 'F_SMP',
              substitute_name: 'Mr. Syed Matheen Pasha',
            },
            {
              slot_id: 106,
              subject_code: '1BPLC105B',
              subject_name: 'Python Programming (Lab)',
              section: 'CSE-10',
              room: '511C',
              period: '6-7',
              time: '14:20 - 16:10',
              outcome: 'covered',
              substitute_id: 'F_GPL',
              substitute_name: 'Mrs. Geetha P L',
            },
          ],
          steps: [
            {
              title: 'Leave request registered',
              detail: `Leave on ${payload.date} logged. TARS identified 2 classes requiring cover.`,
              status: 'done',
              at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
            {
              title: 'Co-faculty priority lookup',
              detail: 'Checking Mrs. Geetha P L for CSE-10 Python Lab. Zero timetable clash found.',
              status: 'in_progress',
              at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ],
          created_at: new Date().toISOString(),
        };
        mockLeaves.unshift(newLeave);
        return newLeave;
      }
      return request<Leave>('/leave', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async getMyLeaves(): Promise<Leave[]> {
      if (USE_MOCK) {
        return mockLeaves;
      }
      return request<Leave[]>('/leave?mine=1');
    },

    async getLeave(id: string | number): Promise<Leave> {
      if (USE_MOCK) {
        return mockLeaves.find((l) => l.id.toString() === id.toString()) || mockLeaves[0];
      }
      return request<Leave>(`/leave/${id}`);
    },
  },

  // Cover Requests
  cover: {
    async getMyCoverRequests(): Promise<CoverRequest[]> {
      if (USE_MOCK) {
        return mockCoverRequests;
      }
      return request<CoverRequest[]>('/cover-requests?mine=1');
    },

    async acceptCover(id: string | number): Promise<{ success: boolean }> {
      if (USE_MOCK) {
        const item = mockCoverRequests.find((c) => c.id.toString() === id.toString());
        if (item) item.status = 'accepted';
        return { success: true };
      }
      return request<{ success: boolean }>(`/cover-requests/${id}/accept`, { method: 'POST' });
    },

    async declineCover(id: string | number): Promise<{ success: boolean }> {
      if (USE_MOCK) {
        const item = mockCoverRequests.find((c) => c.id.toString() === id.toString());
        if (item) item.status = 'declined';
        return { success: true };
      }
      return request<{ success: boolean }>(`/cover-requests/${id}/decline`, { method: 'POST' });
    },
  },

  // Approvals (HOD)
  approvals: {
    async getApprovals(): Promise<Approval[]> {
      if (USE_MOCK) {
        return mockApprovals;
      }
      return request<Approval[]>('/approvals');
    },

    async approve(id: string | number, note?: string): Promise<{ success: boolean }> {
      if (USE_MOCK) {
        const item = mockApprovals.find((a) => a.id.toString() === id.toString());
        if (item) item.status = 'approved';
        return { success: true };
      }
      return request<{ success: boolean }>(`/approvals/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
    },

    async reject(id: string | number, note?: string): Promise<{ success: boolean }> {
      if (USE_MOCK) {
        const item = mockApprovals.find((a) => a.id.toString() === id.toString());
        if (item) item.status = 'rejected';
        return { success: true };
      }
      return request<{ success: boolean }>(`/approvals/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
    },
  },

  // Decisions & XAI
  decisions: {
    async getDecisions(range: 'today' | '7d' | 'semester' = 'today'): Promise<Decision[]> {
      if (USE_MOCK) {
        return [
          {
            id: 'dec_001',
            created_at: '2026-11-25T10:44:00Z',
            summary: 'Prof. Chaitra D B leave: CSE-10 AI (Thu P4) assigned to Mr. Syed Matheen Pasha; Python Lab (Thu P6-P7) assigned to Mrs. Geetha P L',
            status: 'committed',
            outcomes: [
              'Intro to AI assigned to Mr. Syed Matheen Pasha (free, qualified)',
              'Python Programming Lab assigned to Mrs. Geetha P L (co-faculty, free)',
              'Zero room or timetable clashes created',
            ],
            why: [
              'Mrs. Geetha co-teaches the Python lab every Thursday, minimizing instructional disruption.',
              'Mrs. Shabeena Lylath was considered first for Intro to AI but declined due to an existing Web Lab slot.',
              'Mr. Syed Matheen Pasha has lowest current teaching load (11/18 units) and verified subject proficiency.',
            ],
            options: [
              { teacher_id: 'F_GPL', teacher_name: 'Mrs. Geetha P L', free: true, can_teach: true, load: 13, result: 'accepted' },
              { teacher_id: 'F_SDB', teacher_name: 'Mrs. Shabeena Lylath', free: false, can_teach: true, load: 14, result: 'declined', rejection_reason: 'Timetable clash with BCSL504 Lab' },
              { teacher_id: 'F_SMP', teacher_name: 'Mr. Syed Matheen Pasha', free: true, can_teach: true, load: 11, result: 'accepted' },
            ],
            rules: [
              { name: 'No double-booking for sections or faculty', ok: true, detail: 'Checked across all 5 sections' },
              { name: 'Respect 1st-year lunch period (1:25 PM - 2:20 PM)', ok: true, detail: 'P5 preserved as class slot' },
              { name: 'Preserve lab 2-hour consecutive block integrity', ok: true, detail: 'P6-P7 kept paired' },
              { name: 'Teacher on leave never assigned on leave day', ok: true, detail: 'Prof. Chaitra free all day' },
            ],
            steps: [
              { at: '10:41:02', text: 'Perceived leave request: Prof. Chaitra D B on Thu 3 Dec.' },
              { at: '10:41:05', text: 'Queried BMSIT timetable database: 2 affected slots identified.' },
              { at: '10:41:10', text: 'Checked lab co-faculty roster: Mrs. Geetha P L identified for P6-P7.' },
              { at: '10:42:15', text: 'Mrs. Geetha accepted cover for Python Lab.' },
              { at: '10:42:30', text: 'Substituted candidate evaluation for Intro to AI: Mrs. Shabeena declined.' },
              { at: '10:43:00', text: 'Fallback candidate Mr. Syed Matheen Pasha notified; accepted.' },
              { at: '10:44:00', text: 'Validated complete resolution against conflict validator: 0 errors.' },
              { at: '10:45:00', text: 'Sent consolidated approval card to HOD Dr. Surekha K B.' },
            ],
          },
        ];
      }
      return request<Decision[]>(`/decisions?range=${range}`);
    },

    async getStats(): Promise<DecisionStats> {
      if (USE_MOCK) {
        return {
          covered: 12,
          avg_seconds_to_cover: 84,
          hod_taps_per_leave: 1,
          clashes: 0,
        };
      }
      return request<DecisionStats>('/decisions/stats');
    },
  },

  // Schedule & Timetable
  schedule: {
    async getTimetable(section = 'CSE-10', week?: string): Promise<TimetableSlot[]> {
      if (USE_MOCK) {
        return [
          { id: 1, day: 'THU', period: 1, start: '08:30', end: '09:25', section, subject_code: '1BCHECS102', subject_name: 'Chemistry', faculty_id: 'F_UB', faculty_name: 'Dr. Udayabhanu', room_id: 'SJB-104', status: 'scheduled' },
          { id: 2, day: 'THU', period: 2, start: '09:25', end: '10:20', section, subject_code: '1BIC107', subject_name: 'Indian Constitution (ICO)', faculty_id: 'F_ICO', faculty_name: 'Prof. Ramesh', room_id: 'SJB-104', status: 'scheduled' },
          { id: 3, day: 'THU', period: 3, start: '10:40', end: '11:35', section, subject_code: 'MAT-TP', subject_name: 'Maths Tutorial (MATLAB)', faculty_id: 'F_MAT', faculty_name: 'Dr. Sreegowrav', room_id: 'Shakuntala Devi Lab', status: 'scheduled' },
          { id: 4, day: 'THU', period: 4, start: '11:35', end: '12:30', section, subject_code: '1BAI103', subject_name: 'Intro to AI', faculty_id: 'F_SMP', faculty_name: 'Mr. Syed Matheen Pasha', original_faculty_name: 'Prof. Chaitra D B', room_id: 'SJB-104', status: 'changed', change_note: 'Covered by Mr. Syed Matheen Pasha (TARS approved)' },
          { id: 5, day: 'THU', period: 5, start: '12:30', end: '13:25', section, subject_code: '1BPLC105B', subject_name: 'Python Theory', faculty_id: 'F_GPL', faculty_name: 'Mrs. Geetha P L', room_id: 'SJB-104', status: 'scheduled' },
          { id: 6, day: 'THU', period: '6-7', start: '14:20', end: '16:10', section, subject_code: '1BPLC105B', subject_name: 'Python Lab', faculty_id: 'F_GPL', faculty_name: 'Mrs. Geetha P L', original_faculty_name: 'Prof. Chaitra D B', room_id: '511C', status: 'changed', change_note: 'Covered by Mrs. Geetha P L (co-faculty)' },
        ];
      }
      return request<TimetableSlot[]>(`/timetable?section=${section}${week ? `&week=${week}` : ''}`);
    },

    async getMyToday(): Promise<TodayOverview> {
      const user = getCurrentUser() || demoUsers[0];
      const scheduleSlots = await api.schedule.getTimetable(user.section || 'CSE-10');
      return {
        date: '2026-12-03',
        day: 'THU',
        user,
        current_period: scheduleSlots[2],
        upcoming_periods: scheduleSlots.slice(3),
        alerts: [
          {
            id: 'alt_1',
            type: 'replan',
            title: 'Schedule Updated by TARS',
            detail: 'P4 Intro to AI will be taken by Mr. Syed Matheen Pasha today.',
            time: '10:45 AM',
          },
        ],
      };
    },
  },

  // Inbox
  inbox: {
    async getInbox(): Promise<InboxItem[]> {
      if (USE_MOCK) {
        return [
          {
            id: 'inbox_1',
            type: 'cover',
            source: 'TARS Agent',
            title: 'Cover request: Python Lab (CSE-10)',
            detail: 'Prof. Chaitra requested cover for Thu 3 Dec P6-P7 in Room 511C.',
            at: '10:42 AM',
            unread: true,
            action: { label: 'Review Request', href: '/cover' },
          },
          {
            id: 'inbox_2',
            type: 'approval',
            source: 'Leave Workflow',
            title: 'Leave approved: Prof. Chaitra D B',
            detail: 'Dr. Surekha approved 1-day casual leave. Timetables updated.',
            at: '10:50 AM',
            unread: false,
          },
          {
            id: 'inbox_3',
            type: 'nptel',
            source: 'NAAC/NBA Portal',
            title: 'NPTEL Submission Deadline Approaching',
            detail: 'CSE-10: 14 students pending certificate uploads. Auto-nudge scheduled.',
            at: 'Yesterday',
            unread: false,
          },
        ];
      }
      return request<InboxItem[]>('/inbox');
    },
  },

  // NPTEL Accreditation
  nptel: {
    async getRequests(): Promise<NptelRequest[]> {
      if (USE_MOCK) {
        return [
          {
            id: 'nptel_req_01',
            faculty_id: 'F_CDB',
            faculty_name: 'Prof. Chaitra D B',
            title: '1st Year Python & AI Certifications',
            item: 'NPTEL Elite Certificate',
            sections: ['CSE-10', 'CSE-11', 'CSE-12'],
            due_date: '2026-12-15',
            total_students: 88,
            submitted_count: 74,
            verified_count: 68,
            flagged_count: 6,
            created_at: '2026-11-20T09:00:00Z',
          },
        ];
      }
      return request<NptelRequest[]>('/nptel/requests');
    },

    async getSubmissions(requestId: string | number, status?: string): Promise<NptelSubmission[]> {
      if (USE_MOCK) {
        const subs: NptelSubmission[] = [
          { id: 'sub_1', request_id: requestId, student_name: 'Shreyansh', usn: '26UG1BYCS0274-T', section: 'CSE-10', course_name: 'The Joy of Computing using Python', score: 88, certificate_id: 'NPTEL26CS94S1029', status: 'verified', uploaded_at: '2026-11-24T14:30:00Z' },
          { id: 'sub_2', request_id: requestId, student_name: 'Ananya Sharma', usn: '26UG1BYCS0012-T', section: 'CSE-10', course_name: 'Introduction to Machine Learning', score: 92, certificate_id: 'NPTEL26CS88S4411', status: 'verified', uploaded_at: '2026-11-24T15:10:00Z' },
          { id: 'sub_3', request_id: requestId, student_name: 'Karthik Rao', usn: '26UG1BYCS0089-T', section: 'CSE-10', course_name: 'Database Management Systems', score: 54, certificate_id: 'NPTEL26CS12S9901', status: 'flagged', flags: ['Name mismatch with Contineo profile', 'Score below department honours threshold'], uploaded_at: '2026-11-24T16:00:00Z' },
        ];
        if (status) return subs.filter((s) => s.status === status);
        return subs;
      }
      return request<NptelSubmission[]>(`/nptel/requests/${requestId}/submissions${status ? `?status=${status}` : ''}`);
    },

    async uploadCertificate(_requestId: string | number, _file: File): Promise<NptelExtraction> {
      if (USE_MOCK) {
        return {
          fields: [
            { name: 'Candidate Name', value: 'Shreyansh', ok: true },
            { name: 'USN', value: '26UG1BYCS0274-T', ok: true },
            { name: 'Course', value: 'The Joy of Computing using Python', ok: true },
            { name: 'Score', value: 88, ok: true },
            { name: 'Certificate ID', value: 'NPTEL26CS94S1029', ok: true },
          ],
          status: 'verified',
        };
      }
      const formData = new FormData();
      formData.append('file', _file);
      const res = await fetch(`${BASE_URL}/nptel/requests/${_requestId}/upload`, {
        method: 'POST',
        headers: {
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: formData,
      });
      return res.json();
    },

    async nudgeStudents(requestId: string | number): Promise<{ nudged_count: number }> {
      if (USE_MOCK) {
        return { nudged_count: 14 };
      }
      return request<{ nudged_count: number }>(`/nptel/requests/${requestId}/nudge`, { method: 'POST' });
    },

    async getRecommendations(): Promise<NptelRecommendation[]> {
      if (USE_MOCK) {
        return [
          { course_id: 'noc27-cs01', title: 'Deep Learning for Computer Vision', instructor: 'Prof. Vineeth N Balasubramanian', institute: 'IIT Hyderabad', duration_weeks: 12, relevance: 'Directly aligns with BMSIT 2nd Year elective track', match_score: 96 },
          { course_id: 'noc27-cs14', title: 'Modern C++ and Design Patterns', instructor: 'Prof. Partha Pratim Das', institute: 'IIT Kharagpur', duration_weeks: 8, relevance: 'Complements 3rd Sem OOP with C++ curriculum', match_score: 91 },
        ];
      }
      return request<NptelRecommendation[]>('/nptel/recommendations');
    },
  },

  // Campus Events
  events: {
    async getEvents(tab: 'all' | 'clashfree' | 'saved' | 'registered' = 'all'): Promise<EventItem[]> {
      if (USE_MOCK) {
        const events: EventItem[] = [
          {
            id: 'ev_01',
            title: 'Martian 1.0 Hackathon',
            description: '24-hour agentic-AI campus security and management hackathon at BMSIT.',
            category: 'Hackathon',
            date: '2026-11-25',
            start_time: '11:00',
            end_time: '11:00',
            venue: 'Sir MV Auditorium / Seminar Hall',
            poster_url: '/posters/martian.png',
            organizer: 'BMSIT CSE Dept & IIC',
            bookmarked: true,
            registered: true,
            clash: false,
            rsvp_count: 140,
          },
          {
            id: 'ev_02',
            title: 'ProtoEdge IoT Workshop',
            description: 'Hands-on engineering foundations with ProtoEdge Dev Board for 1st years.',
            category: 'Workshop',
            date: '2026-12-05',
            start_time: '14:20',
            end_time: '16:10',
            venue: '411B Sir CV Raman Block',
            poster_url: '/posters/protoedge.png',
            organizer: 'Skill Lab Committee',
            bookmarked: false,
            registered: false,
            clash: false,
            rsvp_count: 45,
          },
        ];
        if (tab === 'saved') return events.filter((e) => e.bookmarked);
        if (tab === 'registered') return events.filter((e) => e.registered);
        return events;
      }
      return request<EventItem[]>(`/events?tab=${tab}`);
    },

    async bookmarkEvent(id: string | number): Promise<{ bookmarked: boolean }> {
      if (USE_MOCK) return { bookmarked: true };
      return request<{ bookmarked: boolean }>(`/events/${id}/bookmark`, { method: 'POST' });
    },

    async registerEvent(payload: EventRegistrationPayload): Promise<EventTicket> {
      if (USE_MOCK) {
        return {
          ticket_id: `TCK-${Date.now().toString().slice(-6)}`,
          event_id: payload.event_id,
          event_title: 'Martian 1.0 Hackathon',
          attendee_name: 'Shreyansh',
          usn: '26UG1BYCS0274-T',
          qr_payload: `TARS:EV:${payload.event_id}:26UG1BYCS0274-T`,
          issued_at: new Date().toISOString(),
        };
      }
      return request<EventTicket>(`/events/${payload.event_id}/register`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async getTicket(id: string | number): Promise<EventTicket> {
      if (USE_MOCK) {
        return {
          ticket_id: 'TCK-882914',
          event_id: id,
          event_title: 'Martian 1.0 Hackathon',
          attendee_name: 'Shreyansh',
          usn: '26UG1BYCS0274-T',
          qr_payload: `TARS:EV:${id}:26UG1BYCS0274-T`,
          issued_at: '2026-11-25T11:00:00Z',
        };
      }
      return request<EventTicket>(`/events/${id}/ticket`);
    },
  },

  // Insights
  insights: {
    async getDepartmentInsights(): Promise<DepartmentInsights> {
      if (USE_MOCK) {
        return {
          time_saved_hours: 42.5,
          manual_vs_tars: {
            avg_cover_time_manual_min: 45,
            avg_cover_time_tars_sec: 75,
            nptel_reminders_manual: 8,
            nptel_reminders_tars: 1,
          },
          nptel_by_section: [
            { section: 'CSE-8', compliance_pct: 92, total: 30, verified: 28 },
            { section: 'CSE-9', compliance_pct: 88, total: 29, verified: 25 },
            { section: 'CSE-10', compliance_pct: 95, total: 29, verified: 28 },
            { section: 'CSE-11', compliance_pct: 82, total: 31, verified: 25 },
            { section: 'CSE-12', compliance_pct: 86, total: 30, verified: 26 },
          ],
          cover_load_by_faculty: [
            { faculty_id: 'F_CDB', faculty_name: 'Prof. Chaitra D B', assigned_covers: 2, max_load: 18 },
            { faculty_id: 'F_GPL', faculty_name: 'Mrs. Geetha P L', assigned_covers: 3, max_load: 18 },
            { faculty_id: 'F_SMP', faculty_name: 'Mr. Syed Matheen Pasha', assigned_covers: 2, max_load: 18 },
            { faculty_id: 'F_SDB', faculty_name: 'Mrs. Shabeena Lylath', assigned_covers: 1, max_load: 18 },
          ],
        };
      }
      return request<DepartmentInsights>('/insights/department');
    },
  },
};
