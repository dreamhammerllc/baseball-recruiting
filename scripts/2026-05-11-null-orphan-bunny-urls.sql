-- One-time cleanup: null the orphan video URLs from the pre-refactor Bunny pipeline.
-- These URLs point to vz-d9ee7f6e-2b7.b-cdn.net/{guid}/play_720p.mp4 paths whose
-- underlying video files are unreachable (the upload code that produced them no
-- longer exists in the repo; the GUIDs return 403 from Bunny's CDN even with
-- proper referrer config). Watch button will disappear for these metrics until
-- a fresh upload replaces them via the current Bunny Stream pipeline.
--
-- Affected rows (verified via probe-verification-videos.mjs):
--   athlete_metrics: 2 rows (Korbin's slider_velocity, sixty_yard_dash)
--   coach_verifications: 2 rows (same metrics, separate records)

-- Step 1: preview what will be affected
SELECT 'athlete_metrics' AS source, athlete_clerk_id, metric_key, value, video_url
FROM athlete_metrics
WHERE athlete_clerk_id = 'user_3Cx45lltJlEnKk4A4vGgMejEUgg'
  AND metric_key IN ('slider_velocity', 'sixty_yard_dash')
  AND video_url LIKE 'https://vz-d9ee7f6e-2b7.b-cdn.net%'

UNION ALL

SELECT 'coach_verifications' AS source, athlete_clerk_id, metric_key, value, video_url
FROM coach_verifications
WHERE athlete_clerk_id = 'user_3Cx45lltJlEnKk4A4vGgMejEUgg'
  AND metric_key IN ('slider_velocity', 'sixty_yard_dash')
  AND video_url LIKE 'https://vz-d9ee7f6e-2b7.b-cdn.net%';

-- Step 2: null them out
UPDATE athlete_metrics
SET video_url = NULL
WHERE athlete_clerk_id = 'user_3Cx45lltJlEnKk4A4vGgMejEUgg'
  AND metric_key IN ('slider_velocity', 'sixty_yard_dash')
  AND video_url LIKE 'https://vz-d9ee7f6e-2b7.b-cdn.net%';

UPDATE coach_verifications
SET video_url = NULL
WHERE athlete_clerk_id = 'user_3Cx45lltJlEnKk4A4vGgMejEUgg'
  AND metric_key IN ('slider_velocity', 'sixty_yard_dash')
  AND video_url LIKE 'https://vz-d9ee7f6e-2b7.b-cdn.net%';

-- Step 3: verify the nulls landed
SELECT 'athlete_metrics' AS source, athlete_clerk_id, metric_key, value, video_url
FROM athlete_metrics
WHERE athlete_clerk_id = 'user_3Cx45lltJlEnKk4A4vGgMejEUgg'
  AND metric_key IN ('slider_velocity', 'sixty_yard_dash')

UNION ALL

SELECT 'coach_verifications' AS source, athlete_clerk_id, metric_key, value, video_url
FROM coach_verifications
WHERE athlete_clerk_id = 'user_3Cx45lltJlEnKk4A4vGgMejEUgg'
  AND metric_key IN ('slider_velocity', 'sixty_yard_dash');
