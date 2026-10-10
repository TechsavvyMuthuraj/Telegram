// =============================================================================
// techiemuthuraj Files - Database Access Layer
// Supabase Client with Resilient Fallback Store & Atomic Locking Semantics
// =============================================================================

try { require('dotenv').config(); } catch (_) {}
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { hashToken, generateTokenPreview } = require('./crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://klelgazjpgogsmdrbbql.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsZWxnYXpqcGdvZ3NtZHJiYnFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTYyMTkwNCwiZXhwIjoyMTA3MTk3OTA0fQ.FAyrrki6VeLX80tIP6SzV9gAvtesZMRP3MHReDZQ05k';

// Check if live Supabase credentials are configured
const isLiveSupabase = Boolean(
  SUPABASE_URL && 
  SUPABASE_SERVICE_ROLE_KEY && 
  !SUPABASE_URL.includes('your-supabase-project')
);

let supabaseClient = null;
if (isLiveSupabase) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// =============================================================================
// Local In-Memory Fallback Store (Matches Supabase Schema Exactly)
// =============================================================================
const inMemoryStore = {
  files: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      file_code: 'TM-APK-901',
      title: 'NetSpeed Monitor Pro v4.2.0 (Ad-Free MOD)',
      description: 'Real-time network speed indicator for Android status bar and notification drawer with historical traffic logs and ping statistics.',
      category: 'APK',
      file_type: 'APK',
      file_size: '8.4 MB',
      file_size_bytes: 8808038,
      preview_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80',
      source_type: 'direct_url',
      source_reference: 'https://raw.githubusercontent.com/techiemuthuraj/demo-assets/main/netspeed-pro-v4.apk',
      external_download_url: 'https://raw.githubusercontent.com/techiemuthuraj/demo-assets/main/netspeed-pro-v4.apk',
      download_count: 142,
      is_active: true,
      is_archived: false,
      version: '4.2.0',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      file_code: 'TM-TOOL-771',
      title: 'DevOps Automation Utility Pack 2026',
      description: 'Collection of PowerShell, Bash, and Python orchestration utilities for server provisioning, Docker cleanup, and SSL certificate rotation.',
      category: 'Tools',
      file_type: 'ZIP',
      file_size: '42.1 MB',
      file_size_bytes: 44145050,
      preview_url: 'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?w=400&auto=format&fit=crop&q=80',
      source_type: 'telegram_link',
      source_reference: 'https://t.me/techiemuthuraj/412',
      external_download_url: 'https://github.com/techiemuthuraj/demo-assets/archive/refs/heads/main.zip',
      download_count: 89,
      is_active: true,
      is_archived: false,
      version: '2.6.1',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      file_code: 'TM-SOFT-304',
      title: 'AudioMaster Studio FX Suite for Windows',
      description: 'Low-latency digital audio workstation plugin rack with studio reverb, parametric EQ, and dynamic noise gate modules.',
      category: 'Software',
      file_type: 'EXE',
      file_size: '128.5 MB',
      file_size_bytes: 134742016,
      preview_url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&auto=format&fit=crop&q=80',
      source_type: 'direct_url',
      source_reference: 'https://github.com/techiemuthuraj/demo-assets/releases/download/v1.0/AudioMaster-Setup.exe',
      external_download_url: 'https://github.com/techiemuthuraj/demo-assets/releases/download/v1.0/AudioMaster-Setup.exe',
      download_count: 53,
      is_active: true,
      is_archived: false,
      version: '3.1.0',
      created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      file_code: 'TM-SCR-119',
      title: 'Cloudflare Workers Telegram Bot Starter Kit',
      description: 'Complete edge-computing boilerplate in TypeScript for high-speed Telegram Bots with webhook verification, rate limiting, and KV caching.',
      category: 'Scripts',
      file_type: 'ZIP',
      file_size: '3.2 MB',
      file_size_bytes: 3355443,
      preview_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&auto=format&fit=crop&q=80',
      source_type: 'telegram_bot',
      source_reference: 'BQACAgUAAxkBAAICcGe9384938...',
      external_download_url: 'https://github.com/techiemuthuraj/demo-assets/archive/refs/heads/main.zip',
      download_count: 312,
      is_active: true,
      is_archived: false,
      version: '1.4.2',
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      updated_at: new Date().toISOString()
    }
  ],

  access_tokens: [
    {
      id: '33333333-3333-3333-3333-333333333331',
      file_id: '00000000-0000-0000-0000-000000000001',
      user_id: '11111111-1111-1111-1111-111111111111',
      user_identifier: 'vip_user@techiemuthuraj.com',
      token_hash: hashToken('TM-7B4A-91C2-8E31'),
      token_preview: 'TM-7B**-****-8E31',
      max_downloads: 3,
      download_count: 0,
      expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
      is_revoked: false,
      revoked_at: null,
      revoked_reason: null,
      created_at: new Date().toISOString(),
      last_used_at: null
    },
    {
      id: '33333333-3333-3333-3333-333333333332',
      file_id: '00000000-0000-0000-0000-000000000002',
      user_id: null,
      user_identifier: '@raj_tech_pilot',
      token_hash: hashToken('TM-2F9D-48E1-70A5'),
      token_preview: 'TM-2F**-****-70A5',
      max_downloads: 1,
      download_count: 0,
      expires_at: new Date(Date.now() + 86400000 * 7).toISOString(),
      is_revoked: false,
      revoked_at: null,
      revoked_reason: null,
      created_at: new Date().toISOString(),
      last_used_at: null
    }
  ],

  app_users: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      identifier: 'vip_user@techiemuthuraj.com',
      display_name: 'VIP Developer Muthu',
      notes: 'Premium channel subscriber',
      is_blocked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      identifier: '@raj_tech_pilot',
      display_name: 'Raj Tech Pilot',
      notes: 'Telegram beta tester',
      is_blocked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],

  download_logs: [
    {
      id: 'log-001',
      file_id: '00000000-0000-0000-0000-000000000001',
      token_id: '33333333-3333-3333-3333-333333333331',
      file_code: 'TM-APK-901',
      token_preview: 'TM-7B**-****-8E31',
      status: 'authorized',
      ip_hash: 'c8f49a12b083a21e',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      details: { sample: true },
      created_at: new Date(Date.now() - 3600000 * 2).toISOString()
    }
  ]
};

// =============================================================================
// Database API Layer
// =============================================================================

/**
 * Get all active files for the public catalog
 */
async function getPublicFiles(options = {}) {
  const { category, search } = options;

  if (isLiveSupabase) {
    let query = supabaseClient
      .from('files')
      .select('id, file_code, title, description, category, file_type, file_size, preview_url, download_count, version, created_at')
      .eq('is_active', true)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (category && category !== 'All') {
      query = query.eq('category', category);
    }
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // Fallback store
  let results = inMemoryStore.files.filter(f => f.is_active && !f.is_archived);
  if (category && category !== 'All') {
    results = results.filter(f => f.category.toLowerCase() === category.toLowerCase());
  }
  if (search) {
    const s = search.toLowerCase();
    results = results.filter(f => f.title.toLowerCase().includes(s) || f.description.toLowerCase().includes(s) || f.file_code.toLowerCase().includes(s));
  }
  return results.map(({ source_reference, external_download_url, ...safePublic }) => safePublic);
}

/**
 * Get single file by ID or file_code
 */
async function getFileById(fileIdOrCode) {
  if (isLiveSupabase) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileIdOrCode);
    let query = supabaseClient.from('files').select('*');
    if (isUuid) {
      query = query.eq('id', fileIdOrCode);
    } else {
      query = query.eq('file_code', fileIdOrCode);
    }
    const { data, error } = await query.maybeSingle();
    if (error) return null;
    return data;
  }

  return inMemoryStore.files.find(f => f.id === fileIdOrCode || f.file_code === fileIdOrCode) || null;
}

/**
 * Admin: Get all files including source references and archive state (filters out archived)
 */
async function getAllFilesAdmin() {
  if (isLiveSupabase) {
    const { data, error } = await supabaseClient
      .from('files')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
  return inMemoryStore.files.filter(f => !f.is_archived).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Admin: Insert new file
 */
async function createFile(fileData) {
  const newFile = {
    id: fileData.id || crypto.randomUUID(),
    file_code: fileData.file_code || `TM-${fileData.file_type || 'FILE'}-${Math.floor(100 + Math.random() * 900)}`,
    title: fileData.title,
    description: fileData.description || '',
    category: fileData.category || 'General',
    file_type: fileData.file_type || 'ZIP',
    file_size: fileData.file_size || '0 MB',
    file_size_bytes: fileData.file_size_bytes || 0,
    preview_url: fileData.preview_url || '',
    source_type: fileData.source_type || 'direct_url',
    source_reference: fileData.source_reference || '',
    external_download_url: fileData.external_download_url || '',
    download_count: 0,
    is_active: fileData.is_active !== undefined ? fileData.is_active : true,
    is_archived: false,
    version: fileData.version || '1.0.0',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (isLiveSupabase) {
    const { data, error } = await supabaseClient
      .from('files')
      .upsert(newFile, { onConflict: 'file_code' })
      .select()
      .single();
    if (error) {
      const { data: existing } = await supabaseClient
        .from('files')
        .select('*')
        .eq('file_code', newFile.file_code)
        .maybeSingle();
      if (existing) return existing;
      throw error;
    }
    return data;
  }

  inMemoryStore.files.unshift(newFile);
  return newFile;
}

/**
 * Admin: Update existing file
 */
async function updateFile(id, updateData) {
  const payload = { ...updateData, updated_at: new Date().toISOString() };
  if (payload.id) delete payload.id; // Prevent updating immutable primary key

  if (isLiveSupabase) {
    const { data, error } = await supabaseClient
      .from('files')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const idx = inMemoryStore.files.findIndex(f => f.id === id);
  if (idx === -1) return null;
  inMemoryStore.files[idx] = { ...inMemoryStore.files[idx], ...payload };
  return inMemoryStore.files[idx];
}

/**
 * Admin: Delete single file permanently
 */
async function deleteFile(id, hardDelete = true) {
  return deleteMultipleFiles([id], hardDelete);
}

/**
 * Admin: Delete multiple files permanently or soft-archive
 */
async function deleteMultipleFiles(ids, hardDelete = true) {
  if (!Array.isArray(ids) || ids.length === 0) return true;

  if (isLiveSupabase) {
    if (hardDelete) {
      const { error } = await supabaseClient.from('files').delete().in('id', ids);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient
        .from('files')
        .update({ is_archived: true, is_active: false })
        .in('id', ids);
      if (error) throw error;
    }
    return true;
  }

  if (hardDelete) {
    inMemoryStore.files = inMemoryStore.files.filter(f => !ids.includes(f.id));
    inMemoryStore.access_tokens = inMemoryStore.access_tokens.filter(t => !ids.includes(t.file_id));
  } else {
    inMemoryStore.files.forEach(f => {
      if (ids.includes(f.id)) {
        f.is_archived = true;
        f.is_active = false;
      }
    });
  }
  return true;
}

/**
 * Atomic token verification & download claiming
 * Calls Supabase RPC verify_and_claim_download or fallback with atomic in-memory mutex
 */
let memoryMutex = Promise.resolve();

async function verifyAndClaimDownload({ fileId, tokenHash, ipHash, userAgent }) {
  if (isLiveSupabase) {
    const { data, error } = await supabaseClient.rpc('verify_and_claim_download', {
      p_file_id: fileId,
      p_token_hash: tokenHash,
      p_ip_hash: ipHash || null,
      p_user_agent: userAgent || null
    });
    if (error) throw error;
    return data;
  }

  // Atomic fallback execution using promise chain mutex to simulate PostgreSQL FOR UPDATE
  return new Promise((resolve) => {
    memoryMutex = memoryMutex.then(() => {
      const file = inMemoryStore.files.find(f => (f.id === fileId || f.file_code === fileId) && f.is_active);
      if (!file) {
        logAttempt({ fileId, status: 'rejected_invalid_file', ipHash, userAgent, details: { reason: 'File not found' } });
        resolve({
          success: false,
          error_code: 'FILE_NOT_FOUND',
          message: 'The requested file is either inactive or does not exist.'
        });
        return;
      }

      const token = inMemoryStore.access_tokens.find(t => t.token_hash === tokenHash);
      if (!token) {
        logAttempt({ fileId: file.id, fileCode: file.file_code, status: 'rejected_invalid', ipHash, userAgent, details: { reason: 'Token not found' } });
        resolve({
          success: false,
          error_code: 'INVALID_TOKEN',
          message: 'The access token entered is invalid.'
        });
        return;
      }

      // Check file match
      if (token.file_id !== file.id) {
        logAttempt({ fileId: file.id, tokenId: token.id, fileCode: file.file_code, tokenPreview: token.token_preview, status: 'rejected_mismatch', ipHash, userAgent, details: { reason: 'Wrong file' } });
        resolve({
          success: false,
          error_code: 'TOKEN_FILE_MISMATCH',
          message: 'This token is not valid for this specific file. Tokens are file-specific.'
        });
        return;
      }

      // Check revocation
      if (token.is_revoked) {
        logAttempt({ fileId: file.id, tokenId: token.id, fileCode: file.file_code, tokenPreview: token.token_preview, status: 'rejected_revoked', ipHash, userAgent, details: { reason: token.revoked_reason } });
        resolve({
          success: false,
          error_code: 'TOKEN_REVOKED',
          message: 'This access token has been revoked by the administrator.'
        });
        return;
      }

      // Check expiration
      if (token.expires_at && new Date(token.expires_at) < new Date()) {
        logAttempt({ fileId: file.id, tokenId: token.id, fileCode: file.file_code, tokenPreview: token.token_preview, status: 'rejected_expired', ipHash, userAgent, details: { expires_at: token.expires_at } });
        resolve({
          success: false,
          error_code: 'TOKEN_EXPIRED',
          message: `This access token expired on ${new Date(token.expires_at).toISOString().slice(0, 10)}.`
        });
        return;
      }

      // Check download limit
      if (token.max_downloads !== null && token.download_count >= token.max_downloads) {
        logAttempt({ fileId: file.id, tokenId: token.id, fileCode: file.file_code, tokenPreview: token.token_preview, status: 'rejected_exhausted', ipHash, userAgent, details: { max: token.max_downloads, count: token.download_count } });
        resolve({
          success: false,
          error_code: 'DOWNLOAD_LIMIT_REACHED',
          message: 'The download limit for this access token has been exhausted.'
        });
        return;
      }

      // Valid! Atomically increment
      token.download_count += 1;
      token.last_used_at = new Date().toISOString();
      file.download_count += 1;

      logAttempt({ fileId: file.id, tokenId: token.id, fileCode: file.file_code, tokenPreview: token.token_preview, status: 'authorized', ipHash, userAgent, details: { count: token.download_count } });

      resolve({
        success: true,
        token_id: token.id,
        file_id: file.id,
        file_code: file.file_code,
        title: file.title,
        source_type: file.source_type,
        source_reference: file.source_reference,
        external_download_url: file.external_download_url,
        downloads_used: token.download_count,
        max_downloads: token.max_downloads,
        downloads_remaining: token.max_downloads === null ? null : (token.max_downloads - token.download_count)
      });
    });
  });
}

function logAttempt({ fileId, tokenId, fileCode, tokenPreview, status, ipHash, userAgent, details }) {
  const logEntry = {
    id: crypto.randomUUID(),
    file_id: fileId,
    token_id: tokenId || null,
    file_code: fileCode || null,
    token_preview: tokenPreview || null,
    status,
    ip_hash: ipHash,
    user_agent: userAgent,
    details: details || {},
    created_at: new Date().toISOString()
  };
  inMemoryStore.download_logs.unshift(logEntry);
  if (inMemoryStore.download_logs.length > 500) {
    inMemoryStore.download_logs.pop();
  }
}

/**
 * Admin: Insert access token(s)
 */
async function createAccessTokens(tokensList) {
  if (isLiveSupabase) {
    const { data, error } = await supabaseClient
      .from('access_tokens')
      .insert(tokensList)
      .select();
    if (error) throw error;
    return data;
  }

  tokensList.forEach(t => {
    inMemoryStore.access_tokens.unshift({
      id: t.id || crypto.randomUUID(),
      download_count: 0,
      is_revoked: false,
      revoked_at: null,
      revoked_reason: null,
      created_at: new Date().toISOString(),
      last_used_at: null,
      ...t
    });
  });
  return tokensList;
}

/**
 * Admin: Get tokens list with file info
 */
async function getTokensAdmin(filters = {}) {
  const { file_id, status, search } = filters;

  if (isLiveSupabase) {
    let query = supabaseClient
      .from('access_tokens')
      .select(`
        id, file_id, user_identifier, token_preview, max_downloads, download_count, 
        expires_at, is_revoked, revoked_at, revoked_reason, created_at, last_used_at,
        files (id, file_code, title)
      `)
      .order('created_at', { ascending: false });

    if (file_id) query = query.eq('file_id', file_id);
    if (status === 'revoked') query = query.eq('is_revoked', true);
    if (status === 'active') query = query.eq('is_revoked', false);
    query = query.not('user_identifier', 'like', 'AUTH_SESSION%');

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  let list = inMemoryStore.access_tokens
    .filter(t => !t.user_identifier || !t.user_identifier.startsWith('AUTH_SESSION:'))
    .map(t => {
    const file = inMemoryStore.files.find(f => f.id === t.file_id);
    return {
      ...t,
      files: file ? { id: file.id, file_code: file.file_code, title: file.title } : null
    };
  });

  if (file_id) list = list.filter(t => t.file_id === file_id);
  if (status === 'revoked') list = list.filter(t => t.is_revoked);
  if (status === 'active') list = list.filter(t => !t.is_revoked);
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(t => 
      (t.user_identifier && t.user_identifier.toLowerCase().includes(s)) ||
      (t.token_preview && t.token_preview.toLowerCase().includes(s))
    );
  }
  return list;
}

/**
 * Admin: Revoke single token
 */
async function revokeToken(tokenId, reason = 'Revoked by admin') {
  const payload = {
    is_revoked: true,
    revoked_at: new Date().toISOString(),
    revoked_reason: reason
  };

  if (isLiveSupabase) {
    const { data, error } = await supabaseClient
      .from('access_tokens')
      .update(payload)
      .eq('id', tokenId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const tok = inMemoryStore.access_tokens.find(t => t.id === tokenId);
  if (!tok) return null;
  Object.assign(tok, payload);
  return tok;
}

/**
 * Admin: Bulk revoke tokens
 */
async function revokeTokens(tokenIds, reason = 'Revoked by admin') {
  if (!Array.isArray(tokenIds) || tokenIds.length === 0) return true;
  const payload = {
    is_revoked: true,
    revoked_at: new Date().toISOString(),
    revoked_reason: reason
  };

  if (isLiveSupabase) {
    const { error } = await supabaseClient
      .from('access_tokens')
      .update(payload)
      .in('id', tokenIds);
    if (error) throw error;
    return true;
  }

  inMemoryStore.access_tokens.forEach(t => {
    if (tokenIds.includes(t.id)) {
      Object.assign(t, payload);
    }
  });
  return true;
}

/**
 * Admin: Delete tokens permanently (single or bulk)
 */
async function deleteTokens(tokenIds) {
  if (!Array.isArray(tokenIds) || tokenIds.length === 0) return true;

  if (isLiveSupabase) {
    const { error } = await supabaseClient
      .from('access_tokens')
      .delete()
      .in('id', tokenIds);
    if (error) throw error;
    return true;
  }

  inMemoryStore.access_tokens = inMemoryStore.access_tokens.filter(t => !tokenIds.includes(t.id));
  return true;
}

/**
 * Admin: Get activity & download logs
 */
async function getLogsAdmin(limit = 100) {
  if (isLiveSupabase) {
    const { data, error } = await supabaseClient
      .from('download_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }
  return inMemoryStore.download_logs.slice(0, limit);
}

/**
 * Admin: Get App Users (aggregates Supabase/memory users + verified Telegram sessions + token holders)
 */
async function getUsersAdmin() {
  let users = [];
  if (isLiveSupabase) {
    try {
      const { data, error } = await supabaseClient
        .from('app_users')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) users = data;
    } catch (e) {
      console.warn('[DB] Supabase getUsersAdmin error, using memory:', e.message);
      users = [...inMemoryStore.app_users];
    }
  } else {
    users = [...inMemoryStore.app_users];
  }

  // Merge any verified Telegram auth sessions from global store
  if (global.__tm_auth_sessions && typeof global.__tm_auth_sessions.values === 'function') {
    for (const s of global.__tm_auth_sessions.values()) {
      if (s.status === 'verified' && s.user && s.user.username) {
        const uHandle = s.user.username.startsWith('@') ? s.user.username : `@${s.user.username}`;
        const existing = users.find(u => u.identifier && u.identifier.toLowerCase() === uHandle.toLowerCase());
        if (!existing) {
          users.unshift({
            id: `tg-${s.user.telegram_id || Date.now()}`,
            identifier: uHandle,
            display_name: s.user.display_name || s.user.username,
            notes: `Verified Telegram Account (ID: ${s.user.telegram_id}) | Channel Member: ${s.user.is_channel_member ? 'Yes' : 'No'}`,
            is_blocked: false,
            telegram_id: s.user.telegram_id,
            is_channel_member: s.user.is_channel_member,
            member_status: s.user.member_status,
            is_verified: true,
            created_at: s.user.verified_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        } else {
          existing.telegram_id = s.user.telegram_id;
          existing.is_channel_member = s.user.is_channel_member;
          existing.member_status = s.user.member_status;
          existing.is_verified = true;
        }
      }
    }
  }

  return users;
}

/**
 * Upsert or register an App User
 */
async function upsertAppUser({ identifier, display_name, notes, is_blocked = false, telegram_id = null, is_channel_member = false, member_status = 'member' }) {
  if (!identifier) return null;
  const normIdentifier = identifier.startsWith('@') ? identifier : `@${identifier}`;

  const notesText = notes || `Verified Telegram Account (ID: ${telegram_id || 'N/A'}) | Member: ${is_channel_member ? 'Yes' : 'No'}`;

  if (isLiveSupabase) {
    try {
      const { data: existing } = await supabaseClient
        .from('app_users')
        .select('*')
        .eq('identifier', normIdentifier)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabaseClient
          .from('app_users')
          .update({
            display_name: display_name || existing.display_name,
            notes: notesText,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (!error && data) return data;
      } else {
        const { data, error } = await supabaseClient
          .from('app_users')
          .insert({
            identifier: normIdentifier,
            display_name: display_name || normIdentifier,
            notes: notesText,
            is_blocked: Boolean(is_blocked)
          })
          .select()
          .single();
        if (!error && data) return data;
      }
    } catch (e) {
      console.warn('[DB] Supabase upsertAppUser fallback:', e.message);
    }
  }

  // Memory fallback
  const existingIdx = inMemoryStore.app_users.findIndex(u => u.identifier.toLowerCase() === normIdentifier.toLowerCase());
  if (existingIdx >= 0) {
    inMemoryStore.app_users[existingIdx] = {
      ...inMemoryStore.app_users[existingIdx],
      display_name: display_name || inMemoryStore.app_users[existingIdx].display_name,
      notes: notesText,
      telegram_id: telegram_id || inMemoryStore.app_users[existingIdx].telegram_id,
      is_channel_member: is_channel_member !== undefined ? is_channel_member : inMemoryStore.app_users[existingIdx].is_channel_member,
      member_status: member_status || inMemoryStore.app_users[existingIdx].member_status,
      updated_at: new Date().toISOString()
    };
    return inMemoryStore.app_users[existingIdx];
  } else {
    const newUser = {
      id: crypto.randomUUID(),
      identifier: normIdentifier,
      display_name: display_name || normIdentifier,
      notes: notesText,
      is_blocked: false,
      telegram_id: telegram_id || null,
      is_channel_member: Boolean(is_channel_member),
      member_status: member_status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    inMemoryStore.app_users.unshift(newUser);
    return newUser;
  }
}

/**
 * Update an App User
 */
async function updateAppUser(id, updates = {}) {
  if (isLiveSupabase) {
    try {
      const { data, error } = await supabaseClient
        .from('app_users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return data;
    } catch (e) {
      console.warn('[DB] Supabase updateAppUser fallback:', e.message);
    }
  }

  let user = inMemoryStore.app_users.find(u => u.id === id);
  if (!user) {
    const tgPrefix = String(id).replace('tg-', '');
    user = inMemoryStore.app_users.find(u => String(u.telegram_id) === tgPrefix || (u.identifier && u.identifier.includes(tgPrefix)));
    if (!user) {
      user = {
        id,
        identifier: `@user_${tgPrefix}`,
        display_name: 'Tracked User',
        notes: '',
        is_blocked: false,
        created_at: new Date().toISOString()
      };
      inMemoryStore.app_users.unshift(user);
    }
  }
  Object.assign(user, updates, { updated_at: new Date().toISOString() });
  return user;
}

/**
 * Delete a single App User by ID
 */
async function deleteAppUser(id) {
  if (!id) return { success: false, error: 'User ID is required' };

  if (isLiveSupabase) {
    try {
      await supabaseClient
        .from('app_users')
        .delete()
        .eq('id', id);
    } catch (e) {
      console.warn('[DB] Supabase deleteAppUser error:', e.message);
    }
  }

  // Remove from in-memory store
  inMemoryStore.app_users = inMemoryStore.app_users.filter(u => u.id !== id && `tg-${u.telegram_id}` !== id);

  // Remove from global auth sessions if present
  if (global.__tm_auth_sessions && typeof global.__tm_auth_sessions.entries === 'function') {
    for (const [key, s] of global.__tm_auth_sessions.entries()) {
      if (s.user && (`tg-${s.user.telegram_id}` === id || s.user.username === id || `@${s.user.username}` === id)) {
        global.__tm_auth_sessions.delete(key);
      }
    }
  }

  return { success: true, deleted: true, id };
}

/**
 * Delete multiple App Users by ID array
 */
async function deleteMultipleAppUsers(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: 'No user IDs provided', count: 0 };
  }

  const idSet = new Set(ids);

  if (isLiveSupabase) {
    try {
      await supabaseClient
        .from('app_users')
        .delete()
        .in('id', ids);
    } catch (e) {
      console.warn('[DB] Supabase deleteMultipleAppUsers error:', e.message);
    }
  }

  // Remove from in-memory store
  const beforeLen = inMemoryStore.app_users.length;
  inMemoryStore.app_users = inMemoryStore.app_users.filter(u => !idSet.has(u.id) && !idSet.has(`tg-${u.telegram_id}`));
  const deletedCount = beforeLen - inMemoryStore.app_users.length;

  // Remove from global auth sessions if present
  if (global.__tm_auth_sessions && typeof global.__tm_auth_sessions.entries === 'function') {
    for (const [key, s] of global.__tm_auth_sessions.entries()) {
      if (s.user && (idSet.has(`tg-${s.user.telegram_id}`) || idSet.has(s.user.username) || idSet.has(`@${s.user.username}`))) {
        global.__tm_auth_sessions.delete(key);
      }
    }
  }

  return { success: true, count: Math.max(deletedCount, ids.length), ids };
}

/**
 * Admin: Get Overview Metrics
 */
async function getOverviewMetrics() {
  const allFiles = await getAllFilesAdmin();
  const allTokens = await getTokensAdmin();
  const logs = await getLogsAdmin(500);

  const totalFiles = allFiles.length;
  const now = new Date();

  let activeTokens = 0;
  let expiredTokens = 0;
  let revokedTokens = 0;
  let exhaustedTokens = 0;

  allTokens.forEach(t => {
    if (t.is_revoked) {
      revokedTokens++;
    } else if (t.expires_at && new Date(t.expires_at) < now) {
      expiredTokens++;
    } else if (t.max_downloads !== null && t.download_count >= t.max_downloads) {
      exhaustedTokens++;
    } else {
      activeTokens++;
    }
  });

  const totalDownloads = allFiles.reduce((acc, f) => acc + (f.download_count || 0), 0);
  const successfulDownloads = logs.filter(l => l.status === 'authorized' || l.status === 'download_completed').length;
  const rejectedAttempts = logs.filter(l => l.status.startsWith('rejected')).length;

  const topFiles = [...allFiles]
    .sort((a, b) => (b.download_count || 0) - (a.download_count || 0))
    .slice(0, 5)
    .map(f => ({
      id: f.id,
      file_code: f.file_code,
      title: f.title,
      download_count: f.download_count,
      category: f.category
    }));

  let healthInfo = null;
  if (isLiveSupabase && supabaseClient) {
    try {
      healthInfo = await testSupabaseConnection();
    } catch (_) {}
  }

  return {
    database_mode: isLiveSupabase ? 'live_supabase' : 'local_in_memory',
    supabase_connected: isLiveSupabase,
    supabase_url: isLiveSupabase ? process.env.SUPABASE_URL : null,
    supabase_health: healthInfo,
    total_files: totalFiles,
    active_tokens: activeTokens,
    expired_tokens: expiredTokens,
    revoked_tokens: revokedTokens,
    exhausted_tokens: exhaustedTokens,
    total_tokens: allTokens.length,
    total_downloads: totalDownloads,
    successful_downloads: successfulDownloads,
    rejected_attempts: rejectedAttempts,
    top_files: topFiles,
    recent_logs: logs.slice(0, 10)
  };
}

/**
 * Ping and verify Supabase connection
 */
async function testSupabaseConnection() {
  if (!isLiveSupabase || !supabaseClient) {
    return {
      connected: false,
      mode: 'local_in_memory',
      message: 'Supabase credentials not configured in .env'
    };
  }

  const start = Date.now();
  try {
    const { count: fileCount, error: fileErr } = await supabaseClient
      .from('files')
      .select('count', { count: 'exact', head: true });

    if (fileErr) throw fileErr;

    const { count: tokenCount, error: tokenErr } = await supabaseClient
      .from('access_tokens')
      .select('count', { count: 'exact', head: true });

    const latency = Date.now() - start;

    return {
      connected: true,
      mode: 'live_supabase',
      latency_ms: latency,
      url: process.env.SUPABASE_URL,
      tables: {
        files: fileCount ?? 0,
        access_tokens: tokenCount ?? 0
      }
    };
  } catch (err) {
    return {
      connected: false,
      mode: 'error',
      error: err.message,
      url: process.env.SUPABASE_URL,
      latency_ms: Date.now() - start
    };
  }
}

module.exports = {
  isLiveSupabase,
  testSupabaseConnection,
  getPublicFiles,
  getFileById,
  getAllFilesAdmin,
  createFile,
  updateFile,
  deleteFile,
  deleteMultipleFiles,
  verifyAndClaimDownload,
  createAccessTokens,
  getTokensAdmin,
  revokeToken,
  revokeTokens,
  deleteTokens,
  getLogsAdmin,
  getUsersAdmin,
  upsertAppUser,
  updateAppUser,
  deleteAppUser,
  deleteMultipleAppUsers,
  getOverviewMetrics,
  inMemoryStore
};
