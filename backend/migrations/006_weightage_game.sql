-- Weightage Game: Squad management + fantasy scoring

-- Match squads: admin enters both teams' players before each match
CREATE TABLE IF NOT EXISTS match_squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  player_id VARCHAR(100) NOT NULL,
  player_name VARCHAR(100) NOT NULL,
  team VARCHAR(50) NOT NULL,
  player_role VARCHAR(30),
  UNIQUE(room_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_match_squads_room ON match_squads(room_id);

-- Game: add squad lock + budget
ALTER TABLE games ADD COLUMN IF NOT EXISTS squad_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS squad_locked_at TIMESTAMPTZ;
ALTER TABLE games ADD COLUMN IF NOT EXISTS total_budget INTEGER DEFAULT 50;

-- PlayerWeightage: mark if selected in user's 11
ALTER TABLE player_weightages ADD COLUMN IF NOT EXISTS selected BOOLEAN DEFAULT FALSE;
