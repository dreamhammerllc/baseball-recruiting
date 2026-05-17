-- ============================================================
-- 010: athletes.username — case-insensitive uniqueness
-- ============================================================
--
-- The athletes.username column was added to the live DB out-of-band (no
-- migration file) along with a case-SENSITIVE UNIQUE constraint
-- (athletes_username_key) and a redundant non-unique btree index
-- (idx_athletes_username). This migration adds case-INSENSITIVE uniqueness so
-- "Korbin" and "korbin" cannot both exist as separate handles.
--
-- This is additive and intentionally conservative:
--   * The existing case-sensitive athletes_username_key is LEFT ALONE. Both it
--     and the new functional index are enforced simultaneously. Dropping the
--     now-redundant case-sensitive constraint is a safe future cleanup, but is
--     deferred to its own migration to minimize risk in this stage.
--   * idx_athletes_username (redundant btree) is NOT touched here.
--
-- Idempotent: re-running on an already-migrated DB succeeds (the DO block is a
-- read-only count, CREATE UNIQUE INDEX uses IF NOT EXISTS, COMMENT is a no-op
-- reset). The whole migration is wrapped in a transaction so a failed
-- pre-flight check leaves nothing partially applied.
-- ============================================================

BEGIN;

-- 1. Pre-flight: a functional UNIQUE index on lower(username) would FAIL to
--    create if any two rows collide once lower-cased (e.g. 'John' vs 'john'),
--    and would silently change matching semantics if any single row is stored
--    non-lowercased. The 26 existing rows (25 seed_test_* + Korbin) are all
--    lowercase per the seed-script convention, so this is expected to be a
--    no-op — but verify defensively and fail LOUDLY with the offending count
--    rather than letting CREATE INDEX throw an opaque 23505.
--
--    If this RAISEs, normalize first (review for true case-only collisions
--    BEFORE blindly lowercasing — collapsing 'John' and 'john' would itself
--    violate the new index), e.g.:
--        UPDATE athletes
--           SET username = lower(username)
--         WHERE username IS NOT NULL
--           AND username <> lower(username);
--    then re-run this migration.
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*)
    INTO v_count
    FROM public.athletes
   WHERE username IS NOT NULL
     AND username <> lower(username);

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Migration 010 aborted: % athlete row(s) have non-lowercase usernames. '
      'Normalize them (watching for case-only collisions) before applying '
      'the case-insensitive unique index.', v_count;
  END IF;
END;
$$;

-- 2. Case-insensitive uniqueness via a functional UNIQUE index on
--    lower(username). Coexists with the existing case-sensitive
--    athletes_username_key — both are enforced. IF NOT EXISTS makes this
--    idempotent. Not CONCURRENTLY: the table is tiny and we want this inside
--    the migration transaction.
CREATE UNIQUE INDEX IF NOT EXISTS athletes_username_lower_key
  ON public.athletes (lower(username));

-- 3. Document intent on the index itself for future schema spelunking.
COMMENT ON INDEX athletes_username_lower_key IS 'Case-insensitive uniqueness for username. Enforced via lower() functional index. Added by migration 010 after out-of-band column was created. See CLAUDE.md migration notes.';

COMMIT;
