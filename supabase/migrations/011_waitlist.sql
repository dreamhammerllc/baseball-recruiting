-- 011_waitlist.sql
-- Waitlist for upcoming launches (initial source: college_coach_portal).
-- Inserts happen server-side via the service-role admin client, which bypasses
-- RLS. RLS is enabled with no policies, so public/anon traffic cannot write
-- to this table.

CREATE TABLE IF NOT EXISTS waitlist (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text        NOT NULL,
  name         text,
  organization text,
  source       text        NOT NULL DEFAULT 'college_coach_portal',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, source)
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
