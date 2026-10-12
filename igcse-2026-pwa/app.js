/* ============================================================
   MY EXAMS — app.js
   No external dependencies — works on any static host
============================================================ */

let TZ     = 'Africa/Cairo';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_S = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS_L = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];


/* ════════════════════════════════════════════════════════════
   EGYPT TIME UTILITIES
   Uses Intl.DateTimeFormat — browser built-in, no library.

   Both exam.epoch and egyptNowMs() call new Date(y,m,d,h,min,s)
   using Cairo time numbers. The browser's local-timezone offset
   appears in both values identically, so it cancels out in every
   subtraction — the comparisons are always Cairo-relative.
════════════════════════════════════════════════════════════ */

/** Returns current Cairo time broken into numeric parts. */
function getEgyptParts(ms, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || TZ,
    year:     'numeric',
    month:    'numeric',
    day:      'numeric',
    hour:     'numeric',
    minute:   'numeric',
    second:   'numeric',
    hour12:   false,
  }).formatToParts(ms == null ? new Date() : new Date(ms));

  const get = type => parts.find(p => p.type === type)?.value;

  return {
    year:   parseInt(get('year'),   10),
    month:  parseInt(get('month'),  10) - 1, // 0-indexed
    day:    parseInt(get('day'),    10),
    hour:   parseInt(get('hour'),   10) % 24,
    minute: parseInt(get('minute'), 10),
    second: parseInt(get('second'), 10),
  };
}

/**
 * Cairo "now" as a local epoch (ms).
 * Comparable directly to exam.epoch values.
 */
function egyptNowMs() {
  const p = getEgyptParts();
  return Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second);
}

/**
 * Cairo "today at midnight" as a local epoch (ms).
 * Used to compute calendar-day differences that reset at midnight.
 */
function egyptTodayMidnightMs() {
  const p = getEgyptParts();
  return Date.UTC(p.year, p.month, p.day);
}

function pad(n) { return String(n).padStart(2, '0'); }

function to12h(hour, minute) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12  = hour % 12 || 12;
  return `${h12}:${pad(minute)} ${ampm}`;
}

function updateClock() {
  const p   = getEgyptParts();
  const dow = new Date(Date.UTC(p.year, p.month, p.day)).getUTCDay();

  document.getElementById('clk-d').textContent =
    `${DAYS_S[dow]} ${p.day} ${MONTHS[p.month]} · ${tzName()}`;

  const ampm = p.hour >= 12 ? 'PM' : 'AM';
  const h12  = p.hour % 12 || 12;
  document.getElementById('clk-t').textContent =
    `${h12}:${pad(p.minute)}:${pad(p.second)} ${ampm}`;
}

updateClock();
setInterval(updateClock, 1000);


/* ════════════════════════════════════════════════════════════
   COUNTDOWN
   ─────────────────────────────────────────────────────────
   OLD (broken): Math.floor(diff / 86_400_000)
   This divided the raw millisecond diff by one day's worth
   of ms. Result changes throughout the day — e.g. an exam
   8 calendar days away would show "8 days" at 1 AM but
   "7 days" at 11 PM, because the fractional day shifts.

   NEW (fixed): compare midnight-to-midnight calendar dates
   • todayMidnight  = start of today in Cairo (00:00:00)
   • examMidnight   = start of exam day in Cairo (00:00:00)
   • calDays        = (examMidnight - todayMidnight) / 86_400_000
   This value is always a whole number and only changes when
   Cairo crosses midnight — exactly what the user expects.

   "Starting soon!" still fires when the exact start time is
   less than 1 hour away (uses the precise epoch diff).
════════════════════════════════════════════════════════════ */
function getCountdown(examEpoch, examMidnightEpoch) {
  const nowMs         = egyptNowMs();
  const preciseDiff   = examEpoch - nowMs;  // ms until exact start

  // exam has already started → Done
  if (preciseDiff <= 0) return { label: 'Done', cls: 'cdone' };

  // within 1 hour of start time → Starting soon
  if (preciseDiff < 3_600_000) return { label: 'Starting soon!', cls: 'today' };

  // calendar-day count: only changes at Cairo midnight
  const todayMidnight = egyptTodayMidnightMs();
  const calDays       = Math.round((examMidnightEpoch - todayMidnight) / 86_400_000);

  if (calDays === 0) return { label: 'Today',    cls: 'today' };
  if (calDays === 1) return { label: 'Tomorrow', cls: 'soon'  };
  if (calDays <= 7)  return { label: `In ${calDays} days`, cls: 'soon'   };
  return                    { label: `In ${calDays} days`, cls: 'future' };
}



/* ════════════════════════════════════════════════════════════
   FLUID UI — springs, sheet, segmented control
   (exam data and Cairo-time logic above are unchanged)
════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   DATA — comes from a file the user imports; saved only on this device
════════════════════════════════════════════════════════════ */
let EXAM_DATA = [], BASE = [], META = { title: 'My Exams', notes: [] }, RAW = null, needSync = true;
let SRC_TZ = 'Africa/Cairo', VIEW = 'auto';   // SRC_TZ = exam centre (from the file), VIEW = how the user wants to see times
const KEY = 'igcse-data';
const PAL = ['#3b9eff', '#3ecf8e', '#a78bfa', '#f4a13a', '#f472b6', '#2dd4bf', '#fb7185', '#a3e635'];
const KNOWN = { physics: '#3b9eff', biology: '#3ecf8e', chemistry: '#a78bfa', maths: '#f4a13a', mathematics: '#f4a13a', english: '#f472b6', 'english esl': '#f472b6' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function tzName(z = TZ) { return z.split('/').pop().replace(/_/g, ' '); }
function deviceTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || SRC_TZ; } catch (_) { return SRC_TZ; } }
function effectiveTz() { return VIEW === 'auto' ? deviceTz() : VIEW === 'exam' ? SRC_TZ : VIEW; }
/* wall-clock time in a given zone -> the real instant (DST-safe, two passes) */
function zonedToUtc(y, mo, d, h, mi, tz) {
  const guess = Date.UTC(y, mo, d, h, mi);
  const off = ms => { const p = getEgyptParts(ms, tz); return Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000; };
  const t1 = guess - off(guess);
  return guess - off(t1);
}
/* exams stay fixed instants; their displayed date/time follow the chosen view zone */
function buildExams() {
  EXAM_DATA = BASE.map(x => {
    const w = getEgyptParts(x.utc), [h0, m0] = x.t.split(':').map(Number);
    return { ...x, vy: w.year, vm: w.month, vd: w.day,
      epoch: Date.UTC(w.year, w.month, w.day, w.hour, w.minute, 0), midnightEpoch: Date.UTC(w.year, w.month, w.day),
      dayNum: w.day, monthS: MONTHS[w.month], weekday: DAYS_S[new Date(Date.UTC(w.year, w.month, w.day)).getUTCDay()],
      time12: to12h(w.hour, w.minute), srcTime12: to12h(h0, m0), same: TZ === SRC_TZ };
  }).sort((a, b) => a.utc - b.utc);
  EXAM_DATA.forEach((e, i) => { e.i = i; });
}
function setView(v) {
  VIEW = v; try { localStorage.setItem('igcse-tz', v); } catch (_) {}
  TZ = effectiveTz(); buildExams(); lastSig = '';
  renderFilters(); updateClock(); render(true);
  $('#sh-body').innerHTML = tzHtml();
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.exams)) throw new Error('The file needs an "exams" list.');
  if (raw.exams.length > 500) throw new Error('Too many exams (max 500).');
  const timezone = String(raw.timezone || 'Africa/Cairo');
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); } catch (_) { throw new Error('Unknown timezone "' + timezone + '".'); }
  const subs = [];
  const exams = raw.exams.map((x, i) => {
    const n = 'Exam ' + (i + 1) + ': ';
    const s = String((x && x.subject) ?? '').trim().slice(0, 60);
    if (!s) throw new Error(n + 'missing "subject".');
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(x.date ?? '').trim());
    if (!d || +d[2] < 1 || +d[2] > 12 || new Date(+d[1], +d[2] - 1, +d[3]).getMonth() !== +d[2] - 1) throw new Error(n + '"date" must look like 2026-05-14.');
    const t = /^(\d{1,2}):(\d{2})$/.exec(String(x.time ?? '').trim());
    if (!t || +t[1] > 23 || +t[2] > 59) throw new Error(n + '"time" must look like 15:00 (24-hour).');
    if (!subs.includes(s)) subs.push(s);
    const color = /^#[0-9a-f]{3,8}$/i.test(String(x.color || '')) ? x.color : (KNOWN[s.toLowerCase()] || PAL[subs.indexOf(s) % PAL.length]);
    return { utc: zonedToUtc(+d[1], +d[2] - 1, +d[3], +t[1], +t[2], timezone), dt: [+d[1], +d[2] - 1, +d[3]], t: t[1].padStart(2, '0') + ':' + t[2], s, color,
      paper: String(x.paper ?? '').trim().slice(0, 140), code: String(x.code ?? '').trim().slice(0, 80), dur: String(x.duration ?? '').trim().slice(0, 40) };
  });
  const notes = (Array.isArray(raw.notes) ? raw.notes : []).slice(0, 10).map(n => ({
    title: String((n && n.title) ?? '').slice(0, 80),
    lines: (Array.isArray(n && n.lines) ? n.lines : []).slice(0, 20).map(l => String(l).slice(0, 300))
  }));
  return { title: String(raw.title || 'My Exams').slice(0, 60), timezone, exams, notes };
}
function applyData(raw) {
  const d = normalize(raw);                       // throws before anything changes
  SRC_TZ = d.timezone; META = { title: d.title, notes: d.notes }; RAW = raw; BASE = d.exams;
  TZ = effectiveTz(); buildExams();
  activeTab = null; activeFilter = 'all'; lastSig = ''; needSync = true;
}
function clearData() {
  BASE = []; EXAM_DATA = []; META = { title: 'My Exams', notes: [] }; RAW = null; SRC_TZ = 'Africa/Cairo'; TZ = effectiveTz();
  activeTab = null; activeFilter = 'all'; lastSig = ''; needSync = true;
  try { localStorage.removeItem(KEY); } catch (_) {}
}
function templateObj() {
  const p = getEgyptParts();
  const f = n => { const d = new Date(p.year, p.month, p.day + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  return {
    _help: 'Edit this file, then press Import on the website. date = YYYY-MM-DD, time = 24-hour HH:MM in the timezone below. color is optional (#RRGGBB). Add as many exams as you like.',
    title: 'My Exams', timezone: 'Africa/Cairo',
    exams: [
      { subject: 'Physics', paper: 'Paper 4 · Theory', code: '0625/41', date: f(3), time: '15:00', duration: '1h 15m', color: '#3b9eff' },
      { subject: 'Maths', paper: 'Unit 1H · Calculator', code: '4MA1/1H', date: f(6), time: '11:00', duration: '2h' },
      { subject: 'Biology', paper: 'Paper 2 · Multiple choice', code: '0610/21', date: f(9), time: '15:00', duration: '45m' }
    ],
    notes: [{ title: 'Tip', lines: ['Notes show under your exam list. Delete this block if you do not need it.'] }]
  };
}

const $      = s => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const project = (v, d = 0.998) => (v / 1000) * d / (1 - d);
const rubber  = (o, dim, c = 0.55) => (o * dim * c) / (dim + c * Math.abs(o));

/* Spring: damping ratio + response, always animates from the live value
   and carries its current velocity through a re-target. */
const live = new Set(); let lastT = 0, rafId = 0;
class Spring {
  constructor(x, on) { this.x = x; this.v = 0; this.t = x; this.on = on; this.k = 0; this.c = 0; }
  to(t, o = {}) {
    const { v = this.v, damping = 1, response = 0.4 } = o;
    this.t = t; this.v = v;
    const w = 2 * Math.PI / response; this.k = w * w; this.c = 2 * damping * w;
    if (reduce.matches) { this.x = t; this.v = 0; live.delete(this); this.on(t); return; }
    live.add(this);
    if (!rafId) { lastT = performance.now(); rafId = requestAnimationFrame(tick); }
  }
  stop() { live.delete(this); this.v = 0; }
  set(x) { this.x = x; this.on(x); }
}
function tick(now) {
  const dt = Math.min((now - lastT) / 1000, 0.032); lastT = now;
  const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
  for (const s of live) {
    for (let i = 0; i < n; i++) { s.v += (-s.k * (s.x - s.t) - s.c * s.v) * h; s.x += s.v * h; }
    if (Math.abs(s.x - s.t) < 0.05 && Math.abs(s.v) < 0.5) { s.x = s.t; s.v = 0; live.delete(s); }
    s.on(s.x);
  }
  rafId = live.size ? requestAnimationFrame(tick) : 0;
}
function tracker() {
  const h = [];
  return {
    add(y) { const t = performance.now(); h.push({ y, t }); while (h.length > 1 && t - h[0].t > 100) h.shift(); },
    vel() {
      if (h.length < 2) return 0;
      const a = h[0], b = h[h.length - 1];
      if (performance.now() - b.t > 80) return 0;
      return (b.y - a.y) / (((b.t - a.t) / 1000) || 0.001);
    }
  };
}

/* ── Segmented control: pill follows the selected tab on a spring ── */
let activeTab = null, activeFilter = 'all', lastSig = '';
const tabsEl = $('#tabs'), ind = $('#ind'), list = $('#list');
const indX = new Spring(0, x => { ind.style.transform = `translateX(${x}px)`; });
const indW = new Spring(0, w => { ind.style.width = w + 'px'; });
function syncTabs(instant) {
  const b = tabsEl.querySelector(`.tab[data-tab="${activeTab}"]`);
  if (!b) return;
  tabsEl.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t === b);
    t.setAttribute('aria-selected', t === b);
  });
  if (instant) { indX.stop(); indW.stop(); indX.set(b.offsetLeft); indW.set(b.offsetWidth); }
  else {
    indX.to(b.offsetLeft, { damping: 1, response: 0.38 });
    indW.to(b.offsetWidth, { damping: 1, response: 0.38 });
  }
}

/* ── Render ── */
const EMPTY = `<div class="empty"><h3>No schedule yet</h3>
  <p>Import your schedule file to see every exam with a live countdown. It stays on this device and is never uploaded.</p>
  <button class="btn" id="em-import" type="button">Import schedule file</button>
  <button class="link" id="em-example" type="button">Try an example</button>
  <button class="link" id="em-tpl" type="button">Download template</button></div>`;
function setLogo() {
  $('#logo').innerHTML = 'My <span>Exams</span>';   // the app name; the file's title no longer drives the header
  document.title = 'My Exams';
}
function renderFilters() {
  const subs = [...new Map(EXAM_DATA.map(e => [e.s, e.color]))];
  $('#fbar').innerHTML = `<button class="fb${activeFilter === 'all' ? ' active' : ''}" data-f="all"><span class="dot"></span>All</button>` +
    subs.map(([s, c]) => `<button class="fb${activeFilter === s ? ' active' : ''}" data-f="${esc(s)}"><span class="dot" style="--c:${c}"></span>${esc(s)}</button>`).join('');
}
function refreshUI() { renderFilters(); setLogo(); updateClock(); render(true); }

function render(animate) {
  const has = EXAM_DATA.length > 0;
  tabsEl.hidden = $('#fbar').hidden = !has;
  if (!has) {
    $('#summary').textContent = 'No exams yet.';
    if (lastSig !== 'empty' || animate) { list.classList.toggle('anim', !!animate); list.innerHTML = EMPTY; }
    lastSig = 'empty'; return;
  }
  const nowMs = egyptNowMs();
  const up = EXAM_DATA.filter(e => e.epoch >  nowMs);
  const dn = EXAM_DATA.filter(e => e.epoch <= nowMs);
  $('#uc').textContent = up.length;
  $('#dc').textContent = dn.length;

  $('#summary').textContent = up.length
    ? `${up.length} remaining · Next: ${up[0].s}, ${getCountdown(up[0].epoch, up[0].midnightEpoch).label.toLowerCase()}`
    : `All ${EXAM_DATA.length} exams are done.`;

  if (activeTab === null) activeTab = up.length ? 'upcoming' : 'done';
  if (needSync) { syncTabs(true); needSync = false; }

  const pool = (activeTab === 'upcoming' ? up : dn.slice().reverse())
    .filter(e => activeFilter === 'all' || e.s === activeFilter);

  const sig = activeTab + '|' + activeFilter + '|' +
    pool.map(e => e.i + getCountdown(e.epoch, e.midnightEpoch).label).join();
  if (sig === lastSig && !animate) return;
  lastSig = sig;

  list.classList.toggle('anim', !!animate);
  if (!pool.length) {
    list.innerHTML = '<div class="empty">No exams in this selection.</div>';
    return;
  }

  let html = pool.map((e, idx) => {
    const cd = getCountdown(e.epoch, e.midnightEpoch);
    return `<button class="card${e.epoch <= nowMs ? ' done' : ''}" data-i="${e.i}" style="--c:${e.color};--d:${idx * 40}ms">
      <div class="db"><div class="dday">${e.dayNum}</div><div class="dmo">${e.monthS}</div><div class="dwk">${e.weekday}</div></div>
      <div class="di"><div class="dsubj">${esc(e.s)}</div><div class="dpap">${esc(e.paper)}</div><div class="dcode">${esc(e.code)}</div></div>
      <div class="dr"><span class="badge">${e.time12}</span><span class="pip">${esc(e.dur)}</span><span class="cdwn ${cd.cls}">${cd.label}</span></div>
    </button>`;
  }).join('');

  if (activeFilter === 'all') {
    html += META.notes.map((n, k) => `<div class="note" style="--d:${(pool.length + k) * 40}ms"><strong>${esc(n.title)}</strong><br>${n.lines.map(esc).join('<br>')}</div>`).join('');
  }
  list.innerHTML = html;
}

tabsEl.addEventListener('click', e => {
  const b = e.target.closest('.tab'); if (!b) return;
  activeTab = b.dataset.tab; syncTabs(false); render(true);
});
$('#fbar').addEventListener('click', e => {
  const b = e.target.closest('.fb'); if (!b) return;
  document.querySelectorAll('.fb').forEach(x => x.classList.toggle('active', x === b));
  activeFilter = b.dataset.f; render(true);
});

/* ── Detail sheet: 1:1 drag, momentum projection, rubber-band, velocity handoff ── */
const sheet = $('#sheet'), scrim = $('#scrim');
let H = 0, isOpen = false, sd = null, lastFocus = null;
const sheetSp = new Spring(1e5, y => {
  sheet.style.transform = `translate3d(0,${y}px,0)`;
  const closed = y >= H - 1;
  sheet.inert = closed;
  scrim.style.opacity = Math.min(1, Math.max(0, 1 - y / Math.max(H, 1)));
  if (reduce.matches) sheet.style.opacity = closed ? 0 : 1;
});

function examHtml(i) {
  const e = EXAM_DATA[i], cd = getCountdown(e.epoch, e.midnightEpoch);
  const row = (k, v) => v ? `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>` : '';
  const date = DAYS_L[new Date(Date.UTC(e.vy, e.vm, e.vd)).getUTCDay()] + ', ' + e.vd + ' ' + MONTHS[e.vm] + ' ' + e.vy;
  return `
    <div class="sh-sub" style="--c:${e.color}"><span class="dot"></span>${esc(e.s)}</div>
    <h2 id="sh-title">${esc(e.paper || e.s)}</h2>
    <dl>${row('Date', date)}${row('Starts', e.time12 + ' · ' + tzName())}${e.same ? '' : row('Exam centre time', e.dt[2] + ' ' + MONTHS[e.dt[1]] + ', ' + e.srcTime12 + ' · ' + tzName(SRC_TZ))}${row('Duration', e.dur)}${row('Paper code', e.code)}${row('Countdown', cd.label)}</dl>
    <button class="btn" id="sh-done" type="button">Done</button>`;
}
function openSheet(html) {
  $('#sh-body').innerHTML = html;
  H = sheet.offsetHeight;
  if (sheetSp.x >= H - 1) sheetSp.set(H);          // fully closed → start below the fold
  lastFocus = document.activeElement;
  isOpen = true; scrim.classList.add('open'); sheet.inert = false;
  sheetSp.to(0, { damping: 1, response: 0.4 });    // from wherever it is now
  sheet.focus({ preventScroll: true });
}
function closeSheet(o = {}) {
  isOpen = false; scrim.classList.remove('open');
  sheetSp.to(H, { damping: 1, response: 0.35, ...o });
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}
list.addEventListener('click', e => {
  const c = e.target.closest('.card'); if (c) return openSheet(examHtml(+c.dataset.i));
  const b = e.target.closest('button[id^="em-"]'); if (!b) return;
  if (b.id === 'em-import') pickFile();
  else if (b.id === 'em-tpl') download('my-exams-template.json', templateObj());
  else if (b.id === 'em-example') { applyData(templateObj()); refreshUI(); toast('Example loaded. Import your own file to replace it.'); }
});
scrim.addEventListener('click', () => closeSheet());
addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) closeSheet(); });
sheet.addEventListener('click', e => {
  if (e.target.closest('#sh-done')) return closeSheet();
  const d = e.target.closest('[id^="d-"]'); if (d) return dataAction(d);
  const z = e.target.closest('[data-tz]'); if (z) return setView(z.dataset.tz);
  const o = e.target.closest('.bgo');
  if (o) { setBg(o.dataset.bg, true); sheet.querySelectorAll('.bgo').forEach(x => x.classList.toggle('sel', x === o)); }
});

sheet.addEventListener('pointerdown', e => {
  if (e.target.closest('button,select,.bgs,.clog')) return;
  sheet.setPointerCapture(e.pointerId); sheetSp.stop();
  sd = { oy: e.clientY - sheetSp.x, tr: tracker() }; sd.tr.add(e.clientY);
});
sheet.addEventListener('pointermove', e => {
  if (!sd) return;
  const raw = e.clientY - sd.oy;
  sheetSp.set(raw < 0 ? -rubber(-raw, 80) : Math.min(raw, H));
  sd.tr.add(e.clientY);
});
const sheetUp = () => {
  if (!sd) return;
  const v = sd.tr.vel(), proj = sheetSp.x + project(v);
  sd = null;
  const o = { v, damping: Math.abs(v) > 300 ? 0.8 : 1, response: 0.32 };
  if (proj > H * 0.5) closeSheet(o);
  else { isOpen = true; scrim.classList.add('open'); sheetSp.to(0, o); }
};
sheet.addEventListener('pointerup', sheetUp);
sheet.addEventListener('pointercancel', sheetUp);

/* ── Backgrounds: CSS (glow, aurora, grid) + one canvas (network, stars, waves) ── */
const BG = { random: 'Surprise me', mesh: 'Glow', aurora: 'Aurora', nebula: 'Nebula', sunset: 'Sunset', synth: 'Synthwave', lava: 'Lava', network: 'Network', stars: 'Stars', warp: 'Warp', fireflies: 'Fireflies', bokeh: 'Bokeh', snow: 'Snow', sakura: 'Sakura', rain: 'Rain', embers: 'Embers', matrix: 'Matrix', waves: 'Waves', formulas: 'Formulas', grid: 'Grid', plain: 'Plain' };
const POOL = Object.keys(BG).filter(k => k !== 'random' && k !== 'plain');
const CANVAS = new Set(['network', 'stars', 'waves', 'fireflies', 'rain', 'formulas', 'warp', 'bokeh', 'snow', 'sakura', 'embers', 'matrix']);
const cvs = $('#cvs'), ctx = cvs.getContext('2d'), bgfx = $('#bgfx');
let mode = 'aurora', pref = 'aurora', W = 0, CH = 0, parts = [], raf2 = 0;
const isLight = () => matchMedia('(prefers-color-scheme: light)').matches;
function sizeCvs() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; CH = innerHeight;
  cvs.width = W * dpr; cvs.height = CH * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = Math.round(({ stars: W * CH / 6000, network: Math.min(90, W * CH / 16000), fireflies: Math.min(45, W * CH / 26000), rain: Math.min(170, W / 5), formulas: Math.min(34, W * CH / 22000), warp: Math.min(160, W * CH / 4000), bokeh: Math.min(22, W * CH / 40000), snow: Math.min(130, W * CH / 8000), sakura: Math.min(40, W * CH / 18000), embers: Math.min(70, W * CH / 10000), matrix: Math.floor(W / 18) })[mode] || 40);
  parts = Array.from({ length: n }, () => ({
    x: Math.random() * W, y: Math.random() * CH, vx: (Math.random() - .5) * .7, vy: (Math.random() - .5) * .7,
    r: .7 + Math.random() * 1.5, p: Math.random() * 6.28, s: .5 + Math.random() * 1.6,
    a: Math.random() * 6.28, l: 10 + Math.random() * 16, k: Math.floor(Math.random() * 40), sz: 18 + Math.random() * 30
  }));
}
const draw = {
  network() {
    const c = isLight() ? '154,87,0' : '244,161,58';
    if (!reduce.matches) for (const p of parts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > CH) p.vy *= -1;
    }
    ctx.lineWidth = .7;
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
      const d = Math.hypot(parts[i].x - parts[j].x, parts[i].y - parts[j].y);
      if (d < 125) {
        ctx.strokeStyle = `rgba(${c},${(1 - d / 125) * .24})`;
        ctx.beginPath(); ctx.moveTo(parts[i].x, parts[i].y); ctx.lineTo(parts[j].x, parts[j].y); ctx.stroke();
      }
    }
    ctx.fillStyle = `rgba(${c},.42)`;
    for (const p of parts) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }
  },
  stars(t) {
    const c = isLight() ? '50,50,90' : '255,255,255';
    for (const p of parts) {
      const a = .25 + .75 * (.5 + .5 * Math.sin(t * p.s + p.p));
      const y = (((p.y - t * p.s * 3) % CH) + CH) % CH;
      ctx.fillStyle = `rgba(${c},${a * .85})`;
      ctx.beginPath(); ctx.arc(p.x, y, p.r, 0, 6.283); ctx.fill();
    }
  },
  fireflies(t) {
    const c = isLight() ? '190,120,0' : '255,226,120';
    for (const p of parts) {
      if (!reduce.matches) {
        p.a += (Math.random() - .5) * .25; p.x += Math.cos(p.a) * p.s * .35; p.y += Math.sin(p.a) * p.s * .35;
        if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = CH + 20; else if (p.y > CH + 20) p.y = -20;
      }
      const a = .2 + .8 * (.5 + .5 * Math.sin(t * p.s * 1.3 + p.p)), R = (p.r + 1.5) * 6;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
      g.addColorStop(0, `rgba(${c},${a * .9})`); g.addColorStop(.25, `rgba(${c},${a * .35})`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 6.283); ctx.fill();
    }
  },
  rain() {
    const c = isLight() ? '60,90,150' : '175,205,255';
    ctx.lineWidth = 1; ctx.lineCap = 'round';
    for (const p of parts) {
      if (!reduce.matches) {
        p.y += p.s * 5 + 6; p.x += 1.2;
        if (p.y > CH + 20) { p.y = -20; p.x = Math.random() * W; }
        if (p.x > W + 10) p.x = -10;
      }
      ctx.strokeStyle = `rgba(${c},${.12 + p.r * .1})`;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.l * .12, p.y - p.l); ctx.stroke();
    }
  },
  formulas(t) {
    const SYM = ['π', 'Σ', '∫', '√', '∞', 'Δ', 'θ', 'λ', 'μ', 'σ', '≈', '±', 'x²', 'sin θ', 'F = ma', 'E = mc²', 'H₂O', 'a²+b²=c²', '∂', 'Ω', 'ħ', 'log x', 'y = mx + c', 'v = u + at', 'CO₂'];
    const cols = isLight() ? ['154,87,0', '37,99,235', '126,34,206'] : ['244,161,58', '96,165,250', '196,181,253'];
    const span = CH + 140;
    ctx.textAlign = 'center';
    for (const p of parts) {
      const y = (((p.y - t * p.s * 14) % span) + span) % span - 70, x = p.x + Math.sin(t * .35 + p.p) * 16;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * .25 + p.p) * .18);
      ctx.font = `italic ${p.sz}px ui-serif,Georgia,serif`;
      ctx.fillStyle = `rgba(${cols[p.k % 3]},${.1 + (p.r / 2.2) * .14})`;
      ctx.fillText(SYM[p.k % SYM.length], 0, 0); ctx.restore();
    }
  },
  snow(t) {
    const c = isLight() ? '110,140,190' : '255,255,255';
    for (const p of parts) {
      if (!reduce.matches) { p.y += p.s * .8 + .4; p.x += Math.sin(t * .8 + p.p) * .35; if (p.y > CH + 10) { p.y = -10; p.x = Math.random() * W; } }
      ctx.fillStyle = `rgba(${c},${.3 + p.r * .18})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.6, 0, 6.283); ctx.fill();
    }
  },
  bokeh(t) {
    const cols = isLight() ? ['244,161,58', '59,130,246', '219,39,119', '16,185,129'] : ['255,200,110', '110,180,255', '255,130,190', '120,230,190'];
    for (const p of parts) {
      const R = 22 + p.sz * 1.6, sp = CH + 2 * R, c = cols[p.k % 4];
      const x = (((p.x + Math.sin(t * .12 * p.s + p.p) * 40) % W) + W) % W, y = (((p.y - t * p.s * 5) % sp) + sp) % sp - R;
      const g = ctx.createRadialGradient(x, y, R * .2, x, y, R);
      g.addColorStop(0, `rgba(${c},.04)`); g.addColorStop(.85, `rgba(${c},.15)`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 6.283); ctx.fill();
      ctx.strokeStyle = `rgba(${c},.18)`; ctx.lineWidth = 1; ctx.stroke();
    }
  },
  matrix(t) {
    const G = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789πΣ∫√≈Δ', L = isLight(), c = L ? '0,120,70' : '70,255,150', cell = 18;
    ctx.font = '14px ui-monospace,Menlo,Consolas,monospace'; ctx.textAlign = 'center';
    parts.forEach((p, i) => {
      const x = i * cell + cell / 2, len = 8 + Math.floor(p.l / 3), span = CH + len * cell;
      const head = ((p.y + t * (40 + p.s * 45)) % span + span) % span;
      for (let k = 0; k < len; k++) {
        const y = head - k * cell; if (y < -cell || y > CH + cell) continue;
        ctx.fillStyle = k === 0 && !L ? 'rgba(220,255,235,.85)' : `rgba(${c},${k === 0 ? .85 : (1 - k / len) * .45})`;
        ctx.fillText(G[(i * 7 + k * 13 + Math.floor(t * p.s * 2 + k)) % G.length], x, y);
      }
    });
  },
  warp(t) {
    const c = isLight() ? '40,60,140' : '255,255,255', cx = W / 2, cy = CH / 2, M = Math.hypot(cx, cy) * 1.1;
    ctx.lineCap = 'round';
    for (const p of parts) {
      const z = ((t * .18 * p.s + p.p / 6.283) % 1 + 1) % 1, z0 = Math.max(0, z - .05 - .02 * p.s);
      const r1 = z * z * M, r0 = z0 * z0 * M, ca = Math.cos(p.a), sa = Math.sin(p.a);
      ctx.strokeStyle = `rgba(${c},${Math.min(1, z * 1.2) * .85})`; ctx.lineWidth = .6 + z * 2.2;
      ctx.beginPath(); ctx.moveTo(cx + ca * r0, cy + sa * r0); ctx.lineTo(cx + ca * r1, cy + sa * r1); ctx.stroke();
    }
  },
  sakura(t) {
    const c = isLight() ? '219,80,140' : '255,183,210', span = CH + 60;
    for (const p of parts) {
      const y = (((p.y + t * p.s * 28) % span) + span) % span - 30, x = (((p.x + Math.sin(t * .6 * p.s + p.p) * 38 + t * p.s * 6) % W) + W) % W, s = p.r * 2.2 + 3;
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * .8 * p.s + p.p);
      ctx.fillStyle = `rgba(${c},${.42 + p.r * .15})`; ctx.beginPath(); ctx.ellipse(0, 0, s, s * .55, 0, 0, 6.283); ctx.fill(); ctx.restore();
    }
  },
  embers(t) {
    const L = isLight(), c = L ? '220,90,0' : '255,150,50', span = CH + 40;
    const bg = ctx.createLinearGradient(0, CH, 0, CH * .5);
    bg.addColorStop(0, `rgba(255,90,20,${L ? .1 : .2})`); bg.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, CH * .5, W, CH * .5);
    for (const p of parts) {
      const y = (((p.y - t * p.s * 30) % span) + span) % span - 20, x = p.x + Math.sin(t * 1.2 * p.s + p.p) * 22;
      const a = (.15 + .85 * Math.max(0, y / CH)) * (.7 + .3 * Math.sin(t * p.s * 9 + p.p)), R = p.r * 3.5 + 2;
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 6.283); ctx.fill();
    }
  },
  waves(t) {
    const cols = isLight() ? ['154,87,0', '37,99,235', '219,39,119'] : ['244,161,58', '59,158,255', '244,114,182'];
    cols.forEach((c, i) => {
      ctx.beginPath(); ctx.moveTo(0, CH);
      for (let x = 0; x <= W; x += 8)
        ctx.lineTo(x, CH * (.74 + .07 * i) + Math.sin(x / (150 + 60 * i) + t * (.4 + .15 * i) + i * 2) * (24 + 9 * i));
      ctx.lineTo(W, CH); ctx.closePath();
      ctx.fillStyle = `rgba(${c},${.11 + .02 * i})`; ctx.fill();
    });
  }
};
function loop(ms) {
  ctx.clearRect(0, 0, W, CH);
  draw[mode]((ms || 0) / 1000);
  raf2 = reduce.matches ? 0 : requestAnimationFrame(loop);
}
function setBg(m, save) {
  if (!BG[m]) m = 'aurora';
  pref = m;
  if (save) { try { localStorage.setItem('igcse-bg', m); } catch (_) {} }
  if (m === 'random') {                          // a different one every time, never the same twice in a row
    let last = ''; try { last = localStorage.getItem('igcse-bg-last') || ''; } catch (_) {}
    const pool = POOL.filter(k => k !== last);
    m = pool[Math.floor(Math.random() * pool.length)];
    try { localStorage.setItem('igcse-bg-last', m); } catch (_) {}
  }
  mode = m; document.body.dataset.bg = m;
  cancelAnimationFrame(raf2); raf2 = 0;
  if (CANVAS.has(m)) { sizeCvs(); loop(0); } else if (W) ctx.clearRect(0, 0, W, CH);
}
/* grid spotlight follows the pointer on a spring */
const mx = new Spring(innerWidth * .5, x => bgfx.style.setProperty('--mx', x + 'px'));
const my = new Spring(innerHeight * .3, y => bgfx.style.setProperty('--my', y + 'px'));
addEventListener('pointermove', e => {
  if (mode === 'grid') { mx.to(e.clientX, { response: .7 }); my.to(e.clientY, { response: .7 }); }
}, { passive: true });

const bgHtml = () => `<div class="sh-sub" style="--c:var(--acc-ink)">Appearance</div><h2 id="sh-title">Background</h2><div class="bgs">` +
  Object.entries(BG).map(([k, n]) => `<button class="bgo${k === pref ? ' sel' : ''}" data-bg="${k}" type="button"><i class="pv pv-${k}">${k === 'formulas' ? 'π ∑ ∫' : k === 'random' ? '?' : ''}</i><span>${n}</span></button>`).join('') +
  `</div><button class="btn" id="sh-done" type="button">Done</button>`;
$('#bg-btn').addEventListener('click', () => openSheet(bgHtml()));

/* ── Import / export: the file never leaves this device ── */
const fileIn = $('#file-in');
let toastT = 0, confirmT = 0;
function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 4200);
}
function pickFile() { fileIn.value = ''; fileIn.click(); }
function download(name, obj) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
fileIn.addEventListener('change', async () => {
  const f = fileIn.files[0]; if (!f) return;
  try {
    if (f.size > 1e6) throw new Error('That file is too large.');
    const raw = JSON.parse(await f.text());
    applyData(raw); refreshUI();
    if (isOpen) closeSheet();
    try { localStorage.setItem(KEY, JSON.stringify(raw)); toast(`Imported ${EXAM_DATA.length} exam${EXAM_DATA.length === 1 ? '' : 's'}.`); }
    catch (_) { toast('Loaded, but this browser blocked saving it.', true); }
  } catch (err) { toast(err instanceof SyntaxError ? "That file isn't valid JSON." : err.message, true); }
});
const dataHtml = () => `<div class="sh-sub" style="--c:var(--acc-ink)">Your data</div><h2 id="sh-title">Schedule file</h2>
  <p class="sh-p">${EXAM_DATA.length ? EXAM_DATA.length + ' exams loaded. ' : 'No schedule loaded. '}It is stored only on this device and never uploaded.</p>
  <button class="btn" id="d-import" type="button">Import schedule file</button>
  <div class="rows"><button class="row" id="d-tpl" type="button">Download template</button>${EXAM_DATA.length
    ? '<button class="row" id="d-exp" type="button">Export current schedule</button><button class="row warn" id="d-clr" type="button">Remove all data</button>' : ''}</div>`;
function dataAction(b) {
  if (b.id === 'd-import') pickFile();
  else if (b.id === 'd-tpl') download('my-exams-template.json', templateObj());
  else if (b.id === 'd-exp' && RAW) download('my-exams-schedule.json', RAW);
  else if (b.id === 'd-clr') {
    if (!b.dataset.sure) {
      b.dataset.sure = 1; b.textContent = 'Tap again to remove everything';
      clearTimeout(confirmT); confirmT = setTimeout(() => { b.dataset.sure = ''; b.textContent = 'Remove all data'; }, 3000);
      return;
    }
    clearData(); refreshUI(); closeSheet(); toast('All data removed from this device.');
  }
}
$('#data-btn').addEventListener('click', () => openSheet(dataHtml()));

/* ── Changelog ── */
const CHANGELOG = [
  { v: '2.0.1', date: '12 Oct 2026', groups: [
    { t: 'Fixed', items: [
      'The header no longer overflows on narrow phones. The clock now shows a compact date (for example "Mon 12 Oct · Cairo") and the logo shortens if it has to.' ] },
    { t: 'Changed', items: [
      'The header always says "My Exams". The title inside a schedule file no longer changes it.',
      'Sakura petals are smaller and brighter.' ] }
  ] },
  { v: '2.0', date: '12 Oct 2026', groups: [
    { t: 'New', items: [
      'Import your own schedule from a file. It is saved only on your device. Template download, export and "remove all data" included.',
      'Time zones: follow your device automatically, use the exam centre\'s time, or pick any zone. Tap the clock.',
      '20 backgrounds plus "Surprise me": Aurora, Nebula, Sunset, Synthwave, Lava, Stars, Warp, Fireflies, Bokeh, Snow, Sakura, Rain, Embers, Matrix, Waves, Formulas, Grid and more. Tap the sparkle button.',
      'Tap any exam for a detail sheet. Drag it, flick it away, or catch it mid-flight.',
      'Light mode, plus reduced-motion, reduced-transparency and high-contrast support.',
      'A new app icon, including proper Android and iPhone home-screen versions.' ] },
    { t: 'Changed', items: [
      'Complete redesign in an Apple-style: spring animations, a translucent header, tighter typography and instant press feedback.',
      'The Upcoming/Done switch now slides on a spring. Subject filters are built from your own file.',
      'The animated particle background is now just one option ("Network") instead of the only look.',
      'Cards no longer replay their entrance animation every 10 seconds.',
      'The app is now simply called "My Exams" (home-screen name, browser tab and header).' ] },
    { t: 'Removed', items: [
      'The built-in IGCSE 2026 exam list. Import your schedule file instead.' ] },
    { t: 'Fixed', items: [
      'Clock and countdowns are more reliable around midnight and local daylight-saving changes.',
      'Updates now install cleanly for people who already added the app.' ] }
  ] },
  { v: '1.0', date: 'Apr 2026', groups: [
    { t: 'Original', items: [
      'Fixed list of Egypt IGCSE 2026 exams with live Cairo-time countdowns.',
      'Upcoming and Done tabs with subject filters.',
      'Installable offline app with an animated particle background.' ] }
  ] }
];
const clogHtml = () => `<div class="sh-sub" style="--c:var(--acc-ink)">Changelog</div><h2 id="sh-title">What's new</h2><div class="clog">` +
  CHANGELOG.map(r => `<h3>Version ${r.v}<small>${r.date}</small></h3>` +
    r.groups.map(g => `<h4>${g.t}</h4><ul>${g.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`).join('')).join('') +
  `</div><button class="btn" id="sh-done" type="button">Done</button>`;
$('#ver').textContent = 'Version ' + CHANGELOG[0].v;
$('#whatsnew').addEventListener('click', () => openSheet(clogHtml()));

/* ── Time zone picker (tap the clock) ── */
const ZONES = () => Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone')
  : ['Africa/Cairo', 'Europe/London', 'Europe/Paris', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'America/New_York', 'America/Chicago', 'America/Los_Angeles'];
const tzHtml = () => {
  const row = (k, label, sub) => `<button class="row${VIEW === k ? ' sel' : ''}" data-tz="${k}" type="button">${label}<small>${esc(sub)}</small></button>`;
  return `<div class="sh-sub" style="--c:var(--acc-ink)">Time zone</div><h2 id="sh-title">Show times in</h2>
  <p class="sh-p">Exams are fixed in the exam centre's time. This only changes how times, dates and countdowns are shown.</p>
  <div class="rows">${row('auto', 'Automatic', 'Follows this device · ' + tzName(deviceTz()))}${row('exam', 'Exam centre', tzName(SRC_TZ))}</div>
  <select id="tz-sel" aria-label="Choose another time zone"><option value="">Choose another time zone…</option>${ZONES().map(z => `<option value="${z}"${VIEW === z ? ' selected' : ''}>${z.replace(/_/g, ' ')}</option>`).join('')}</select>`;
};
$('#clk').addEventListener('click', () => openSheet(tzHtml()));
sheet.addEventListener('change', e => { if (e.target.id === 'tz-sel' && e.target.value) setView(e.target.value); });

/* ── Header edge, resize, init ── */
const bar = $('#bar');
addEventListener('scroll', () => bar.classList.toggle('scrolled', scrollY > 4), { passive: true });
addEventListener('resize', () => {
  syncTabs(true);
  if (CANVAS.has(mode)) { sizeCvs(); if (reduce.matches) loop(0); }
  if (isOpen) { H = sheet.offsetHeight; sheetSp.stop(); sheetSp.set(0); }
});

let saved = null; try { saved = localStorage.getItem('igcse-bg'); } catch (_) {}
setBg(saved || 'aurora');
try { const v = localStorage.getItem('igcse-tz'); if (v && v !== 'auto' && v !== 'exam') new Intl.DateTimeFormat('en-US', { timeZone: v }); if (v) VIEW = v; } catch (_) {}
try { const st = localStorage.getItem(KEY); if (st) applyData(JSON.parse(st)); } catch (_) {}
TZ = effectiveTz(); buildExams();
refreshUI();
// Keeps done/upcoming and countdowns accurate; only re-draws when something changed
setInterval(() => render(false), 10_000);
