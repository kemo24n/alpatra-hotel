/*!
 * Alpatra Hotel — core engine
 * One engine drives both the Node server (server.js) and the offline preview (api.js).
 * Built by Solunera — Kamel Nassif
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlpatraEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------- sha256 (pure JS) ---------------- */
  function sha256(ascii) {
    function rrot(v, a) { return (v >>> a) | (v << (32 - a)); }
    var mathPow = Math.pow, maxWord = mathPow(2, 32), result = '', words = [], i, j;
    var asciiBitLength = ascii.length * 8;
    var hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || [], primeCounter = k.length;
    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    hash = hash.slice(0, 8);
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return null;
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((asciiBitLength / maxWord) | 0);
    words[words.length] = (asciiBitLength);
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var temp1 = hash[7] + (rrot(e, 6) ^ rrot(e, 11) ^ rrot(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rrot(w15, 7) ^ rrot(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rrot(w2, 17) ^ rrot(w2, 19) ^ (w2 >>> 10))) | 0);
        var temp2 = (rrot(a, 2) ^ rrot(a, 13) ^ rrot(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { var b = (hash[i] >> (j * 8)) & 255; result += ((b < 16) ? 0 : '') + b.toString(16); }
    return result;
  }
  function utf8(s) { return unescape(encodeURIComponent(String(s))); }
  function hashPassword(pw, salt) {
    var h = utf8(salt + ':' + pw);
    for (var i = 0; i < 3000; i++) h = sha256(h + salt);
    return h;
  }

  /* ---------------- date helpers (hotel time = Damascus, UTC+3) ---------------- */
  var TZ_OFFSET = 3 * 3600e3;
  function todayStr(now) { return new Date(now + TZ_OFFSET).toISOString().slice(0, 10); }
  function parseD(s) { return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); }
  function fmtD(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function addDays(s, n) { return fmtD(parseD(s) + n * 864e5); }
  function nightsBetween(a, b) { return Math.round((parseD(b) - parseD(a)) / 864e5); }
  function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseD(s)) && fmtD(parseD(s)) === s; }
  function dow(s) { return new Date(parseD(s)).getUTCDay(); } // 0 Sun .. 6 Sat
  function eachNight(a, b) { var out = [], d = a; while (d < b) { out.push(d); d = addDays(d, 1); } return out; }
  function round2(n) { return Math.round((+n || 0) * 100) / 100; }

  /* ---------------- defaults ---------------- */
  var ROOM_TYPES = [
    { id: 'single', name: 'غرفة مفردة', tagline: 'هادئة ومرتبة لرحلات العمل', size: 18, beds: 'سرير مفرد كبير', capacity: 1, maxChildren: 0, price: 35,
      images: ['media/room-single-1.webp', 'media/room-single-2.webp', 'media/bath-1.webp'],
      amenities: ['wifi', 'ac', 'tv', 'safe', 'minibar', 'shower', 'desk'],
      desc: 'غرفة مريحة لشخص واحد بإطلالة على شارع الاتحاد، مع مكتب عمل وإنترنت سريع وحمّام خاص بدوش وحوض.' },
    { id: 'double', name: 'غرفة مزدوجة', tagline: 'سرير كبير ومساحة للراحة', size: 24, beds: 'سرير مزدوج', capacity: 2, maxChildren: 1, price: 50,
      images: ['media/room-double-1.webp', 'media/room-double-2.webp', 'media/bath-2.webp'],
      amenities: ['wifi', 'ac', 'tv', 'safe', 'minibar', 'bathtub', 'desk'],
      desc: 'الاختيار الأكثر طلباً للأزواج: سرير مزدوج واسع، تلفاز بقنوات فضائية، خزنة رقمية، وحمّام بحوض استحمام.' },
    { id: 'twin', name: 'غرفة بسريرين', tagline: 'للأصدقاء والزملاء', size: 26, beds: 'سريران منفصلان', capacity: 2, maxChildren: 1, price: 50,
      images: ['media/room-twin-1.webp', 'media/room-twin-2.webp', 'media/bath-3.webp'],
      amenities: ['wifi', 'ac', 'tv', 'safe', 'minibar', 'bathtub'],
      desc: 'سريران منفصلان ومساحة جلوس صغيرة، مناسبة للزملاء في رحلات العمل أو للأصدقاء.' },
    { id: 'family', name: 'غرفة عائلية', tagline: 'مساحة لكل العائلة', size: 34, beds: 'سرير مزدوج + سرير مفرد', capacity: 3, maxChildren: 2, price: 75,
      images: ['media/room-family-1.webp', 'media/room-family-2.webp', 'media/bath-4.webp'],
      amenities: ['wifi', 'ac', 'tv', 'safe', 'minibar', 'bathtub', 'sofa'],
      desc: 'غرفة واسعة تتسع لثلاثة بالغين أو عائلة مع طفلين، مع ركن جلوس وخزائن إضافية للإقامات الطويلة.' },
    { id: 'damascene', name: 'الجناح الدمشقي', tagline: 'روح البيت الدمشقي', size: 42, beds: 'سرير كينغ', capacity: 2, maxChildren: 2, price: 95,
      images: ['media/room-damascene-1.webp', 'media/room-damascene-2.webp', 'media/bath-2.webp'],
      amenities: ['wifi', 'ac', 'tv', 'safe', 'minibar', 'bathtub', 'sofa', 'coffee'],
      desc: 'جناح بغرفة نوم وصالون مستقل، بخشب دافئ ونقوش مستوحاة من البيوت الدمشقية القديمة، مع ركن قهوة عربية.' },
    { id: 'royal', name: 'جناح البتراء الملكي', tagline: 'أفخم ما في الفندق', size: 60, beds: 'سرير كينغ فاخر', capacity: 3, maxChildren: 2, price: 150,
      images: ['media/room-royal-1.webp', 'media/room-royal-2.webp', 'media/bath-3.webp'],
      amenities: ['wifi', 'ac', 'tv', 'safe', 'minibar', 'bathtub', 'sofa', 'coffee', 'view'],
      desc: 'الجناح الأكبر في الفندق: غرفة نوم فاخرة، صالون استقبال، حمّام رخامي، وإطلالة على المدينة. يشمل الإفطار في الجناح.' }
  ];
  // 75 rooms over 5 floors, 15 per floor
  var FLOOR_PLAN = ['single', 'single', 'single', 'double', 'double', 'double', 'double', 'double', 'twin', 'twin', 'twin', 'family', 'family', 'damascene', 'royal'];
  function defaultRooms() {
    var rooms = [];
    for (var f = 1; f <= 5; f++) {
      for (var i = 0; i < 15; i++) {
        var t = FLOOR_PLAN[i];
        if (f === 1 && t === 'royal') t = 'damascene';   // royal suites only above floor 1
        if (f >= 4 && t === 'single' && i === 2) t = 'double';
        var num = String(f * 100 + i + 1);
        rooms.push({ id: 'r' + num, number: num, floor: f, typeId: t, status: 'clean', note: '' });
      }
    }
    return rooms;
  }

  function freshDb(now) {
    return {
      meta: { rev: 1, createdAt: now, version: 1 },
      settings: {
        hotelName: 'فندق ومطعم البتراء', hotelNameEn: 'Alpatra Hotel & Rest.',
        city: 'دمشق - سورية', address: 'البحصة - شارع الاتحاد', addressEn: 'Bahsa - Al Ithad St., Damascus, Syria',
        phones: ['+963 11 2315914', '+963 11 2315915', '+963 11 2315916', '+963 11 2315917'],
        fax: '+963 11 2315918', email: 'm-sabagh@scs-net.org', website: 'www.hotelalpatra.com',
        whatsapp: '', // reception WhatsApp shown to guests (international format, digits)
        recipients: [], // [{id,name,phone,apikey,active}] CallMeBot auto alerts
        checkIn: '14:00', checkOut: '12:00', currency: 'USD', sypRate: 0, taxPercent: 0,
        breakfastIncluded: true, weekendPct: 0, weekendDays: [4, 5], // Thu & Fri nights
        maxNights: 30, maxAdvanceDays: 365, onlineBooking: true,
        cancelPolicy: 'الإلغاء مجاني حتى 24 ساعة قبل موعد الوصول. يُدفع المبلغ عند الوصول إلى الفندق.',
        setupDone: false
      },
      roomTypes: JSON.parse(JSON.stringify(ROOM_TYPES)).map(function (t, i) { t.order = i; t.online = true; return t; }),
      rooms: defaultRooms(),
      rates: [],
      guests: [], bookings: [], charges: [], payments: [],
      users: [], sessions: {}, log: [], notifications: [],
      seq: { booking: 0, guest: 0, charge: 0, payment: 0, user: 0, rate: 0, note: 0 }
    };
  }

  function ensureAdmin(db, rand, fixedPw) {
    if (db.users.length) return null;
    var salt = rand(16);
    var pw = fixedPw || ('alpatra-' + rand(3));
    db.users.push({ id: 'u1', username: 'admin', name: 'مدير الفندق', role: 'manager', salt: salt, hash: hashPassword(pw, salt), active: true, mustChange: true, createdAt: Date.now() });
    db.seq.user = 1;
    return pw;
  }

  /* ---------------- core calculations ---------------- */
  var HOLD = { pending: 1, confirmed: 1, in_house: 1 };
  function typeById(db, id) { for (var i = 0; i < db.roomTypes.length; i++) if (db.roomTypes[i].id === id) return db.roomTypes[i]; return null; }
  function roomById(db, id) { for (var i = 0; i < db.rooms.length; i++) if (db.rooms[i].id === id) return db.rooms[i]; return null; }
  function find(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }

  function nightlyPrice(db, typeId, date) {
    var t = typeById(db, typeId); if (!t) return 0;
    var p = +t.price, s = db.settings;
    var wk = s.weekendDays || [];
    if (s.weekendPct && wk.indexOf(dow(date)) >= 0) p = p * (1 + s.weekendPct / 100);
    var best = null;
    for (var i = 0; i < db.rates.length; i++) {
      var r = db.rates[i];
      if (r.active === false) continue;
      if (date >= r.from && date <= r.to && (!r.typeId || r.typeId === typeId)) {
        if (!best || (r.typeId && !best.typeId) || (!!r.typeId === !!best.typeId && r.id > best.id)) best = r;
      }
    }
    if (best) p = best.mode === 'fixed' ? +best.value : p * (1 + (+best.value) / 100);
    return round2(p);
  }
  function quote(db, typeId, checkIn, checkOut) {
    var nights = eachNight(checkIn, checkOut).map(function (d) { return { date: d, price: nightlyPrice(db, typeId, d) }; });
    var sub = round2(nights.reduce(function (a, n) { return a + n.price; }, 0));
    var tax = round2(sub * (db.settings.taxPercent || 0) / 100);
    return { nights: nights, subtotal: sub, tax: tax, total: round2(sub + tax) };
  }
  function overlaps(b, from, to) { return b.checkIn < to && b.checkOut > from; }
  function typeInventory(db, typeId) {
    return db.rooms.filter(function (r) { return r.typeId === typeId && r.status !== 'ooo'; }).length;
  }
  function availableOn(db, typeId, date, exceptId) {
    var inv = typeInventory(db, typeId);
    var used = 0;
    for (var i = 0; i < db.bookings.length; i++) {
      var b = db.bookings[i];
      if (!HOLD[b.status] || b.id === exceptId) continue;
      var bt = b.roomId ? (roomById(db, b.roomId) || {}).typeId || b.typeId : b.typeId;
      if (bt === typeId && b.checkIn <= date && b.checkOut > date) used++;
    }
    return inv - used;
  }
  function availableRange(db, typeId, from, to, exceptId) {
    var min = Infinity;
    eachNight(from, to).forEach(function (d) { min = Math.min(min, availableOn(db, typeId, d, exceptId)); });
    return min === Infinity ? 0 : Math.max(0, min);
  }
  function roomFree(db, roomId, from, to, exceptId) {
    for (var i = 0; i < db.bookings.length; i++) {
      var b = db.bookings[i];
      if (b.roomId === roomId && HOLD[b.status] && b.id !== exceptId && overlaps(b, from, to)) return false;
    }
    var r = roomById(db, roomId);
    return !!r && r.status !== 'ooo';
  }
  function freeRooms(db, typeId, from, to, exceptId) {
    return db.rooms.filter(function (r) { return (!typeId || r.typeId === typeId) && roomFree(db, r.id, from, to, exceptId); });
  }
  function folio(db, b) {
    var charges = db.charges.filter(function (c) { return c.bookingId === b.id; });
    var payments = db.payments.filter(function (p) { return p.bookingId === b.id; });
    var room = round2(b.roomTotal || 0), tax = round2(b.tax || 0), disc = round2(b.discount || 0);
    var extras = round2(charges.reduce(function (a, c) { return a + c.amount * (c.qty || 1); }, 0));
    var total = round2(room + tax + extras - disc);
    var paid = round2(payments.reduce(function (a, p) { return a + p.amount; }, 0));
    return { room: room, tax: tax, discount: disc, extras: extras, total: total, paid: paid, balance: round2(total - paid), charges: charges, payments: payments };
  }

  /* ---------------- helpers ---------------- */
  function err(status, msg) { var e = new Error(msg); e.status = status; e.expose = true; return e; }
  function need(cond, msg) { if (!cond) throw err(400, msg); }
  function clean(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max || 200); }
  function phoneDigits(p) { return String(p || '').replace(/[^\d]/g, ''); }
  function normPhone(p) {
    var d = phoneDigits(p);
    if (d.indexOf('00') === 0) d = d.slice(2);
    if (d.indexOf('09') === 0 && d.length === 10) d = '963' + d.slice(1); // Syrian mobile 09xxxxxxxx
    return d;
  }
  var CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function newCode(db, rand) {
    for (var tries = 0; tries < 50; tries++) {
      var hex = rand(6), c = '';
      for (var i = 0; i < 5; i++) c += CODE_CHARS[parseInt(hex.substr(i * 2, 2), 16) % CODE_CHARS.length];
      c = 'AP-' + c;
      if (!db.bookings.some(function (b) { return b.code === c; })) return c;
    }
    return 'AP-' + Date.now().toString(36).toUpperCase();
  }
  function nextId(db, k, prefix) { db.seq[k] = (db.seq[k] || 0) + 1; return prefix + db.seq[k]; }
  function log(db, ctx, action, ref, detail) {
    db.log.unshift({ at: ctx.now, uid: ctx.user ? ctx.user.id : null, who: ctx.user ? ctx.user.name : 'الموقع', action: action, ref: ref || null, detail: detail || '' });
    if (db.log.length > 3000) db.log.length = 3000;
  }
  function notify(db, ctx, type, text, bookingId) {
    db.notifications.unshift({ id: nextId(db, 'note', 'n'), at: ctx.now, type: type, text: text, bookingId: bookingId || null, readBy: [] });
    if (db.notifications.length > 300) db.notifications.length = 300;
  }
  function money(db, n) { return '$' + round2(n).toLocaleString('en-US'); }
  function publicBooking(db, b) {
    var t = typeById(db, b.typeId) || {}, g = find(db.guests, b.guestId) || {};
    var r = b.roomId ? roomById(db, b.roomId) : null;
    return { code: b.code, status: b.status, typeId: b.typeId, typeName: t.name, image: (t.images || [])[0], checkIn: b.checkIn, checkOut: b.checkOut,
      nights: nightsBetween(b.checkIn, b.checkOut), adults: b.adults, children: b.children, total: round2((b.roomTotal || 0) + (b.tax || 0) - (b.discount || 0)),
      name: g.name, room: r && b.status !== 'pending' ? r.number : null, createdAt: b.createdAt, arrivalTime: b.arrivalTime, requests: b.requests };
  }
  function waBookingText(db, b, heading) {
    var t = typeById(db, b.typeId) || {}, g = find(db.guests, b.guestId) || {};
    var n = nightsBetween(b.checkIn, b.checkOut);
    return [heading || '🔔 حجز جديد من الموقع — فندق البتراء',
      'رقم الحجز: ' + b.code,
      'الضيف: ' + (g.name || '') + ' — ' + (g.phone || ''),
      'الغرفة: ' + (t.name || ''),
      'الوصول: ' + b.checkIn + ' | المغادرة: ' + b.checkOut + ' (' + (n === 1 ? 'ليلة واحدة' : n === 2 ? 'ليلتان' : n + (n < 11 ? ' ليالٍ' : ' ليلة')) + ')',
      'الأشخاص: ' + b.adults + ' بالغ' + (b.children ? ' + ' + b.children + ' طفل' : ''),
      'المجموع: ' + money(db, (b.roomTotal || 0) + (b.tax || 0)),
      b.arrivalTime ? 'وقت الوصول المتوقع: ' + b.arrivalTime : '',
      b.requests ? 'طلبات: ' + b.requests : ''
    ].filter(Boolean).join('\n');
  }
  function waEffects(db, text) {
    return (db.settings.recipients || []).filter(function (r) { return r.active !== false && r.phone && r.apikey; })
      .map(function (r) { return { type: 'whatsapp', phone: normPhone(r.phone), apikey: r.apikey, text: text }; });
  }
  function upsertGuest(db, ctx, g) {
    var phone = normPhone(g.phone);
    var existing = g.id ? find(db.guests, g.id) : (phone ? db.guests.filter(function (x) { return normPhone(x.phone) === phone; })[0] : null);
    var fields = ['name', 'phone', 'email', 'nationality', 'idType', 'idNumber', 'birthDate', 'address', 'notes', 'company'];
    if (existing) {
      fields.forEach(function (f) { if (g[f] != null && String(g[f]).trim() !== '') existing[f] = clean(g[f], f === 'notes' ? 1000 : 120); });
      if (g.vip != null) existing.vip = !!g.vip;
      if (g.blacklist != null) existing.blacklist = !!g.blacklist;
      return existing;
    }
    need(clean(g.name).length >= 2, 'اكتب اسم الضيف');
    var ng = { id: nextId(db, 'guest', 'g'), createdAt: ctx.now, vip: !!g.vip, blacklist: false };
    fields.forEach(function (f) { ng[f] = clean(g[f], f === 'notes' ? 1000 : 120); });
    db.guests.push(ng);
    return ng;
  }

  /* ---------------- views ---------------- */
  function publicInfo(db) {
    var s = db.settings;
    return {
      settings: { hotelName: s.hotelName, hotelNameEn: s.hotelNameEn, city: s.city, address: s.address, addressEn: s.addressEn, phones: s.phones, fax: s.fax,
        email: s.email, website: s.website, whatsapp: normPhone(s.whatsapp), checkIn: s.checkIn, checkOut: s.checkOut, currency: s.currency, sypRate: s.sypRate,
        taxPercent: s.taxPercent, breakfastIncluded: s.breakfastIncluded, maxNights: s.maxNights, maxAdvanceDays: s.maxAdvanceDays, onlineBooking: s.onlineBooking !== false,
        cancelPolicy: s.cancelPolicy },
      roomTypes: db.roomTypes.filter(function (t) { return t.online !== false; }).sort(function (a, b) { return a.order - b.order; })
        .map(function (t) { var c = JSON.parse(JSON.stringify(t)); c.count = typeInventory(db, t.id); return c; }),
      totalRooms: db.rooms.length
    };
  }
  function staffState(db, ctx) {
    var c = JSON.parse(JSON.stringify(db));
    delete c.sessions;
    c.users = db.users.map(function (u) { return { id: u.id, username: u.username, name: u.name, role: u.role, active: u.active, createdAt: u.createdAt, lastLogin: u.lastLogin }; });
    if (ctx.user.role !== 'manager') {
      c.settings.recipients = (c.settings.recipients || []).map(function (r) { return { id: r.id, name: r.name, phone: r.phone, active: r.active }; });
      c.log = c.log.slice(0, 200);
    } else {
      c.settings.recipients = (c.settings.recipients || []).map(function (r) { return { id: r.id, name: r.name, phone: r.phone, active: r.active, apikey: r.apikey ? '••••' + String(r.apikey).slice(-3) : '' }; });
    }
    c.me = { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role, username: ctx.user.username, mustChange: !!ctx.user.mustChange };
    c.today = todayStr(ctx.now);
    return c;
  }

  /* ---------------- booking ops ---------------- */
  function validateStay(db, ctx, checkIn, checkOut, staff) {
    need(isDate(checkIn) && isDate(checkOut), 'تواريخ غير صحيحة');
    var n = nightsBetween(checkIn, checkOut);
    need(n >= 1, 'تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول');
    var today = todayStr(ctx.now);
    if (!staff) {
      need(checkIn >= today, 'لا يمكن الحجز بتاريخ سابق');
      need(n <= (db.settings.maxNights || 30), 'أقصى مدة للحجز عبر الموقع ' + (db.settings.maxNights || 30) + ' ليلة');
      need(nightsBetween(today, checkIn) <= (db.settings.maxAdvanceDays || 365), 'التاريخ بعيد جداً');
    } else {
      need(n <= 365, 'مدة الإقامة طويلة جداً');
    }
    return n;
  }

  function createBooking(db, ctx, p, staff) {
    var t = typeById(db, p.typeId); need(t, 'نوع الغرفة غير موجود');
    validateStay(db, ctx, p.checkIn, p.checkOut, staff);
    var adults = Math.max(1, parseInt(p.adults, 10) || 1), children = Math.max(0, parseInt(p.children, 10) || 0);
    if (!staff) {
      need(t.online !== false, 'هذه الغرفة غير متاحة للحجز الإلكتروني');
      need(adults <= t.capacity, 'هذه الغرفة تتسع لـ ' + t.capacity + ' بالغ كحد أقصى');
      need(children <= (t.maxChildren || 0), 'عدد الأطفال أكبر من المسموح لهذه الغرفة');
    }
    var roomId = p.roomId || null;
    if (roomId) {
      var r = roomById(db, roomId); need(r, 'رقم الغرفة غير موجود');
      need(r.typeId === t.id, 'الغرفة المختارة ليست من هذا النوع');
      need(roomFree(db, roomId, p.checkIn, p.checkOut), 'الغرفة ' + r.number + ' محجوزة في هذه الفترة');
    } else {
      need(availableRange(db, t.id, p.checkIn, p.checkOut) > 0, 'عذراً، لا توجد غرف متاحة من هذا النوع في التواريخ المختارة');
    }
    var guest = upsertGuest(db, ctx, p.guest || {});
    if (!staff) need(!guest.blacklist, 'تعذّر إتمام الحجز عبر الموقع، يرجى الاتصال بالفندق');
    var q = quote(db, t.id, p.checkIn, p.checkOut);
    var roomTotal = q.subtotal;
    if (staff && p.nightlyRate != null && p.nightlyRate !== '') {
      var nr = +p.nightlyRate; need(nr >= 0, 'سعر الليلة غير صحيح');
      roomTotal = round2(nr * q.nights.length);
      q.nights = q.nights.map(function (n) { return { date: n.date, price: nr }; });
    }
    var tax = round2(roomTotal * (db.settings.taxPercent || 0) / 100);
    var b = {
      id: nextId(db, 'booking', 'b'), code: newCode(db, ctx.rand), guestId: guest.id, typeId: t.id, roomId: roomId,
      checkIn: p.checkIn, checkOut: p.checkOut, adults: adults, children: children,
      status: staff ? (p.status === 'pending' ? 'pending' : 'confirmed') : 'pending',
      source: staff ? (['walk_in', 'phone', 'agency', 'online', 'company'].indexOf(p.source) >= 0 ? p.source : 'walk_in') : 'online',
      nightly: q.nights, roomTotal: roomTotal, tax: tax, discount: staff ? Math.max(0, round2(p.discount || 0)) : 0,
      requests: clean(p.requests, 500), notes: staff ? clean(p.notes, 1000) : '', arrivalTime: clean(p.arrivalTime, 20),
      createdAt: ctx.now, createdBy: ctx.user ? ctx.user.id : null, history: []
    };
    b.history.push({ at: ctx.now, by: ctx.user ? ctx.user.name : 'الضيف (الموقع)', action: 'created' });
    db.bookings.push(b);
    log(db, ctx, 'booking.create', b.id, b.code);
    var effects = [];
    if (!staff) {
      notify(db, ctx, 'booking', 'حجز جديد ' + b.code + ' — ' + guest.name + ' — ' + t.name, b.id);
      effects = waEffects(db, waBookingText(db, b));
    }
    if (staff && p.checkinNow) {
      need(b.roomId, 'اختر رقم الغرفة لتسجيل الدخول');
      doAction(db, ctx, b, 'checkin', {});
    }
    return { booking: b, effects: effects };
  }

  function doAction(db, ctx, b, action, body) {
    var today = todayStr(ctx.now), by = ctx.user ? ctx.user.name : 'الضيف (الموقع)';
    var allowed = {
      confirm: ['pending'], checkin: ['pending', 'confirmed'], checkout: ['in_house'], cancel: ['pending', 'confirmed'],
      noshow: ['pending', 'confirmed'], reopen: ['cancelled', 'no_show', 'checked_out'], undo_checkin: ['in_house']
    };
    need(allowed[action], 'إجراء غير معروف');
    need(allowed[action].indexOf(b.status) >= 0, 'لا يمكن تنفيذ هذا الإجراء على حجز بحالته الحالية');
    if (action === 'confirm') { b.status = 'confirmed'; }
    if (action === 'checkin') {
      if (body.roomId) { need(roomFree(db, body.roomId, b.checkIn, b.checkOut, b.id), 'الغرفة غير متاحة'); b.roomId = body.roomId; var rr = roomById(db, b.roomId); if (rr) b.typeId = rr.typeId; }
      need(b.roomId, 'اختر رقم الغرفة أولاً');
      need(b.checkIn <= today || body.force, 'موعد الوصول لهذا الحجز هو ' + b.checkIn);
      var room = roomById(db, b.roomId);
      if (room && room.status === 'dirty' && !body.force) throw err(409, 'الغرفة ' + room.number + ' بحاجة تنظيف. أكّد لتسجيل الدخول على أي حال.');
      if (b.checkIn < today) { /* late arrival keeps original dates */ }
      b.status = 'in_house'; b.checkedInAt = ctx.now;
    }
    if (action === 'undo_checkin') { b.status = 'confirmed'; b.checkedInAt = null; }
    if (action === 'checkout') {
      var f = folio(db, b);
      if (f.balance > 0.009 && !body.force) throw err(409, 'يوجد رصيد مستحق ' + money(db, f.balance) + ' على هذا الحجز');
      if (b.checkOut > today && body.early) {
        // early departure: shorten stay & re-price
        var keep = b.nightly.filter(function (n) { return n.date < today; });
        if (!keep.length) keep = b.nightly.slice(0, 1);
        b.nightly = keep; b.checkOut = addDays(keep[keep.length - 1].date, 1);
        b.roomTotal = round2(keep.reduce(function (a, n) { return a + n.price; }, 0));
        b.tax = round2(b.roomTotal * (db.settings.taxPercent || 0) / 100);
      }
      b.status = 'checked_out'; b.checkedOutAt = ctx.now;
      var r2 = roomById(db, b.roomId); if (r2) r2.status = 'dirty';
    }
    if (action === 'cancel') { b.status = 'cancelled'; b.cancelReason = clean(body.reason, 300); b.cancelledAt = ctx.now; }
    if (action === 'noshow') { b.status = 'no_show'; }
    if (action === 'reopen') {
      if (b.roomId) need(roomFree(db, b.roomId, b.checkIn, b.checkOut, b.id), 'الغرفة لم تعد متاحة، غيّر الغرفة أولاً');
      else need(availableRange(db, b.typeId, b.checkIn, b.checkOut, b.id) > 0, 'لا توجد غرف متاحة لإعادة فتح الحجز');
      b.status = 'confirmed';
    }
    b.history.push({ at: ctx.now, by: by, action: action, note: body.reason ? clean(body.reason, 300) : undefined });
    log(db, ctx, 'booking.' + action, b.id, b.code);
  }

  function updateBooking(db, ctx, b, p) {
    need(['pending', 'confirmed', 'in_house'].indexOf(b.status) >= 0, 'لا يمكن تعديل حجز مغلق');
    var checkIn = p.checkIn || b.checkIn, checkOut = p.checkOut || b.checkOut;
    validateStay(db, ctx, checkIn, checkOut, true);
    var typeId = p.typeId || b.typeId, roomId = p.roomId === undefined ? b.roomId : (p.roomId || null);
    if (roomId) {
      var r = roomById(db, roomId); need(r, 'رقم الغرفة غير موجود');
      need(roomFree(db, roomId, checkIn, checkOut, b.id), 'الغرفة ' + r.number + ' محجوزة في هذه الفترة');
      typeId = r.typeId;
    } else {
      need(b.status !== 'in_house', 'الضيف مقيم، يجب أن يبقى رقم الغرفة محدداً');
      need(availableRange(db, typeId, checkIn, checkOut, b.id) > 0, 'لا توجد غرف متاحة لهذا التعديل');
    }
    var datesChanged = checkIn !== b.checkIn || checkOut !== b.checkOut || typeId !== b.typeId;
    b.checkIn = checkIn; b.checkOut = checkOut; b.typeId = typeId; b.roomId = roomId;
    if (p.adults != null) b.adults = Math.max(1, parseInt(p.adults, 10) || 1);
    if (p.children != null) b.children = Math.max(0, parseInt(p.children, 10) || 0);
    if (p.notes != null) b.notes = clean(p.notes, 1000);
    if (p.requests != null) b.requests = clean(p.requests, 500);
    if (p.arrivalTime != null) b.arrivalTime = clean(p.arrivalTime, 20);
    if (p.source) b.source = p.source;
    if (p.discount != null) b.discount = Math.max(0, round2(p.discount));
    if (datesChanged || (p.nightlyRate != null && p.nightlyRate !== '')) {
      var q = quote(db, typeId, checkIn, checkOut);
      if (p.nightlyRate != null && p.nightlyRate !== '') q.nights = q.nights.map(function (n) { return { date: n.date, price: +p.nightlyRate }; });
      else if (!datesChanged) q.nights = b.nightly;
      b.nightly = q.nights; b.roomTotal = round2(q.nights.reduce(function (a, n) { return a + n.price; }, 0));
      b.tax = round2(b.roomTotal * (db.settings.taxPercent || 0) / 100);
    }
    if (p.guest) upsertGuest(db, ctx, Object.assign({}, p.guest, { id: b.guestId }));
    b.history.push({ at: ctx.now, by: ctx.user.name, action: 'edit' });
    log(db, ctx, 'booking.edit', b.id, b.code);
  }

  /* ---------------- router ---------------- */
  function handle(db, req) {
    var ctx = { now: req.now || Date.now(), rand: req.rand, user: null, ip: req.ip };
    var method = req.method, path = req.path.replace(/\/+$/, ''), q = req.query || {}, body = req.body || {};
    var res = { status: 200, body: null, changed: false, effects: [] };
    try {
      var m;
      /* ----- public ----- */
      if (path === '/api/ping') { res.body = { ok: true, app: 'alpatra', mode: req.mode || 'server' }; return res; }
      if (method === 'GET' && path === '/api/public/info') { res.body = publicInfo(db); return res; }
      if (method === 'GET' && path === '/api/public/availability') {
        var ci = q.checkIn, co = q.checkOut;
        validateStay(db, ctx, ci, co, false);
        var ad = parseInt(q.adults, 10) || 1, ch = parseInt(q.children, 10) || 0;
        res.body = db.roomTypes.filter(function (t) { return t.online !== false; }).sort(function (a, b) { return a.order - b.order; }).map(function (t) {
          var qq = quote(db, t.id, ci, co);
          return { typeId: t.id, available: availableRange(db, t.id, ci, co), fits: ad <= t.capacity && ch <= (t.maxChildren || 0), nightly: qq.nights, subtotal: qq.subtotal, tax: qq.tax, total: qq.total };
        });
        return res;
      }
      if (method === 'GET' && path === '/api/public/calendar') {
        var from = isDate(q.from) ? q.from : todayStr(ctx.now), days = Math.min(120, parseInt(q.days, 10) || 60);
        if (from < todayStr(ctx.now)) from = todayStr(ctx.now);
        var types = q.typeId ? [typeById(db, q.typeId)].filter(Boolean) : db.roomTypes.filter(function (t) { return t.online !== false; });
        var out = [];
        for (var i = 0; i < days; i++) {
          var d = addDays(from, i), avail = 0, minP = null;
          types.forEach(function (t) { var a = availableOn(db, t.id, d); avail += Math.max(0, a); if (a > 0) { var pr = nightlyPrice(db, t.id, d); if (minP === null || pr < minP) minP = pr; } });
          out.push({ date: d, available: avail, price: minP });
        }
        res.body = out; return res;
      }
      if (method === 'POST' && path === '/api/public/book') {
        need(db.settings.onlineBooking !== false, 'الحجز الإلكتروني متوقف مؤقتاً، يرجى الاتصال بالفندق');
        need(clean(body.name).length >= 3, 'اكتب الاسم الكامل');
        need(normPhone(body.phone).length >= 8, 'رقم الهاتف غير صحيح');
        if (body.email) need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email), 'البريد الإلكتروني غير صحيح');
        // anti-spam: max 5 pending bookings per phone
        var ph = normPhone(body.phone);
        var pend = db.bookings.filter(function (b) { var g = find(db.guests, b.guestId); return b.status === 'pending' && g && normPhone(g.phone) === ph; }).length;
        need(pend < 5, 'لديك عدة حجوزات بانتظار التأكيد، سنتواصل معك قريباً');
        var r = createBooking(db, ctx, {
          typeId: body.typeId, checkIn: body.checkIn, checkOut: body.checkOut, adults: body.adults, children: body.children,
          requests: body.requests, arrivalTime: body.arrivalTime,
          guest: { name: body.name, phone: body.phone, email: body.email, nationality: body.nationality }
        }, false);
        res.changed = true; res.effects = r.effects; res.status = 201;
        res.body = publicBooking(db, r.booking);
        res.body.waText = waBookingText(db, r.booking, 'مرحباً، قمت بالحجز عبر موقع فندق البتراء');
        return res;
      }
      if (method === 'GET' && path === '/api/public/booking') {
        var bk = db.bookings.filter(function (b) { return b.code === String(q.code || '').toUpperCase().trim(); })[0];
        var gg = bk && find(db.guests, bk.guestId);
        need(bk && gg && normPhone(gg.phone).slice(-8) === normPhone(q.phone).slice(-8), 'لم نجد حجزاً بهذا الرقم وهذا الهاتف');
        res.body = publicBooking(db, bk); return res;
      }
      if (method === 'POST' && path === '/api/public/cancel') {
        var bc = db.bookings.filter(function (b) { return b.code === String(body.code || '').toUpperCase().trim(); })[0];
        var gc = bc && find(db.guests, bc.guestId);
        need(bc && gc && normPhone(gc.phone).slice(-8) === normPhone(body.phone).slice(-8), 'لم نجد حجزاً بهذا الرقم وهذا الهاتف');
        need(bc.status === 'pending' || bc.status === 'confirmed', 'لا يمكن إلغاء هذا الحجز');
        need(bc.checkIn > todayStr(ctx.now), 'لا يمكن إلغاء الحجز يوم الوصول عبر الموقع، يرجى الاتصال بالفندق');
        doAction(db, ctx, bc, 'cancel', { reason: 'ألغاه الضيف عبر الموقع' });
        notify(db, ctx, 'cancel', 'ألغى الضيف الحجز ' + bc.code + ' — ' + gc.name, bc.id);
        res.effects = waEffects(db, waBookingText(db, bc, '❌ إلغاء حجز من الموقع — فندق البتراء'));
        res.changed = true; res.body = publicBooking(db, bc); return res;
      }

      /* ----- auth ----- */
      if (method === 'POST' && path === '/api/auth/login') {
        var u = db.users.filter(function (x) { return x.username.toLowerCase() === String(body.username || '').toLowerCase().trim(); })[0];
        if (!u || !u.active || hashPassword(String(body.password || ''), u.salt) !== u.hash) throw err(401, 'اسم المستخدم أو كلمة المرور غير صحيحة');
        var tok = ctx.rand(24);
        // prune expired sessions
        Object.keys(db.sessions).forEach(function (k) { if (db.sessions[k].exp < ctx.now) delete db.sessions[k]; });
        db.sessions[tok] = { uid: u.id, exp: ctx.now + 14 * 864e5 };
        u.lastLogin = ctx.now; ctx.user = u;
        log(db, ctx, 'auth.login', u.id);
        res.changed = true; res.setToken = tok; res.body = { token: tok, user: { id: u.id, name: u.name, role: u.role, mustChange: !!u.mustChange } };
        return res;
      }
      var sess = req.token && db.sessions[req.token];
      if (sess && sess.exp > ctx.now) { ctx.user = find(db.users, sess.uid); if (ctx.user && !ctx.user.active) ctx.user = null; }
      if (method === 'POST' && path === '/api/auth/logout') { if (req.token) delete db.sessions[req.token]; res.changed = true; res.clearToken = true; res.body = { ok: true }; return res; }
      if (path.indexOf('/api/staff/') !== 0 && path !== '/api/auth/password' && path !== '/api/auth/me') throw err(404, 'غير موجود');
      if (!ctx.user) throw err(401, 'انتهت الجلسة، سجّل الدخول من جديد');
      var me = ctx.user, isMgr = me.role === 'manager';
      function mgr() { if (!isMgr) throw err(403, 'هذه العملية للمدير فقط'); }
      function desk() { if (me.role === 'housekeeping') throw err(403, 'صلاحياتك لا تسمح بهذه العملية'); }

      if (method === 'GET' && path === '/api/auth/me') { res.body = { id: me.id, name: me.name, role: me.role, mustChange: !!me.mustChange }; return res; }
      if (method === 'POST' && path === '/api/auth/password') {
        need(hashPassword(String(body.old || ''), me.salt) === me.hash, 'كلمة المرور الحالية غير صحيحة');
        need(String(body.new || '').length >= 6, 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
        me.salt = ctx.rand(16); me.hash = hashPassword(String(body.new), me.salt); me.mustChange = false;
        log(db, ctx, 'auth.password', me.id); res.changed = true; res.body = { ok: true }; return res;
      }
      if (method === 'GET' && path === '/api/staff/rev') { res.body = { rev: db.meta.rev }; return res; }
      if (method === 'GET' && path === '/api/staff/state') { res.body = staffState(db, ctx); return res; }
      if (method === 'GET' && path === '/api/staff/quote') {
        validateStay(db, ctx, q.checkIn, q.checkOut, true);
        var qt = quote(db, q.typeId, q.checkIn, q.checkOut);
        qt.available = availableRange(db, q.typeId, q.checkIn, q.checkOut, q.except);
        qt.freeRooms = freeRooms(db, q.typeId, q.checkIn, q.checkOut, q.except).map(function (r) { return r.id; });
        res.body = qt; return res;
      }
      if (method === 'GET' && path === '/api/staff/export') { mgr(); var ex = JSON.parse(JSON.stringify(db)); ex.sessions = {}; res.body = ex; return res; }
      if (method === 'POST' && path === '/api/staff/import') {
        mgr(); need(body && body.meta && Array.isArray(body.bookings) && Array.isArray(body.rooms) && Array.isArray(body.users), 'ملف النسخة الاحتياطية غير صالح');
        res.replaceDb = body; res.changed = true; res.body = { ok: true }; return res;
      }

      // bookings
      if (method === 'POST' && path === '/api/staff/bookings') {
        desk();
        var cr = createBooking(db, ctx, body, true);
        res.changed = true; res.status = 201; res.body = cr.booking; return res;
      }
      if ((m = path.match(/^\/api\/staff\/bookings\/([\w-]+)$/)) && method === 'PATCH') {
        desk(); var b1 = find(db.bookings, m[1]); need(b1, 'الحجز غير موجود');
        updateBooking(db, ctx, b1, body); res.changed = true; res.body = b1; return res;
      }
      if ((m = path.match(/^\/api\/staff\/bookings\/([\w-]+)\/action$/)) && method === 'POST') {
        desk(); var b2 = find(db.bookings, m[1]); need(b2, 'الحجز غير موجود');
        if (body.action === 'reopen') mgr();
        doAction(db, ctx, b2, body.action, body); res.changed = true; res.body = b2; return res;
      }
      // folio
      if (method === 'POST' && path === '/api/staff/charges') {
        desk(); var bb = find(db.bookings, body.bookingId); need(bb, 'الحجز غير موجود');
        need(['pending', 'confirmed', 'in_house', 'checked_out'].indexOf(bb.status) >= 0, 'لا يمكن إضافة خدمة لهذا الحجز');
        var amt = round2(body.amount); need(amt !== 0 && Math.abs(amt) < 100000, 'المبلغ غير صحيح');
        var chg = { id: nextId(db, 'charge', 'c'), bookingId: bb.id, category: clean(body.category, 30) || 'other', desc: clean(body.desc, 120) || 'خدمة', amount: amt, qty: Math.max(1, parseInt(body.qty, 10) || 1), date: todayStr(ctx.now), at: ctx.now, by: me.name };
        db.charges.push(chg); log(db, ctx, 'charge.add', bb.id, chg.desc + ' ' + amt);
        res.changed = true; res.status = 201; res.body = chg; return res;
      }
      if ((m = path.match(/^\/api\/staff\/charges\/([\w-]+)$/)) && method === 'DELETE') {
        mgr(); var ci2 = db.charges.findIndex(function (c) { return c.id === m[1]; }); need(ci2 >= 0, 'غير موجود');
        log(db, ctx, 'charge.delete', db.charges[ci2].bookingId, db.charges[ci2].desc); db.charges.splice(ci2, 1); res.changed = true; res.body = { ok: true }; return res;
      }
      if (method === 'POST' && path === '/api/staff/payments') {
        desk(); var bp = find(db.bookings, body.bookingId); need(bp, 'الحجز غير موجود');
        var cur = body.currency === 'SYP' ? 'SYP' : 'USD', orig = round2(body.amount);
        need(orig > 0, 'المبلغ غير صحيح');
        var usd = orig;
        if (cur === 'SYP') { need(db.settings.sypRate > 0, 'حدد سعر صرف الليرة في الإعدادات أولاً'); usd = round2(orig / db.settings.sypRate); }
        var pay = { id: nextId(db, 'payment', 'p'), bookingId: bp.id, amount: usd, originalAmount: orig, currency: cur, rate: cur === 'SYP' ? db.settings.sypRate : 1,
          method: ['cash', 'card', 'transfer'].indexOf(body.method) >= 0 ? body.method : 'cash', note: clean(body.note, 200), date: todayStr(ctx.now), at: ctx.now, by: me.name };
        db.payments.push(pay); log(db, ctx, 'payment.add', bp.id, usd + ' USD');
        res.changed = true; res.status = 201; res.body = pay; return res;
      }
      if ((m = path.match(/^\/api\/staff\/payments\/([\w-]+)$/)) && method === 'DELETE') {
        mgr(); var pi = db.payments.findIndex(function (p) { return p.id === m[1]; }); need(pi >= 0, 'غير موجود');
        log(db, ctx, 'payment.delete', db.payments[pi].bookingId, String(db.payments[pi].amount)); db.payments.splice(pi, 1); res.changed = true; res.body = { ok: true }; return res;
      }
      // guests
      if (method === 'POST' && path === '/api/staff/guests') { desk(); var g1 = upsertGuest(db, ctx, Object.assign({}, body, { id: null })); log(db, ctx, 'guest.save', g1.id); res.changed = true; res.body = g1; return res; }
      if ((m = path.match(/^\/api\/staff\/guests\/([\w-]+)$/)) && method === 'PATCH') {
        desk(); var g2 = find(db.guests, m[1]); need(g2, 'الضيف غير موجود');
        upsertGuest(db, ctx, Object.assign({}, body, { id: g2.id })); log(db, ctx, 'guest.save', g2.id); res.changed = true; res.body = g2; return res;
      }
      // rooms
      if ((m = path.match(/^\/api\/staff\/rooms\/([\w-]+)$/)) && method === 'PATCH') {
        var rm = roomById(db, m[1]); need(rm, 'الغرفة غير موجودة');
        if (body.status) { need(['clean', 'dirty', 'inspect', 'ooo'].indexOf(body.status) >= 0, 'حالة غير صحيحة'); if (body.status === 'ooo' || rm.status === 'ooo') desk(); rm.status = body.status; }
        if (body.note != null) rm.note = clean(body.note, 200);
        if (body.typeId || body.number || body.floor) {
          mgr();
          if (body.typeId) { need(typeById(db, body.typeId), 'نوع غير موجود'); rm.typeId = body.typeId; }
          if (body.number) { need(!db.rooms.some(function (x) { return x.number === String(body.number) && x.id !== rm.id; }), 'رقم الغرفة مستخدم'); rm.number = clean(body.number, 10); }
          if (body.floor) rm.floor = parseInt(body.floor, 10) || rm.floor;
        }
        log(db, ctx, 'room.update', rm.id, rm.number + ' ' + rm.status); res.changed = true; res.body = rm; return res;
      }
      if (method === 'POST' && path === '/api/staff/rooms') {
        mgr(); var num = clean(body.number, 10); need(num, 'رقم الغرفة مطلوب');
        need(!db.rooms.some(function (x) { return x.number === num; }), 'رقم الغرفة مستخدم'); need(typeById(db, body.typeId), 'اختر نوع الغرفة');
        var nr2 = { id: 'r' + num + '-' + ctx.rand(2), number: num, floor: parseInt(body.floor, 10) || parseInt(num[0], 10) || 1, typeId: body.typeId, status: 'clean', note: '' };
        db.rooms.push(nr2); db.rooms.sort(function (a, b) { return a.number.localeCompare(b.number, 'en', { numeric: true }); });
        log(db, ctx, 'room.add', nr2.id, num); res.changed = true; res.body = nr2; return res;
      }
      if ((m = path.match(/^\/api\/staff\/rooms\/([\w-]+)$/)) && method === 'DELETE') {
        mgr(); need(!db.bookings.some(function (b) { return b.roomId === m[1] && HOLD[b.status]; }), 'لا يمكن حذف غرفة عليها حجوزات فعّالة');
        db.rooms = db.rooms.filter(function (r) { return r.id !== m[1]; }); log(db, ctx, 'room.delete', m[1]); res.changed = true; res.body = { ok: true }; return res;
      }
      // room types
      if (method === 'POST' && path === '/api/staff/types') {
        mgr(); need(clean(body.name).length >= 2, 'اكتب اسم النوع');
        var nt = { id: 't' + ctx.rand(3), order: db.roomTypes.length, online: true, images: [], amenities: [] };
        Object.assign(nt, sanitizeType(body)); db.roomTypes.push(nt); log(db, ctx, 'type.add', nt.id, nt.name); res.changed = true; res.body = nt; return res;
      }
      if ((m = path.match(/^\/api\/staff\/types\/([\w-]+)$/)) && method === 'PATCH') {
        mgr(); var tt = typeById(db, m[1]); need(tt, 'النوع غير موجود'); Object.assign(tt, sanitizeType(body, tt));
        log(db, ctx, 'type.update', tt.id, tt.name); res.changed = true; res.body = tt; return res;
      }
      if ((m = path.match(/^\/api\/staff\/types\/([\w-]+)$/)) && method === 'DELETE') {
        mgr(); need(!db.rooms.some(function (r) { return r.typeId === m[1]; }), 'انقل الغرف من هذا النوع أولاً');
        db.roomTypes = db.roomTypes.filter(function (t) { return t.id !== m[1]; }); res.changed = true; res.body = { ok: true }; return res;
      }
      // rates
      if (method === 'POST' && path === '/api/staff/rates') {
        mgr(); need(isDate(body.from) && isDate(body.to) && body.from <= body.to, 'حدد فترة صحيحة');
        need(body.mode === 'fixed' || body.mode === 'pct', 'نوع التعديل غير صحيح');
        var rt = { id: nextId(db, 'rate', 'rt'), name: clean(body.name, 60) || 'موسم', from: body.from, to: body.to, typeId: body.typeId || '', mode: body.mode, value: round2(body.value), active: true };
        if (rt.mode === 'fixed') need(rt.value > 0, 'السعر غير صحيح');
        db.rates.push(rt); log(db, ctx, 'rate.add', rt.id, rt.name); res.changed = true; res.body = rt; return res;
      }
      if ((m = path.match(/^\/api\/staff\/rates\/([\w-]+)$/)) && method === 'DELETE') { mgr(); db.rates = db.rates.filter(function (r) { return r.id !== m[1]; }); res.changed = true; res.body = { ok: true }; return res; }
      // settings
      if (method === 'PUT' && path === '/api/staff/settings') {
        mgr(); var s = db.settings;
        ['hotelName', 'hotelNameEn', 'city', 'address', 'addressEn', 'fax', 'email', 'website', 'checkIn', 'checkOut', 'cancelPolicy'].forEach(function (k) { if (body[k] != null) s[k] = clean(body[k], k === 'cancelPolicy' ? 600 : 120); });
        if (body.whatsapp != null) s.whatsapp = normPhone(body.whatsapp);
        if (Array.isArray(body.phones)) s.phones = body.phones.map(function (p) { return clean(p, 30); }).filter(Boolean).slice(0, 6);
        ['sypRate', 'taxPercent', 'weekendPct', 'maxNights', 'maxAdvanceDays'].forEach(function (k) { if (body[k] != null && !isNaN(+body[k])) s[k] = Math.max(k === 'weekendPct' ? -90 : 0, +body[k]); });
        ['breakfastIncluded', 'onlineBooking', 'setupDone'].forEach(function (k) { if (body[k] != null) s[k] = !!body[k]; });
        if (Array.isArray(body.weekendDays)) s.weekendDays = body.weekendDays.map(Number).filter(function (d) { return d >= 0 && d <= 6; });
        if (Array.isArray(body.recipients)) {
          var old = s.recipients || [];
          s.recipients = body.recipients.slice(0, 6).map(function (r, i) {
            var prev = old.filter(function (o) { return o.id === r.id; })[0] || {};
            var key = r.apikey && String(r.apikey).indexOf('••••') !== 0 ? clean(r.apikey, 40) : prev.apikey || '';
            return { id: r.id || 'w' + ctx.rand(3), name: clean(r.name, 40), phone: normPhone(r.phone), apikey: key, active: r.active !== false };
          }).filter(function (r) { return r.phone; });
        }
        log(db, ctx, 'settings.update'); res.changed = true; res.body = { ok: true }; return res;
      }
      if (method === 'POST' && path === '/api/staff/notify-test') {
        mgr(); var fx = waEffects(db, '✅ رسالة تجريبية من نظام فندق البتراء. التنبيهات تعمل بشكل صحيح.');
        need(fx.length, 'أضف رقم واتساب ومفتاح CallMeBot أولاً');
        res.effects = fx; res.body = { sent: fx.length }; return res;
      }
      // users
      if (method === 'POST' && path === '/api/staff/users') {
        mgr(); var un = clean(body.username, 30).toLowerCase(); need(/^[a-z0-9._-]{3,30}$/.test(un), 'اسم المستخدم بالأحرف الإنجليزية (3 أحرف على الأقل)');
        need(!db.users.some(function (x) { return x.username === un; }), 'اسم المستخدم موجود');
        need(String(body.password || '').length >= 6, 'كلمة المرور 6 أحرف على الأقل');
        var salt = ctx.rand(16);
        var nu = { id: nextId(db, 'user', 'u'), username: un, name: clean(body.name, 60) || un, role: ['manager', 'reception', 'housekeeping'].indexOf(body.role) >= 0 ? body.role : 'reception', salt: salt, hash: hashPassword(String(body.password), salt), active: true, mustChange: true, createdAt: ctx.now };
        db.users.push(nu); log(db, ctx, 'user.add', nu.id, un); res.changed = true; res.body = { id: nu.id }; return res;
      }
      if ((m = path.match(/^\/api\/staff\/users\/([\w-]+)$/)) && method === 'PATCH') {
        mgr(); var uu = find(db.users, m[1]); need(uu, 'المستخدم غير موجود');
        if (body.name) uu.name = clean(body.name, 60);
        if (body.role && ['manager', 'reception', 'housekeeping'].indexOf(body.role) >= 0) { need(!(uu.id === me.id && body.role !== 'manager'), 'لا يمكنك تغيير صلاحيتك'); uu.role = body.role; }
        if (body.active != null) { need(uu.id !== me.id, 'لا يمكنك إيقاف حسابك'); uu.active = !!body.active; }
        if (body.password) { need(String(body.password).length >= 6, 'كلمة المرور 6 أحرف على الأقل'); uu.salt = ctx.rand(16); uu.hash = hashPassword(String(body.password), uu.salt); uu.mustChange = true; }
        if (!uu.active) Object.keys(db.sessions).forEach(function (k) { if (db.sessions[k].uid === uu.id) delete db.sessions[k]; });
        log(db, ctx, 'user.update', uu.id, uu.username); res.changed = true; res.body = { ok: true }; return res;
      }
      if (method === 'POST' && path === '/api/staff/notifications/read') {
        db.notifications.forEach(function (n) { if (n.readBy.indexOf(me.id) < 0) n.readBy.push(me.id); }); res.changed = true; res.body = { ok: true }; return res;
      }
      throw err(404, 'غير موجود');
    } catch (e) {
      if (!e.expose) { res.status = 500; res.body = { error: 'حدث خطأ غير متوقع' }; res.internal = e; }
      else { res.status = e.status || 400; res.body = { error: e.message }; }
      res.changed = false; res.effects = [];
      return res;
    }
  }
  function sanitizeType(b, prev) {
    var o = {};
    if (b.name != null) o.name = clean(b.name, 60);
    if (b.tagline != null) o.tagline = clean(b.tagline, 80);
    if (b.desc != null) o.desc = clean(b.desc, 600);
    if (b.beds != null) o.beds = clean(b.beds, 60);
    ['size', 'capacity', 'maxChildren', 'price', 'order'].forEach(function (k) { if (b[k] != null && !isNaN(+b[k])) o[k] = Math.max(0, +b[k]); });
    if (o.capacity === 0) o.capacity = 1;
    if (b.online != null) o.online = !!b.online;
    if (Array.isArray(b.amenities)) o.amenities = b.amenities.map(function (a) { return clean(a, 20); }).slice(0, 20);
    if (Array.isArray(b.images)) o.images = b.images.map(function (a) { return String(a).slice(0, 3000000); }).filter(function (s) { return /^(media\/|data:image\/|https:\/\/)/.test(s); }).slice(0, 8);
    return o;
  }

  /* ---------------- demo data (preview only) ---------------- */
  function seedDemo(db, now, rand) {
    var today = todayStr(now);
    var names = ['أحمد الخطيب', 'رنا حداد', 'محمد العلي', 'سارة القاسم', 'خالد المصري', 'لينا شاهين', 'عمر الحلبي', 'ديما الأيوبي', 'يوسف النجار', 'هبة الشامي',
      'طارق عيسى', 'نور الهدى صباغ', 'فراس درويش', 'ميس الحسن', 'باسل قباني', 'ريم الأتاسي', 'جود حمدان', 'سامر يازجي', 'علا الزعبي', 'كريم العطار',
      'Jean Dupont', 'Marco Rossi', 'Ali Hassan', 'Fatima Al-Sayed', 'مازن البيطار', 'رهف الجابي', 'وسيم كرم', 'تالا منصور', 'حسام السيد', 'لمى العظمة'];
    var nats = ['سوري', 'سوري', 'سوري', 'لبناني', 'أردني', 'عراقي', 'سوري', 'سعودي'];
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var ctx = { now: now, rand: rand, user: { id: 'u1', name: 'مدير الفندق' } };
    names.forEach(function (n, i) {
      var nat = i >= 20 && i < 24 ? ['فرنسي', 'إيطالي', 'مصري', 'إماراتي'][i - 20] : nats[i % nats.length];
      upsertGuest(db, ctx, { name: n, phone: '+9639' + (30000000 + Math.floor(rnd() * 69999999)), nationality: nat, idType: nat === 'سوري' ? 'هوية' : 'جواز سفر', idNumber: String(Math.floor(1e7 + rnd() * 9e7)), vip: i % 11 === 3 });
    });
    var sources = ['online', 'online', 'online', 'walk_in', 'phone', 'phone', 'agency', 'company'];
    for (var i = 0; i < 520; i++) {
      var start = addDays(today, rnd() < .22 ? -Math.floor(rnd() * 5) : Math.floor(rnd() * 52) - 24), len = 1 + Math.floor(rnd() * (rnd() < .2 ? 7 : 3));
      var types = ['single', 'double', 'double', 'double', 'twin', 'twin', 'family', 'damascene', 'royal'];
      var tId = types[Math.floor(rnd() * types.length)];
      var end = addDays(start, len);
      var rooms = freeRooms(db, tId, start, end);
      if (!rooms.length) continue;
      var room = rooms[Math.floor(rnd() * rooms.length)];
      var g = db.guests[Math.floor(rnd() * db.guests.length)];
      var t = typeById(db, tId), qq = quote(db, tId, start, end);
      var st = end === today && rnd() < .4 ? 'in_house' : end <= today ? (rnd() < .06 ? 'cancelled' : 'checked_out') : start < today ? 'in_house' : start === today ? (rnd() < .45 ? 'in_house' : 'confirmed') : (rnd() < .035 ? 'pending' : 'confirmed');
      var src = sources[Math.floor(rnd() * sources.length)];
      if (st === 'pending') src = 'online';
      var created = now - Math.floor((nightsBetween(start, today) > 0 ? nightsBetween(start, today) + 3 : 3 + rnd() * 20) * 864e5);
      if (created > now) created = now - 3600e3 * (1 + rnd() * 30);
      var b = { id: nextId(db, 'booking', 'b'), code: newCode(db, rand), guestId: g.id, typeId: tId, roomId: st === 'pending' ? null : room.id, checkIn: start, checkOut: end,
        adults: Math.min(t.capacity, 1 + Math.floor(rnd() * 2)), children: rnd() < .15 ? Math.min(1, t.maxChildren) : 0, status: st, source: src,
        nightly: qq.nights, roomTotal: qq.subtotal, tax: qq.tax, discount: 0, requests: rnd() < .2 ? 'طابق مرتفع إن أمكن' : '', notes: '', arrivalTime: '',
        createdAt: created, createdBy: src === 'online' ? null : 'u1', history: [{ at: created, by: src === 'online' ? 'الضيف (الموقع)' : 'مدير الفندق', action: 'created' }] };
      if (st === 'in_house' || st === 'checked_out') b.checkedInAt = parseD(start) + 14 * 3600e3 - TZ_OFFSET;
      if (st === 'checked_out') b.checkedOutAt = parseD(end) + 11 * 3600e3 - TZ_OFFSET;
      db.bookings.push(b);
      var cats = [['restaurant', 'عشاء في المطعم', 18], ['minibar', 'ميني بار', 6], ['laundry', 'خدمة غسيل', 8], ['transport', 'توصيل من المطار', 25], ['restaurant', 'غداء — مشاوي مشكلة', 22]];
      if (st === 'in_house' || st === 'checked_out') {
        var nc = Math.floor(rnd() * 3);
        for (var k = 0; k < nc; k++) { var c = cats[Math.floor(rnd() * cats.length)]; db.charges.push({ id: nextId(db, 'charge', 'c'), bookingId: b.id, category: c[0], desc: c[1], amount: c[2], qty: 1, date: addDays(start, Math.min(k, len - 1)), at: b.checkedInAt + (k + 1) * 5 * 3600e3, by: 'الاستقبال' }); }
        var f = folio(db, b);
        var pr = rnd(), payAmt = st === 'checked_out' ? f.total : round2(f.total * (pr < .45 ? 1 : pr < .75 ? .5 : 0));
        if (payAmt > 0) db.payments.push({ id: nextId(db, 'payment', 'p'), bookingId: b.id, amount: payAmt, originalAmount: payAmt, currency: 'USD', rate: 1, method: rnd() < .7 ? 'cash' : 'card', note: '', date: st === 'checked_out' ? end : start, at: st === 'checked_out' ? b.checkedOutAt : b.checkedInAt, by: 'الاستقبال' });
      }
      if (st === 'pending') notify(db, { now: created }, 'booking', 'حجز جديد ' + b.code + ' — ' + g.name + ' — ' + t.name, b.id);
    }
    // housekeeping state
    db.rooms.forEach(function (r) {
      var dep = db.bookings.some(function (b) { return b.roomId === r.id && b.status === 'checked_out' && b.checkOut === today; });
      if (dep) r.status = 'dirty'; else if (rnd() < .06) r.status = 'dirty';
    });
    var oo = roomById(db, 'r309'); if (oo && !db.bookings.some(function (b) { return b.roomId === 'r309' && HOLD[b.status]; })) { oo.status = 'ooo'; oo.note = 'صيانة التكييف'; }
    db.rates.push({ id: nextId(db, 'rate', 'rt'), name: 'موسم الأعياد', from: addDays(today, 40), to: addDays(today, 47), typeId: '', mode: 'pct', value: 20, active: true });
    db.settings.setupDone = true;
    db.meta.demo = true;
  }

  return {
    handle: handle, freshDb: freshDb, ensureAdmin: ensureAdmin, seedDemo: seedDemo, hashPassword: hashPassword,
    util: { todayStr: todayStr, addDays: addDays, nightsBetween: nightsBetween, eachNight: eachNight, parseD: parseD, isDate: isDate, dow: dow, round2: round2,
      quote: quote, folio: folio, availableOn: availableOn, availableRange: availableRange, freeRooms: freeRooms, roomFree: roomFree, nightlyPrice: nightlyPrice, normPhone: normPhone, typeInventory: typeInventory }
  };
});
