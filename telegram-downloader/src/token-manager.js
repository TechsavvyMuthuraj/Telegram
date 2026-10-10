// =============================================================================
// Telegram Direct File Downloader - Cryptographic Download Token Manager
// Signs and verifies download tokens without leaking bot credentials
// =============================================================================

const crypto = require('crypto');
const { config } = require('./config');

const TOKEN_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Generate a cryptographically signed HMAC download token
 */
function generateDownloadToken(fileDetails) {
  const now = Date.now();
  const payload = {
    source: fileDetails.source,
    name: fileDetails.name || 'download',
    size: fileDetails.size || 0,
    mime: fileDetails.mime || 'application/octet-stream',
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + TOKEN_EXPIRY_MS) / 1000)
  };

  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', config.secretKey).update(data).digest('base64url');
  return `${data}.${signature}`;
}

/**
 * Verify signed download token and return payload
 */
function verifyDownloadToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Download token is missing' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed download token structure' };
  }

  const [data, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', config.secretKey).update(data).digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSig);
  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return { valid: false, error: 'Invalid or forged download token' };
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Download token has expired. Please generate a fresh link.' };
    }

    return {
      valid: true,
      payload
    };
  } catch (err) {
    return { valid: false, error: 'Failed to decode download token payload' };
  }
}

module.exports = {
  generateDownloadToken,
  verifyDownloadToken
};
