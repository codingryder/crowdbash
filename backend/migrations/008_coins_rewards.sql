-- Virtual coins for top-3 leaderboard finishers + reward redemption catalog

ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_coins INTEGER NOT NULL DEFAULT 0;

-- Ledger of every coin credit/debit. Unique (user_id, room_id, reason)
-- prevents double-crediting when a completion path fires twice.
CREATE TABLE IF NOT EXISTS coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  delta INTEGER NOT NULL,
  reason VARCHAR(64) NOT NULL,
  rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT coin_tx_unique_award UNIQUE (user_id, room_id, reason)
);
CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON coin_transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(64) UNIQUE NOT NULL,
  title VARCHAR(120) NOT NULL,
  description TEXT,
  coin_cost INTEGER NOT NULL CHECK (coin_cost > 0),
  stock INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES rewards(id),
  coins_spent INTEGER NOT NULL,
  code VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_redemptions_user ON redemptions(user_id, created_at DESC);
