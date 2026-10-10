// =============================================================================
// techiemuthuraj Files - Admin Authentication & Authorization Middleware
// Protects admin endpoints from unauthorized access
// =============================================================================

/**
 * Validate admin request credentials
 * Checks against ADMIN_SECRET_KEY environment variable or configured admin credentials
 */
function verifyAdminAuth(headers) {
  const adminSecret = process.env.ADMIN_SECRET_KEY || 'default-admin-password-techiemuthuraj-2026';

  // Check custom header
  const customHeader = headers['x-admin-key'] || headers['X-Admin-Key'];
  if (customHeader && customHeader === adminSecret) {
    return { authorized: true, user: { role: 'admin', method: 'admin_key' } };
  }

  // Check Bearer authorization header
  const authHeader = headers['authorization'] || headers['Authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token === adminSecret) {
      return { authorized: true, user: { role: 'admin', method: 'bearer_token' } };
    }
  }

  return {
    authorized: false,
    error: 'Unauthorized: Valid Admin Secret Key required.'
  };
}

/**
 * Standard CORS and Security headers helper
 */
function getSecurityHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };
}

module.exports = {
  verifyAdminAuth,
  getSecurityHeaders
};
