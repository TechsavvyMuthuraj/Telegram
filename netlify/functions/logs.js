// =============================================================================
// Netlify Function: logs.js
// Admin Activity and Download Audit Logs Viewer
// =============================================================================

const { getLogsAdmin } = require('./utils/db');
const { verifyAdminAuth, getSecurityHeaders } = require('./utils/auth-middleware');

exports.handler = async (event, context) => {
  const headers = getSecurityHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const auth = verifyAdminAuth(event.headers);
  if (!auth.authorized) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: auth.error })
    };
  }

  const query = event.queryStringParameters || {};
  const limit = Math.min(parseInt(query.limit, 10) || 100, 500);

  try {
    const logs = await getLogsAdmin(limit);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, count: logs.length, logs })
    };
  } catch (error) {
    console.error('Error fetching logs:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', message: error.message })
    };
  }
};
