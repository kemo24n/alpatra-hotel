/* Alpatra — reception & management panel
 * Built by Solunera — Kamel Nassif */
(function () {
'use strict';
var API = window.AlpatraAPI, E = window.AlpatraEngine, U = E.util;

/* ======================= helpers ======================= */
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function money(n) { var v = Math.round((+n || 0) * 100) / 100; return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
function sypFmt(n) { return Math.round(n).toLocaleString('en-US') + ' ل.س'; }
function ic(id, s) { return '<svg class="i" width="' + (s || 18) + '" height="' + (s || 18) + '" style="width:' + (s || 18) + 'px;height:' + (s || 18) + 'px"><use href="#i-' + id + '"/></svg>'; }
var MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
var DOWS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
function dD(s) { return new Date(U.parseD(s)); }
function dShort(s) { var d = dD(s); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()]; }
function dLong(s) { var d = dD(s); return DOWS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
function dNum(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) : ''; }
function tStamp(ms) { var d = new Date(ms + 3 * 3600e3); var iso = d.toISOString(); return dNum(iso.slice(0, 10)) + ' ' + iso.slice(11, 16); }
function ago(ms) { var s = (Date.now() - ms) / 1000; if (s < 60) return 'الآن'; if (s < 3600) return 'قبل ' + Math.floor(s / 60) + ' د'; if (s < 86400) return 'قبل ' + Math.floor(s / 3600) + ' س'; return 'قبل ' + Math.floor(s / 86400) + ' يوم'; }
function nightsW(n) { return n === 1 ? 'ليلة' : n === 2 ? 'ليلتان' : n + (n <= 10 ? ' ليالٍ' : ' ليلة'); }
function today() { return U.todayStr(Date.now()); }
var STATUS = { pending: 'بانتظار التأكيد', confirmed: 'مؤكد', in_house: 'مقيم', checked_out: 'غادر', cancelled: 'ملغى', no_show: 'لم يحضر' };
var SOURCE = { online: 'الموقع', walk_in: 'حضور مباشر', phone: 'هاتف', agency: 'وكالة سفر', company: 'شركة' };
var HK = { clean: 'نظيفة', dirty: 'بحاجة تنظيف', inspect: 'بانتظار الفحص', ooo: 'خارج الخدمة' };
var ROLE = { manager: 'مدير', reception: 'استقبال', housekeeping: 'تدبير فندقي' };
var CAT = { restaurant: 'مطعم', minibar: 'ميني بار', laundry: 'غسيل وكي', transport: 'نقل', phone: 'هاتف', other: 'أخرى' };
var METHOD = { cash: 'نقداً', card: 'بطاقة', transfer: 'تحويل' };
function pill(st) { return '<span class="pill s-' + st + '">' + STATUS[st] + '</span>'; }
function toast(msg, kind, onclick) {
  var t = document.createElement('div'); t.className = 'toast' + (kind ? ' ' + kind : ''); t.innerHTML = msg;
  if (onclick) t.onclick = function () { onclick(); t.remove(); };
  $('#toasts').appendChild(t); setTimeout(function () { t.style.opacity = 0; t.style.transition = 'opacity .4s'; setTimeout(function () { t.remove(); }, 400); }, kind === 'new' ? 9000 : 3800);
}
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function waUrl(phone, text) { var p = U.normPhone(phone); return p ? 'https://wa.me/' + p + (text ? '?text=' + encodeURIComponent(text) : '') : null; }

/* ======================= state ======================= */
var S = { db: null, me: null, mode: 'server', view: 'dash', seen: null, idx: null, loading: false,
  tl: { start: null, days: 21 }, bk: { tab: 'active', q: '', src: '', limit: 80 }, g: { q: '' }, rack: { f: 'all' }, hk: { floor: 'all' },
  rep: { preset: 'month', from: null, to: null, day: null } };

function reindex() {
  var db = S.db, ix = { guest: {}, room: {}, type: {}, booking: {}, byGuest: {}, fol: {} };
  db.guests.forEach(function (g) { ix.guest[g.id] = g; ix.byGuest[g.id] = []; });
  db.rooms.forEach(function (r) { ix.room[r.id] = r; });
  db.roomTypes.forEach(function (t) { ix.type[t.id] = t; });
  db.bookings.forEach(function (b) { ix.booking[b.id] = b; if (ix.byGuest[b.guestId]) ix.byGuest[b.guestId].push(b); });
  S.idx = ix;
}
function G(id) { return S.idx.guest[id] || { name: 'ضيف', phone: '' }; }
function R(id) { return S.idx.room[id]; }
function T(id) { return S.idx.type[id] || { name: '—' }; }
function B(id) { return S.idx.booking[id]; }
function folio(b) { return U.folio(S.db, b); }
function isMgr() { return S.me && S.me.role === 'manager'; }
function isHK() { return S.me && S.me.role === 'housekeeping'; }

function load(silent) {
  return API.get('/api/staff/state').then(function (db) {
    var first = !S.db;
    S.db = db; S.me = db.me; reindex();
    checkNotifications(first);
    if (first) { renderShell(); route(); postLoginChecks(); }
    else { renderBadges(); if (!silent || !isTyping()) renderView(); refreshDrawer(); }
  }).catch(function (e) {
    if (e.status === 401) { S.db = null; renderLogin(); }
    else if (!silent) toast(esc(e.message), 'err');
  });
}
function isTyping() { var a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') && !a.closest('.bar'); }
function act(p, okMsg) {
  return p.then(function (r) { if (okMsg) toast(okMsg); return load().then(function () { return r; }); })
    .catch(function (e) { toast(esc(e.message), 'err'); throw e; });
}
var pollT = null;
function startPolling() {
  clearInterval(pollT);
  pollT = setInterval(function () {
    if (!S.db || document.hidden) return;
    API.get('/api/staff/rev').then(function (r) { if (r.rev !== S.db.meta.rev) load(true); }).catch(function (e) { if (e.status === 401) { S.db = null; renderLogin(); } });
  }, S.mode === 'server' ? 4000 : 2500);
}
API.onExternalChange(function () { if (S.db) load(true); });

/* ---- notifications + chime ---- */
var audioCtx = null;
function chime() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [880, 1318.5].forEach(function (f, i) {
      var o = audioCtx.createOscillator(), g = audioCtx.createGain(), t0 = audioCtx.currentTime + i * 0.18;
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0 + 0.55);
    });
  } catch (e) {}
}
var titleT = null, baseTitle = document.title;
function blinkTitle(txt) { clearInterval(titleT); var on = false, n = 0; titleT = setInterval(function () { document.title = (on = !on) ? txt : baseTitle; if (++n > 20 || !document.hidden && n > 6) { clearInterval(titleT); document.title = baseTitle; } }, 1000); }
function checkNotifications(first) {
  var ids = S.db.notifications.map(function (n) { return n.id; });
  if (first || !S.seen) { S.seen = {}; ids.forEach(function (i) { S.seen[i] = 1; }); return; }
  S.db.notifications.filter(function (n) { return !S.seen[n.id]; }).forEach(function (n) {
    S.seen[n.id] = 1;
    if (isHK()) return;
    chime(); blinkTitle('🔔 ' + (n.type === 'cancel' ? 'إلغاء حجز' : 'حجز جديد'));
    toast('<span>' + ic(n.type === 'cancel' ? 'x' : 'bell') + '</span><span><b>' + (n.type === 'cancel' ? 'إلغاء من الموقع' : 'حجز جديد من الموقع') + '</b>' + esc(n.text) + '</span>', 'new', function () { if (n.bookingId) openBooking(n.bookingId); });
  });
}
function unreadCount() { return S.db.notifications.filter(function (n) { return n.readBy.indexOf(S.me.id) < 0; }).length; }

/* ======================= login ======================= */
function renderLogin() {
  clearInterval(pollT); closeDrawer(); closeModal();
  $('#root').innerHTML = '<div class="login"><div class="login-art"><img src="media/lobby-2.webp" alt=""><video autoplay muted loop playsinline poster="media/lobby-2.webp"><source src="media/corridor.mp4" type="video/mp4"></video>' +
    '<div class="cap"><b>البتراء</b><span style="font-family:var(--f-latin);letter-spacing:.35em;font-size:13px;opacity:.8">ALPATRA HOTEL · FRONT DESK</span></div></div>' +
    '<div class="login-side"><form class="login-card" id="loginForm" autocomplete="on"><svg class="logo"><use href="#logo"/></svg><div><h1 style="font-size:28px">نظام إدارة الفندق</h1><p class="muted">الاستقبال · الحجوزات · التقارير</p></div>' +
    '<div class="fld"><label for="lu">اسم المستخدم</label><input class="in" id="lu" autocomplete="username" dir="ltr" required></div>' +
    '<div class="fld"><label for="lp">كلمة المرور</label><input class="in" id="lp" type="password" autocomplete="current-password" dir="ltr" required></div>' +
    '<p class="muted" id="lerr" style="color:var(--bad)" hidden></p><button class="btn btn-p" style="padding:11px" type="submit">دخول</button>' +
    '<div class="demo-creds" id="demoCreds" hidden><b>حسابات المعاينة (كلمة المرور: alpatra)</b><div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" data-u="admin">المدير</button><button type="button" data-u="reception">الاستقبال</button><button type="button" data-u="housekeeping">التدبير الفندقي</button></div><a href="index.html">← موقع الحجز للضيوف</a></div>' +
    '<p class="muted" style="font-size:12px;text-align:center;margin-top:10px">Solunera — Kamel Nassif</p></form></div></div>';
  if (S.mode === 'preview') { $('#demoCreds').hidden = false; $$('#demoCreds [data-u]').forEach(function (b) { b.onclick = function () { $('#lu').value = b.dataset.u; $('#lp').value = 'alpatra'; $('#loginForm').requestSubmit ? $('#loginForm').requestSubmit() : doLogin(); }; }); }
  $('#loginForm').onsubmit = function (e) { e.preventDefault(); doLogin(); };
  setTimeout(function () { var u = $('#lu'); if (u) u.focus(); }, 50);
}
function doLogin() {
  var err = $('#lerr'); err.hidden = true;
  chime.warm = true; try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  API.post('/api/auth/login', { username: $('#lu').value, password: $('#lp').value }).then(function () { S.db = null; S.seen = null; return load(); })
    .catch(function (e) { err.textContent = e.message; err.hidden = false; });
}

/* ======================= shell ======================= */
var NAV = [
  { g: 'اليوم' },
  { id: 'dash', t: 'لوحة اليوم', i: 'home', roles: 'mr' },
  { id: 'rack', t: 'لوحة الغرف', i: 'grid', roles: 'mrh' },
  { id: 'timeline', t: 'مخطط الحجوزات', i: 'tl', roles: 'mr' },
  { id: 'bookings', t: 'الحجوزات', i: 'book', roles: 'mr', badge: 'pending' },
  { id: 'guests', t: 'الضيوف', i: 'users', roles: 'mr' },
  { id: 'hk', t: 'التدبير الفندقي', i: 'broom', roles: 'mrh', badge: 'dirty' },
  { g: 'الإدارة' },
  { id: 'reports', t: 'التقارير', i: 'chart', roles: 'mr' },
  { id: 'rates', t: 'الغرف والأسعار', i: 'tag', roles: 'm' },
  { id: 'settings', t: 'الإعدادات', i: 'gear', roles: 'm' },
  { id: 'users', t: 'المستخدمون', i: 'key', roles: 'm' },
  { id: 'log', t: 'سجل النشاط', i: 'log', roles: 'mr' }
];
function allowed(id) { var n = NAV.filter(function (x) { return x.id === id; })[0]; return n && n.roles.indexOf(S.me.role[0]) >= 0; }
function renderShell() {
  var me = S.me;
  $('#root').innerHTML = '<div class="app"><aside class="side" id="side"><a class="side-brand" href="index.html" target="_blank" title="موقع الحجز"><svg><use href="#logo"/></svg><span><b>البتراء</b><small>FRONT DESK</small></span></a><div class="ablaq"></div><nav id="nav"></nav>' +
    '<div class="side-foot"><div class="avatar">' + esc(me.name.trim()[0] || '؟') + '</div><div class="who"><b>' + esc(me.name) + '</b><span>' + ROLE[me.role] + '</span></div>' +
    '<button class="icon-btn" id="pwBtn" title="تغيير كلمة المرور">' + ic('key') + '</button><button class="icon-btn" id="outBtn" title="تسجيل الخروج">' + ic('out') + '</button></div></aside>' +
    '<main class="main"><div class="preview-note" id="pvNote" hidden>معاينة تفاعلية: البيانات أمثلة تُحفظ في هذا المتصفح فقط. احجز من <a href="index.html" target="_blank">موقع الضيوف</a> وسيصل الحجز هنا مع تنبيه.</div>' +
    '<div class="bar"><button class="icon-btn menu-toggle" id="menuT" aria-label="القائمة">' + ic('menu') + '</button><div><h1 id="vTitle"></h1><div class="date">' + dLong(today()) + '</div></div>' +
    '<div class="search"><input id="gSearch" placeholder="ابحث: اسم، هاتف، رقم حجز، رقم غرفة" autocomplete="off">' + ic('search', 16) + '<div class="search-res" id="gRes" hidden></div></div>' +
    (isHK() ? '' : '<button class="btn btn-p" id="newBtn">' + ic('plus', 16) + '<span>حجز جديد</span></button>') +
    '<div style="position:relative"><button class="icon-btn" id="bellBtn" title="التنبيهات">' + ic('bell') + '<span class="bell-dot" id="bellDot" hidden></span></button><div class="notif" id="notif" hidden></div></div>' +
    '<button class="icon-btn" id="themeBtn" title="الوضع الليلي">' + ic('moon') + '</button></div><div class="view" id="view"></div></main></div>';
  $('#pvNote').hidden = S.mode !== 'preview';
  $('#outBtn').onclick = function () { API.post('/api/auth/logout').then(function () { S.db = null; renderLogin(); }); };
  $('#pwBtn').onclick = function () { passwordModal(false); };
  $('#menuT').onclick = function () { $('#side').classList.toggle('open'); };
  if ($('#newBtn')) $('#newBtn').onclick = function () { newBooking({}); };
  $('#themeBtn').onclick = toggleTheme;
  $('#bellBtn').onclick = function (e) { e.stopPropagation(); var n = $('#notif'); n.hidden = !n.hidden; if (!n.hidden) renderNotif(); };
  document.addEventListener('click', function (e) { if (!e.target.closest('#notif') && $('#notif')) $('#notif').hidden = true; if (!e.target.closest('.search') && $('#gRes')) $('#gRes').hidden = true; });
  setupSearch();
  renderNav(); renderBadges(); startPolling();
}
function renderNav() {
  $('#nav').innerHTML = NAV.map(function (n) {
    if (n.g) return isHK() ? '' : '<div class="grp">' + n.g + '</div>';
    if (n.roles.indexOf(S.me.role[0]) < 0) return '';
    return '<a class="nav-a' + (S.view === n.id ? ' on' : '') + '" href="#' + n.id + '">' + ic(n.i) + '<span>' + n.t + '</span>' + (n.badge ? '<span class="cnt' + (n.badge === 'pending' ? ' b' : '') + '" data-badge="' + n.badge + '" hidden></span>' : '') + '</a>';
  }).join('');
  $$('#nav a').forEach(function (a) { a.onclick = function () { $('#side').classList.remove('open'); }; });
}
function renderBadges() {
  if (!$('#nav')) return;
  var pend = S.db.bookings.filter(function (b) { return b.status === 'pending'; }).length;
  var dirty = S.db.rooms.filter(function (r) { return r.status === 'dirty'; }).length;
  $$('[data-badge]').forEach(function (el) { var v = el.dataset.badge === 'pending' ? pend : dirty; el.textContent = v; el.hidden = !v; });
  var u = unreadCount(); $('#bellDot').textContent = u > 9 ? '9+' : u; $('#bellDot').hidden = !u || isHK();
}
function renderNotif() {
  var list = S.db.notifications.slice(0, 40);
  $('#notif').innerHTML = '<div class="card-h"><h3>التنبيهات</h3><div class="sp"><button class="btn btn-s btn-sm" id="readAll">تعليم الكل كمقروء</button></div></div>' +
    (list.length ? list.map(function (n) { var un = n.readBy.indexOf(S.me.id) < 0; return '<div class="n-i' + (un ? ' unread' : '') + '" data-b="' + (n.bookingId || '') + '">' + ic(n.type === 'cancel' ? 'x' : 'bell', 16) + '<div><div>' + esc(n.text) + '</div><div class="sub">' + ago(n.at) + '</div></div></div>'; }).join('') : '<div class="empty">لا توجد تنبيهات</div>');
  $('#readAll').onclick = function () { act(API.post('/api/staff/notifications/read')); $('#notif').hidden = true; };
  $$('#notif .n-i').forEach(function (el) { el.onclick = function () { if (el.dataset.b) openBooking(el.dataset.b); $('#notif').hidden = true; }; });
}
function toggleTheme() {
  var cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  var nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', nx); lsSet('alp_theme', nx);
}
(function () { var t = lsGet('alp_theme'); if (t) document.documentElement.setAttribute('data-theme', t); })();

/* global search */
function setupSearch() {
  var inp = $('#gSearch'), res = $('#gRes'), items = [], act_i = 0;
  inp.oninput = function () {
    var q = inp.value.trim().toLowerCase(); if (q.length < 2) { res.hidden = true; return; }
    var qd = q.replace(/[^\d]/g, ''); items = [];
    S.db.rooms.forEach(function (r) { if (r.number === q) items.push({ k: 'room', id: r.id, h: '<span class="rn">' + r.number + '</span><div><b>غرفة ' + r.number + '</b><div class="sub">' + esc(T(r.typeId).name) + ' · ' + HK[r.status] + '</div></div>' }); });
    S.db.bookings.slice().sort(function (a, b) { return b.checkIn.localeCompare(a.checkIn); }).forEach(function (b) {
      if (items.length > 12) return; var g = G(b.guestId);
      if (b.code.toLowerCase().indexOf(q) >= 0 || g.name.toLowerCase().indexOf(q) >= 0 || (qd.length >= 4 && U.normPhone(g.phone).indexOf(qd) >= 0))
        items.push({ k: 'booking', id: b.id, h: '<span class="rn' + (b.roomId ? '' : ' none') + '">' + (b.roomId ? R(b.roomId).number : '—') + '</span><div style="flex:1;min-width:0"><b>' + esc(g.name) + '</b><div class="sub"><span class="ltr">' + b.code + '</span> · ' + dShort(b.checkIn) + ' ← ' + dShort(b.checkOut) + '</div></div>' + pill(b.status) });
    });
    act_i = 0;
    res.innerHTML = items.length ? items.map(function (it, i) { return '<div class="sr-item' + (i === 0 ? ' act' : '') + '" data-i="' + i + '">' + it.h + '</div>'; }).join('') : '<div class="empty">لا نتائج</div>';
    res.hidden = false;
    $$('.sr-item', res).forEach(function (el) { el.onclick = function () { pick(items[+el.dataset.i]); }; });
  };
  inp.onkeydown = function (e) {
    if (res.hidden || !items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); act_i = (act_i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; $$('.sr-item', res).forEach(function (el, i) { el.classList.toggle('act', i === act_i); }); }
    if (e.key === 'Enter') { e.preventDefault(); pick(items[act_i]); }
  };
  function pick(it) { res.hidden = true; inp.value = ''; if (it.k === 'room') openRoom(it.id); else openBooking(it.id); }
}

/* ======================= routing ======================= */
var TITLES = { dash: 'لوحة اليوم', rack: 'لوحة الغرف', timeline: 'مخطط الحجوزات', bookings: 'الحجوزات', guests: 'الضيوف', hk: 'التدبير الفندقي', reports: 'التقارير', rates: 'الغرف والأسعار', settings: 'الإعدادات', users: 'المستخدمون', log: 'سجل النشاط' };
function route() {
  var h = (location.hash || '').slice(1) || (isHK() ? 'hk' : 'dash');
  if (!TITLES[h] || !allowed(h)) h = isHK() ? 'hk' : 'dash';
  S.view = h; renderNav(); renderBadges(); renderView();
}
window.addEventListener('hashchange', function () { if (S.db) route(); });
function renderView() {
  if (!S.db || !$('#view')) return;
  $('#vTitle').textContent = TITLES[S.view];
  var y = window.scrollY;
  V[S.view]($('#view'));
  window.scrollTo(0, y);
}
var V = {};

/* ======================= computations ======================= */
var HOLD = { pending: 1, confirmed: 1, in_house: 1 };
function occupying(d) { return S.db.bookings.filter(function (b) { return HOLD[b.status] && b.checkIn <= d && b.checkOut > d; }); }
function roomsInService() { return S.db.rooms.filter(function (r) { return r.status !== 'ooo'; }).length; }
function nightPrice(b, d) { for (var i = 0; i < b.nightly.length; i++) if (b.nightly[i].date === d) return b.nightly[i].price; return 0; }
function roomState(r, t) {
  var cur = null, arr = null;
  S.db.bookings.forEach(function (b) {
    if (b.roomId !== r.id) return;
    if (b.status === 'in_house') cur = b;
    else if ((b.status === 'confirmed' || b.status === 'pending') && b.checkIn <= t && b.checkOut > t) arr = arr || b;
  });
  return { cur: cur, arr: arr, dep: cur && cur.checkOut <= t };
}

/* ======================= dashboard ======================= */
V.dash = function (el) {
  var t = today(), db = S.db, inv = roomsInService();
  var occ = occupying(t), occN = occ.length, pct = inv ? Math.round(occN / inv * 100) : 0;
  var arrivals = db.bookings.filter(function (b) { return (b.status === 'confirmed' || b.status === 'pending') && b.checkIn <= t && b.checkOut > t; }).sort(function (a, b) { return a.checkIn.localeCompare(b.checkIn); });
  var departures = db.bookings.filter(function (b) { return b.status === 'in_house' && b.checkOut <= t; });
  var departed = db.bookings.filter(function (b) { return b.status === 'checked_out' && b.checkOut === t; }).length;
  var inHouse = db.bookings.filter(function (b) { return b.status === 'in_house'; });
  var guestsN = inHouse.reduce(function (a, b) { return a + b.adults + b.children; }, 0);
  var payToday = db.payments.filter(function (p) { return p.date === t; }), rev = payToday.reduce(function (a, p) { return a + p.amount; }, 0);
  var adrArr = occ.map(function (b) { return nightPrice(b, t); }).filter(Boolean), adr = adrArr.length ? adrArr.reduce(function (a, b) { return a + b; }, 0) / adrArr.length : 0;
  var pending = db.bookings.filter(function (b) { return b.status === 'pending'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });
  var dirty = db.rooms.filter(function (r) { return r.status === 'dirty'; }).length, ooo = db.rooms.filter(function (r) { return r.status === 'ooo'; }).length;
  var hr = new Date(Date.now() + 3 * 3600e3).getUTCHours(), hi = hr < 12 ? 'صباح الخير' : 'مساء الخير';

  el.innerHTML = '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><h2 style="font-size:26px">' + hi + '، ' + esc(S.me.name.split(' ')[0]) + '</h2><p class="muted">' + arrivals.length + ' وصول و' + departures.length + ' مغادرة بانتظارك اليوم' + (pending.length ? '، و' + pending.length + ' حجز من الموقع ينتظر التأكيد' : '') + '.</p></div>' +
    '<div class="chips"><button class="btn btn-s" data-go="rack">' + ic('grid', 16) + ' لوحة الغرف</button><button class="btn btn-s" id="walkBtn">' + ic('in', 16) + ' تسجيل ضيف مباشر</button></div></div>' +
    '<div class="kpis">' +
      kpi('إشغال الليلة', pct + '<small>%</small>', occN + ' من ' + inv + ' غرفة', pct) +
      kpi('وصول اليوم', arrivals.length, arrivals.filter(function (b) { return b.checkIn < t; }).length ? arrivals.filter(function (b) { return b.checkIn < t; }).length + ' متأخر' : 'بانتظار تسجيل الدخول') +
      kpi('مغادرة اليوم', departures.length, departed + ' غادروا حتى الآن') +
      kpi('مقيمون الآن', inHouse.length, guestsN + ' ضيف') +
      kpi('المقبوضات اليوم', '<span class="ltr">' + money(rev) + '</span>', payToday.length + ' دفعة') +
      kpi('متوسط سعر الليلة', '<span class="ltr">' + money(adr) + '</span>', 'للغرف المشغولة الليلة') +
    '</div>' +
    (pending.length ? '<div class="card" style="border-color:var(--warn)"><div class="card-h"><span class="pill s-pending">' + pending.length + '</span><h3>حجوزات الموقع بانتظار التأكيد</h3><div class="sp"><a class="btn btn-s btn-sm" href="#bookings" data-tab="pending">عرض الكل</a></div></div><div class="lst">' +
      pending.slice(0, 5).map(function (b) { var g = G(b.guestId); return '<div class="li" data-b="' + b.id + '"><span class="rn none">' + ic('web', 16) + '</span><div class="mid"><b>' + esc(g.name) + ' <span class="sub ltr">' + esc(g.phone) + '</span></b><span class="sub">' + esc(T(b.typeId).name) + ' · ' + dShort(b.checkIn) + ' ← ' + dShort(b.checkOut) + ' · ' + nightsW(U.nightsBetween(b.checkIn, b.checkOut)) + ' · ' + ago(b.createdAt) + '</span></div><b class="ltr">' + money(b.roomTotal + b.tax) + '</b><button class="btn btn-ok btn-sm" data-confirm="' + b.id + '">' + ic('check', 15) + ' تأكيد</button></div>'; }).join('') + '</div></div>' : '') +
    '<div class="grid g-dash">' +
      '<div class="grid">' +
        listCard('الوصول اليوم', arrivals, function (b) { var late = b.checkIn < t; return '<button class="btn btn-p btn-sm" data-ci="' + b.id + '">' + ic('in', 15) + ' دخول</button>' + (late ? '<span class="pill s-cancelled" style="margin-inline-end:6px">متأخر</span>' : ''); }, 'لا يوجد وصول متبقٍ اليوم') +
        listCard('المغادرة اليوم', departures, function (b) { var f = folio(b); return (f.balance > 0.009 ? '<span class="pill s-cancelled">مستحق <span class="ltr">' + money(f.balance) + '</span></span>' : '<span class="pill s-in_house">مسدد</span>') + '<button class="btn btn-s btn-sm" data-co="' + b.id + '">' + ic('out', 15) + ' خروج</button>'; }, 'لا توجد مغادرات متبقية') +
      '</div>' +
      '<div class="grid">' +
        '<div class="card"><div class="card-h"><h3>الإشغال للأيام الـ 14 القادمة</h3></div><div class="card-b"><div class="chart" id="fcChart"></div></div></div>' +
        '<div class="card"><div class="card-h"><h3>حالة الغرف</h3><div class="sp"><a class="btn btn-s btn-sm" href="#hk">التدبير</a></div></div><div class="card-b" style="display:grid;gap:10px">' +
          hbar('مشغولة', occN, inv, 'var(--occ)') + hbar('شاغرة ونظيفة', db.rooms.filter(function (r) { return r.status === 'clean' && !occ.some(function (b) { return b.roomId === r.id; }); }).length, inv, 'var(--ok)') +
          hbar('بحاجة تنظيف', dirty, inv, 'var(--warn)') + hbar('خارج الخدمة', ooo, inv, 'var(--ooo)') + '</div></div>' +
      '</div>' +
    '</div>';
  // forecast chart
  var days = []; for (var i = 0; i < 14; i++) { var d = U.addDays(t, i), o = occupying(d).length; days.push({ label: dD(d).getUTCDate() + '', sub: DOWS[dD(d).getUTCDay()].replace('ال', '').slice(0, 3), v: inv ? o / inv * 100 : 0, tip: dShort(d) + ': ' + o + ' غرفة (' + Math.round(inv ? o / inv * 100 : 0) + '%)', hl: i === 0 }); }
  barChart($('#fcChart'), days, { max: 100, unit: '%', h: 220, w: 440 });
  wireCommon(el);
  $('#walkBtn').onclick = function () { newBooking({ checkIn: t, walkIn: true }); };
};
function kpi(k, v, d, meter) { return '<div class="card kpi"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="d">' + d + '</div>' + (meter != null ? '<div class="meter"><i style="width:' + Math.min(100, meter) + '%"></i></div>' : '') + '</div>'; }
function hbar(label, v, max, color) { return '<div class="hbar"><span>' + label + '</span><div class="t"><i style="width:' + (max ? v / max * 100 : 0) + '%;background:' + color + '"></i></div><span class="n">' + v + '</span></div>'; }
function listCard(title, arr, right, emptyTxt) {
  return '<div class="card"><div class="card-h"><h3>' + title + '</h3><span class="tag">' + arr.length + '</span></div><div class="lst scroll">' +
    (arr.length ? arr.map(function (b) { var g = G(b.guestId); return '<div class="li" data-b="' + b.id + '"><span class="rn' + (b.roomId ? '' : ' none') + '">' + (b.roomId ? R(b.roomId).number : 'بدون') + '</span><div class="mid"><b>' + (g.vip ? '<span style="color:var(--brass)">' + ic('star', 14) + '</span> ' : '') + esc(g.name) + '</b><span class="sub">' + esc(T(b.typeId).name) + ' · ' + nightsW(U.nightsBetween(b.checkIn, b.checkOut)) + ' · ' + b.adults + (b.children ? '+' + b.children : '') + ' ضيف · ' + SOURCE[b.source] + (b.arrivalTime ? ' · ' + esc(b.arrivalTime) : '') + '</span></div><div style="display:flex;gap:6px;align-items:center">' + right(b) + '</div></div>'; }).join('') : '<div class="empty">' + ic('check') + emptyTxt + '</div>') + '</div></div>';
}
function wireCommon(el) {
  $$('[data-b]', el).forEach(function (x) { x.addEventListener('click', function (e) { if (e.target.closest('button,a')) return; openBooking(x.dataset.b); }); });
  $$('[data-confirm]', el).forEach(function (x) { x.onclick = function () { confirmBooking(x.dataset.confirm); }; });
  $$('[data-ci]', el).forEach(function (x) { x.onclick = function () { checkIn(x.dataset.ci); }; });
  $$('[data-co]', el).forEach(function (x) { x.onclick = function () { checkOut(x.dataset.co); }; });
  $$('[data-go]', el).forEach(function (x) { x.onclick = function () { location.hash = x.dataset.go; }; });
  $$('[data-tab]', el).forEach(function (x) { x.addEventListener('click', function () { S.bk.tab = x.dataset.tab; }); });
}

/* ---- bar chart (single series, hover tooltips) ---- */
function barChart(host, data, o) {
  var W = o.w || 640, H = o.h || 200, pb = 34, pt = 10, pl = 34, n = data.length, cw = (W - pl) / n, bw = Math.min(28, cw * .56), max = o.max || Math.max.apply(null, data.map(function (d) { return d.v; }).concat([1]));
  var ticks = [0, .25, .5, .75, 1].map(function (f) { return f * max; });
  var sy = function (v) { return pt + (H - pt - pb) * (1 - v / max); };
  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'مخطط') + '">';
  ticks.forEach(function (tv) { s += '<line class="grid-l" x1="' + pl + '" x2="' + W + '" y1="' + sy(tv) + '" y2="' + sy(tv) + '"/><text class="ax" x="0" y="' + (sy(tv) + 4) + '" text-anchor="start">' + Math.round(tv) + (o.unit || '') + '</text>'; });
  data.forEach(function (d, i) {
    // RTL: first item on the right
    var cx = W - (i + .5) * cw, x = cx - bw / 2, y = sy(Math.max(0, d.v)), h = Math.max(0, H - pb - y), r = Math.min(4, h);
    s += '<g class="bg" data-i="' + i + '"><rect class="hit" x="' + (cx - cw / 2) + '" y="' + pt + '" width="' + cw + '" height="' + (H - pt - pb) + '" fill="transparent"/>' +
      (h > 0 ? '<path class="bar-r' + (d.hl ? ' today' : '') + '" d="M' + x + ',' + (H - pb) + 'V' + (y + r) + 'q0,-' + r + ' ' + r + ',-' + r + 'H' + (x + bw - r) + 'q' + r + ',0 ' + r + ',' + r + 'V' + (H - pb) + 'z"/>' : '') +
      '<text class="ax" x="' + cx + '" y="' + (H - pb + 15) + '" text-anchor="middle"' + (d.hl ? ' style="fill:var(--ink);font-weight:700"' : '') + '>' + esc(d.label) + '</text>' +
      (d.sub ? '<text class="ax" x="' + cx + '" y="' + (H - pb + 29) + '" text-anchor="middle" style="font-size:9.5px">' + esc(d.sub) + '</text>' : '') + '</g>';
  });
  s += '</svg><div class="tip" hidden></div>';
  host.innerHTML = s;
  var tip = $('.tip', host), svg = $('svg', host);
  $$('.bg', host).forEach(function (g) {
    g.addEventListener('mouseenter', function () { var d = data[+g.dataset.i], bb = svg.getBoundingClientRect(), hb = host.getBoundingClientRect(), i = +g.dataset.i; tip.textContent = d.tip; tip.hidden = false; tip.style.left = ((W - (i + .5) * cw) / W * bb.width - 0) + 'px'; tip.style.top = (sy(Math.max(0, d.v)) / H * bb.height + (bb.top - hb.top)) + 'px'; tip.style.transform = 'translate(-50%,-115%)'; });
    g.addEventListener('mouseleave', function () { tip.hidden = true; });
  });
}

/* ======================= room rack ======================= */
V.rack = function (el) {
  var t = today(), db = S.db, f = S.rack.f;
  var floors = {}; db.rooms.forEach(function (r) { (floors[r.floor] = floors[r.floor] || []).push(r); });
  var counts = { all: db.rooms.length, vacant: 0, occ: 0, arr: 0, dep: 0, dirty: 0, ooo: 0 };
  var states = {}; db.rooms.forEach(function (r) {
    var s = roomState(r, t); states[r.id] = s;
    if (r.status === 'ooo') counts.ooo++; else if (s.cur) counts.occ++; else counts.vacant++;
    if (s.arr) counts.arr++; if (s.dep) counts.dep++; if (r.status === 'dirty') counts.dirty++;
  });
  var filters = [['all', 'الكل'], ['vacant', 'شاغرة'], ['occ', 'مشغولة'], ['arr', 'وصول اليوم'], ['dep', 'مغادرة اليوم'], ['dirty', 'بحاجة تنظيف'], ['ooo', 'خارج الخدمة']];
  el.innerHTML = '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center"><div class="tabs" id="rackF">' + filters.map(function (x) { return '<button aria-pressed="' + (f === x[0]) + '" data-f="' + x[0] + '">' + x[1] + ' <span class="c">' + counts[x[0]] + '</span></button>'; }).join('') + '</div>' +
    '<div class="legend"><span><i style="background:var(--occ-soft);border:1px solid var(--occ)"></i>مشغولة</span><span><i style="border:2px dashed var(--arr)"></i>وصول اليوم</span><span><i style="background:var(--dep)"></i>مغادرة</span><span><i class="hk-clean"></i>نظيفة</span><span><i class="hk-dirty"></i>بحاجة تنظيف</span><span><i class="hk-inspect"></i>فحص</span></div></div>' +
    '<div class="card"><div class="card-b" style="display:grid;gap:18px">' + Object.keys(floors).sort(function (a, b) { return b - a; }).map(function (fl) {
      var rooms = floors[fl].filter(function (r) { var s = states[r.id]; return f === 'all' || (f === 'vacant' && !s.cur && r.status !== 'ooo') || (f === 'occ' && s.cur) || (f === 'arr' && s.arr) || (f === 'dep' && s.dep) || (f === 'dirty' && r.status === 'dirty') || (f === 'ooo' && r.status === 'ooo'); });
      if (!rooms.length) return '';
      return '<div class="floor"><div class="floor-l"><b class="tn">' + fl + '</b>طابق</div><div class="rooms">' + rooms.map(function (r) {
        var s = states[r.id], cls = 'rt', g = s.cur ? G(s.cur.guestId) : s.arr ? G(s.arr.guestId) : null;
        if (r.status === 'ooo') cls += ' ooo'; else if (s.cur) cls += ' occ'; if (s.arr && !s.cur) cls += ' arr'; if (s.dep) cls += ' dep';
        var sub = r.status === 'ooo' ? esc(r.note || 'خارج الخدمة') : s.cur ? esc(g.name) : s.arr ? 'وصول: ' + esc(g.name) : '';
        var left = s.cur && !s.dep ? '<span class="sub">' + nightsW(U.nightsBetween(t, s.cur.checkOut)) + ' متبقية</span>' : '';
        return '<button class="' + cls + '" data-room="' + r.id + '" title="' + esc(T(r.typeId).name) + ' · ' + HK[r.status] + '"><span class="no">' + r.number + '<i class="hk hk-' + r.status + '"></i></span><span class="ty">' + esc(T(r.typeId).name) + '</span><span class="gn">' + sub + '</span>' + left + '</button>';
      }).join('') + '</div></div>';
    }).join('') + '</div></div>';
  $$('#rackF button').forEach(function (b) { b.onclick = function () { S.rack.f = b.dataset.f; renderView(); }; });
  $$('[data-room]', el).forEach(function (b) { b.onclick = function () { openRoom(b.dataset.room); }; });
};

/* ======================= timeline ======================= */
V.timeline = function (el) {
  var t = today(); if (!S.tl.start) S.tl.start = U.addDays(t, -2);
  var start = S.tl.start, days = S.tl.days, end = U.addDays(start, days), colW = 58, labW = 150, rowH = 40, flH = 28, headH = 46;
  var dates = []; for (var i = 0; i < days; i++) dates.push(U.addDays(start, i));
  var rows = [], y = headH;
  // unassigned lanes
  var un = S.db.bookings.filter(function (b) { return HOLD[b.status] && !b.roomId && b.checkIn < end && b.checkOut > start; }).sort(function (a, b) { return a.checkIn.localeCompare(b.checkIn); });
  var lanes = [];
  un.forEach(function (b) { for (var l = 0; l < lanes.length; l++) { if (lanes[l] <= b.checkIn) { lanes[l] = b.checkOut; b._lane = l; return; } } b._lane = lanes.length; lanes.push(b.checkOut); });
  var bars = [];
  if (lanes.length) {
    rows.push({ k: 'fl', label: 'بدون غرفة — اسحب الحجز إلى غرفة لتخصيصها', y: y }); y += flH;
    lanes.forEach(function (_, l) { rows.push({ k: 'lane', label: 'حجز غير مخصص', y: y, lane: l }); y += rowH; });
    un.forEach(function (b) { bars.push({ b: b, y: rows.filter(function (r) { return r.k === 'lane' && r.lane === b._lane; })[0].y }); });
  }
  var floors = {}; S.db.rooms.forEach(function (r) { (floors[r.floor] = floors[r.floor] || []).push(r); });
  var roomY = {};
  Object.keys(floors).sort(function (a, b) { return a - b; }).forEach(function (fl) {
    rows.push({ k: 'fl', label: 'الطابق ' + fl, y: y }); y += flH;
    floors[fl].forEach(function (r) { rows.push({ k: 'room', r: r, y: y }); roomY[r.id] = y; y += rowH; });
  });
  S.db.bookings.forEach(function (b) { if (b.roomId && (HOLD[b.status] || b.status === 'checked_out') && b.checkIn < end && b.checkOut > start && roomY[b.roomId] != null) bars.push({ b: b, y: roomY[b.roomId] }); });
  var totalW = labW + days * colW;
  var html = '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div class="tabs"><button id="tlPrev">→ السابق</button><button id="tlToday">اليوم</button><button id="tlNext">التالي ←</button></div>' +
    '<div class="tabs">' + [14, 21, 30].map(function (d) { return '<button data-days="' + d + '" aria-pressed="' + (days === d) + '">' + d + ' يوماً</button>'; }).join('') + '</div>' +
    '<div class="legend" style="margin-inline-start:auto"><span><i style="background:var(--warn)"></i>بانتظار التأكيد</span><span><i style="background:var(--info)"></i>مؤكد</span><span><i style="background:var(--ok)"></i>مقيم</span><span><i style="background:var(--ooo)"></i>غادر</span></div></div>' +
    '<div class="card"><div class="card-h"><h3>' + dShort(start) + ' — ' + dShort(U.addDays(end, -1)) + '</h3><span class="sub">اضغط على خانة فارغة لإنشاء حجز، واسحب الحجز لنقله إلى غرفة أو تاريخ آخر.</span></div><div class="tl-wrap" id="tlWrap"><div class="tl" id="tl" style="width:' + totalW + 'px;height:' + y + 'px;position:relative">';
  // header
  html += '<div class="tl-corner" style="position:absolute;right:0;top:0;width:' + labW + 'px;height:' + headH + 'px"></div>';
  dates.forEach(function (d, i) { var dow = dD(d).getUTCDay(); html += '<div class="tl-h' + (d === t ? ' today' : '') + (dow === 5 || dow === 6 ? ' wk' : '') + '" style="position:absolute;top:0;right:' + (labW + i * colW) + 'px;width:' + colW + 'px;height:' + headH + 'px"><b class="tn">' + dD(d).getUTCDate() + '</b>' + DOWS[dow].replace('ال', '').slice(0, 3) + '</div>'; });
  rows.forEach(function (r) {
    if (r.k === 'fl') { html += '<div class="tl-fl" style="position:absolute;right:0;top:' + r.y + 'px;width:' + totalW + 'px;height:' + flH + 'px">' + esc(r.label) + '</div>'; return; }
    var lab = r.k === 'room' ? '<b>' + r.r.number + '</b><span class="sub">' + esc(T(r.r.typeId).name) + '</span><i class="hk hk-' + r.r.status + '" style="width:8px;height:8px;border-radius:50%;display:inline-block;margin-inline-start:auto"></i>' : '<span class="sub">' + r.label + '</span>';
    html += '<div class="tl-rl" style="position:absolute;right:0;top:' + r.y + 'px;width:' + labW + 'px;height:' + rowH + 'px;border-bottom:1px solid var(--line-2)">' + lab + '</div>';
    dates.forEach(function (d, i) { html += '<div class="tl-c' + (d === t ? ' today' : '') + '" data-room="' + (r.k === 'room' ? r.r.id : '') + '" data-d="' + d + '" style="position:absolute;top:' + r.y + 'px;right:' + (labW + i * colW) + 'px;width:' + colW + 'px;height:' + rowH + 'px"></div>'; });
  });
  bars.forEach(function (x) {
    var b = x.b, si = Math.max(0, U.nightsBetween(start, b.checkIn)), ei = Math.min(days, U.nightsBetween(start, b.checkOut));
    var x0 = si * colW + (b.checkIn >= start ? colW / 2 : 0), x1 = Math.min(days * colW, ei * colW + (b.checkOut <= end ? colW / 2 : 0));
    var w = x1 - x0 - 3; if (w < 8) return;
    var g = G(b.guestId);
    html += '<div class="tl-b st-' + b.status + '" draggable="' + (b.status !== 'checked_out') + '" data-bar="' + b.id + '" title="' + esc(g.name) + ' · ' + b.code + ' · ' + STATUS[b.status] + '" style="top:' + (x.y + 5) + 'px;right:' + (labW + x0) + 'px;width:' + w + 'px">' + esc(g.name) + ' <small>' + nightsW(U.nightsBetween(b.checkIn, b.checkOut)) + '</small></div>';
  });
  html += '</div></div></div>';
  el.innerHTML = html;
  // scroll to today
  var wrap = $('#tlWrap');
  $('#tlPrev').onclick = function () { S.tl.start = U.addDays(S.tl.start, -7); renderView(); };
  $('#tlNext').onclick = function () { S.tl.start = U.addDays(S.tl.start, 7); renderView(); };
  $('#tlToday').onclick = function () { S.tl.start = U.addDays(t, -2); renderView(); };
  $$('[data-days]', el).forEach(function (b) { b.onclick = function () { S.tl.days = +b.dataset.days; renderView(); }; });
  var tl = $('#tl'), drag = null;
  tl.addEventListener('click', function (e) {
    var bar = e.target.closest('[data-bar]'); if (bar) { openBooking(bar.dataset.bar); return; }
    var c = e.target.closest('.tl-c'); if (c && c.dataset.room && !isHK()) newBooking({ roomId: c.dataset.room, checkIn: c.dataset.d < t ? t : c.dataset.d });
  });
  tl.addEventListener('dragstart', function (e) {
    var bar = e.target.closest('[data-bar]'); if (!bar) return;
    var rect = bar.getBoundingClientRect(), b = B(bar.dataset.bar);
    var offDays = Math.floor((rect.right - e.clientX + (b.checkIn >= start ? colW / 2 : -(U.nightsBetween(b.checkIn, start)) * colW)) / colW);
    drag = { id: b.id, off: Math.max(0, offDays) }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', b.id); } catch (x) {}
  });
  tl.addEventListener('dragover', function (e) { var c = e.target.closest('.tl-c'); if (!c || !drag || !c.dataset.room) return; e.preventDefault(); $$('.tl-c.drop', tl).forEach(function (x) { x.classList.remove('drop'); }); c.classList.add('drop'); });
  tl.addEventListener('dragleave', function (e) { var c = e.target.closest('.tl-c'); if (c) c.classList.remove('drop'); });
  tl.addEventListener('drop', function (e) {
    e.preventDefault(); var c = e.target.closest('.tl-c'); $$('.tl-c.drop', tl).forEach(function (x) { x.classList.remove('drop'); });
    if (!c || !drag || !c.dataset.room) return;
    var b = B(drag.id), n = U.nightsBetween(b.checkIn, b.checkOut), body = { roomId: c.dataset.room };
    if (b.status !== 'in_house') { var ci = U.addDays(c.dataset.d, -drag.off); if (ci !== b.checkIn) { body.checkIn = ci; body.checkOut = U.addDays(ci, n); } }
    var r = R(c.dataset.room); drag = null;
    if (body.roomId === b.roomId && !body.checkIn) return;
    act(API.patch('/api/staff/bookings/' + b.id, body), 'نُقل الحجز إلى الغرفة ' + r.number + (body.checkIn ? ' · ' + dShort(body.checkIn) : '')).catch(function () {});
  });
  // center today
  var ti = U.nightsBetween(start, t); if (ti >= 0 && ti < days && wrap.scrollLeft === 0) { /* already visible */ }
};

/* ======================= bookings list ======================= */
V.bookings = function (el) {
  var t = today(), db = S.db, st = S.bk;
  var tabs = [
    ['active', 'الحالية والقادمة', function (b) { return HOLD[b.status]; }],
    ['pending', 'بانتظار التأكيد', function (b) { return b.status === 'pending'; }],
    ['arrivals', 'وصول اليوم', function (b) { return (b.status === 'confirmed' || b.status === 'pending') && b.checkIn <= t && b.checkOut > t; }],
    ['in_house', 'مقيمون', function (b) { return b.status === 'in_house'; }],
    ['checked_out', 'غادروا', function (b) { return b.status === 'checked_out'; }],
    ['cancelled', 'ملغاة ولم يحضر', function (b) { return b.status === 'cancelled' || b.status === 'no_show'; }],
    ['all', 'الكل', function () { return true; }]
  ];
  var tab = tabs.filter(function (x) { return x[0] === st.tab; })[0] || tabs[0];
  var q = st.q.trim().toLowerCase(), qd = q.replace(/[^\d]/g, '');
  var list = db.bookings.filter(tab[2]).filter(function (b) {
    if (st.src && b.source !== st.src) return false;
    if (!q) return true; var g = G(b.guestId);
    return b.code.toLowerCase().indexOf(q) >= 0 || g.name.toLowerCase().indexOf(q) >= 0 || (qd.length >= 3 && U.normPhone(g.phone).indexOf(qd) >= 0) || (b.roomId && R(b.roomId).number === q);
  });
  var past = st.tab === 'checked_out' || st.tab === 'cancelled' || st.tab === 'all';
  list.sort(function (a, b) { return past ? b.checkIn.localeCompare(a.checkIn) : a.checkIn.localeCompare(b.checkIn); });
  el.innerHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><div class="tabs" id="bkTabs">' + tabs.map(function (x) { return '<button data-t="' + x[0] + '" aria-pressed="' + (x[0] === tab[0]) + '">' + x[1] + ' <span class="c">' + db.bookings.filter(x[2]).length + '</span></button>'; }).join('') + '</div></div>' +
    '<div class="card"><div class="card-h" style="flex-wrap:wrap"><input class="in" id="bkQ" placeholder="بحث بالاسم أو الهاتف أو رقم الحجز أو الغرفة" value="' + esc(st.q) + '" style="max-width:340px"><select class="in" id="bkSrc" style="max-width:170px"><option value="">كل المصادر</option>' + Object.keys(SOURCE).map(function (k) { return '<option value="' + k + '"' + (st.src === k ? ' selected' : '') + '>' + SOURCE[k] + '</option>'; }).join('') + '</select>' +
    '<div class="sp"><span class="sub">' + list.length + ' حجز</span>' + (S.mode === 'server' ? '<button class="btn btn-s btn-sm" id="bkCsv">' + ic('dl', 15) + ' تصدير CSV</button>' : '') + '</div></div>' +
    '<div class="tbl-wrap"><table><thead><tr><th>رقم الحجز</th><th>الضيف</th><th>الغرفة</th><th>الوصول</th><th>المغادرة</th><th class="n">ليالٍ</th><th>الحالة</th><th>المصدر</th><th class="n">المجموع</th><th class="n">المستحق</th></tr></thead><tbody>' +
    (list.slice(0, st.limit).map(function (b) {
      var g = G(b.guestId), f = folio(b);
      return '<tr data-b="' + b.id + '"><td><span class="ltr tn" style="font-weight:600">' + b.code + '</span></td><td><div class="gname">' + (g.vip ? '<span style="color:var(--brass)">' + ic('star', 13) + '</span> ' : '') + esc(g.name) + '</div><div class="sub ltr">' + esc(g.phone) + '</div></td>' +
        '<td>' + (b.roomId ? '<b class="tn">' + R(b.roomId).number + '</b> ' : '<span class="tag">غير مخصصة</span> ') + '<div class="sub">' + esc(T(b.typeId).name) + '</div></td><td class="tn">' + dShort(b.checkIn) + '</td><td class="tn">' + dShort(b.checkOut) + '</td><td class="n">' + U.nightsBetween(b.checkIn, b.checkOut) + '</td><td>' + pill(b.status) + '</td><td>' + SOURCE[b.source] + '</td>' +
        '<td class="n">' + money(f.total) + '</td><td class="n" style="' + (f.balance > 0.009 && b.status !== 'cancelled' && b.status !== 'no_show' ? 'color:var(--bad);font-weight:600' : 'color:var(--muted)') + '">' + (b.status === 'cancelled' || b.status === 'no_show' ? '—' : money(f.balance)) + '</td></tr>';
    }).join('') || '<tr><td colspan="10"><div class="empty">لا توجد حجوزات مطابقة</div></td></tr>') + '</tbody></table></div>' +
    (list.length > st.limit ? '<div style="padding:12px;text-align:center"><button class="btn btn-s" id="bkMore">عرض المزيد (' + (list.length - st.limit) + ')</button></div>' : '') + '</div>';
  $$('#bkTabs button').forEach(function (b) { b.onclick = function () { st.tab = b.dataset.t; st.limit = 80; renderView(); }; });
  var qi = $('#bkQ'); qi.oninput = function () { st.q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(function () { var pos = qi.selectionStart; renderView(); var n = $('#bkQ'); n.focus(); n.setSelectionRange(pos, pos); }, 250); };
  $('#bkSrc').onchange = function () { st.src = this.value; renderView(); };
  if ($('#bkMore')) $('#bkMore').onclick = function () { st.limit += 200; renderView(); };
  if ($('#bkCsv')) $('#bkCsv').onclick = function () { csv('bookings-' + t + '.csv', [['رقم الحجز', 'الضيف', 'الهاتف', 'النوع', 'الغرفة', 'الوصول', 'المغادرة', 'الليالي', 'الحالة', 'المصدر', 'المجموع', 'المدفوع', 'المستحق']].concat(list.map(function (b) { var g = G(b.guestId), f = folio(b); return [b.code, g.name, g.phone, T(b.typeId).name, b.roomId ? R(b.roomId).number : '', b.checkIn, b.checkOut, U.nightsBetween(b.checkIn, b.checkOut), STATUS[b.status], SOURCE[b.source], f.total, f.paid, f.balance]; }))); };
  wireCommon(el);
};
function csv(name, rows) {
  var s = '﻿' + rows.map(function (r) { return r.map(function (c) { c = String(c == null ? '' : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

/* ======================= guests ======================= */
function guestStats(g) {
  var bs = (S.idx.byGuest[g.id] || []).filter(function (b) { return b.status === 'checked_out' || b.status === 'in_house'; });
  var nights = bs.reduce(function (a, b) { return a + U.nightsBetween(b.checkIn, b.checkOut); }, 0);
  var spent = (S.idx.byGuest[g.id] || []).reduce(function (a, b) { return a + folio(b).paid; }, 0);
  var last = bs.map(function (b) { return b.checkIn; }).sort().pop();
  return { stays: bs.length, nights: nights, spent: spent, last: last };
}
V.guests = function (el) {
  var q = S.g.q.trim().toLowerCase(), qd = q.replace(/[^\d]/g, '');
  var list = S.db.guests.filter(function (g) { return !q || g.name.toLowerCase().indexOf(q) >= 0 || (qd.length >= 3 && U.normPhone(g.phone).indexOf(qd) >= 0) || (g.idNumber || '').indexOf(q) >= 0; });
  var rows = list.map(function (g) { return { g: g, s: guestStats(g) }; }).sort(function (a, b) { return (b.s.last || '').localeCompare(a.s.last || '') || b.g.createdAt - a.g.createdAt; });
  el.innerHTML = '<div class="card"><div class="card-h" style="flex-wrap:wrap"><input class="in" id="gQ" placeholder="بحث بالاسم أو الهاتف أو رقم الهوية" value="' + esc(S.g.q) + '" style="max-width:340px"><div class="sp"><span class="sub">' + list.length + ' ضيف</span><button class="btn btn-p btn-sm" id="gAdd">' + ic('plus', 15) + ' ضيف جديد</button></div></div>' +
    '<div class="tbl-wrap"><table><thead><tr><th>الضيف</th><th>الهاتف</th><th>الجنسية</th><th>الوثيقة</th><th class="n">الإقامات</th><th class="n">الليالي</th><th class="n">المدفوع</th><th>آخر إقامة</th></tr></thead><tbody>' +
    rows.slice(0, 300).map(function (x) { var g = x.g, s = x.s; return '<tr data-g="' + g.id + '"><td><span class="gname">' + (g.vip ? '<span style="color:var(--brass)">' + ic('star', 13) + '</span> ' : '') + esc(g.name) + '</span>' + (g.blacklist ? ' <span class="pill s-cancelled">محظور</span>' : '') + '</td><td><span class="ltr tn">' + esc(g.phone) + '</span></td><td>' + esc(g.nationality || '—') + '</td><td>' + (g.idNumber ? esc(g.idType || '') + ' <span class="tn">' + esc(g.idNumber) + '</span>' : '<span class="muted">—</span>') + '</td><td class="n">' + s.stays + '</td><td class="n">' + s.nights + '</td><td class="n">' + money(s.spent) + '</td><td class="tn">' + (s.last ? dShort(s.last) : '—') + '</td></tr>'; }).join('') +
    (rows.length ? '' : '<tr><td colspan="8"><div class="empty">لا يوجد ضيوف مطابقون</div></td></tr>') + '</tbody></table></div></div>';
  var qi = $('#gQ'); qi.oninput = function () { S.g.q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(function () { var pos = qi.selectionStart; renderView(); var n = $('#gQ'); n.focus(); n.setSelectionRange(pos, pos); }, 250); };
  $('#gAdd').onclick = function () { guestForm(null); };
  $$('[data-g]', el).forEach(function (r) { r.onclick = function () { openGuest(r.dataset.g); }; });
};

/* ======================= housekeeping ======================= */
V.hk = function (el) {
  var t = today(), fl = S.hk.floor, db = S.db;
  var floors = []; db.rooms.forEach(function (r) { if (floors.indexOf(r.floor) < 0) floors.push(r.floor); }); floors.sort();
  var rooms = db.rooms.filter(function (r) { return fl === 'all' || r.floor === +fl; });
  var order = { dirty: 0, inspect: 1, clean: 2, ooo: 3 };
  rooms = rooms.slice().sort(function (a, b) { return order[a.status] - order[b.status] || a.number.localeCompare(b.number, 'en', { numeric: true }); });
  var c = { dirty: 0, inspect: 0, clean: 0, ooo: 0 }; db.rooms.forEach(function (r) { c[r.status]++; });
  el.innerHTML = '<div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">' + kpi('بحاجة تنظيف', c.dirty, 'ابدأ بغرف الوصول اليوم') + kpi('بانتظار الفحص', c.inspect, 'بعد التنظيف') + kpi('نظيفة', c.clean, 'جاهزة للضيوف') + kpi('خارج الخدمة', c.ooo, 'صيانة') + '</div>' +
    '<div class="tabs" id="hkF"><button data-f="all" aria-pressed="' + (fl === 'all') + '">كل الطوابق</button>' + floors.map(function (f) { return '<button data-f="' + f + '" aria-pressed="' + (String(fl) === String(f)) + '">الطابق ' + f + '</button>'; }).join('') + '</div>' +
    '<div class="rooms" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px">' + rooms.map(function (r) {
      var s = roomState(r, t), flags = [];
      if (s.arr && !s.cur) flags.push('<span class="pill s-pending">وصول اليوم</span>');
      if (s.dep) flags.push('<span class="pill" style="background:var(--dep-soft);color:var(--dep)">مغادرة اليوم</span>');
      if (s.cur && !s.dep) flags.push('<span class="pill s-confirmed">مشغولة</span>');
      return '<div class="card" style="padding:14px;display:grid;gap:10px' + (r.status === 'dirty' ? ';border-color:var(--warn)' : '') + '"><div style="display:flex;align-items:center;gap:10px"><span class="rn" style="font-size:17px">' + r.number + '</span><div style="flex:1"><b>' + HK[r.status] + '</b><div class="sub">' + esc(T(r.typeId).name) + (r.note ? ' · ' + esc(r.note) : '') + '</div></div><i class="hk hk-' + r.status + '" style="width:12px;height:12px;border-radius:50%"></i></div>' +
        (flags.length ? '<div class="chips">' + flags.join('') + '</div>' : '') +
        '<div class="chips">' + (r.status !== 'clean' && r.status !== 'ooo' ? '<button class="btn btn-ok btn-sm" data-hk="' + r.id + '" data-s="clean">' + ic('check', 14) + ' تم التنظيف</button>' : '') +
        (r.status === 'dirty' ? '<button class="btn btn-s btn-sm" data-hk="' + r.id + '" data-s="inspect">للفحص</button>' : '') +
        (r.status === 'clean' ? '<button class="btn btn-s btn-sm" data-hk="' + r.id + '" data-s="dirty">بحاجة تنظيف</button>' : '') +
        (!isHK() ? (r.status === 'ooo' ? '<button class="btn btn-s btn-sm" data-hk="' + r.id + '" data-s="dirty">إعادة للخدمة</button>' : '<button class="btn btn-s btn-sm" data-ooo="' + r.id + '">خارج الخدمة</button>') : '') + '</div></div>';
    }).join('') + '</div>';
  $$('#hkF button').forEach(function (b) { b.onclick = function () { S.hk.floor = b.dataset.f; renderView(); }; });
  $$('[data-hk]', el).forEach(function (b) { b.onclick = function () { setRoomStatus(b.dataset.hk, b.dataset.s); }; });
  $$('[data-ooo]', el).forEach(function (b) { b.onclick = function () { oooModal(b.dataset.ooo); }; });
};
function setRoomStatus(id, s, note) {
  var body = { status: s }; if (note != null) body.note = note; else if (s !== 'ooo') body.note = '';
  return act(API.patch('/api/staff/rooms/' + id, body), 'الغرفة ' + R(id).number + ': ' + HK[s]);
}
function oooModal(id) {
  var r = R(id);
  modal('<div class="dr-h"><h2>إخراج الغرفة ' + r.number + ' من الخدمة</h2></div><div class="dr-b"><div class="fld"><label for="oooN">السبب</label><input class="in" id="oooN" placeholder="مثلاً: صيانة التكييف"></div></div><div class="dr-f"><button class="btn btn-p" id="oooOk">تأكيد</button><button class="btn btn-s" data-x>إلغاء</button></div>', true);
  $('#oooOk').onclick = function () { setRoomStatus(id, 'ooo', $('#oooN').value).then(closeModal).catch(function () {}); };
}

/* ======================= reports ======================= */
function periodRange(p) {
  var t = today(), d = dD(t);
  if (p === 'today') return [t, t];
  if (p === 'week') return [U.addDays(t, -6), t];
  if (p === 'month') return [t.slice(0, 8) + '01', t];
  if (p === 'last') { var f = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 10); var l = U.addDays(t.slice(0, 8) + '01', -1); return [f, l]; }
  if (p === 'next30') return [t, U.addDays(t, 29)];
  return [S.rep.from || t, S.rep.to || t];
}
V.reports = function (el) {
  var rp = S.rep, t = today();
  var rg = periodRange(rp.preset); if (rp.preset !== 'custom') { rp.from = rg[0]; rp.to = rg[1]; }
  var from = rp.from, to = rp.to, dates = [], d = from; while (d <= to && dates.length < 400) { dates.push(d); d = U.addDays(d, 1); }
  var inv = S.db.rooms.length, avail = inv * dates.length, db = S.db;
  var SOLD = { in_house: 1, checked_out: 1, confirmed: 1 };
  var sold = 0, roomRev = 0, byType = {}, bySrc = {}, byNat = {}, daily = [];
  dates.forEach(function (dd) {
    var n = 0, rv = 0;
    db.bookings.forEach(function (b) { if (!SOLD[b.status] || b.checkIn > dd || b.checkOut <= dd) return; var p = nightPrice(b, dd); n++; rv += p; byType[b.typeId] = (byType[b.typeId] || 0) + p; });
    sold += n; roomRev += rv; daily.push({ d: dd, n: n, rv: rv });
  });
  var created = db.bookings.filter(function (b) { var c = new Date(b.createdAt + 3 * 3600e3).toISOString().slice(0, 10); return c >= from && c <= to; });
  created.forEach(function (b) { bySrc[b.source] = (bySrc[b.source] || 0) + 1; });
  var stays = db.bookings.filter(function (b) { return SOLD[b.status] && b.checkIn <= to && b.checkOut > from; });
  stays.forEach(function (b) { var n = G(b.guestId).nationality || 'غير محدد'; byNat[n] = (byNat[n] || 0) + 1; });
  var cancels = created.filter(function (b) { return b.status === 'cancelled' || b.status === 'no_show'; }).length;
  var extras = db.charges.filter(function (c) { return c.date >= from && c.date <= to; }), extrasRev = extras.reduce(function (a, c) { return a + c.amount * (c.qty || 1); }, 0);
  var byCat = {}; extras.forEach(function (c) { byCat[c.category] = (byCat[c.category] || 0) + c.amount * (c.qty || 1); });
  var pays = db.payments.filter(function (p) { return p.date >= from && p.date <= to; }), collected = pays.reduce(function (a, p) { return a + p.amount; }, 0);
  var byMethod = {}; pays.forEach(function (p) { var k = METHOD[p.method] + (p.currency === 'SYP' ? ' (ليرة)' : ' (دولار)'); byMethod[k] = (byMethod[k] || 0) + p.amount; });
  var sypCash = pays.filter(function (p) { return p.currency === 'SYP'; }).reduce(function (a, p) { return a + p.originalAmount; }, 0);
  var occ = avail ? sold / avail * 100 : 0, adr = sold ? roomRev / sold : 0, revpar = avail ? roomRev / avail : 0;
  var presets = [['today', 'اليوم'], ['week', 'آخر 7 أيام'], ['month', 'هذا الشهر'], ['last', 'الشهر الماضي'], ['next30', 'الـ 30 يوماً القادمة'], ['custom', 'مخصص']];
  function hlist(obj, fmt, labels) { var ks = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; }), mx = Math.max.apply(null, ks.map(function (k) { return obj[k]; }).concat([1])); return ks.length ? ks.slice(0, 8).map(function (k) { return '<div class="hbar"><span>' + esc(labels ? labels(k) : k) + '</span><div class="t"><i style="width:' + (obj[k] / mx * 100) + '%"></i></div><span class="n">' + fmt(obj[k]) + '</span></div>'; }).join('') : '<div class="empty">لا بيانات في هذه الفترة</div>'; }
  var day = rp.day || t;
  el.innerHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><div class="tabs" id="repP">' + presets.map(function (p) { return '<button data-p="' + p[0] + '" aria-pressed="' + (rp.preset === p[0]) + '">' + p[1] + '</button>'; }).join('') + '</div>' +
    '<div style="display:flex;gap:6px;align-items:center"><input class="in" type="date" id="repF" value="' + from + '" style="width:auto"><span class="muted">إلى</span><input class="in" type="date" id="repT" value="' + to + '" style="width:auto"></div>' +
    (S.mode === 'server' ? '<button class="btn btn-s btn-sm" id="repPrint" style="margin-inline-start:auto">' + ic('print', 15) + ' طباعة</button><button class="btn btn-s btn-sm" id="repCsv">' + ic('dl', 15) + ' تصدير المقبوضات</button>' : '') + '</div>' +
    '<div class="kpis">' + kpi('نسبة الإشغال', occ.toFixed(1) + '<small>%</small>', sold + ' ليلة مباعة من ' + avail, occ) + kpi('إيراد الغرف', '<span class="ltr">' + money(roomRev) + '</span>', dates.length + ' يوم') + kpi('متوسط سعر الليلة', '<span class="ltr">' + money(adr) + '</span>', 'ADR') + kpi('العائد لكل غرفة', '<span class="ltr">' + money(revpar) + '</span>', 'RevPAR') + kpi('الخدمات الإضافية', '<span class="ltr">' + money(extrasRev) + '</span>', extras.length + ' بند') + kpi('المقبوضات', '<span class="ltr">' + money(collected) + '</span>', sypCash ? 'منها ' + sypFmt(sypCash) + ' نقداً' : pays.length + ' دفعة') + '</div>' +
    '<div class="card"><div class="card-h"><h3>الإشغال اليومي</h3><span class="sub">' + dShort(from) + ' — ' + dShort(to) + '</span></div><div class="card-b"><div class="chart" id="repChart"></div></div></div>' +
    '<div class="grid g3">' +
      '<div class="card"><div class="card-h"><h3>إيراد الغرف حسب النوع</h3></div><div class="card-b">' + hlist(byType, money, function (k) { return T(k).name; }) + '</div></div>' +
      '<div class="card"><div class="card-h"><h3>الحجوزات الجديدة حسب المصدر</h3><span class="tag">' + created.length + '</span></div><div class="card-b">' + hlist(bySrc, function (v) { return v; }, function (k) { return SOURCE[k]; }) + '<p class="sub" style="margin-top:8px">الإلغاء وعدم الحضور: ' + cancels + '</p></div></div>' +
      '<div class="card"><div class="card-h"><h3>الجنسيات</h3></div><div class="card-b">' + hlist(byNat, function (v) { return v; }) + '</div></div>' +
      '<div class="card"><div class="card-h"><h3>المقبوضات حسب الطريقة</h3></div><div class="card-b">' + hlist(byMethod, money) + '</div></div>' +
      '<div class="card"><div class="card-h"><h3>الخدمات الإضافية</h3></div><div class="card-b">' + hlist(byCat, money, function (k) { return CAT[k] || k; }) + '</div></div>' +
      '<div class="card"><div class="card-h"><h3>المقبوضات حسب الموظف</h3></div><div class="card-b">' + hlist(pays.reduce(function (a, p) { a[p.by] = (a[p.by] || 0) + p.amount; return a; }, {}), money) + '</div></div>' +
    '</div>' +
    '<div class="card" id="dayRep"><div class="card-h"><h3>التقرير اليومي</h3><div class="sp"><input class="in" type="date" id="repDay" value="' + day + '" style="width:auto"></div></div><div class="card-b" id="dayBody"></div></div>';
  var step = Math.ceil(daily.length / 31);
  var cd = daily.filter(function (_, i) { return i % step === 0; }).map(function (x) { return { label: dD(x.d).getUTCDate() + '', sub: daily.length <= 14 ? DOWS[dD(x.d).getUTCDay()].replace('ال', '').slice(0, 3) : '', v: inv ? x.n / inv * 100 : 0, tip: dShort(x.d) + ': ' + x.n + ' غرفة · ' + money(x.rv), hl: x.d === t }; });
  barChart($('#repChart'), cd, { max: 100, unit: '%', h: 210 });
  $$('#repP button').forEach(function (b) { b.onclick = function () { rp.preset = b.dataset.p; renderView(); }; });
  $('#repF').onchange = $('#repT').onchange = function () { var f = $('#repF').value, tt = $('#repT').value; if (f && tt && f <= tt) { rp.preset = 'custom'; rp.from = f; rp.to = tt; renderView(); } };
  $('#repDay').onchange = function () { rp.day = this.value; renderDay(); };
  if ($('#repPrint')) $('#repPrint').onclick = function () { document.body.classList.add('printing-report'); window.print(); setTimeout(function () { document.body.classList.remove('printing-report'); }, 500); };
  if ($('#repCsv')) $('#repCsv').onclick = function () { csv('payments-' + from + '-' + to + '.csv', [['التاريخ', 'رقم الحجز', 'الضيف', 'المبلغ بالدولار', 'المبلغ الأصلي', 'العملة', 'الطريقة', 'الموظف', 'ملاحظة']].concat(pays.map(function (p) { var b = B(p.bookingId) || {}; return [p.date, b.code, G(b.guestId).name, p.amount, p.originalAmount, p.currency, METHOD[p.method], p.by, p.note]; }))); };
  function renderDay() {
    var dd = rp.day || t;
    var arr = db.bookings.filter(function (b) { return b.checkIn === dd && b.status !== 'cancelled'; }), dep = db.bookings.filter(function (b) { return b.checkOut === dd && (b.status === 'checked_out' || b.status === 'in_house'); });
    var ih = db.bookings.filter(function (b) { return (b.status === 'in_house' || b.status === 'checked_out') && b.checkIn <= dd && b.checkOut > dd; });
    var pd = db.payments.filter(function (p) { return p.date === dd; });
    function tb(title, arr2, cols) { return '<div><div class="sec-t" style="margin:6px 0">' + title + ' (' + arr2.length + ')</div>' + (arr2.length ? '<div class="tbl-wrap"><table><tbody>' + arr2.map(cols).join('') + '</tbody></table></div>' : '<p class="muted" style="padding:6px 0">لا يوجد</p>') + '</div>'; }
    var br = function (b) { var g = G(b.guestId); return '<tr data-b="' + b.id + '"><td class="tn" style="width:60px"><b>' + (b.roomId ? R(b.roomId).number : '—') + '</b></td><td>' + esc(g.name) + '</td><td class="sub">' + esc(T(b.typeId).name) + '</td><td>' + pill(b.status) + '</td><td class="n">' + money(folio(b).balance) + '</td></tr>'; };
    $('#dayBody').innerHTML = '<div class="grid g2">' + tb('الوصول', arr, br) + tb('المغادرة', dep, br) + '</div>' + tb('المقيمون تلك الليلة', ih, br) +
      tb('المقبوضات · ' + money(pd.reduce(function (a, p) { return a + p.amount; }, 0)), pd, function (p) { var b = B(p.bookingId) || {}; return '<tr data-b="' + b.id + '"><td class="ltr tn">' + esc(b.code) + '</td><td>' + esc(G(b.guestId).name) + '</td><td>' + METHOD[p.method] + '</td><td class="sub">' + esc(p.by) + '</td><td class="n">' + (p.currency === 'SYP' ? sypFmt(p.originalAmount) + ' · ' : '') + money(p.amount) + '</td></tr>'; });
    wireCommon($('#dayBody'));
  }
  renderDay();
};

/* ======================= rates & rooms ======================= */
V.rates = function (el) {
  var db = S.db, s = db.settings, t = today();
  var days14 = []; for (var i = 0; i < 14; i++) days14.push(U.addDays(t, i));
  el.innerHTML = '<div class="card"><div class="card-h"><h3>أنواع الغرف والأسعار الأساسية</h3><div class="sp"><button class="btn btn-p btn-sm" id="tAdd">' + ic('plus', 15) + ' نوع جديد</button></div></div><div class="tbl-wrap"><table><thead><tr><th>النوع</th><th class="n">عدد الغرف</th><th class="n">السعة</th><th class="n">المساحة</th><th class="n">سعر الليلة</th><th>على الموقع</th><th></th></tr></thead><tbody>' +
    db.roomTypes.slice().sort(function (a, b) { return a.order - b.order; }).map(function (ty) { return '<tr><td><div style="display:flex;gap:10px;align-items:center"><img src="' + esc((ty.images || [])[0] || 'media/lobby-1.webp') + '" alt="" style="width:54px;height:40px;object-fit:cover;border-radius:8px"><b>' + esc(ty.name) + '</b></div></td><td class="n">' + db.rooms.filter(function (r) { return r.typeId === ty.id; }).length + '</td><td class="n">' + ty.capacity + (ty.maxChildren ? '+' + ty.maxChildren : '') + '</td><td class="n">' + ty.size + ' م²</td><td class="n"><div style="display:inline-flex;gap:6px;align-items:center"><span class="muted">$</span><input class="in tn" type="number" min="0" step="1" value="' + ty.price + '" data-price="' + ty.id + '" style="width:90px;text-align:center"></div></td><td>' + (ty.online !== false ? '<span class="pill s-in_house">ظاهر</span>' : '<span class="pill s-checked_out">مخفي</span>') + '</td><td><button class="btn btn-s btn-sm" data-edit="' + ty.id + '">تعديل</button></td></tr>'; }).join('') + '</tbody></table></div></div>' +
    '<div class="grid g2"><div class="card"><div class="card-h"><h3>المواسم والعروض</h3></div><div class="card-b" style="display:grid;gap:12px">' +
      (db.rates.length ? db.rates.map(function (r) { return '<div class="folio-l"><div><b>' + esc(r.name) + '</b><div class="sub">' + dShort(r.from) + ' — ' + dShort(r.to) + ' · ' + (r.typeId ? esc(T(r.typeId).name) : 'كل الغرف') + '</div></div><span class="tag">' + (r.mode === 'fixed' ? '$' + r.value + ' لليلة' : (r.value > 0 ? '+' : '') + r.value + '%') + '</span><button class="icon-btn" data-rdel="' + r.id + '" title="حذف">' + ic('trash', 16) + '</button></div>'; }).join('') : '<p class="muted">لا توجد مواسم. أضف موسماً لرفع السعر في الأعياد أو عرضاً لتخفيضه.</p>') +
      '<div class="sec-t">إضافة موسم أو عرض</div><div class="frow"><div class="fld"><label for="rN">الاسم</label><input class="in" id="rN" placeholder="موسم الصيف"></div><div class="fld"><label for="rF">من</label><input class="in" type="date" id="rF" value="' + t + '"></div><div class="fld"><label for="rT">إلى</label><input class="in" type="date" id="rT" value="' + U.addDays(t, 7) + '"></div></div>' +
      '<div class="frow"><div class="fld"><label for="rTy">النوع</label><select class="in" id="rTy"><option value="">كل الغرف</option>' + db.roomTypes.map(function (ty) { return '<option value="' + ty.id + '">' + esc(ty.name) + '</option>'; }).join('') + '</select></div><div class="fld"><label for="rM">التعديل</label><select class="in" id="rM"><option value="pct">نسبة مئوية %</option><option value="fixed">سعر ثابت $</option></select></div><div class="fld"><label for="rV">القيمة</label><input class="in" type="number" id="rV" value="15"></div></div>' +
      '<button class="btn btn-p" id="rAdd" style="justify-self:start">إضافة</button></div></div>' +
    '<div class="card"><div class="card-h"><h3>سعر نهاية الأسبوع</h3></div><div class="card-b" style="display:grid;gap:12px"><p class="muted">نسبة تُضاف على ليالي الأيام المحددة. اتركها 0 لتعطيلها.</p><div class="frow"><div class="fld"><label for="wkP">النسبة %</label><input class="in" type="number" id="wkP" value="' + (s.weekendPct || 0) + '"></div></div><div class="chips" id="wkD">' + DOWS.map(function (dn, i) { return '<button class="chip" data-d="' + i + '" aria-pressed="' + ((s.weekendDays || []).indexOf(i) >= 0) + '">ليلة ' + dn + '</button>'; }).join('') + '</div><button class="btn btn-p" id="wkSave" style="justify-self:start">حفظ</button>' +
      '<div class="sec-t">معاينة الأسعار للأيام القادمة</div><div class="tbl-wrap"><table><thead><tr><th>النوع</th>' + days14.map(function (d) { return '<th class="n">' + dNum(d) + '</th>'; }).join('') + '</tr></thead><tbody>' + db.roomTypes.map(function (ty) { return '<tr style="cursor:default"><td style="white-space:nowrap">' + esc(ty.name) + '</td>' + days14.map(function (d) { var p = U.nightlyPrice(db, ty.id, d); return '<td class="n"' + (p !== ty.price ? ' style="color:var(--brass);font-weight:600"' : '') + '>' + Math.round(p) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></div></div></div>' +
    '<div class="card"><div class="card-h"><h3>الغرف (' + db.rooms.length + ')</h3><div class="sp"><button class="btn btn-p btn-sm" id="roomAdd">' + ic('plus', 15) + ' غرفة</button></div></div><div class="card-b"><div class="rooms" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">' +
      db.rooms.map(function (r) { return '<div class="folio-l" style="border:1px solid var(--line-2);border-radius:10px;padding:6px 10px"><b class="tn">' + r.number + '</b><select class="in" data-rtype="' + r.id + '" style="padding:4px 8px;font-size:13px;width:auto">' + db.roomTypes.map(function (ty) { return '<option value="' + ty.id + '"' + (ty.id === r.typeId ? ' selected' : '') + '>' + esc(ty.name) + '</option>'; }).join('') + '</select><button class="icon-btn" data-rrem="' + r.id + '" title="حذف">' + ic('trash', 15) + '</button></div>'; }).join('') + '</div></div></div>';
  $$('[data-price]', el).forEach(function (inp) { inp.onchange = function () { var v = +inp.value; if (v > 0) act(API.patch('/api/staff/types/' + inp.dataset.price, { price: v }), 'تم تحديث السعر').catch(function () {}); }; });
  $$('[data-edit]', el).forEach(function (b) { b.onclick = function () { typeModal(b.dataset.edit); }; });
  $('#tAdd').onclick = function () { typeModal(null); };
  $$('[data-rdel]', el).forEach(function (b) { b.onclick = function () { act(API.del('/api/staff/rates/' + b.dataset.rdel), 'تم الحذف'); }; });
  $('#rAdd').onclick = function () { act(API.post('/api/staff/rates', { name: $('#rN').value, from: $('#rF').value, to: $('#rT').value, typeId: $('#rTy').value, mode: $('#rM').value, value: +$('#rV').value }), 'تمت إضافة الموسم').catch(function () {}); };
  $$('#wkD .chip').forEach(function (c) { c.onclick = function () { c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') !== 'true'); }; });
  $('#wkSave').onclick = function () { act(API.put('/api/staff/settings', { weekendPct: +$('#wkP').value, weekendDays: $$('#wkD .chip').filter(function (c) { return c.getAttribute('aria-pressed') === 'true'; }).map(function (c) { return +c.dataset.d; }) }), 'تم الحفظ').catch(function () {}); };
  $$('[data-rtype]', el).forEach(function (s2) { s2.onchange = function () { act(API.patch('/api/staff/rooms/' + s2.dataset.rtype, { typeId: s2.value }), 'تم تغيير نوع الغرفة').catch(function () {}); }; });
  $$('[data-rrem]', el).forEach(function (b) { b.onclick = function () { ask('حذف الغرفة ' + R(b.dataset.rrem).number + '؟', 'لن تظهر في لوحة الغرف ولن تُحسب في التوفر.', 'حذف', true).then(function (ok) { if (ok) act(API.del('/api/staff/rooms/' + b.dataset.rrem), 'تم حذف الغرفة').catch(function () {}); }); }; });
  $('#roomAdd').onclick = function () {
    modal('<div class="dr-h"><h2>إضافة غرفة</h2></div><div class="dr-b"><div class="frow"><div class="fld"><label for="nrN">رقم الغرفة</label><input class="in" id="nrN" inputmode="numeric"></div><div class="fld"><label for="nrF">الطابق</label><input class="in" id="nrF" type="number" min="0"></div></div><div class="fld"><label for="nrT">النوع</label><select class="in" id="nrT">' + db.roomTypes.map(function (ty) { return '<option value="' + ty.id + '">' + esc(ty.name) + '</option>'; }).join('') + '</select></div></div><div class="dr-f"><button class="btn btn-p" id="nrOk">إضافة</button><button class="btn btn-s" data-x>إلغاء</button></div>', true);
    $('#nrOk').onclick = function () { act(API.post('/api/staff/rooms', { number: $('#nrN').value, floor: $('#nrF').value, typeId: $('#nrT').value }), 'تمت إضافة الغرفة').then(closeModal).catch(function () {}); };
  };
};
var AMEN = { wifi: 'إنترنت', ac: 'تكييف', tv: 'تلفاز فضائي', safe: 'خزنة', minibar: 'ميني بار', bathtub: 'حوض استحمام', shower: 'دوش', desk: 'مكتب', sofa: 'ركن جلوس', coffee: 'ركن قهوة', view: 'إطلالة' };
function typeModal(id) {
  var ty = id ? T(id) : { name: '', tagline: '', desc: '', beds: '', size: 20, capacity: 2, maxChildren: 0, price: 50, online: true, amenities: ['wifi', 'ac', 'tv'], images: [] };
  var imgs = (ty.images || []).slice();
  modal('<div class="dr-h"><h2>' + (id ? 'تعديل ' + esc(ty.name) : 'نوع غرفة جديد') + '</h2><button class="icon-btn" data-x style="margin-inline-start:auto">' + ic('x') + '</button></div><div class="dr-b">' +
    '<div class="frow"><div class="fld"><label for="tyN">الاسم</label><input class="in" id="tyN" value="' + esc(ty.name) + '"></div><div class="fld"><label for="tyTg">عبارة قصيرة</label><input class="in" id="tyTg" value="' + esc(ty.tagline || '') + '"></div></div>' +
    '<div class="fld"><label for="tyD">الوصف</label><textarea class="in" id="tyD">' + esc(ty.desc || '') + '</textarea></div>' +
    '<div class="frow"><div class="fld"><label for="tyB">الأسرّة</label><input class="in" id="tyB" value="' + esc(ty.beds || '') + '"></div><div class="fld"><label for="tyS">المساحة م²</label><input class="in" type="number" id="tyS" value="' + ty.size + '"></div><div class="fld"><label for="tyC">البالغون</label><input class="in" type="number" id="tyC" value="' + ty.capacity + '"></div><div class="fld"><label for="tyK">الأطفال</label><input class="in" type="number" id="tyK" value="' + (ty.maxChildren || 0) + '"></div><div class="fld"><label for="tyP">السعر $</label><input class="in" type="number" id="tyP" value="' + ty.price + '"></div></div>' +
    '<div class="sec-t">المزايا</div><div class="chips" id="tyA">' + Object.keys(AMEN).map(function (k) { return '<button type="button" class="chip" data-a="' + k + '" aria-pressed="' + ((ty.amenities || []).indexOf(k) >= 0) + '">' + AMEN[k] + '</button>'; }).join('') + '</div>' +
    '<div class="sec-t">الصور</div><div id="tyImgs" style="display:flex;gap:8px;flex-wrap:wrap"></div><label class="btn btn-s" style="justify-self:start">' + ic('plus', 15) + ' رفع صور<input type="file" id="tyF" accept="image/*" multiple hidden></label>' +
    '<label class="switch"><input type="checkbox" id="tyO"' + (ty.online !== false ? ' checked' : '') + '> يظهر على موقع الحجز</label></div>' +
    '<div class="dr-f"><button class="btn btn-p" id="tySave">حفظ</button><button class="btn btn-s" data-x>إلغاء</button>' + (id ? '<button class="btn btn-bad" id="tyDel" style="margin-inline-start:auto">حذف النوع</button>' : '') + '</div>');
  function drawImgs() { $('#tyImgs').innerHTML = imgs.map(function (src, i) { return '<div style="position:relative"><img src="' + esc(src) + '" alt="" style="width:110px;height:80px;object-fit:cover;border-radius:10px"><button class="icon-btn" data-ri="' + i + '" style="position:absolute;top:2px;left:2px;background:var(--panel);width:26px;height:26px">' + ic('x', 14) + '</button></div>'; }).join('') || '<span class="muted">لا توجد صور</span>'; $$('[data-ri]').forEach(function (b) { b.onclick = function () { imgs.splice(+b.dataset.ri, 1); drawImgs(); }; }); }
  drawImgs();
  $$('#tyA .chip').forEach(function (c) { c.onclick = function () { c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') !== 'true'); }; });
  $('#tyF').onchange = function () { Array.prototype.forEach.call(this.files, function (f) { resizeImage(f, 1400, function (url) { imgs.push(url); drawImgs(); }); }); };
  $('#tySave').onclick = function () {
    var body = { name: $('#tyN').value, tagline: $('#tyTg').value, desc: $('#tyD').value, beds: $('#tyB').value, size: +$('#tyS').value, capacity: +$('#tyC').value, maxChildren: +$('#tyK').value, price: +$('#tyP').value, online: $('#tyO').checked, images: imgs, amenities: $$('#tyA .chip').filter(function (c) { return c.getAttribute('aria-pressed') === 'true'; }).map(function (c) { return c.dataset.a; }) };
    act(id ? API.patch('/api/staff/types/' + id, body) : API.post('/api/staff/types', body), 'تم الحفظ').then(closeModal).catch(function () {});
  };
  if ($('#tyDel')) $('#tyDel').onclick = function () { act(API.del('/api/staff/types/' + id), 'تم الحذف').then(closeModal).catch(function () {}); };
}
function resizeImage(file, max, cb) {
  var fr = new FileReader();
  fr.onload = function () { var img = new Image(); img.onload = function () { var r = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); var u = c.toDataURL('image/webp', .8); if (u.indexOf('data:image/webp') !== 0) u = c.toDataURL('image/jpeg', .82); cb(u); }; img.src = fr.result; };
  fr.readAsDataURL(file);
}

/* ======================= settings ======================= */
V.settings = function (el) {
  var s = S.db.settings, recips = (s.recipients || []).map(function (r) { return Object.assign({}, r); });
  el.innerHTML = '<div class="grid g2">' +
    '<div class="card"><div class="card-h"><h3>' + ic('wa') + ' تنبيهات واتساب</h3></div><div class="card-b" style="display:grid;gap:12px">' +
      '<div class="fld"><label for="stWa">رقم واتساب الاستقبال (يظهر للضيوف على الموقع)</label><input class="in" id="stWa" dir="ltr" placeholder="963 9xx xxx xxx" value="' + esc(s.whatsapp || '') + '"></div>' +
      '<div class="sec-t">إرسال تلقائي عند كل حجز جديد</div>' +
      '<p class="sub" style="line-height:1.8">يصل كل حجز من الموقع فوراً كرسالة واتساب إلى الأرقام أدناه عبر خدمة CallMeBot المجانية. لكل رقم: أضف رقم CallMeBot إلى جهات الاتصال وأرسل له الرسالة <b class="ltr">I allow callmebot to send me messages</b>، وستصلك رسالة فيها المفتاح (apikey). التعليمات والرقم الحالي للخدمة في <a href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noopener">صفحة CallMeBot</a>.</p>' +
      '<div id="recips" style="display:grid;gap:8px"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-s btn-sm" id="rcAdd">' + ic('plus', 14) + ' إضافة رقم</button><button class="btn btn-s btn-sm" id="rcTest">إرسال رسالة تجريبية</button></div>' +
      (S.mode === 'preview' ? '<p class="sub">في المعاينة لا تُرسل رسائل حقيقية؛ يعمل الإرسال على النسخة المنشورة على الخادم.</p>' : '') +
    '</div></div>' +
    '<div class="card"><div class="card-h"><h3>بيانات الفندق</h3></div><div class="card-b" style="display:grid;gap:12px"><div class="frow"><div class="fld"><label for="stN">الاسم</label><input class="in" id="stN" value="' + esc(s.hotelName) + '"></div><div class="fld"><label for="stNe">الاسم بالإنجليزية</label><input class="in" id="stNe" dir="ltr" value="' + esc(s.hotelNameEn) + '"></div></div>' +
      '<div class="frow"><div class="fld"><label for="stC">المدينة</label><input class="in" id="stC" value="' + esc(s.city) + '"></div><div class="fld"><label for="stA">العنوان</label><input class="in" id="stA" value="' + esc(s.address) + '"></div></div>' +
      '<div class="fld"><label for="stPh">أرقام الهاتف (رقم في كل سطر)</label><textarea class="in" id="stPh" dir="ltr">' + esc((s.phones || []).join('\n')) + '</textarea></div>' +
      '<div class="frow"><div class="fld"><label for="stFx">فاكس</label><input class="in" id="stFx" dir="ltr" value="' + esc(s.fax) + '"></div><div class="fld"><label for="stE">البريد</label><input class="in" id="stE" dir="ltr" value="' + esc(s.email) + '"></div><div class="fld"><label for="stW">الموقع</label><input class="in" id="stW" dir="ltr" value="' + esc(s.website) + '"></div></div></div></div>' +
    '<div class="card"><div class="card-h"><h3>التشغيل والأسعار</h3></div><div class="card-b" style="display:grid;gap:12px">' +
      '<div class="frow"><div class="fld"><label for="stCi">وقت الدخول</label><input class="in" type="time" id="stCi" value="' + esc(s.checkIn) + '"></div><div class="fld"><label for="stCo">وقت المغادرة</label><input class="in" type="time" id="stCo" value="' + esc(s.checkOut) + '"></div><div class="fld"><label for="stTx">الضريبة %</label><input class="in" type="number" id="stTx" value="' + s.taxPercent + '"></div></div>' +
      '<div class="frow"><div class="fld"><label for="stR">سعر صرف الدولار بالليرة</label><input class="in" type="number" id="stR" value="' + (s.sypRate || '') + '" placeholder="مثلاً 11500"></div><div class="fld"><label for="stMx">أقصى ليالٍ للحجز الإلكتروني</label><input class="in" type="number" id="stMx" value="' + s.maxNights + '"></div><div class="fld"><label for="stAd">أقصى مدة مسبقة (يوم)</label><input class="in" type="number" id="stAd" value="' + s.maxAdvanceDays + '"></div></div>' +
      '<label class="switch"><input type="checkbox" id="stOb"' + (s.onlineBooking !== false ? ' checked' : '') + '> استقبال الحجوزات من الموقع</label><label class="switch"><input type="checkbox" id="stBf"' + (s.breakfastIncluded ? ' checked' : '') + '> الإفطار مشمول بالسعر</label>' +
      '<div class="fld"><label for="stCp">سياسة الحجز والإلغاء (تظهر للضيف)</label><textarea class="in" id="stCp">' + esc(s.cancelPolicy) + '</textarea></div></div></div>' +
    '<div class="card"><div class="card-h"><h3>النسخ الاحتياطي</h3></div><div class="card-b" style="display:grid;gap:12px">' +
      (S.mode === 'server' ? '<p class="muted">يحفظ الخادم نسخة يومية تلقائياً في مجلد data/backups. يمكنك أيضاً تنزيل نسخة كاملة أو استعادة نسخة سابقة.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-s" id="bkExp">' + ic('dl', 15) + ' تنزيل نسخة احتياطية</button><label class="btn btn-s">استعادة من ملف<input type="file" id="bkImp" accept="application/json" hidden></label></div>'
        : '<p class="muted">في المعاينة تُحفظ البيانات في هذا المتصفح. يمكنك إعادة البيانات التجريبية إلى حالتها الأولى.</p><button class="btn btn-bad" id="pvReset" style="justify-self:start">إعادة ضبط بيانات المعاينة</button>') +
    '</div></div></div>' +
    '<div style="position:sticky;bottom:12px;display:flex;justify-content:flex-start"><button class="btn btn-p" id="stSave" style="padding:11px 26px;box-shadow:var(--shadow)">حفظ الإعدادات</button></div>';
  function drawR() {
    $('#recips').innerHTML = recips.map(function (r, i) { return '<div class="frow" style="grid-template-columns:1fr 1.2fr 1.2fr auto auto;align-items:end"><div class="fld"><label>الاسم</label><input class="in" data-k="name" data-i="' + i + '" value="' + esc(r.name) + '"></div><div class="fld"><label>رقم واتساب</label><input class="in" dir="ltr" data-k="phone" data-i="' + i + '" value="' + esc(r.phone) + '"></div><div class="fld"><label>apikey</label><input class="in" dir="ltr" data-k="apikey" data-i="' + i + '" value="' + esc(r.apikey || '') + '"></div><label class="switch" style="padding-bottom:8px"><input type="checkbox" data-k="active" data-i="' + i + '"' + (r.active !== false ? ' checked' : '') + '></label><button class="icon-btn" data-rm="' + i + '">' + ic('trash', 16) + '</button></div>'; }).join('') || '<p class="muted">لم تُضف أرقام بعد.</p>';
    $$('#recips [data-k]').forEach(function (inp) { inp.oninput = inp.onchange = function () { recips[+inp.dataset.i][inp.dataset.k] = inp.type === 'checkbox' ? inp.checked : inp.value; }; });
    $$('#recips [data-rm]').forEach(function (b) { b.onclick = function () { recips.splice(+b.dataset.rm, 1); drawR(); }; });
  }
  drawR();
  $('#rcAdd').onclick = function () { recips.push({ name: '', phone: '', apikey: '', active: true }); drawR(); };
  function collect() { return { whatsapp: $('#stWa').value, recipients: recips, hotelName: $('#stN').value, hotelNameEn: $('#stNe').value, city: $('#stC').value, address: $('#stA').value, phones: $('#stPh').value.split('\n'), fax: $('#stFx').value, email: $('#stE').value, website: $('#stW').value, checkIn: $('#stCi').value, checkOut: $('#stCo').value, taxPercent: +$('#stTx').value, sypRate: +$('#stR').value || 0, maxNights: +$('#stMx').value, maxAdvanceDays: +$('#stAd').value, onlineBooking: $('#stOb').checked, breakfastIncluded: $('#stBf').checked, cancelPolicy: $('#stCp').value }; }
  $('#stSave').onclick = function () { act(API.put('/api/staff/settings', collect()), 'تم حفظ الإعدادات').catch(function () {}); };
  $('#rcTest').onclick = function () { API.put('/api/staff/settings', collect()).then(function () { return API.post('/api/staff/notify-test'); }).then(function (r) { toast('أُرسلت رسالة تجريبية إلى ' + r.sent + ' رقم'); load(true); }).catch(function (e) { toast(esc(e.message), 'err'); }); };
  if ($('#bkExp')) $('#bkExp').onclick = function () { API.get('/api/staff/export').then(function (d) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' })); a.download = 'alpatra-backup-' + today() + '.json'; document.body.appendChild(a); a.click(); a.remove(); }); };
  if ($('#bkImp')) $('#bkImp').onchange = function () { var f = this.files[0]; if (!f) return; var fr = new FileReader(); fr.onload = function () { var d; try { d = JSON.parse(fr.result); } catch (e) { toast('الملف غير صالح', 'err'); return; } ask('استعادة النسخة الاحتياطية؟', 'ستُستبدل كل البيانات الحالية ببيانات الملف.', 'استعادة', true).then(function (ok) { if (ok) act(API.post('/api/staff/import', d), 'تمت الاستعادة').catch(function () {}); }); }; fr.readAsText(f); };
  if ($('#pvReset')) $('#pvReset').onclick = function () { ask('إعادة ضبط المعاينة؟', 'ستُحذف كل التعديلات والحجوزات التي أضفتها في هذا المتصفح.', 'إعادة الضبط', true).then(function (ok) { if (ok) { API.resetPreview(); S.db = null; renderLogin(); } }); };
};

/* ======================= users ======================= */
V.users = function (el) {
  el.innerHTML = '<div class="grid g-dash"><div class="card"><div class="card-h"><h3>فريق العمل</h3></div><div class="tbl-wrap"><table><thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>الصلاحية</th><th>آخر دخول</th><th>الحالة</th><th></th></tr></thead><tbody>' +
    S.db.users.map(function (u) { return '<tr style="cursor:default"><td><b>' + esc(u.name) + '</b></td><td class="ltr">' + esc(u.username) + '</td><td><select class="in" data-role="' + u.id + '" style="width:auto;padding:4px 8px"' + (u.id === S.me.id ? ' disabled' : '') + '>' + Object.keys(ROLE).map(function (r) { return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + ROLE[r] + '</option>'; }).join('') + '</select></td><td class="sub">' + (u.lastLogin ? ago(u.lastLogin) : '—') + '</td><td>' + (u.active ? '<span class="pill s-in_house">فعّال</span>' : '<span class="pill s-cancelled">موقوف</span>') + '</td><td style="white-space:nowrap"><button class="btn btn-s btn-sm" data-reset="' + u.id + '">كلمة مرور جديدة</button> ' + (u.id !== S.me.id ? '<button class="btn btn-s btn-sm" data-toggle="' + u.id + '">' + (u.active ? 'إيقاف' : 'تفعيل') + '</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
    '<div class="card"><div class="card-h"><h3>إضافة موظف</h3></div><div class="card-b" style="display:grid;gap:12px"><div class="fld"><label for="uN">الاسم</label><input class="in" id="uN"></div><div class="fld"><label for="uU">اسم المستخدم (بالإنجليزية)</label><input class="in" id="uU" dir="ltr" autocomplete="off"></div><div class="fld"><label for="uP">كلمة مرور مؤقتة</label><input class="in" id="uP" dir="ltr" autocomplete="new-password"></div><div class="fld"><label for="uR">الصلاحية</label><select class="in" id="uR"><option value="reception">استقبال</option><option value="housekeeping">تدبير فندقي</option><option value="manager">مدير</option></select></div><p class="sub">سيُطلب من الموظف تغيير كلمة المرور عند أول دخول.<br>الاستقبال: الحجوزات والضيوف والفواتير. التدبير: حالة الغرف فقط. المدير: كل شيء.</p><button class="btn btn-p" id="uAdd">إضافة</button></div></div></div>';
  $('#uAdd').onclick = function () { act(API.post('/api/staff/users', { name: $('#uN').value, username: $('#uU').value, password: $('#uP').value, role: $('#uR').value }), 'تمت إضافة الموظف').catch(function () {}); };
  $$('[data-role]', el).forEach(function (s) { s.onchange = function () { act(API.patch('/api/staff/users/' + s.dataset.role, { role: s.value }), 'تم تغيير الصلاحية').catch(function () {}); }; });
  $$('[data-toggle]', el).forEach(function (b) { b.onclick = function () { var u = S.db.users.filter(function (x) { return x.id === b.dataset.toggle; })[0]; act(API.patch('/api/staff/users/' + u.id, { active: !u.active }), 'تم').catch(function () {}); }; });
  $$('[data-reset]', el).forEach(function (b) { b.onclick = function () {
    modal('<div class="dr-h"><h2>كلمة مرور جديدة</h2></div><div class="dr-b"><div class="fld"><label for="npw">كلمة المرور (6 أحرف على الأقل)</label><input class="in" id="npw" dir="ltr"></div></div><div class="dr-f"><button class="btn btn-p" id="npwOk">حفظ</button><button class="btn btn-s" data-x>إلغاء</button></div>', true);
    $('#npwOk').onclick = function () { act(API.patch('/api/staff/users/' + b.dataset.reset, { password: $('#npw').value }), 'تم تعيين كلمة المرور').then(closeModal).catch(function () {}); };
  }; });
};

/* ======================= log ======================= */
var LOGN = { 'booking.create': 'حجز جديد', 'booking.confirm': 'تأكيد حجز', 'booking.checkin': 'تسجيل دخول', 'booking.checkout': 'تسجيل خروج', 'booking.cancel': 'إلغاء حجز', 'booking.noshow': 'لم يحضر', 'booking.reopen': 'إعادة فتح حجز', 'booking.undo_checkin': 'تراجع عن الدخول', 'booking.edit': 'تعديل حجز', 'charge.add': 'إضافة خدمة', 'charge.delete': 'حذف خدمة', 'payment.add': 'دفعة', 'payment.delete': 'حذف دفعة', 'guest.save': 'تحديث ضيف', 'room.update': 'حالة غرفة', 'room.add': 'إضافة غرفة', 'room.delete': 'حذف غرفة', 'type.add': 'نوع غرفة جديد', 'type.update': 'تعديل نوع غرفة', 'rate.add': 'موسم أسعار', 'settings.update': 'تعديل الإعدادات', 'user.add': 'موظف جديد', 'user.update': 'تعديل موظف', 'auth.login': 'تسجيل دخول للنظام', 'auth.password': 'تغيير كلمة المرور' };
V.log = function (el) {
  el.innerHTML = '<div class="card"><div class="tbl-wrap"><table><thead><tr><th>الوقت</th><th>الموظف</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>' + S.db.log.slice(0, 400).map(function (l) {
    var b = l.ref && B(l.ref); return '<tr' + (b ? ' data-b="' + b.id + '"' : ' style="cursor:default"') + '><td class="tn sub">' + tStamp(l.at) + '</td><td>' + esc(l.who) + '</td><td>' + (LOGN[l.action] || esc(l.action)) + '</td><td>' + (b ? '<span class="ltr tn">' + b.code + '</span> · ' + esc(G(b.guestId).name) : esc(l.detail || '')) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  wireCommon(el);
};

/* ======================= modal / drawer / ask ======================= */
function modal(html, small) {
  var m = $('#modal'); m.innerHTML = '<div class="modal-c' + (small ? ' sm' : '') + '">' + html + '</div>'; m.classList.add('on'); $('#scrim').classList.add('on');
  $$('[data-x]', m).forEach(function (b) { b.onclick = closeModal; });
  var f = $('input:not([type=hidden]),select,textarea', m); if (f) setTimeout(function () { f.focus(); }, 60);
}
function closeModal() { var m = $('#modal'); if (!m) return; m.classList.remove('on'); m.innerHTML = ''; if (!$('#drawer').classList.contains('on')) $('#scrim').classList.remove('on'); }
$('#modal').addEventListener('click', function (e) { if (e.target === this && !this.dataset.lock) closeModal(); });
function ask(title, text, okLabel, danger) {
  return new Promise(function (res) {
    modal('<div class="dr-h"><h2>' + esc(title) + '</h2></div><div class="dr-b"><p>' + esc(text) + '</p></div><div class="dr-f"><button class="btn ' + (danger ? 'btn-bad' : 'btn-p') + '" id="askOk">' + esc(okLabel || 'تأكيد') + '</button><button class="btn btn-s" id="askNo">تراجع</button></div>', true);
    $('#askOk').onclick = function () { closeModal(); res(true); }; $('#askNo').onclick = function () { closeModal(); res(false); };
  });
}
var drawerRender = null;
function openDrawer(fn) { drawerRender = fn; fn(); $('#drawer').classList.add('on'); $('#scrim').classList.add('on'); }
function refreshDrawer() { if (drawerRender && $('#drawer').classList.contains('on') && !($('#drawer').contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) drawerRender(); }
function closeDrawer() { drawerRender = null; var d = $('#drawer'); if (!d) return; d.classList.remove('on'); if (!$('#modal').classList.contains('on')) $('#scrim').classList.remove('on'); }
$('#scrim').addEventListener('click', function () { if ($('#modal').dataset.lock) return; if ($('#modal').classList.contains('on')) closeModal(); else closeDrawer(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if ($('#modal').classList.contains('on')) { if (!$('#modal').dataset.lock) closeModal(); } else closeDrawer(); } });

/* ======================= booking drawer ======================= */
function openBooking(id) { S.editing = false; openDrawer(function () { renderBooking(id); }); }
function renderBooking(id) {
  var b = B(id), d = $('#drawer'); if (!b) { closeDrawer(); return; }
  var g = G(b.guestId), f = folio(b), n = U.nightsBetween(b.checkIn, b.checkOut), t = today(), open = HOLD[b.status], s = S.db.settings;
  var avg = n ? b.roomTotal / n : 0;
  var body = '';
  // guest
  body += '<div class="card" style="padding:14px 16px;display:flex;gap:12px;align-items:center"><div class="avatar" style="width:44px;height:44px;font-size:18px">' + esc(g.name.trim()[0]) + '</div><div style="flex:1;min-width:0"><b style="font-size:16px">' + (g.vip ? '<span style="color:var(--brass)">' + ic('star', 15) + '</span> ' : '') + esc(g.name) + '</b>' + (g.blacklist ? ' <span class="pill s-cancelled">محظور</span>' : '') +
    '<div class="sub"><span class="ltr">' + esc(g.phone) + '</span>' + (g.nationality ? ' · ' + esc(g.nationality) : '') + (g.idNumber ? ' · ' + esc(g.idType || '') + ' ' + esc(g.idNumber) : ' · <span style="color:var(--warn)">بدون رقم وثيقة</span>') + '</div></div>' +
    (waUrl(g.phone) ? '<a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="' + waUrl(g.phone) + '" title="واتساب">' + ic('wa', 16) + '</a>' : '') + '<a class="btn btn-s btn-sm" href="tel:+' + U.normPhone(g.phone) + '" title="اتصال">' + ic('phone', 16) + '</a><button class="btn btn-s btn-sm" id="bdGuest">الملف</button></div>';
  // stay
  if (!S.editing) {
    body += '<div class="card"><div class="card-h"><h3>الإقامة</h3><div class="sp">' + (open && !isHK() ? '<button class="btn btn-s btn-sm" id="bdEdit">تعديل</button>' : '') + '</div></div><div class="card-b"><dl class="kv">' +
      '<dt>الغرفة</dt><dd>' + (b.roomId ? '<b class="tn" style="font-size:16px">' + R(b.roomId).number + '</b> · ' : '<span class="pill s-pending">غير مخصصة</span> ') + esc(T(b.typeId).name) + '</dd>' +
      '<dt>الوصول</dt><dd>' + dLong(b.checkIn) + (b.checkedInAt ? ' <span class="sub">(دخل ' + tStamp(b.checkedInAt) + ')</span>' : '') + '</dd><dt>المغادرة</dt><dd>' + dLong(b.checkOut) + (b.checkedOutAt ? ' <span class="sub">(خرج ' + tStamp(b.checkedOutAt) + ')</span>' : '') + '</dd>' +
      '<dt>المدة</dt><dd>' + nightsW(n) + ' · ' + b.adults + ' بالغ' + (b.children ? ' و' + b.children + ' طفل' : '') + '</dd>' +
      (b.arrivalTime ? '<dt>وقت الوصول</dt><dd>' + esc(b.arrivalTime) + '</dd>' : '') + (b.requests ? '<dt>طلبات الضيف</dt><dd>' + esc(b.requests) + '</dd>' : '') + (b.notes ? '<dt>ملاحظات داخلية</dt><dd>' + esc(b.notes) + '</dd>' : '') +
      (b.cancelReason ? '<dt>سبب الإلغاء</dt><dd>' + esc(b.cancelReason) + '</dd>' : '') + '<dt>أُنشئ</dt><dd class="sub">' + tStamp(b.createdAt) + ' · ' + SOURCE[b.source] + '</dd></dl></div></div>';
  } else {
    var free = U.freeRooms(S.db, '', b.checkIn, b.checkOut, b.id);
    body += '<div class="card"><div class="card-h"><h3>تعديل الإقامة</h3></div><div class="card-b" style="display:grid;gap:12px"><div class="frow"><div class="fld"><label for="eIn">الوصول</label><input class="in" type="date" id="eIn" value="' + b.checkIn + '"' + (b.status === 'in_house' ? ' disabled' : '') + '></div><div class="fld"><label for="eOut">المغادرة</label><input class="in" type="date" id="eOut" value="' + b.checkOut + '"></div></div>' +
      '<div class="fld"><label for="eRoom">الغرفة</label><select class="in" id="eRoom">' + (b.status !== 'in_house' ? '<option value="">بدون تخصيص (' + esc(T(b.typeId).name) + ')</option>' : '') + S.db.roomTypes.map(function (ty) { var rs = free.filter(function (r) { return r.typeId === ty.id; }); if (b.roomId && R(b.roomId).typeId === ty.id && rs.indexOf(R(b.roomId)) < 0) rs.unshift(R(b.roomId)); return rs.length ? '<optgroup label="' + esc(ty.name) + '">' + rs.map(function (r) { return '<option value="' + r.id + '"' + (r.id === b.roomId ? ' selected' : '') + '>' + r.number + ' · ' + HK[r.status] + '</option>'; }).join('') + '</optgroup>' : ''; }).join('') + '</select><span class="sub">تظهر الغرف المتاحة لتواريخ الحجز الحالية. غيّر التواريخ واحفظ أولاً إن لزم.</span></div>' +
      '<div class="frow"><div class="fld"><label for="eA">البالغون</label><input class="in" type="number" min="1" id="eA" value="' + b.adults + '"></div><div class="fld"><label for="eC">الأطفال</label><input class="in" type="number" min="0" id="eC" value="' + b.children + '"></div><div class="fld"><label for="eR">سعر الليلة $ (فارغ = سعر النظام)</label><input class="in" type="number" id="eR" placeholder="' + Math.round(avg) + '"></div><div class="fld"><label for="eD">حسم $</label><input class="in" type="number" id="eD" value="' + (b.discount || 0) + '"></div></div>' +
      '<div class="fld"><label for="eN">ملاحظات داخلية</label><textarea class="in" id="eN">' + esc(b.notes || '') + '</textarea></div><div style="display:flex;gap:8px"><button class="btn btn-p" id="eSave">حفظ التعديل</button><button class="btn btn-s" id="eCancel">إلغاء</button></div></div></div>';
  }
  // folio
  body += '<div class="card"><div class="card-h"><h3>الحساب</h3><div class="sp"><button class="btn btn-s btn-sm" id="bdInv">' + ic('print', 15) + ' الفاتورة</button></div></div><div class="card-b">' +
    '<div class="folio-l"><span>الإقامة: ' + nightsW(n) + ' × <span class="ltr">' + money(avg) + '</span></span><b class="ltr">' + money(f.room) + '</b></div>' +
    (f.tax ? '<div class="folio-l"><span>الضريبة</span><span class="ltr">' + money(f.tax) + '</span></div>' : '') +
    f.charges.map(function (c) { return '<div class="folio-l"><span>' + esc(c.desc) + (c.qty > 1 ? ' × ' + c.qty : '') + ' <span class="sub">' + (CAT[c.category] || '') + ' · ' + dShort(c.date) + '</span></span><span style="display:flex;gap:6px;align-items:center"><span class="ltr">' + money(c.amount * (c.qty || 1)) + '</span>' + (isMgr() ? '<button class="icon-btn" style="width:28px;height:28px" data-dc="' + c.id + '" title="حذف">' + ic('trash', 14) + '</button>' : '') + '</span></div>'; }).join('') +
    (f.discount ? '<div class="folio-l"><span>حسم</span><span class="ltr" style="color:var(--ok)">-' + money(f.discount) + '</span></div>' : '') +
    '<div class="folio-t"><span>المجموع</span><span class="ltr">' + money(f.total) + '</span></div>' +
    (f.payments.length ? '<div class="sec-t" style="margin-top:10px">الدفعات</div>' + f.payments.map(function (p) { return '<div class="folio-l"><span>' + METHOD[p.method] + (p.currency === 'SYP' ? ' · ' + sypFmt(p.originalAmount) + ' <span class="sub">(سعر ' + p.rate + ')</span>' : '') + ' <span class="sub">' + tStamp(p.at) + ' · ' + esc(p.by) + (p.note ? ' · ' + esc(p.note) : '') + '</span></span><span style="display:flex;gap:6px;align-items:center"><span class="ltr" style="color:var(--ok)">' + money(p.amount) + '</span>' + (isMgr() ? '<button class="icon-btn" style="width:28px;height:28px" data-dp="' + p.id + '" title="حذف">' + ic('trash', 14) + '</button>' : '') + '</span></div>'; }).join('') : '') +
    '<div class="bal ' + (f.balance > 0.009 ? 'due' : 'paid') + '" style="margin-top:12px"><span>' + (f.balance > 0.009 ? 'المبلغ المستحق' : f.balance < -0.009 ? 'رصيد زائد للضيف' : 'الحساب مسدد بالكامل') + '</span><span class="ltr">' + money(Math.abs(f.balance)) + (f.balance > 0.009 && s.sypRate ? ' · ' + sypFmt(f.balance * s.sypRate) : '') + '</span></div>' +
    (b.status !== 'cancelled' && b.status !== 'no_show' && !isHK() ? '<div class="sec-t" style="margin-top:14px">إضافة خدمة</div><div class="quick" id="qc">' + Object.keys(CAT).map(function (k) { return '<button class="chip" data-cat="' + k + '">' + CAT[k] + '</button>'; }).join('') + '</div><div id="chForm" hidden style="margin-top:10px" class="frow"><div class="fld"><label for="chD">الوصف</label><input class="in" id="chD"></div><div class="fld"><label for="chA">المبلغ $</label><input class="in" type="number" id="chA" step="0.5"></div><div class="fld"><label for="chQ">الكمية</label><input class="in" type="number" id="chQ" value="1" min="1"></div><div class="fld" style="align-self:end"><button class="btn btn-p" id="chOk">إضافة</button></div></div>' +
      '<div class="sec-t" style="margin-top:14px">تسجيل دفعة</div><div class="frow"><div class="fld"><label for="pA">المبلغ</label><input class="in" type="number" id="pA" step="0.5" value="' + (f.balance > 0 ? Math.round(f.balance * 100) / 100 : '') + '"></div><div class="fld"><label for="pC">العملة</label><select class="in" id="pC"><option value="USD">دولار</option>' + (s.sypRate ? '<option value="SYP">ليرة سورية</option>' : '') + '</select></div><div class="fld"><label for="pM">الطريقة</label><select class="in" id="pM"><option value="cash">نقداً</option><option value="card">بطاقة</option><option value="transfer">تحويل</option></select></div><div class="fld" style="align-self:end"><button class="btn btn-ok" id="pOk">تسجيل</button></div></div><div class="sub" id="pConv"></div>' : '') +
    '</div></div>';
  body += '<div class="card"><div class="card-h"><h3>السجل</h3></div><div class="card-b hist">' + b.history.slice().reverse().map(function (h) { return '<div><i></i><div><b>' + ({ created: 'إنشاء الحجز', confirm: 'تأكيد', checkin: 'تسجيل دخول', checkout: 'تسجيل خروج', cancel: 'إلغاء', noshow: 'لم يحضر', reopen: 'إعادة فتح', edit: 'تعديل', undo_checkin: 'تراجع عن الدخول' }[h.action] || h.action) + '</b> <span class="sub">' + esc(h.by) + ' · ' + tStamp(h.at) + '</span>' + (h.note ? '<div class="sub">' + esc(h.note) + '</div>' : '') + '</div></div>'; }).join('') + '</div></div>';

  // footer actions
  var fa = '';
  if (!isHK()) {
    if (b.status === 'pending') fa += '<button class="btn btn-ok" data-a="confirm">' + ic('check', 16) + ' تأكيد الحجز</button>';
    if ((b.status === 'pending' || b.status === 'confirmed') && b.checkIn <= t) fa += '<button class="btn btn-p" data-a="checkin">' + ic('in', 16) + ' تسجيل دخول</button>';
    if (b.status === 'in_house') fa += '<button class="btn btn-p" data-a="checkout">' + ic('out', 16) + ' تسجيل خروج</button>';
    if (b.status === 'confirmed' && waUrl(g.phone)) fa += '<a class="btn btn-wa" target="_blank" rel="noopener" href="' + waUrl(g.phone, confirmText(b)) + '">' + ic('wa', 16) + ' إرسال التأكيد</a>';
    if (b.status === 'pending' || b.status === 'confirmed') fa += '<button class="btn btn-bad" data-a="cancel">إلغاء</button>';
    if (b.status === 'confirmed' && b.checkIn < t) fa += '<button class="btn btn-s" data-a="noshow">لم يحضر</button>';
    if (b.status === 'in_house' && b.checkIn === t) fa += '<button class="btn btn-s" data-a="undo_checkin">تراجع عن الدخول</button>';
    if ((b.status === 'cancelled' || b.status === 'no_show' || b.status === 'checked_out') && isMgr()) fa += '<button class="btn btn-s" data-a="reopen">إعادة فتح</button>';
  }
  d.innerHTML = '<div class="dr-h"><div style="flex:1;min-width:0"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2 class="ltr tn">' + b.code + '</h2>' + pill(b.status) + '<span class="tag">' + SOURCE[b.source] + '</span></div><div class="sub">' + esc(T(b.typeId).name) + ' · ' + dShort(b.checkIn) + ' ← ' + dShort(b.checkOut) + '</div></div><button class="icon-btn" id="bdX" aria-label="إغلاق">' + ic('x') + '</button></div><div class="dr-b">' + body + '</div>' + (fa ? '<div class="dr-f">' + fa + '</div>' : '');
  $('#bdX').onclick = closeDrawer;
  $('#bdGuest').onclick = function () { openGuest(g.id); };
  $('#bdInv').onclick = function () { invoice(b.id); };
  if ($('#bdEdit')) $('#bdEdit').onclick = function () { S.editing = true; renderBooking(id); };
  if ($('#eCancel')) $('#eCancel').onclick = function () { S.editing = false; renderBooking(id); };
  if ($('#eSave')) $('#eSave').onclick = function () {
    var body2 = { checkIn: $('#eIn').value, checkOut: $('#eOut').value, roomId: $('#eRoom').value || null, adults: +$('#eA').value, children: +$('#eC').value, discount: +$('#eD').value || 0, notes: $('#eN').value };
    if ($('#eR').value !== '') body2.nightlyRate = +$('#eR').value;
    act(API.patch('/api/staff/bookings/' + b.id, body2), 'تم حفظ التعديل').then(function () { S.editing = false; renderBooking(id); }).catch(function () {});
  };
  $$('[data-cat]', d).forEach(function (c) { c.onclick = function () { $$('[data-cat]', d).forEach(function (x) { x.setAttribute('aria-pressed', x === c); }); $('#chForm').hidden = false; $('#chForm').dataset.cat = c.dataset.cat; $('#chD').value = CAT[c.dataset.cat] === 'أخرى' ? '' : CAT[c.dataset.cat]; $('#chA').focus(); }; });
  if ($('#chOk')) $('#chOk').onclick = function () { act(API.post('/api/staff/charges', { bookingId: b.id, category: $('#chForm').dataset.cat, desc: $('#chD').value, amount: +$('#chA').value, qty: +$('#chQ').value }), 'أضيفت الخدمة إلى الحساب').catch(function () {}); };
  function conv() { var c = $('#pC'), a = +$('#pA').value; if (!c) return; $('#pConv').textContent = c.value === 'SYP' && a ? '= ' + money(a / s.sypRate) + ' بسعر صرف ' + s.sypRate : c.value === 'USD' && s.sypRate && a ? '≈ ' + sypFmt(a * s.sypRate) : ''; }
  if ($('#pC')) { $('#pC').onchange = function () { if (this.value === 'SYP' && f.balance > 0) $('#pA').value = Math.round(f.balance * s.sypRate); else if (f.balance > 0) $('#pA').value = Math.round(f.balance * 100) / 100; conv(); }; $('#pA').oninput = conv; conv(); }
  if ($('#pOk')) $('#pOk').onclick = function () { act(API.post('/api/staff/payments', { bookingId: b.id, amount: +$('#pA').value, currency: $('#pC').value, method: $('#pM').value }), 'تم تسجيل الدفعة').catch(function () {}); };
  $$('[data-dc]', d).forEach(function (x) { x.onclick = function () { ask('حذف الخدمة؟', 'سيُحذف البند من حساب الضيف.', 'حذف', true).then(function (ok) { if (ok) act(API.del('/api/staff/charges/' + x.dataset.dc), 'تم الحذف').catch(function () {}); }); }; });
  $$('[data-dp]', d).forEach(function (x) { x.onclick = function () { ask('حذف الدفعة؟', 'ستُحذف الدفعة من الحساب وتظهر في سجل النشاط.', 'حذف', true).then(function (ok) { if (ok) act(API.del('/api/staff/payments/' + x.dataset.dp), 'تم الحذف').catch(function () {}); }); }; });
  $$('[data-a]', d).forEach(function (x) { x.onclick = function () {
    var a = x.dataset.a;
    if (a === 'confirm') confirmBooking(b.id);
    else if (a === 'checkin') checkIn(b.id);
    else if (a === 'checkout') checkOut(b.id);
    else if (a === 'cancel') cancelBooking(b.id);
    else doAction(b.id, a, {}, { noshow: 'سُجّل الحجز كعدم حضور', reopen: 'أُعيد فتح الحجز', undo_checkin: 'تم التراجع عن الدخول' }[a]);
  }; });
}
function confirmText(b) {
  var g = G(b.guestId), s = S.db.settings;
  return 'مرحباً ' + g.name.split(' ')[0] + '،\nتم تأكيد حجزك في ' + s.hotelName + ' ✅\nرقم الحجز: ' + b.code + '\nالغرفة: ' + T(b.typeId).name + (b.roomId ? ' (' + R(b.roomId).number + ')' : '') + '\nالوصول: ' + dLong(b.checkIn) + ' من الساعة ' + s.checkIn + '\nالمغادرة: ' + dLong(b.checkOut) + ' حتى الساعة ' + s.checkOut + '\nالمجموع: ' + money(folio(b).total) + ' يُدفع في الفندق\nالعنوان: ' + s.city + '، ' + s.address + '\nنتطلع لاستقبالك.';
}
function doAction(id, action, extra, okMsg) {
  var body = Object.assign({ action: action }, extra || {});
  return API.post('/api/staff/bookings/' + id + '/action', body).then(function (r) { if (okMsg) toast(okMsg); return load().then(function () { return r; }); });
}
function confirmBooking(id) {
  doAction(id, 'confirm', {}, 'تم تأكيد الحجز').then(function () {
    var b = B(id), g = G(b.guestId), url = waUrl(g.phone, confirmText(b));
    if (!url) return;
    modal('<div class="dr-h"><h2>' + ic('check') + ' تم تأكيد الحجز</h2></div><div class="dr-b"><p>أرسل رسالة التأكيد إلى الضيف على واتساب:</p><pre style="white-space:pre-wrap;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px;font-family:inherit;font-size:13.5px;margin:0">' + esc(confirmText(b)) + '</pre></div><div class="dr-f"><a class="btn btn-wa" target="_blank" rel="noopener" href="' + url + '" id="waGo">' + ic('wa', 16) + ' فتح واتساب</a><button class="btn btn-s" data-x>لاحقاً</button></div>', true);
    $('#waGo').onclick = function () { setTimeout(closeModal, 300); };
  }).catch(function (e) { toast(esc(e.message), 'err'); });
}
function checkIn(id) {
  var b = B(id);
  if (!b.roomId) { roomPickModal(b, function (roomId) { go({ roomId: roomId }); }); return; }
  go({});
  function go(extra) {
    doAction(id, 'checkin', extra, null).then(function () { toast('تم تسجيل دخول ' + esc(G(b.guestId).name) + ' — غرفة ' + R(B(id).roomId).number); })
      .catch(function (e) {
        if (e.status === 409) ask('الغرفة ليست جاهزة', e.message, 'تسجيل الدخول على أي حال').then(function (ok) { if (ok) go(Object.assign({}, extra, { force: true })); });
        else toast(esc(e.message), 'err');
      });
  }
}
function roomPickModal(b, cb) {
  var free = U.freeRooms(S.db, b.typeId, b.checkIn, b.checkOut, b.id), others = U.freeRooms(S.db, '', b.checkIn, b.checkOut, b.id).filter(function (r) { return r.typeId !== b.typeId; });
  var btn = function (r) { return '<button data-r="' + r.id + '">' + r.number + '<span class="hk hk-' + r.status + '"></span></button>'; };
  modal('<div class="dr-h"><h2>اختر غرفة لـ ' + esc(G(b.guestId).name) + '</h2><button class="icon-btn" data-x style="margin-inline-start:auto">' + ic('x') + '</button></div><div class="dr-b"><div class="sec-t">' + esc(T(b.typeId).name) + ' — متاحة</div><div class="room-pick">' + (free.map(btn).join('') || '<span class="muted">لا توجد غرفة متاحة من هذا النوع</span>') + '</div>' +
    (others.length ? '<div class="sec-t">أنواع أخرى (ترقية)</div><div class="room-pick">' + others.map(btn).join('') + '</div>' : '') + '<p class="sub">النقطة الخضراء: نظيفة · البرتقالية: بحاجة تنظيف</p></div>', true);
  $$('#modal [data-r]').forEach(function (x) { x.onclick = function () { closeModal(); cb(x.dataset.r); }; });
}
function checkOut(id) {
  var b = B(id), t = today(), f = folio(b), extra = {};
  var run = function () {
    doAction(id, 'checkout', extra, 'تم تسجيل خروج ' + esc(G(b.guestId).name) + '. الغرفة ' + R(b.roomId).number + ' بحاجة تنظيف').catch(function (e) {
      if (e.status === 409) ask('يوجد رصيد مستحق', e.message + '. هل تريد تسجيل الخروج بدون تسديد؟', 'تسجيل الخروج', true).then(function (ok) { if (ok) { extra.force = true; run(); } });
      else toast(esc(e.message), 'err');
    });
  };
  if (b.checkOut > t) { ask('مغادرة مبكرة', 'موعد مغادرة الضيف ' + dLong(b.checkOut) + '. سيُعاد حساب الإقامة حتى اليوم.', 'مغادرة مبكرة').then(function (ok) { if (ok) { extra.early = true; run(); } }); return; }
  if (f.balance > 0.009) { ask('يوجد رصيد مستحق ' + money(f.balance), 'سجّل الدفعة أولاً من حساب الحجز، أو تابع لتسجيل الخروج مع بقاء الرصيد.', 'تسجيل الخروج', true).then(function (ok) { if (ok) { extra.force = true; run(); } else openBooking(id); }); return; }
  run();
}
function cancelBooking(id) {
  modal('<div class="dr-h"><h2>إلغاء الحجز ' + B(id).code + '</h2></div><div class="dr-b"><div class="fld"><label for="cxR">السبب</label><input class="in" id="cxR" placeholder="مثلاً: طلب الضيف، لا يوجد رد"></div></div><div class="dr-f"><button class="btn btn-bad" id="cxOk">إلغاء الحجز</button><button class="btn btn-s" data-x>تراجع</button></div>', true);
  $('#cxOk').onclick = function () { closeModal(); doAction(id, 'cancel', { reason: $('#cxR') ? $('#cxR').value : '' }, 'تم إلغاء الحجز').catch(function (e) { toast(esc(e.message), 'err'); }); };
  var inp = $('#cxR'); $('#cxOk').onclick = function () { var r = inp.value; closeModal(); doAction(id, 'cancel', { reason: r }, 'تم إلغاء الحجز').catch(function (e) { toast(esc(e.message), 'err'); }); };
}

/* ======================= invoice ======================= */
function invoice(id) {
  var b = B(id), g = G(b.guestId), f = folio(b), s = S.db.settings, n = U.nightsBetween(b.checkIn, b.checkOut);
  // group nightly by price
  var groups = []; b.nightly.forEach(function (x) { var last = groups[groups.length - 1]; if (last && last.price === x.price) last.n++; else groups.push({ price: x.price, n: 1, from: x.date }); });
  modal('<div class="dr-h no-print"><h2>فاتورة ' + b.code + '</h2><div style="margin-inline-start:auto;display:flex;gap:8px">' + (S.mode === 'server' ? '<button class="btn btn-p btn-sm" id="invPrint">' + ic('print', 15) + ' طباعة</button>' : '') + '<button class="icon-btn" data-x>' + ic('x') + '</button></div></div><div class="dr-b" style="background:var(--panel-2)"><div class="invoice">' +
    '<div class="inv-h"><div style="display:flex;gap:12px;align-items:center"><svg><use href="#logo"/></svg><div><h2>' + esc(s.hotelName) + '</h2><div style="font-family:var(--f-latin);letter-spacing:.2em;font-size:12px">' + esc(s.hotelNameEn) + '</div></div></div><div style="text-align:left;font-size:12.5px;line-height:1.7"><div>' + esc(s.city) + ' — ' + esc(s.address) + '</div><div class="ltr">' + esc((s.phones || [])[0] || '') + '</div><div class="ltr">' + esc(s.email) + '</div></div></div>' +
    '<div style="display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap"><div><div style="color:#777">فاتورة إلى</div><b style="font-size:16px">' + esc(g.name) + '</b><div class="ltr">' + esc(g.phone) + '</div>' + (g.idNumber ? '<div>' + esc(g.idType || '') + ': ' + esc(g.idNumber) + '</div>' : '') + '</div>' +
    '<div><div style="color:#777">رقم الفاتورة</div><b class="ltr">' + b.code + '</b><div>التاريخ: ' + dShort(today()) + '</div><div>الغرفة: ' + (b.roomId ? R(b.roomId).number : '—') + ' · ' + esc(T(b.typeId).name) + '</div><div>' + dShort(b.checkIn) + ' ← ' + dShort(b.checkOut) + ' (' + nightsW(n) + ')</div></div></div>' +
    '<table><thead><tr><th>البيان</th><th class="n">الكمية</th><th class="n">السعر</th><th class="n">المبلغ</th></tr></thead><tbody>' +
    groups.map(function (gr) { return '<tr style="cursor:default"><td>إقامة ' + esc(T(b.typeId).name) + ' من ' + dShort(gr.from) + '</td><td class="n">' + gr.n + '</td><td class="n">' + money(gr.price) + '</td><td class="n">' + money(gr.price * gr.n) + '</td></tr>'; }).join('') +
    f.charges.map(function (c) { return '<tr style="cursor:default"><td>' + esc(c.desc) + ' <span style="color:#888">(' + dShort(c.date) + ')</span></td><td class="n">' + (c.qty || 1) + '</td><td class="n">' + money(c.amount) + '</td><td class="n">' + money(c.amount * (c.qty || 1)) + '</td></tr>'; }).join('') +
    (f.tax ? '<tr style="cursor:default"><td>ضريبة ' + s.taxPercent + '%</td><td></td><td></td><td class="n">' + money(f.tax) + '</td></tr>' : '') +
    (f.discount ? '<tr style="cursor:default"><td>حسم</td><td></td><td></td><td class="n">-' + money(f.discount) + '</td></tr>' : '') +
    '</tbody></table><div style="display:grid;gap:4px;justify-content:end;min-width:240px;margin-inline-start:auto;font-size:14px">' +
    '<div style="display:flex;justify-content:space-between;gap:30px"><span>المجموع</span><b class="ltr">' + money(f.total) + '</b></div><div style="display:flex;justify-content:space-between;gap:30px"><span>المدفوع</span><span class="ltr">' + money(f.paid) + '</span></div><div style="display:flex;justify-content:space-between;gap:30px;border-top:2px solid #23222B;padding-top:6px;font-size:16px"><span>المتبقي</span><b class="ltr">' + money(f.balance) + '</b></div>' + (s.sypRate ? '<div style="color:#777;font-size:12px">سعر الصرف: ' + s.sypRate + ' ل.س للدولار</div>' : '') + '</div>' +
    '<div style="border-top:1px solid #eee;padding-top:12px;display:flex;justify-content:space-between;color:#777;font-size:12px;flex-wrap:wrap;gap:8px"><span>شكراً لإقامتكم في ' + esc(s.hotelName) + '</span><span>الموظف: ' + esc(S.me.name) + '</span></div></div></div>');
  if ($('#invPrint')) $('#invPrint').onclick = function () { document.body.classList.add('printing-invoice'); window.print(); setTimeout(function () { document.body.classList.remove('printing-invoice'); }, 500); };
}

/* ======================= guest drawer ======================= */
function openGuest(id) { openDrawer(function () { renderGuest(id); }); }
function renderGuest(id) {
  var g = G(id), st = guestStats(g), bs = (S.idx.byGuest[id] || []).slice().sort(function (a, b) { return b.checkIn.localeCompare(a.checkIn); });
  var d = $('#drawer');
  d.innerHTML = '<div class="dr-h"><div class="avatar" style="width:40px;height:40px">' + esc(g.name.trim()[0]) + '</div><div style="flex:1"><h2>' + esc(g.name) + '</h2><div class="sub">ضيف منذ ' + tStamp(g.createdAt).slice(0, 5) + '</div></div><button class="icon-btn" id="gdX">' + ic('x') + '</button></div><div class="dr-b">' +
    '<div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">' + kpi('الإقامات', st.stays, st.last ? 'آخرها ' + dShort(st.last) : 'لا توجد') + kpi('الليالي', st.nights, '') + kpi('المدفوع', '<span class="ltr" style="font-size:24px">' + money(st.spent) + '</span>', '') + '</div>' +
    '<div class="card"><div class="card-h"><h3>البيانات</h3><div class="sp">' + (waUrl(g.phone) ? '<a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="' + waUrl(g.phone) + '">' + ic('wa', 15) + ' واتساب</a>' : '') + '</div></div><div class="card-b" style="display:grid;gap:12px">' + guestFields(g) +
    '<div style="display:flex;gap:16px;flex-wrap:wrap"><label class="switch"><input type="checkbox" id="gfVip"' + (g.vip ? ' checked' : '') + '> ضيف مميز VIP</label>' + (isMgr() ? '<label class="switch"><input type="checkbox" id="gfBl"' + (g.blacklist ? ' checked' : '') + '> منع الحجز عبر الموقع</label>' : '') + '</div>' +
    '<div style="display:flex;gap:8px"><button class="btn btn-p" id="gfSave">حفظ</button><button class="btn btn-s" id="gfBook">' + ic('plus', 15) + ' حجز جديد لهذا الضيف</button></div></div></div>' +
    '<div class="card"><div class="card-h"><h3>الحجوزات</h3><span class="tag">' + bs.length + '</span></div><div class="lst">' + (bs.map(function (b) { return '<div class="li" data-b="' + b.id + '"><span class="rn' + (b.roomId ? '' : ' none') + '">' + (b.roomId ? R(b.roomId).number : '—') + '</span><div class="mid"><b class="ltr" style="display:inline">' + b.code + '</b><span class="sub" style="display:block">' + dShort(b.checkIn) + ' ← ' + dShort(b.checkOut) + ' · ' + esc(T(b.typeId).name) + '</span></div>' + pill(b.status) + '<b class="ltr">' + money(folio(b).total) + '</b></div>'; }).join('') || '<div class="empty">لا توجد حجوزات</div>') + '</div></div></div>';
  $('#gdX').onclick = closeDrawer;
  wireCommon(d);
  $('#gfSave').onclick = function () { var body = readGuest(); body.vip = $('#gfVip').checked; if ($('#gfBl')) body.blacklist = $('#gfBl').checked; act(API.patch('/api/staff/guests/' + id, body), 'تم حفظ بيانات الضيف').catch(function () {}); };
  $('#gfBook').onclick = function () { newBooking({ guestId: id }); };
}
var NATS = ['سوري', 'لبناني', 'أردني', 'عراقي', 'فلسطيني', 'سعودي', 'إماراتي', 'كويتي', 'قطري', 'مصري', 'تركي', 'إيراني', 'روسي', 'ألماني', 'فرنسي', 'إيطالي', 'بريطاني', 'أمريكي'];
function guestFields(g) {
  g = g || {};
  return '<div class="frow"><div class="fld"><label for="gfN">الاسم الكامل</label><input class="in" id="gfN" value="' + esc(g.name || '') + '"></div><div class="fld"><label for="gfP">الهاتف</label><input class="in" id="gfP" dir="ltr" value="' + esc(g.phone || '') + '" placeholder="09xx xxx xxx"></div></div>' +
    '<div class="frow"><div class="fld"><label for="gfNat">الجنسية</label><input class="in" id="gfNat" list="natList" value="' + esc(g.nationality || '') + '"><datalist id="natList">' + NATS.map(function (n) { return '<option value="' + n + '">'; }).join('') + '</datalist></div><div class="fld"><label for="gfIt">نوع الوثيقة</label><select class="in" id="gfIt">' + ['هوية', 'جواز سفر', 'إقامة', 'رخصة قيادة'].map(function (x) { return '<option' + (g.idType === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div><div class="fld"><label for="gfIn">رقم الوثيقة</label><input class="in" id="gfIn" dir="ltr" value="' + esc(g.idNumber || '') + '"></div></div>' +
    '<div class="frow"><div class="fld"><label for="gfE">البريد</label><input class="in" id="gfE" dir="ltr" value="' + esc(g.email || '') + '"></div><div class="fld"><label for="gfCo">الشركة / الجهة</label><input class="in" id="gfCo" value="' + esc(g.company || '') + '"></div></div>' +
    '<div class="fld"><label for="gfNo">ملاحظات</label><textarea class="in" id="gfNo">' + esc(g.notes || '') + '</textarea></div>';
}
function readGuest() { return { name: $('#gfN').value, phone: $('#gfP').value, nationality: $('#gfNat').value, idType: $('#gfIt').value, idNumber: $('#gfIn').value, email: $('#gfE').value, company: $('#gfCo').value, notes: $('#gfNo').value }; }
function guestForm() {
  modal('<div class="dr-h"><h2>ضيف جديد</h2><button class="icon-btn" data-x style="margin-inline-start:auto">' + ic('x') + '</button></div><div class="dr-b">' + guestFields({ nationality: 'سوري' }) + '</div><div class="dr-f"><button class="btn btn-p" id="ngOk">حفظ</button><button class="btn btn-s" data-x>إلغاء</button></div>');
  $('#ngOk').onclick = function () { act(API.post('/api/staff/guests', readGuest()), 'تمت إضافة الضيف').then(function (g) { closeModal(); openGuest(g.id); }).catch(function () {}); };
}

/* ======================= room drawer ======================= */
function openRoom(id) { openDrawer(function () { renderRoom(id); }); }
function renderRoom(id) {
  var r = R(id), t = today(), s = roomState(r, t), d = $('#drawer');
  var next = S.db.bookings.filter(function (b) { return b.roomId === id && HOLD[b.status] && b.checkIn > t; }).sort(function (a, b) { return a.checkIn.localeCompare(b.checkIn); }).slice(0, 5);
  var past = S.db.bookings.filter(function (b) { return b.roomId === id && b.status === 'checked_out'; }).sort(function (a, b) { return b.checkOut.localeCompare(a.checkOut); }).slice(0, 5);
  var cur = s.cur || s.arr;
  function row(b) { var g = G(b.guestId); return '<div class="li" data-b="' + b.id + '"><div class="mid"><b>' + esc(g.name) + '</b><span class="sub">' + dShort(b.checkIn) + ' ← ' + dShort(b.checkOut) + '</span></div>' + pill(b.status) + '</div>'; }
  d.innerHTML = '<div class="dr-h"><span class="rn" style="font-size:20px;min-width:62px;height:44px">' + r.number + '</span><div style="flex:1"><h2>' + esc(T(r.typeId).name) + '</h2><div class="sub">الطابق ' + r.floor + ' · ' + HK[r.status] + (r.note ? ' · ' + esc(r.note) : '') + '</div></div><button class="icon-btn" id="rdX">' + ic('x') + '</button></div><div class="dr-b">' +
    (cur ? '<div class="card"><div class="card-h"><h3>' + (s.cur ? 'الضيف الحالي' : 'وصول اليوم') + '</h3></div><div class="lst">' + row(cur) + '</div><div class="card-b" style="display:flex;gap:8px;flex-wrap:wrap">' + (s.cur ? '<button class="btn btn-p" id="rdOut">' + ic('out', 15) + ' تسجيل خروج</button>' : !isHK() ? '<button class="btn btn-p" id="rdIn">' + ic('in', 15) + ' تسجيل دخول</button>' : '') + '<button class="btn btn-s" id="rdOpen">فتح الحجز</button></div></div>'
      : '<div class="card"><div class="card-b" style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><b>الغرفة شاغرة الليلة</b><div class="sub">' + (r.status === 'clean' ? 'نظيفة وجاهزة' : HK[r.status]) + '</div></div>' + (!isHK() && r.status !== 'ooo' ? '<button class="btn btn-p" id="rdWalk">' + ic('plus', 15) + ' حجز / ضيف مباشر</button>' : '') + '</div></div>') +
    '<div class="card"><div class="card-h"><h3>حالة التنظيف</h3></div><div class="card-b chips">' + ['clean', 'dirty', 'inspect'].map(function (k) { return '<button class="chip" data-st="' + k + '" aria-pressed="' + (r.status === k) + '"><i class="hk hk-' + k + '" style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-inline-end:6px"></i>' + HK[k] + '</button>'; }).join('') + (!isHK() ? (r.status === 'ooo' ? '<button class="chip" data-st="dirty">إعادة للخدمة</button>' : '<button class="chip" id="rdOoo">خارج الخدمة</button>') : '') + '</div></div>' +
    '<div class="card"><div class="card-h"><h3>الحجوزات القادمة</h3></div><div class="lst">' + (next.map(row).join('') || '<div class="empty">لا توجد</div>') + '</div></div>' +
    '<div class="card"><div class="card-h"><h3>آخر الإقامات</h3></div><div class="lst">' + (past.map(row).join('') || '<div class="empty">لا توجد</div>') + '</div></div></div>';
  $('#rdX').onclick = closeDrawer;
  wireCommon(d);
  $$('[data-st]', d).forEach(function (c) { c.onclick = function () { setRoomStatus(id, c.dataset.st); }; });
  if ($('#rdOoo')) $('#rdOoo').onclick = function () { oooModal(id); };
  if ($('#rdOut')) $('#rdOut').onclick = function () { checkOut(s.cur.id); };
  if ($('#rdIn')) $('#rdIn').onclick = function () { checkIn(s.arr.id); };
  if ($('#rdOpen')) $('#rdOpen').onclick = function () { openBooking(cur.id); };
  if ($('#rdWalk')) $('#rdWalk').onclick = function () { newBooking({ roomId: id, checkIn: t, walkIn: true }); };
}

/* ======================= new booking ======================= */
function newBooking(pre) {
  var t = today();
  var st = { checkIn: pre.checkIn || t, checkOut: U.addDays(pre.checkIn || t, 1), adults: 2, children: 0, typeId: pre.roomId ? R(pre.roomId).typeId : '', roomId: pre.roomId || '', guestId: pre.guestId || '', source: pre.walkIn ? 'walk_in' : 'phone' };
  if (pre.roomId) st.adults = Math.min(2, T(st.typeId).capacity);
  closeDrawer();
  modal('<div class="dr-h"><h2>' + (pre.walkIn ? 'تسجيل ضيف مباشر' : 'حجز جديد') + '</h2><button class="icon-btn" data-x style="margin-inline-start:auto">' + ic('x') + '</button></div><div class="dr-b" id="nb"></div><div class="dr-f" id="nbF"></div>');
  var guestDraft = pre.guestId ? null : { nationality: 'سوري', idType: 'هوية' };
  function draw() {
    var ok = U.isDate(st.checkIn) && U.isDate(st.checkOut) && st.checkOut > st.checkIn, n = ok ? U.nightsBetween(st.checkIn, st.checkOut) : 0;
    var html = '<div class="frow"><div class="fld"><label for="nbIn">الوصول</label><input class="in" type="date" id="nbIn" value="' + st.checkIn + '"></div><div class="fld"><label for="nbOut">المغادرة</label><input class="in" type="date" id="nbOut" value="' + st.checkOut + '"></div><div class="fld"><label for="nbN">الليالي</label><input class="in" type="number" min="1" id="nbN" value="' + (n || 1) + '"></div><div class="fld"><label for="nbA">البالغون</label><input class="in" type="number" min="1" id="nbA" value="' + st.adults + '"></div><div class="fld"><label for="nbC">الأطفال</label><input class="in" type="number" min="0" id="nbC" value="' + st.children + '"></div><div class="fld"><label for="nbS">المصدر</label><select class="in" id="nbS">' + Object.keys(SOURCE).map(function (k) { return '<option value="' + k + '"' + (st.source === k ? ' selected' : '') + '>' + SOURCE[k] + '</option>'; }).join('') + '</select></div></div>';
    if (ok) {
      html += '<div class="sec-t">نوع الغرفة</div><div class="type-pick">' + S.db.roomTypes.map(function (ty) {
        var av = U.availableRange(S.db, ty.id, st.checkIn, st.checkOut), q = U.quote(S.db, ty.id, st.checkIn, st.checkOut);
        return '<button class="tp" data-ty="' + ty.id + '" aria-pressed="' + (st.typeId === ty.id) + '"' + (av <= 0 ? ' disabled' : '') + '><b>' + esc(ty.name) + '</b><span class="sub">' + (av > 0 ? av + ' متاحة' : 'ممتلئ') + ' · حتى ' + ty.capacity + ' بالغ</span><span class="ltr tn" style="font-weight:700">' + money(q.subtotal) + '</span></button>';
      }).join('') + '</div>';
      if (st.typeId) {
        var free = U.freeRooms(S.db, st.typeId, st.checkIn, st.checkOut);
        if (st.roomId && !free.some(function (r) { return r.id === st.roomId; })) st.roomId = '';
        html += '<div class="sec-t">رقم الغرفة</div><div class="room-pick" id="nbRooms"><button data-r="" aria-pressed="' + (!st.roomId) + '" style="font-weight:500">لاحقاً</button>' + free.map(function (r) { return '<button data-r="' + r.id + '" aria-pressed="' + (st.roomId === r.id) + '" title="' + HK[r.status] + '">' + r.number + '<span class="hk hk-' + r.status + '"></span></button>'; }).join('') + '</div>';
      }
    } else html += '<p style="color:var(--bad)">تاريخ المغادرة يجب أن يكون بعد الوصول.</p>';
    // guest
    html += '<div class="sec-t">الضيف</div>';
    if (st.guestId) { var g = G(st.guestId); html += '<div class="card" style="padding:12px 14px;display:flex;gap:10px;align-items:center"><div class="avatar">' + esc(g.name[0]) + '</div><div style="flex:1"><b>' + esc(g.name) + '</b><div class="sub ltr">' + esc(g.phone) + '</div></div><button class="btn btn-s btn-sm" id="nbGx">تغيير</button></div>'; }
    else html += '<div class="fld" style="position:relative"><label for="nbGs">ابحث عن ضيف سابق (اسم أو هاتف) أو أدخل ضيفاً جديداً بالأسفل</label><input class="in" id="nbGs" autocomplete="off"><div class="suggest" id="nbSug" hidden></div></div>' + guestFields(guestDraft);
    // price
    if (ok && st.typeId) {
      var q = U.quote(S.db, st.typeId, st.checkIn, st.checkOut), avg = q.subtotal / n;
      html += '<div class="sec-t">السعر والدفع</div><div class="frow"><div class="fld"><label for="nbR">سعر الليلة $</label><input class="in" type="number" id="nbR" placeholder="' + Math.round(avg * 100) / 100 + '" value="' + (st.rate != null ? st.rate : '') + '"></div><div class="fld"><label for="nbD">حسم $</label><input class="in" type="number" id="nbD" value="' + (st.discount || '') + '"></div><div class="fld"><label for="nbP">دفعة الآن $</label><input class="in" type="number" id="nbP" value="' + (st.pay || '') + '"></div><div class="fld"><label for="nbPm">طريقة الدفع</label><select class="in" id="nbPm"><option value="cash">نقداً</option><option value="card">بطاقة</option><option value="transfer">تحويل</option></select></div></div>' +
        '<div class="fld"><label for="nbNo">ملاحظات</label><input class="in" id="nbNo" value="' + esc(st.notes || '') + '"></div>' +
        (st.checkIn === t ? '<label class="switch"><input type="checkbox" id="nbCi"' + (st.checkinNow !== false && pre.walkIn ? ' checked' : st.checkinNow ? ' checked' : '') + '> تسجيل الدخول الآن</label>' : '');
    }
    $('#nb').innerHTML = html;
    var total = 0;
    if (ok && st.typeId) { var q2 = U.quote(S.db, st.typeId, st.checkIn, st.checkOut); total = (st.rate != null && st.rate !== '' ? +st.rate * n : q2.subtotal); total = total * (1 + (S.db.settings.taxPercent || 0) / 100) - (+st.discount || 0); }
    $('#nbF').innerHTML = '<div style="flex:1"><div class="sub">' + (ok ? nightsW(n) : '') + (st.typeId ? ' · ' + esc(T(st.typeId).name) : '') + (st.roomId ? ' · غرفة ' + R(st.roomId).number : '') + '</div><b class="ltr" style="font-size:22px">' + money(total) + '</b></div><button class="btn btn-p" id="nbGo"' + (ok && st.typeId ? '' : ' disabled') + ' style="padding:10px 22px">' + (pre.walkIn || (st.checkinNow && st.roomId) ? 'حفظ وتسجيل الدخول' : 'حفظ الحجز') + '</button>';
    wire();
  }
  function keepGuest() { if (!st.guestId && $('#gfN')) guestDraft = readGuest(); }
  function wire() {
    function dates() { keepGuest(); st.checkIn = $('#nbIn').value; st.checkOut = $('#nbOut').value; draw(); }
    $('#nbIn').onchange = function () { var n = +$('#nbN').value || 1; st.checkIn = this.value; st.checkOut = U.isDate(this.value) ? U.addDays(this.value, n) : st.checkOut; keepGuest(); draw(); };
    $('#nbOut').onchange = dates;
    $('#nbN').onchange = function () { var n = Math.max(1, +this.value || 1); if (U.isDate(st.checkIn)) st.checkOut = U.addDays(st.checkIn, n); keepGuest(); draw(); };
    $('#nbA').onchange = function () { st.adults = +this.value; };
    $('#nbC').onchange = function () { st.children = +this.value; };
    $('#nbS').onchange = function () { st.source = this.value; };
    $$('[data-ty]').forEach(function (b) { b.onclick = function () { keepGuest(); st.typeId = b.dataset.ty; st.roomId = ''; draw(); }; });
    $$('#nbRooms [data-r]').forEach(function (b) { b.onclick = function () { keepGuest(); st.roomId = b.dataset.r; draw(); }; });
    if ($('#nbGx')) $('#nbGx').onclick = function () { st.guestId = ''; draw(); };
    ['nbR', 'nbD', 'nbP', 'nbNo'].forEach(function (k) { var e = $('#' + k); if (e) e.oninput = function () { st[{ nbR: 'rate', nbD: 'discount', nbP: 'pay', nbNo: 'notes' }[k]] = e.value; if (k !== 'nbNo' && k !== 'nbP') { var f = $('#nbF b'); var n = U.nightsBetween(st.checkIn, st.checkOut), q = U.quote(S.db, st.typeId, st.checkIn, st.checkOut); var tot = (st.rate !== '' && st.rate != null ? +st.rate * n : q.subtotal) * (1 + (S.db.settings.taxPercent || 0) / 100) - (+st.discount || 0); f.textContent = money(tot); } }; });
    if ($('#nbCi')) $('#nbCi').onchange = function () { st.checkinNow = this.checked; keepGuest(); draw(); };
    var gs = $('#nbGs');
    if (gs) gs.oninput = function () {
      var q = gs.value.trim().toLowerCase(), qd = q.replace(/[^\d]/g, ''), sug = $('#nbSug');
      if (q.length < 2) { sug.hidden = true; return; }
      var m = S.db.guests.filter(function (g) { return g.name.toLowerCase().indexOf(q) >= 0 || (qd.length >= 3 && U.normPhone(g.phone).indexOf(qd) >= 0); }).slice(0, 6);
      sug.innerHTML = m.map(function (g) { return '<div data-g="' + g.id + '"><span>' + (g.blacklist ? '⛔ ' : '') + esc(g.name) + '</span><span class="sub ltr">' + esc(g.phone) + '</span></div>'; }).join('') || '<div class="muted">لا يوجد — أكمل بيانات الضيف الجديد</div>';
      sug.hidden = false;
      $$('[data-g]', sug).forEach(function (x) { x.onclick = function () { st.guestId = x.dataset.g; draw(); }; });
    };
    $('#nbGo').onclick = submit;
  }
  function submit() {
    keepGuest();
    var body = { typeId: st.typeId, roomId: st.roomId || null, checkIn: st.checkIn, checkOut: st.checkOut, adults: st.adults, children: st.children, source: st.source, notes: st.notes || '', discount: +st.discount || 0 };
    if (st.rate !== undefined && st.rate !== '') body.nightlyRate = +st.rate;
    if (st.guestId) body.guest = { id: st.guestId }; else body.guest = guestDraft;
    var ciBox = $('#nbCi'); body.checkinNow = !!(ciBox && ciBox.checked);
    if (body.checkinNow && !body.roomId) { toast('اختر رقم الغرفة لتسجيل الدخول الآن', 'err'); return; }
    if (!st.guestId && (!guestDraft.name || guestDraft.name.trim().length < 2)) { toast('اكتب اسم الضيف', 'err'); $('#gfN').focus(); return; }
    var pay = +st.pay || 0, pm = $('#nbPm') ? $('#nbPm').value : 'cash';
    $('#nbGo').disabled = true;
    API.post('/api/staff/bookings', body).then(function (b) {
      return (pay > 0 ? API.post('/api/staff/payments', { bookingId: b.id, amount: pay, method: pm, currency: 'USD' }) : Promise.resolve()).then(function () { return b; });
    }).then(function (b) {
      closeModal(); toast(body.checkinNow ? 'تم تسجيل الدخول — غرفة ' + R(b.roomId).number : 'تم إنشاء الحجز ' + b.code);
      return load().then(function () { openBooking(b.id); });
    }).catch(function (e) { toast(esc(e.message), 'err'); if ($('#nbGo')) $('#nbGo').disabled = false; });
  }
  draw();
}

/* ======================= password / setup ======================= */
function passwordModal(forced) {
  modal('<div class="dr-h"><h2>' + (forced ? 'اختر كلمة مرور جديدة' : 'تغيير كلمة المرور') + '</h2>' + (forced ? '' : '<button class="icon-btn" data-x style="margin-inline-start:auto">' + ic('x') + '</button>') + '</div><div class="dr-b">' + (forced ? '<p class="muted">لحماية النظام، غيّر كلمة المرور المؤقتة قبل المتابعة.</p>' : '') +
    '<div class="fld"><label for="pwO">كلمة المرور الحالية</label><input class="in" type="password" id="pwO" dir="ltr" autocomplete="current-password"></div><div class="fld"><label for="pwN">كلمة المرور الجديدة (6 أحرف على الأقل)</label><input class="in" type="password" id="pwN" dir="ltr" autocomplete="new-password"></div><div class="fld"><label for="pwN2">تأكيد كلمة المرور</label><input class="in" type="password" id="pwN2" dir="ltr" autocomplete="new-password"></div></div>' +
    '<div class="dr-f"><button class="btn btn-p" id="pwOk">حفظ</button></div>', true);
  if (forced) $('#modal').dataset.lock = '1';
  $('#pwOk').onclick = function () {
    if ($('#pwN').value !== $('#pwN2').value) { toast('كلمتا المرور غير متطابقتين', 'err'); return; }
    API.post('/api/auth/password', { old: $('#pwO').value, new: $('#pwN').value }).then(function () { delete $('#modal').dataset.lock; closeModal(); toast('تم تغيير كلمة المرور'); S.me.mustChange = false; load(true).then(postLoginChecks); })
      .catch(function (e) { toast(esc(e.message), 'err'); });
  };
}
function postLoginChecks() {
  if (S.me.mustChange) { passwordModal(true); return; }
  if (isMgr() && !S.db.settings.setupDone) setupWizard();
}
function setupWizard() {
  var s = S.db.settings;
  modal('<div class="dr-h"><svg style="width:34px;height:36px;color:var(--ultra)"><use href="#logo"/></svg><div><h2>أهلاً بك في نظام البتراء</h2><div class="sub">إعداد سريع لمرة واحدة، ويمكن تعديله لاحقاً من الإعدادات</div></div></div><div class="dr-b">' +
    '<div class="fld"><label for="swWa">رقم واتساب الاستقبال (يظهر للضيوف ويستقبل تفاصيل الحجز)</label><input class="in" id="swWa" dir="ltr" placeholder="963 9xx xxx xxx" value="' + esc(s.whatsapp || '') + '"></div>' +
    '<div class="sec-t">تنبيه تلقائي على واتساب عند كل حجز جديد</div><p class="sub" style="line-height:1.8">من هاتف الاستقبال: أضف رقم CallMeBot إلى جهات الاتصال وأرسل له <b class="ltr">I allow callmebot to send me messages</b>. سيرد عليك بمفتاح apikey. الرقم والتعليمات في <a href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noopener">صفحة CallMeBot</a>.</p>' +
    '<div class="frow"><div class="fld"><label for="swPh">رقم الهاتف الذي يستقبل التنبيه</label><input class="in" id="swPh" dir="ltr"></div><div class="fld"><label for="swKey">apikey</label><input class="in" id="swKey" dir="ltr"></div></div>' +
    '<div class="frow"><div class="fld"><label for="swRate">سعر صرف الدولار بالليرة (اختياري)</label><input class="in" type="number" id="swRate" value="' + (s.sypRate || '') + '"></div><div class="fld"><label for="swCi">وقت الدخول</label><input class="in" type="time" id="swCi" value="' + s.checkIn + '"></div><div class="fld"><label for="swCo">وقت المغادرة</label><input class="in" type="time" id="swCo" value="' + s.checkOut + '"></div></div>' +
    '<p class="sub">تأكد من أسعار الغرف في «الغرف والأسعار» قبل تشغيل الموقع للضيوف.</p></div><div class="dr-f"><button class="btn btn-p" id="swOk">حفظ والبدء</button><button class="btn btn-s" id="swSkip">لاحقاً</button></div>');
  $('#modal').dataset.lock = '1';
  function done(body) { body.setupDone = true; API.put('/api/staff/settings', body).then(function () { delete $('#modal').dataset.lock; closeModal(); toast('تم الإعداد. النظام جاهز'); load(true); }).catch(function (e) { toast(esc(e.message), 'err'); }); }
  $('#swOk').onclick = function () { var body = { whatsapp: $('#swWa').value, sypRate: +$('#swRate').value || 0, checkIn: $('#swCi').value, checkOut: $('#swCo').value }; if ($('#swPh').value && $('#swKey').value) body.recipients = [{ name: 'الاستقبال', phone: $('#swPh').value, apikey: $('#swKey').value, active: true }]; done(body); };
  $('#swSkip').onclick = function () { done({}); };
}

/* ======================= boot ======================= */
API.mode().then(function (m) { S.mode = m; return load(); });
})();
