-- Add wallet_connected_at column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing users to have wallet_connected_at set to their created_at if not already set
UPDATE users SET wallet_connected_at = created_at WHERE wallet_connected_at IS NULL;
