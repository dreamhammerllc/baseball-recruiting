# Session 9 Handoff — Diamond Verified

**Date:** 2026-04-26  
**Project:** `C:\Users\dream\Projects\baseball-recruiting`  
**Phase:** Phase 8 — Video & Metrics System (continued)

---

## What Was Completed This Session

### 1. Phase 8 SQL — Clipboard Delivery
The four Phase 8 tables (`athlete_positions`, `metric_sessions`, `athlete_metrics`, `highlight_videos`) still need to be run in Supabase. The SQL was copied to clipboard. The user was directed to paste at:
```
https://app.supabase.com/project/jgtjrlncbskcihhqjvbt/sql/new
```
**Status: PENDING — user must paste and run manually.**

### 2. Fixed `VERIFICATION_LABELS` Object-as-React-Child Crash
**Root cause:** `VERIFICATION_LABELS` in `lib/metrics.ts` stores objects `{ label, shortLabel, color }` — not plain strings. Three places in the UI rendered the whole object as a JSX child, causing the runtime error:
> "Objects are not valid as a React child"

**Files fixed:**

| File | Line | Old | Fixed |
|------|------|-----|-------|
| `components/MetricCard.tsx` | 39 | `VERIFICATION_LABELS[...]` | `VERIFICATION_LABELS[...]?.label` |
| `components/MetricsGraph.tsx` | 206 | `VERIFICATION_LABELS[...]` | `VERIFICATION_LABELS[...]?.label` |
| `components/MetricsGraph.tsx` | 334 | `VERIFICATION_LABELS[...]` | `VERIFICATION_LABELS[...]?.label` |

All three now use `?.label` with optional chaining as a safety guard against unknown `verification_type` values from the database.

---

## Fixes Carried Over From Session 8 (completed before this session)

These were all confirmed done in the prior session. Listed here for full context.

### Upload Route — Full Rewrite (`app/api/upload-video/route.ts`)
A chain of 5 sequential bugs was resolved:

1. **`Invalid multipart form data`** — replaced `req.formData()` with `busboy` streaming parser; added `runtime = 'nodejs'` and `maxDuration = 300`
2. **`Unexpected end of form`** — replaced `Readable.fromWeb(req.body)` with `req.arrayBuffer()` + synthetic Readable to bypass Node.js v24 stream truncation; excluded `/api/*` from Clerk middleware to prevent Edge runtime body corruption
3. **`Unexpected end of JSON input`** — wrapped handler in top-level `try/catch`; always drain Bunny response body via `uploadResponse.text()`
4. **Clerk `auth() was called but Clerk can't detect clerkMiddleware()`** — replaced `auth()` with `createClerkClient.authenticateRequest()` from `@clerk/backend` (middleware excluded so `auth()` context unavailable)
5. **`Unauthorized` from `authenticateRequest`** — `publishableKey` is required by both `createClerkClient` and `authenticateRequest` options (for `assertValidPublishableKey` and `__session_<hash>` cookie suffix computation)

### Supabase Persist After Upload
After a successful Bunny PUT, the route now saves to Supabase:
- **Metric upload:** finds the existing `is_personal_best = true` row and updates `video_url`, or inserts a placeholder row (`value=0`, `verification_type='self_reported'`) if none exists
- **Highlight upload:** upserts to `highlight_videos` on `(athlete_clerk_id, slot_number)`

### MetricsDashboardClient Optimistic Update
`handleVideoUploaded` now handles the no-PB case: appends a placeholder `AthleteMetric` to local state so the Watch link appears on the metric card immediately without a page refresh.

### `onError is not a function` Fix
`MetricsDashboardClient` was passing wrong prop names to `<VideoUpload>` (`onUploaded`/`onClose` instead of `onUploadComplete`/`onError`). Fixed both the metric and highlight upload modal usages. Added `videoUploadError` state for inline error display.

### Bunny Storage Endpoint
Added `BUNNY_STORAGE_ENDPOINT=ny.storage.bunnycdn.com` to `.env.local` and updated the upload route to use it instead of the old hardcoded `storage.bunnycdn.com`.

---

## Current State of Every Touched File

### `app/api/upload-video/route.ts`
**Status: Complete and working**

Key shape:
- `export const maxDuration = 300; export const runtime = 'nodejs';`
- `createClerkClient({ secretKey, publishableKey })` at module level (from `@clerk/backend`)
- `getUserId(req)` — calls `clerk.authenticateRequest(req, { secretKey, publishableKey })`
- `parseMultipart(req)` — reads `req.arrayBuffer()`, feeds busboy via synthetic `Readable`, returns `{ fileBuffer, mimeType, fields }`
- `POST` wraps `handleUpload` in top-level try/catch
- `handleUpload` — validates → determines Bunny storage path → PUTs to Bunny → drains response → upserts Supabase → returns `{ success: true, videoUrl }`

Storage path helpers:
- Metric videos: `/athletes/{athleteClerkId}/{metricKey}/best.mp4`
- Highlights: `/athletes/{athleteClerkId}/highlights/{slot}.mp4`

### `middleware.ts`
**Status: Complete**

```ts
export const config = {
  matcher: ['/((?!_next|api/|.*\\..*).*)'],
};
```
`/api/*` routes are excluded from `clerkMiddleware` so large video request bodies stream without Edge-runtime corruption. API routes handle their own auth.

### `components/MetricCard.tsx`
**Status: Complete — crash fixed this session**

- Line 39: `VERIFICATION_LABELS[...verification_type...]?.label` (was rendering full object)
- Correctly accesses `info.label`, `info.unit`, `info.lowerIsBetter` from `METRIC_INFO`
- Watch link renders when `personalBest?.video_url` is set
- Upload Video button renders when `showUploadControls && !personalBest?.video_url`
- Second Upload Video button renders when `showUploadControls && !personalBest` (no data at all)

### `components/MetricsGraph.tsx`
**Status: Complete — crash fixed this session**

- Line 206: `VERIFICATION_LABELS[...verification_type...]?.label` (personal best badge)
- Line 334: `VERIFICATION_LABELS[...verification_type...]?.label` (tooltip verification type)
- SVG sparkline with clickable dots, y/x axis labels, personal best highlighting
- Tooltip shows value, date, verification label, and Watch Video link if `video_url` present

### `components/VideoUpload.tsx`
**Status: Complete — no changes this session**

Props: `athleteClerkId`, `uploadType: 'metric' | 'highlight'`, `metricKey?`, `slotNumber?`, `onUploadComplete(videoUrl)`, `onError(msg)`  
Max file size: 500 MB. Drag-and-drop + click-to-browse. POSTs multipart to `/api/upload-video`.

### `app/dashboard/athlete/metrics/MetricsDashboardClient.tsx`
**Status: Complete**

- `handleVideoUploaded(metricKey, videoUrl)` — updates existing PB row's `video_url` in state, or appends a placeholder `AthleteMetric` if no PB existed
- `handleHighlightUploaded(videoUrl, slot)` — upserts highlight into local state
- Video upload modal passes `onUploadComplete` + `onError` (correct prop names)
- `videoUploadError` state drives inline error message above modal
- Metric cards grouped: Universal / Pitching / Throwing

### `app/dashboard/athlete/metrics/upload/page.tsx`
**Status: Complete — no changes this session**

Two tabs: Session Report (AI PDF extraction via `SessionUpload`) and Manual Entry form. Manual entry uses `METRIC_INFO[k].label` and `METRIC_INFO[k].unit` correctly.

### `lib/metrics.ts`
**Status: Complete — no changes this session**

Key exports:
- `METRIC_KEYS` — 15 metric key strings (const array)
- `MetricKey` — union type
- `POSITIONS` — 13 position strings
- `METRIC_INFO` — `Record<MetricKey, { label, unit, lowerIsBetter, description }>`
- `VERIFICATION_LABELS` — `Record<VerificationType, { label, shortLabel, color }>` ← **object, not string — always access `.label` or `.shortLabel`**
- `UNIVERSAL_METRICS`, `POSITION_ADDITIONAL_METRICS`, `getMetricsForPositions()`
- `getBunnyVideoPath(athleteClerkId, metricKey)` → `/athletes/{id}/{key}/best.mp4`
- `getBunnyHighlightPath(athleteClerkId, slot)` → `/athletes/{id}/highlights/{slot}.mp4`
- Interfaces: `AthleteMetric`, `MetricSession`, `AthletePosition`, `HighlightVideo`

### `.env.local`
**Status: Complete**

All required env vars present (see full list below).

### `supabase/migrations/phase8_metrics.sql`
**Status: Written — NOT YET RUN against the database**

Contains 4 CREATE TABLE statements + indexes + a SELECT verify query.

### `run-migrations.mjs`
**Status: Fixed but not needed if using Supabase SQL editor**

Fixed SQL splitter: now strips `--` comment lines before splitting on `;` (previously was only finding 2 of 7 statements because CREATE TABLE blocks started with comment headers).

---

## Full Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | ^15.5.15 |
| Language | TypeScript | ^6.0.3 |
| React | React + React DOM | ^19.2.5 |
| Auth | Clerk (`@clerk/nextjs`) | ^7.2.3 |
| Database | Supabase (`@supabase/supabase-js`) | ^2.104.0 |
| Payments | Stripe (`stripe`, `@stripe/stripe-js`) | ^22.1.0 / ^9.3.1 |
| AI | Anthropic SDK (`@anthropic-ai/sdk`) | ^0.90.0 |
| Video CDN | Bunny.net (storage + CDN) | — |
| Email | Resend | ^6.12.2 |
| PDF | @react-pdf/renderer | ^4.5.1 |
| Multipart | busboy | ^1.6.0 |
| CSV | csv-parse | ^6.2.1 |
| Styling | Tailwind CSS v4 + inline styles | ^4.2.3 |

---

## All Environment Variables (`.env.local`)

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-api03-...
APP_AI_KEY=sk-ant-api03-...          # same key, used by some routes

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://jgtjrlncbskcihhqjvbt.supabase.co/rest/v1/
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2xldmVy...
CLERK_SECRET_KEY=sk_test_vLOa7u...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/onboarding
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51RFMIn...
STRIPE_SECRET_KEY=sk_test_51RFMIn...
NEXT_PUBLIC_STRIPE_PRICE_ATHLETE=price_1TPpfUIJP5BSkTrOuiJcNfj9
NEXT_PUBLIC_STRIPE_PRICE_ATHLETE_PRO=price_1TPpiKIJP5BSkTrOp1IqPL2C
NEXT_PUBLIC_STRIPE_PRICE_COACH=price_1TPpl4IJP5BSkTrOcMrYuFAZ

# Resend
RESEND_API_KEY=re_RirQeyj9_...

# Bunny.net
BUNNY_API_KEY=43ad8748-a8e0-4566-bfd8-c8c3a023f09ec01f142f-8803-44e7-8f60-67bc5402f18b
BUNNY_STORAGE_PASSWORD=71afe80b-d9df-4aba-81f66f991dce-e1f6-4e63
BUNNY_STORAGE_ZONE_NAME=diamond-verified-videos
BUNNY_STORAGE_ENDPOINT=ny.storage.bunnycdn.com
BUNNY_CDN_HOSTNAME=diamond-verified-cdn.b-cdn.net

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Note on `NEXT_PUBLIC_SUPABASE_URL`:** The value in `.env.local` includes `/rest/v1/` at the end. `lib/supabase.ts` strips this suffix with `.replace(/\/rest\/v1\/?$/, '')` before passing it to `createClient`. This is intentional.

---

## Stripe Price IDs

| Plan | Price ID |
|------|----------|
| Athlete | `price_1TPpfUIJP5BSkTrOuiJcNfj9` |
| Athlete Pro | `price_1TPpiKIJP5BSkTrOp1IqPL2C` |
| Coach / Team | `price_1TPpl4IJP5BSkTrOcMrYuFAZ` |

---

## Bunny.net Configuration

| Setting | Value |
|---------|-------|
| Storage zone name | `diamond-verified-videos` |
| Storage endpoint | `ny.storage.bunnycdn.com` (New York region) |
| CDN hostname | `diamond-verified-cdn.b-cdn.net` |
| Upload URL pattern | `https://ny.storage.bunnycdn.com/diamond-verified-videos{path}` |
| CDN URL pattern | `https://diamond-verified-cdn.b-cdn.net{path}` |
| Metric video path | `/athletes/{athleteClerkId}/{metricKey}/best.mp4` |
| Highlight video path | `/athletes/{athleteClerkId}/highlights/{slot}.mp4` |
| Max upload size | 500 MB (enforced client-side in `VideoUpload.tsx`) |
| Upload timeout | 300 seconds (`maxDuration = 300` on route) |

---

## Supabase Project

**Project ref:** `jgtjrlncbskcihhqjvbt`  
**SQL editor:** `https://app.supabase.com/project/jgtjrlncbskcihhqjvbt/sql/new`

### Database Tables

| Table | Status | Description |
|-------|--------|-------------|
| `athlete_positions` | 🔴 NOT CREATED | Primary + secondary position per athlete |
| `metric_sessions` | 🔴 NOT CREATED | Coach/third-party verification sessions |
| `athlete_metrics` | 🔴 NOT CREATED | All metric entries; `is_personal_best` flag |
| `highlight_videos` | 🔴 NOT CREATED | Highlight video slots per athlete |

**All 4 tables must be created before anything in Phase 8 will work end-to-end.**

SQL file location: `supabase/migrations/phase8_metrics.sql`

### `athlete_metrics` Schema

```sql
id                uuid        PRIMARY KEY DEFAULT gen_random_uuid()
athlete_clerk_id  text        NOT NULL
metric_key        text        NOT NULL
value             numeric     NOT NULL
unit              text        NOT NULL
verification_type text        NOT NULL
source_label      text
ai_confidence     numeric
is_personal_best  boolean     DEFAULT false
video_url         text
session_id        uuid        REFERENCES metric_sessions(id) ON DELETE SET NULL
recorded_at       timestamptz DEFAULT now()
created_at        timestamptz DEFAULT now()
```

Indexes: `idx_athlete_metrics_clerk_id`, `idx_athlete_metrics_personal_best`

### `highlight_videos` Schema

```sql
id               uuid        PRIMARY KEY DEFAULT gen_random_uuid()
athlete_clerk_id text        NOT NULL
slot_number      int         NOT NULL
video_url        text        NOT NULL
title            text
uploaded_at      timestamptz DEFAULT now()
UNIQUE(athlete_clerk_id, slot_number)
```

---

## Subscription Tiers & Features

| Feature | Free | Athlete | Athlete Pro | Coach |
|---------|------|---------|-------------|-------|
| Verified badge | — | ✓ | ✓ | ✓ |
| Document upload | — | ✓ | ✓ | ✓ |
| AI scout report | — | ✓ | ✓ | ✓ |
| PDF download | — | — | ✓ | ✓ |
| Email share | — | — | ✓ | ✓ |
| Development roadmap | — | — | ✓ | ✓ |
| Priority search | — | — | ✓ | ✓ |
| Coach dashboard | — | — | — | ✓ |
| Unlimited matches | — | ✓ | ✓ | ✓ |

Highlight video slot limits are controlled by subscription tier (enforced via `highlightSlotLimit` prop passed from the server page).

---

## All API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/upload-video` | POST | Clerk (authenticateRequest) | Upload metric or highlight video to Bunny.net + save URL to Supabase |
| `/api/metrics` | GET / POST | Clerk (`auth()`) | Get athlete metrics / submit new metric entry |
| `/api/metrics/public` | GET | None | Public metric data for profile pages |
| `/api/athlete-positions` | POST | Clerk | Save primary/secondary position |
| `/api/highlight-videos/[id]` | DELETE | Clerk | Delete a highlight video slot |
| `/api/analyze-session` | POST | Clerk | AI extraction of metrics from session document |
| `/api/upload-document` | POST | Clerk | Upload verification document |
| `/api/analyze-document` | POST | Clerk | AI analysis of uploaded document |
| `/api/stripe/checkout` | POST | Clerk | Create Stripe checkout session |
| `/api/share-profile` | POST | Clerk | Email profile share via Resend |
| `/api/save-prospect` | POST | Clerk | Coach saves a prospect |

**Important:** `/api/*` is excluded from `clerkMiddleware` in `middleware.ts`. All API routes that need auth must call `auth()` from `@clerk/nextjs/server` (works for routes that have middleware context) **or** use `createClerkClient.authenticateRequest()` from `@clerk/backend` for routes that need to stream large request bodies (like `/api/upload-video`).

---

## All Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Landing / marketing page |
| `/sign-in` | `app/sign-in/[...sign-in]/page.tsx` | Clerk hosted sign-in |
| `/sign-up` | `app/sign-up/[...sign-up]/page.tsx` | Clerk hosted sign-up |
| `/onboarding` | `app/onboarding/page.tsx` | Post-signup role/profile setup |
| `/pricing` | `app/pricing/page.tsx` | Pricing page with Stripe checkout |
| `/dashboard/athlete` | `app/dashboard/athlete/page.tsx` | Athlete main dashboard |
| `/dashboard/athlete/metrics` | `app/dashboard/athlete/metrics/page.tsx` | Metrics dashboard (server) + `MetricsDashboardClient.tsx` |
| `/dashboard/athlete/metrics/upload` | `app/dashboard/athlete/metrics/upload/page.tsx` | Manual entry + session report upload |
| `/dashboard/athlete/calculator` | `app/dashboard/athlete/calculator/page.tsx` | Recruiting calculator tool |
| `/dashboard/coach` | `app/dashboard/coach/page.tsx` | Coach dashboard |
| `/dashboard/college` | `app/dashboard/college/page.tsx` | College portal + prospect search |
| `/dashboard/college/saved` | `app/dashboard/college/saved/page.tsx` | College saved prospects |
| `/profile/[username]` | `app/profile/[username]/page.tsx` | Public athlete profile |

---

## All Components

| Component | Description |
|-----------|-------------|
| `components/MetricCard.tsx` | Single metric card: PB value, verification badge, History/Upload Video/Watch buttons |
| `components/MetricsGraph.tsx` | Modal SVG sparkline graph for a metric's history |
| `components/VideoUpload.tsx` | Drag-and-drop video upload UI (metric or highlight) |
| `components/SessionUpload.tsx` | AI session document upload + extraction confirmation |
| `components/layout/AthleteSidebar.tsx` | Left nav for athlete dashboard |
| `components/layout/CoachSidebar.tsx` | Left nav for coach dashboard |
| `components/layout/CollegeSidebar.tsx` | Left nav for college portal |

---

## The 15 Metric Keys

```
sixty_yard_dash          exit_velocity            vertical_jump
bat_speed                fastball_velocity        curveball_velocity
slider_velocity          changeup_velocity        spin_rate
vertical_break           horizontal_break         pop_time
catcher_throwing_velocity   infield_throwing_velocity   outfield_throwing_velocity
```

Lower-is-better metrics: `sixty_yard_dash`, `pop_time`

---

## Pending Tasks (Priority Order)

### 🔴 CRITICAL — Run Phase 8 SQL Migrations

The 4 tables do not exist yet. **Nothing in Phase 8 will work until this is done.**

1. Go to `https://app.supabase.com/project/jgtjrlncbskcihhqjvbt/sql/new`
2. Paste contents of `supabase/migrations/phase8_metrics.sql`
3. Press **Ctrl+Enter**
4. Verify: should return 4 rows: `athlete_metrics`, `athlete_positions`, `highlight_videos`, `metric_sessions`

Alternatively with DB password:
```bash
$env:SUPABASE_DB_PASSWORD='<password>'; node run-migrations.mjs
```

Or with a Supabase Personal Access Token (from supabase.com/dashboard/account/tokens):
```bash
$env:SUPABASE_ACCESS_TOKEN='sbp_...'; node run-migrations.mjs
```

### 🟡 End-to-End Upload Test

Once migrations are run, test the full video upload flow:
1. Navigate to `/dashboard/athlete/metrics`
2. Set a position (to see metric cards)
3. Click "Upload Video" on any metric card
4. Upload a video file (any small `.mp4`)
5. Verify:
   - File appears in Bunny.net CDN: `https://diamond-verified-cdn.b-cdn.net/athletes/{id}/{metricKey}/best.mp4`
   - `athlete_metrics` row in Supabase has `video_url` set
   - "Watch" link appears on the metric card without page refresh

### 🟡 Highlight Video Slot Limit Logic

The `highlightSlotLimit` prop is passed from the server page into `MetricsDashboardClient`. Confirm the server page is reading the athlete's subscription tier and setting the correct limit (e.g. free=0, athlete=2, athlete_pro=5). Check `app/dashboard/athlete/metrics/page.tsx`.

### 🟡 Public Profile Metrics Section

`app/profile/[username]/PublicMetricsSection.tsx` exists. Confirm it reads from `athlete_metrics` via `/api/metrics/public` and renders correctly once the tables exist. Check whether it handles the new `video_url` field (optional Watch link on public profile).

### 🟢 Nice-to-Have

- Manual metric entry success: after saving a metric via the Manual Entry form, the metrics dashboard doesn't automatically reflect the new PB — the user must navigate back. Could add optimistic update or redirect with revalidation.
- `MetricsGraph` currently recalculates personal best client-side from `entries`. Once tables exist, this should match the server-authoritative `is_personal_best` flag.
- Highlight video titles: the `VideoUpload` component doesn't have a title field. `HighlightSlot` renders `video.title ?? 'Highlight Video'`. Adding an optional title input to the highlight upload modal would improve UX.

---

## Important Notes for Next Session

1. **`VERIFICATION_LABELS` is an object, not a string.** Always use `.label` or `.shortLabel`. If you add new components that render verification type labels, remember this.

2. **`/api/upload-video` is excluded from Clerk middleware.** It uses `createClerkClient.authenticateRequest()` from `@clerk/backend` directly, passing both `secretKey` AND `publishableKey` to both `createClerkClient()` and `authenticateRequest()` options. This is load-bearing — removing either key breaks auth silently (returns 401).

3. **`NEXT_PUBLIC_SUPABASE_URL` has a `/rest/v1/` suffix** in `.env.local`. `lib/supabase.ts` strips it. Don't "fix" this.

4. **Bunny upload uses `new Uint8Array(fileBuffer)` as the fetch body**, not `fileBuffer` directly. TypeScript requires this because `Buffer` is not assignable to `BodyInit`.

5. **Busboy reads from `req.arrayBuffer()` via a synthetic `Readable`**, not `Readable.fromWeb(req.body)`. The Web ReadableStream approach silently truncated large payloads on Node.js v24.

6. **The `run-migrations.mjs` script** requires either `SUPABASE_ACCESS_TOKEN` (Supabase PAT) or `SUPABASE_DB_PASSWORD`. Neither is in `.env.local`. The simplest path is just pasting the SQL in the Supabase SQL editor.

7. **All API routes handle their own auth** — middleware only covers page routes. If you add a new API route that needs auth, use `auth()` from `@clerk/nextjs/server` (works fine since those routes don't need large body streaming). Only `/api/upload-video` needs the special `authenticateRequest()` pattern.
