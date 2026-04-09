# Sclearn

Mobile-first flashcards: sign in, paste notes, generate a deck (mock or OpenAI via a **secure Edge Function**), and learn with TikTok-style scrolling. Decks are stored in **Supabase** per user.

Stack: **Vite**, **React**, **TypeScript**, **Tailwind CSS**, **Supabase** (Auth + Postgres + Edge Functions).

## Frontend setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

- `VITE_SUPABASE_URL` — Project URL (Settings → API)
- `VITE_SUPABASE_PUBLISHABLE_KEY` — **Publishable** key (`sb_publishable_…`, safe for the browser)
- `VITE_POSTHOG_KEY` — (Optional) PostHog project API key for product analytics; omit to disable client analytics

On **Railway** (or any host), set the same `VITE_*` variables in the deployment environment so they are baked in at build time.

**Do not** put `OPENAI_API_KEY` in Vite env vars; it must only exist on the server (Edge Function secret).

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Supabase: database and auth

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Providers**: enable **Email**.
3. **SQL Editor**: run the migration in `supabase/migrations/20250331000000_initial_schema.sql` (or use CLI: `supabase db push`).

This creates `profiles` (auto-filled on signup via trigger), `flashcards`, and **RLS** so users only access their own rows.

Run `supabase/migrations/20250331100000_usage_logs.sql` as well (or `supabase db push`): it adds **`usage_logs`** and RPCs used to enforce a **per-user daily AI generation limit** (UTC) in the Edge Function before OpenAI is called.

## Supabase Edge Function (OpenAI)

The function `generate-flashcards`:

- **Does not** rely on gateway JWT verification (`verify_jwt = false` in `supabase/config.toml`; turn **Verify JWT** off for this function in the dashboard if it overrides deploy).
- Reads **`Authorization: Bearer <access_token>`** and validates the user with **`supabase.auth.getUser()`** inside the function.
- Calls OpenAI with **`OPENAI_API_KEY`** from Edge secrets (never exposed to the client).

### Deploy (Supabase CLI)

```bash
# one-time: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase secrets set OPENAI_API_KEY=sk-...

supabase functions deploy generate-flashcards
```

Hosted functions inject **`SUPABASE_URL`** and typically **`SUPABASE_ANON_KEY`** (still usable as the public client key during migration). To align with the publishable key model, you can set:

```bash
supabase secrets set SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The function uses **`SUPABASE_PUBLISHABLE_KEY` if set**, otherwise **`SUPABASE_ANON_KEY`**, for the Auth client used with `getUser`.

For local testing:

```bash
supabase start
supabase secrets set OPENAI_API_KEY=sk-... --env-file supabase/.env.local
supabase functions serve generate-flashcards
```

Point `VITE_SUPABASE_URL` at local stack if needed ([local development docs](https://supabase.com/docs/guides/functions/local-development)).

### Client requests

The app calls the function with **`fetch`**, sending:

- **`apikey`**: same value as `VITE_SUPABASE_PUBLISHABLE_KEY`
- **`Authorization`**: `Bearer <user access_token>` when the user is signed in (required for AI generation)

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — Typecheck + production build → `dist/`
- `npm run preview` — Preview production build
- `npm run lint` — ESLint

## Routes

- `/` — Marketing landing page
- `/app` — Input + generate (requires sign-in)
- `/learn` — Load saved flashcards from Supabase + scroll
- `/login`, `/register` — Email/password auth
- `/privacy`, `/terms` — Privacy Policy and Terms of Service (footer links)

## Troubleshooting: Edge Function `401`

1. **Signed in** — AI generation requires a session. Sign out and sign in again.
2. **Email confirmation** — If Auth requires confirmed email, unconfirmed users may not get a usable token.
3. **Same project** — `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` must match the project where the function is deployed and where the user signed up.
4. **Headers** — Requests must include **`apikey`** (publishable) and **`Authorization: Bearer <access_token>`**. See `src/lib/generateFlashcardsApi.ts`.
5. **Dashboard** — For `generate-flashcards`, **Verify JWT** should be **off** so the gateway does not reject tokens before your function runs; auth is enforced inside the function.
6. **Redeploy** — After changing secrets or function config: `supabase functions deploy generate-flashcards`.

## Security notes

- **Secret / service role** keys must never ship in the frontend; the app only uses the **publishable** key client-side.
- OpenAI calls happen **only** inside the Edge Function.
- For production, consider tightening CORS on the Edge Function and rate limiting.
