-- =============================================================================
-- techiemuthuraj Files - Initial Seed Data
-- For testing, demonstration, and initial database setup
-- =============================================================================

-- 1. Insert Sample Digital Resources
INSERT INTO public.files (
    id, file_code, title, description, category, file_type, file_size, file_size_bytes, 
    preview_url, source_type, source_reference, external_download_url, version
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
    '4.2.0'
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
    '2.6.1'
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
    '3.1.0'
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
    'BQACAgUAAxkBAAICcGe...', -- Telegram Bot File ID
    'https://github.com/techiemuthuraj/demo-assets/archive/refs/heads/main.zip',
    '1.4.2'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert App Users
INSERT INTO public.app_users (id, identifier, display_name, notes) VALUES
('11111111-1111-1111-1111-111111111111', 'vip_user@techiemuthuraj.com', 'VIP Developer Muthu', 'Premium channel subscriber'),
('22222222-2222-2222-2222-222222222222', '@raj_tech_pilot', 'Raj Tech Pilot', 'Telegram beta tester')
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Demo Tokens (hashed with SHA-256)
-- Token 1 (Active, 3 downloads max): TM-DEMO-NETSPEED-2026
-- SHA-256('TM-DEMO-NETSPEED-2026') = 8c13ee5a9a5cb0e615be51f8f793c4ab741ef28840c3962a2d7505105a7b0110
INSERT INTO public.access_tokens (
    id, file_id, user_id, user_identifier, token_hash, token_preview, max_downloads, download_count, expires_at
) VALUES (
    '33333333-3333-3333-3333-333333333331',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'vip_user@techiemuthuraj.com',
    '8c13ee5a9a5cb0e615be51f8f793c4ab741ef28840c3962a2d7505105a7b0110',
    'TM-DEMO-****-2026',
    3,
    0,
    timezone('utc'::text, now()) + interval '30 days'
) ON CONFLICT (token_hash) DO NOTHING;

-- Token 2 (Single Use): TM-SINGLE-DEVOPS-9999
-- SHA-256('TM-SINGLE-DEVOPS-9999') = 5ba27a8c7e6d3f594bdeeb9e0b4bad396e13204fdd8349a5d4141f23159776dd
INSERT INTO public.access_tokens (
    id, file_id, user_identifier, token_hash, token_preview, max_downloads, download_count, expires_at
) VALUES (
    '33333333-3333-3333-3333-333333333332',
    '00000000-0000-0000-0000-000000000002',
    '@raj_tech_pilot',
    '5ba27a8c7e6d3f594bdeeb9e0b4bad396e13204fdd8349a5d4141f23159776dd',
    'TM-SING-****-9999',
    1,
    0,
    timezone('utc'::text, now()) + interval '7 days'
) ON CONFLICT (token_hash) DO NOTHING;
