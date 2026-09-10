import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi, HttpError } from './src/api.js';
import { userFromToken, purgeExpiredSessions } from './src/auth.js';
import { ensureCurrentWeek } from './src/rotation.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const COOKIE = 'study_session';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
               '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
               '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((c) => {
    const i = c.indexOf('=');
    return i < 0 ? [c.trim(), ''] : [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())];
  }).filter(([k]) => k));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1e6) throw new HttpError(413, '요청이 너무 큽니다.');
    chunks.push(chunk);
  }
  if (!chunks.length) return null;
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'JSON 형식이 올바르지 않습니다.'); }
}

function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);

  const cookies = parseCookies(req.headers.cookie ?? '');
  const headers = [];
  const ctx = {
    method: req.method, path: url.pathname, query: url.searchParams,
    token: cookies[COOKIE], user: userFromToken(cookies[COOKIE]), body: null,
    setSession(token, expires) {
      headers.push(`${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Expires=${expires.toUTCString()}`);
    },
    clearSession() { headers.push(`${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`); },
  };

  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') ctx.body = await readBody(req);
    const payload = await handleApi(ctx);
    const out = { 'Content-Type': 'application/json; charset=utf-8' };
    if (headers.length) out['Set-Cookie'] = headers;
    res.writeHead(200, out);
    res.end(JSON.stringify(payload ?? { ok: true }));
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: err.message || '서버 오류' }));
  }
});

purgeExpiredSessions();
ensureCurrentWeek({ log: console.log });
setInterval(() => { purgeExpiredSessions(); ensureCurrentWeek({ log: console.log }); }, 60 * 60 * 1000).unref();

server.listen(PORT, () => {
  console.log(`\n  코딩테스트 스터디  →  http://localhost:${PORT}\n`);
});
