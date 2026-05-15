-- 009_pitch_slot_swap.sql
-- #30 — atomic pitch slot reordering, including on a full (5-pitch) arsenal.
--
-- 007 declared UNIQUE (athlete_clerk_id, pitch_slot) inline, which Postgres
-- created NON-deferrable. Swapping two pitches' slots when the arsenal is full
-- has no spare slot to park in (CHECK pitch_slot BETWEEN 1 AND 5 leaves no free
-- value, and a non-deferrable unique constraint rejects the transient collision
-- mid-statement with SQLSTATE 23505). Re-declaring the constraint as
-- DEFERRABLE INITIALLY IMMEDIATE moves the uniqueness check to end-of-statement,
-- so a single self-consistent two-row UPDATE swap succeeds. Normal INSERT and
-- PATCH behavior is unchanged (still validated at statement end as before).

BEGIN;

-- Drop the auto-named constraint from 007 (inline UNIQUE -> *_key) if present,
-- and any prior run of this migration's named constraint, for idempotency.
ALTER TABLE athlete_pitches
  DROP CONSTRAINT IF EXISTS athlete_pitches_athlete_clerk_id_pitch_slot_key;
ALTER TABLE athlete_pitches
  DROP CONSTRAINT IF EXISTS athlete_pitches_clerk_slot_uniq;

ALTER TABLE athlete_pitches
  ADD CONSTRAINT athlete_pitches_clerk_slot_uniq
  UNIQUE (athlete_clerk_id, pitch_slot)
  DEFERRABLE INITIALLY IMMEDIATE;

COMMIT;

-- ── move_pitch_slot ──────────────────────────────────────────────────────────
-- Move one pitch up (target = current slot - 1) or down (current slot + 1) by a
-- single slot, atomically.
--
--   * Neighbor present in the target slot -> swap the two pitches' slot values
--     in a single multi-row UPDATE. The DEFERRABLE INITIALLY IMMEDIATE
--     constraint validates at statement end, so the transient duplicate during
--     the swap is permitted.
--   * Target slot empty (sparse arsenal) -> simple reassign.
--
-- SECURITY DEFINER: bypasses RLS, so ownership is re-verified in-function
-- against p_athlete (defense-in-depth; the API route also pre-checks). Returns
-- the full updated arsenal, slot-ordered, so the caller needs no second query.

CREATE OR REPLACE FUNCTION move_pitch_slot(
  p_athlete   TEXT,
  p_pitch_id  UUID,
  p_direction TEXT
)
RETURNS SETOF athlete_pitches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner       TEXT;
  v_cur_slot    INTEGER;
  v_target_slot INTEGER;
  v_neighbor_id UUID;
BEGIN
  IF p_direction NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'invalid_direction' USING ERRCODE = '22023';
  END IF;

  -- Lock the moving row; resolves ownership + current slot.
  SELECT athlete_clerk_id, pitch_slot
    INTO v_owner, v_cur_slot
    FROM athlete_pitches
   WHERE id = p_pitch_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pitch_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner IS DISTINCT FROM p_athlete THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_target_slot := CASE WHEN p_direction = 'up'
                        THEN v_cur_slot - 1
                        ELSE v_cur_slot + 1 END;

  IF v_target_slot < 1 OR v_target_slot > 5 THEN
    RAISE EXCEPTION 'at_boundary' USING ERRCODE = '22023';
  END IF;

  -- Neighbor currently occupying the target slot, if any (lock it too).
  SELECT id
    INTO v_neighbor_id
    FROM athlete_pitches
   WHERE athlete_clerk_id = p_athlete
     AND pitch_slot       = v_target_slot
   FOR UPDATE;

  IF v_neighbor_id IS NULL THEN
    -- Sparse arsenal: target slot empty -> simple reassign.
    UPDATE athlete_pitches
       SET pitch_slot      = v_target_slot,
           last_updated_at = NOW()
     WHERE id = p_pitch_id;
  ELSE
    -- Swap. Single multi-row UPDATE; deferrable-immediate constraint is
    -- validated at statement end, so the transient collision is allowed.
    UPDATE athlete_pitches
       SET pitch_slot = CASE id
                          WHEN p_pitch_id    THEN v_target_slot
                          WHEN v_neighbor_id THEN v_cur_slot
                        END,
           last_updated_at = NOW()
     WHERE id IN (p_pitch_id, v_neighbor_id);
  END IF;

  RETURN QUERY
    SELECT *
      FROM athlete_pitches
     WHERE athlete_clerk_id = p_athlete
     ORDER BY pitch_slot ASC;
END;
$$;

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default; make the service_role
-- grant explicit so the API route's service-role client is unambiguous.
GRANT EXECUTE ON FUNCTION move_pitch_slot(TEXT, UUID, TEXT) TO service_role;
