# SwoleSammy 💪💕

Sammy's cycle-aware training app, period tracker and gym companion. Mobile-first PWA, works **offline**, saves everything **on the device** (no login, no servers). Light & dark mode.

*Made with Love by your jaan(war).*

Live: https://themra99.github.io/swolesammy/

## What's inside

- **Today** — serves the **next session in the Day 1→4 rotation** (never weekday-locked — life happens on its own schedule; nothing is ever "missed"). Beginner-volume split: Glutes & Hamstrings · Back & Shoulders · Glutes & Quads · Chest, Shoulders & Arms, with warm-ups, auto-calculated warm-up sets on the big lifts (real kg suggestions from her working weight), form cues (ⓘ), **exercise swap (⇄)** when machines are busy, tickable cardio finisher, a rest timer, "Last: …" memory per exercise, progression nudges ("add 1–2 reps OR 2.5 kg — never both"), mood/symptom/habit check-ins that actually adapt the session, notes with recall, and daily Hip & Stability, Deep Squat Reset, and Posture Reset mini-routines. During period week the session picker becomes a four-tier **"How are you feeling?"** menu (stretch / walk / gentle session / normal) — every tier counts.
- **Cycle** — period logging anchors the training weeks (never a fixed calendar — PCOS-friendly), predicted next period from her real averages, month calendar, history. Day 1–2 pain → the app proactively suggests **cycle rest 🌙, a fully-completed day**.
- **Progress** — progress is told **in words** (auto-written stories and monthly letters from her real numbers — no photos, no comparisons), plus stats with a kind streak system (2 sessions = a complete week; lapses show as *fresh start 💛*, never broken), strength curves, milestone **Hall of Fame**, personal bests, and pattern insights (mood by phase, headache heads-up).
- **Plan** — the full program: split, schedule, hormone-structured month, all days with per-week schemes and swaps, gentle sessions, progression rules, PCOS-aware nutrition (South Indian + halal meal ideas), daily targets, expected timeline, and a note from him 💌.
- **Settings** — Light/Dark/Auto theme, **My gym** equipment toggles (mark a missing machine → the app auto-swaps in a no-equipment move everywhere), a **love-note editor** (add your own messages, signed Jaan(War), into her rotation), a pregnancy pause (training hands over to her doctor, with a warm welcome back after), backup export/import, reset. A one-time warm onboarding explains RIR, logging, and "week 1 is for learning."

The program evolves with her logs: volume bumps after consistent weeks, plateau help, deload prompts, and variation unlocks — always offered, never automatic.

## Content & tone

All quotes are local affirmations (self-love, feminine strength, cycle-kindness) mixed with **messages from Muneer** — pickup lines, poems and love notes signed *Jaan(War) 🐯*, all editable in [`quotes.js`](quotes.js). Every string in the app follows one rule: it should read like a love letter, never a critique.

## Run it locally

```
npm start
```

Then open http://localhost:4321

## Deploy

Static files — GitHub Pages (this repo), Netlify, anywhere. On her phone: open the link → **Add to Home Screen**.

## Editing

- Program (days, schemes, cues, swaps, routines, nutrition): [`program.js`](program.js)
- Quotes, poems & Muneer messages: [`quotes.js`](quotes.js)
- Logic: [`app.js`](app.js) · Styles/themes: [`styles.css`](styles.css)
