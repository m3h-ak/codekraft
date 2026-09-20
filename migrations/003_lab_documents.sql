CREATE TABLE IF NOT EXISTS lab_documents (
  id BIGSERIAL PRIMARY KEY,
  profile_key TEXT NOT NULL,
  document_date DATE,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'Lab report',
  provider TEXT,
  notes TEXT,
  original_filename TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  bytes BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
)