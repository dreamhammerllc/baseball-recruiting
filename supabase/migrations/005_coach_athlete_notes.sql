-- Coach scouting evaluations: one note per (coach, athlete)
-- Distinct from coach_evaluations (HS coach references for verification)

CREATE TABLE IF NOT EXISTS coach_athlete_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  athlete_clerk_id text NOT NULL,
  rating int CHECK (rating >= 1 AND rating <= 10),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, athlete_clerk_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_athlete_notes_coach_id
  ON coach_athlete_notes (coach_id);

CREATE INDEX IF NOT EXISTS idx_coach_athlete_notes_athlete_clerk_id
  ON coach_athlete_notes (athlete_clerk_id);

ALTER TABLE coach_athlete_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coaches can read their own notes" ON coach_athlete_notes;
CREATE POLICY "Coaches can read their own notes"
  ON coach_athlete_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = coach_athlete_notes.coach_id
        AND coaches.clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

DROP POLICY IF EXISTS "Coaches can insert their own notes" ON coach_athlete_notes;
CREATE POLICY "Coaches can insert their own notes"
  ON coach_athlete_notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = coach_athlete_notes.coach_id
        AND coaches.clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

DROP POLICY IF EXISTS "Coaches can update their own notes" ON coach_athlete_notes;
CREATE POLICY "Coaches can update their own notes"
  ON coach_athlete_notes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = coach_athlete_notes.coach_id
        AND coaches.clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

DROP POLICY IF EXISTS "Coaches can delete their own notes" ON coach_athlete_notes;
CREATE POLICY "Coaches can delete their own notes"
  ON coach_athlete_notes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = coach_athlete_notes.coach_id
        AND coaches.clerk_user_id = auth.jwt() ->> 'sub'
    )
  );
