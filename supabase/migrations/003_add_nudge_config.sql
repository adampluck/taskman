-- Migration: Add nudge thresholds to feature_flags config
-- Run this in Supabase SQL Editor

-- 1. Update feature_flags metadata to include nudge thresholds
UPDATE feature_flags
SET metadata = metadata || '{
    "nudge_completed": [3, 10],
    "nudge_added": [5, 15]
}'::jsonb
WHERE key = 'payments_enabled';

-- 2. Update get_user_subscription_status to return nudge config
CREATE OR REPLACE FUNCTION public.get_user_subscription_status()
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
            'tasks_synced', 0,
            'nudge_completed', COALESCE(flag_record.metadata->'nudge_completed', '[3, 10]'::jsonb),
            'nudge_added', COALESCE(flag_record.metadata->'nudge_added', '[5, 15]'::jsonb)
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
        'nudge_added', COALESCE(flag_record.metadata->'nudge_added', '[5, 15]'::jsonb)
    );
END;
$$;
