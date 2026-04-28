-- Track when each user accepted the Terms of Service / Privacy Policy.
-- NULL means they haven't accepted yet — frontend shows a one-time prompt
-- on next sign-in for existing users.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- Voucher value cap: store the rupee face value of each reward SKU and
-- enforce that no reward exceeds ₹250. NULL is allowed for legacy rows
-- but new SKUs must declare a value.
ALTER TABLE rewards
  ADD COLUMN IF NOT EXISTS value_inr INTEGER;

-- Drop the constraint if rerunning the migration (IF NOT EXISTS-style guard).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'rewards_value_cap'
  ) THEN
    ALTER TABLE rewards
      ADD CONSTRAINT rewards_value_cap CHECK (value_inr IS NULL OR value_inr <= 250);
  END IF;
END $$;
