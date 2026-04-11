-- Add admin_created flag to distinguish manually created rooms from auto-synced ones
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS admin_created BOOLEAN DEFAULT FALSE;
