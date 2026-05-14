# Diamond Verified — Claude Code Context

This file is automatically read by Claude Code at the start of every session. It captures the durable conventions and gotchas of this codebase. Session-specific state (commit hashes, current backlog, what shipped) lives in the per-session handoff docs Dream pastes into Claude.ai chats — not here.

---

## Project

**Diamond Verified** — baseball recruiting platform connecting high school athletes (13–18) with college programs through AI matching, gamified assessments, and multi-tier verification.

- Domain: diamondverified.app (Cloudflare)
- Repo: github.com/dreamhammerllc/baseball-recruiting
- Founder: Dream — non-technical, relies on Claude.ai for technical guidance and Claude Code for direct file writing.

## Tech Stack

Next.js 15.5.15 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres + RLS) · Clerk v7 · Stripe · Vercel Blob · Resend · Anthropic Claude API.

---

## Workflow Rules

- **Auto-accept edits.** Dream's workflow is: plan in Claude.ai → prompt is pasted into Claude Code → Claude Code writes files directly. Never ask Dream to confirm acceptance of edits.
- **Dream is non-technical.** Reasoning, debugging, and design live in Claude.ai. Claude Code's job is to execute clear instructions on the file system.
- **Active worktree:** `C:\Users\dream\Projects\baseball-recruiting` is the main worktree. Other worktrees may exist under `.claude/worktrees/` but are typically not the active line of work.
- **Dev server runs from the main worktree.** Always verify with `pwd` before `npm run dev`. The PowerShell prompt MUST show `PS C:\Users\dream\Projects\baseball-recruiting>` — no `.claude\worktrees\...` suffix. Running the dev server from a worktree directory serves stale code from that worktree's snapshot; HMR appears to work but is rebuilding the wrong files.
- **Dream signs in as Dream Hammer** (`dreamhammerllc@gmail.com`), not Korbin Williams (Clerk's persistent session sometimes bumps to Korbin on dev server restart).
- **PowerShell** is Dream's terminal. Don't assume bash/zsh shortcuts in commands you suggest.
- **Don't preview UI changes** that require auth — Dream will verify in their authenticated browser session. Skipping the preview is the right call when the page is gated by `auth()` + a coach/athlete relationship.

---

## API Route Conventions

Every new API route in `app/api/**/route.ts`:

- Use `await auth()` from `@clerk/nextjs/server` for the user id.
- `export const runtime = 'nodejs'`.
- Use a service-role Supabase client for server reads (the anon key is for browser-side only).
- 500 error shape: `{ error, code, hint, details, stack }`.
- 400 errors: short `{ error: '...' }` with a clear human-readable message (these are surfaced directly in UI).
- **Never use Supabase JOINs across tables.** PGRST125 fires on cross-table JOINs. Use separate queries + JS merge. Pattern lives in `app/api/coach/connections/route.ts` and `app/api/coach/notes/route.ts`.

## Component Conventions

- **Page-specific components co-locate with their page.** Example: `CoachActionBar.tsx` and `CoachAthleteEvaluation.tsx` live next to `app/dashboard/coach/athletes/[athleteId]/page.tsx`.
- **Shared components** go in `components/`.
- **Shared utilities** go in `lib/` (e.g. `lib/time.ts` for `formatRelativeTime`).
- **Function-form setters** for multi-value state: `setX(prev => ({...prev, key: v}))`.
- **Sidebar icons** are inline SVG components in `components/layout/CoachSidebar.tsx` — do NOT introduce `lucide-react` for new icons. Match the existing inline SVG style.
- **Sort logic with nullable values:** nulls always sort to the bottom regardless of direction. See `compareRatings` in `app/dashboard/coach/evaluations/page.tsx`.
- **Type-only imports for utility types:** `import type { SubscriptionTier } from '@/lib/subscription';`. Prevents issues under `verbatimModuleSyntax: true` and is correct practice regardless.

## Filtering & Sorting (UI)

The established pattern across `app/dashboard/coach/athletes/page.tsx` (My Athletes) and `app/dashboard/coach/evaluations/page.tsx` (Evaluations):

- **"Any" sentinel = empty string `''`.** Used both as initial state and as the `<option value="">` for "Any position" / "Any year" / "Any rating". Filter logic short-circuits on empty string.
- **Facets derived from the FULL set, not the filtered set.** Position and grad year dropdowns get their options from the unfiltered data via `useMemo`, with an inline comment marking the intent ("so changing one filter doesn't shrink the others' options").
- **Filter + sort fused into a single `useMemo`** named `visible`. Filter pass first, then spread, then sort. Single dependency array on `[data, filters, sort]`.
- **Null-safe string ops in name search:** use `${e.firstName ?? ''} ${e.lastName ?? ''}` to avoid `"null null"` matches.
- **Filter empty state:** when `data.length > 0 && visible.length === 0`, show a "Clear filters" CTA. Distinct from the never-connected/empty-data empty state.
- **Layout:** flex container, `gap: 0.5rem`. Filter dropdowns left-aligned, spacer `<div style={{ flex: 1 }} />`, sort dropdown right-aligned.

## Migration Conventions

- Migrations live in `supabase/migrations/`.
- Numeric prefix convention: `001_*`, `002_*`, etc.
- Always create a migration file in-repo even when running SQL directly in Supabase SQL Editor — schema must be versioned.
- Use `IF NOT EXISTS` / `DROP POLICY IF EXISTS` for idempotency.
- **Supabase SQL Editor only displays the LAST query's result.** For multi-query verification (e.g. tier counts on multiple tables + constraint inspection in one run), either run each query separately in its own `+` tab, or accept that you'll only see the final result and cross-check via row counts.

## Seed/Probe Scripts

- Live in `scripts/`.
- Use the SELECT-then-skip idempotent pattern (see `scripts/seed-dream-connections.mjs` and `scripts/seed-discover-athletes.mjs`).
- Use the service-role Supabase client from a `dotenv`-loaded `.env.local`.

### Bunny Stream library configuration

Verification and demo videos are hosted on Bunny Stream library `653202` (library name: `diamond-verified`). The library has security settings that affect playback in ways not visible from the codebase — when video playback fails, check these settings FIRST.

**Allowed Domains is a referrer whitelist.** Bunny library 653202 has a list of domains under Security → General → Allowed Domains. Only browsers whose `Referer` header matches a domain on the list can play videos — anything else gets a 403. Current entries: `localhost`, `diamondverified.app`, `*.vercel.app`.

**Rotation checklist when adding a new domain to the app:**
1. Add the new domain to Bunny library 653202 → Security → General → Allowed Domains FIRST
2. Then deploy/launch the app at the new domain
3. Verify playback works from the new domain before announcing

If you skip step 1, videos will silently 403 from the new domain even though the app otherwise looks healthy.

**"Block direct url file access" is ON.** This is the setting that enforces the Allowed Domains referrer check. Keep it ON for production — turning it off means anyone with a video URL can embed and play it from any site. The protection is referrer-based, which is easy to break in dev when adding new local ports, tunnels, or preview domains.

**Token Authentication is OFF.** We do not generate signed URLs. If anyone enables Token Authentication in the Bunny dashboard, all playback breaks immediately until signed URL generation is implemented in the upload pipeline. Don't enable it without a corresponding code change.

**Library ID lives in env, not in code.** The Bunny library ID is read from `NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID` (set to `653202` in `.env.local` and Vercel). Never hardcode `653202` inline in iframe URLs — use the env var. The `getVideoPlaybackInfo` helper in `lib/videoPlayback.ts` handles this correctly; new code that plays Bunny videos should route through that helper.

**First-check rule when video playback fails:** Before investigating code, check the Bunny dashboard's Allowed Domains list. A 403 from `iframe.mediadelivery.net` or the Bunny CDN almost always means a referrer that isn't on the list.

---

## Schema Column Mappings (DB → API response key)

| DB column | API key |
|---|---|
| `home_state` | `state` |
| `gpa_unweighted` | `gpa` |
| `sixty_yard_dash_seconds` | `sixtyYard` |
| `fastball_velocity_mph` | `fbVelo` |
| `exit_velocity_mph` | `exitVelo` |
| `verification_tier` (`> 0`) | `verified` (boolean) |
| `position` | `position` (NOT `primary_position`) |
| `grad_year` | `graduationYear` (NOT `graduation_year`) |
| `photo_url` | `profilePhotoUrl` (NOT `profile_photo_url`) |
| `subscription_tier` | `subscription_tier` (typed `SubscriptionTier`) |

## Schema Gotchas

- **`coach_athlete_connections`** has only 4 columns: `id`, `coach_id` (text — Clerk id), `athlete_id` (text — Clerk id), `connected_at` (NOT `created_at`).
- **`saved_athletes.coach_id`** is uuid (`coaches.id`), DIFFERENT from `coach_athlete_connections.coach_id` which is text. Always confirm column type before writing queries.
- **`coach_athlete_notes.coach_id`** is uuid (matches `saved_athletes` pattern). For coach scouting notes (free-form rating + notes).
- **`coach_evaluations`** is for HS coach references for verification (FK → `hs_coaches.id`), NOT for coach scouting notes. Don't confuse these tables.
- **`athletes.subscription_tier`** is NOT NULL with default `'free'`, CHECK constraint `('free', 'verified', 'elite', 'pro')`. Captured in migration `006_subscription_tier_constraints.sql`. **`coaches.subscription_tier`** has the same constraint and default.
- **RLS predicates** use `auth.jwt() ->> 'sub'` (NOT a `requesting_user_id()` function — that doesn't exist).

## Subscription Tier System

- **Canonical vocab:** `'free' | 'verified' | 'elite' | 'pro'`. Enforced by CHECK constraint on both `athletes.subscription_tier` and `coaches.subscription_tier`.
- **Type:** `SubscriptionTier` exported from `lib/subscription.ts`. Use type-only imports.
- **Helper:** `isPaidTier(tier)` from `lib/subscription.ts` returns `tier != null && tier !== 'free'`.
- **Display labels:** DB value → display label mapping is Scout (`'free'`) / Verified (`'verified'`) / Elite (`'elite'`) / Pro (`'pro'`). Note the DB→display mismatch on the free tier specifically.
- **Live Stripe webhook handler:** `app/api/stripe/webhook/route.ts`. Updates `athletes.subscription_tier` only — `coaches.subscription_tier` is not currently driven by Stripe.
- **Pro tier mapping is env-gated:** the webhook handler maps `STRIPE_PRO_MONTHLY_PRICE_ID` / `STRIPE_PRO_YEARLY_PRICE_ID` to `'pro'` only when those env vars are set. Lets code ship before Pro products exist in Stripe.

### Launch Billing Strategy (as of 2026-05-10)

**Active in live Stripe (4 SKUs):**
- Verified Monthly
- Verified Yearly
- Elite Monthly
- Elite Yearly

**Deferred from launch:**

- **Pro tier** — DB constraint allows `'pro'` and the webhook code (`app/api/stripe/webhook/route.ts`) has env-gated Pro mapping controlled by `STRIPE_PRO_MONTHLY_PRICE_ID` / `STRIPE_PRO_YEARLY_PRICE_ID`. Pro will activate automatically when those env vars are set and corresponding Stripe products exist. For launch: env vars not set, Pro not in live Stripe products, Pro not in pricing UI. `SubscriptionTier` type union retains `'pro'` for forward compatibility.

- **Coach billing** — `coaches.subscription_tier` column exists with NOT NULL default `'free'` and the same constraint as athletes (`free | verified | elite | pro`). No code path writes to it. No Stripe flow for coaches at launch. **Do not propose coach billing flows.** Coaches are intentionally free at launch to drive adoption — coach acquisition is a critical product priority in early stages. Future possibility: charge coaches once athlete base reaches critical mass. No decision yet on tier structure, pricing, or timing.

**Implications for code:**

- Stripe webhook updates only `athletes.subscription_tier`. Correct as-is.
- Pricing UI displays Verified and Elite only. Pro hidden until activated.
- `lib/subscription.ts`'s type union stays as-is — keeps types forward-compatible.
- `isPaidTier(tier)` helper remains correct for both athlete and coach contexts.

## Pitch Proof (`athlete_pitches.proof_url`)

`athlete_pitches.proof_url` is intentionally OPTIONAL at save. No cross-field invariant enforces that `third_party_*` verifications must have proof. This will tighten to a hard requirement when AI auto-verification (#25) ships and consumes proof as input. Do not propose enforcing required-proof until then.

Storage flow: athlete uploads PDF/image via `POST /api/upload-pitch-proof` → file lands in the existing `documents` Supabase Storage bucket at path `${userId}/pitch_proof/${timestamp}_${safeName}` → public URL is returned to the client → client saves URL via `POST`/`PATCH /api/athlete/pitches`. The `documents` bucket is still created manually via Supabase Dashboard (the upload-document route comment documents the setup); pitch proofs reuse the same bucket — no new storage resources required.

Read-only surfacing: coach detail page (`app/dashboard/coach/athletes/[athleteId]/page.tsx`) passes `showProof={true}` to `PitchArsenal`, which surfaces a "View Proof" button per pitch in `PitchCard`. Public profile (`app/profile/[username]/page.tsx`) leaves `showProof` at its `false` default — proof is intentionally NOT surfaced on the public profile. Switching pitch verification away from `third_party_*` in the edit modal hides the proof UI but preserves the stored `proof_url` in DB (matches `source_label` / `video_url` precedent).

## "Verified" Naming Gotcha

Two distinct concepts in this codebase share the word "verified":

- **`subscription_tier`**: a billing label (Scout / Verified / Elite / Pro pricing tiers).
- **`verification_tier`**: an integer indicating how an athlete's metrics have been verified (0 = not verified, > 0 = verified).

Product strategy is verification-based (recruiting trust signal). My Athletes, Saved, AND the athlete detail page all use `verification_tier > 0` for the `◆ Verified` pill. Always check which concept a feature actually wants before writing the query.

---

## Test Accounts

- **Coach (Dream):** clerk_user_id `user_3CeNKQl5i4CqZ16CRSShGV2zGKR`, coaches.id `2ddccdcc-d8f0-40d2-a4c8-2ac73d554dfd`
- **Athlete (Korbin Williams):** clerk_user_id `user_3Cx45lltJlEnKk4A4vGgMejEUgg`
- **25 seed athletes:** clerk_user_id prefix `seed_test_*`. Distribution: 6P / 3CF / 2RF / 2LF / 1 1B / 1 2B / 2 3B / 2 SS / 3 C / 3 DH; 6CA + 3 each TX/FL/GA + 9 other states; grad years 2026–2031.

---

## Privacy & Safety

- **Athletes are minors (13–18).** Don't suggest features that expose contact info publicly without parental-consent gating.
- **Public profile contact info** is connection-only (QR/invite flows). Never expose on the public profile page.
- **No real keys/secrets in chat or commits.** Credentials live in `.env.local` and Vercel env vars (prod) only.
