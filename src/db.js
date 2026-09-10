import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'study.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member',   -- 'admin' | 'member'
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS problems (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source      TEXT NOT NULL,                       -- 'leetcode' | 'programmers'
  ext_id      TEXT NOT NULL,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  difficulty  INTEGER NOT NULL,                    -- 1 easy / 2 medium / 3 hard (정규화)
  diff_label  TEXT NOT NULL,                       -- 'Easy' | 'Lv.2' ...
  topics      TEXT NOT NULL DEFAULT '[]',          -- JSON: 커리큘럼 topic slug 배열
  raw_tags    TEXT NOT NULL DEFAULT '[]',          -- JSON: 원본 태그
  featured    INTEGER NOT NULL DEFAULT 0,          -- 1이면 대표/빈출 문제 (우선 선정)
  collected_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source, ext_id)
);

CREATE TABLE IF NOT EXISTS weeks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  year       INTEGER NOT NULL,
  week_no    INTEGER NOT NULL,
  topic_slug TEXT NOT NULL,
  topic_name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(year, week_no)
);

CREATE TABLE IF NOT EXISTS week_problems (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id    INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,                        -- 'topic' | 'random'
  slot       INTEGER NOT NULL,
  UNIQUE(week_id, problem_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id    INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'todo',         -- 'todo' | 'doing' | 'done'
  note       TEXT NOT NULL DEFAULT '',              -- 풀이 설명
  code       TEXT NOT NULL DEFAULT '',              -- 풀이 코드
  language   TEXT NOT NULL DEFAULT 'python',
  solution_url TEXT NOT NULL DEFAULT '',
  solved_at  TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(week_id, problem_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_assign_user  ON assignments(user_id, week_id);
CREATE INDEX IF NOT EXISTS idx_problem_src  ON problems(source, difficulty);
`);

// 기존 DB 마이그레이션
const hasColumn = (table, col) => db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
if (!hasColumn('problems', 'featured')) db.exec(`ALTER TABLE problems ADD COLUMN featured INTEGER NOT NULL DEFAULT 0`);
if (!hasColumn('assignments', 'code')) db.exec(`ALTER TABLE assignments ADD COLUMN code TEXT NOT NULL DEFAULT ''`);
if (!hasColumn('assignments', 'language')) db.exec(`ALTER TABLE assignments ADD COLUMN language TEXT NOT NULL DEFAULT 'python'`);

export function q(sql, ...params) {
  return db.prepare(sql).all(...params);
}
export function one(sql, ...params) {
  return db.prepare(sql).get(...params) ?? null;
}
export function run(sql, ...params) {
  return db.prepare(sql).run(...params);
}
export { DB_PATH, ROOT };
