-- Migration: Add separate crypto price configuration
-- This allows setting a different (potentially discounted) price for crypto payments

-- Update the feature_flags metadata to include crypto_price_cents
-- Default to same as pro_price_cents (500 = $5.00)
UPDATE feature_flags
SET metadata = metadata || '{"crypto_price_cents": 500}'::jsonb
WHERE key = 'payments_enabled'
AND NOT (metadata ? 'crypto_price_cents');

-- Update the get_user_subscription_status function to return both prices
CREATE OR REPLACE FUNCTION get_user_subscription_status()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
        'payment_status', COALESCE(user_sub.payment_status, 'none'),
        'nudge_completed', COALESCE(flag_record.metadata->'nudge_completed', '[3, 10]'::jsonb),
        'nudge_added', COALESCE(flag_record.metadata->'nudge_added', '[5, 15]'::jsonb),
        'pro_price_cents', COALESCE((flag_record.metadata->>'pro_price_cents')::integer, 500),
        'crypto_price_cents', COALESCE((flag_record.metadata->>'crypto_price_cents')::integer, 500)
    );
END;
$$;
