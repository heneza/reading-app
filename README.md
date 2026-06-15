# Reading App

A Letterboxd-style social reading app for tracking books, sharing reviews and
posts, building lists, and finding other readers.

The app is built as a real full-stack prototype: Supabase handles auth,
database, storage, row-level security, and realtime updates; Next.js handles the
UI, server actions, API routes, and deployment.

## Current Features

- Email/password auth, username login, Google sign-in, and post-signup onboarding.
- Optional Cloudflare Turnstile CAPTCHA and Resend welcome emails for production signup.
- Search for books and authors through Open Library, with local quick suggestions
  for books, authors, users, and posts.
- Public profiles with shelves, favourites, favourite genres, ratings, reviews,
  recent activity, follows, followers, and optional social/soundtrack links.
- Reading shelves for `reading`, `want to read`, `read`, and `dnf`.
- Star ratings, reviews, review comments, reactions, content warnings, and share
  links.
- Social posting, articles, reposts, post comments, and likes/dislikes.
- Reader-made book lists.
- Direct messages, read receipts, realtime notifications, and privacy controls.
- Reading diary and reading goals.
- Saved quotes with notes, tags, privacy, and filtering.
- CSV/JSON import from Goodreads, StoryGraph, and Hardcover.
- JSON account export and account deletion.
- Light/dark theme setting.
- Optional Gemini-powered reading assistant.
- Optional profile soundtrack link; full Spotify OAuth is a later music-phase item.

## Stack

- Next.js 14 App Router
- React 18 and TypeScript
- Server Actions and Route Handlers
- Supabase Auth, Postgres, Storage, RLS, and realtime
- Tailwind CSS
- Open Library API for public book metadata
- Vitest for focused library tests

## Local Setup

### 1. Prerequisites

- Node.js 18.17+
- npm
- A Supabase project
- Optional: a Gemini API key for the reading assistant

### 2. Environment

Copy the example file and fill in the Supabase values from
Supabase Dashboard -> Project Settings -> API.

```bash
cp .env.example .env.local
```

Required:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Optional, only for the assistant:

```bash
GEMINI_API_KEY=YOUR-GEMINI-KEY
GEMINI_MODEL=gemini-2.5-flash-lite
```

Optional, for production signup hardening and welcome emails:

```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY=YOUR-TURNSTILE-SITE-KEY
TURNSTILE_SECRET_KEY=YOUR-TURNSTILE-SECRET-KEY
RESEND_API_KEY=YOUR-RESEND-KEY
EMAIL_FROM=Reading App <onboarding@yourdomain.com>
```

### 3. Database

For a fresh Supabase project, open SQL Editor and run:

1. `supabase/schema.sql`
2. The numbered files in `supabase/` in order, from `02_reviews.sql` onward.

The SQL files create the app tables, indexes, triggers, storage policies, and
row-level security rules.

### 4. Auth Settings

In Supabase Auth, configure redirect URLs for local and production:

```text
http://localhost:3000/auth/callback
https://YOUR-VERCEL-DOMAIN/auth/callback
```

For Google sign-in, enable the Google provider in Supabase and add the provider
credentials there.

Email confirmation can be controlled in Supabase Auth settings. It can be off
for local testing and on for production.

### 5. Run The App

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev      # start local dev server
npm run build    # create production build
npm run start    # run production build
npm run lint     # Next.js ESLint checks
npm test         # Vitest tests
```

## Deploying

The project is ready for Vercel.

1. Connect the GitHub repository to Vercel.
2. Add the same environment variables from `.env.local` to Vercel.
3. Add the production `/auth/callback` URL in Supabase Auth settings.
4. Push to `main`.

Vercel will build and deploy the latest commit automatically.

## Project Map

| Area | Path |
| --- | --- |
| App routes and pages | `src/app/**` |
| Shared UI components | `src/components/**` |
| Server actions | `src/app/actions/**` and route-specific `actions.ts` files |
| Supabase clients | `src/utils/supabase/**` |
| Book metadata helpers | `src/lib/openlibrary.ts` |
| Sanitizing, usernames, genres, time helpers | `src/lib/**` |
| Database schema and migrations | `supabase/**` |

## Near-Term Product Backlog

These are the larger product items still worth planning before implementation:

- Real outbound notification emails and digest scheduling.
- Full Spotify OAuth, playlist linking, and book soundtracks.
- AI-detection policy for articles. This should be treated carefully because
  AI detectors can be unreliable; a moderation review flow is safer than an
  automatic takedown.
- Clubs, buddy reads, spoiler-aware discussions, and reporting/moderation tools.
