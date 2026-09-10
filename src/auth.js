import crypto from 'node:crypto';
import { one, run } from './db.js';

const SESSION_DAYS = 30;

function hash(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${hash(password, salt)}`;
}

export function verifyPassword(password, stored) {
  const [algo, salt, digest] = String(stored).split('$');
  if (algo !== 'scrypt' || !salt || !digest) return false;
  const a = Buffer.from(digest, 'hex');
  const b = Buffer.from(hash(password, salt), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  run(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
    token, userId, expires.toISOString(),
  );
  return { token, expires };
}

export function userFromToken(token) {
  if (!token) return null;
  const row = one(
    `SELECT u.id, u.username, u.display_name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?`,
    token, new Date().toISOString(),
  );
  return row;
}

export function destroySession(token) {
  if (token) run(`DELETE FROM sessions WHERE token = ?`, token);
}

export function purgeExpiredSessions() {
  run(`DELETE FROM sessions WHERE expires_at <= ?`, new Date().toISOString());
}
