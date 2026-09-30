/* Alpatra — client API adapter.
 * On the real server it talks to /api/*. Opened without the server (a preview link or a file),
 * it runs the same engine in the browser so the whole system can be tried end to end. */
(function () {
  'use strict';
  var KEY = 'alpatra_preview_db_v1', TKEY = 'alpatra_preview_token';
  var mode = null, modePromise = null, mem = null, memToken = null;

  function rand(n) { var a = new Uint8Array(n); (self.crypto || self.msCrypto).getRandomValues(a); return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function loadDb() {
    var raw = lsGet(KEY);
    if (raw) { try { return JSON.parse(raw); } catch (e) {} }
    if (mem) return mem;
    var db = AlpatraEngine.freshDb(Date.now());
    db.users.push({ id: 'u1', username: 'admin', name: 'مدير الفندق', role: 'manager', salt: 'demo-salt-1', hash: AlpatraEngine.hashPassword('alpatra', 'demo-salt-1'), active: true, mustChange: false, createdAt: Date.now() });
    db.users.push({ id: 'u2', username: 'reception', name: 'موظف الاستقبال', role: 'reception', salt: 'demo-salt-2', hash: AlpatraEngine.hashPassword('alpatra', 'demo-salt-2'), active: true, mustChange: false, createdAt: Date.now() });
    db.users.push({ id: 'u3', username: 'housekeeping', name: 'قسم التدبير', role: 'housekeeping', salt: 'demo-salt-3', hash: AlpatraEngine.hashPassword('alpatra', 'demo-salt-3'), active: true, mustChange: false, createdAt: Date.now() });
    db.seq.user = 3;
    AlpatraEngine.seedDemo(db, Date.now(), rand);
    saveDb(db);
    return db;
  }
  function saveDb(db) { mem = db; lsSet(KEY, JSON.stringify(db)); }

  function detect() {
    if (mode) return Promise.resolve(mode);
    if (modePromise) return modePromise;
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = setTimeout(function () { ctl && ctl.abort(); }, 3500);
    modePromise = fetch('api/ping', { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { mode = j && j.app === 'alpatra' ? 'server' : 'preview'; return mode; })
      .catch(function () { mode = 'preview'; return mode; })
      .then(function (m) { clearTimeout(t); return m; });
    return modePromise;
  }

  function request(method, path, body) {
    return detect().then(function (m) {
      if (m === 'server') {
        return fetch(path.replace(/^\//, ''), {
          method: method, credentials: 'same-origin', cache: 'no-store',
          headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined
        }).then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            if (!r.ok) { var e = new Error(j.error || 'تعذّر الاتصال بالخادم'); e.status = r.status; throw e; }
            return j;
          });
        }, function () { var e = new Error('تعذّر الاتصال بالخادم، تحقق من الإنترنت'); e.status = 0; throw e; });
      }
      // preview: run engine locally
      var db = loadDb();
      var url = new URL(path, 'http://x');
      var query = {}; url.searchParams.forEach(function (v, k) { query[k] = v; });
      var token = lsGet(TKEY) || memToken;
      var r = AlpatraEngine.handle(db, { method: method, path: url.pathname, query: query, body: body ? JSON.parse(JSON.stringify(body)) : null, token: token, now: Date.now(), rand: rand, mode: 'preview' });
      if (r.replaceDb) db = r.replaceDb;
      if (r.changed) { db.meta.rev = (db.meta.rev || 0) + 1; saveDb(db); }
      if (r.setToken) { memToken = r.setToken; lsSet(TKEY, r.setToken); }
      if (r.clearToken) { memToken = null; lsDel(TKEY); }
      return new Promise(function (res, rej) {
        setTimeout(function () {
          if (r.status >= 400) { var e = new Error(r.body.error); e.status = r.status; rej(e); } else res(r.body);
        }, 120 + Math.random() * 180);
      });
    });
  }

  window.AlpatraAPI = {
    mode: detect,
    get: function (p) { return request('GET', p); },
    post: function (p, b) { return request('POST', p, b || {}); },
    patch: function (p, b) { return request('PATCH', p, b || {}); },
    put: function (p, b) { return request('PUT', p, b || {}); },
    del: function (p) { return request('DELETE', p); },
    resetPreview: function () { lsDel(KEY); lsDel(TKEY); mem = null; memToken = null; },
    onExternalChange: function (fn) { window.addEventListener('storage', function (e) { if (e.key === KEY) { mem = null; fn(); } }); }
  };
})();
