// =============================================================================
// Netlify Function: admin-reset.js
// Admin API to reset details, purge test files, and clean logs in Supabase
// =============================================================================

const { resetSystemData } = require('./utils/db');
const { verifyAdminAuth, getSecurityHeaders } = require('./utils/auth-middleware');

exports.handler = async (event, context) => {
  const headers = getSecurityHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Require POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' })
    };
  }

  // Verify Admin Authentication
  const auth = verifyAdminAuth(event.headers);
  if (!auth.authorized) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: auth.error || 'Unauthorized admin access.' })
    };
  }

  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    const result = await resetSystemData(payload);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'System data and logs successfully reset & synchronized in real-time.',
        details: result
      })
    };
  } catch (err) {
    console.error('[Admin Reset] Error resetting system data:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to reset system data',
        message: err.message
      })
    };
  }
};
