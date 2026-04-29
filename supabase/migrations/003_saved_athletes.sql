-- Saved athletes roster for coaches
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS saved_athletes (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id         uuid        NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  athlete_clerk_id text        NOT NULL,
  group_id         uuid        NULL,  -- NULL = ungrouped
  athlete_name     text        NOT NULL,
  athlete_photo    text        NULL,
  athlete_username text        NULL,
  saved_at         timestamptz DEFAULT now(),
  UNIQUE (coach_id, athlete_clerk_id)
);

-- Athlete groups (paid coaches only)
CREATE TABLE IF NOT EXISTS athlete_groups (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id   uuid        NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  color      text        NOT NULL DEFAULT '#e8a020',
  created_at timestamptz DEFAULT now()
);

-- Add group FK after both tables exist
ALTER TABLE saved_athletes
  ADD CONSTRAINT fk_saved_athletes_group
  FOREIGN KEY (group_id) REFERENCES athlete_groups(id) ON DELETE SET NULL;

-- Add subscription tier to coaches if not present
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free';
