-- Migration 015: Drop the retired athlete_positions table.
-- 2c-i (Phase 2c data-coherence): all readers and writers have been migrated
-- to athletes.position / secondary_position. The /api/athlete-positions endpoint
-- has been deleted; the metrics-page editor now PATCHes /api/athlete/profile.

DROP TABLE IF EXISTS athlete_positions;
