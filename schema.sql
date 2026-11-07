-- Jon Bon Bogo the Bogo Guy: database schema (Cloudflare D1 / SQLite).
-- The site creates these tables automatically on first use (functions/_lib/db.js),
-- so you never have to run this file by hand. It is kept here as a readable reference.

CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item TEXT NOT NULL,
  deal_type TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  store TEXT NOT NULL,
  place TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL CHECK (scope IN ('local', 'national')),
  who TEXT NOT NULL DEFAULT '',
  good_through TEXT,
  photo_key TEXT,
  photo_status TEXT,
  still INTEGER NOT NULL DEFAULT 0,
  gone INTEGER NOT NULL DEFAULT 0,
  reports INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS deals_created ON deals (created_at);
CREATE INDEX IF NOT EXISTS deals_photo ON deals (photo_key);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  reports INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_deal ON comments (deal_id);

CREATE TABLE IF NOT EXISTS votes (
  deal_id INTEGER NOT NULL,
  ip_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (deal_id, ip_hash, day)
);

CREATE TABLE IF NOT EXISTS reports (
  kind TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  ip_hash TEXT NOT NULL,
  PRIMARY KEY (kind, target_id, ip_hash)
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_name TEXT NOT NULL,
  card_name TEXT NOT NULL,
  issuer TEXT NOT NULL,
  annual_fee TEXT NOT NULL,
  fee_note TEXT NOT NULL DEFAULT '',
  why TEXT NOT NULL,
  perks TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  approved_at TEXT
);

CREATE TABLE IF NOT EXISTS referral_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  emailed INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Deals 101',
  author TEXT NOT NULL DEFAULT 'Jon Bon Bogo',
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
