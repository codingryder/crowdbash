-- Add match_date for scheduling and display
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS match_date TIMESTAMPTZ;
UPDATE rooms SET match_date = COALESCE(completed_at, created_at) WHERE match_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_match_date ON rooms(match_date DESC);
