# SwoleSammy 💪💕

Sammy's cycle-synced training app, period tracker and gym notepad. Mobile-first, works **offline**, saves everything **on the device** (no login, no servers).

*Made with Love by your jaan(war).*

## Tabs

- **Today** — daily motivation quote (fresh from the net when online), the right session for today based on her cycle week, tick-off checklist with weight/reps logging, **"Last: …" memory** under each exercise, form cues on tap (ⓘ), warm-up, cardio, mood/symptom/daily-target check-in, free **notes box** (for crowded-gym improvising) with her recent notes one tap away, posture routine, and a celebratory finish button.
- **Cycle** — period tracker: "period started/ended" buttons, cycle ring showing the day & phase, **predicted next period** (from her real average cycle length), month calendar (period days, expected days, logged days), period history. Holds on Week 4 if a cycle runs long — PCOS-friendly.
- **Progress** — sessions this week/month, weekly streak, total; **strength curve chart** per exercise; personal bests; recent days with notes; **"Share an update"** button (WhatsApp-ready summary).
- **Plan** — the full Elite Program: training split, weekly schedule, hormone structure, all 4 training days with per-week schemes, progression rules, nutrition targets, posture work, coach's notes.
- **Settings** — name, backup export/import, reset.

## Run it locally

```
npm start
```

Then open http://localhost:4321

To open it on a phone on the same Wi-Fi: find this PC's IP (`ipconfig` → IPv4 Address) and open `http://<that-ip>:4321` on the phone (allow Node through the Windows firewall if prompted).

## Put it on her phone permanently (recommended)

Host the folder on any free static host, open the link on her phone, then **Add to Home Screen** → it installs like a real app and works offline:

- **GitHub Pages** (same as the RHN protocol site): create a repo (e.g. `swolesammy`), push these files, enable Pages → `https://<user>.github.io/swolesammy/`
- **Netlify Drop**: drag this folder onto https://app.netlify.com/drop
- Vercel / Cloudflare Pages also work — everything is static.

## Seeing her progress (for the coach 👀)

Her data lives on her phone only. Three ways to see it:

1. She taps **Progress → 💌 Share an update** — sends a summary via WhatsApp/etc.
2. She exports a backup (**Settings → Export backup**) and sends you the file; import it in your copy of the app to browse everything.
3. Look over her shoulder. Recommended.

True live sync between phones would need a small backend — can be added later if you want it.

## Editing the program

All training content is in [`program.js`](program.js) — phases, days, exercises, schemes, cues, targets, quotes are in [`quotes.js`](quotes.js).
