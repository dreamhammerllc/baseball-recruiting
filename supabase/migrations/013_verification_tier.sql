BEGIN;

-- 1. Trust tier (1 = strongest ... 7 = weakest; see lib/verificationTier.ts).
--    Per published metric, and per verification attempt for audit.
ALTER TABLE athlete_metrics ADD COLUMN IF NOT EXISTS verification_tier int;
ALTER TABLE metric_sessions ADD COLUMN IF NOT EXISTS verification_tier int;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'athlete_metrics_verification_tier_check') THEN
    ALTER TABLE athlete_metrics
      ADD CONSTRAINT athlete_metrics_verification_tier_check
      CHECK (verification_tier IS NULL OR verification_tier BETWEEN 1 AND 7);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metric_sessions_verification_tier_check') THEN
    ALTER TABLE metric_sessions
      ADD CONSTRAINT metric_sessions_verification_tier_check
      CHECK (verification_tier IS NULL OR verification_tier BETWEEN 1 AND 7);
  END IF;
END $$;

-- 2. Server-side extraction ledger. Each device-readout extraction is computed once on the
--    server at upload time and stored here. The verification decision reads the value back
--    by id, so the server judges its own computed value, never one supplied by the client.
CREATE TABLE IF NOT EXISTS readout_extractions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_clerk_id   text NOT NULL,
  athlete_clerk_id text,
  metric_key       text NOT NULL,
  extracted_value  numeric,
  confidence       int,
  notes            text,
  mime_type        text,
  storage_path     text,
  readout_url      text,
  consumed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_readout_extractions_lookup
  ON readout_extractions (coach_clerk_id, id);

-- Access is service-role only (Clerk auth, admin client), matching every other table here.
ALTER TABLE readout_extractions ENABLE ROW LEVEL SECURITY;

COMMIT;
