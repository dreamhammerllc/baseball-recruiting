-- Add new coach profile columns
-- Run this in Supabase SQL Editor

ALTER TABLE coaches ADD COLUMN IF NOT EXISTS phone         TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS website       TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS instagram     TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS twitter       TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS age_groups    TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS coaching_style TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS achievements  TEXT;
