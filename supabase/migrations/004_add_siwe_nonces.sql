-- Migration: Add SIWE nonces table for wallet authentication
-- Run this in Supabase SQL Editor

-- Create table to store SIWE nonces
CREATE TABLE IF NOT EXISTS public.siwe_nonces (
    address TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for cleanup of expired nonces
CREATE INDEX IF NOT EXISTS idx_siwe_nonces_expires_at ON public.siwe_nonces(expires_at);

-- Enable RLS
ALTER TABLE public.siwe_nonces ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (Edge Functions use service role)
-- No policies needed as we don't want direct client access

-- Optional: Create a function to clean up expired nonces (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_nonces()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM siwe_nonces WHERE expires_at < NOW();
END;
$$;
