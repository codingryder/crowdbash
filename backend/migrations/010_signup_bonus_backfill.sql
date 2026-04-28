-- One-time backfill: every existing verified user gets the 50-coin signup bonus
-- they would have received if signup awards had existed at registration time.
--
-- Idempotent via the (user_id, room_id, reason) unique constraint on
-- coin_transactions: re-running this migration does nothing.

WITH inserted AS (
  INSERT INTO coin_transactions (user_id, room_id, delta, reason)
  SELECT id, NULL, 50, 'signup'
  FROM users
  WHERE email_verified = TRUE
  ON CONFLICT (user_id, room_id, reason) DO NOTHING
  RETURNING user_id
)
UPDATE users
SET lifetime_coins = lifetime_coins + 50
WHERE id IN (SELECT user_id FROM inserted);
