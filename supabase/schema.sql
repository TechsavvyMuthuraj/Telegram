-- =============================================================================
-- techiemuthuraj Files - Complete Production Supabase Database Schema
-- Token-Gated Download Management, Telegram Bot Sync & User Auth Verification
-- URL: https://techsavvymuthuraj.dev/ | Channel: @techiemuthuraj
-- =============================================================================

-- Enable pgcrypto extension for cryptographically secure UUIDs and hashes
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. Table: files
-- Stores digital files, tools, APKs, scripts and Telegram channel references
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_code VARCHAR(32) NOT NULL UNIQUE,          -- Human-friendly code (e.g. TM-APK-901)
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(64) NOT NULL DEFAULT 'General',-- APK, Software, Tools, Scripts, Documents, System
    file_type VARCHAR(32) NOT NULL DEFAULT 'ZIP',   -- APK, ZIP, EXE, PDF, PY, BIN
    file_size VARCHAR(32) NOT NULL DEFAULT '0 MB',  -- Display size (e.g. 14.5 MB)
    file_size_bytes BIGINT DEFAULT 0,
    preview_url TEXT,                               -- Icon or screenshot preview URL
    source_type VARCHAR(32) NOT NULL DEFAULT 'direct_url', 
    -- Options: 'telegram_bot', 'telegram_link', 'direct_url', 'supabase_storage'
    source_reference TEXT NOT NULL,                 -- File ID, Channel message URL, or external link
    external_download_url TEXT,                     -- Direct download stream URL
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

-- =============================================================================
-- 2. Table: app_users
-- Telegram channel members and tracked portal visitors
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL UNIQUE,        -- Telegram username (e.g. @techiemuthurajofficial) or ID
    display_name VARCHAR(255),
    notes TEXT,
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_app_users_identifier ON public.app_users(identifier);
CREATE INDEX IF NOT EXISTS idx_app_users_blocked ON public.app_users(is_blocked);

-- =============================================================================
-- 3. Table: access_tokens
-- Stores cryptographically hashed tokens for file authorization and sessions
-- Plaintext tokens are NEVER stored in the database!
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES public.files(id) ON DELETE CASCADE, -- Nullable for generic auth sessions
    user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    user_identifier VARCHAR(255),                   -- User handle or 'AUTH_SESSION:<code>'
    token_hash VARCHAR(64) NOT NULL UNIQUE,         -- SHA-256 hash or session ID
    token_preview VARCHAR(32) NOT NULL,             -- e.g. TM-****-A9F2 or 6-digit PIN
    max_downloads INT DEFAULT 1,                    -- 1 = single-use, N = limited, NULL = unlimited
    download_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,                         -- NULL means never expires
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,                            -- Reason string or serialized session JSON
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_used_at TIMESTAMPTZ
);

-- If table was created earlier with NOT NULL on file_id, safely drop that constraint
DO $$
BEGIN
    ALTER TABLE public.access_tokens ALTER COLUMN file_id DROP NOT NULL;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Indexes for access_tokens
CREATE INDEX IF NOT EXISTS idx_tokens_file_id ON public.access_tokens(file_id);
CREATE INDEX IF NOT EXISTS idx_tokens_hash ON public.access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_tokens_active ON public.access_tokens(is_revoked, expires_at);
CREATE INDEX IF NOT EXISTS idx_tokens_user ON public.access_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_identifier ON public.access_tokens(user_identifier);
CREATE INDEX IF NOT EXISTS idx_tokens_preview ON public.access_tokens(token_preview);

-- =============================================================================
-- 4. Table: auth_sessions (Dedicated Distributed Login Verification Store)
-- Stores 6-digit login PINs and realtime Telegram verification state
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(64) NOT NULL UNIQUE,         -- e.g. TM-AUTH-EF6861506AA1
    code VARCHAR(16) NOT NULL UNIQUE,               -- 6-digit PIN (e.g. 553593)
    claimed_username VARCHAR(255),                  -- Username requested on website
    actual_username VARCHAR(255),                   -- Authentic Telegram handle verified by bot
    telegram_id BIGINT,                             -- Telegram numeric user ID
    status VARCHAR(32) NOT NULL DEFAULT 'pending',  -- 'pending', 'verified', 'rejected_fake', 'expired'
    user_data JSONB,                                -- Full Telegram user profile
    auth_token TEXT,                                -- Cryptographically signed JWT token
    error TEXT,
    rejection_reason TEXT,
    client_ip VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_code ON public.auth_sessions(code);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_session_id ON public.auth_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_status ON public.auth_sessions(status);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON public.auth_sessions(expires_at);

-- =============================================================================
-- 5. Table: download_logs
-- Immutable security audit log for access attempts and downloads
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.download_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
    token_id UUID REFERENCES public.access_tokens(id) ON DELETE SET NULL,
    file_code VARCHAR(32),
    token_preview VARCHAR(32),
    status VARCHAR(32) NOT NULL,
    -- Status values: 'authorized', 'download_completed', 'rejected_invalid',
    -- 'rejected_mismatch', 'rejected_expired', 'rejected_revoked', 'rejected_exhausted'
    ip_hash VARCHAR(64),
    user_agent TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_logs_created ON public.download_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_file_id ON public.download_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_logs_status ON public.download_logs(status);

-- =============================================================================
-- 6. Table: admin_audit_events
-- Tracks administrative actions (file creation, token issuance, revocations)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(32) NOT NULL,
    entity_id VARCHAR(64),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_events(created_at DESC);

-- =============================================================================
-- 7. Triggers: Automatic Updated_At Timestamp Management
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_files_updated_at ON public.files;
CREATE TRIGGER trigger_files_updated_at
    BEFORE UPDATE ON public.files
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_app_users_updated_at ON public.app_users;
CREATE TRIGGER trigger_app_users_updated_at
    BEFORE UPDATE ON public.app_users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 8. Permanent Global System Container Record in files
-- Ensures foreign key references in access_tokens never fail
-- =============================================================================
INSERT INTO public.files (
    id, file_code, title, description, category, file_type, file_size, source_type, source_reference, is_active
) VALUES (
    'c2d8ddc8-ec48-402b-9b9d-d3d8e6389989',
    'SYS-AUTH-GLOBAL',
    'System Auth Token Container',
    'Internal system container for Telegram authentication tokens and sessions',
    'System',
    'BIN',
    '0 MB',
    'direct_url',
    'system://auth',
    true
)
ON CONFLICT (id) DO UPDATE 
SET file_code = EXCLUDED.file_code,
    title = EXCLUDED.title,
    source_reference = EXCLUDED.source_reference,
    is_active = true;

-- =============================================================================
-- 9. Atomic RPC Function: verify_and_claim_download
-- Prevents race conditions with ROW-LEVEL LOCK (FOR UPDATE)
-- Atomically checks expiration, revocation, file match, and download limits
-- =============================================================================
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

-- =============================================================================
-- 10. Row Level Security (RLS) Policies (Safe & Idempotent)
-- =============================================================================
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_events ENABLE ROW LEVEL SECURITY;

-- Files Policies
DROP POLICY IF EXISTS "Public can view active files" ON public.files;
CREATE POLICY "Public can view active files"
    ON public.files FOR SELECT
    USING (is_active = true AND is_archived = false);

DROP POLICY IF EXISTS "Service role has full access to files" ON public.files;
CREATE POLICY "Service role has full access to files"
    ON public.files FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Access Tokens Policies (Public has zero direct access; verified via secure backend / RPC)
DROP POLICY IF EXISTS "Service role has full access to access_tokens" ON public.access_tokens;
CREATE POLICY "Service role has full access to access_tokens"
    ON public.access_tokens FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Auth Sessions Policies
DROP POLICY IF EXISTS "Service role has full access to auth_sessions" ON public.auth_sessions;
CREATE POLICY "Service role has full access to auth_sessions"
    ON public.auth_sessions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- App Users Policies
DROP POLICY IF EXISTS "Service role has full access to app_users" ON public.app_users;
CREATE POLICY "Service role has full access to app_users"
    ON public.app_users FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Download Logs Policies
DROP POLICY IF EXISTS "Service role has full access to download_logs" ON public.download_logs;
CREATE POLICY "Service role has full access to download_logs"
    ON public.download_logs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Admin Audit Events Policies
DROP POLICY IF EXISTS "Service role has full access to admin_audit_events" ON public.admin_audit_events;
CREATE POLICY "Service role has full access to admin_audit_events"
    ON public.admin_audit_events FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- Schema update completed successfully!
-- =============================================================================
