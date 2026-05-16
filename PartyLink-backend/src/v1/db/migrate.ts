import { run } from './client';

async function safeRun(sql: string): Promise<void> {
  try {
    await run(sql);
  } catch {
    // Intentionally ignore migration no-op failures like duplicate column.
  }
}

export async function migrate(): Promise<void> {
  await run('PRAGMA foreign_keys = ON;');
  await run('PRAGMA journal_mode = WAL;');

  await run('DROP TABLE IF EXISTS dm_messages;');
  await run('DROP TABLE IF EXISTS dm_threads;');
  await run('DROP TABLE IF EXISTS group_match_requests;');
  await run('DROP TABLE IF EXISTS group_overview_votes;');
  await run('DROP TABLE IF EXISTS group_overview_comments;');
  await run('DROP TABLE IF EXISTS group_overview_snapshots;');
  await run('DROP TABLE IF EXISTS group_memberships;');
  await run('DROP TABLE IF EXISTS party_groups;');
  await run('DROP TABLE IF EXISTS refresh_tokens;');

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      username TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      display_name TEXT,
      bio TEXT,
      school TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS parties (
      id TEXT PRIMARY KEY,
      host_user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      location_name TEXT NOT NULL,
      location_address TEXT,
      location_place_id TEXT,
      location_lat REAL,
      location_lng REAL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'public',
      capacity INTEGER,
      price_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(host_user_id) REFERENCES users(id)
    );
  `);

  await safeRun('ALTER TABLE parties ADD COLUMN image_url TEXT;');
  await safeRun('ALTER TABLE parties ADD COLUMN location_address TEXT;');
  await safeRun('ALTER TABLE parties ADD COLUMN location_place_id TEXT;');
  await safeRun('ALTER TABLE parties ADD COLUMN location_lat REAL;');
  await safeRun('ALTER TABLE parties ADD COLUMN location_lng REAL;');

  await run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      party_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid',
      code TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(party_id, user_id),
      UNIQUE(code),
      FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await safeRun('ALTER TABLE tickets ADD COLUMN code TEXT;');

  await run(`
    CREATE TABLE IF NOT EXISTS party_ticket_codes (
      id TEXT PRIMARY KEY,
      party_id TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      is_assigned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
    );
  `);

  await run('CREATE INDEX IF NOT EXISTS idx_parties_starts_at ON parties(starts_at DESC);');
  await run('CREATE INDEX IF NOT EXISTS idx_parties_location_lat_lng ON parties(location_lat, location_lng);');
  await run('CREATE INDEX IF NOT EXISTS idx_tickets_party ON tickets(party_id);');
  await run('CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);');
  await run('CREATE INDEX IF NOT EXISTS idx_party_ticket_codes_party ON party_ticket_codes(party_id, is_assigned);');
}
