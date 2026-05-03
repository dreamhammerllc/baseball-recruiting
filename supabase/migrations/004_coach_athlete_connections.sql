-- Diamond Verified — Coach-Athlete Connection System
-- Run this in: Supabase Dashboard → SQL Editor → Run

-- ── 1. coach_athlete_connections ─────────────────────────────
-- Stores verified connections between a coach and an athlete.
-- Both IDs are Clerk user IDs (text), not Supabase UUIDs.
-- The unique constraint prevents duplicate connections.

CREATE TABLE IF NOT EXISTS coach_athlete_connections (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id      TEXT        NOT NULL,
  athlete_id    TEXT        NOT NULL,
  connected_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (coach_id, athlete_id)
);

CREATE INDEX IF NOT EXISTS idx_cac_coach_id
  ON coach_athlete_connections (coach_id);

CREATE INDEX IF NOT EXISTS idx_cac_athlete_id
  ON coach_athlete_connections (athlete_id);

-- ── Verify ───────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'coach_athlete_connections'
ORDER BY ordinal_position;
