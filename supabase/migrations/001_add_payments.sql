-- Migration: Add payments/subscription support
-- Run this in Supabase SQL Editor

-- 1. Create feature_flags table
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on feature_flags
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Anyone can read feature flags (they're public config)
DROP POLICY IF EXISTS "Anyone can read feature flags" ON feature_flags;
CREATE POLICY "Anyone can read feature flags"
    ON feature_flags FOR SELECT
    USING (true);

-- Insert initial payments feature flag (disabled by default)
INSERT INTO feature_flags (key, enabled, metadata) VALUES
    ('payments_enabled', false, '{"free_task_limit": 25, "pro_price_cents": 500}')
ON CONFLICT (key) DO NOTHING;


-- 2. Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
    stripe_customer_id TEXT,
    stripe_payment_intent_id TEXT,
    payment_status TEXT DEFAULT 'none' CHECK (payment_status IN ('none', 'pending', 'completed', 'failed', 'refunded')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on user_subscriptions
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own subscription
DROP POLICY IF EXISTS "Users can read own subscription" ON user_subscriptions;
CREATE POLICY "Users can read own subscription"
    ON user_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own record (for initializing)
DROP POLICY IF EXISTS "Users can insert own subscription" ON user_subscriptions;
CREATE POLICY "Users can insert own subscription"
    ON user_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);


-- 3. Create function to check task limit (for RLS enforcement)
CREATE OR REPLACE FUNCTION check_task_limit()
RETURNS BOOLEAN AS $$
DECLARE
    user_tier TEXT;
    task_count INTEGER;
    task_limit INTEGER;
    payments_on BOOLEAN;
BEGIN
    -- Check if payments are enabled
    SELECT enabled, (metadata->>'free_task_limit')::integer
    INTO payments_on, task_limit
    FROM feature_flags WHERE key = 'payments_enabled';

    -- If payments not enabled, allow all
    IF NOT COALESCE(payments_on, false) THEN
        RETURN TRUE;
    END IF;

    -- Get user tier
    SELECT tier INTO user_tier
    FROM user_subscriptions
    WHERE user_id = auth.uid();

    -- Pro users have no limit
    IF user_tier = 'pro' THEN
        RETURN TRUE;
    END IF;

    -- Count existing tasks
    SELECT COUNT(*) INTO task_count
    FROM tasks WHERE user_id = auth.uid() AND deleted_at IS NULL;

    -- Allow if under limit
    RETURN task_count < COALESCE(task_limit, 25);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Update tasks insert policy to check limit
-- First, drop existing insert policy if it exists
DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert own tasks with limit" ON tasks;

-- Create new policy with limit check
CREATE POLICY "Users can insert own tasks with limit"
    ON tasks FOR INSERT
    WITH CHECK (auth.uid() = user_id AND check_task_limit());


-- 5. Create function to get user subscription status (called from frontend)
CREATE OR REPLACE FUNCTION get_user_subscription_status()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    user_sub RECORD;
    flag_record RECORD;
    task_count INTEGER;
BEGIN
    -- Get feature flag
    SELECT enabled, metadata INTO flag_record
    FROM feature_flags
    WHERE key = 'payments_enabled';

    -- If payments not enabled, everyone is effectively "pro"
    IF NOT COALESCE(flag_record.enabled, false) THEN
        RETURN json_build_object(
            'payments_enabled', false,
            'tier', 'pro',
            'task_limit', null,
            'tasks_synced', 0
        );
    END IF;

    -- Get user subscription
    SELECT * INTO user_sub
    FROM user_subscriptions
    WHERE user_id = auth.uid();

    -- Count user's synced tasks (non-deleted)
    SELECT COUNT(*) INTO task_count
    FROM tasks
    WHERE user_id = auth.uid() AND deleted_at IS NULL;

    RETURN json_build_object(
        'payments_enabled', true,
        'tier', COALESCE(user_sub.tier, 'free'),
        'task_limit', CASE
            WHEN COALESCE(user_sub.tier, 'free') = 'pro' THEN null
            ELSE (flag_record.metadata->>'free_task_limit')::integer
        END,
        'tasks_synced', task_count,
        'payment_status', COALESCE(user_sub.payment_status, 'none')
    );
END;
$$;
