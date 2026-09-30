#!/usr/bin/env node
/*
 * Alpatra Hotel — server
 * Zero dependencies. Requires Node.js 18+.
 *   node server.js            → http://localhost:3000
 *   PORT=8080 node server.js
 * Data: ./data/alpatra.json (daily backups in ./data/backups), or a free Supabase table
 *       when SUPABASE_URL and SUPABASE_KEY are set (see README).
 * Built by Solunera — Kamel Nassif
 */
'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const Engine = require('./public/engine.js');

const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'alpatra.json');
const PUBLIC = path.join(__dirname, 'public');
const COOKIE = 'alp_sid';
const SECURE_COOKIE = process.env.COOKIE_SECURE === '1';
// Optional cloud storage (free Supabase project) — for hosts without a persistent disk (e.g. Render free)
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_KEY || '';
const CLOUD = !!(SB_URL && SB_KEY);

const rand = (n) => crypto.randomBytes(n).toString('hex');

/* ---------- storage ---------- */
const Local = {
  name: 'local file ' + DB_FILE,
  async load() {
    fs.mkdirSync(path.join(DATA_DIR, 'backups'), { recursive: true });
    return fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : null;
  },
  async save(json) {
    const tmp = DB_FILE + '.tmp';
    await fs.promises.writeFile(tmp, json);
    await fs.promises.rename(tmp, DB_FILE);
  },
  saveSync(json) { fs.writeFileSync(DB_FILE, json); },
  async backup(day, json) {
    const f = path.join(DATA_DIR, 'backups', `alpatra-${day}.json.gz`);
    if (fs.existsSync(f)) return;
    fs.writeFileSync(f, zlib.gzipSync(json));
    const all = fs.readdirSync(path.join(DATA_DIR, 'backups')).sort();
    all.slice(0, Math.max(0, all.length - 30)).forEach((x) => fs.unlinkSync(path.join(DATA_DIR, 'backups', x)));
  }
};
const Cloud = {
  name: 'Supabase ' + SB_URL,
  headers(extra) {
    const h = { apikey: SB_KEY, 'Content-Type': 'application/json' };
    if (SB_KEY.startsWith('eyJ')) h.Authorization = 'Bearer ' + SB_KEY; // legacy service_role JWT; new sb_secret_ keys go in apikey only
    return Object.assign(h, extra || {});
  },
  async req(method, q, body, extra) {
    const r = await fetch(`${SB_URL}/rest/v1/alpatra_store${q}`, { method, headers: this.headers(extra), body });
    if (!r.ok) throw new Error(`Supabase ${method} ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return r;
  },
  async load() {
    const r = await this.req('GET', '?id=eq.main&select=data');
    const rows = await r.json();
    return rows.length ? rows[0].data : null;
  },
  async put(id, json) {
    await this.req('POST', '', `[{"id":${JSON.stringify(id)},"data":${json},"updated_at":"${new Date().toISOString()}"}]`, { Prefer: 'resolution=merge-duplicates,return=minimal' });
  },
  async save(json) { await this.put('main', json); },
  saveSync() {},
  async backup(day, json) {
    await this.put('backup-' + day, json);
    const old = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    await this.req('DELETE', `?id=like.backup-*&id=lt.backup-${old}`, undefined, { Prefer: 'return=minimal' }).catch(() => {});
  }
};
const Store = CLOUD ? Cloud : Local;

let db;
let saveTimer = null, saving = false, dirty = false;
function persist() {
  dirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(flush, CLOUD ? 400 : 150);
}
async function flush() {
  saveTimer = null;
  if (saving || !dirty) return;
  saving = true; dirty = false;
  try { await Store.save(JSON.stringify(db)); }
  catch (e) { console.error('save failed — will retry', e.message); dirty = true; setTimeout(persist, 5000); }
  finally { saving = false; if (dirty) persist(); }
}
async function backup() {
  try { await Store.backup(new Date().toISOString().slice(0, 10), JSON.stringify(db)); }
  catch (e) { console.warn('backup failed', e.message); }
}
async function shutdown() {
  try { if (saveTimer || dirty || saving) { clearTimeout(saveTimer); await Store.save(JSON.stringify(db)); } } catch (e) { console.error(e.message); }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function init() {
  db = await Store.load();
  if (!db) {
    db = Engine.freshDb(Date.now());
    if (process.argv.includes('--demo')) Engine.seedDemo(db, Date.now(), rand);
  }
  const firstPw = Engine.ensureAdmin(db, rand, process.env.ADMIN_PASSWORD);
  if (firstPw) {
    console.log(`\n  ┌──────────────────────────────────────────┐\n  │  FIRST RUN — manager account             │\n  │  username: admin                          │\n  │  password: ${firstPw.padEnd(31)}│\n  │  (you must change it at first login)      │\n  └──────────────────────────────────────────┘\n`);
    if (!CLOUD) fs.writeFileSync(path.join(DATA_DIR, 'FIRST-LOGIN.txt'), `username: admin\npassword: ${firstPw}\nDelete this file after your first login.\n`);
  }
  await Store.save(JSON.stringify(db));
  setInterval(backup, 3600e3); setTimeout(backup, 10000);
  // keeps a free Supabase project active
  if (CLOUD) setInterval(() => Cloud.req('GET', '?id=eq.main&select=id').catch(() => {}), 6 * 3600e3);
  console.log('  Storage:', Store.name);
}

/* ---------- WhatsApp (CallMeBot) ---------- */
function sendWhatsApp(fx) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(fx.phone)}&text=${encodeURIComponent(fx.text)}&apikey=${encodeURIComponent(fx.apikey)}`;
  https.get(url, { timeout: 15000 }, (r) => { r.resume(); if (r.statusCode !== 200) console.warn('WhatsApp alert status', r.statusCode); })
    .on('error', (e) => console.warn('WhatsApp alert failed:', e.message));
}

/* ---------- rate limit for public writes ---------- */
const hits = new Map();
function limited(ip, key, max, windowMs) {
  const k = ip + '|' + key, now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(k, arr);
  return arr.length > max;
}
setInterval(() => hits.clear(), 3600e3);

/* ---------- static ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
function serveStatic(req, res, urlPath) {
  let p = decodeURIComponent(urlPath);
  if (p === '/') p = '/index.html';
  if (p === '/admin' || p === '/staff' || p === '/reception') p = '/admin.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404'); }
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' };
    headers['Cache-Control'] = /\.(webp|jpg|png|mp4|svg)$/.test(ext) ? 'public, max-age=604800' : 'no-cache';
    if (ext === '.html') { headers['X-Frame-Options'] = 'SAMEORIGIN'; headers['Referrer-Policy'] = 'same-origin'; }
    // range support for video
    if (ext === '.mp4' && req.headers.range) {
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range);
      const start = m[1] ? +m[1] : 0, end = m[2] ? +m[2] : st.size - 1;
      headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`; headers['Accept-Ranges'] = 'bytes'; headers['Content-Length'] = end - start + 1;
      res.writeHead(206, headers); return fs.createReadStream(file, { start, end }).pipe(res);
    }
    const gz = /\.(html|js|css|json|svg)$/.test(ext) && /gzip/.test(req.headers['accept-encoding'] || '');
    if (gz) { headers['Content-Encoding'] = 'gzip'; res.writeHead(200, headers); return fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res); }
    headers['Content-Length'] = st.size; res.writeHead(200, headers); fs.createReadStream(file).pipe(res);
  });
}

/* ---------- api ---------- */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(Object.assign(new Error('bad json'), { status: 400 })); } });
    req.on('error', reject);
  });
}
function cookies(req) {
  const out = {}; (req.headers.cookie || '').split(';').forEach((c) => { const i = c.indexOf('='); if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); });
  return out;
}
async function api(req, res, url) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  let body = {};
  if (req.method !== 'GET') {
    try { body = await readBody(req, url.pathname === '/api/staff/import' || url.pathname.startsWith('/api/staff/types') ? 60e6 : 1e6); }
    catch (e) { res.writeHead(e.status || 400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'طلب غير صالح' })); }
  }
  if (req.method === 'POST' && url.pathname === '/api/public/book' && limited(ip, 'book', 8, 3600e3)) {
    res.writeHead(429, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'محاولات كثيرة، يرجى الاتصال بالفندق مباشرة' }));
  }
  if (req.method === 'POST' && url.pathname === '/api/auth/login' && limited(ip, 'login', 10, 900e3)) {
    res.writeHead(429, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'محاولات دخول كثيرة، انتظر 15 دقيقة' }));
  }
  if (url.pathname === '/api/public/booking' && limited(ip, 'lookup', 30, 900e3)) {
    res.writeHead(429, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'محاولات كثيرة، حاول لاحقاً' }));
  }
  const token = cookies(req)[COOKIE] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
  const query = Object.fromEntries(url.searchParams.entries());
  const r = Engine.handle(db, { method: req.method, path: url.pathname, query, body, token, now: Date.now(), rand, ip, mode: 'server' });
  if (r.internal) console.error(r.internal);
  if (r.replaceDb) { db = r.replaceDb; db.sessions = db.sessions || {}; }
  if (r.changed) { db.meta.rev = (db.meta.rev || 0) + 1; persist(); }
  (r.effects || []).forEach((fx) => { if (fx.type === 'whatsapp') sendWhatsApp(fx); });
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  const flags = `; Path=/; HttpOnly; SameSite=Lax${SECURE_COOKIE ? '; Secure' : ''}`;
  if (r.setToken) headers['Set-Cookie'] = `${COOKIE}=${r.setToken}; Max-Age=${14 * 86400}${flags}`;
  if (r.clearToken) headers['Set-Cookie'] = `${COOKIE}=; Max-Age=0${flags}`;
  if (r.body && r.body.token) delete r.body.token; // cookie only
  res.writeHead(r.status, headers);
  res.end(JSON.stringify(r.body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    api(req, res, url).catch((e) => { console.error(e); try { res.writeHead(500); res.end('{}'); } catch (_) {} });
  } else if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(req, res, url.pathname);
  } else { res.writeHead(405); res.end(); }
});
init().then(() => server.listen(PORT, () => console.log(`\n  🏨 Alpatra Hotel is running\n  Guests:  http://localhost:${PORT}/\n  Staff:   http://localhost:${PORT}/admin\n`)))
  .catch((e) => { console.error('Could not load data:', e.message); process.exit(1); });
