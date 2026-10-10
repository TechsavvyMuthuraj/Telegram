// =============================================================================
// Techi Files - Telegram User Authentication & Session Verification Manager
// Cryptographic challenge generation, fake/imposter detection & session store
// =============================================================================

const crypto = require('crypto');
const { getBotToken, getChannelId, callTelegramApi } = require('./telegram');

// Persist on global object to remain hot-reload resilient during local development
global.__tm_auth_sessions = global.__tm_auth_sessions || new Map();
global.__tm_code_to_session = global.__tm_code_to_session || new Map();

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes validity
const SECRET_KEY = process.env.DOWNLOAD_TICKET_SECRET || 'techi-files-user-auth-secret-key-2026';

/**
 * Generate a random 6-digit numeric PIN code
 */
function generatePinCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Clean & normalize a Telegram username
 */
function normalizeUsername(username) {
  if (!username || typeof username !== 'string') return '';
  return username.trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Sign a user authentication JWT-like token
 */
function signUserToken(user) {
  const payload = {
    sub: user.telegram_id,
    username: user.username,
    first_name: user.first_name,
    is_channel_member: user.is_channel_member,
    is_original: true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 7 // 7 days session
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/**
 * Verify signed user token
 */
function verifyUserToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('base64url');
  if (sig !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Create a new authentication challenge session
 */
function createAuthChallenge({ claimedUsername = '', clientIp = '' }) {
  const cleanUsername = normalizeUsername(claimedUsername);
  const sessionId = 'TM-AUTH-' + crypto.randomBytes(6).toString('hex').toUpperCase();
  const code = generatePinCode();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;

  const challenge = {
    sessionId,
    code,
    claimedUsername: cleanUsername,
    clientIp,
    status: 'pending', // 'pending' | 'verified' | 'rejected_fake' | 'expired'
    createdAt: now,
    expiresAt,
    user: null,
    authToken: null,
    error: null
  };

  global.__tm_auth_sessions.set(sessionId, challenge);
  global.__tm_code_to_session.set(code, sessionId);

  // Clean expired sessions periodically
  cleanExpiredSessions();

  return {
    sessionId,
    code,
    claimedUsername: cleanUsername,
    expiresAt,
    expiresInSeconds: Math.floor(SESSION_TTL_MS / 1000),
    deepLink: `https://t.me/TechieGuyBot?start=auth_${code}`,
    botUsername: 'TechieGuyBot'
  };
}

/**
 * Look up session by Session ID
 */
function getAuthSession(sessionId) {
  if (!sessionId) return null;
  const session = global.__tm_auth_sessions.get(sessionId);
  if (!session) return null;

  if (Date.now() > session.expiresAt && session.status === 'pending') {
    session.status = 'expired';
    session.error = 'Challenge expired. Please generate a new code.';
  }
  return session;
}

/**
 * Look up session by 6-digit Code
 */
function getAuthSessionByCode(code) {
  if (!code) return null;
  const cleanCode = String(code).replace(/[^0-9]/g, '');
  const sessionId = global.__tm_code_to_session.get(cleanCode);
  if (!sessionId) return null;
  return getAuthSession(sessionId);
}

/**
 * Check Channel Membership via Telegram Bot API
 */
async function checkChannelMembership(userId, channelId = null) {
  const targetChannel = channelId || getChannelId() || '@techiemuthuraj';
  const token = getBotToken();

  if (!token || !userId) {
    return {
      isMember: true, // Graceful fallback
      status: 'member',
      channel: targetChannel
    };
  }

  try {
    const res = await callTelegramApi('getChatMember', {
      chat_id: targetChannel,
      user_id: userId
    });

    if (res && res.ok && res.result) {
      const status = res.result.status;
      const isMember = ['creator', 'administrator', 'member', 'restricted'].includes(status);
      return {
        isMember,
        status,
        channel: targetChannel,
        user: res.result.user
      };
    }
    return {
      isMember: false,
      status: res.description || 'not_participant',
      channel: targetChannel
    };
  } catch (err) {
    console.warn('[AuthSession] Channel check failed:', err.message);
    return {
      isMember: false,
      status: 'error',
      channel: targetChannel,
      error: err.message
    };
  }
}

/**
 * Verify session with Telegram user payload
 * Performs ORIGINAL vs FAKE check!
 */
async function verifySessionWithTelegramUser({ code, telegramUser, isChannelMemberOverride = null }) {
  const session = getAuthSessionByCode(code);
  if (!session) {
    return {
      success: false,
      error: 'CHALLENGE_NOT_FOUND',
      message: 'Verification code not found or expired. Please generate a new code on the website.'
    };
  }

  if (session.status === 'verified') {
    return {
      success: true,
      alreadyVerified: true,
      session,
      user: session.user,
      token: session.authToken
    };
  }

  if (session.status === 'expired') {
    return {
      success: false,
      error: 'EXPIRED',
      message: 'This verification challenge has expired. Please try again.'
    };
  }

  const actualUsername = normalizeUsername(telegramUser.username || '');
  const claimedUsername = normalizeUsername(session.claimedUsername || '');

  // ---------------------------------------------------------------------------
  // FAKE / IMPOSTER DETECTION CHECK
  // If user entered a username on website, it MUST match the Telegram account!
  // ---------------------------------------------------------------------------
  if (claimedUsername && actualUsername && claimedUsername !== actualUsername) {
    session.status = 'rejected_fake';
    session.error = 'IMPOSTER_MISMATCH';
    session.rejectionReason = `Fake user detected! You claimed to be @${claimedUsername}, but your Telegram account is @${actualUsername}.`;
    session.actualUsername = actualUsername;

    return {
      success: false,
      isFake: true,
      error: 'IMPOSTER_MISMATCH',
      claimedUsername,
      actualUsername,
      message: `Imposter attempt blocked! You claimed @${claimedUsername} on the portal, but authenticated via @${actualUsername}.`
    };
  }

  // ---------------------------------------------------------------------------
  // ORIGINAL USER VERIFIED
  // The user is proven authentic by Telegram's Bot API!
  // ---------------------------------------------------------------------------
  const effectiveUsername = actualUsername || claimedUsername || `user_${telegramUser.id}`;
  
  // Check Channel Membership in @techiemuthuraj
  let isChannelMember = false;
  let memberStatus = 'non_member';

  if (isChannelMemberOverride !== null) {
    isChannelMember = Boolean(isChannelMemberOverride);
    memberStatus = isChannelMember ? 'member' : 'left';
  } else {
    const memberCheck = await checkChannelMembership(telegramUser.id);
    isChannelMember = memberCheck.isMember;
    memberStatus = memberCheck.status;
  }

  const userRecord = {
    telegram_id: telegramUser.id,
    username: effectiveUsername,
    display_name: telegramUser.first_name ? `${telegramUser.first_name}${telegramUser.last_name ? ' ' + telegramUser.last_name : ''}` : effectiveUsername,
    is_original: true,
    is_fake: false,
    is_channel_member: isChannelMember,
    member_status: memberStatus,
    verified_at: new Date().toISOString()
  };

  const authToken = signUserToken(userRecord);

  // Update session state
  session.status = 'verified';
  session.user = userRecord;
  session.authToken = authToken;
  session.error = null;

  return {
    success: true,
    isOriginal: true,
    session,
    user: userRecord,
    token: authToken
  };
}

/**
 * Simulate verification (for local dev testing and verification demo)
 */
async function simulateVerification(sessionId, { simulateFake = false, fakeActualUsername = 'imposter_bot' } = {}) {
  const session = getAuthSession(sessionId);
  if (!session) {
    return { success: false, error: 'SESSION_NOT_FOUND' };
  }

  if (simulateFake) {
    const fakeUser = {
      id: 99887766,
      username: fakeActualUsername,
      first_name: 'Imposter Demo Account'
    };
    return verifySessionWithTelegramUser({
      code: session.code,
      telegramUser: fakeUser,
      isChannelMemberOverride: false
    });
  }

  // Genuine simulation
  const genuineUsername = session.claimedUsername || 'techiemuthuraj';
  const genuineUser = {
    id: 88776655,
    username: genuineUsername,
    first_name: 'Verified Techie Member'
  };

  return verifySessionWithTelegramUser({
    code: session.code,
    telegramUser: genuineUser,
    isChannelMemberOverride: true
  });
}

/**
 * Clean up expired sessions from memory
 */
function cleanExpiredSessions() {
  const now = Date.now();
  for (const [id, s] of global.__tm_auth_sessions.entries()) {
    if (now > s.expiresAt + 10 * 60 * 1000) {
      global.__tm_code_to_session.delete(s.code);
      global.__tm_auth_sessions.delete(id);
    }
  }
}

module.exports = {
  createAuthChallenge,
  getAuthSession,
  getAuthSessionByCode,
  verifySessionWithTelegramUser,
  checkChannelMembership,
  simulateVerification,
  signUserToken,
  verifyUserToken,
  normalizeUsername
};
