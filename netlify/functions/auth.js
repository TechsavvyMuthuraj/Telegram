// =============================================================================
// Netlify Function: auth.js
// Admin Authentication and Session Verification
// =============================================================================

const { verifyAdminAuth, getSecurityHeaders } = require('./utils/auth-middleware');

exports.handler = async (event, context) => {
  const headers = getSecurityHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const method = event.httpMethod;

  try {
    // -------------------------------------------------------------------------
    // POST: Login with Admin Secret Key / Password
    // -------------------------------------------------------------------------
    if (method === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      const { password, secret_key } = body;
      const candidate = secret_key || password;

      const adminSecret = process.env.ADMIN_SECRET_KEY || 'default-admin-password-techiemuthuraj-2026';

      if (!candidate || candidate !== adminSecret) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid administrator credentials. Access denied.'
          })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Admin authentication successful.',
          token: adminSecret,
          user: {
            username: 'techiemuthuraj_admin',
            role: 'superadmin'
          }
        })
      };
    }

    // -------------------------------------------------------------------------
    // GET: Check Auth Status
    // -------------------------------------------------------------------------
    if (method === 'GET') {
      const auth = verifyAdminAuth(event.headers);
      if (!auth.authorized) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ authenticated: false, error: auth.error })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          authenticated: true,
          user: { username: 'techiemuthuraj_admin', role: 'superadmin' }
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };

  } catch (err) {
    console.error('Error in auth function:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', message: err.message })
    };
  }
};
