-- Track when the official playing XI is announced + the squad itself.
-- playing_xi shape: { "team_a": "Team Name", "team_b": "Team Name",
--                     "xi_a": ["Full Name", ...], "xi_b": ["Full Name", ...] }
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS playing_xi_announced_at TIMESTAMPTZ NULL;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS playing_xi JSONB NULL;
