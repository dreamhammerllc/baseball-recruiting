# Session 10 Handoff — Diamond Verified

**Date:** 2026-04-26  
**Project:** `C:\Users\dream\Projects\baseball-recruiting`  
**Phase:** Phase 8 Core — ✅ COMPLETE. Next: Phase 8C (third-party integrations) + Phase 9 (coach verification)

---

## What Was Completed This Session

### 1. Two-Step Metric Video Upload Modal (`MetricsDashboardClient.tsx`)

The video upload modal for metric cards now has two phases:

**Phase "upload"** — existing `VideoUpload` drag-and-drop UI, unchanged.

After upload completes:
- If athlete **had an existing PB** → video is attached to the PB row, modal closes immediately. No value step needed.
- If athlete **had no PB** → server created a `value=0` placeholder. Modal transitions to Phase "value".

**Phase "value"** — shows:
- "Video uploaded!" heading
- `[metric label]` number input + unit label
- **Save** button — calls `PATCH /api/metrics`, updates optimistic state, closes modal
- **Skip** button — closes modal, leaves `value=0` placeholder in DB

State variables added to `MetricsDashboardClient`:
```ts
metricUploadPhase: 'upload' | 'value'   // which step the modal is on
metricValueInput: string                 // controlled input
metricValueSaving: boolean              // Save button disabled state
metricValueError: string | null         // inline error below input
```

Helper functions added:
- `openMetricUploadModal(key)` — resets to 'upload' phase, opens modal
- `openMetricValueModal(key)` — sets phase directly to 'value', opens modal (used by Enter Value button)
- `closeMetricUploadModal()` — clears all phase/input/error state, closes modal
- `handleMetricValueSave()` — calls `PATCH /api/metrics`, updates optimistic state

---

### 2. "Enter Value" Button on MetricCard (`components/MetricCard.tsx`)

Adds a green **Enter Value** button on any metric card where `personalBest.value === 0` — i.e. a video was uploaded but no real value was ever entered.

- New optional prop: `onEnterValue?: (metricKey: MetricKey) => void`
- Button renders when: `showUploadControls && personalBest && personalBest.value === 0 && onEnterValue`
- Calls `openMetricValueModal(key)` in `MetricsDashboardClient`, jumping straight to the value input step
- Styled green (`#34d399`) to distinguish from the gold Upload Video button

---

### 3. `PATCH /api/metrics` — New Handler (`app/api/metrics/route.ts`)

New endpoint for updating the value on an athlete's existing personal-best row.

**Auth:** Uses `createClerkClient.authenticateRequest()` from `@clerk/backend` — NOT `auth()` from `@clerk/nextjs/server`. This is required because `/api/*` is excluded from `clerkMiddleware` in `middleware.ts`, so `auth()` has no context on this route and would return `{ userId: null }`. The same `clerk` instance and `getAuthenticatedUserId(req)` helper used in `upload-video/route.ts` are now also set up in this file.

**Body:** `{ metric_key: MetricKey, value: number }`

**Supabase update:**
```sql
UPDATE athlete_metrics
SET value = $value
WHERE athlete_clerk_id = $userId
  AND metric_key = $metric_key
  AND is_personal_best = true
```

**Response:** `{ success: true, value: <saved value> }` — returns the saved value so the client can verify.

**Logging:** `console.log('[PATCH /api/metrics] updating:', { athleteId, metricKey, value })` fires before the Supabase call.

---

### 4. Phase 8 SQL Migrations — Pending User Action

The four Phase 8 tables were written and confirmed ready in Session 9. They still need to be run manually in the Supabase SQL editor.

**Status: PENDING — tables may not exist yet.**

1. Go to `https://app.supabase.com/project/jgtjrlncbskcihhqjvbt/sql/new`
2. Paste contents of `supabase/migrations/phase8_metrics.sql`
3. Press **Ctrl+Enter**
4. Verify: query returns 4 rows — `athlete_positions`, `athlete_metrics`, `highlight_videos`, `metric_sessions`

---

## Current State of Every Touched File

### `app/api/metrics/route.ts`
**Status: Complete**

- `createClerkClient` + `getAuthenticatedUserId(req)` helper added at module level (mirrors upload-video pattern)
- `GET` — uses `auth()` ⚠️ (see Known Issues below)
- `POST` — uses `auth()` ⚠️ (see Known Issues below)
- `PATCH` — uses `getAuthenticatedUserId(req)` ✅ fixed this session
  - Validates `metric_key` and `value > 0`
  - Updates `is_personal_best = true` row for the athlete
  - Returns `{ success: true, value }`

### `app/dashboard/athlete/metrics/MetricsDashboardClient.tsx`
**Status: Complete**

- Two-step metric upload modal (`'upload'` → `'value'` phases)
- `openMetricUploadModal`, `openMetricValueModal`, `closeMetricUploadModal` helpers
- `handleMetricValueSave` — PATCH call + optimistic update
- All three MetricCard groups pass `onEnterValue={openMetricValueModal}`

### `components/MetricCard.tsx`
**Status: Complete**

- `onEnterValue?: (metricKey: MetricKey) => void` prop added
- Green "Enter Value" button shown when `personalBest.value === 0`

### `app/api/upload-video/route.ts`
**Status: Complete — no changes this session**

- Uploads video to Bunny.net, persists CDN URL to Supabase
- If no existing PB: inserts `value=0` placeholder row (athlete then uses Enter Value / Step 2 to fill in real value)
- If existing PB: updates `video_url` on that row

### `components/VideoUpload.tsx`
**Status: Complete — no changes this session**

### `components/MetricsGraph.tsx`
**Status: Complete — no changes this session**

Confirmed: History button + sparkline modal works correctly once `athlete_metrics` table exists with data.

### `middleware.ts`
**Status: Complete — no changes this session**

```ts
export const config = {
  matcher: ['/((?!_next|api/|.*\\..*).*)'],
};
```

`/api/*` excluded from `clerkMiddleware`. All API routes handle their own auth. GET/POST in `/api/metrics/route.ts` still use `auth()` which is broken — fix is in next session.

---

## Known Issues / Technical Debt

### ⚠️ GET and POST in `/api/metrics/route.ts` use `auth()` — will fail in production

`GET /api/metrics` and `POST /api/metrics` both call `const { userId } = await auth()` from `@clerk/nextjs/server`. Because `/api/*` is excluded from `clerkMiddleware` in `middleware.ts`, `auth()` returns `{ userId: null }` on these routes and they will always return 401.

**Fix (next session):** Replace `auth()` in GET and POST with the same `getAuthenticatedUserId(req)` helper already added to the file this session.

**Workaround currently:** Manual entry via the upload page (`/dashboard/athlete/metrics/upload`) also calls `POST /api/metrics`, so that is also broken until fixed.

---

## Pending Tasks — Next Session (Priority Order)

### 🔴 1. Fix GET/POST handlers to use `createClerkClient` auth

File: `app/api/metrics/route.ts`

Both `GET` and `POST` use `auth()` which fails because the route is excluded from middleware. Replace both with `getAuthenticatedUserId(req)` — the helper is already in the file.

### 🟡 2. Watch button — inline video player instead of new tab

Currently the Watch link on `MetricCard` opens `personalBest.video_url` in a new browser tab (`target="_blank"`). Replace with an inline modal video player so athletes can watch without leaving the dashboard.

Suggested approach: add `onWatchVideo?: (videoUrl: string) => void` prop to MetricCard. In `MetricsDashboardClient`, open a simple overlay `<video>` element with controls.

### 🟡 3. Phase 8 SQL — confirm tables exist

Once the migrations are run (see above), confirm:
- `/api/metrics` GET and POST work end-to-end
- Video upload creates a real DB row
- MetricCard shows Watch link after upload

### 🟡 4. Phase 8C — Third-Party Integrations

Coach and third-party verification flow:
- `metric_sessions` table (created in Phase 8 SQL) — coach creates a session
- Athletes link metric entries to a session via `session_id`
- Third-party verified entries get `verification_type = 'third_party_*'` and higher badge tier
- AI confidence gate already in POST handler (`ai_confidence >= 80` required for third-party types)

### 🟡 5. Phase 9 — Coach Verification System

- Coach dashboard: view athletes who have requested verification, create metric sessions
- Session workflow: coach creates session → athlete uploads doc/video → AI extracts metrics → coach confirms
- `metric_sessions` status flow: `pending` → `in_progress` → `completed`
- Coach badge displayed on verified metric cards

### 🟡 6. Vercel Production Deploy

Current blockers before deploy:
- Phase 8 SQL migrations must be run against production Supabase project (or same project if using one env)
- GET/POST auth fix (item #1 above) must be done first or metrics will 401 in prod
- All env vars must be set in Vercel dashboard (see full list below)

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

**Note on `NEXT_PUBLIC_SUPABASE_URL`:** The value in `.env.local` includes `/rest/v1/` at the end. `lib/supabase.ts` strips this suffix with `.replace(/\/rest\/v1\/?$/, '')` before passing it to `createClient`. This is intentional — do not remove the suffix from the env var.

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

SQL file: `supabase/migrations/phase8_metrics.sql`

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
| `/api/upload-video` | POST | `createClerkClient.authenticateRequest()` | Upload metric or highlight video to Bunny.net + save URL to Supabase |
| `/api/metrics` | GET | `auth()` ⚠️ broken | Get athlete metrics |
| `/api/metrics` | POST | `auth()` ⚠️ broken | Submit new metric entry |
| `/api/metrics` | PATCH | `createClerkClient.authenticateRequest()` ✅ | Update value on existing PB row (placeholder fix) |
| `/api/metrics/public` | GET | None | Public metric data for profile pages |
| `/api/athlete-positions` | POST | Clerk | Save primary/secondary position |
| `/api/highlight-videos/[id]` | DELETE | Clerk | Delete a highlight video slot |
| `/api/analyze-session` | POST | Clerk | AI extraction of metrics from session document |
| `/api/upload-document` | POST | Clerk | Upload verification document |
| `/api/analyze-document` | POST | Clerk | AI analysis of uploaded document |
| `/api/stripe/checkout` | POST | Clerk | Create Stripe checkout session |
| `/api/share-profile` | POST | Clerk | Email profile share via Resend |
| `/api/save-prospect` | POST | Clerk | Coach saves a prospect |

**Important:** `/api/*` is excluded from `clerkMiddleware`. Routes using `auth()` from `@clerk/nextjs/server` will always return 401. GET and POST on `/api/metrics` are broken for this reason — fix is item #1 in next session.

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
| `components/MetricCard.tsx` | Single metric card: PB value, verification badge, History / Enter Value / Upload Video / Watch buttons |
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

## Important Notes for Next Session

1. **`VERIFICATION_LABELS` is an object, not a string.** Always use `.label` or `.shortLabel`. If you add new components that render verification type labels, remember this.

2. **`/api/upload-video` and `PATCH /api/metrics` are excluded from Clerk middleware.** They use `createClerkClient.authenticateRequest()` from `@clerk/backend` directly, passing both `secretKey` AND `publishableKey` to both `createClerkClient()` and `authenticateRequest()` options. This is load-bearing — removing either key breaks auth silently (returns 401).

3. **`GET /api/metrics` and `POST /api/metrics` are currently broken** — they use `auth()` which has no middleware context on `/api/*` routes. Fix first in next session before testing anything that reads or writes metrics.

4. **`NEXT_PUBLIC_SUPABASE_URL` has a `/rest/v1/` suffix** in `.env.local`. `lib/supabase.ts` strips it. Don't "fix" this.

5. **Bunny upload uses `new Uint8Array(fileBuffer)` as the fetch body**, not `fileBuffer` directly.

6. **Busboy reads from `req.arrayBuffer()` via a synthetic `Readable`**, not `Readable.fromWeb(req.body)`. The Web ReadableStream approach silently truncated large payloads on Node.js v24.

7. **The `run-migrations.mjs` script** requires either `SUPABASE_ACCESS_TOKEN` (Supabase PAT) or `SUPABASE_DB_PASSWORD`. Simplest path: paste SQL directly in the Supabase SQL editor.

8. **Placeholder metric rows** (`value=0`, `is_personal_best=true`, `verification_type='self_reported'`) are created by the upload-video route when an athlete uploads a video with no prior PB. The `PATCH /api/metrics` endpoint and the Enter Value button / Step 2 modal exist specifically to replace `0` with the real value. When showing metric values, be aware a `0` means "uploaded but not entered yet" — not actually zero.
