-- ============================================================
-- Diamond Verified — Coach Scheduling Migration
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. Add scheduling columns to coaches table ───────────────
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS zip_code                 TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS latitude                 NUMERIC(10,6);
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS longitude                NUMERIC(10,6);
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS advance_notice_hours     INTEGER DEFAULT 24;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS session_duration_minutes INTEGER DEFAULT 60;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS is_accepting_bookings    BOOLEAN DEFAULT true;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS ical_secret              TEXT UNIQUE DEFAULT gen_random_uuid()::text;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS push_subscription        JSONB;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS notifications_enabled    BOOLEAN DEFAULT true;

-- ── 2. Add notification columns to athletes table ────────────
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS zip_code               TEXT;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS push_subscription      JSONB;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS notifications_enabled  BOOLEAN DEFAULT false;

-- ── 3. Create coach_availability table ───────────────────────
-- Stores weekly recurring availability windows per coach.
-- day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday
CREATE TABLE IF NOT EXISTS coach_availability (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_availability_coach_id_idx ON coach_availability(coach_id);

-- ── 4. Create bookings table ─────────────────────────────────
-- One row per athlete-coach testing session.
CREATE TABLE IF NOT EXISTS bookings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id         UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  athlete_clerk_id TEXT NOT NULL,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  metric_keys      TEXT[] DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'confirmed'
                   CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  athlete_notes    TEXT,
  coach_notes      TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_coach_id_idx         ON bookings(coach_id);
CREATE INDEX IF NOT EXISTS bookings_athlete_clerk_id_idx ON bookings(athlete_clerk_id);
CREATE INDEX IF NOT EXISTS bookings_scheduled_at_idx     ON bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS bookings_status_idx           ON bookings(status);

-- ── 5. RLS policies (optional but recommended) ───────────────
-- Enable RLS if not already enabled:
-- ALTER TABLE coach_availability ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
-- Since we use the service role key in API routes, RLS is bypassed server-side.
-- Add policies here if you want direct client access restricted.

-- ── Done ─────────────────────────────────────────────────────
-- You can verify with:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'coaches';
-- SELECT * FROM coach_availability LIMIT 1;
-- SELECT * FROM bookings LIMIT 1;
