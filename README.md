# Reading App — Proof of Concept (Inception phase)

A **walking skeleton**: the thinnest possible end-to-end slice of the platform,
wired through the real stack we'll scale on. It proves the architecture works
top to bottom before we invest in features.

**The one thread it proves:** sign up → search a book → shelve it with a
status → see it on your profile.

## Stack

- **Next.js 14** (App Router, TypeScript, Server Actions)
- **Supabase** (Postgres + Auth, with Row Level Security)
- **Tailwind CSS**
- **Open Library** API for book data (free, no key needed)

## What's deliberately NOT here yet

Following, feeds, reviews, ratings UI, clubs, messaging — all of that is v1+
in the development plan. The PoC stays tiny on purpose.

---

## Setup (about 10 minutes)

### 1. Prerequisites
- Node.js 18.17+ (`node -v`)
- A free Supabase account → https://supabase.com

### 2. Create a Supabase project
1. New project (pick a region near you, save the database password).
2. In the dashboard go to **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and **Run**. This creates the
   `profiles`, `books`, and `reading_entries` tables, the RLS policies, and a
   trigger that auto-creates a profile on signup.
3. (Optional, easiest for local dev) **Authentication → Providers → Email** →
   turn **"Confirm email" OFF** so you can log in immediately without clicking
   a confirmation link. Turn it back on before launch.

### 3. Configure environment
1. **Project Settings → API** and copy the **Project URL** and the **anon
   public** key.
2. In this folder:
   ```bash
   cp .env.example .env.local
   ```
3. Paste the two values into `.env.local`.

### 4. Install & run
```bash
npm install
npm run dev
```
Open http://localhost:3000 → **Get started** → sign up → **Search** → add a
book → it appears on your shelf.

### 5. Put it under version control
```bash
git init
git add .
git commit -m "chore: walking-skeleton PoC (auth, search, shelf)"
```
(`.env.local` is git-ignored, so your keys stay private.)

---

## How it fits the architecture

| Layer | Where |
|---|---|
| Client + server UI | `src/app/**` (App Router, Server Components) |
| Mutations | Server Actions in `src/app/**/actions.ts` |
| Auth session refresh | `src/middleware.ts` → `src/utils/supabase/middleware.ts` |
| DB access | `src/utils/supabase/{server,client}.ts` |
| External book data | `src/lib/openlibrary.ts` |
| Schema + security | `supabase/schema.sql` |

## Next steps (toward v1 / Elaboration)
1. Relax the `reading_entries` SELECT policy so followers can see each other's
   activity — that unlocks the social **feed**.
2. Add **follow / unfollow** and a `follows` table.
3. Add **ratings** (the column already exists) and a **reviews** table.
4. Flesh out public **profile pages** at `/u/[username]`.

See `../Development Plan & Requirements.md` for the full phased roadmap.
