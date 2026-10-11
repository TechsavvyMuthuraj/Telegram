// =============================================================================
// techiemuthuraj Files - Frontend API Configuration & Client Helpers
// =============================================================================

const APP_CONFIG = {
  // Use /api/ which is rewritten to /.netlify/functions/ in netlify.toml & server.js
  API_BASE: '/api',
  TELEGRAM_CHANNEL_URL: 'https://t.me/techiemuthuraj',
  TOKEN_PREFIX: 'TM',
  
  endpoints: {
    files: '/api/files',
    verifyToken: '/api/verify-token',
    download: '/api/download',
    tokens: '/api/tokens',
    users: '/api/users',
    logs: '/api/logs',
    overview: '/api/overview',
    telegramSync: '/api/telegram-sync',
    channelInfo: '/api/channel-info',
    auth: '/api/auth',
    userAuth: '/api/user-auth',
    telegramDirectDownload: '/api/telegram-direct-download',
    adminReset: '/api/admin-reset'
  }
};

/**
 * Get stored Telegram user session
 */
function getUserSession() {
  try {
    const raw = localStorage.getItem('techi_user_session');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Save Telegram user session
 */
function setUserSession(data) {
  if (data) {
    localStorage.setItem('techi_user_session', JSON.stringify(data));
  } else {
    localStorage.removeItem('techi_user_session');
  }
}

/**
 * Clear Telegram user session (Logout)
 */
function clearUserSession() {
  localStorage.removeItem('techi_user_session');
}

/**
 * Get stored admin authentication key
 */
function getAdminKey() {
  return localStorage.getItem('tm_admin_key') || null;
}

/**
 * Set stored admin authentication key
 */
function setAdminKey(key) {
  if (key) {
    localStorage.setItem('tm_admin_key', key);
  } else {
    localStorage.removeItem('tm_admin_key');
  }
}

/**
 * Make an API request with optional Admin Authentication
 */
async function apiRequest(endpoint, options = {}) {
  const adminKey = getAdminKey();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (adminKey) {
    headers['X-Admin-Key'] = adminKey;
    headers['Authorization'] = `Bearer ${adminKey}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
