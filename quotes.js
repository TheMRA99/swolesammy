/* ============================================================
   SWOLESAMMY — content pack (all local, no internet needed)
   type: 'affirmation' | 'muneer' | 'pickup' | 'poem_funny' | 'poem_sweet'
   phase: 'any' | 'gentle' (cycle weeks 1 & 4) | 'hype' (weeks 2 & 3)
   MUNEER: add your own lines anywhere below — more inside jokes = better.
   Everything signed Jaan(War) gets the 💌 card style automatically.
   ============================================================ */

const CONTENT = [
  /* ---------- affirmations ---------- */
  { type: 'affirmation', phase: 'any', text: 'You\'re not working out to change who you are — you\'re revealing her.' },
  { type: 'affirmation', phase: 'any', text: 'Strong looks beautiful on you.' },
  { type: 'affirmation', phase: 'any', text: 'Every rep is a love letter to your future self.' },
  { type: 'affirmation', phase: 'any', text: 'Soft heart, strong back. You can be both.' },
  { type: 'affirmation', phase: 'any', text: 'You showed up today. That\'s the prettiest thing about you.' },
  { type: 'affirmation', phase: 'any', text: 'Glow comes from consistency, not perfection.' },
  { type: 'affirmation', phase: 'any', text: 'Your body is listening to everything you tell it. Speak kindly.' },
  { type: 'affirmation', phase: 'gentle', text: 'Rest is part of the plan, princess. Take it without guilt.' },
  { type: 'affirmation', phase: 'gentle', text: 'Some weeks you lift heavy. Some weeks showing up is the lift.' },
  { type: 'affirmation', phase: 'any', text: 'She remembered who she was and the game changed.' },
  { type: 'affirmation', phase: 'any', text: 'Confidence is built one quiet morning at a time.' },
  { type: 'affirmation', phase: 'any', text: 'Your pace is perfect. This is your story, not a race.' },
  { type: 'affirmation', phase: 'any', text: 'Strong glutes, soft heart, sharp mind.' },
  { type: 'affirmation', phase: 'any', text: 'Be patient with yourself — gardens don\'t bloom overnight.' },
  { type: 'affirmation', phase: 'any', text: 'You\'re allowed to be a masterpiece and a work in progress at the same time.' },
  { type: 'affirmation', phase: 'any', text: 'Discipline is just self-love with a schedule.' },
  { type: 'affirmation', phase: 'any', text: 'The gym doesn\'t need the best version of you today. Just the version that came.' },
  { type: 'affirmation', phase: 'hype', text: 'Today\'s weights don\'t know what\'s coming. 😌' },
  { type: 'affirmation', phase: 'hype', text: 'Walk in like you own the place. You kind of do.' },
  { type: 'affirmation', phase: 'hype', text: 'Strong week. Strong girl. Add the little plate.' },
  { type: 'affirmation', phase: 'hype', text: 'You\'ve done harder things than this set. Proceed.' },
  { type: 'affirmation', phase: 'gentle', text: 'Being gentle with yourself is also a skill. You\'re training it now.' },
  { type: 'affirmation', phase: 'gentle', text: 'Slow days grow the same garden. Water it anyway, softly.' },
  { type: 'affirmation', phase: 'gentle', text: 'A short walk still tells your body: I\'ve got us.' },
  { type: 'affirmation', phase: 'any', text: 'Future you is watching this workout and smiling.' },
  { type: 'affirmation', phase: 'any', text: 'Strength isn\'t loud. It shows up, ties its hair, and begins.' },
  { type: 'affirmation', phase: 'any', text: 'You don\'t need a new plan. You need this Tuesday, done with love.' },
  { type: 'affirmation', phase: 'any', text: 'Small wins, stacked weekly, become a different life.' },
  { type: 'affirmation', phase: 'any', text: 'Your only competition is the girl from last month — and she\'s cheering for you.' },
  { type: 'affirmation', phase: 'any', text: 'Grace for the hard days. Standards for the good ones.' },
  { type: 'affirmation', phase: 'any', text: 'A water bottle, a playlist, forty minutes. That\'s all a fresh start needs.' },
  { type: 'affirmation', phase: 'any', text: 'Posture check, queen. The crown slips when you slouch. 👑' },
  { type: 'affirmation', phase: 'hype', text: 'The bar isn\'t heavy. It\'s just not used to you yet.' },
  { type: 'affirmation', phase: 'any', text: 'You are the kind of consistent that compounds.' },

  /* ---------- messages from Muneer 💌 (edit me!) ---------- */
  { type: 'muneer', phase: 'any', text: 'Are you a hip thrust? Because you make my heart do reps. 💌' },
  { type: 'muneer', phase: 'any', text: 'Gym crush alert 🚨 oh wait, that\'s my girlfriend.' },
  { type: 'muneer', phase: 'any', text: 'I built you a whole app because "you\'re so strong babe" didn\'t feel like enough.' },
  { type: 'muneer', phase: 'any', text: 'Warning: excessive glute gains may result in your boyfriend staring. Proceed anyway.' },
  { type: 'muneer', phase: 'any', text: 'You + dumbbells = my favourite love triangle.' },
  { type: 'muneer', phase: 'gentle', text: 'The app says rest day. I say nap on my shoulder day.' },
  { type: 'muneer', phase: 'any', text: 'Legally obligated to tell you that you\'re the strongest cutest person in this gym.' },
  { type: 'muneer', phase: 'any', text: 'Every rep you log, I\'m somewhere being proud of you. 💌' },
  { type: 'muneer', phase: 'any', text: 'You don\'t need to change a single thing. I just want you to feel as strong as I already know you are.' },
  { type: 'muneer', phase: 'any', text: 'I fell for you way before the gains. The gains are just a bonus.' },
  { type: 'muneer', phase: 'any', text: 'Strongest girl I know — and I don\'t mean the weights.' },
  { type: 'muneer', phase: 'gentle', text: 'Tired today? Borrow some of my belief in you. I have extra.' },
  { type: 'muneer', phase: 'any', text: 'One day I\'ll tell our story and this app will be a chapter.' },
  { type: 'muneer', phase: 'any', text: 'You showing up for yourself is my favourite thing to watch.' },
  { type: 'muneer', phase: 'gentle', text: 'Rough week? Heat pad\'s on me, hugs are free, you\'re still my champion. 💌' },
  { type: 'muneer', phase: 'gentle', text: 'Rest, sayang. The weights will wait. I\'m not going anywhere either.' },

  /* ---------- pickup lines — signed Jaan(War) 🐯💌 ---------- */
  { type: 'pickup', phase: 'any', text: 'Are you a personal best? Because I\'d brag about you to everyone.' },
  { type: 'pickup', phase: 'any', text: 'Do you believe in love at first set, or should I walk past the squat rack again?' },
  { type: 'pickup', phase: 'any', text: 'Are you a rest timer? Because I can\'t stop counting down to you.' },
  { type: 'pickup', phase: 'any', text: 'Excuse me, is this machine taken? No? Great — anyway, you\'re gorgeous.' },
  { type: 'pickup', phase: 'any', text: 'They said pick a workout partner for life. I picked the cutest one.' },
  { type: 'pickup', phase: 'any', text: 'Are you a protein shake? Because you\'re the best part of my day and also kind of essential.' },
  { type: 'pickup', phase: 'hype', text: 'Girl, are you progressive overload? Because you get more impressive every single week.' },
  { type: 'pickup', phase: 'any', text: 'I\'d say you stole my heart but honestly I handed it over voluntarily.' },

  /* ---------- funny poems (4-liners) ---------- */
  { type: 'poem_funny', phase: 'any', text: 'Roses are red,\ndumbbells are grey,\nyou hip-thrusted my heart\nclean out of my chest today.' },
  { type: 'poem_funny', phase: 'any', text: 'I wrote you a poem\nbetween set two and three,\nit\'s mostly just "wow"\nand "marry— I mean, text me."' },
  { type: 'poem_funny', phase: 'any', text: 'The treadmill is boring,\nthe StairMaster\'s a crime,\nbut watching you crush it?\nEntertainment, prime.' },
  { type: 'poem_funny', phase: 'hype', text: 'Leg day is heavy,\nmy love is heavier,\ntogether they make you\nofficially deadlier.' },
  { type: 'poem_funny', phase: 'any', text: 'I counted your reps\nand lost count at three,\nnot because of the math —\nyou\'re distracting to me.' },
  { type: 'poem_funny', phase: 'gentle', text: 'The couch made a case,\nthe blanket agreed,\na rest day with you\nis all that I need.' },

  /* ---------- sweet poems & lovely lines ---------- */
  { type: 'poem_sweet', phase: 'any', text: 'You are not a before picture. You were never a before picture.\nYou\'re the whole story, mid-chapter, getting good.' },
  { type: 'poem_sweet', phase: 'any', signed: true, text: 'Some flowers bloom loudly.\nSome bloom quietly, every single day,\nand don\'t even notice.\nYou\'re the second kind.' },
  { type: 'poem_sweet', phase: 'any', text: 'Strong isn\'t the opposite of soft.\nYou\'re the proof.' },
  { type: 'poem_sweet', phase: 'any', text: 'She moved gently through the world\nand the world had no idea\nhow much iron she carried\nin her hands and in her heart.' },
  { type: 'poem_sweet', phase: 'any', text: 'One day you\'ll catch your reflection\nmid-laugh, mid-lift, mid-life —\nand realise you became her\nwithout noticing.' },
  { type: 'poem_sweet', phase: 'any', signed: true, text: 'I don\'t love you because you\'re strong.\nYou\'re strong, and I love you,\nand both keep being true.' },
  { type: 'poem_sweet', phase: 'gentle', text: 'Even the moon takes nights off\nand no one calls her lazy.\nRest like the moon.\nReturn like the tide.' },
  { type: 'poem_sweet', phase: 'any', text: 'Quietly, weekly, kindly —\nthat\'s how she built herself.\nNo announcement.\nJust arrival.' },
];

/* Rotation weights: ~40% affirmations · ~25% Muneer/pickup · ~20% lovely lines · ~15% funny poems */
const CONTENT_WEIGHTS = { affirmation: 40, muneer: 15, pickup: 10, poem_sweet: 20, poem_funny: 15 };
