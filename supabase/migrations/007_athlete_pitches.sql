CREATE TABLE athlete_pitches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_clerk_id TEXT NOT NULL,
  pitch_slot INTEGER NOT NULL CHECK (pitch_slot BETWEEN 1 AND 5),
  pitch_type TEXT NOT NULL CHECK (pitch_type IN (
    'fastball_4seam','fastball_2seam','slider',
    'curveball','changeup','cutter','splitter')),
  velocity NUMERIC,
  spin_rate NUMERIC,
  h_break NUMERIC,
  v_break NUMERIC,
  extension NUMERIC,
  verification_type TEXT NOT NULL,
  source_label TEXT,
  ai_confidence NUMERIC,
  video_url TEXT,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (athlete_clerk_id, pitch_slot)
);

CREATE INDEX idx_athlete_pitches_clerk_id ON athlete_pitches(athlete_clerk_id);
