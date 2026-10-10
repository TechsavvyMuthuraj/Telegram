// =============================================================================
// Netlify Function: verify-token.js
// Server-Side Access Token Verification & Secure Ticket Issuance
// =============================================================================

const { verifyAndClaimDownload } = require('./utils/db');
const { hashToken, signDownloadTicket, hashIp } = require('./utils/crypto');
const { checkRateLimit } = require('./utils/rate-limit');
const { getSecurityHeaders } = require('./utils/auth-middleware');

exports.handler = async (event, context) => {
  const headers = getSecurityHeaders();

  // Handle CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' })
    };
  }

  // 1. IP Rate Limiting to prevent brute-force attacks
  const clientIp = event.headers['client-ip'] || 
                   event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                   '127.0.0.1';
  const ipHash = hashIp(clientIp);
  const userAgent = event.headers['user-agent'] || 'Unknown';

  const rateCheck = checkRateLimit(ipHash, 15, 60); // 15 verification attempts per minute
  if (!rateCheck.allowed) {
    return {
      statusCode: 429,
      headers: {
        ...headers,
        'Retry-After': String(rateCheck.resetSeconds)
      },
      body: JSON.stringify({
        success: false,
        error_code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many verification attempts. Please wait ${rateCheck.resetSeconds} seconds before trying again.`
      })
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { file_id, token } = body;

    // 2. Input Validation
    if (!file_id || !token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error_code: 'MISSING_PARAMETERS',
          message: 'Both file_id and access token are required.'
        })
      };
    }

    const cleanToken = String(token).trim().toUpperCase();
    if (cleanToken.length < 5 || cleanToken.length > 64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error_code: 'INVALID_TOKEN_FORMAT',
          message: 'Invalid token format. Tokens follow the format TM-XXXX-XXXX-XXXX.'
        })
      };
    }

    // 3. Compute Cryptographic SHA-256 Hash of Token
    const tokenHash = hashToken(cleanToken);

    // 4. Atomic Database Verification & Limit Claim
    const claimResult = await verifyAndClaimDownload({
      fileId: file_id,
      tokenHash,
      ipHash,
      userAgent
    });

    if (!claimResult.success) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify(claimResult)
      };
    }

    // 5. Generate Short-Lived HMAC Signed Download Ticket (Valid for 5 minutes)
    const ticketPayload = {
      file_id: claimResult.file_id,
      token_id: claimResult.token_id,
      file_code: claimResult.file_code,
      authorized_at: Date.now()
    };

    const downloadTicket = signDownloadTicket(ticketPayload, null, 300);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Token verified successfully. Download authorization granted.',
        file: {
          id: claimResult.file_id,
          file_code: claimResult.file_code,
          title: claimResult.title,
          downloads_used: claimResult.downloads_used,
          max_downloads: claimResult.max_downloads,
          downloads_remaining: claimResult.downloads_remaining
        },
        download_ticket: downloadTicket,
        expires_in_seconds: 300
      })
    };

  } catch (error) {
    console.error('Error during token verification:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error_code: 'INTERNAL_ERROR',
        message: 'An internal error occurred while verifying the token.'
      })
    };
  }
};
