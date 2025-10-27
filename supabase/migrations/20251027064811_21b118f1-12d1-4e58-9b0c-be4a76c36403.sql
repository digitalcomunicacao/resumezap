-- Add manual_subscription column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manual_subscription BOOLEAN DEFAULT FALSE;

-- Add comment to explain the column
COMMENT ON COLUMN profiles.manual_subscription IS 'Indicates if subscription plan was manually set by admin (true) or managed by Stripe (false)';