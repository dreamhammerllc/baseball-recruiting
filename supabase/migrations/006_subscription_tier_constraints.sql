-- ============================================================
-- 006: subscription_tier — capture drift, normalize, constrain
-- ============================================================
--
-- Captures the existing athletes.subscription_tier column (applied to live
-- DB but never versioned in migrations), fixes its broken default value,
-- normalizes any non-canonical values, and adds a matching constraint to
-- coaches. Canonical vocabulary: 'free' | 'verified' | 'elite' | 'pro'.
-- ============================================================

-- 1. Drop the legacy untracked constraint on athletes
--    (currently accepts only 'free' | 'verified' | 'elite').
ALTER TABLE athletes
  DROP CONSTRAINT IF EXISTS athletes_subscription_tier_check;

-- 2. Fix the column default on athletes ('scout' was a bug).
ALTER TABLE athletes
  ALTER COLUMN subscription_tier SET DEFAULT 'free';

-- 3. Defensive: normalize any NULL or non-canonical values to 'free'
--    before applying the new constraint. No-op given current data, but
--    safe against any race or unmigrated rows.
UPDATE athletes
SET subscription_tier = 'free'
WHERE subscription_tier IS NULL
   OR subscription_tier NOT IN ('free', 'verified', 'elite', 'pro');

-- 4. Make athletes.subscription_tier NOT NULL (matches coaches pattern).
ALTER TABLE athletes
  ALTER COLUMN subscription_tier SET NOT NULL;

-- 5. Add updated CHECK constraint to athletes (now includes 'pro').
ALTER TABLE athletes
  ADD CONSTRAINT athletes_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'verified', 'elite', 'pro'));

-- 6. Add matching CHECK constraint to coaches (none existed before).
ALTER TABLE coaches
  ADD CONSTRAINT coaches_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'verified', 'elite', 'pro'));
