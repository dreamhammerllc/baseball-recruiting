BEGIN;

-- Review / appeal layer for flagged (under-review) verifications.
ALTER TABLE metric_sessions ADD COLUMN IF NOT EXISTS review_requested    boolean NOT NULL DEFAULT false;
ALTER TABLE metric_sessions ADD COLUMN IF NOT EXISTS review_requested_at timestamptz;
ALTER TABLE metric_sessions ADD COLUMN IF NOT EXISTS review_requested_by text;
ALTER TABLE metric_sessions ADD COLUMN IF NOT EXISTS reviewed_at         timestamptz;
ALTER TABLE metric_sessions ADD COLUMN IF NOT EXISTS reviewed_by         text;
ALTER TABLE metric_sessions ADD COLUMN IF NOT EXISTS review_note         text;

-- Reviewer gate. A coach with is_reviewer = true can resolve flagged items.
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS is_reviewer boolean NOT NULL DEFAULT false;

-- The reviewer queue filters metric_sessions by status.
CREATE INDEX IF NOT EXISTS idx_metric_sessions_status ON metric_sessions(status);

COMMIT;
