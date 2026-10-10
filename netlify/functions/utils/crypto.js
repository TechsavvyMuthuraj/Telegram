// =============================================================================
// techiemuthuraj Files - Cryptographic Security Utilities
// Secure token generation, SHA-256 hashing, HMAC signed download tickets
// =============================================================================

const crypto = require('crypto');

/**
 * Generate a cryptographically secure random token
 * Format: TM-XXXX-XXXX-XXXX (16 random hex characters grouped)
 */
function generateSecureToken(prefix = 'TM') {
  const bytes = crypto.randomBytes(8).toString('hex').toUpperCase();
  const chunk1 = bytes.slice(0, 4);
  const chunk2 = bytes.slice(4, 8);
  const chunk3 = bytes.slice(8, 12);
  const chunk4 = bytes.slice(12, 16);
  return `${prefix}-${chunk1}-${chunk2}-${chunk3}`;
}

/**
 * Compute SHA-256 hash of an access token
 * Tokens are normalized by trimming whitespace and converting to uppercase
 */
function hashToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return '';
  const normalized = rawToken.trim().toUpperCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Create a masked token preview for safe admin UI display
 * e.g. "TM-8F2B-9C1D-4A7E" -> "TM-8F**-****-4A7E"
 */
function generateTokenPreview(token) {
  if (!token) return 'TM-****-****';
  const parts = token.split('-');
  if (parts.length >= 4) {
    const p1 = parts[0];
    const p2 = parts[1].slice(0, 2) + '**';
    const p3 = '****';
    const p4 = parts[parts.length - 1];
    return `${p1}-${p2}-${p3}-${p4}`;
  }
  return token.slice(0, 4) + '****' + token.slice(-4);
}

/**
 * Generate a short-lived HMAC-SHA256 signed download authorization ticket
 * Default validity: 300 seconds (5 minutes)
 */
function signDownloadTicket(payload, secretKey, expiresInSeconds = 300) {
  const secret = secretKey || process.env.DOWNLOAD_TICKET_SECRET || 'default-techiemuthuraj-download-ticket-secret-change-in-prod-2026';
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const nonce = crypto.randomBytes(8).toString('hex');
  
  const tokenData = {
    ...payload,
    exp,
    nonce
  };
  
  const dataString = Buffer.from(JSON.stringify(tokenData)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(dataString).digest('base64url');
  
  return `${dataString}.${signature}`;
}

/**
 * Verify and decode an HMAC-SHA256 signed download ticket
 * Returns payload if valid & unexpired, or null if tampered/expired
 */
function verifyDownloadTicket(ticket, secretKey) {
  if (!ticket || typeof ticket !== 'string') return null;
  const parts = ticket.split('.');
  if (parts.length !== 2) return null;
  
  const [dataString, signature] = parts;
  const secret = secretKey || process.env.DOWNLOAD_TICKET_SECRET || 'default-techiemuthuraj-download-ticket-secret-change-in-prod-2026';
  
  const expectedSignature = crypto.createHmac('sha256', secret).update(dataString).digest('base64url');
  
  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return null;
  }
  
  try {
    const payload = JSON.parse(Buffer.from(dataString, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { expired: true, payload };
    }
    return { valid: true, payload };
  } catch (err) {
    return null;
  }
}

/**
 * Anonymize client IP address using SHA-256 with optional salt
 */
function hashIp(ip) {
  if (!ip) return 'unknown';
  const salt = process.env.IP_SALT || 'salt-tm-files-audit';
  return crypto.createHash('sha256').update(ip + salt).digest('hex').slice(0, 16);
}

module.exports = {
  generateSecureToken,
  hashToken,
  generateTokenPreview,
  signDownloadTicket,
  verifyDownloadTicket,
  hashIp
};
