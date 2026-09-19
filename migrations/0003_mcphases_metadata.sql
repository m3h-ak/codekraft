ALTER TABLE health_events ADD COLUMN IF NOT EXISTS participant_id TEXT;
ALTER TABLE health_events ADD COLUMN IF NOT EXISTS study_day INTEGER;
ALTER TABLE health_events ADD COLUMN IF NOT EXISTS source_table TEXT;
ALTER TABLE health_events ADD COLUMN IF NOT EXISTS raw_metric TEXT;
CREATE INDEX IF NOT EXISTS idx_health_events_participant ON health_events(participant_id, study_day);