-- Multi-sport support: Cricket + Football
-- Adds sport discriminator, generic match progress, leagues, and match events

-- rooms: add sport, league, season, generic progress
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS sport VARCHAR(20) NOT NULL DEFAULT 'cricket';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS league VARCHAR(100);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS season VARCHAR(20);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS match_progress JSONB DEFAULT '{}';

-- player_weightages: add role and scoring detail
ALTER TABLE player_weightages ADD COLUMN IF NOT EXISTS player_role VARCHAR(30);
ALTER TABLE player_weightages ADD COLUMN IF NOT EXISTS scoring_breakdown JSONB DEFAULT '{}';

-- weightage_edits: generic edit trigger
ALTER TABLE weightage_edits ADD COLUMN IF NOT EXISTS edit_trigger VARCHAR(50);

-- quiz_questions: football minute context
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS match_minute INTEGER;

-- match_events: real-time in-game events for commentary
CREATE TABLE IF NOT EXISTS match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL,
  player_id VARCHAR(100),
  player_name VARCHAR(100),
  team VARCHAR(50),
  minute INTEGER,
  over_number NUMERIC(4,1),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rooms_sport ON rooms(sport);
CREATE INDEX IF NOT EXISTS idx_rooms_sport_status ON rooms(sport, status);
CREATE INDEX IF NOT EXISTS idx_match_events_room ON match_events(room_id);

-- Backfill existing cricket rooms
UPDATE rooms SET match_progress = jsonb_build_object('over', COALESCE(current_over, 0))
WHERE sport = 'cricket' AND match_progress = '{}';
