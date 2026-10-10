// =============================================================================
// Netlify Function: user-auth.js
// Production Telegram User Authentication & Automatic Ownership Verification
// Checks & verifies original vs fake accounts, channel membership, and polling
// =============================================================================

const { 
  createAuthChallenge, 
  getAuthSession, 
  getAuthSessionByCode,
  verifySessionWithTelegramUser,
  simulateVerification,
  verifyUserToken,
  normalizeUsername
} = require('./utils/auth-sessions');
const { getSecurityHeaders } = require('./utils/auth-middleware');

exports.handler = async (event, context) => {
  const headers = getSecurityHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const query = event.queryStringParameters || {};
  const clientIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || '127.0.0.1';

  try {
    // -------------------------------------------------------------------------
    // 1. GET: Session Polling & Verification Status Check
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'GET') {
      const sessionId = query.session_id || query.sessionId;

      // Check current user token (me)
      if (query.action === 'me') {
        const authHeader = event.headers['authorization'] || event.headers['x-user-token'] || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        const user = verifyUserToken(token);
        if (!user) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ success: false, authenticated: false, error: 'Invalid or expired session' })
          };
        }
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, authenticated: true, user })
        };
      }

      if (!sessionId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing session_id parameter' })
        };
      }

      const session = getAuthSession(sessionId);
      if (!session) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            success: false, 
            status: 'not_found', 
            error: 'Authentication session not found or expired.' 
          })
        };
      }

      const now = Date.now();
      const expiresInSec = Math.max(0, Math.floor((session.expiresAt - now) / 1000));

      if (session.status === 'verified') {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            status: 'verified',
            user: session.user,
            token: session.authToken,
            verified_at: session.user.verified_at
          })
        };
      }

      if (session.status === 'rejected_fake') {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            status: 'rejected_fake',
            error: 'IMPOSTER_MISMATCH',
            claimed_username: session.claimedUsername,
            actual_username: session.actualUsername,
            message: session.rejectionReason || 'Imposter account detected! Verification denied.'
          })
        };
      }

      if (session.status === 'expired' || expiresInSec === 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            status: 'expired',
            error: 'Session challenge expired. Please request a new verification code.'
          })
        };
      }

      // Pending state: user is still verifying in Telegram
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          status: 'pending',
          claimed_username: session.claimedUsername,
          code: session.code,
          expires_in: expiresInSec
        })
      };
    }

    // -------------------------------------------------------------------------
    // 2. POST: Actions (create_challenge, verify_pin, simulate_verify)
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      const action = body.action || 'create_challenge';

      // ACTION A: Create new auth challenge
      if (action === 'create_challenge' || action === 'initiate') {
        const username = body.username || body.claimed_username || '';
        const challenge = createAuthChallenge({
          claimedUsername: username,
          clientIp
        });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            session_id: challenge.sessionId,
            code: challenge.code,
            claimed_username: challenge.claimedUsername,
            deep_link: challenge.deepLink,
            bot_username: challenge.botUsername,
            expires_at: challenge.expiresAt,
            expires_in_seconds: challenge.expiresInSeconds
          })
        };
      }

      // ACTION B: Verify with 6-digit PIN code from Telegram
      if (action === 'verify_pin') {
        const pinCode = body.code || body.pin;
        const sessionId = body.session_id;

        if (!pinCode) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Missing PIN code' })
          };
        }

        const session = sessionId ? getAuthSession(sessionId) : getAuthSessionByCode(pinCode);
        if (!session) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, error: 'Invalid or expired PIN code.' })
          };
        }

        if (session.status === 'verified') {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              status: 'verified',
              user: session.user,
              token: session.authToken
            })
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            status: session.status,
            message: 'PIN is registered. Please tap START in the Telegram bot to finalize verification.'
          })
        };
      }

      // ACTION C: Simulation Verification (Dev / Testing / Demo)
      if (action === 'simulate_verify') {
        const sessionId = body.session_id;
        const isFake = Boolean(body.simulate_fake);
        const imposterUsername = body.fake_username || 'imposter_user';

        if (!sessionId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Missing session_id' })
          };
        }

        const result = await simulateVerification(sessionId, {
          simulateFake: isFake,
          fakeActualUsername: imposterUsername
        });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(result)
        };
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: `Unknown action: ${action}` })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };

  } catch (err) {
    console.error('[User Auth API Error]:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal Server Error', message: err.message })
    };
  }
};
