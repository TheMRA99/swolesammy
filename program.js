/* ============================================================
   SWOLESAMMY — Sammy's Elite Program (data)
   All training content lives here so it's easy to tweak later.
   ============================================================ */

// Cycle phases (week 1 = first week after period starts)
const PHASES = {
  1: {
    key: 'menstrual',
    phase: 'Menstrual',
    sub: 'Period week',
    intensity: '60–70%',
    goal: 'Recover · reduce inflammation · keep moving',
    note: 'Period week. Recover, reduce inflammation and simply maintain movement — showing up gently is the whole win.',
    emoji: '🌙',
  },
  2: {
    key: 'follicular',
    phase: 'Follicular',
    sub: 'Best recovery',
    intensity: '80–85%',
    goal: 'Build strength · push weights',
    note: 'Your best recovery week. Energy is climbing — build strength and push the weights.',
    emoji: '🌱',
  },
  3: {
    key: 'ovulation',
    phase: 'Ovulation',
    sub: 'Strongest week',
    intensity: '85–90%',
    goal: 'Progressive overload',
    note: 'Your strongest week. Go for progressive overload — a little heavier or an extra rep, with perfect form.',
    emoji: '☀️',
  },
  4: {
    key: 'luteal',
    phase: 'Luteal',
    sub: 'PMS week',
    intensity: '70–80%',
    goal: 'Reduce fatigue · maintain muscle',
    note: 'PMS week — energy dips are normal. Reduce fatigue, maintain muscle, and don\'t chase personal bests.',
    emoji: '🤍',
  },
};

const DAY_TITLES = {
  1: 'Glutes & Hamstrings',
  2: 'Back & Shoulders',
  3: 'Glutes & Quads',
  4: 'Shoulders, Arms & Core',
};
const DAY_SUBTITLES = {
  1: 'Lower Body A',
  2: 'The waist-shrinking day',
  3: 'Lower Body B',
  4: 'Sculpt day',
};
const DAY_TAGLINES = {
  2: 'Building shoulders and lats makes the waist appear smaller.',
};

// Which weekday maps to which training day (0 = Sun … 6 = Sat)
const SCHEDULE = { 1: 1, 2: 2, 4: 3, 6: 4 }; // Mon→D1, Tue→D2, Thu→D3, Sat→D4

/* Exercises.
   scheme: a string, or {1:…,2:…,3:…,4:…} per cycle week.
   cues / note / rest are optional extras shown on tap. */
const DAYS = {
  1: {
    warmup: ['Treadmill walk · 5 min', 'Hip circles · 10 each side', 'Bodyweight squats · 15', 'Glute bridges · 15'],
    ex: [
      { name: 'Hip Thrust Machine', scheme: { 1: '3×10', 2: '4×10', 3: '4×8 heavier', 4: '3×10' }, rest: '90 sec', cues: ['Chin tucked', 'Rib cage down', 'Full lockout', '1-sec squeeze at top'], note: 'Her main glute builder.' },
      { name: 'Romanian Deadlift', scheme: '3×10', rest: '90 sec', cues: ['Soft knees', 'Push hips backwards', 'Feel the hamstring stretch'], note: 'Huge exercise for feminine lower-body shape — glutes, hamstrings, lower back.' },
      { name: 'Seated Hamstring Curl', scheme: '3×12', cues: ['2-second lowering phase'] },
      { name: 'Hip Abduction Machine', scheme: '3×15', cues: ['Lean slightly forward', 'Focus on the glute burn'] },
      { name: 'Back Extension', scheme: '3×12', cues: ['Glute-focused', 'Pause at the top'] },
      { name: 'Cable Pull Through', scheme: '3×12', cues: ['Slow and controlled'], note: 'Excellent glute finisher.' },
      { name: 'Pallof Press', scheme: '3×12 each side', tag: 'core' },
    ],
    cardio: 'Incline walk · 20 min · incline 8% · 4.8–5.5 km/h',
  },
  2: {
    ex: [
      { name: 'Lat Pulldown', scheme: '4×10' },
      { name: 'Seated Cable Row', scheme: '3×12' },
      { name: 'Single Arm Cable Row', scheme: '3×12' },
      { name: 'Face Pull', scheme: '3×15' },
      { name: 'Reverse Pec Deck', scheme: '3×15' },
      { name: 'Shoulder Press Machine', scheme: '3×10' },
      { name: 'Dumbbell Lateral Raise', scheme: '4×12' },
      { name: 'Leg Raise Machine', scheme: '3×12', tag: 'core' },
    ],
    cardio: 'Bike · 20 min',
  },
  3: {
    ex: [
      { name: 'Hip Thrust', scheme: '4×8', note: 'Heaviest hip thrust day.' },
      { name: 'Bulgarian Split Squat', scheme: '3×8 each leg' },
      { name: 'Leg Press', scheme: '3×12' },
      { name: 'Cable Kickback', scheme: '3×15' },
      { name: 'Leg Extension', scheme: '3×15' },
      { name: 'Back Extension Hold', scheme: '3×30 sec', note: 'For the erector spinae.' },
      { name: 'Dead Bug', scheme: '3×8', tag: 'core' },
    ],
    cardio: 'Incline walk · 20 min',
  },
  4: {
    ex: [
      { name: 'Shoulder Press', scheme: '3×10' },
      { name: 'Lateral Raise', scheme: '4×12' },
      { name: 'Rope Tricep Pushdown', scheme: '3×12' },
      { name: 'Overhead Rope Extension', scheme: '3×12' },
      { name: 'Dumbbell Curl', scheme: '3×12' },
      { name: 'Hammer Curl', scheme: '3×12' },
      { name: 'Face Pull', scheme: '2×15' },
      { name: 'Front Plank', scheme: '3×45 sec', tag: 'core' },
      { name: 'Side Plank', scheme: '2×30 sec each', tag: 'core' },
    ],
    cardio: 'StairMaster · 10 min · moderate pace',
  },
};

function resolveScheme(scheme, week) {
  return typeof scheme === 'object' ? (scheme[week] || scheme[2]) : scheme;
}

// Rest / recovery days (Wed, Fri, Sun)
const REST_DAY = {
  title: 'Recovery & Mobility',
  items: ['Walk — chase the 8,000–10,000 step target', 'Gentle mobility / stretching', 'Protein, water, and 7.5–9 h sleep'],
};

// Daily 5-minute posture work (for desk life)
const POSTURE = [
  ['Chin Tucks', '×10'],
  ['Wall Angels', '×10'],
  ['Bird Dogs', '×10'],
  ['Cat–Cow', '×10'],
  ['Chest Stretch', '30 sec'],
];

// Daily nutrition / lifestyle targets (at ~60 kg)
const TARGETS = [
  { icon: '🍳', label: 'Protein', detail: '110–120 g' },
  { icon: '💧', label: 'Water', detail: '2.5–3 L' },
  { icon: '👟', label: 'Steps', detail: '8,000–10,000' },
  { icon: '😴', label: 'Sleep', detail: '7.5–9 h' },
];

// Check-in options
const MOODS = ['😣', '😕', '🙂', '😊', '🤩'];
const MOOD_LABELS = ['Rough', 'Meh', 'Okay', 'Good', 'Amazing'];
const SYMPTOMS = ['Cramps', 'Headache', 'Bloating', 'Low energy', 'Energized', 'Slept well', 'Slept badly'];

// Training split
const SPLIT = [
  ['Glutes & lower body', 40],
  ['Back & shoulders', 30],
  ['Core & posture', 15],
  ['Cardio & recovery', 15],
];
// Progression rules
const PROGRESSION = {
  priority: ['Hip Thrust', 'Romanian Deadlift', 'Bulgarian Split Squat'],
  rule: 'Every 2 weeks, increase 2.5–5 kg or add 1–2 reps on the priority lifts.',
};

// The lifts that drive the visual transformation (used by Progress tab)
const KEY_LIFTS = ['Hip Thrust Machine', 'Hip Thrust', 'Romanian Deadlift', 'Bulgarian Split Squat', 'Lat Pulldown', 'Dumbbell Lateral Raise', 'Lateral Raise'];

// Weekly schedule overview
const SCHEDULE_OVERVIEW = [
  ['Mon', 'Day 1 · Glutes & Hamstrings'],
  ['Tue', 'Day 2 · Back & Shoulders'],
  ['Wed', 'Walk · Recovery · Mobility'],
  ['Thu', 'Day 3 · Glutes & Quads'],
  ['Fri', 'Walk · Recovery · Mobility'],
  ['Sat', 'Day 4 · Shoulders, Arms & Core'],
  ['Sun', 'Walk · Recovery · Mobility'],
];

const COACH_NOTES = "This is not bikini-competitor training — no endless kickbacks, no 20 booty exercises. It's athletic, functional strength: strong glutes, a strong back, healthy shoulders and great posture, built to fit around real life.\n\nFive things matter most over the first 6–12 months: hip thrust progression, Romanian deadlift progression, lat pulldown progression, lateral raise progression, and daily walking. Progress those, and everything else follows.";
