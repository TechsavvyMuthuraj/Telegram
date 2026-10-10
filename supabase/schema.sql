-- =============================================================================
-- techiemuthuraj Files - Supabase Database Schema
-- Production Schema for Telegram File Access & Token-Gated Download Management
-- =============================================================================

-- Enable pgcrypto extension for cryptographically secure UUIDs and hashes
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Table: files
-- Stores digital files, tools, software, APKs and Telegram references
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_code VARCHAR(32) NOT NULL UNIQUE,          -- Human-friendly code (e.g. TM-APK-901)
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(64) NOT NULL DEFAULT 'General',-- e.g. Software, APK, Tool, Script, Document
    file_type VARCHAR(32) NOT NULL DEFAULT 'ZIP',   -- e.g. APK, ZIP, EXE, PDF, PY
    file_size VARCHAR(32) NOT NULL DEFAULT '0 MB',  -- e.g. 45.2 MB
    file_size_bytes BIGINT DEFAULT 0,
    preview_url TEXT,                               -- Icon or screenshot preview
    source_type VARCHAR(32) NOT NULL DEFAULT 'direct_url', 
    -- source_type options:
    --   'telegram_bot'   : Telegram Bot API file_id (proxied via bot)
    --   'telegram_link'  : Telegram channel message link (e.g. https://t.me/techiemuthuraj/123)
    --   'direct_url'     : External secure or cloud storage download URL
    --   'supabase_storage': Stored in Supabase private bucket
    source_reference TEXT NOT NULL,                 -- File ID, Channel message ID, or bucket path
    external_download_url TEXT,                     -- Optional direct URL if source is external
    download_count BIGINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    version VARCHAR(32) DEFAULT '1.0.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for files
CREATE INDEX IF NOT EXISTS idx_files_code ON public.files(file_code);
CREATE INDEX IF NOT EXISTS idx_files_category ON public.files(category);
CREATE INDEX IF NOT EXISTS idx_files_active ON public.files(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_files_created ON public.files(created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. Table: app_users
-- Optional registered or tracked users who are granted tokens
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL UNIQUE,        -- Email or Telegram username/ID
    display_name VARCHAR(255),
    notes TEXT,
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_app_users_identifier ON public.app_users(identifier);

-- -----------------------------------------------------------------------------
-- 3. Table: access_tokens
-- Stores cryptographically hashed tokens for file authorization
-- Plaintext tokens are NEVER stored in the database!
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    user_identifier VARCHAR(255),                   -- Quick label (e.g. user@example.com or @telegram_user)
    token_hash VARCHAR(64) NOT NULL UNIQUE,         -- SHA-256 hash of the secret access token
    token_preview VARCHAR(32) NOT NULL,             -- e.g. TM-****-A9F2 (safe to show in admin dashboard)
    max_downloads INT DEFAULT 1,                    -- 1 = single-use, N = limited, NULL = unlimited
    download_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,                         -- NULL means never expires
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_used_at TIMESTAMPTZ
);

-- Indexes for access_tokens
CREATE INDEX IF NOT EXISTS idx_tokens_file_id ON public.access_tokens(file_id);
CREATE INDEX IF NOT EXISTS idx_tokens_hash ON public.access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_tokens_active ON public.access_tokens(is_revoked, expires_at);
CREATE INDEX IF NOT EXISTS idx_tokens_user ON public.access_tokens(user_id);

-- -----------------------------------------------------------------------------
-- 4. Table: download_logs
-- Immutable security audit log for access attempts and downloads
-- Raw tokens are NEVER recorded in logs!
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.download_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
    token_id UUID REFERENCES public.access_tokens(id) ON DELETE SET NULL,
    file_code VARCHAR(32),
    token_preview VARCHAR(32),
    status VARCHAR(32) NOT NULL, 
    -- Status types:
    --   'authorized'          : Token verified successfully, download ticket issued
    --   'download_completed'  : File delivered successfully
    --   'rejected_invalid'    : Token does not exist
    --   'rejected_mismatch'   : Token exists but belongs to a different file
    --   'rejected_expired'    : Token expiration date passed
    --   'rejected_revoked'    : Token was explicitly revoked by admin
    --   'rejected_exhausted'  : Token reached maximum allowed downloads
    --   'rejected_rate_limit' : Client throttled
    ip_hash VARCHAR(64),                            -- Anonymized IP hash for security audit without privacy invasion
    user_agent TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_logs_created ON public.download_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_file_id ON public.download_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_logs_status ON public.download_logs(status);

-- -----------------------------------------------------------------------------
-- 5. Table: admin_audit_events
-- Tracks administrative actions (token generation, file creation, revocations)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(32) NOT NULL,
    entity_id VARCHAR(64),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_events(created_at DESC);

-- -----------------------------------------------------------------------------
-- 6. Atomic RPC Function: verify_and_claim_download
-- Prevents race conditions with ROW-LEVEL LOCK (FOR UPDATE)
-- Atomically checks expiration, revocation, file match, and download limits.
-- Atomically increments download_count if valid.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_and_claim_download(
    p_file_id UUID,
    p_token_hash VARCHAR(64),
    p_ip_hash VARCHAR(64) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_token RECORD;
    v_file RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_result JSONB;
BEGIN
    -- 1. Fetch file info
    SELECT * INTO v_file FROM public.files WHERE id = p_file_id AND is_active = true;
    IF NOT FOUND THEN
        INSERT INTO public.download_logs(file_id, status, ip_hash, user_agent, details)
        VALUES (p_file_id, 'rejected_invalid_file', p_ip_hash, p_user_agent, jsonb_build_object('reason', 'File not found or inactive'));
        
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'FILE_NOT_FOUND',
            'message', 'The requested file is either inactive or does not exist.'
        );
    END IF;

    -- 2. Lock the token record FOR UPDATE to prevent concurrent race condition exploits
    SELECT * INTO v_token 
    FROM public.access_tokens 
    WHERE token_hash = p_token_hash 
    FOR UPDATE;

    -- 3. Check if token exists
    IF NOT FOUND THEN
        INSERT INTO public.download_logs(file_id, file_code, status, ip_hash, user_agent, details)
        VALUES (p_file_id, v_file.file_code, 'rejected_invalid', p_ip_hash, p_user_agent, jsonb_build_object('reason', 'Token does not exist'));
        
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_TOKEN',
            'message', 'The access token entered is invalid.'
        );
    END IF;

    -- 4. Check if token belongs to this specific file
    IF v_token.file_id <> p_file_id THEN
        INSERT INTO public.download_logs(file_id, token_id, file_code, token_preview, status, ip_hash, user_agent, details)
        VALUES (p_file_id, v_token.id, v_file.file_code, v_token.token_preview, 'rejected_mismatch', p_ip_hash, p_user_agent, jsonb_build_object('reason', 'Token is authorized for a different file'));

        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TOKEN_FILE_MISMATCH',
            'message', 'This token is not valid for this specific file. Tokens are file-specific.'
        );
    END IF;

    -- 5. Check if token has been revoked
    IF v_token.is_revoked THEN
        INSERT INTO public.download_logs(file_id, token_id, file_code, token_preview, status, ip_hash, user_agent, details)
        VALUES (p_file_id, v_token.id, v_file.file_code, v_token.token_preview, 'rejected_revoked', p_ip_hash, p_user_agent, jsonb_build_object('reason', v_token.revoked_reason));

        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TOKEN_REVOKED',
            'message', 'This access token has been revoked by the administrator.'
        );
    END IF;

    -- 6. Check if token has expired
    IF v_token.expires_at IS NOT NULL AND v_token.expires_at < v_now THEN
        INSERT INTO public.download_logs(file_id, token_id, file_code, token_preview, status, ip_hash, user_agent, details)
        VALUES (p_file_id, v_token.id, v_file.file_code, v_token.token_preview, 'rejected_expired', p_ip_hash, p_user_agent, jsonb_build_object('expired_at', v_token.expires_at));

        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TOKEN_EXPIRED',
            'message', 'This access token expired on ' || to_char(v_token.expires_at, 'YYYY-MM-DD HH24:MI UTC')
        );
    END IF;

    -- 7. Check if download limit has been reached
    IF v_token.max_downloads IS NOT NULL AND v_token.download_count >= v_token.max_downloads THEN
        INSERT INTO public.download_logs(file_id, token_id, file_code, token_preview, status, ip_hash, user_agent, details)
        VALUES (p_file_id, v_token.id, v_file.file_code, v_token.token_preview, 'rejected_exhausted', p_ip_hash, p_user_agent, jsonb_build_object('limit', v_token.max_downloads, 'count', v_token.download_count));

        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'DOWNLOAD_LIMIT_REACHED',
            'message', 'The download limit for this access token has been exhausted.'
        );
    END IF;

    -- 8. Valid token! Increment download count atomically
    UPDATE public.access_tokens
    SET 
        download_count = download_count + 1,
        last_used_at = v_now
    WHERE id = v_token.id;

    -- Also increment total file downloads counter
    UPDATE public.files
    SET download_count = download_count + 1,
        updated_at = v_now
    WHERE id = p_file_id;

    -- Log successful authorization
    INSERT INTO public.download_logs(file_id, token_id, file_code, token_preview, status, ip_hash, user_agent, details)
    VALUES (p_file_id, v_token.id, v_file.file_code, v_token.token_preview, 'authorized', p_ip_hash, p_user_agent, jsonb_build_object(
        'download_number', v_token.download_count + 1,
        'max_downloads', v_token.max_downloads
    ));

    RETURN jsonb_build_object(
        'success', true,
        'token_id', v_token.id,
        'file_id', v_file.id,
        'file_code', v_file.file_code,
        'title', v_file.title,
        'source_type', v_file.source_type,
        'source_reference', v_file.source_reference,
        'external_download_url', v_file.external_download_url,
        'downloads_used', v_token.download_count + 1,
        'max_downloads', v_token.max_downloads,
        'downloads_remaining', CASE WHEN v_token.max_downloads IS NULL THEN NULL ELSE (v_token.max_downloads - (v_token.download_count + 1)) END
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. Row Level Security (RLS) Policies
-- Enforce principle of least privilege
-- -----------------------------------------------------------------------------
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_events ENABLE ROW LEVEL SECURITY;

-- Files: Public can read active and non-archived files only
CREATE POLICY "Public can view active files"
    ON public.files FOR SELECT
    USING (is_active = true AND is_archived = false);

-- Files: Service role / Admin has full access
CREATE POLICY "Service role has full access to files"
    ON public.files FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Access Tokens: PUBLIC HAS ZERO DIRECT ACCESS!
-- Tokens are only verified via the SECURITY DEFINER RPC verify_and_claim_download
CREATE POLICY "Service role has full access to access_tokens"
    ON public.access_tokens FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- App Users: Service role only
CREATE POLICY "Service role has full access to app_users"
    ON public.app_users FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Download Logs: Service role only
CREATE POLICY "Service role has full access to download_logs"
    ON public.download_logs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Admin Audit Events: Service role only
CREATE POLICY "Service role has full access to admin_audit_events"
    ON public.admin_audit_events FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- End of Schema Migration
-- =============================================================================
