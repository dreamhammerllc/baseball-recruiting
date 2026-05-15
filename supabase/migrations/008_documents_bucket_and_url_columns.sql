-- ============================================================
-- 008_documents_bucket_and_url_columns
--
-- Purpose: Close two pre-existing gaps where storage and schema were
-- created manually via the Supabase dashboard rather than versioned in a
-- migration. Spinning up a fresh environment previously required manual
-- setup steps documented in app/api/upload-document/route.ts.
--
-- 1. Creates the 'documents' Supabase Storage bucket (public) with
--    file size limit and MIME type allowlist matching application-layer
--    enforcement in upload-document and upload-pitch-proof.
-- 2. Adds the transcript_url and test_scores_url columns to athletes.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Storage bucket: documents
-- ------------------------------------------------------------
-- 10 MB file size limit, 6 allowed MIME types — must match MAX_BYTES and
-- ALLOWED_MIME_TYPES constants in app/api/upload-document/route.ts and
-- app/api/upload-pitch-proof/route.ts. Public so getPublicUrl() returns
-- unsigned URLs without a signed-URL flow.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760, -- 10 * 1024 * 1024 bytes
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ------------------------------------------------------------
-- 2. athletes columns: transcript_url, test_scores_url
-- ------------------------------------------------------------
-- Public URL strings written by app/api/upload-document/route.ts after
-- successful upload. Nullable; not all athletes upload these documents.

ALTER TABLE athletes ADD COLUMN IF NOT EXISTS transcript_url  text;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS test_scores_url text;
