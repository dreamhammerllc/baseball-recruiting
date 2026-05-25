-- 012_verification_evidence.sql
-- Phase 2a: evidence-bundle foundation.
--   1. Backfills the in-repo DDL for coach_verifications (hand-created, never versioned).
--   2. Adds evidence-capture columns to metric_sessions (the verification evidence bundle).
--   3. Links coach_verifications -> metric_sessions.
-- Idempotent and safe to re-run. Run manually in the Supabase SQL editor.

BEGIN;

-- 1. coach_verifications: document the existing live shape (no-op if it already exists).
CREATE TABLE IF NOT EXISTS coach_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES coaches(id),
  athlete_clerk_id text NOT NULL,
  metric_key text NOT NULL,
  value numeric NOT NULL,
  video_url text,
  recorded_at timestamptz,
  ai_reviewed_at timestamptz,
  approved_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Supports the 72h cooldown lookup in verify-metric.
CREATE INDEX IF NOT EXISTS idx_coach_verifications_cooldown
  ON coach_verifications (coach_id, athlete_clerk_id, metric_key, created_at);

-- 2. metric_sessions: evidence-bundle columns (all additive).
ALTER TABLE metric_sessions ADD COLUMN IF NOT EXISTS metric_key text;
ALTER TABLE metric_sessions ADD COLUMN IF NOT EXISTS claimed_value numeric;
ALTER TABLE metric_sessions ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE metric_sessions ADD COLUMN IF NOT EXISTS readout_file_url text;
ALTER TABLE metric_sessions ADD COLUMN IF NOT EXISTS readout_extracted_value numeric;
ALTER TABLE metric_sessions ADD COLUMN IF NOT EXISTS ai_confidence numeric;
ALTER TABLE metric_sessions ADD COLUMN IF NOT EXISTS ai_notes text;
ALTER TABLE metric_sessions ADD COLUMN IF NOT EXISTS athlete_context jsonb;
ALTER TABLE metric_sessions ADD COLUMN IF NOT EXISTS decision_reason text;

-- 3. Link the attempt log to its evidence bundle.
ALTER TABLE coach_verifications
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES metric_sessions(id) ON DELETE SET NULL;

COMMIT;
