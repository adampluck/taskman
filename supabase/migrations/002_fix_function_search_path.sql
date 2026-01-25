-- Migration: Fix function search path security warnings
-- Run this in Supabase SQL Editor

-- Fix get_user_subscription_status function
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


-- Fix check_task_limit function
CREATE OR REPLACE FUNCTION public.check_task_limit()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;


-- Fix update_updated_at function (generic trigger function)
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
