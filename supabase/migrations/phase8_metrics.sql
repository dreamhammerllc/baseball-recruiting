-- Phase 8: Video & Metrics System
-- Run this entire script once in the Supabase SQL Editor
-- Project: jgtjrlncbskcihhqjvbt

-- ── 1. athlete_positions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS athlete_positions (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_clerk_id   text        NOT NULL UNIQUE,
  primary_position   text        NOT NULL,
  secondary_position text,
  updated_at         timestamptz DEFAULT now()
);

-- ── 2. metric_sessions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metric_sessions (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_clerk_id  text        NOT NULL,
  coach_clerk_id    text,
  session_date      date        NOT NULL,
  verification_type text        NOT NULL,
  status            text        DEFAULT 'pending',
  notes             text,
  document_url      text,
  created_at        timestamptz DEFAULT now()
);

-- ── 3. athlete_metrics ───────────────────────────────────────────────────────
-- Must come after metric_sessions due to the FK reference
CREATE TABLE IF NOT EXISTS athlete_metrics (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_clerk_id  text        NOT NULL,
  metric_key        text        NOT NULL,
  value             numeric     NOT NULL,
  unit              text        NOT NULL,
  verification_type text        NOT NULL,
  source_label      text,
  ai_confidence     numeric,
  is_personal_best  boolean     DEFAULT false,
  video_url         text,
  session_id        uuid        REFERENCES metric_sessions(id) ON DELETE SET NULL,
  recorded_at       timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_athlete_metrics_clerk_id
  ON athlete_metrics (athlete_clerk_id);

CREATE INDEX IF NOT EXISTS idx_athlete_metrics_personal_best
  ON athlete_metrics (athlete_clerk_id, metric_key, is_personal_best);

-- ── 4. highlight_videos ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS highlight_videos (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_clerk_id text        NOT NULL,
  slot_number      int         NOT NULL,
  video_url        text        NOT NULL,
  title            text,
  uploaded_at      timestamptz DEFAULT now(),
  UNIQUE(athlete_clerk_id, slot_number)
);

-- ── Verify ───────────────────────────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'athlete_positions',
    'metric_sessions',
    'athlete_metrics',
    'highlight_videos'
  )
ORDER BY table_name;
