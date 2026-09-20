CREATE TABLE IF NOT EXISTS menstrual_cycles (
  id BIGSERIAL PRIMARY KEY,
  profile_key TEXT NOT NULL,
  cycle_start DATE NOT NULL,
  cycle_end DATE,
  flow TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
)