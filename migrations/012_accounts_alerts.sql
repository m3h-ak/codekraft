CREATE TABLE IF NOT EXISTS account_profiles (
  user_id TEXT PRIMARY KEY,
  email TEXT,
  profile_key TEXT UNIQUE NOT NULL,
  profile_json TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health_alerts (
  id BIGSERIAL PRIMARY KEY,
  profile_key TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metrics_json TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  dismissed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_health_alerts_profile ON health_alerts(profile_key, created_at DESC);