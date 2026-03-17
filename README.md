# jifBrain

A personal spaced repetition flashcard app, inspired by Duolingo.

## Live App

**[memorybase-neon.vercel.app](https://memorybase-neon.vercel.app)**

Also installable on iPhone as a PWA: open the link in Safari → Share → Add to Home Screen.

---

## Architecture

**Frontend: Next.js (React)**
Next.js, a React framework that handles both the UI and server-side logic (API routes) in one codebase. The app is fully client-rendered with a dark theme and green accents, built as a PWA so it installs on iPhone like a native app.

**Backend/Database: Supabase**
Supabase, a cloud PostgreSQL database, user authentication (email/password), and file storage for card images — all free. Every table has Row Level Security so users can only access their own data. The schema includes: `cards`, `topics`, `card_topics` (many-to-many), `daily_stats`, and `streaks`.

**Hosting: Vercel**
Auto-deploys from GitHub on every push. Environment variables (Supabase keys, Anthropic API key) stored securely in Vercel dashboard.

**Spaced Repetition: SM-2 Algorithm**
The same algorithm used by Anki. After each card review you rate 👎 / 😐 / 👍 and the algo adjusts the card's next review date and difficulty. Implemented in `lib/sm2.ts`.

**PWA (Progressive Web App)**
A `manifest.json` and service worker (`public/sw.js`) make the app installable on iPhone and Android directly from browser, no App Store needed. Gets its own home screen icon, launches fullscreen, and caches assets for basic offline support.

**Streak System**
Daily study goal of 10 cards extends your streak. Two freeze credits per week. Visualised in a monthly calendar view at `/streak`.

**AI Card Generation: Claude API (optional)**
Paste notes or images into the AI Generate page and Claude API returns flashcard pairs to review and save in bulk. Requires an Anthropic API key with preloaded credits at console.anthropic.com.

---

## Making Changes

**1. Start the local development server**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to see the app locally.

**2. Make your changes**
All pages are in `app/`. Edit the relevant file — the browser auto-updates on save.

**3. Push to deploy**
```bash
git add -A
git commit -m "describe your change"
git push
```
Vercel automatically picks up the push and redeploys. Live within ~1 minute.

**Key files**
- `app/dashboard/page.tsx` — home screen
- `app/study/page.tsx` — study session
- `app/cards/page.tsx` — card management
- `app/topics/page.tsx` — topic management
- `app/streak/page.tsx` — streak calendar
- `app/generate/page.tsx` — AI card generation
- `lib/sm2.ts` — spaced repetition algorithm
- `lib/supabase.ts` — Supabase client
