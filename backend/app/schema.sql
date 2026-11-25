-- TARS SQLite schema
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,             -- S001 / F01 / H01
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','faculty','hod')),
  section TEXT,                    -- students only
  usn TEXT UNIQUE,                 -- students only, e.g. 1AB25CS001 (login id)
  telegram_chat_id TEXT,
  password_hash TEXT               -- pbkdf2_sha256$iters$salt$hash (from TARS_DEMO_PASSWORD); null = no password
);

CREATE TABLE faculty (
  id TEXT PRIMARY KEY REFERENCES users(id),
  subjects TEXT NOT NULL,          -- comma list of subject codes they can teach
  max_load INTEGER NOT NULL DEFAULT 18
);

CREATE TABLE subjects (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_lab INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('classroom','lab','hall')),
  capacity INTEGER NOT NULL
);

CREATE TABLE periods (
  period INTEGER PRIMARY KEY,
  start TEXT NOT NULL,
  end TEXT NOT NULL
);

CREATE TABLE slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL CHECK (day IN ('MON','TUE','WED','THU','FRI')),
  period INTEGER NOT NULL REFERENCES periods(period),
  section TEXT NOT NULL,
  subject_code TEXT NOT NULL REFERENCES subjects(code),
  faculty_id TEXT NOT NULL REFERENCES faculty(id),
  room_id TEXT NOT NULL REFERENCES rooms(id),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','replanned','cancelled')),
  gcal_event_id TEXT               -- Google Calendar event TARS created for this slot (updated, never duplicated)
);
-- Hard guardrails at DB level too (cancelled slots excluded via partial index)
CREATE UNIQUE INDEX no_section_clash ON slots(day, period, section)    WHERE status != 'cancelled';
CREATE UNIQUE INDEX no_faculty_clash ON slots(day, period, faculty_id) WHERE status != 'cancelled';
CREATE UNIQUE INDEX no_room_clash    ON slots(day, period, room_id)    WHERE status != 'cancelled';

CREATE TABLE attendance (
  section TEXT NOT NULL,
  subject_code TEXT NOT NULL REFERENCES subjects(code),
  percent REAL NOT NULL,
  PRIMARY KEY (section, subject_code)
);

CREATE TABLE incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  reported_by TEXT NOT NULL REFERENCES users(id),
  faculty_id TEXT, room_id TEXT, day TEXT, periods TEXT, note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','localtime'))
);

CREATE TABLE decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER REFERENCES incidents(id),
  trigger TEXT NOT NULL,
  summary TEXT NOT NULL,
  reasoning TEXT,
  affected_slot_ids TEXT,          -- JSON array
  status TEXT NOT NULL DEFAULT 'proposed',
  changes TEXT,                    -- JSON list of uncommitted changes awaiting HOD approval
  calendar_link TEXT,              -- htmlLink of the Google Calendar event (v0.6)
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','localtime'))
);

CREATE TABLE nudges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  snoozed_until TEXT,              -- ISO local time; hidden from GET /nudges until then
  blocked INTEGER NOT NULL DEFAULT 0,  -- owner blocked/acted on it; hidden from GET /nudges
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','localtime'))
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL, org TEXT, venue TEXT,
  day TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL
);

CREATE TABLE event_rsvps (
  event_id INTEGER NOT NULL REFERENCES events(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','localtime')),
  PRIMARY KEY (event_id, user_id)
);

-- Telegram Accept/Decline requests to substitutes (one per substitute per decision)
-- Logged-out sessions (POST /auth/logout). Rows are pruned after the token's own expiry.
-- Not cleared by the demo reset, so a logged-out token never comes back.
CREATE TABLE revoked_tokens (
  jti TEXT PRIMARY KEY,
  exp INTEGER NOT NULL            -- unix time the token would have expired anyway
);

CREATE TABLE ack_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  decision_id INTEGER NOT NULL REFERENCES decisions(id),
  faculty_id TEXT NOT NULL REFERENCES faculty(id),
  slot_ids TEXT NOT NULL,          -- JSON array of slots they were asked to cover
  chat_id TEXT,                    -- null if the faculty never linked Telegram
  message_id INTEGER,              -- null if the message could not be sent
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  due_at TEXT NOT NULL,            -- ISO local time; no reply by then → escalate
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','localtime'))
);
