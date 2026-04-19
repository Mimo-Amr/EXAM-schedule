/* ============================================================
   EGYPT IGCSE 2026 — app.js
   Handles: particles, Egypt-timezone clock, exam rendering
   No external dependencies — works on any static host
============================================================ */

const TZ     = 'Africa/Cairo';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_S = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS_L = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];


/* ════════════════════════════════════════════════════════════
   PARTICLES
   Dots drift across the background. Lines form between any
   two dots within MAX_D pixels and fade as they move apart.
════════════════════════════════════════════════════════════ */
(function initParticles() {
  const canvas = document.getElementById('cvs');
  const ctx    = canvas.getContext('2d');

  const COUNT = 75;
  const MAX_D = 125;   // max connection distance in px
  const SPEED = 0.35;  // max velocity per axis

  let W, H;
  const particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createParticle() {
    return {
      x:  Math.random() * window.innerWidth,
      y:  Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * SPEED * 2,
      vy: (Math.random() - 0.5) * SPEED * 2,
      r:  1.2 + Math.random() * 1.4,
    };
  }

  for (let i = 0; i < COUNT; i++) particles.push(createParticle());

  resize();
  window.addEventListener('resize', resize);

  function drawFrame() {
    ctx.clearRect(0, 0, W, H);

    // update positions, bounce off walls
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    });

    // draw lines between close pairs
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_D) {
          const alpha = (1 - dist / MAX_D) * 0.22;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(244,161,58,${alpha})`;
          ctx.lineWidth   = 0.7;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // draw dots
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244,161,58,0.38)';
      ctx.fill();
    });

    requestAnimationFrame(drawFrame);
  }

  drawFrame();
})();


/* ════════════════════════════════════════════════════════════
   EGYPT TIME UTILITIES
   Uses Intl.DateTimeFormat — a browser built-in.
   No server, no library, no external request needed.

   How the Egypt-local comparison works:
   ─────────────────────────────────────
   Both exam.epoch and egyptNowMs() are built the same way:
     new Date(year, month, day, hour, minute, second).getTime()
   using Egypt clock numbers fed into the browser's local
   Date constructor. The local-timezone offset is the same in
   both values, so it cancels out in every subtraction.
   The diff is therefore always a correct Egypt-relative value
   regardless of which country/timezone the visitor is in.
════════════════════════════════════════════════════════════ */

/** Get current time broken into parts for Cairo timezone. */
function getEgyptParts() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year:     'numeric',
    month:    'numeric',
    day:      'numeric',
    hour:     'numeric',
    minute:   'numeric',
    second:   'numeric',
    hour12:   false,
  }).formatToParts(new Date());

  const get = type => parts.find(p => p.type === type)?.value;

  return {
    year:   parseInt(get('year'),   10),
    month:  parseInt(get('month'),  10) - 1, // 0-indexed
    day:    parseInt(get('day'),    10),
    hour:   parseInt(get('hour'),   10),
    minute: parseInt(get('minute'), 10),
    second: parseInt(get('second'), 10),
  };
}

/**
 * Egypt "now" expressed as a local epoch (ms).
 * Comparable directly to exam.epoch values.
 */
function egyptNowMs() {
  const p = getEgyptParts();
  return new Date(p.year, p.month, p.day, p.hour, p.minute, p.second).getTime();
}

/** Zero-pad a number to 2 digits. */
function pad(n) { return String(n).padStart(2, '0'); }

/** Convert 24h hour + minute to a 12h display string, e.g. "3:00 PM". */
function to12h(hour, minute) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12  = hour % 12 || 12;
  return `${h12}:${pad(minute)} ${ampm}`;
}

/** Update the header clock — called every second. */
function updateClock() {
  const p   = getEgyptParts();
  const dow = new Date(p.year, p.month, p.day).getDay();

  document.getElementById('clk-d').textContent =
    `${DAYS_L[dow]}, ${p.day} ${MONTHS[p.month]} ${p.year} · Cairo`;

  const ampm = p.hour >= 12 ? 'PM' : 'AM';
  const h12  = p.hour % 12 || 12;
  document.getElementById('clk-t').textContent =
    `${h12}:${pad(p.minute)}:${pad(p.second)} ${ampm}`;
}

updateClock();
setInterval(updateClock, 1000);


/* ════════════════════════════════════════════════════════════
   EXAM DATA
   All times are Egypt local clock times, matching the
   school's confirmed start-time table:
     CIE AM  = 11:00   CIE PM  = 15:00
     Edexcel = 11:00   OxAQA   = 10:00
════════════════════════════════════════════════════════════ */
const EXAM_DATA = [

  // ── CHEMISTRY ──
  {
    dt: [2026, 3, 28], t: '15:00',
    s: 'Chemistry', tag: 'che', cls: 'c-che', pip: 'p-che',
    paper: 'Theory – Core (P31) / Extended (P41)',
    code: 'CIE 0620/31 · 0620/41', dur: '1h 15m',
  },
  {
    dt: [2026, 4, 7], t: '15:00',
    s: 'Chemistry', tag: 'che', cls: 'c-che', pip: 'p-che',
    paper: 'Alternative to Practical',
    code: 'CIE 0620/61', dur: '1h',
  },
  {
    dt: [2026, 5, 9], t: '15:00',
    s: 'Chemistry', tag: 'che', cls: 'c-che', pip: 'p-che',
    paper: 'Multiple Choice – Core / Extended',
    code: 'CIE 0620/11 · 0620/21', dur: '45m',
  },

  // ── BIOLOGY ──
  {
    dt: [2026, 3, 30], t: '15:00',
    s: 'Biology', tag: 'bio', cls: 'c-bio', pip: 'p-bio',
    paper: 'Theory – Core (P31) / Extended (P41)',
    code: 'CIE 0610/31 · 0610/41', dur: '1h 15m',
  },
  {
    dt: [2026, 4, 12], t: '15:00',
    s: 'Biology', tag: 'bio', cls: 'c-bio', pip: 'p-bio',
    paper: 'Alternative to Practical',
    code: 'CIE 0610/61', dur: '1h',
  },
  {
    dt: [2026, 5, 8], t: '15:00',
    s: 'Biology', tag: 'bio', cls: 'c-bio', pip: 'p-bio',
    paper: 'Multiple Choice – Core / Extended',
    code: 'CIE 0610/11 · 0610/21', dur: '45m',
  },

  // ── PHYSICS ──
  {
    dt: [2026, 4, 8], t: '15:00',
    s: 'Physics', tag: 'phy', cls: 'c-phy', pip: 'p-phy',
    paper: 'Theory – Core (P31) / Extended (P41)',
    code: 'CIE 0625/31 · 0625/41', dur: '1h 15m',
  },
  {
    dt: [2026, 4, 19], t: '15:00',
    s: 'Physics', tag: 'phy', cls: 'c-phy', pip: 'p-phy',
    paper: 'Alternative to Practical',
    code: 'CIE 0625/61', dur: '1h',
  },
  {
    dt: [2026, 5, 3], t: '15:00',
    s: 'Physics', tag: 'phy', cls: 'c-phy', pip: 'p-phy',
    paper: 'Multiple Choice – Core / Extended',
    code: 'CIE 0625/11 · 0625/21', dur: '45m',
  },

  // ── MATHEMATICS ──
  {
    dt: [2026, 4, 14], t: '11:00',
    s: 'Mathematics', tag: 'mat', cls: 'c-mat', pip: 'p-mat',
    paper: 'Unit 1H – Higher Tier · Calculator',
    code: 'Edexcel 4WM1H/01', dur: '2h',
  },
  {
    dt: [2026, 5, 3], t: '11:00',
    s: 'Mathematics', tag: 'mat', cls: 'c-mat', pip: 'p-mat',
    paper: 'Unit 2H – Higher Tier · Calculator',
    code: 'Edexcel 4WM2H/01', dur: '2h',
  },

  // ── ENGLISH ESL ──
  {
    dt: [2026, 3, 29], t: '10:00',
    s: 'English ESL', tag: 'esl', cls: 'c-esl', pip: 'p-esl',
    paper: 'Listening (9280/L) + Reading (9280/R)',
    code: 'OxAQA 9280', dur: '45m + 1h 15m',
  },
  {
    dt: [2026, 4, 6], t: '15:00',
    s: 'English ESL', tag: 'esl', cls: 'c-esl', pip: 'p-esl',
    paper: 'Reading & Writing',
    code: 'CIE 0510/11 · 0511/11', dur: '2h',
  },
  {
    dt: [2026, 4, 11], t: '10:00',
    s: 'English ESL', tag: 'esl', cls: 'c-esl', pip: 'p-esl',
    paper: 'Writing',
    code: 'OxAQA 9280/W', dur: '1h 15m',
  },
  {
    dt: [2026, 4, 21], t: '15:00',
    s: 'English ESL', tag: 'esl', cls: 'c-esl', pip: 'p-esl',
    paper: 'Listening',
    code: 'CIE 0510/21 · 0511/21', dur: '50m',
  },
];

/* ── Pre-process exam objects ── */
EXAM_DATA.forEach(exam => {
  const [yr, mo, dy] = exam.dt;
  const [h, m]       = exam.t.split(':').map(Number);

  // epoch built the same way as egyptNowMs() — local tz, Egypt numbers
  exam.epoch   = new Date(yr, mo, dy, h, m, 0).getTime();
  exam.dayNum  = dy;
  exam.monthS  = MONTHS[mo];
  exam.weekday = DAYS_S[new Date(yr, mo, dy).getDay()];
  exam.time12  = to12h(h, m);
});

EXAM_DATA.sort((a, b) => a.epoch - b.epoch);


/* ════════════════════════════════════════════════════════════
   COUNTDOWN
════════════════════════════════════════════════════════════ */
function getCountdown(examEpoch) {
  const diff  = examEpoch - egyptNowMs();

  if (diff <= 0) return { label: 'Done',           cls: 'cdone'  };

  const days  = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);

  if (days === 0 && hours < 1) return { label: 'Starting soon!', cls: 'today'  };
  if (days === 0)              return { label: `In ${hours}h`,   cls: 'today'  };
  if (days === 1)              return { label: 'Tomorrow',        cls: 'soon'   };
  if (days <= 7)               return { label: `In ${days} days`,cls: 'soon'   };
  return                              { label: `In ${days} days`,cls: 'future' };
}


/* ════════════════════════════════════════════════════════════
   RENDER
════════════════════════════════════════════════════════════ */
let activeTab    = 'upcoming';
let activeFilter = 'all';

function render() {
  const nowMs = egyptNowMs();
  const list  = document.getElementById('list');
  list.innerHTML = '';

  const filtered = EXAM_DATA.filter(e => activeFilter === 'all' || e.tag === activeFilter);
  const upcoming = filtered.filter(e => e.epoch >  nowMs);
  const done     = filtered.filter(e => e.epoch <= nowMs).reverse(); // most recent first

  // tab counts always reflect the full dataset
  document.getElementById('uc').textContent = EXAM_DATA.filter(e => e.epoch >  nowMs).length;
  document.getElementById('dc').textContent = EXAM_DATA.filter(e => e.epoch <= nowMs).length;

  const toShow = activeTab === 'upcoming' ? upcoming : done;

  if (toShow.length === 0) {
    list.innerHTML = '<div class="empty">No exams in this selection.</div>';
    return;
  }

  toShow.forEach((exam, index) => {
    const cd     = getCountdown(exam.epoch);
    const isDone = exam.epoch <= nowMs;

    const card = document.createElement('div');
    card.className            = `card ${exam.cls}${isDone ? ' done' : ''}`;
    card.style.animationDelay = `${index * 38}ms`;

    card.innerHTML = `
      <div class="db">
        <div class="dday">${exam.dayNum}</div>
        <div class="dmo">${exam.monthS}</div>
        <div class="dwk">${exam.weekday}</div>
      </div>
      <div class="dvd"></div>
      <div class="di">
        <div class="dsubj">${exam.s}</div>
        <div class="dpap">${exam.paper}</div>
        <div class="dcode">${exam.code}</div>
      </div>
      <div class="dr">
        <span class="badge">${exam.time12}</span>
        <span class="pip ${exam.pip}">${exam.dur}</span>
        <span class="cdwn ${cd.cls}">${cd.label}</span>
      </div>
    `;

    list.appendChild(card);
  });

  // speaking window note for ESL
  if (activeFilter === 'all' || activeFilter === 'esl') {
    const note = document.createElement('div');
    note.className = 'note';
    note.innerHTML =
      '<strong>Speaking windows</strong><br>' +
      'CIE ESL Speaking (0510/31): 30 Mar – 27 Apr 2026 · arranged by your centre<br>' +
      'OxAQA ESL Speaking (9280): 27 Mar – 1 May 2026 · submit by 4 May 2026';
    list.appendChild(note);
  }
}


/* ════════════════════════════════════════════════════════════
   EVENT LISTENERS
════════════════════════════════════════════════════════════ */
document.getElementById('tabs').addEventListener('click', e => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeTab = btn.dataset.tab;
  render();
});

document.getElementById('fbar').addEventListener('click', e => {
  const btn = e.target.closest('.fb');
  if (!btn) return;
  document.querySelectorAll('.fb').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.f;
  render();
});


/* ════════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════════ */
render();

// Re-render every 10 seconds so an exam moves to Done
// within 10 seconds of its start time passing in Cairo.
setInterval(render, 10_000);
