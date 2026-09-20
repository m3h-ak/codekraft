CREATE TABLE IF NOT EXISTS menstrual_events (
  id BIGSERIAL PRIMARY KEY,
  profile_key TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL,
  value_numeric DOUBLE PRECISION,
  value_text TEXT,
  unit TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
)