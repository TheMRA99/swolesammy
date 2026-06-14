/* ============================================================
   SWOLESAMMY — app logic (spec v2)
   Offline-first, single-user, data saved on this device.
   Psychology rules: process praise only · streaks never "break"
   (fresh starts, grace) · something always counts · kind copy only.
   ============================================================ */

const STORE_KEY = 'sammy-training-v1';

/* ---------- state ---------- */
const defaultState = () => ({
  v: 3,
  name: 'Sammy',
  theme: 'auto',            // 'light' | 'dark' | 'auto'
  periods: [],              // [{start, end|null}] sorted by start
  logs: {},                 // dateISO -> log
  pregnant: false,          // pauses all programming with a warm handover
  onboarded: false,         // first-session welcome shown
  unavailable: {},          // exercise name -> true (gym doesn't have it → auto-swap)
  customMessages: [],        // Muneer's own love notes, mixed into the rotation
  prompts: {},              // evolution prompt id -> {done:true} | {snooze:iso}
  phase1: false,            // volume bump accepted
  lastDeload: null,
  deloadUntil: null,
  gentleLast: 'B',          // so the first gentle pick is A
});

let state = load();
let viewDate = todayISO();
let activeTab = 'today';
let calCursor = monthKey(todayISO());
let chartExercise = null;
let currentQuote = null;

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const s = Object.assign(defaultState(), p);
      if (p.cycleStartDate && (!p.periods || !p.periods.length)) s.periods = [{ start: p.cycleStartDate, end: null }];
      delete s.cycleStartDate; delete s.quoteCache;
      s.periods = (s.periods || []).filter(x => x && x.start).sort((a, b) => a.start < b.start ? -1 : 1);
      s.v = 3;
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
function mondayOf(iso) { return addDays(iso, -((weekdayOf(iso) + 6) % 7)); }
function prettyDate(iso) { return fromISO(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }); }
function shortDate(iso) { return fromISO(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }
function shortDateW(iso) { return fromISO(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }); }
function monthName(iso) { return fromISO(iso + (iso.length === 7 ? '-01' : '')).toLocaleDateString(undefined, { month: 'long' }); }

/* ---------- cycle math (period-log anchored — never calendar-rotated) ---------- */
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
  // long cycle: after week 4 default back to normal programming (spec §4)
  let held = false;
  if (week > 4) { week = day > 35 ? 2 : 4; held = day > 35; }
  return { day, week, start: s, held };
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

/* ---------- names & schemes ---------- */
const normName = n => ALIASES[n] || n;
function parseScheme(s) {
  // '3×8–10' → {sets:3, low:8, top:10}; time/breath/distance schemes return top:null
  const m = String(s).match(/(\d+)\s*×\s*(\d+)(?:\s*[–-]\s*(\d+))?/);
  if (!m) return { sets: 1, low: null, top: null };
  const timed = /sec|min|breath|\bm\b/i.test(s);
  return { sets: +m[1], low: +m[2], top: timed ? null : +(m[3] || m[2]) };
}
function bumpSets(s) { return String(s).replace(/^(\d+)/, n => +n + 1); }
function dropSet(s) { return String(s).replace(/^(\d+)/, n => Math.max(1, +n - 1)); }

/* ---------- plan resolution ----------
   Sequence-based scheduling (spec §5): serve the next day in the
   D1→2→3→4 rotation based on the last completed session before `iso`.
   Never weekday-locked, nothing is ever "missed". */
function lastCompletedSession(beforeISO) {
  const dates = Object.keys(state.logs).filter(d => d < beforeISO).sort().reverse();
  for (const d of dates) {
    const l = state.logs[d];
    if (typeof l.day === 'number' && (l.completed || (l.ex && l.ex.some(e => e.done)))) return { day: l.day, date: d };
  }
  return null;
}
function scheduledDay(iso) {
  const last = lastCompletedSession(iso);
  return last ? (last.day % 4) + 1 : 1;
}
const DAY_TYPE_LABEL = {
  rest: 'Rest · Recovery', 'cycle-rest': 'Cycle rest 🌙', walk: 'Gentle walk',
  stretch: 'Cramp-Relief Stretch', 'gentle-A': 'Gentle Session A', 'gentle-B': 'Gentle Session B',
};
function dayLabel(day) { return typeof day === 'number' ? `Day ${day} · ${DAY_TITLES[day]}` : (DAY_TYPE_LABEL[day] || 'Rest'); }

function planFor(week, day, opts) {
  opts = opts || {};
  if (day === 'rest' || day === 'cycle-rest' || day === 'walk' || day === 'stretch') return { type: day };
  if (day === 'gentle-A' || day === 'gentle-B') {
    const g = GENTLE[day.slice(-1)];
    return { type: 'gentle', title: g.title, cardio: g.cardio, ex: g.ex.map(e => ({ ...e, scheme: e.scheme })) };
  }
  const block = DAYS[day];
  let ex = block.ex.map(e => ({ ...e, scheme: resolveScheme(e.scheme, week) }));
  // Day 4 chest rotation: odd weeks (1 & 3) → Incline DB Press, even weeks (2 & 4) → Dumbbell Chest Fly
  if (day === 4 && week % 2 === 0) ex = ex.map(e => e.name === 'Incline Dumbbell Press' ? { ...CHEST_FLY } : e);
  // auto-swap machines her gym doesn't have (Settings → My gym)
  ex = ex.map(e => {
    if (state.unavailable[e.name] && e.alts && e.alts.length) {
      const a = e.alts[0];
      return { name: a.name, scheme: a.scheme, rest: e.rest, cues: e.cues, note: a.note, tag: e.tag, swappedFrom: e.name };
    }
    return e;
  });
  if (state.phase1) {
    ex = ex.map((e, i) => i < 2 ? { ...e, scheme: bumpSets(e.scheme) } : e);
    if (day === 4) {
      const at = ex.findIndex(e => e.name === 'Face Pull');
      PHASE1_EXTRA_D4.forEach((extra, k) => {
        if (!ex.some(e => e.name === extra.name)) ex.splice(at === -1 ? ex.length : at + k, 0, { ...extra });
      });
    }
  }
  if (opts.lighter) ex = ex.map(e => ({ ...e, scheme: dropSet(e.scheme) }));
  return {
    type: 'workout', day,
    title: DAY_TITLES[day], hero: DAY_HERO[day], tagline: DAY_TAGLINES[day],
    warmup: block.warmup, burnout: day === 3 && (week === 2 || week === 3) ? block.burnout : null,
    cardio: week === 1 ? 'Gentle walk · 15 min 🌙' : block.cardio,
    ex,
  };
}
function exMeta(day, name) {
  let list = null;
  if (day === 'gentle-A' || day === 'gentle-B') list = GENTLE[day.slice(-1)].ex;
  else if (DAYS[day]) list = DAYS[day].ex.concat(PHASE1_EXTRA_D4, day === 4 ? [CHEST_FLY] : []);
  if (!list) return null;
  return list.find(e => e.name === name) || null;
}
// unique exercises with equipment alternatives (for the My gym toggles)
function swappableExercises() {
  const seen = {}, out = [];
  [1, 2, 3, 4].forEach(d => DAYS[d].ex.forEach(e => { if (e.alts && e.alts.length && !seen[e.name]) { seen[e.name] = 1; out.push(e); } }));
  return out;
}

/* ---------- logs ---------- */
function blankLog(iso, dayOverride) {
  const info = cycleInfo(iso);
  const week = info ? info.week : 2;
  const day = dayOverride !== undefined ? dayOverride : scheduledDay(iso);
  const plan = planFor(week, day);
  return {
    week, day,
    completed: false, notes: '', mood: null,
    symptoms: [], habits: [],
    posture: POSTURE_RESET.items.map(() => false),
    hips: HIP_ROUTINE.items.map(() => false),
    stretch: CRAMP_RELIEF.items.map(() => false),
    squat: SQUAT_RESET.items.map(() => false),
    ramp: {}, swaps: {}, lighter: false, chosen: false,
    cardioDone: false, cardioSkipped: false, offerDismissed: false,
    ex: plan.ex ? plan.ex.map(e => ({ name: e.name, scheme: e.scheme, done: false, weight: '', reps: '' })) : [],
  };
}
function applySwaps(fresh, swaps, day) {
  Object.keys(swaps || {}).forEach(orig => {
    const i = fresh.ex.findIndex(e => e.name === orig);
    const meta = exMeta(day, orig);
    const alt = meta && meta.alts && meta.alts.find(a => a.name === swaps[orig]);
    if (i !== -1 && alt) fresh.ex[i] = { name: alt.name, scheme: alt.scheme, done: false, weight: '', reps: '' };
  });
  fresh.swaps = Object.assign({}, swaps);
}
function buildLog(iso, dayOverride) {
  const saved = state.logs[iso];
  const day = dayOverride !== undefined ? dayOverride : (saved && saved.day !== undefined ? saved.day : scheduledDay(iso));
  const fresh = blankLog(iso, day);
  if (!saved) return fresh;
  ['notes', 'completed', 'mood', 'lighter', 'chosen', 'cardioDone', 'cardioSkipped', 'offerDismissed'].forEach(k => { if (saved[k] !== undefined) fresh[k] = saved[k]; });
  ['symptoms', 'habits'].forEach(k => { if (Array.isArray(saved[k])) fresh[k] = saved[k].slice(); });
  ['posture', 'hips', 'stretch', 'squat'].forEach(k => { if (Array.isArray(saved[k])) fresh[k] = fresh[k].map((v, i) => !!saved[k][i]); });
  fresh.ramp = Object.assign({}, saved.ramp || {});
  if (saved.day === day) {
    if (fresh.lighter) fresh.ex = blankLog(iso, day).ex.map((e, i) => e), applyLighter(fresh, iso, day);
    applySwaps(fresh, saved.swaps, day);
    if (Array.isArray(saved.ex)) {
      const byName = {};
      saved.ex.forEach(e => { byName[e.name] = e; });
      fresh.ex = fresh.ex.map(e => {
        const s = byName[e.name];
        return s ? { ...e, done: !!s.done, weight: s.weight || '', reps: s.reps || '' } : e;
      });
    }
  }
  return fresh;
}
function applyLighter(log, iso, day) {
  const info = cycleInfo(iso);
  const plan = planFor(info ? info.week : 2, day, { lighter: true });
  if (plan.ex) log.ex = plan.ex.map(e => ({ name: e.name, scheme: e.scheme, done: false, weight: '', reps: '' }));
}
function isMeaningful(log) {
  if (!log) return false;
  return !!(log.completed || log.chosen || log.lighter ||
    (log.swaps && Object.keys(log.swaps).length) ||
    (log.notes && log.notes.trim()) ||
    (log.mood === 0 || log.mood) ||
    (log.symptoms && log.symptoms.length) || (log.habits && log.habits.length) ||
    (log.posture && log.posture.some(Boolean)) || (log.hips && log.hips.some(Boolean)) ||
    (log.stretch && log.stretch.some(Boolean)) || (log.squat && log.squat.some(Boolean)) || log.cardioDone ||
    (log.ramp && Object.keys(log.ramp).some(k => (log.ramp[k] || []).some(Boolean))) ||
    (log.ex && log.ex.some(e => e.done || e.weight !== '' || e.reps !== '')));
}

let current = buildLog(viewDate);
function commit() {
  if (isMeaningful(current)) state.logs[viewDate] = current;
  else delete state.logs[viewDate];
  save();
}
function reloadCurrent() { current = buildLog(viewDate); }

/* ---------- performance scanning (alias-aware) ---------- */
function lastPerf(name, beforeISO) {
  const target = normName(name);
  const dates = Object.keys(state.logs).filter(d => d < beforeISO).sort().reverse();
  for (const d of dates) {
    const l = state.logs[d];
    if (!l.ex) continue;
    const e = l.ex.find(x => normName(x.name) === target && (x.weight !== '' || x.reps !== ''));
    if (e) return { date: d, weight: e.weight, reps: e.reps, done: !!e.done };
  }
  return null;
}
function ownedLastTime(name, scheme, beforeISO) {
  // spec §3: all reps comfortable at top of range → prompt +1–2 reps OR +2.5 kg
  const p = parseScheme(scheme);
  if (!p.top) return false;
  const last = lastPerf(name, beforeISO);
  return !!(last && last.done && parseInt(last.reps, 10) >= p.top);
}
function seriesFor(name) {
  const target = normName(name);
  const pts = [];
  Object.keys(state.logs).sort().forEach(d => {
    let best = null;
    (state.logs[d].ex || []).forEach(e => {
      if (normName(e.name) === target && e.weight !== '') {
        const w = parseFloat(e.weight);
        if (!isNaN(w) && (best === null || w > best)) best = w;
      }
    });
    if (best !== null) pts.push({ d, w: best });
  });
  return pts;
}
function allBests() {
  const bests = {};
  Object.keys(state.logs).sort().forEach(d => (state.logs[d].ex || []).forEach(e => {
    const w = parseFloat(e.weight);
    if (e.weight === '' || isNaN(w)) return;
    const n = normName(e.name);
    if (!bests[n] || w > bests[n].w) bests[n] = { w, reps: e.reps, d };
  }));
  return bests;
}
function recentNotes(excludeISO, n) {
  return Object.keys(state.logs)
    .filter(d => d !== excludeISO && state.logs[d].notes && state.logs[d].notes.trim())
    .sort().reverse().slice(0, n)
    .map(d => ({ date: d, text: state.logs[d].notes.trim() }));
}

/* ---------- sessions, streaks & grace ---------- */
function isSession(l) { return l && (typeof l.day === 'number' || String(l.day).startsWith('gentle')) && (l.completed || (l.ex && l.ex.some(e => e.done))); }
function isShowedUp(l) { return isMeaningful(l) && (l.completed || isSession(l) || ['cycle-rest', 'walk', 'stretch'].includes(l.day)); }
function sessionDates() { return Object.keys(state.logs).sort().filter(d => isSession(state.logs[d])); }
function weekCounts() {
  const byWeek = {};
  Object.keys(state.logs).forEach(d => {
    const w = mondayOf(d);
    byWeek[w] = byWeek[w] || { sessions: 0, showed: 0 };
    if (isSession(state.logs[d])) byWeek[w].sessions++;
    if (isShowedUp(state.logs[d])) byWeek[w].showed++;
  });
  return byWeek;
}
function weekCountsFor(monISO, byWeek) { return byWeek[monISO] || { sessions: 0, showed: 0 }; }
/* Rolling 7-day blocks (spec §5 — no fixed weekly slots).
   A block "counts" at 2+ sessions (minimum viable week)
   or 3+ showed-up days (grace: cycle rest / walk / stretch count). */
function blockQualifies(endISO) {
  const startISO = addDays(endISO, -6);
  let s = 0, sh = 0;
  Object.keys(state.logs).forEach(d => {
    if (d >= startISO && d <= endISO) {
      if (isSession(state.logs[d])) s++;
      if (isShowedUp(state.logs[d])) sh++;
    }
  });
  return s >= 2 || sh >= 3;
}
function weeklyStreak() {
  let streak = 0;
  let end = todayISO();
  if (blockQualifies(end)) streak++;          // current 7 days join once they qualify
  end = addDays(end, -7);
  while (blockQualifies(end)) { streak++; end = addDays(end, -7); }
  return streak;
}

/* ---------- evolution engine (spec §9) ---------- */
function promptState(id) { return state.prompts[id] || null; }
function promptAvailable(id) {
  const p = promptState(id);
  if (!p) return true;
  if (p.done) return false;
  if (p.snooze && p.snooze > todayISO()) return false;
  return true;
}
function weeksConsistent(nWeeks, minSessions) {
  const byWeek = weekCounts();
  let w = addDays(mondayOf(todayISO()), -7); // last complete week backwards
  for (let i = 0; i < nWeeks; i++) {
    if (weekCountsFor(w, byWeek).sessions < minSessions) return false;
    w = addDays(w, -7);
  }
  return true;
}
function plateauedLift() {
  // no new max on a key lift for 3+ weeks despite training it
  for (const lift of KEY_LIFTS) {
    if (!promptAvailable('plateau-' + lift)) continue;
    const pts = seriesFor(lift);
    if (pts.length < 4) continue;
    const span = daysBetween(pts[0].d, pts[pts.length - 1].d);
    if (span < 28) continue;
    const cut = addDays(todayISO(), -21);
    const recent = pts.filter(p => p.d >= cut);
    const before = pts.filter(p => p.d < cut);
    if (recent.length >= 2 && before.length >= 2 && Math.max(...recent.map(p => p.w)) <= Math.max(...before.map(p => p.w))) return lift;
  }
  return null;
}
function pickEvolutionPrompt() {
  if (viewDate !== todayISO() || state.pregnant) return null;
  const bests = allBests();
  const sessions = sessionDates();

  if (!state.phase1 && promptAvailable('volumeBump') && weeksConsistent(4, 3)) {
    return { id: 'volumeBump', emoji: '📈', title: 'Ready for a little more?', body: 'Four strong weeks in a row. Want to add one set to the first two lifts of each day (and bring Hammer Curls + Rope Pushdowns back)? One change, big payoff.', accept: 'Yes — level up', later: 'Not yet' };
  }
  if (promptAvailable('deload') && sessions.length >= 28 && (!state.lastDeload || daysBetween(state.lastDeload, todayISO()) > 63)) {
    return { id: 'deload', emoji: '🌿', title: 'Deload week?', body: 'You\'ve been training hard for a couple of months. One easy week — same exercises, about 40% lighter — and you come back stronger. Recovery is part of the program.', accept: 'Take the easy week', later: 'Maybe later' };
  }
  const pl = plateauedLift();
  if (pl) {
    return { id: 'plateau-' + pl, emoji: '🔁', title: `${pl} wants a change-up`, body: 'It\'s held steady for a few weeks — totally normal. Pick one: drop the weight ~10% and rebuild with slower reps, swap to the alternative exercise for 3 weeks, or double-check sleep + protein this week.', accept: 'Got it', later: 'Snooze' };
  }
  const checks = [
    ['hipthrust60', 'Hip Thrust Machine', 60, 10, '🏆', 'Bodyweight hip thrust!', '60 kg × 10 — pause reps (2-sec hold at the top) and single-leg hip thrusts are now unlocked as variations. New toys!'],
    ['pulldown40', 'Lat Pulldown', 40, 10, '🦅', 'Pull-up path unlocked', '40 kg × 10 on pulldowns — time to visit the assisted pull-up machine. Goal on the horizon: one full pull-up.'],
    ['rdl45', 'Romanian Deadlift', 45, 10, '👑', 'Hinge queen', '45 kg × 10 — barbell RDLs are an option now if you fancy them.'],
    ['bss8', 'Bulgarian Split Squat', 8, 8, '⚡', 'Steady and strong', '8 kg dumbbells in hand — the front-foot-elevated version is unlocked.'],
  ];
  for (const [id, lift, w, reps, emoji, title, body] of checks) {
    const b = bests[lift];
    if (promptAvailable(id) && b && b.w >= w && parseInt(b.reps || 0, 10) >= reps) {
      return { id, emoji, title, body, accept: 'Love it', later: null };
    }
  }
  // knee tucks → hanging progression
  const kt = lastPerf('Knee Tucks', addDays(todayISO(), 1));
  if (promptAvailable('kneetucks') && kt && parseInt(kt.reps || 0, 10) >= 15) {
    return { id: 'kneetucks', emoji: '🐒', title: 'Core level-up', body: 'Knee tucks are getting easy — hanging knee raises are unlocked when you want them. Same slow control, new view.', accept: 'Fun', later: null };
  }
  return null;
}

/* ---------- content rotation ---------- */
function phaseTier(week) { return week === 1 || week === 4 ? 'gentle' : (week === 2 || week === 3 ? 'hype' : 'any'); }
function allContent() {
  const custom = (state.customMessages || []).filter(t => t && t.trim()).map(t => ({ type: 'muneer', phase: 'any', text: t.trim(), signed: true }));
  return CONTENT.concat(custom);
}
function contentPool() {
  const info = cycleInfo(todayISO());
  const tier = info ? phaseTier(info.week) : 'any';
  return allContent().filter(c => c.phase === 'any' || c.phase === tier);
}
function hashStr(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function pickContent(seed) {
  const pool = contentPool();
  const types = Object.keys(CONTENT_WEIGHTS).filter(t => pool.some(c => c.type === t));
  const total = types.reduce((a, t) => a + CONTENT_WEIGHTS[t], 0);
  let r = seed % total;
  let type = types[0];
  for (const t of types) { r -= CONTENT_WEIGHTS[t]; if (r < 0) { type = t; break; } }
  const items = pool.filter(c => c.type === type);
  return items[Math.floor(seed / 7) % items.length];
}
function dailyContent() { return pickContent(hashStr(todayISO())); }
function randomContent() { return pickContent(Math.floor(Math.random() * 1e6)); }
function quoteCardHTML(q) {
  const fromHim = q.type === 'muneer' || q.type === 'pickup' || q.signed;
  const isPoem = q.type.startsWith('poem');
  return `
    <div class="quote ${fromHim ? 'from-him' : ''} ${isPoem ? 'poem' : ''}" id="quote-card">
      <div class="mark">${fromHim ? '💌' : '“'}</div>
      <div class="q-text">
        <p>${esc(q.text)}</p>
        ${fromHim ? '<span class="sig">— Jaan(War) 🐯</span>' : ''}
      </div>
      <button class="q-new" data-action="quote-new" aria-label="Another one"><svg><use href="#i-refresh"/></svg></button>
    </div>`;
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
/* Ramp-up sets (spec §3): 1–2 lighter feel sets before the big lifts.
   Idiot-proof rendering: compute real kg from today's typed weight,
   falling back to her last logged weight; round to 2.5 kg plates. */
function rampWeights(e, last) {
  const base = parseFloat(e.weight) || (last && parseFloat(last.weight)) || null;
  if (!base) return null;
  const round = w => Math.max(2.5, Math.round(w / 2.5) * 2.5);
  return [round(base * 0.5), round(base * 0.75)];
}
function rampLabelText(r, rw) {
  const reps = r === 0 ? '6 easy reps' : '5 smooth reps';
  const frac = r === 0 ? 'half' : 'about ¾';
  return `Warm-up set ${r + 1} · ${rw ? '≈' + rw[r] + ' kg' : frac + ' of your working weight'} × ${reps}`;
}
function exRowHTML(e, i, day) {
  const meta = exMeta(day, e.name) || exMeta(day, Object.keys(current.swaps).find(k => current.swaps[k] === e.name) || '');
  const origName = Object.keys(current.swaps).find(k => current.swaps[k] === e.name);
  const baseMeta = origName ? exMeta(day, origName) : meta;
  const isDist = !!(meta && meta.dist);
  const last = lastPerf(e.name, viewDate);
  const lastTxt = last ? `Last: ${last.weight ? esc(last.weight) + ' kg' : ''}${last.weight && last.reps ? ' × ' : ''}${last.reps ? esc(last.reps) + (isDist ? ' m' : '') : ''} · ${esc(shortDate(last.date))}` : '';
  const owned = ownedLastTime(e.name, e.scheme, viewDate) && !(meta && meta.tag === 'core');
  const hasCues = meta && (meta.cues || meta.note || meta.rest || meta.avoid);
  const hasAlts = baseMeta && baseMeta.alts && baseMeta.alts.length;
  const rw = (meta && meta.ramp) ? rampWeights(e, last) : null;
  const rampRows = (meta && meta.ramp) ? [0, 1].map(r => {
    const on = (current.ramp[e.name] || [])[r];
    return `
      <div class="ramp-row ${on ? 'done' : ''}">
        <button class="check mini-check" data-action="toggle-ramp" data-name="${esc(e.name)}" data-i="${r}">${on ? '✓' : ''}</button>
        <span class="ramp-label" data-r="${r}">${esc(rampLabelText(r, rw))}</span>
      </div>`;
  }).join('') + `<div class="ramp-note">These two don't count — they just switch the muscle on. Your real sets start below 👇</div>` : '';
  return `
    <div class="ex-row ${e.done ? 'done' : ''}">
      ${rampRows}
      <div class="top">
        <button class="check" data-action="toggle-ex" data-i="${i}" aria-label="Done">${e.done ? '✓' : ''}</button>
        <div class="ex-main" ${hasCues ? `data-action="toggle-cues"` : ''}>
          <div class="ex-name">${esc(e.name)}${hasCues ? ' <span class="info-dot">ⓘ</span>' : ''}</div>
          <div class="ex-scheme">${esc(e.scheme)}${meta && meta.rest ? ` · rest ${esc(meta.rest)}` : ''}</div>
          ${lastTxt ? `<div class="ex-last">${lastTxt}</div>` : ''}
          ${owned ? `<div class="nudge">🔥 Owned last time — add 1–2 reps <b>or</b> 2.5 kg. One, not both.</div>` : ''}
        </div>
        <div class="ex-inputs">
          <input class="mini" inputmode="decimal" placeholder="${last && last.weight ? esc(last.weight) : 'kg'}" value="${esc(e.weight)}" data-action="ex-field" data-field="weight" data-i="${i}">
          <input class="mini" inputmode="text" placeholder="${isDist ? 'm' : 'reps'}" value="${esc(e.reps)}" data-action="ex-field" data-field="reps" data-i="${i}">
        </div>
        ${hasAlts ? `<button class="swap-btn" data-action="toggle-swaps" aria-label="Swap exercise">⇄</button>` : ''}
      </div>
      ${hasCues ? `
      <div class="ex-cues">
        ${meta.note ? `${esc(meta.note)}<br>` : ''}
        ${meta.cues ? `<b>Form</b><ul>${meta.cues.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
        ${meta.avoid ? `<span class="avoid">☝️ ${esc(meta.avoid)}</span>` : ''}
      </div>` : ''}
      ${hasAlts ? `
      <div class="ex-swaps">
        <b>Machine busy? Swap to:</b>
        ${baseMeta.alts.map(a => `<button class="chip-toggle ${e.name === a.name ? 'on' : ''}" data-action="swap-pick" data-orig="${esc(origName || e.name)}" data-alt="${esc(a.name)}">${esc(a.name)} · ${esc(a.scheme)}</button>`).join('')}
        ${origName ? `<button class="chip-toggle" data-action="swap-pick" data-orig="${esc(origName)}" data-alt="">↩ back to ${esc(origName)}</button>` : ''}
      </div>` : ''}
    </div>`;
}

function tickListHTML(items, stateArr, action) {
  return items.map((p, i) => `
    <div class="ex-row small ${stateArr[i] ? 'done' : ''}">
      <div class="top">
        <button class="check" data-action="${action}" data-i="${i}" aria-label="Done">${stateArr[i] ? '✓' : ''}</button>
        <div class="ex-main">
          <div class="ex-name">${esc(p.name)}</div>
          <div class="ex-scheme">${esc(p.scheme)}</div>
          ${p.hint ? `<div class="ex-last">${esc(p.hint)}</div>` : ''}
        </div>
      </div>
    </div>`).join('');
}

function renderToday() {
  reloadCurrent();
  const isToday = viewDate === todayISO();
  const info = cycleInfo(viewDate);
  const week = current.week;
  const day = current.day;
  const phase = info ? PHASES[week] : null;
  const L = Math.max(avgCycleLen(), info ? info.day : 0);
  const onPeriod = inPeriod(viewDate);
  const parts = [];

  // hero
  const chip = info ? `
      <button class="cycle-chip" data-action="goto-cycle">
        <div class="emo">${phase.emoji}</div>
        <div class="t">
          <b>Week ${week} · ${esc(phase.phase)}${info.held ? ' · long cycle, normal training' : ''}</b>
          <span>Cycle day ${info.day} · ${esc(phase.goal)}</span>
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
      <div class="marquee" aria-hidden="true"><span>${'swolesammy · strongest girl I know · est. 2026 · always showing up · '.repeat(4)}</span></div>
    </div>`);

  // pregnancy guard (spec §8): pause all programming with a warm handover
  if (state.pregnant) {
    parts.push(`
      <div class="card offer-card" style="text-align:center">
        <span style="font-size:40px">🤍</span>
        <h2 style="margin-top:8px">A new chapter</h2>
        <p class="hint">This chapter needs a real-life professional — talk to your doctor about training, and we'll be right here after 💛</p>
        <p class="hint">Everything you've built is saved and waiting. Gentle walks and rest are always yours.</p>
      </div>`);
    $('#tab-today').innerHTML = parts.join('');
    return;
  }

  // quote / message
  if (!currentQuote) currentQuote = dailyContent();
  parts.push(quoteCardHTML(currentQuote));

  // first-session welcome (one-time, skippable)
  if (isToday && !state.onboarded) {
    parts.push(`
      <div class="card offer-card onboard">
        <h2>Welcome, gorgeous 💪💕</h2>
        <p class="hint">Three tiny things, then you\'re off:</p>
        <ul class="onboard-list">
          <li><b>Leave 2–3 in the tank.</b> Pick a weight you could lift 2–3 more times with pretty form. Form first, always.</li>
          <li><b>Tap the circle</b> to tick a set, and type your weight + reps — the app remembers everything for next time.</li>
          <li><b>Warm-ups & cardio track separately</b> — no numbers needed there.</li>
          <li><b>Week 1 is for learning.</b> Go lighter than feels necessary. You\'ll build fast, promise. 🤍</li>
        </ul>
        <button class="primary" data-action="onboard-done">Let\'s go 💪</button>
      </div>`);
  }

  // date strip
  parts.push(`
    <div class="datestrip">
      <button class="ds-arrow" data-action="prev-day" aria-label="Previous day">‹</button>
      <button class="ds-mid" data-action="goto-today">${isToday ? 'Today' : `${esc(shortDateW(viewDate))} · <span class="back">back to today</span>`}</button>
      <button class="ds-arrow" data-action="next-day" aria-label="Next day">›</button>
    </div>`);

  // ---- proactive cards (max a couple, all kind) ----
  // period day 1–2: rest is the right call (spec §7)
  if (info && info.day <= 2 && onPeriod && day !== 'cycle-rest' && isToday) {
    parts.push(`
      <div class="card offer-card">
        <h2>🌙 Day ${info.day} is the hardest</h2>
        <p class="hint">Rest today — you've earned it. Heat on the belly or back, water nearby, regular meals, early night. That IS the program today.</p>
        <button class="primary" data-action="cycle-rest">Take a cycle rest 🌙 — counts fully</button>
      </div>`);
    if (promptAvailable('painInfo')) {
      parts.push(`<div class="phase-note"><span>💛</span><span>If period pain regularly flattens you, that's common — and very treatable. Worth mentioning to your doctor sometime, no rush. <button class="link-btn" data-action="prompt-accept" data-id="painInfo">ok 💛</button></span></div>`);
    }
  }
  // welcome back after a break (≥14 days) — zero guilt
  const allLogged = Object.keys(state.logs).filter(d => isMeaningful(state.logs[d])).sort();
  const lastLogged = allLogged[allLogged.length - 1];
  if (isToday && lastLogged && daysBetween(lastLogged, todayISO()) >= 14) {
    parts.push(`
      <div class="card offer-card">
        <h2>Welcome back 💛</h2>
        <p class="hint">Fresh start, zero guilt. Go about 20% lighter than your old numbers this week and next — strength comes back fast, and it comes back happier.</p>
      </div>`);
  }
  // evolution engine prompt (one at a time, her choice always)
  const prompt = isToday ? pickEvolutionPrompt() : null;
  if (prompt) {
    parts.push(`
      <div class="card offer-card">
        <h2>${prompt.emoji} ${esc(prompt.title)}</h2>
        <p class="hint">${esc(prompt.body)}</p>
        <button class="primary" data-action="prompt-accept" data-id="${prompt.id}">${esc(prompt.accept)}</button>
        ${prompt.later ? `<button class="ghost-btn" data-action="prompt-later" data-id="${prompt.id}">${esc(prompt.later)}</button>` : ''}
      </div>`);
  }

  // phase note
  if (phase) parts.push(`<div class="phase-note"><span>${phase.emoji}</span><span><b>${esc(phase.goal)}.</b> ${esc(phase.note)}</span></div>`);
  // deload banner
  if (state.deloadUntil && viewDate <= state.deloadUntil) {
    parts.push(`<div class="phase-note"><span>🌿</span><span><b>Deload week.</b> Everything about 40% lighter, smooth and easy. You come back stronger — that's the whole trick.</span></div>`);
  }
  // DOMS onboarding (first ~2 weeks of training)
  const sCount = sessionDates().length;
  if (isToday && sCount >= 1 && sCount <= 6 && typeof day === 'number') {
    parts.push(`<div class="phase-note"><span>🫶</span><span><b>New-muscle soreness is normal</b> — it peaks a day or two after and fades. Mildly sore: train, movement helps. Can't-sit-down sore: extra rest day + a little lighter next time.</span></div>`);
  }
  // one-time gear tip on press day (kind, never body-framed)
  if (isToday && day === 4 && promptAvailable('braTip')) {
    parts.push(`<div class="phase-note"><span>🎀</span><span><b>Gear tip.</b> A good supportive sports bra is part of the kit for press days — comfy is strong. <button class="link-btn" data-action="prompt-accept" data-id="braTip">got it 💗</button></span></div>`);
  }

  // ---- Period Week Movement Menu (spec §7) ----
  if (week === 1 && onPeriod) {
    const nextGentle = state.gentleLast === 'A' ? 'B' : 'A';
    const tiers = [
      ['stretch', '🌙', 'In pain', 'Cramp-relief stretch · 8 min'],
      ['walk', '🚶‍♀️', 'Low but restless', 'Gentle walk · 15–30 min'],
      ['gentle-' + nextGentle, '🌤', 'Okay-ish', 'Gentle session ' + nextGentle],
      [String(scheduledDay(viewDate)), '💪', 'Actually fine', 'Normal session, gentle volume'],
    ];
    parts.push(`
      <div class="card">
        <h2>How are you feeling today?<span class="sub">Every option counts as showing up — no tier is better than another 💗</span></h2>
        <div class="tier-grid">
          ${tiers.map(([v, emo, t, s]) => `
            <button class="tier ${String(day) === v ? 'on' : ''}" data-action="menu-pick" data-day="${v}">
              <span class="emo">${emo}</span><b>${t}</b><span>${s}</span>
            </button>`).join('')}
        </div>
      </div>`);
  } else {
    // session selector
    parts.push(`
      <div class="session-pick">
        <label>Session</label>
        <select data-action="set-day" class="select">
          ${[1, 2, 3, 4].map(d => `<option value="${d}" ${day === d ? 'selected' : ''}>Day ${d} · ${DAY_TITLES[d]}</option>`).join('')}
          <option value="gentle-A" ${day === 'gentle-A' ? 'selected' : ''}>Gentle Session A · short & sweet</option>
          <option value="gentle-B" ${day === 'gentle-B' ? 'selected' : ''}>Gentle Session B · short & sweet</option>
          <option value="walk" ${day === 'walk' ? 'selected' : ''}>Gentle walk</option>
          <option value="rest" ${day === 'rest' ? 'selected' : ''}>Rest · Recovery</option>
        </select>
      </div>`);
  }

  // spacing nudge (spec §5): soft note when leg days stack — never blocks
  if (typeof day === 'number' && (day === 1 || day === 3)) {
    const prev = state.logs[addDays(viewDate, -1)];
    if (prev && typeof prev.day === 'number' && (prev.day === 1 || prev.day === 3) && (prev.completed || (prev.ex || []).some(e => e.done))) {
      parts.push(`<div class="phase-note"><span>🌶️</span><span>Back-to-back leg days are spicy — Day 2 instead? Your legs, your call. <button class="link-btn" data-action="menu-pick" data-day="2">Switch to Day 2</button></span></div>`);
    }
  }

  // adaptive offer (check-ins DO something — spec §11)
  const rough = (current.mood !== null && current.mood <= 1) || current.symptoms.some(s => ['Cramps', 'Headache', 'Low energy'].includes(s));
  if (typeof day === 'number' && rough && !current.lighter && !current.offerDismissed && week !== 1) {
    parts.push(`
      <div class="card offer-card" id="adaptive-offer">
        <h2>Want today a little lighter? 💗</h2>
        <p class="hint">Rough days still count. Pick whatever feels kind:</p>
        <button class="primary" data-action="lighter">Same workout, one set less everywhere</button>
        <button class="ghost-btn" data-action="offer-gentle">Switch to a gentle session</button>
        <button class="link-btn" data-action="offer-no">I'm okay — full session 💪</button>
      </div>`);
  }
  if (typeof day === 'number' && week === 3 && current.symptoms.includes('Energized')) {
    parts.push(`<div class="overload" id="power-nudge">☀️ Strongest week + feeling energized? Today's a lovely day to try +2.5 kg on your first lift.</div>`);
  }

  // ---- render the day ----
  const plan = planFor(week, day, { lighter: current.lighter });

  if (plan.type === 'rest') {
    parts.push(`
      <div class="card rest-card">
        <h2>🌿 ${REST_DAY.title}</h2>
        <ul class="rest-list">${REST_DAY.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
        <p class="hint" style="margin-top:10px">Smallest win available: one stretch from the Posture Reset below — 60 seconds, still counts. 💗</p>
      </div>`);
  } else if (plan.type === 'cycle-rest') {
    parts.push(`
      <div class="card rest-card">
        <h2>🌙 Cycle rest — a completed day</h2>
        <p class="hint">Resting on the hard days is the strong move. This day counts, fully.</p>
        <ul class="rest-list">
          <li>Heat pad or a warm shower 🫶</li>
          <li>Water + regular meals (they genuinely help the headaches)</li>
          <li>10–15 min gentle walk — only if it sounds nice</li>
          <li>Early night, queen 👑</li>
        </ul>
      </div>`);
  } else if (plan.type === 'walk') {
    parts.push(`
      <div class="card rest-card">
        <h2>🚶‍♀️ Gentle walk</h2>
        <p class="hint">15–30 minutes, easy pace, outside if the sky cooperates. Movement + daylight = mood magic.</p>
      </div>`);
  } else if (plan.type === 'stretch') {
    parts.push(`
      <div class="card">
        <h2>🌙 ${CRAMP_RELIEF.title}<span class="sub">${esc(CRAMP_RELIEF.tip)}</span></h2>
        <div class="ex-list">${tickListHTML(CRAMP_RELIEF.items, current.stretch, 'toggle-stretch')}</div>
      </div>`);
  } else {
    // gentle or full workout
    if (plan.type === 'workout') {
      parts.push(`
        <div class="day-hero">
          <div class="micro">${esc(plan.hero.micro)}${current.lighter ? ' · LIGHTER 💗' : ''}</div>
          <div class="big">${esc(plan.hero.big)}<span>${esc(plan.hero.small)}</span></div>
          <div class="statement">${plan.tagline}</div>
        </div>`);
      if (plan.warmup) {
        parts.push(`
          <details class="card warmup-card">
            <summary>🔥 Warm-up · 5 min</summary>
            <ul class="warmup-list">${plan.warmup.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
          </details>`);
      }
    } else {
      parts.push(`<div class="day-hero"><div class="micro">SHORT & SWEET</div><div class="big">GENTLE<span>DAY</span></div><div class="statement">Showing up softly still counts as <b>showing up</b>.</div></div>`);
    }

    parts.push(`<div class="card"><h2>${esc(plan.title || dayLabel(day))}</h2>`);
    if (!state.phase1 && plan.type === 'workout') parts.push(`<div class="rir-hint">${esc(RIR_HINT)}</div>`);
    parts.push(`<div class="ex-list">`);
    current.ex.forEach((e, i) => parts.push(exRowHTML(e, i, day)));
    parts.push(`</div>`);

    // cardio — part of the session, tickable; skipping is logged kindly, never blocks
    if (plan.cardio) {
      parts.push(`
        <div class="ex-row cardio-row ${current.cardioDone ? 'done' : ''}">
          <div class="top">
            <button class="check" data-action="toggle-cardio" aria-label="Cardio done">${current.cardioDone ? '✓' : ''}</button>
            <div class="ex-main"><div class="ex-name">🚶‍♀️ Cardio finisher</div><div class="ex-scheme">${esc(plan.cardio)}</div></div>
          </div>
        </div>`);
    }
    if (plan.burnout) {
      parts.push(`
        <details class="burnout">
          <summary>✨ ${esc(plan.burnout.title)}</summary>
          <p class="hint">${esc(plan.burnout.note)}</p>
          <ul class="warmup-list">${plan.burnout.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        </details>`);
    }
    parts.push(`</div>`);
  }

  // check-in
  const showVacuumChip = !onPeriod;
  parts.push(`
    <div class="card">
      <h2>How are you feeling?</h2>
      <div class="mood-row">
        ${MOODS.map((m, i) => `<button class="mood-btn ${current.mood === i ? 'on' : ''}" data-action="mood" data-i="${i}">${m}<span>${MOOD_LABELS[i]}</span></button>`).join('')}
      </div>
      <div class="section-label">Symptoms</div>
      <div class="chips">${SYMPTOMS.map(s => `<button class="chip-toggle ${current.symptoms.includes(s) ? 'on' : ''}" data-action="symptom" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <div class="section-label">Daily targets</div>
      <div class="chips">${TARGETS.filter(t => showVacuumChip || !t.skipOnPeriod).map(t => `<button class="chip-toggle habit ${current.habits.includes(t.label) ? 'on' : ''}" data-action="habit" data-s="${esc(t.label)}" title="${esc(t.detail)}">${t.icon} ${esc(t.label)}</button>`).join('')}</div>
      ${!showVacuumChip ? '<p class="hint" style="margin-top:8px">Vacuum breathing takes the week off during your period 🌙</p>' : ''}
    </div>`);

  // notes + memory
  const prev = recentNotes(viewDate, 3);
  parts.push(`
    <div class="card">
      <h2>📝 Notes<span class="sub">Crowded gym? Swapped something? Write it here — future you reads these.</span></h2>
      <textarea class="notes" rows="4" placeholder="e.g. Hip thrust machine taken → did dumbbell hip thrusts on a bench, 3×12 with 30 kg…" data-action="notes">${esc(current.notes)}</textarea>
      ${prev.length ? `
      <details class="prev-notes">
        <summary>Remember what you did — recent notes ↓</summary>
        ${prev.map(p => `<div class="prev-note"><b>${esc(shortDateW(p.date))}</b>${esc(p.text)}</div>`).join('')}
      </details>` : ''}
    </div>`);

  // daily mini-routines
  const isGymDay = typeof day === 'number' && (day === 1 || day === 3);
  parts.push(`
    <details class="card" ${current.hips.some(Boolean) ? 'open' : ''}>
      <summary>🦩 ${HIP_ROUTINE.title}</summary>
      <p class="hint">${esc(HIP_ROUTINE.sub)}.${isGymDay ? ' ' + esc(HIP_ROUTINE.gymNote) : ''}</p>
      <div class="ex-list">${tickListHTML(HIP_ROUTINE.items, current.hips, 'toggle-hips')}</div>
    </details>`);
  parts.push(`
    <details class="card" ${current.squat.some(Boolean) ? 'open' : ''}>
      <summary>🐸 ${SQUAT_RESET.title}</summary>
      <p class="hint">${esc(SQUAT_RESET.sub)}.</p>
      <div class="ex-list">${tickListHTML(SQUAT_RESET.items, current.squat, 'toggle-squat')}</div>
      <p class="hint" style="margin-top:10px">${esc(SQUAT_RESET.safety)}</p>
    </details>`);
  parts.push(`
    <details class="card" ${current.posture.some(Boolean) ? 'open' : ''}>
      <summary>🧘 ${POSTURE_RESET.title}</summary>
      <p class="hint">${esc(POSTURE_RESET.sub)}.</p>
      <div class="ex-list">${tickListHTML(POSTURE_RESET.items, current.posture, 'toggle-posture')}</div>
      <p class="hint" style="margin-top:10px">${esc(POSTURE_RESET.safety)}</p>
    </details>`);

  // finish
  if (plan.type !== 'rest' && plan.type !== 'cycle-rest') {
    parts.push(`<button class="finish ${current.completed ? 'is-done' : ''}" data-action="finish">${current.completed ? '✓ Done — that\'s discipline, and it looks good on you' : 'Finish session 💪'}</button>`);
    if (current.cardioSkipped && current.completed) parts.push(`<p class="hint" style="text-align:center">Cardio logged as skipped today — zero stress, steps still count. 🚶‍♀️</p>`);
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
      <circle cx="${cx}" cy="${cy}" r="${r}" class="ring-track" stroke-width="15" fill="none"/>
      ${arcs}
      <circle cx="${mx.toFixed(2)}" cy="${my.toFixed(2)}" r="9" class="ring-marker" stroke-width="4"/>
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
        <p class="hint">Log day 1 of your period and the app matches training to your month — gentle when it should be, strong when you are. Long or irregular cycles are handled gracefully, always.</p>
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
            <div class="ph">${phase.emoji} ${esc(phase.phase)}${info.held ? '' : ' · W' + info.week}</div>
          </div>
        </div>
        ${next && dleft >= 0 ? `<div class="next-period">Next period expected around <b>${esc(shortDateW(next))}</b> · in ${dleft} day${dleft === 1 ? '' : 's'}</div>` : ''}
        ${next && dleft < 0 ? `<div class="next-period">Cycles wander sometimes — all good. Log day 1 whenever it arrives. 💗</div>` : ''}
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
  const monthTitle = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
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
        <b>${esc(monthTitle)}</b>
        <div class="cal-nav">
          <button data-action="cal-prev" aria-label="Previous month">‹</button>
          <button data-action="cal-next" aria-label="Next month">›</button>
        </div>
      </div>
      <div class="cal-grid">${cells}</div>
      <div class="legend">
        <span><i style="background:var(--rose)"></i>Period</span>
        <span><i class="legend-pred"></i>Expected</span>
        <span><i style="background:var(--p-follicular)"></i>Logged day</span>
      </div>
    </div>`);

  // history + adjust
  if (state.periods.length) {
    const rows = state.periods.slice(-6).reverse().map((p, idx) => {
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
  const dots = pts.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.w).toFixed(1)}" r="${i === pts.length - 1 ? 5 : 3.5}" class="ch-dot" stroke-width="${i === pts.length - 1 ? 3 : 2.5}"/>`).join('');
  const lastP = pts[pts.length - 1];
  return `
    <svg viewBox="0 0 ${W} ${H}">
      <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#d96d8c" stop-opacity=".30"/><stop offset="1" stop-color="#d96d8c" stop-opacity="0"/>
      </linearGradient></defs>
      <text x="${pl - 6}" y="${Y(max - pad) + 4}" text-anchor="end" class="ch-label">${Math.round(max - pad)}</text>
      <text x="${pl - 6}" y="${Y(min + pad) + 4}" text-anchor="end" class="ch-label">${Math.round(min + pad)}</text>
      <line x1="${pl}" y1="${pt + ih}" x2="${W - pr}" y2="${pt + ih}" class="ch-base" stroke-width="1.5"/>
      ${pts.length > 1 ? `<path d="${area}" fill="url(#cg)"/>` : ''}
      <path d="${line}" fill="none" class="ch-line" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      <text x="${X(pts.length - 1).toFixed(1)}" y="${Y(lastP.w) - 10}" text-anchor="middle" class="ch-big">${lastP.w} kg</text>
      <text x="${X(0).toFixed(1)}" y="${H - 6}" text-anchor="${pts.length === 1 ? 'middle' : 'start'}" class="ch-label">${shortDate(pts[0].d)}</text>
      ${pts.length > 1 ? `<text x="${X(pts.length - 1).toFixed(1)}" y="${H - 6}" text-anchor="end" class="ch-label">${shortDate(lastP.d)}</text>` : ''}
    </svg>`;
}

/* Progress told in words — never photos (spec feature 18) */
function narratives() {
  const out = [];
  KEY_LIFTS.forEach(lift => {
    const pts = seriesFor(lift);
    if (pts.length >= 2) {
      const first = pts[0], last = pts[pts.length - 1];
      if (last.w > first.w) {
        const weeks = Math.max(1, Math.round(daysBetween(first.d, last.d) / 7));
        out.push({ gain: (last.w - first.w) / first.w, text: `In ${monthName(monthKey(first.d))}, ${first.w} kg on the ${lift.toLowerCase()} felt like work. This week: ${last.w} kg. That's not luck — that's ${weeks} week${weeks === 1 ? '' : 's'} of showing up.` });
      }
    }
  });
  return out.sort((a, b) => b.gain - a.gain);
}
function monthlyLetter(mk) {
  const dates = Object.keys(state.logs).filter(d => monthKey(d) === mk && isMeaningful(state.logs[d])).sort();
  if (!dates.length) return null;
  const sessions = dates.filter(d => isSession(state.logs[d])).length;
  const showed = dates.filter(d => isShowedUp(state.logs[d])).length;
  const moods = dates.map(d => state.logs[d].mood).filter(m => m === 0 || m);
  const avgMood = moods.length ? MOODS[Math.round(moods.reduce((a, b) => a + b, 0) / moods.length)] : null;
  const habitCount = dates.reduce((a, d) => a + (state.logs[d].habits || []).length, 0);
  const lines = [`Dear ${state.name},`,
    `${monthName(mk)}: you showed up ${showed} day${showed === 1 ? '' : 's'} and trained ${sessions} session${sessions === 1 ? '' : 's'}. That's not a fluke — that's who you're becoming.`];
  if (habitCount >= 10) lines.push(`${habitCount} little daily targets ticked. The quiet stuff is the real program, and you did the quiet stuff.`);
  if (avgMood) lines.push(`Average mood: ${avgMood} — and you trained anyway on the days it wasn't.`);
  lines.push('Keep going. Softly, weekly, kindly. — your app (and your biggest fan) 💌');
  return lines.join('\n\n');
}
function moodByPhase() {
  const sums = { 1: [0, 0], 2: [0, 0], 3: [0, 0], 4: [0, 0] };
  Object.keys(state.logs).forEach(d => {
    const l = state.logs[d];
    if (l.mood === null || l.mood === undefined) return;
    const info = cycleInfo(d);
    if (!info) return;
    sums[info.week][0] += l.mood; sums[info.week][1]++;
  });
  return [1, 2, 3, 4].map(w => sums[w][1] ? { w, emoji: MOODS[Math.round(sums[w][0] / sums[w][1])], n: sums[w][1] } : { w, emoji: '·', n: 0 });
}
function headachePattern() {
  const days = [];
  Object.keys(state.logs).forEach(d => {
    if ((state.logs[d].symptoms || []).includes('Headache')) {
      const info = cycleInfo(d);
      if (info) days.push(info.day);
    }
  });
  if (days.length < 3) return null;
  return Math.round(days.reduce((a, b) => a + b, 0) / days.length);
}

function renderProgress() {
  const parts = [`<h1 class="tab-title">Progress<small>Told in words and numbers you chose — never comparisons</small></h1>`];
  const sessions = sessionDates();
  const today = todayISO();
  const last7 = sessions.filter(d => d >= addDays(today, -6)).length;
  const thisMonth = sessions.filter(d => monthKey(d) === monthKey(today)).length;
  const streak = weeklyStreak();
  const weekTier = last7 >= 3 ? 'great week 🌟' : last7 >= 2 ? 'week made ✓' : last7 === 1 ? 'on the board' : 'fresh page';

  parts.push(`
    <div class="stat-grid">
      <div class="stat"><b>${last7}</b><span>${weekTier}</span></div>
      <div class="stat"><b>${thisMonth}</b><span>this month</span></div>
      <div class="stat"><b>${streak || '💛'}</b><span>${streak ? 'week streak' : 'fresh start'}</span></div>
      <div class="stat"><b>${sessions.length}</b><span>sessions ever</span></div>
    </div>`);

  // progress in words
  const stories = narratives();
  const lastMk = monthKey(addDays(today, -28));
  const letter = monthlyLetter(lastMk) || monthlyLetter(monthKey(today));
  if (stories.length || letter) {
    parts.push(`<div class="card words-card"><h2>Your story so far 💗</h2>`);
    if (stories.length) parts.push(`<p class="story">${esc(stories[0].text)}</p>`);
    if (stories.length > 1) {
      parts.push(`<details class="prev-notes"><summary>More chapters ↓</summary>${stories.slice(1, 4).map(s => `<div class="prev-note">${esc(s.text)}</div>`).join('')}</details>`);
    }
    if (letter) parts.push(`<details class="prev-notes"><summary>📮 This month's letter</summary><div class="prev-note letter">${esc(letter)}</div></details>`);
    parts.push(`</div>`);
  }

  // strength chart
  const names = (() => {
    const set = new Set();
    Object.values(state.logs).forEach(l => (l.ex || []).forEach(e => { if (e.weight !== '' && !isNaN(parseFloat(e.weight))) set.add(normName(e.name)); }));
    const arr = [...set];
    arr.sort((a, b) => {
      const ka = KEY_LIFTS.indexOf(a), kb = KEY_LIFTS.indexOf(b);
      if (ka !== -1 || kb !== -1) return (ka === -1 ? 99 : ka) - (kb === -1 ? 99 : kb);
      return a.localeCompare(b);
    });
    return arr;
  })();
  if (!chartExercise || !names.includes(chartExercise)) chartExercise = names[0] || null;
  parts.push(`<div class="card"><h2>Strength curve<span class="sub">Heaviest weight logged per session</span></h2>`);
  if (names.length) {
    parts.push(`
      <select class="select" data-action="chart-ex">
        ${names.map(n => `<option ${n === chartExercise ? 'selected' : ''}>${esc(n)}</option>`).join('')}
      </select>
      <div class="chart-wrap">${chartSVG(seriesFor(chartExercise))}</div>`);
  } else {
    parts.push(`<div class="chart-empty">Log a weight on any exercise and the chart blooms here 🌷</div>`);
  }
  parts.push(`</div>`);

  // hall of fame (milestones)
  const bests = allBests();
  const shortLift = n => n.replace(' Machine', '');
  parts.push(`<div class="card"><h2>Hall of Fame 🏆<span class="sub">Measured against one person only: past you</span></h2><div class="fame-grid">`);
  MILESTONES.forEach((m, i) => {
    const b = bests[m.name];
    const cur = b ? b.w : 0;
    const hit = b && b.w >= m.target && parseInt(b.reps || 0, 10) >= (m.reps || 0);
    const pct = Math.min(100, Math.round(cur / m.target * 100));
    parts.push(hit ? `
      <button class="fame hit" data-action="fame-flip">
        <div class="ff-front"><span class="medal">🏆</span><b>${esc(m.label)}</b><span>${esc(shortLift(m.name))}</span></div>
        <div class="ff-back"><b>${esc(m.label)}</b><span>${esc(m.story)}</span><span class="d">${b ? esc(shortDate(b.d)) : ''}</span></div>
      </button>` : `
      <div class="fame">
        <div class="ff-front">
          <b>${esc(m.label)}</b><span>${esc(shortLift(m.name))} · ${m.target} kg${m.reps ? ' × ' + m.reps : ''}</span>
          <div class="bar"><i style="width:${pct}%"></i></div>
          <span class="d">${cur ? cur + ' kg so far' : 'waiting for you'}</span>
        </div>
      </div>`);
  });
  parts.push(`</div></div>`);

  // personal bests
  const bestRows = Object.keys(bests).sort((a, b) => {
    const ka = KEY_LIFTS.indexOf(a), kb = KEY_LIFTS.indexOf(b);
    return (ka === -1 ? 99 : ka) - (kb === -1 ? 99 : kb) || bests[b].w - bests[a].w;
  }).slice(0, 6);
  if (bestRows.length) {
    parts.push(`
      <div class="card"><h2>Personal bests</h2>
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

  // patterns (check-ins doing something)
  const mbp = moodByPhase();
  const hd = headachePattern();
  if (mbp.some(x => x.n) || hd) {
    parts.push(`<div class="card"><h2>Your patterns 🔍</h2>`);
    if (mbp.some(x => x.n)) {
      parts.push(`<div class="section-label">Mood by cycle week</div><div class="mood-phase">${mbp.map(x => `<div class="mp"><span>${x.emoji}</span><b>W${x.w}</b></div>`).join('')}</div>`);
    }
    if (hd) parts.push(`<p class="hint" style="margin-top:10px">Headaches tend to visit you around cycle day ${hd}. The app gives you a heads-up when it's close — water and regular meals genuinely help. 💛</p>`);
    parts.push(`</div>`);
  }

  parts.push(`<button class="primary" data-action="share">💌 Share an update</button>`);

  // recent days
  const all = Object.keys(state.logs).filter(d => isMeaningful(state.logs[d])).sort().reverse().slice(0, 14);
  if (all.length) {
    parts.push(`<h2 class="sect-head">Recent days</h2>`);
    all.forEach(d => {
      const l = state.logs[d];
      const ph = l.week ? PHASES[l.week] : null;
      const title = dayLabel(l.day);
      const done = (l.ex || []).filter(e => e.done).length, total = (l.ex || []).length;
      const note = l.notes && l.notes.trim();
      parts.push(`
        <button class="sess" data-action="open-date" data-date="${d}">
          <div class="row1"><span class="date">${esc(shortDateW(d))}</span>${ph ? `<span class="pill pill-${ph.key}">${esc(ph.phase)}</span>` : ''}</div>
          <div class="title">${(l.mood === 0 || l.mood) ? MOODS[l.mood] + ' ' : ''}${esc(title)} ${l.completed ? '<span class="ok">✓</span>' : ''}</div>
          ${total ? `<div class="meta">${done}/${total} exercises${l.cardioDone ? ' · cardio ✓' : ''}${l.symptoms && l.symptoms.length ? ' · ' + esc(l.symptoms.join(', ')) : ''}</div>` : (l.symptoms && l.symptoms.length ? `<div class="meta">${esc(l.symptoms.join(', '))}</div>` : '')}
          ${note ? `<div class="note">“${esc(note.slice(0, 110))}${note.length > 110 ? '…' : ''}”</div>` : ''}
        </button>`);
    });
  } else {
    parts.push(`<div class="empty"><span class="big">🌷</span>Nothing logged yet.<br>Finished sessions, notes and check-ins will all show up here.</div>`);
  }

  parts.push(`<div class="statement-footer">Always showing up.</div>`);
  $('#tab-progress').innerHTML = parts.join('');
}

function buildShareText() {
  const info = cycleInfo(todayISO());
  const sessions = sessionDates();
  const last7 = sessions.filter(d => d >= addDays(todayISO(), -6)).length;
  const thisMonth = sessions.filter(d => monthKey(d) === monthKey(todayISO())).length;
  const lines = [`💪 ${state.name}'s SwoleSammy update`];
  if (info) lines.push(`Cycle: Day ${info.day} · Week ${info.week} ${PHASES[info.week].phase}`);
  lines.push(`Last 7 days: ${last7} session${last7 === 1 ? '' : 's'} · This month: ${thisMonth}`);
  const bests = allBests();
  const top = Object.keys(bests).filter(n => KEY_LIFTS.includes(n)).slice(0, 4);
  if (top.length) {
    lines.push('Bests:');
    top.forEach(n => lines.push(`• ${n} — ${bests[n].w} kg${bests[n].reps ? ' × ' + bests[n].reps : ''}`));
  }
  const moods = Object.keys(state.logs).filter(d => monthKey(d) === monthKey(todayISO())).map(d => state.logs[d].mood).filter(m => m === 0 || m);
  if (moods.length) lines.push(`Mood this month: ${MOODS[Math.round(moods.reduce((a, b) => a + b, 0) / moods.length)]}`);
  const story = narratives()[0];
  if (story) lines.push(story.text);
  const last = Object.keys(state.logs).filter(d => isMeaningful(state.logs[d])).sort().pop();
  if (last) {
    const l = state.logs[last];
    lines.push(`Last logged: ${shortDateW(last)} — ${dayLabel(l.day)}${l.completed ? ' ✓' : ''}`);
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
  const parts = [`<h1 class="tab-title">The Plan<small>Your program · built around your month</small></h1>`];

  parts.push(`
    <div class="card"><h2>Training split</h2>
      <div class="split-bars">
        ${SPLIT.map(([l, p]) => `<div class="split-row"><div class="lbl"><span>${esc(l)}</span><span>${p}%</span></div><div class="bar"><i style="width:${p}%"></i></div></div>`).join('')}
      </div>
      <p class="hint" style="margin-top:12px">Busy week? <b>Two sessions (one lower + one upper) is a complete week.</b> Celebrate it.</p>
    </div>`);

  parts.push(`
    <div class="card"><h2>The rotation<span class="sub">No fixed weekdays — life happens on its own schedule</span></h2>
      <div class="rota">
        ${[1, 2, 3, 4].map(d => `<div class="rota-step"><b>Day ${d}</b><span>${esc(DAY_TITLES[d])}</span></div>`).join('<div class="rota-arrow">→</div>')}
        <div class="rota-arrow">↻</div>
      </div>
      <p class="hint" style="margin-top:12px">Whenever you open the app, it simply queues up <b>whatever comes next</b> and waits for you — nothing is ever missed. Aim for <b>4 sessions every 7–9 days</b>, rest whenever life asks, and give the two leg days a little breathing room (the app nudges if they stack).</p>
      <div class="tagline" style="margin-top:10px">🌙 Rest days are part of the plan, not time off from it — muscle is built while you recover. Two or three across the rotation is perfect.</div>
    </div>`);

  // hormone structure
  parts.push(`<h2 class="sect-head">Your month, structured</h2>`);
  [1, 2, 3, 4].forEach(w => {
    const ph = PHASES[w];
    parts.push(`<div class="phase-head pill-${ph.key}">${ph.emoji} Week ${w} · ${esc(ph.phase)} <span>${esc(ph.sub)} — ${esc(ph.goal)}</span></div>`);
  });

  // training days
  parts.push(`<h2 class="sect-head">Training days</h2>`);
  [1, 2, 3, 4].forEach(day => {
    const block = DAYS[day];
    parts.push(`<details class="card"><summary>Day ${day} · ${esc(DAY_TITLES[day])}</summary>`);
    parts.push(`<div class="statement" style="margin:4px 0 12px">${DAY_TAGLINES[day]}</div>`);
    parts.push(`<div class="section-label">Warm-up</div><ul class="warmup-list">${block.warmup.map(x => `<li>${esc(x)}</li>`).join('')}</ul><div class="section-label">Exercises</div>`);
    block.ex.forEach(e => {
      parts.push(`<div class="plan-ex"><span class="nm">${esc(e.name)}${e.note ? `<small>${esc(e.note)}</small>` : ''}${e.ramp ? `<small>starts with 2 light warm-up sets (≈half, then ≈¾ of your weight)</small>` : ''}${e.alts ? `<small>⇄ swaps: ${e.alts.map(a => esc(a.name)).join(', ')}</small>` : ''}</span><span class="sc">${esc(schemeLabel(e.scheme))}</span></div>`);
    });
    if (block.burnout) parts.push(`<div class="section-label">${esc(block.burnout.title)}</div><ul class="warmup-list">${block.burnout.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
    parts.push(`<div class="cardio">🚶‍♀️ ${esc(block.cardio)} — part of the session (week 1 swaps to a gentle walk)</div></details>`);
  });

  // gentle sessions
  parts.push(`
    <details class="card"><summary>🌙 Gentle sessions A & B</summary>
      <p class="hint">For period week or any rough day — short, sweet, and they count fully.</p>
      ${['A', 'B'].map(k => `<div class="section-label">Gentle ${k}</div>${GENTLE[k].ex.map(e => `<div class="plan-ex"><span class="nm">${esc(e.name)}</span><span class="sc">${esc(e.scheme)}</span></div>`).join('')}<div class="plan-ex"><span class="nm">Walk</span><span class="sc">15 min</span></div>`).join('')}
    </details>`);

  // progression
  parts.push(`
    <div class="card"><h2>Progression 📈</h2>
      <p class="hint">${esc(PROGRESSION_RULE)}</p>
      <div class="tagline">${esc(RIR_HINT)}</div>
      <p class="hint" style="margin-top:10px">The app watches your logs and offers the next step when you're ready — extra sets, new variations, deload weeks. One change at a time, always your choice.</p>
    </div>`);

  // nutrition
  parts.push(`<h2 class="sect-head">Fuel 🍳</h2>`);
  [NUTRITION.calories, NUTRITION.principles, NUTRITION.meals, NUTRITION.supplements].forEach(sec => {
    parts.push(`<div class="card"><h2>${esc(sec.title)}</h2><ul class="nut-list">${sec.lines.map(l => `<li>${l}</li>`).join('')}</ul></div>`);
  });

  // daily targets
  parts.push(`
    <div class="card"><h2>Daily targets</h2>
      <div class="target-grid">${TARGETS.filter(t => !t.skipOnPeriod || true).map(t => `<div class="target"><span class="ic">${t.icon}</span><span><b>${esc(t.label)}</b><span>${esc(t.detail)}</span></span></div>`).join('')}</div>
    </div>`);

  // timeline
  parts.push(`
    <div class="card"><h2>What to expect 🗺️</h2>
      ${TIMELINE.map(([t, d]) => `<div class="plan-ex"><span class="nm">${esc(t)}</span><span class="sc" style="white-space:normal;text-align:right">${esc(d)}</span></div>`).join('')}
    </div>`);

  // routines
  const routineRows = items => items.map(p => `
    <div class="plan-ex">
      <span class="nm">${esc(p.name)}${p.hint ? `<small>${esc(p.hint)}</small>` : ''}</span>
      <span class="sc">${esc(p.scheme)}</span>
    </div>`).join('');
  parts.push(`
    <div class="card"><h2>🦩 ${esc(HIP_ROUTINE.title)}</h2><p class="hint">${esc(HIP_ROUTINE.sub)}.</p>
      ${routineRows(HIP_ROUTINE.items)}
    </div>
    <div class="card"><h2>🐸 ${esc(SQUAT_RESET.title)}</h2><p class="hint">${esc(SQUAT_RESET.sub)}.</p>
      ${routineRows(SQUAT_RESET.items)}
    </div>
    <div class="card"><h2>🧘 ${esc(POSTURE_RESET.title)}</h2><p class="hint">${esc(POSTURE_RESET.sub)}.</p>
      ${routineRows(POSTURE_RESET.items)}
    </div>`);

  // coach notes + his note
  parts.push(`<div class="card note-card"><h2>Coach's notes</h2><p>${esc(COACH_NOTES).replace(/\n\n/g, '</p><p>')}</p></div>`);
  parts.push(`<div class="card love-card"><div class="mark">💌</div><p>${esc(LOVE_NOTE)}</p><span class="sig">— Jaan(War) 🐯</span></div>`);

  $('#tab-program').innerHTML = parts.join('');
}

/* ===================== SETTINGS ===================== */
function renderSettings() {
  $('#tab-settings').innerHTML = `
    <h1 class="tab-title">Settings</h1>
    <div class="card">
      <h2>Theme</h2>
      <div class="theme-row">
        ${['light', 'dark', 'auto'].map(t => `<button class="chip-toggle ${state.theme === t ? 'on' : ''}" data-action="theme" data-v="${t}">${t === 'light' ? '☀️ Light' : t === 'dark' ? '🌙 Dark' : '✨ Auto'}</button>`).join('')}
      </div>
    </div>
    <div class="card">
      <h2>My gym 🏋️<span class="sub">Got this machine? Tap No and the app swaps in a no-equipment move everywhere.</span></h2>
      ${swappableExercises().map(e => `
        <div class="gym-row">
          <div class="gym-name"><b>${esc(e.name)}</b>${state.unavailable[e.name] ? `<span>using ${esc(e.alts[0].name)} instead</span>` : ''}</div>
          <button class="switch ${state.unavailable[e.name] ? 'off' : 'on'}" data-action="toggle-equip" data-name="${esc(e.name)}">${state.unavailable[e.name] ? 'No' : 'Yes'}</button>
        </div>`).join('')}
    </div>
    <div class="card">
      <h2>Love notes 💌<span class="sub">Add your own — they mix into her daily messages, signed Jaan(War).</span></h2>
      <textarea class="notes" id="muneer-input" rows="2" placeholder="Write something cringey and sweet…"></textarea>
      <button class="primary" data-action="add-message">Add to the rotation 💌</button>
      ${(state.customMessages || []).map((m, i) => `<div class="msg-row"><span>${esc(m)}</span><button class="msg-x" data-action="del-message" data-i="${i}" aria-label="Remove">×</button></div>`).join('')}
    </div>
    <div class="card">
      <h2>Life updates</h2>
      ${state.pregnant
        ? `<p class="hint">Training is paused 🤍 Everything you've built is saved and waiting.</p>
           <button class="primary green" data-action="pregnant-off">We're back — resume training 💛</button>`
        : `<p class="hint">Expecting? The app steps back and hands training over to your doctor — everything here waits patiently for you.</p>
           <button class="ghost-btn" data-action="pregnant-on">I'm pregnant 🤍</button>`}
    </div>
    <div class="card">
      <h2>Backup</h2>
      <p class="hint">Everything lives only on this device — no accounts, no cloud. Export a backup now and then.</p>
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

/* ---------- rest timer ---------- */
let restInterval = null;
function startRest(sec) {
  clearInterval(restInterval);
  let left = sec;
  let pill = $('#rest-pill');
  if (!pill) {
    pill = document.createElement('button');
    pill.id = 'rest-pill';
    pill.addEventListener('click', () => { clearInterval(restInterval); pill.remove(); });
    document.body.appendChild(pill);
  }
  const tick = () => {
    if (left <= 0) { clearInterval(restInterval); pill.textContent = 'Go when ready 💪'; setTimeout(() => pill.remove(), 2500); return; }
    pill.textContent = `Rest · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} — tap to skip`;
    left--;
  };
  tick();
  restInterval = setInterval(tick, 1000);
}

/* ---------- reveal check-in consequences ----------
   Mood/symptom taps can spawn an offer card higher up the page —
   scroll to it so the options are never missed. */
function revealOffer() {
  const rough = (current.mood !== null && current.mood <= 1) || current.symptoms.some(s => ['Cramps', 'Headache', 'Low energy'].includes(s));
  let el = document.querySelector('#adaptive-offer') || document.querySelector('#power-nudge');
  if (!el && rough) el = document.querySelector('.tier-grid'); // period week: her options ARE the menu
  if (!el) return;
  const card = el.closest('.card') || el;
  card.classList.add('attn');
  // smooth needs animation frames — fall back to instant when hidden or reduced-motion
  const smoothOK = !document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  card.scrollIntoView({ behavior: smoothOK ? 'smooth' : 'auto', block: 'center' });
  setTimeout(() => card.classList.remove('attn'), 1700);
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

/* ---------- theme ---------- */
const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const resolved = state.theme === 'auto' ? (darkMedia.matches ? 'dark' : 'light') : state.theme;
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#241a21' : '#fdf3f6');
}
darkMedia.addEventListener('change', () => { if (state.theme === 'auto') applyTheme(); });

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;

  if (a === 'toggle-ex') {
    const i = +t.dataset.i;
    current.ex[i].done = !current.ex[i].done;
    commit();
    if (current.ex[i].done) {
      const meta = exMeta(current.day, current.ex[i].name);
      const rest = meta && meta.rest ? parseInt(meta.rest, 10) : 60;
      if (rest) startRest(rest);
    }
    renderToday();
  }
  else if (a === 'toggle-ramp') {
    const n = t.dataset.name, i = +t.dataset.i;
    current.ramp[n] = current.ramp[n] || [false, false];
    current.ramp[n][i] = !current.ramp[n][i];
    commit(); renderToday();
  }
  else if (a === 'toggle-cardio') { current.cardioDone = !current.cardioDone; if (current.cardioDone) current.cardioSkipped = false; commit(); renderToday(); }
  else if (a === 'toggle-cues') { t.closest('.ex-row').classList.toggle('show-cues'); }
  else if (a === 'toggle-swaps') { t.closest('.ex-row').classList.toggle('show-swaps'); }
  else if (a === 'swap-pick') {
    const orig = t.dataset.orig, alt = t.dataset.alt;
    if (alt) current.swaps[orig] = alt; else delete current.swaps[orig];
    const rebuilt = blankLog(viewDate, current.day);
    applySwaps(rebuilt, current.swaps, current.day);
    // keep ticked values for unchanged rows
    const byName = {}; current.ex.forEach(x => { byName[x.name] = x; });
    rebuilt.ex = rebuilt.ex.map(x => byName[x.name] ? { ...x, ...byName[x.name] } : x);
    ['notes', 'completed', 'mood', 'lighter', 'chosen', 'cardioDone', 'cardioSkipped', 'offerDismissed'].forEach(k => rebuilt[k] = current[k]);
    ['symptoms', 'habits', 'posture', 'hips', 'stretch'].forEach(k => rebuilt[k] = current[k]);
    rebuilt.ramp = current.ramp;
    current = rebuilt; commit(); renderToday();
  }
  else if (a === 'toggle-posture') { const i = +t.dataset.i; current.posture[i] = !current.posture[i]; commit(); renderToday(); }
  else if (a === 'toggle-hips') { const i = +t.dataset.i; current.hips[i] = !current.hips[i]; commit(); renderToday(); }
  else if (a === 'toggle-squat') { const i = +t.dataset.i; current.squat[i] = !current.squat[i]; commit(); renderToday(); }
  else if (a === 'toggle-stretch') { const i = +t.dataset.i; current.stretch[i] = !current.stretch[i]; commit(); renderToday(); }
  else if (a === 'mood') { const i = +t.dataset.i; current.mood = current.mood === i ? null : i; commit(); renderToday(); revealOffer(); }
  else if (a === 'symptom') { const s = t.dataset.s; const ix = current.symptoms.indexOf(s); ix === -1 ? current.symptoms.push(s) : current.symptoms.splice(ix, 1); commit(); renderToday(); revealOffer(); }
  else if (a === 'habit') { const s = t.dataset.s; const ix = current.habits.indexOf(s); ix === -1 ? current.habits.push(s) : current.habits.splice(ix, 1); commit(); renderToday(); }
  else if (a === 'lighter') { current.lighter = true; applyLighter(current, viewDate, current.day); commit(); renderToday(); }
  else if (a === 'offer-gentle') { const g = 'gentle-' + (state.gentleLast === 'A' ? 'B' : 'A'); state.gentleLast = g.slice(-1); current = buildLog(viewDate, g); current.day = g; current.chosen = true; commit(); save(); renderToday(); }
  else if (a === 'offer-no') { current.offerDismissed = true; commit(); renderToday(); }
  else if (a === 'menu-pick') {
    let v = t.dataset.day;
    if (/^\d$/.test(v)) v = +v;
    if (String(v).startsWith('gentle')) state.gentleLast = String(v).slice(-1);
    current = buildLog(viewDate, v); current.day = v; current.chosen = true; commit(); save(); renderToday();
  }
  else if (a === 'cycle-rest') { current = buildLog(viewDate, 'cycle-rest'); current.day = 'cycle-rest'; current.completed = true; current.chosen = true; commit(); renderToday(); }
  else if (a === 'prompt-accept') {
    const id = t.dataset.id;
    state.prompts[id] = { done: true };
    if (id === 'volumeBump') state.phase1 = true;
    if (id === 'deload') { state.deloadUntil = addDays(todayISO(), 7); state.lastDeload = todayISO(); }
    if (id.startsWith('plateau-')) state.prompts[id] = { snooze: addDays(todayISO(), 42) };
    save(); render();
  }
  else if (a === 'prompt-later') { state.prompts[t.dataset.id] = { snooze: addDays(todayISO(), 14) }; save(); render(); }
  else if (a === 'fame-flip') { t.classList.toggle('flipped'); }
  else if (a === 'finish') {
    current.completed = !current.completed;
    if (current.completed && !current.cardioDone) current.cardioSkipped = true;
    commit();
    if (current.completed) burstHearts(t);
    renderToday();
  }
  else if (a === 'prev-day') { viewDate = addDays(viewDate, -1); render(); }
  else if (a === 'next-day') { viewDate = addDays(viewDate, 1); render(); }
  else if (a === 'goto-today') { viewDate = todayISO(); render(); }
  else if (a === 'open-date') { viewDate = t.dataset.date; activeTab = 'today'; render(); window.scrollTo(0, 0); }
  else if (a === 'goto-cycle') { activeTab = 'cycle'; render(); window.scrollTo(0, 0); }
  else if (a === 'quote-new') { currentQuote = randomContent(); const card = $('#quote-card'); if (card) card.outerHTML = quoteCardHTML(currentQuote); }
  else if (a === 'theme') { state.theme = t.dataset.v; save(); applyTheme(); renderSettings(); }
  else if (a === 'pregnant-on') {
    if (confirm('Pause training programming? All your history stays safe, and you can resume anytime.')) { state.pregnant = true; save(); render(); }
  }
  else if (a === 'pregnant-off') { state.pregnant = false; save(); render(); }
  else if (a === 'onboard-done') { state.onboarded = true; save(); renderToday(); }
  else if (a === 'toggle-equip') { const n = t.dataset.name; if (state.unavailable[n]) delete state.unavailable[n]; else state.unavailable[n] = true; save(); renderSettings(); }
  else if (a === 'add-message') {
    const inp = document.querySelector('#muneer-input');
    const v = inp && inp.value.trim();
    if (v) { state.customMessages = (state.customMessages || []).concat(v); save(); renderSettings(); }
  }
  else if (a === 'del-message') { state.customMessages.splice(+t.dataset.i, 1); save(); renderSettings(); }
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
      state = defaultState(); save(); viewDate = todayISO(); applyTheme(); render();
    }
  }
});

document.addEventListener('input', e => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;
  if (a === 'ex-field') {
    const i = +t.dataset.i;
    current.ex[i][t.dataset.field] = t.value;
    commit();
    // keep the warm-up set suggestions in sync with the weight she types
    if (t.dataset.field === 'weight') {
      const row = t.closest('.ex-row');
      const labels = row ? row.querySelectorAll('.ramp-label') : [];
      if (labels.length) {
        const e2 = current.ex[i];
        const rw = rampWeights(e2, lastPerf(e2.name, viewDate));
        labels.forEach(el => { el.textContent = rampLabelText(+el.dataset.r, rw); });
      }
    }
  }
  else if (a === 'notes') { current.notes = t.value; commit(); }
});

document.addEventListener('change', e => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;
  if (a === 'set-day') {
    let v = t.value;
    if (/^\d$/.test(v)) v = +v;
    if (String(v).startsWith('gentle')) state.gentleLast = String(v).slice(-1);
    current = buildLog(viewDate, v);
    current.day = v;
    current.chosen = true;
    commit(); save(); renderToday();
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
          save(); applyTheme(); render();
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
applyTheme();
currentQuote = dailyContent();
render();
const splash = $('#splash');
if (splash) { splash.classList.add('bye'); setTimeout(() => splash.remove(), 600); }
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
