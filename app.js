/* ============================================================
   SWOLESAMMY — app logic
   Offline-first, single-user, data saved on this device.
   ============================================================ */

const STORE_KEY = 'sammy-training-v1';

/* ---------- state ---------- */
const defaultState = () => ({
  v: 2,
  name: 'Sammy',
  periods: [],   // [{start:'YYYY-MM-DD', end:'YYYY-MM-DD'|null}, …] sorted by start
  logs: {},      // dateISO -> log
  quoteCache: [],// quotes fetched from the net, reused offline
});

let state = load();
let viewDate = todayISO();
let activeTab = 'today';
let calCursor = monthKey(todayISO()); // 'YYYY-MM' shown in calendar
let chartExercise = null;
let currentQuote = null;

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const s = Object.assign(defaultState(), p);
      // migrate v1 → v2
      if (p.cycleStartDate && (!p.periods || !p.periods.length)) {
        s.periods = [{ start: p.cycleStartDate, end: null }];
      }
      delete s.cycleStartDate;
      s.periods = (s.periods || []).filter(x => x && x.start).sort((a, b) => a.start < b.start ? -1 : 1);
      return s;
    }
  } catch (e) { /* ignore */ }
  return defaultState();
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

/* ---------- date helpers ---------- */
function toISO(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function fromISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function todayISO() { return toISO(new Date()); }
function addDays(iso, n) { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
function daysBetween(a, b) { return Math.round((fromISO(b) - fromISO(a)) / 86400000); }
function weekdayOf(iso) { return fromISO(iso).getDay(); }
function monthKey(iso) { return iso.slice(0, 7); }
function prettyDate(iso) { return fromISO(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }); }
function shortDate(iso) { return fromISO(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }
function shortDateW(iso) { return fromISO(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }); }

/* ---------- cycle math ---------- */
function lastPeriod() { return state.periods.length ? state.periods[state.periods.length - 1] : null; }
function periodIsOpen() {
  const p = lastPeriod();
  return !!(p && !p.end && daysBetween(p.start, todayISO()) <= 9);
}
function startOnOrBefore(iso) {
  let s = null;
  for (const p of state.periods) { if (p.start <= iso) s = p.start; else break; }
  return s;
}
function cycleInfo(iso) {
  const s = startOnOrBefore(iso);
  if (!s) return null;
  const day = daysBetween(s, iso) + 1;
  let week = Math.ceil(day / 7);
  if (week > 4) week = 4; // hold on luteal until next period is logged
  return { day, week, start: s };
}
function avgCycleLen() {
  const starts = state.periods.map(p => p.start);
  if (starts.length < 2) return 28;
  const diffs = [];
  for (let i = 1; i < starts.length; i++) diffs.push(daysBetween(starts[i - 1], starts[i]));
  const recent = diffs.slice(-6).filter(d => d >= 15 && d <= 90);
  if (!recent.length) return 28;
  return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
}
function avgPeriodLen() {
  const lens = state.periods.filter(p => p.end).map(p => daysBetween(p.start, p.end) + 1).filter(l => l >= 1 && l <= 12);
  if (!lens.length) return 5;
  return Math.round(lens.reduce((a, b) => a + b, 0) / lens.length);
}
function predictedNextStart() {
  const p = lastPeriod();
  return p ? addDays(p.start, avgCycleLen()) : null;
}
function periodEndFor(p, isLast) {
  if (p.end) return p.end;
  if (isLast && periodIsOpen()) return todayISO();
  return addDays(p.start, avgPeriodLen() - 1);
}
function inPeriod(iso) {
  for (let i = 0; i < state.periods.length; i++) {
    const p = state.periods[i];
    if (iso >= p.start && iso <= periodEndFor(p, i === state.periods.length - 1)) return true;
  }
  return false;
}
function isPeriodStart(iso) { return state.periods.some(p => p.start === iso); }

/* ---------- program resolution ---------- */
function scheduledDay(iso) { return SCHEDULE[weekdayOf(iso)] || 'rest'; }
function planFor(week, day) {
  if (day === 'rest') return { rest: true };
  const block = DAYS[day];
  return {
    rest: false,
    title: DAY_TITLES[day],
    subtitle: DAY_SUBTITLES[day],
    tagline: DAY_TAGLINES[day] || null,
    warmup: block.warmup || null,
    cardio: block.cardio,
    ex: block.ex.map(e => ({ name: e.name, scheme: resolveScheme(e.scheme, week) })),
  };
}
function exMeta(day, name) {
  if (day === 'rest' || !DAYS[day]) return null;
  return DAYS[day].ex.find(e => e.name === name) || null;
}

/* ---------- logs ---------- */
function blankLog(iso, dayOverride) {
  const info = cycleInfo(iso);
  const week = info ? info.week : 2;
  const day = dayOverride || scheduledDay(iso);
  const plan = planFor(week, day);
  return {
    week, day,
    completed: false,
    notes: '',
    mood: null,
    symptoms: [],
    habits: [],
    posture: POSTURE.map(() => false),
    ex: plan.rest ? [] : plan.ex.map(e => ({ name: e.name, scheme: e.scheme, done: false, weight: '', reps: '' })),
  };
}
function buildLog(iso, dayOverride) {
  const saved = state.logs[iso];
  const day = dayOverride || (saved && saved.day) || scheduledDay(iso);
  const fresh = blankLog(iso, day);
  if (!saved) return fresh;
  fresh.notes = saved.notes || '';
  fresh.completed = !!saved.completed;
  fresh.mood = (saved.mood === 0 || saved.mood) ? saved.mood : null;
  fresh.symptoms = Array.isArray(saved.symptoms) ? saved.symptoms.slice() : [];
  fresh.habits = Array.isArray(saved.habits) ? saved.habits.slice() : [];
  if (Array.isArray(saved.posture)) fresh.posture = fresh.posture.map((v, i) => !!saved.posture[i]);
  if (saved.day === day && Array.isArray(saved.ex)) {
    const byName = {};
    saved.ex.forEach(e => { byName[e.name] = e; });
    fresh.ex = fresh.ex.map(e => {
      const s = byName[e.name];
      return s ? { ...e, done: !!s.done, weight: s.weight || '', reps: s.reps || '' } : e;
    });
  }
  return fresh;
}
function isMeaningful(log) {
  if (!log) return false;
  return !!(log.completed || (log.notes && log.notes.trim()) ||
    (log.mood === 0 || log.mood) ||
    (log.symptoms && log.symptoms.length) || (log.habits && log.habits.length) ||
    (log.posture && log.posture.some(Boolean)) ||
    (log.ex && log.ex.some(e => e.done || e.weight !== '' || e.reps !== '')));
}

let current = buildLog(viewDate);
function commit() {
  if (isMeaningful(current)) state.logs[viewDate] = current;
  else delete state.logs[viewDate];
  save();
}
function reloadCurrent() { current = buildLog(viewDate); }

/* "Last time" — most recent weight/reps for an exercise before a date */
function lastPerf(name, beforeISO) {
  const dates = Object.keys(state.logs).filter(d => d < beforeISO).sort().reverse();
  for (const d of dates) {
    const l = state.logs[d];
    if (!l.ex) continue;
    const e = l.ex.find(x => x.name === name && (x.weight !== '' || x.reps !== ''));
    if (e) return { date: d, weight: e.weight, reps: e.reps };
  }
  return null;
}
function recentNotes(excludeISO, n) {
  return Object.keys(state.logs)
    .filter(d => d !== excludeISO && state.logs[d].notes && state.logs[d].notes.trim())
    .sort().reverse().slice(0, n)
    .map(d => ({ date: d, text: state.logs[d].notes.trim() }));
}

/* ---------- quotes ---------- */
function dailyQuote() {
  let h = 0;
  for (const c of todayISO()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return QUOTES[h % QUOTES.length];
}
function randomQuote() {
  const pool = QUOTES.concat(state.quoteCache || []);
  return pool[Math.floor(Math.random() * pool.length)];
}
async function fetchNetQuote() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4500);
    const res = await fetch('https://dummyjson.com/quotes/random', { signal: ctrl.signal });
    clearTimeout(timer);
    const j = await res.json();
    if (j && j.quote) {
      // the API title-cases contractions ("Don'T") — tidy those up
      const text = String(j.quote).replace(/([a-z])'([A-Z])(?![A-Za-z])/g, (m, a, b) => `${a}'${b.toLowerCase()}`);
      const q = { q: text, a: j.author || 'Unknown' };
      state.quoteCache = (state.quoteCache || []).filter(x => x.q !== q.q).concat(q).slice(-30);
      save();
      return q;
    }
  } catch (e) { /* offline — fall back to bundled */ }
  return null;
}
function renderQuoteCard() {
  const el = document.querySelector('#quote-card');
  if (!el || !currentQuote) return;
  el.querySelector('.q-text p').textContent = currentQuote.q;
  el.querySelector('.q-text span').textContent = '— ' + currentQuote.a;
}

/* ---------- rendering ---------- */
const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function render() {
  document.body.dataset.tab = activeTab;
  const info = cycleInfo(activeTab === 'today' ? viewDate : todayISO());
  document.body.dataset.phase = info ? PHASES[info.week].key : '';
  if (activeTab === 'today') renderToday();
  if (activeTab === 'cycle') renderCycle();
  if (activeTab === 'progress') renderProgress();
  if (activeTab === 'program') renderProgram();
  if (activeTab === 'settings') renderSettings();
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
}

/* ===================== TODAY ===================== */
function renderToday() {
  reloadCurrent();
  const isToday = viewDate === todayISO();
  const info = cycleInfo(viewDate);
  const week = current.week;
  const day = current.day;
  const phase = info ? PHASES[week] : null;
  const L = Math.max(avgCycleLen(), info ? info.day : 0);
  const parts = [];

  // hero
  const chip = info ? `
      <button class="cycle-chip" data-action="goto-cycle">
        <div class="emo">${phase.emoji}</div>
        <div class="t">
          <b>Week ${week} · ${esc(phase.phase)}</b>
          <span>Cycle day ${info.day} · intensity ${esc(phase.intensity)}</span>
          <div class="bar"><i style="width:${Math.min(100, Math.round(info.day / L * 100))}%"></i></div>
        </div>
        <div class="arrow">›</div>
      </button>`
    : `
      <button class="cycle-chip" data-action="goto-cycle">
        <div class="emo">🌸</div>
        <div class="t"><b>Sync your cycle</b><span>Tap to log when your period started</span></div>
        <div class="arrow">›</div>
      </button>`;
  parts.push(`
    <div class="hero">
      <div class="brand">SwoleSammy</div>
      <h1>${isToday ? `Hi ${esc(state.name)} 💕` : esc(prettyDate(viewDate))}</h1>
      <div class="date">${isToday ? esc(prettyDate(viewDate)) : 'Viewing another day'}</div>
      ${chip}
    </div>`);

  // quote
  const q = currentQuote || dailyQuote();
  currentQuote = q;
  parts.push(`
    <div class="quote" id="quote-card">
      <div class="mark">“</div>
      <div class="q-text"><p>${esc(q.q)}</p><span>— ${esc(q.a)}</span></div>
      <button class="q-new" data-action="quote-new" aria-label="New quote"><svg><use href="#i-refresh"/></svg></button>
    </div>`);

  // date strip
  parts.push(`
    <div class="datestrip">
      <button class="ds-arrow" data-action="prev-day" aria-label="Previous day">‹</button>
      <button class="ds-mid" data-action="goto-today">${isToday ? 'Today' : `${esc(shortDateW(viewDate))} · <span class="back">back to today</span>`}</button>
      <button class="ds-arrow" data-action="next-day" aria-label="Next day">›</button>
    </div>`);

  if (phase) parts.push(`<div class="phase-note"><span>${phase.emoji}</span><span><b>${esc(phase.goal)}.</b> ${esc(phase.note)}</span></div>`);

  // session selector
  parts.push(`
    <div class="session-pick">
      <label>Session</label>
      <select data-action="set-day" class="select">
        ${[1, 2, 3, 4].map(d => `<option value="${d}" ${day === d ? 'selected' : ''}>Day ${d} · ${DAY_TITLES[d]}</option>`).join('')}
        <option value="rest" ${day === 'rest' ? 'selected' : ''}>Rest · Recovery · Walk</option>
      </select>
    </div>`);

  if (day === 'rest') {
    parts.push(`
      <div class="card rest-card">
        <h2>🌿 ${REST_DAY.title}</h2>
        <ul class="rest-list">${REST_DAY.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      </div>`);
  } else {
    const plan = planFor(week, day);
    if (plan.warmup) {
      parts.push(`
        <div class="card warmup-card">
          <h2>🔥 Warm-up</h2>
          <ul class="warmup-list">${plan.warmup.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
        </div>`);
    }
    parts.push(`<div class="card"><h2>Day ${day} · ${esc(plan.title)}<span class="sub">${esc(plan.subtitle)}</span></h2>`);
    if (plan.tagline) parts.push(`<div class="tagline">✨ ${esc(plan.tagline)}</div>`);
    parts.push(`<div class="ex-list">`);
    current.ex.forEach((e, i) => {
      const meta = exMeta(day, e.name);
      const last = lastPerf(e.name, viewDate);
      const lastTxt = last ? `Last: ${last.weight ? esc(last.weight) + ' kg' : ''}${last.weight && last.reps ? ' × ' : ''}${last.reps ? esc(last.reps) : ''} · ${esc(shortDate(last.date))}` : '';
      const hasCues = meta && (meta.cues || meta.note || meta.rest);
      parts.push(`
        <div class="ex-row ${e.done ? 'done' : ''}" data-ex="${i}">
          <div class="top">
            <button class="check" data-action="toggle-ex" data-i="${i}" aria-label="Done">${e.done ? '✓' : ''}</button>
            <div class="ex-main" ${hasCues ? `data-action="toggle-cues" data-i="${i}"` : ''}>
              <div class="ex-name">${esc(e.name)}${hasCues ? ' <span style="color:var(--rose);font-size:11px">ⓘ</span>' : ''}</div>
              <div class="ex-scheme">${esc(e.scheme)}</div>
              ${lastTxt ? `<div class="ex-last">${lastTxt}</div>` : ''}
            </div>
            <div class="ex-inputs">
              <input class="mini" inputmode="decimal" placeholder="${last && last.weight ? esc(last.weight) : 'kg'}" value="${esc(e.weight)}" data-action="ex-field" data-field="weight" data-i="${i}">
              <input class="mini" inputmode="text" placeholder="reps" value="${esc(e.reps)}" data-action="ex-field" data-field="reps" data-i="${i}">
            </div>
          </div>
          ${hasCues ? `
          <div class="ex-cues">
            ${meta.rest ? `<b>Rest:</b> ${esc(meta.rest)}<br>` : ''}
            ${meta.note ? `${esc(meta.note)}<br>` : ''}
            ${meta.cues ? `<b>Form</b><ul>${meta.cues.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
          </div>` : ''}
        </div>`);
    });
    parts.push(`</div>`);
    if (plan.cardio) parts.push(`<div class="cardio">🚶‍♀️ ${esc(plan.cardio)}</div>`);
    parts.push(`</div>`);
  }

  // check-in
  parts.push(`
    <div class="card">
      <h2>How are you feeling?</h2>
      <div class="mood-row">
        ${MOODS.map((m, i) => `<button class="mood-btn ${current.mood === i ? 'on' : ''}" data-action="mood" data-i="${i}">${m}<span>${MOOD_LABELS[i]}</span></button>`).join('')}
      </div>
      <div class="section-label">Symptoms</div>
      <div class="chips">${SYMPTOMS.map(s => `<button class="chip-toggle ${current.symptoms.includes(s) ? 'on' : ''}" data-action="symptom" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <div class="section-label">Daily targets</div>
      <div class="chips">${TARGETS.map(t => `<button class="chip-toggle habit ${current.habits.includes(t.label) ? 'on' : ''}" data-action="habit" data-s="${esc(t.label)}" title="${esc(t.detail)}">${t.icon} ${esc(t.label)}</button>`).join('')}</div>
    </div>`);

  // notes
  const prev = recentNotes(viewDate, 3);
  parts.push(`
    <div class="card">
      <h2>📝 Notes<span class="sub">What you actually did — crowded gym? swapped machines? write it here.</span></h2>
      <textarea class="notes" rows="4" placeholder="e.g. Hip thrust machine taken → did 3×12 dumbbell hip thrusts instead…" data-action="notes">${esc(current.notes)}</textarea>
      ${prev.length ? `
      <details class="prev-notes">
        <summary>Remember what you did — recent notes ↓</summary>
        ${prev.map(p => `<div class="prev-note"><b>${esc(shortDateW(p.date))}</b>${esc(p.text)}</div>`).join('')}
      </details>` : ''}
    </div>`);

  // posture
  parts.push(`
    <details class="card" ${current.posture.some(Boolean) ? 'open' : ''}>
      <summary>🧘 Daily posture work · 5 min</summary>
      <div class="ex-list">
        ${POSTURE.map((p, i) => `
          <div class="ex-row ${current.posture[i] ? 'done' : ''}">
            <div class="top">
              <button class="check" data-action="toggle-posture" data-i="${i}" aria-label="Done">${current.posture[i] ? '✓' : ''}</button>
              <div class="ex-main"><div class="ex-name">${esc(p[0])}</div><div class="ex-scheme">${esc(p[1])}</div></div>
            </div>
          </div>`).join('')}
      </div>
    </details>`);

  if (day !== 'rest') {
    parts.push(`<button class="finish ${current.completed ? 'is-done' : ''}" data-action="finish">${current.completed ? '✓ Session complete — so proud of you!' : 'Finish session 💪'}</button>`);
  }

  $('#tab-today').innerHTML = parts.join('');
}

/* ===================== CYCLE ===================== */
const PHASE_COLORS = { 1: '#e3879a', 2: '#6fbb93', 3: '#eda865', 4: '#b39ddb' };

function arcPath(cx, cy, r, a0, a1) {
  const rad = a => (a - 90) * Math.PI / 180;
  const x0 = cx + r * Math.cos(rad(a0)), y0 = cy + r * Math.sin(rad(a0));
  const x1 = cx + r * Math.cos(rad(a1)), y1 = cy + r * Math.sin(rad(a1));
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
function ringSVG(day, L) {
  const cx = 110, cy = 110, r = 92, gap = 4;
  const bounds = [0, 7, 14, 21, L];
  let arcs = '';
  for (let i = 0; i < 4; i++) {
    const f0 = Math.min(bounds[i], L) / L, f1 = Math.min(bounds[i + 1], L) / L;
    if (f1 <= f0) continue;
    const a0 = f0 * 360 + gap / 2, a1 = f1 * 360 - gap / 2;
    if (a1 <= a0) continue;
    arcs += `<path d="${arcPath(cx, cy, r, a0, a1)}" stroke="${PHASE_COLORS[i + 1]}" stroke-width="15" fill="none" stroke-linecap="round" opacity=".9"/>`;
  }
  const ang = (Math.min(day, L) - 0.5) / L * 360;
  const rad = (ang - 90) * Math.PI / 180;
  const mx = cx + r * Math.cos(rad), my = cy + r * Math.sin(rad);
  return `
    <svg viewBox="0 0 220 220">
      <circle cx="${cx}" cy="${cy}" r="${r}" stroke="#f6e3ea" stroke-width="15" fill="none"/>
      ${arcs}
      <circle cx="${mx.toFixed(2)}" cy="${my.toFixed(2)}" r="9" fill="#fff" stroke="var(--phase)" stroke-width="4"/>
    </svg>`;
}

function renderCycle() {
  const parts = [`<h1 class="tab-title">Cycle<small>Period tracker · synced to your training</small></h1>`];
  const info = cycleInfo(todayISO());

  if (!info) {
    parts.push(`
      <div class="card" style="text-align:center">
        <span style="font-size:40px">🌸</span>
        <h2 style="margin-top:8px">Let's sync your cycle</h2>
        <p class="hint">Log day 1 of your period and SwoleSammy will match your training to your cycle — Week 1 gentle, Weeks 2–3 strong, Week 4 wind-down. If your cycle runs long it simply holds on Week 4 (PCOS-friendly — no guessing).</p>
        <button class="primary" data-action="period-start">🩸 My period started today</button>
        <label class="field"><span>Or pick the date it started</span>
          <input type="date" class="select" max="${todayISO()}" data-action="set-start"></label>
      </div>`);
  } else {
    const phase = PHASES[info.week];
    const L = Math.max(avgCycleLen(), info.day);
    const next = predictedNextStart();
    const open = periodIsOpen();
    const dleft = next ? daysBetween(todayISO(), next) : null;
    parts.push(`
      <div class="card ring-card">
        <div class="ring-wrap">
          ${ringSVG(info.day, L)}
          <div class="ring-center">
            <div class="d"><small>cycle day</small>${info.day}</div>
            <div class="ph">${phase.emoji} ${esc(phase.phase)} · W${info.week}</div>
          </div>
        </div>
        ${next ? `<div class="next-period">Next period expected around <b>${esc(shortDateW(next))}</b>${dleft >= 0 ? ` · in ${dleft} day${dleft === 1 ? '' : 's'}` : ' · running late, totally normal'}</div>` : ''}
        <div class="period-actions">
          ${open
            ? `<button class="primary green" data-action="period-end">My period ended today 🤍</button>`
            : `<button class="primary" data-action="period-start">🩸 My period started today</button>`}
        </div>
        <div class="legend">
          ${[1, 2, 3, 4].map(w => `<span><i style="background:${PHASE_COLORS[w]}"></i>${PHASES[w].phase}</span>`).join('')}
        </div>
      </div>`);
  }

  // calendar
  const [cy, cm] = calCursor.split('-').map(Number);
  const first = new Date(cy, cm - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const dim = new Date(cy, cm, 0).getDate();
  const monthName = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const today = todayISO();
  const next = predictedNextStart();
  const predEnd = next ? addDays(next, avgPeriodLen() - 1) : null;
  let cells = '';
  for (const d of ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']) cells += `<div class="cal-dow">${d}</div>`;
  for (let i = 0; i < lead; i++) cells += `<div></div>`;
  for (let d = 1; d <= dim; d++) {
    const iso = `${calCursor}-${String(d).padStart(2, '0')}`;
    const cls = ['cal-cell'];
    if (inPeriod(iso)) { cls.push('period'); if (isPeriodStart(iso)) cls.push('p-start'); }
    else if (next && iso >= next && iso <= predEnd && iso > today) cls.push('pred');
    if (iso === today) cls.push('today');
    if (iso > today) cls.push('dim');
    const hasLog = isMeaningful(state.logs[iso]);
    cells += `<button class="${cls.join(' ')}" data-action="open-date" data-date="${iso}">${d}${hasLog ? '<span class="dot"></span>' : ''}</button>`;
  }
  parts.push(`
    <div class="card">
      <div class="cal-head">
        <b>${esc(monthName)}</b>
        <div class="cal-nav">
          <button data-action="cal-prev" aria-label="Previous month">‹</button>
          <button data-action="cal-next" aria-label="Next month">›</button>
        </div>
      </div>
      <div class="cal-grid">${cells}</div>
      <div class="legend">
        <span><i style="background:var(--rose)"></i>Period</span>
        <span><i style="background:#fff;box-shadow:inset 0 0 0 1.5px var(--rose)"></i>Expected</span>
        <span><i style="background:var(--p-follicular)"></i>Logged day</span>
      </div>
    </div>`);

  // history
  if (state.periods.length) {
    const rows = state.periods.slice(-6).reverse().map((p, idx, arr) => {
      const i = state.periods.length - 1 - idx;
      const isLast = i === state.periods.length - 1;
      const end = p.end || (isLast && periodIsOpen() ? null : periodEndFor(p, isLast));
      const len = end ? daysBetween(p.start, end) + 1 : daysBetween(p.start, todayISO()) + 1;
      const cyc = i > 0 ? daysBetween(state.periods[i - 1].start, p.start) : null;
      return `<div class="ph-row">
        <span>${esc(shortDate(p.start))}${end ? ' – ' + esc(shortDate(end)) : ' · ongoing'}</span>
        <span class="len">${len} day${len === 1 ? '' : 's'}${cyc ? ` · ${cyc}-day cycle` : ''}</span>
      </div>`;
    }).join('');
    parts.push(`
      <div class="card">
        <h2>Period history<span class="sub">Average cycle ${avgCycleLen()} days · average period ${avgPeriodLen()} days</span></h2>
        ${rows}
      </div>`);

    // adjust
    const lp = lastPeriod();
    const wk = cycleInfo(todayISO());
    parts.push(`
      <details class="card">
        <summary>Adjust dates</summary>
        <label class="field"><span>Last period started</span>
          <input type="date" class="select" value="${lp.start}" max="${todayISO()}" data-action="set-start"></label>
        <label class="field"><span>Last period ended</span>
          <input type="date" class="select" value="${lp.end || ''}" min="${lp.start}" max="${todayISO()}" data-action="set-end"></label>
        <label class="field"><span>Or jump straight to a week</span>
          <select class="select" data-action="set-week">
            <option value="">—</option>
            ${[1, 2, 3, 4].map(w => `<option value="${w}" ${wk && wk.week === w ? 'selected' : ''}>Week ${w} · ${PHASES[w].phase}</option>`).join('')}
          </select></label>
        <button class="danger" data-action="undo-period">Remove last period entry</button>
      </details>`);
  }

  $('#tab-cycle').innerHTML = parts.join('');
}

/* ===================== PROGRESS ===================== */
function trainedSessions() {
  return Object.keys(state.logs).sort().filter(d => {
    const l = state.logs[d];
    return l.day !== 'rest' && (l.completed || (l.ex && l.ex.some(e => e.done)));
  });
}
function mondayOf(iso) { return addDays(iso, -((weekdayOf(iso) + 6) % 7)); }
function weeklyStreak(sessions) {
  const byWeek = {};
  sessions.forEach(d => { const w = mondayOf(d); byWeek[w] = (byWeek[w] || 0) + 1; });
  let streak = 0;
  let w = mondayOf(todayISO());
  if ((byWeek[w] || 0) >= 3) streak++;          // current week counts once it hits 3
  w = addDays(w, -7);
  while ((byWeek[w] || 0) >= 3) { streak++; w = addDays(w, -7); }
  return streak;
}
function exerciseNamesWithData() {
  const names = new Set();
  Object.values(state.logs).forEach(l => (l.ex || []).forEach(e => { if (e.weight !== '' && !isNaN(parseFloat(e.weight))) names.add(e.name); }));
  const arr = [...names];
  arr.sort((a, b) => {
    const ka = KEY_LIFTS.indexOf(a), kb = KEY_LIFTS.indexOf(b);
    if (ka !== -1 || kb !== -1) return (ka === -1 ? 99 : ka) - (kb === -1 ? 99 : kb);
    return a.localeCompare(b);
  });
  return arr;
}
function seriesFor(name) {
  const pts = [];
  Object.keys(state.logs).sort().forEach(d => {
    let best = null;
    (state.logs[d].ex || []).forEach(e => {
      if (e.name === name && e.weight !== '') {
        const w = parseFloat(e.weight);
        if (!isNaN(w) && (best === null || w > best)) best = w;
      }
    });
    if (best !== null) pts.push({ d, w: best });
  });
  return pts;
}
function chartSVG(pts) {
  const W = 320, H = 150, pl = 34, pr = 14, pt = 16, pb = 24;
  const iw = W - pl - pr, ih = H - pt - pb;
  let min = Math.min(...pts.map(p => p.w)), max = Math.max(...pts.map(p => p.w));
  if (min === max) { min -= 2.5; max += 2.5; }
  const pad = (max - min) * 0.15;
  min -= pad; max += pad;
  const X = i => pts.length === 1 ? pl + iw / 2 : pl + (i / (pts.length - 1)) * iw;
  const Y = w => pt + (1 - (w - min) / (max - min)) * ih;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'} ${X(i).toFixed(1)} ${Y(p.w).toFixed(1)}`).join(' ');
  const area = `${line} L ${X(pts.length - 1).toFixed(1)} ${pt + ih} L ${X(0).toFixed(1)} ${pt + ih} Z`;
  const dots = pts.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.w).toFixed(1)}" r="${i === pts.length - 1 ? 5 : 3.5}" fill="#fff" stroke="var(--rose)" stroke-width="${i === pts.length - 1 ? 3 : 2.5}"/>`).join('');
  const lastP = pts[pts.length - 1];
  return `
    <svg viewBox="0 0 ${W} ${H}">
      <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#d96d8c" stop-opacity=".30"/><stop offset="1" stop-color="#d96d8c" stop-opacity="0"/>
      </linearGradient></defs>
      <text x="${pl - 6}" y="${Y(max - pad) + 4}" text-anchor="end" font-size="10" font-weight="800" fill="#a47e90">${Math.round(max - pad)}</text>
      <text x="${pl - 6}" y="${Y(min + pad) + 4}" text-anchor="end" font-size="10" font-weight="800" fill="#a47e90">${Math.round(min + pad)}</text>
      <line x1="${pl}" y1="${pt + ih}" x2="${W - pr}" y2="${pt + ih}" stroke="#f3dde6" stroke-width="1.5"/>
      ${pts.length > 1 ? `<path d="${area}" fill="url(#cg)"/>` : ''}
      <path d="${line}" fill="none" stroke="var(--rose)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      <text x="${X(pts.length - 1).toFixed(1)}" y="${Y(lastP.w) - 10}" text-anchor="middle" font-size="11" font-weight="900" fill="#b14c6e">${lastP.w} kg</text>
      <text x="${X(0).toFixed(1)}" y="${H - 6}" text-anchor="${pts.length === 1 ? 'middle' : 'start'}" font-size="9.5" font-weight="800" fill="#a47e90">${shortDate(pts[0].d)}</text>
      ${pts.length > 1 ? `<text x="${X(pts.length - 1).toFixed(1)}" y="${H - 6}" text-anchor="end" font-size="9.5" font-weight="800" fill="#a47e90">${shortDate(lastP.d)}</text>` : ''}
    </svg>`;
}

function renderProgress() {
  const parts = [`<h1 class="tab-title">Progress<small>Watch the work add up 💪</small></h1>`];
  const sessions = trainedSessions();
  const today = todayISO();
  const wkStart = mondayOf(today);
  const thisWeek = sessions.filter(d => d >= wkStart).length;
  const thisMonth = sessions.filter(d => monthKey(d) === monthKey(today)).length;
  const streak = weeklyStreak(sessions);

  parts.push(`
    <div class="stat-grid">
      <div class="stat"><b>${thisWeek}<span style="font-size:13px;color:var(--muted)">/4</span></b><span>this week</span></div>
      <div class="stat"><b>${thisMonth}</b><span>this month</span></div>
      <div class="stat"><b>${streak}</b><span>week streak</span></div>
      <div class="stat"><b>${sessions.length}</b><span>total</span></div>
    </div>`);

  // strength chart
  const names = exerciseNamesWithData();
  if (!chartExercise || !names.includes(chartExercise)) chartExercise = names[0] || null;
  parts.push(`<div class="card"><h2>Strength curve<span class="sub">Heaviest weight logged per session</span></h2>`);
  if (names.length) {
    parts.push(`
      <select class="select" data-action="chart-ex">
        ${names.map(n => `<option ${n === chartExercise ? 'selected' : ''}>${esc(n)}</option>`).join('')}
      </select>
      <div class="chart-wrap">${chartSVG(seriesFor(chartExercise))}</div>`);
  } else {
    parts.push(`<div class="chart-empty">Log a weight on any exercise and the chart will bloom here 🌷</div>`);
  }
  parts.push(`</div>`);

  // personal bests
  const bests = {};
  Object.keys(state.logs).sort().forEach(d => (state.logs[d].ex || []).forEach(e => {
    const w = parseFloat(e.weight);
    if (e.weight === '' || isNaN(w)) return;
    if (!bests[e.name] || w > bests[e.name].w) bests[e.name] = { w, reps: e.reps, d };
  }));
  const bestRows = Object.keys(bests)
    .sort((a, b) => {
      const ka = KEY_LIFTS.indexOf(a), kb = KEY_LIFTS.indexOf(b);
      return (ka === -1 ? 99 : ka) - (kb === -1 ? 99 : kb) || bests[b].w - bests[a].w;
    }).slice(0, 6);
  if (bestRows.length) {
    parts.push(`
      <div class="card"><h2>Personal bests 🏆</h2>
        <div class="pr-grid">
          ${bestRows.map(n => `
            <div class="pr-row">
              <span class="medal">${KEY_LIFTS.includes(n) ? '💖' : '💪'}</span>
              <span class="n">${esc(n)}</span>
              <span><span class="v">${bests[n].w} kg${bests[n].reps ? ' × ' + esc(bests[n].reps) : ''}</span><br><span class="d">${esc(shortDate(bests[n].d))}</span></span>
            </div>`).join('')}
        </div>
      </div>`);
  }

  // share
  parts.push(`<button class="primary" data-action="share">💌 Share an update</button>`);

  // recent sessions
  const all = Object.keys(state.logs).filter(d => isMeaningful(state.logs[d])).sort().reverse().slice(0, 14);
  if (all.length) {
    parts.push(`<h2 style="font-family:var(--font-display);font-size:18px;margin:18px 2px 10px">Recent days</h2>`);
    all.forEach(d => {
      const l = state.logs[d];
      const ph = PHASES[l.week];
      const title = l.day === 'rest' ? 'Rest · Recovery' : `Day ${l.day} · ${DAY_TITLES[l.day]}`;
      const done = (l.ex || []).filter(e => e.done).length, total = (l.ex || []).length;
      const note = l.notes && l.notes.trim();
      parts.push(`
        <button class="sess" data-action="open-date" data-date="${d}">
          <div class="row1"><span class="date">${esc(shortDateW(d))}</span>${ph ? `<span class="pill pill-${ph.key}">${esc(ph.phase)}</span>` : ''}</div>
          <div class="title">${(l.mood === 0 || l.mood) ? MOODS[l.mood] + ' ' : ''}${esc(title)} ${l.completed ? '<span class="ok">✓</span>' : ''}</div>
          ${total ? `<div class="meta">${done}/${total} exercises${l.symptoms && l.symptoms.length ? ' · ' + esc(l.symptoms.join(', ')) : ''}</div>` : (l.symptoms && l.symptoms.length ? `<div class="meta">${esc(l.symptoms.join(', '))}</div>` : '')}
          ${note ? `<div class="note">“${esc(note.slice(0, 110))}${note.length > 110 ? '…' : ''}”</div>` : ''}
        </button>`);
    });
  } else {
    parts.push(`<div class="empty"><span class="big">🌷</span>Nothing logged yet.<br>Finished sessions, notes and check-ins will all show up here.</div>`);
  }

  $('#tab-progress').innerHTML = parts.join('');
}

function buildShareText() {
  const info = cycleInfo(todayISO());
  const sessions = trainedSessions();
  const wkStart = mondayOf(todayISO());
  const thisWeek = sessions.filter(d => d >= wkStart).length;
  const thisMonth = sessions.filter(d => monthKey(d) === monthKey(todayISO())).length;
  const lines = [`💪 ${state.name}'s SwoleSammy update`];
  if (info) lines.push(`Cycle: Day ${info.day} · Week ${info.week} ${PHASES[info.week].phase}`);
  lines.push(`This week: ${thisWeek}/4 sessions · This month: ${thisMonth}`);
  const bests = {};
  Object.keys(state.logs).sort().forEach(d => (state.logs[d].ex || []).forEach(e => {
    const w = parseFloat(e.weight);
    if (e.weight === '' || isNaN(w)) return;
    if (!bests[e.name] || w > bests[e.name].w) bests[e.name] = { w, reps: e.reps };
  }));
  const top = Object.keys(bests).filter(n => KEY_LIFTS.includes(n)).slice(0, 4);
  if (top.length) {
    lines.push('Bests:');
    top.forEach(n => lines.push(`• ${n} — ${bests[n].w} kg${bests[n].reps ? ' × ' + bests[n].reps : ''}`));
  }
  const last = Object.keys(state.logs).filter(d => isMeaningful(state.logs[d])).sort().pop();
  if (last) {
    const l = state.logs[last];
    lines.push(`Last logged: ${shortDateW(last)} — ${l.day === 'rest' ? 'Recovery' : 'Day ' + l.day + ' · ' + DAY_TITLES[l.day]}${l.completed ? ' ✓' : ''}`);
    if (l.notes && l.notes.trim()) lines.push(`“${l.notes.trim().slice(0, 120)}”`);
  }
  return lines.join('\n');
}

/* ===================== PLAN ===================== */
function schemeLabel(scheme) {
  if (typeof scheme !== 'object') return scheme;
  return [1, 2, 3, 4].map(w => `W${w} ${scheme[w]}`).join(' · ');
}
function renderProgram() {
  const parts = [`<h1 class="tab-title">The Plan<small>Sammy's Elite Program · cycle-based</small></h1>`];

  parts.push(`
    <div class="card"><h2>Training split</h2>
      <div class="split-bars">
        ${SPLIT.map(([l, p]) => `<div class="split-row"><div class="lbl"><span>${esc(l)}</span><span>${p}%</span></div><div class="bar"><i style="width:${p}%"></i></div></div>`).join('')}
      </div>
    </div>`);

  parts.push(`<div class="card"><h2>Weekly schedule</h2><div class="sched">${SCHEDULE_OVERVIEW.map(([d, t]) => `<div class="sched-row ${t.startsWith('Walk') ? 'rest-row' : ''}"><span class="sched-day">${d}</span><span>${esc(t)}</span></div>`).join('')}</div></div>`);

  // hormone structure
  parts.push(`<h2 style="font-family:var(--font-display);font-size:18px;margin:18px 2px 10px">Monthly hormone structure</h2>`);
  [1, 2, 3, 4].forEach(w => {
    const ph = PHASES[w];
    parts.push(`<div class="phase-head pill-${ph.key}">${ph.emoji} Week ${w} · ${esc(ph.phase)} <span>${esc(ph.sub)} — ${esc(ph.goal)} · ${esc(ph.intensity)}</span></div>`);
  });

  // training days
  parts.push(`<h2 style="font-family:var(--font-display);font-size:18px;margin:20px 2px 10px">Training days</h2>`);
  [1, 2, 3, 4].forEach(day => {
    const block = DAYS[day];
    parts.push(`<details class="card"><summary>Day ${day} · ${esc(DAY_TITLES[day])}</summary>`);
    parts.push(`<p class="hint">${esc(DAY_SUBTITLES[day])}${DAY_TAGLINES[day] ? ' — ' + esc(DAY_TAGLINES[day]) : ''}</p>`);
    if (block.warmup) parts.push(`<div class="section-label">Warm-up</div><ul class="warmup-list">${block.warmup.map(x => `<li>${esc(x)}</li>`).join('')}</ul><div class="section-label">Exercises</div>`);
    block.ex.forEach(e => {
      parts.push(`<div class="plan-ex"><span class="nm">${esc(e.name)}${e.note ? `<small>${esc(e.note)}</small>` : ''}</span><span class="sc">${esc(schemeLabel(e.scheme))}</span></div>`);
    });
    parts.push(`<div class="cardio">🚶‍♀️ ${esc(block.cardio)}</div></details>`);
  });

  // progression rules
  parts.push(`
    <div class="card"><h2>Progression 📈</h2>
      <p class="hint">Prioritise progression on:</p>
      <ol class="prio-list">${PROGRESSION.priority.map(p => `<li>${esc(p)}</li>`).join('')}</ol>
      <div class="tagline" style="margin-top:10px">${esc(PROGRESSION.rule)}</div>
    </div>`);

  // nutrition targets
  parts.push(`
    <div class="card"><h2>Daily targets<span class="sub">At ~60 kg</span></h2>
      <div class="target-grid">${TARGETS.map(t => `<div class="target"><span class="ic">${t.icon}</span><span><b>${esc(t.label)}</b><span>${esc(t.detail)}</span></span></div>`).join('')}</div>
    </div>`);

  // posture
  parts.push(`<div class="card"><h2>🧘 Daily posture work · 5 min</h2>${POSTURE.map(p => `<div class="plan-ex"><span class="nm">${esc(p[0])}</span><span class="sc">${esc(p[1])}</span></div>`).join('')}</div>`);

  // coach notes
  parts.push(`<div class="card note-card"><h2>Coach's notes 💌</h2><p>${esc(COACH_NOTES).replace(/\n\n/g, '</p><p>')}</p></div>`);

  $('#tab-program').innerHTML = parts.join('');
}

/* ===================== SETTINGS ===================== */
function renderSettings() {
  $('#tab-settings').innerHTML = `
    <h1 class="tab-title">Settings</h1>
    <div class="card">
      <h2>Your name</h2>
      <label class="field"><span>Shown on the home screen</span>
        <input type="text" class="select" value="${esc(state.name)}" data-action="set-name" placeholder="Name"></label>
    </div>
    <div class="card">
      <h2>Backup</h2>
      <p class="hint">Everything lives only on this device — no accounts, no cloud. Export a backup now and then (it also lets your favourite person peek at your progress 👀).</p>
      <button class="primary" data-action="export">⬇ Export backup</button>
      <label class="ghost-btn">⬆ Import backup<input type="file" accept="application/json" hidden data-action="import"></label>
      <button class="danger" data-action="reset">Reset everything</button>
    </div>
    <div class="footer-note">
      <b>SwoleSammy</b> 💪💕<br>
      <span class="love">Made with Love by your jaan(war)</span><br>
      Works offline · add it to your home screen
    </div>`;
}

/* ---------- hearts ---------- */
function burstHearts(el) {
  const r = el.getBoundingClientRect();
  const emojis = ['💖', '💪', '✨', '💕', '🌸'];
  for (let i = 0; i < 9; i++) {
    const h = document.createElement('span');
    h.className = 'heart-burst';
    h.textContent = emojis[i % emojis.length];
    h.style.left = (r.left + 14 + Math.random() * (r.width - 28)) + 'px';
    h.style.top = (r.top - 4) + 'px';
    h.style.setProperty('--rot', (Math.random() * 50 - 25) + 'deg');
    h.style.animationDelay = (Math.random() * .22) + 's';
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 1500);
  }
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;

  if (a === 'toggle-ex') { const i = +t.dataset.i; current.ex[i].done = !current.ex[i].done; commit(); renderToday(); }
  else if (a === 'toggle-cues') { t.closest('.ex-row').classList.toggle('show-cues'); }
  else if (a === 'toggle-posture') { const i = +t.dataset.i; current.posture[i] = !current.posture[i]; commit(); renderToday(); }
  else if (a === 'mood') { const i = +t.dataset.i; current.mood = current.mood === i ? null : i; commit(); renderToday(); }
  else if (a === 'symptom') { const s = t.dataset.s; const ix = current.symptoms.indexOf(s); ix === -1 ? current.symptoms.push(s) : current.symptoms.splice(ix, 1); commit(); renderToday(); }
  else if (a === 'habit') { const s = t.dataset.s; const ix = current.habits.indexOf(s); ix === -1 ? current.habits.push(s) : current.habits.splice(ix, 1); commit(); renderToday(); }
  else if (a === 'finish') {
    current.completed = !current.completed; commit();
    if (current.completed) burstHearts(t);
    renderToday();
  }
  else if (a === 'prev-day') { viewDate = addDays(viewDate, -1); render(); }
  else if (a === 'next-day') { viewDate = addDays(viewDate, 1); render(); }
  else if (a === 'goto-today') { viewDate = todayISO(); render(); }
  else if (a === 'open-date') { viewDate = t.dataset.date; activeTab = 'today'; render(); window.scrollTo(0, 0); }
  else if (a === 'goto-cycle') { activeTab = 'cycle'; render(); window.scrollTo(0, 0); }
  else if (a === 'quote-new') {
    fetchNetQuote().then(q => { currentQuote = q || randomQuote(); renderQuoteCard(); });
  }
  else if (a === 'period-start') {
    const lp = lastPeriod();
    if (lp && daysBetween(lp.start, todayISO()) < 10 && !confirm('Your last period started less than 10 days ago. Log a new one anyway?')) return;
    state.periods.push({ start: todayISO(), end: null });
    save(); render();
  }
  else if (a === 'period-end') {
    const lp = lastPeriod();
    if (lp && !lp.end) { lp.end = todayISO(); save(); render(); }
  }
  else if (a === 'undo-period') {
    if (confirm('Remove the most recent period entry?')) { state.periods.pop(); save(); render(); }
  }
  else if (a === 'cal-prev' || a === 'cal-next') {
    const [y, m] = calCursor.split('-').map(Number);
    const d = new Date(y, m - 1 + (a === 'cal-next' ? 1 : -1), 1);
    calCursor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    renderCycle();
  }
  else if (a === 'share') {
    const text = buildShareText();
    if (navigator.share) { navigator.share({ title: 'SwoleSammy update', text }).catch(() => {}); }
    else if (navigator.clipboard) { navigator.clipboard.writeText(text).then(() => alert('Update copied — paste it anywhere 💌')); }
    else { prompt('Copy your update:', text); }
  }
  else if (a === 'export') {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `swolesammy-backup-${todayISO()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  else if (a === 'reset') {
    if (confirm('Erase ALL data on this device? This cannot be undone.')) {
      state = defaultState(); save(); viewDate = todayISO(); render();
    }
  }
});

document.addEventListener('input', e => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;
  if (a === 'ex-field') { const i = +t.dataset.i; current.ex[i][t.dataset.field] = t.value; commit(); }
  else if (a === 'notes') { current.notes = t.value; commit(); }
  else if (a === 'set-name') { state.name = t.value || 'gorgeous'; save(); }
});

document.addEventListener('change', e => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;
  if (a === 'set-day') {
    const v = t.value === 'rest' ? 'rest' : +t.value;
    current = buildLog(viewDate, v);
    current.day = v;
    commit(); renderToday();
  }
  else if (a === 'set-start') {
    if (!t.value) return;
    const lp = lastPeriod();
    if (lp) lp.start = t.value; else state.periods.push({ start: t.value, end: null });
    state.periods.sort((x, y) => x.start < y.start ? -1 : 1);
    save(); render();
  }
  else if (a === 'set-end') {
    const lp = lastPeriod();
    if (lp && t.value && t.value >= lp.start) { lp.end = t.value; save(); render(); }
  }
  else if (a === 'set-week') {
    if (!t.value) return;
    const w = +t.value;
    const start = addDays(todayISO(), -(w - 1) * 7);
    const lp = lastPeriod();
    if (lp && !lp.end) lp.start = start;
    else state.periods.push({ start, end: null });
    state.periods.sort((x, y) => x.start < y.start ? -1 : 1);
    save(); render();
  }
  else if (a === 'chart-ex') { chartExercise = t.value; renderProgress(); }
  else if (a === 'import') {
    const file = t.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data && typeof data === 'object' && (data.logs || data.periods)) {
          state = Object.assign(defaultState(), data);
          state.periods = (state.periods || []).filter(x => x && x.start).sort((x, y) => x.start < y.start ? -1 : 1);
          save(); render();
          alert('Backup restored 🎉');
        } else alert("That file doesn't look like a SwoleSammy backup.");
      } catch (err) { alert('Could not read that file.'); }
    };
    reader.readAsText(file);
  }
});

document.querySelectorAll('.nav-btn').forEach(b => {
  b.addEventListener('click', () => { activeTab = b.dataset.tab; render(); window.scrollTo(0, 0); });
});

/* ---------- boot ---------- */
currentQuote = dailyQuote();
render();
fetchNetQuote().then(q => { if (q) { currentQuote = q; renderQuoteCard(); } });
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
