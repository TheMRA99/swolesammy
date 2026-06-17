/* ============================================================
   SWOLESAMMY — Sammy's program (data) · spec v2, beginner volume
   Single source of truth: sammy-workout-program-spec.md
   KINDNESS RULE: user-facing strings describe what a thing BUILDS,
   never what it "fixes". Coaching rationale lives in comments only.
   ============================================================ */

// Cycle phases (week 1 = first week after period starts)
const PHASES = {
  1: {
    key: 'menstrual',
    phase: 'Menstrual',
    sub: 'Period week',
    intensity: 'gentle',
    goal: 'Rest well · move kindly',
    note: 'Period week. Rest is real training this week — pick whatever feels right below, and every option counts.',
    emoji: '🌙',
  },
  2: {
    key: 'follicular',
    phase: 'Follicular',
    sub: 'Energy rising',
    intensity: 'push',
    goal: 'Build strength · push weights',
    note: 'Energy is climbing — lovely week to push the weights and feel strong doing it.',
    emoji: '🌱',
  },
  3: {
    key: 'ovulation',
    phase: 'Ovulation',
    sub: 'Strongest week',
    intensity: 'peak',
    goal: 'Your strongest week',
    note: 'Your strongest week of the month. A little heavier or one more rep — with form staying pretty.',
    emoji: '☀️',
  },
  4: {
    key: 'luteal',
    phase: 'Luteal',
    sub: 'Wind-down',
    intensity: 'steady',
    goal: 'Keep it steady · recover well',
    note: 'Wind-down week — energy dips are just biology doing its thing. Keep moving, skip the records, sleep lots.',
    emoji: '🤍',
  },
};

// "Your Month, Decoded" — plain, kind, biology-framed explanations per phase (P24)
const PHASE_DECODE = {
  1: { what: 'Your period. Hormones sit at their lowest, so energy dips and cramps or headaches can drop by.', training: 'So the app goes gentle — a feelings-first menu, lighter volume, zero pressure. Rest genuinely counts as training this week.' },
  2: { what: 'Follicular phase. Estrogen is climbing, and your energy, mood and recovery climb with it.', training: 'The app leans in — this is build time, when pushing the weights both feels good and works.' },
  3: { what: 'Around ovulation — often the strongest, most powerful days of your whole month.', training: 'The app flags this as your PB window: if a lift has felt close, this is when to go for it.' },
  4: { what: 'Luteal phase. Progesterone rises, energy and mood can soften, and sleep matters more than usual.', training: 'The app eases volume a touch and leans on recovery — steady beats heroic here.' },
};

const DAY_TITLES = {
  1: 'Glutes & Hamstrings',
  2: 'Back & Shoulders',
  3: 'Glutes & Quads',
  4: 'Chest, Shoulders & Arms',
};
// Editorial stacked headers (P20)
const DAY_HERO = {
  1: { micro: 'DAY 01 · LOWER BODY A', big: 'GLUTE', small: 'DAY' },
  2: { micro: 'DAY 02 · WAIST ILLUSION', big: 'WAIST', small: 'DAY' },
  3: { micro: 'DAY 03 · LOWER BODY B', big: 'STRONG', small: 'DAY' },
  4: { micro: 'DAY 04 · UPPER SCULPT', big: 'SCULPT', small: 'DAY' },
};
// Mixed-weight statement lines (render <b> as-is)
const DAY_TAGLINES = {
  1: 'Building <b>shape</b>, one hip thrust at a time.',
  2: 'A bigger <b>back</b> and wider <b>shoulders</b> do more for your waist than any ab exercise.',
  3: 'Heaviest hip thrust day — <b>strong</b> looks good on you.',
  4: 'Building <b>strength</b>, keeping it <b>cute</b>.',
};

/* Scheduling is sequence-based (spec §5): Day 1 → 2 → 3 → 4 → repeat.
   No weekday mapping — the app serves whatever comes next in the rotation. */

/* Exercise schema:
   { name, scheme (string | {week:string}), rest ('90 sec'|'60 sec'),
     cues[], avoid?, note?, tag ('core'?), ramp?: true (1–2 lighter feel sets first),
     alts?: [{name, scheme, note}] — equipment substitutions (spec §10) }
   Default rest where unstated: 60–90 sec (90 on big lifts, 60 on isolation). */
const DAYS = {
  1: {
    warmup: [
      'Treadmill walk · 5 min · easy 5 km/h',
      '90/90 breathing · 5 slow breaths',
      'Bodyweight squats · 2 × 10 · feet straight, knees over toes',
      'Glute bridges · 2 × 15 · 1-sec pause at top',
      'Hip abduction machine · 1 × 15–20 · very light & slow — wake the side-glutes up',
    ],
    ex: [
      { name: 'Hip Thrust Machine', scheme: { 1: '2×10', 2: '3×8–10', 3: '3×8 heavier', 4: '3×10' }, rest: '90 sec', ramp: true, cues: ['Chin tucked, ribs down', 'Drive through heels to full lockout', '1-sec squeeze at the top', 'Exhale as you lift'], avoid: 'Don\'t arch the lower back at the top.', note: 'Your main shape-builder.' },
      { name: 'Romanian Deadlift', scheme: { 1: '2×10', 2: '3×10', 3: '3×10 heavier', 4: '3×10' }, rest: '90 sec', ramp: true, cues: ['Soft knees, push hips back', 'Long, proud spine', 'Feel the hamstring stretch', 'Exhale on the way up', '“Close a car door with your hips”'] },
      { name: 'Seated Hamstring Curl', scheme: '2×12', rest: '60 sec', cues: ['2 sec down, 1 sec squeeze'] },
      { name: 'Hip Abduction Machine', scheme: '2×15', rest: '60 sec', cues: ['Lean slightly forward', 'Push knees apart slowly', 'Feel the sides of the hips working'], note: 'Strong, steady hips — a confident stride.', alts: [
        { name: 'Seated Banded Abduction', scheme: '2×15–20', note: 'Mini band above knees, any bench.' },
        { name: 'Banded Clamshells', scheme: '2×15 each side', note: 'Side-lying, slow, 1-sec squeeze.' },
      ] },
      { name: 'Hip Adduction Machine', scheme: '2×15', rest: '60 sec', cues: ['Slow control both directions', 'No slamming'], note: 'Inner-thigh balance work.', alts: [
        { name: 'Glute Bridge + Cushion Squeeze', scheme: '2×15', note: 'Squeeze a cushion between the knees through the bridge.' },
        { name: 'Side-Lying Adduction Raise', scheme: '2×12 each side', note: 'Small slow range is perfect.' },
      ] },
      { name: 'Glute Bridge', scheme: '2×15', rest: '60 sec', cues: ['Hips high, ribs down', 'Hard glute squeeze at the top', '1-sec pause'], note: 'Glute-focused and spine-friendly — all the burn, none of the lower-back load.', alts: [
        { name: 'Single-Leg Glute Bridge', scheme: '2×12 each leg', note: 'Harder — one leg, 1-sec pause at the top.' },
        { name: 'Cable Kickback', scheme: '2×15 each leg', note: 'Standing, slow, squeeze the glute.' },
      ] },
      { name: 'Pallof Press', scheme: '2×12 each side', rest: '60 sec', tag: 'core', cues: ['Press, pause, resist the twist'], note: 'Deep core — strength from the inside out.' },
    ],
    cardio: 'Incline walk · 15–20 min · 8% incline · 5 km/h',
  },

  2: {
    // [INTERNAL] Her highest-priority day for form: a strong upper back (lats/traps/
    // rhomboids) keeps the spine stacked on every other lift — it protects the lower back.
    warmup: [
      'Band pull-aparts · 2 × 15',
      'Scapular retractions · 2 × 10',
      'Light lat pulldown feel set · 1 × 12 · ≈half your working weight',
    ],
    ex: [
      { name: 'Lat Pulldown', scheme: '3×10', rest: '90 sec', ramp: true, cues: ['Flat back, proud chest', '“Drive elbows into your pockets”', 'No yanking — control the way back up'], note: 'Vertical pull — builds lat width, the waist-narrowing piece.' },
      { name: 'Seated Cable Row', scheme: '3×10', rest: '90 sec', cues: ['Flat back, proud chest', 'Pull to the lower ribs', 'Squeeze the shoulder blades', 'Slow return'], note: 'Horizontal pull — mid-back thickness and posture.' },
      { name: 'Single-Arm Dumbbell Row', scheme: '3×10 each', rest: '90 sec', cues: ['Hand and knee on the bench, flat back', 'Pull the dumbbell to your hip', 'No torso twisting'], note: 'Evens out left and right, and teaches a braced flat back.', alts: [
        { name: 'Chest-Supported Row', scheme: '3×10', note: 'Chest on an incline bench — zero lower-back load.' },
      ] },
      { name: 'Face Pull', scheme: '2×15', rest: '60 sec', cues: ['Pull toward the eyes', 'Elbows high, nice and slow'], note: 'Posture gold.' },
      { name: 'Reverse Pec Deck', scheme: '2×15', rest: '60 sec', cues: ['1-sec squeeze at the peak'] },
      { name: 'Dumbbell Lateral Raise', scheme: '3×12', rest: '60 sec', cues: ['Lead with the elbows', 'No swinging'], note: 'The hourglass maker — shoulder width frames everything.' },
      { name: 'Knee Tucks', scheme: '3×12', rest: '60 sec', tag: 'core', cues: ['Slow', 'Exhale as knees pull in', 'Keep the lower back relaxed on the bench'] },
      { name: 'Dead Bug', scheme: '2×10 each side', rest: '60 sec', tag: 'core', cues: ['Lower back gently pressed down', 'Slow opposite arm + leg'] },
    ],
    cardio: 'Bike · 15–20 min · moderate pace',
  },

  3: {
    warmup: [
      'Treadmill walk · 5 min',
      '90/90 breathing · 5 slow breaths',
      'Bodyweight squats · 2 × 10',
      'Glute bridges · 2 × 15',
      'Hip abduction machine · 1 × 15–20 · very light & slow',
    ],
    ex: [
      { name: 'Hip Thrust Machine', scheme: { 1: '2×10', 2: '3×8', 3: '3×8 heavier', 4: '3×8' }, rest: '90 sec', ramp: true, cues: ['Same beautiful form as Day 1', 'Exhale as you lift'], note: 'Heaviest hip thrust day of the week.' },
      { name: 'Bulgarian Split Squat', scheme: '3×8 each leg', rest: '90 sec', cues: ['Long stride, slight forward lean', 'Front heel planted', 'Exhale on the way up'], avoid: 'Never grind to failure on these.', note: 'The great evener — both legs get strong.' },
      { name: 'Leg Press', scheme: '2×12', rest: '90 sec', ramp: true, cues: ['Feet high and shoulder-width', 'Drive through the heels', 'Exhale on the push'] },
      { name: 'Cable Kickback', scheme: '2×15 each leg', rest: '60 sec', cues: ['Slow — no momentum'], alts: [
        { name: 'Banded Kickback', scheme: '2×15 each leg', note: 'Band low or around ankles, same cues.' },
        { name: 'Single-Leg Glute Bridge', scheme: '2×12 each leg', note: '1-sec pause at the top.' },
      ] },
      { name: 'Leg Extension', scheme: '2×15', rest: '60 sec', cues: ['1-sec pause at the top'], note: 'Pump finisher — enjoy this one.' },
      { name: 'Glute Bridge Hold', scheme: '2×30 sec', rest: '60 sec', cues: ['Hips locked out', 'Ribs down', 'Hard glute squeeze the whole time'], note: 'Glute endurance, spine-friendly — quiet strength for a tall, proud posture.', alts: [
        { name: 'Single-Leg Glute Bridge Hold', scheme: '2×20 sec each', note: 'Harder — one leg at a time.' },
      ] },
      { name: 'Bird Dog', scheme: '2×10 each side', rest: '60 sec', tag: 'core', cues: ['Slow and balanced', 'Hips stay level'] },
    ],
    // Optional finisher — shown weeks 2 & 3 only (skip on gentle weeks)
    burnout: {
      title: 'Banded burnout · optional',
      note: 'One round, all on a bench or mat with a mini band — perfect when machines are busy or you want extra burn.',
      items: ['Seated banded abductions · 1 × 20', 'Banded glute bridge · 1 × 15 + 10 pulses at the top', 'Banded clamshells · 1 × 15 each side'],
    },
    cardio: 'Incline walk · 15–20 min',
  },

  4: {
    warmup: [
      'Arm circles · 10 each direction',
      'Band pull-aparts · 2 × 15',
      'Scapular wall slides · 1 × 10',
      'Light chest press feel set · 1 × 10 · ≈half your working weight',
    ],
    ex: [
      { name: 'Machine Chest Press', scheme: '2×10', rest: '90 sec', cues: ['Shoulder blades back and down into the pad', 'Elbows about 45°', 'Full stretch at the bottom, no locked elbows'], note: 'A lifted, open-chest look — pairs beautifully with the posture work.', alts: [
        { name: 'Dumbbell Bench Press', scheme: '2×10', note: 'Flat bench, controlled lowering.' },
        { name: 'Push-Up Progression', scheme: '2×8–12', note: 'Incline → knees → full. Log your variation in notes.' },
      ] },
      { name: 'Incline Dumbbell Press', scheme: '2×10', rest: '90 sec', cues: ['Bench at about 30°', 'Elbows about 45°', 'Slow lowering'], note: 'The upper-chest line — defined and lifted.' },
      { name: 'Dumbbell Chest Fly', scheme: '2×12', rest: '60 sec', cues: ['Soft elbow bend, held the whole time', 'Lower wide for a big stretch', 'Squeeze back together like hugging a tree'], note: 'Stretch-and-squeeze for shape a press can\'t give.' },
      { name: 'Dumbbell Shoulder Press', scheme: '2×10', rest: '90 sec', cues: ['Press up smoothly', 'Stop just short of locked elbows', 'Lower with control'] },
      { name: 'Dumbbell Lateral Raise', scheme: '3×12', rest: '60 sec', cues: ['Slight lean forward', 'Lead with the elbows', 'No swinging'] },
      { name: 'Overhead Rope Extension', scheme: '2×12', rest: '60 sec', cues: ['Full stretch at the bottom', 'Elbows close to the head'], note: 'Pump exercise — enjoy.' },
      { name: 'Dumbbell Curl', scheme: '2×12', rest: '60 sec', cues: ['No swinging, full range'] },
      { name: 'Farmer\'s Carry', scheme: '2×30–40 m', rest: '90 sec', dist: true, cues: ['Flat back, proud chest', 'Heaviest dumbbells you can hold tall', 'Shoulders back, controlled steps'], note: 'Grip, core, carrying strength — a quiet confidence-builder. Variation: Suitcase Carry — weight in ONE hand, alternate sides; your core resists the lean, a lovely safe back-toughener. Log kg per hand and metres.' },
      { name: 'Front Plank', scheme: '3×30–45 sec', rest: '60 sec', tag: 'core', cues: ['Squeeze glutes, ribs down', 'Breathe'] },
      { name: 'Side Plank', scheme: '2×30 sec each side', rest: '60 sec', tag: 'core', cues: ['Long line, hips lifted'] },
      { name: 'Vacuum Breathing', scheme: '3 rounds × 10 breaths', rest: '60 sec', tag: 'core', skipOnPeriod: true, cues: ['Exhale fully, draw the belly button in', 'Hold gently, breathe shallow'], note: 'Deep-core control — strength from the inside out.' },
    ],
    cardio: 'StairMaster · 10–12 min · moderate pace',
  },
};
// Phase-1 volume bump (evolution engine): re-add when unlocked
const PHASE1_EXTRA_D4 = [
  { name: 'Hammer Curl', scheme: '2×12', rest: '60 sec', cues: ['Neutral grip, no swinging'] },
  { name: 'Rope Tricep Pushdown', scheme: '2×12', rest: '60 sec', cues: ['Elbows pinned', 'Full extension and squeeze'] },
  { name: 'Dumbbell Pullover', scheme: '2×12', rest: '60 sec', cues: ['Soft elbows', 'Big stretch overhead', 'Pull it over with chest and lats'] },
];

function resolveScheme(scheme, week) {
  return typeof scheme === 'object' ? (scheme[week] || scheme[2]) : scheme;
}

/* ---- Gentle sessions (period week / rough days) — spec §7 ---- */
const GENTLE = {
  A: {
    title: 'Gentle Session A',
    ex: [
      { name: 'Hip Thrust Machine', scheme: '2×12', rest: '90 sec', cues: ['Light and smooth'] },
      { name: 'Lat Pulldown', scheme: '2×12', rest: '90 sec', cues: ['Easy weight, lovely form'] },
      { name: 'Pallof Press', scheme: '2×12 each side', rest: '60 sec', tag: 'core', cues: ['Gentle and controlled'] },
    ],
    cardio: 'Walk · 15 min · easy',
  },
  B: {
    title: 'Gentle Session B',
    ex: [
      { name: 'Leg Press', scheme: '2×12', rest: '90 sec', cues: ['Light and smooth'] },
      { name: 'Seated Cable Row', scheme: '2×12', rest: '90 sec', cues: ['Easy weight, tall chest'] },
      { name: 'Glute Bridge', scheme: '2×15', rest: '60 sec', cues: ['Hips high, ribs down', 'Slow, glutes doing the work'] },
    ],
    cardio: 'Walk · 15 min · easy',
  },
};

/* ---- Cramp-Relief Stretch (8–10 min, home, no equipment) — spec §7 ---- */
const CRAMP_RELIEF = {
  title: 'Cramp-Relief Stretch · 8–10 min',
  tip: 'Pairs beautifully with a heat pad before or after. 💗',
  items: [
    { name: 'Child\'s Pose', scheme: '60 sec', hint: 'knees wide, slow belly breaths' },
    { name: 'Cat–Cow', scheme: '× 10', hint: 'slow reps' },
    { name: 'Knees-to-Chest', scheme: '60 sec', hint: 'gentle rocking is lovely' },
    { name: 'Supine Twist', scheme: '30 sec', hint: 'each side' },
    { name: 'Happy Baby', scheme: '30–45 sec', hint: '' },
    { name: 'Reclined Butterfly', scheme: '60 sec', hint: 'hand on belly, soft breaths' },
    { name: 'Slow Belly Breathing', scheme: '× 10', hint: 'in 4 sec, out 6 sec' },
  ],
};

/* ---- Rest / recovery days (Wed, Fri, Sun) ---- */
const REST_DAY = {
  title: 'Recovery & Mobility',
  items: ['A walk you actually enjoy — steps add up', 'Gentle stretching or the Posture Reset below', 'Protein, water, and a proper night\'s sleep'],
};

/* ---- Daily mini-routines ----
   [INTERNAL] Hip routine = glute-medius/hip-stability work; Posture Reset =
   upper-back/neck postural work. UI copy: what it BUILDS only. */
const HIP_ROUTINE = {
  title: 'Hip & Stability · 5 min',
  sub: 'Strong, steady hips — a confident stride',
  gymNote: 'On gym days the warm-up already covers the machine work ✓ — this is the home top-up.',
  items: [
    { name: 'Clamshells', scheme: '2 × 15', hint: 'each side · slow' },
    { name: 'Standing Hip Abduction', scheme: '2 × 15', hint: 'each side · slow — no band needed' },
    { name: 'Single-Leg Balance', scheme: '30 sec', hint: 'each leg' },
  ],
};
/* Quick mobility + deep-strength minutes — lovely after a desk day,
   and it makes the leg days feel smoother too. */
const SQUAT_RESET = {
  title: 'Deep Squat Reset · 3 min',
  sub: 'Sink low, breathe, stand taller — 3× a week',
  safety: 'Balance feeling shy? Hold a doorframe or pole — totally allowed, forever.',
  items: [
    { name: 'Deep Squat Hold', scheme: '2 × 30 sec', hint: 'heels down, chest proud, elbows gently nudge the knees out · just sit in it and breathe' },
    { name: 'Glute Bridge Hold', scheme: '1 × 30 sec', hint: 'ribs down, hard squeeze at the top' },
    { name: '90/90 Breathing', scheme: '× 5 breaths', hint: 'slow exhales, feel everything soften' },
  ],
};

const POSTURE_RESET = {
  title: 'Posture Reset · 4 min',
  sub: 'Undo the desk day — stand tall',
  safety: 'If you ever feel neck pain, numbness or tingling into the arms, see a physio — don\'t push through.',
  items: [
    { name: 'Chin Tucks', scheme: '2 × 10', hint: 'glide straight back · 2-sec hold' },
    { name: 'Wall Angels', scheme: '2 × 10', hint: 'back and head on the wall' },
    { name: 'Thoracic Extension', scheme: '× 10', hint: 'slow · over a chair back or roller' },
    { name: 'Doorway Chest Stretch', scheme: '2 × 30 sec', hint: '' },
    { name: 'Prone Y-Raises', scheme: '2 × 10', hint: 'thumbs up, lift with love' },
  ],
};

/* ---- Daily habit chips (spec §2) ----
   vacuum hidden on period days (belly compression can aggravate cramps). */
const TARGETS = [
  { icon: '🍳', label: 'Protein', detail: '110–120 g · ~25–30 g × 4 meals' },
  { icon: '🥦', label: 'Fibre', detail: '~25 g' },
  { icon: '💧', label: 'Water', detail: '2.5–3 L' },
  { icon: '👟', label: 'Steps', detail: '8,000–10,000' },
  { icon: '😴', label: 'Sleep', detail: '7.5 h +' },
  { icon: '🌬️', label: 'Vacuum breathing', detail: '3 × 10 breaths', skipOnPeriod: true },
  { icon: '🛏️', label: 'Beauty sleep, queen style ✨', detail: 'Cosy pillow check 💤 — lower pillow, taller mornings' },
];

// Check-in options
const MOODS = ['😣', '😕', '🙂', '😊', '🤩'];
const MOOD_LABELS = ['Rough', 'Meh', 'Okay', 'Good', 'Amazing'];
const SYMPTOMS = ['Cramps', 'Headache', 'Bloating', 'Low energy', 'Energized', 'Slept well', 'Slept badly'];

// Training split (what the month is made of)
const SPLIT = [
  ['Glutes & lower body', 40],
  ['Back, chest & shoulders', 30],
  ['Core & posture', 15],
  ['Cardio & recovery', 15],
];

/* ---- Progression & evolution (spec §3 & §9) ---- */
const PROGRESSION_RULE = 'When all sets feel comfortable at the top of the rep range → next time add 1–2 reps OR 2.5 kg. One or the other, never both.';
const RIR_HINT = 'Leave 2–3 in the tank 💪 — finish every set knowing you had a couple more.';

// Unified names so history/PBs track across days (old logs are aliased on read)
const ALIASES = {
  'Hip Thrust': 'Hip Thrust Machine',
  'Lateral Raise': 'Dumbbell Lateral Raise',
  'Shoulder Press': 'Shoulder Press Machine',
  'Seated Row': 'Seated Cable Row',
  'Bicep Curl': 'Dumbbell Curl',
  'Hamstring Curl': 'Seated Hamstring Curl',
  'Hip Abduction': 'Hip Abduction Machine',
};

const KEY_LIFTS = ['Hip Thrust Machine', 'Romanian Deadlift', 'Lat Pulldown', 'Dumbbell Lateral Raise', 'Bulgarian Split Squat', 'Seated Cable Row', 'Leg Press'];

// Long-term strength milestones (spec §9) — progress measured against HER OWN numbers only
const MILESTONES = [
  { name: 'Hip Thrust Machine', target: 60, reps: 10, label: 'Bodyweight club', story: '60 kg × 10 — thrusting your own bodyweight. Unlocks pause reps & single-leg variations.' },
  { name: 'Hip Thrust Machine', target: 80, reps: 8, label: '80 kg club', story: 'The big one. Strong is an understatement.' },
  { name: 'Lat Pulldown', target: 40, reps: 10, label: 'Pull-up path', story: '40 kg × 10 — the door to your first full pull-up opens here.' },
  { name: 'Romanian Deadlift', target: 45, reps: 10, label: 'Hinge queen', story: '45 kg × 10 — barbell RDLs become an option.' },
  { name: 'Bulgarian Split Squat', target: 8, reps: 8, label: 'Steady & strong', story: '8 kg dumbbells each hand — front-foot-elevated version unlocks.' },
];

/* ---- Nutrition (spec §2 — PCOS-aware, South Indian + halal + SG) ----
   [INTERNAL] rationale (insulin response, deficiency stats) stays out of UI. */
const NUTRITION = {
  calories: {
    title: 'Fuel, not famine',
    lines: [
      'A gentle working range of about <b>1,500–1,750 kcal</b> — never below 1,500.',
      'This is recomposition, not dieting: <b>don\'t chase fat loss, chase strength.</b>',
      'Judge it by rising lifts and how you feel — never by a daily scale.',
      'Don\'t lift fully fasted — a small bite 60–90 min before (yogurt + banana, toast + eggs) makes sessions feel better.',
    ],
  },
  principles: {
    title: 'Plate rules of thumb',
    lines: [
      '<b>Protein + fibre at every meal</b> — it keeps energy smooth all day.',
      'Carbs are friends — time the bigger portions around training; rice stays, just with company.',
      'Most plates simply need a <b>protein anchor added</b>: chicken, fish, eggs, dal + curd together, paneer, yogurt.',
      'Save the sweet drinks (teh, sirap, sodas) for treat moments 🍹 — water carries the day.',
      'During and just after period week, favour iron-rich plates: chicken thigh, red meat sometimes, spinach with a squeeze of lemon. 🍋',
    ],
  },
  meals: {
    title: 'Meal ideas that taste like home',
    lines: [
      'Idli or dosa + eggs or chicken on the side',
      'Dal / sambar / rasam + rice + curd + a protein',
      'Chicken or fish curry + veg + steady rice portion',
      'Greek yogurt or curd bowls, paneer anything',
      'Whey shake on the rushed days — it counts',
    ],
  },
  supplements: {
    title: 'Worth a chat with your GP',
    lines: [
      'Often discussed for cycles and headaches: myo-inositol, vitamin D, magnesium, omega-3.',
      'Vitamin D especially — a simple blood test at the GP is worth it.',
      'This app never prescribes — a PCOS-savvy dietitian is the gold standard for personalising all of this. 💛',
    ],
  },
};

// Expected timeline (motivation screens — process-framed)
const TIMELINE = [
  ['Months 1–2', 'Standing taller, feeling stronger, habits clicking'],
  ['Months 3–4', 'Clothes start agreeing with you · arms say hello'],
  ['Months 5–6', 'Shoulder lines, back shape, core waking up'],
  ['Months 8–12', 'The athletic look settles in for good'],
];

// His note — shown on the Plan tab 💌
const LOVE_NOTE = 'Hi jaan, workout well, have fun stay safe. I love you';

const COACH_NOTES = "This is athletic, functional strength — built around your month, your energy, and your real life. Two sessions in a busy week is a win, not a compromise.\n\nFive things matter most over the first year: hip thrust progression, Romanian deadlift progression, lat pulldown progression, lateral raise progression, and daily walking. Progress those, and everything else follows.";
