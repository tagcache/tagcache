-- tagcache D1 schema
-- Apply with: wrangler d1 execute <DB> --file=node_modules/@tagcache/d1/migrations.sql

CREATE TABLE IF NOT EXISTS tagcache_entries (
  key TEXT PRIMARY KEY,
  data BLOB NOT NULL,
  tags TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS tagcache_entries_expires_at_idx
  ON tagcache_entries (expires_at);

CREATE TABLE IF NOT EXISTS tagcache_tags (
  tag TEXT PRIMARY KEY,
  invalidated_at INTEGER NOT NULL
);
