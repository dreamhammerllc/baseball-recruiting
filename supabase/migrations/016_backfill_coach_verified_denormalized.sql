-- Migration 016: backfill denormalized metric values from coach-verified athlete_metrics rows.
-- 2c-iii: aligns athletes.*_mph / *_seconds and athlete_pitches.velocity with the
-- coach-verified PBs in athlete_metrics. Future drift is prevented by the
-- write-through helper in lib/writeThroughCoachVerified.ts and the calculator
-- protection in app/dashboard/athlete/calculator/actions.ts.

-- ── athletes.exit_velocity_mph (higher is better → MAX) ──
UPDATE athletes a
SET exit_velocity_mph = best.value
FROM (
  SELECT athlete_clerk_id, MAX(value) AS value
  FROM athlete_metrics
  WHERE metric_key = 'exit_velocity'
    AND verification_type = 'coach_verified'
  GROUP BY athlete_clerk_id
) best
WHERE a.clerk_user_id = best.athlete_clerk_id
  AND a.exit_velocity_mph IS DISTINCT FROM best.value;

-- ── athletes.fastball_velocity_mph (higher is better → MAX) ──
UPDATE athletes a
SET fastball_velocity_mph = best.value
FROM (
  SELECT athlete_clerk_id, MAX(value) AS value
  FROM athlete_metrics
  WHERE metric_key = 'fastball_velocity'
    AND verification_type = 'coach_verified'
  GROUP BY athlete_clerk_id
) best
WHERE a.clerk_user_id = best.athlete_clerk_id
  AND a.fastball_velocity_mph IS DISTINCT FROM best.value;

-- ── athletes.sixty_yard_dash_seconds (lower is better → MIN) ──
UPDATE athletes a
SET sixty_yard_dash_seconds = best.value
FROM (
  SELECT athlete_clerk_id, MIN(value) AS value
  FROM athlete_metrics
  WHERE metric_key = 'sixty_yard_dash'
    AND verification_type = 'coach_verified'
  GROUP BY athlete_clerk_id
) best
WHERE a.clerk_user_id = best.athlete_clerk_id
  AND a.sixty_yard_dash_seconds IS DISTINCT FROM best.value;

-- ── athlete_pitches: slider, curveball, changeup (direct slot match) ──
UPDATE athlete_pitches ap
SET velocity = best.value, last_updated_at = NOW()
FROM (
  SELECT athlete_clerk_id, MAX(value) AS value
  FROM athlete_metrics
  WHERE metric_key = 'slider_velocity' AND verification_type = 'coach_verified'
  GROUP BY athlete_clerk_id
) best
WHERE ap.athlete_clerk_id = best.athlete_clerk_id
  AND ap.pitch_type = 'slider'
  AND ap.velocity IS DISTINCT FROM best.value;

UPDATE athlete_pitches ap
SET velocity = best.value, last_updated_at = NOW()
FROM (
  SELECT athlete_clerk_id, MAX(value) AS value
  FROM athlete_metrics
  WHERE metric_key = 'curveball_velocity' AND verification_type = 'coach_verified'
  GROUP BY athlete_clerk_id
) best
WHERE ap.athlete_clerk_id = best.athlete_clerk_id
  AND ap.pitch_type = 'curveball'
  AND ap.velocity IS DISTINCT FROM best.value;

UPDATE athlete_pitches ap
SET velocity = best.value, last_updated_at = NOW()
FROM (
  SELECT athlete_clerk_id, MAX(value) AS value
  FROM athlete_metrics
  WHERE metric_key = 'changeup_velocity' AND verification_type = 'coach_verified'
  GROUP BY athlete_clerk_id
) best
WHERE ap.athlete_clerk_id = best.athlete_clerk_id
  AND ap.pitch_type = 'changeup'
  AND ap.velocity IS DISTINCT FROM best.value;

-- ── athlete_pitches: fastball (faster-of-the-two slot) ──
WITH fastball_targets AS (
  SELECT DISTINCT ON (athlete_clerk_id) id, athlete_clerk_id
  FROM athlete_pitches
  WHERE pitch_type IN ('fastball_4seam', 'fastball_2seam')
  ORDER BY athlete_clerk_id, velocity DESC NULLS LAST, pitch_slot ASC
),
fastball_best AS (
  SELECT athlete_clerk_id, MAX(value) AS value
  FROM athlete_metrics
  WHERE metric_key = 'fastball_velocity' AND verification_type = 'coach_verified'
  GROUP BY athlete_clerk_id
)
UPDATE athlete_pitches ap
SET velocity = fb.value, last_updated_at = NOW()
FROM fastball_targets ft
JOIN fastball_best fb ON fb.athlete_clerk_id = ft.athlete_clerk_id
WHERE ap.id = ft.id
  AND ap.velocity IS DISTINCT FROM fb.value;
