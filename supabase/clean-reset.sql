-- =============================================================================
-- techiemuthuraj Files - Complete Clean State & Reset SQL Script
-- Run this script in the Supabase SQL Editor to wipe test logs, purge mock files,
-- and reset all counters to a clean real-time synchronized state.
-- =============================================================================

-- 1. Purge all activity & access download logs
DELETE FROM public.download_logs;

-- 2. Purge test and temporary access tokens
DELETE FROM public.access_tokens 
WHERE token_preview LIKE 'TM-TEST-%' 
   OR user_identifier LIKE 'AUTH_SESSION:%';

-- 3. Purge test files and duplicate generated documents
DELETE FROM public.files 
WHERE file_code LIKE 'TM-TEST-%' 
   OR file_code IN ('TM-APK-507', 'TM-APK-434', 'TM-APK-722', 'TM-APK-158');

-- 4. Reset download counts on all remaining official files to 0
UPDATE public.files 
SET download_count = 0;

-- 5. Ensure official production catalog files exist cleanly
INSERT INTO public.files (
    id, file_code, title, description, category, file_type, file_size, file_size_bytes, 
    preview_url, source_type, source_reference, external_download_url, version, download_count, is_active, is_archived
) VALUES 
(
    '00000000-0000-0000-0000-000000000001',
    'TM-APK-901',
    'NetSpeed Monitor Pro v4.2.0 (Ad-Free MOD)',
    'Real-time network speed indicator for Android status bar and notification drawer with historical traffic logs and ping statistics.',
    'APK',
    'APK',
    '8.4 MB',
    8808038,
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80',
    'direct_url',
    'https://raw.githubusercontent.com/techiemuthuraj/demo-assets/main/netspeed-pro-v4.apk',
    'https://raw.githubusercontent.com/techiemuthuraj/demo-assets/main/netspeed-pro-v4.apk',
    '4.2.0',
    0,
    true,
    false
),
(
    '00000000-0000-0000-0000-000000000002',
    'TM-TOOL-771',
    'DevOps Automation Utility Pack 2026',
    'Collection of PowerShell, Bash, and Python orchestration utilities for server provisioning, Docker cleanup, and SSL certificate rotation.',
    'Tools',
    'ZIP',
    '42.1 MB',
    44145050,
    'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?w=400&auto=format&fit=crop&q=80',
    'telegram_link',
    'https://t.me/techiemuthuraj/412',
    'https://github.com/techiemuthuraj/demo-assets/archive/refs/heads/main.zip',
    '2.6.1',
    0,
    true,
    false
),
(
    '00000000-0000-0000-0000-000000000003',
    'TM-SOFT-304',
    'AudioMaster Studio FX Suite for Windows',
    'Low-latency digital audio workstation plugin rack with studio reverb, parametric EQ, and dynamic noise gate modules.',
    'Software',
    'EXE',
    '128.5 MB',
    134742016,
    'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&auto=format&fit=crop&q=80',
    'direct_url',
    'https://github.com/techiemuthuraj/demo-assets/releases/download/v1.0/AudioMaster-Setup.exe',
    'https://github.com/techiemuthuraj/demo-assets/releases/download/v1.0/AudioMaster-Setup.exe',
    '3.1.0',
    0,
    true,
    false
),
(
    '00000000-0000-0000-0000-000000000004',
    'TM-SCR-119',
    'Cloudflare Workers Telegram Bot Starter Kit',
    'Complete edge-computing boilerplate in TypeScript for high-speed Telegram Bots with webhook verification, rate limiting, and KV caching.',
    'Scripts',
    'ZIP',
    '3.2 MB',
    3355443,
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&auto=format&fit=crop&q=80',
    'telegram_bot',
    'BQACAgUAAxkBAAICcGe...',
    'https://github.com/techiemuthuraj/demo-assets/archive/refs/heads/main.zip',
    '1.4.2',
    0,
    true,
    false
)
ON CONFLICT (file_code) DO UPDATE 
SET download_count = 0, is_active = true, is_archived = false;

-- 6. Verification query
SELECT file_code, title, download_count, is_active FROM public.files;
