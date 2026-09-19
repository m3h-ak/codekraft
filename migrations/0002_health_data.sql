CREATE TABLE health_events (
  id BIGSERIAL PRIMARY KEY,
  profile_key TEXT NOT NULL,
  event_date DATE NOT NULL,
  source_type TEXT NOT NULL,
  metric TEXT NOT NULL,
  value_numeric DOUBLE PRECISION,
  value_text TEXT,
  unit TEXT,
  confidence DOUBLE PRECISION DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_health_events_profile_date ON health_events(profile_key, event_date);
CREATE TABLE interview_answers (
  id BIGSERIAL PRIMARY KEY,
  profile_key TEXT NOT NULL,
  question_key TEXT NOT NULL,
  answer TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_interview_answers_profile ON interview_answers(profile_key);