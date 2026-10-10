// =============================================================================
// Netlify Function: overview.js
// Admin Dashboard KPIs, Download Statistics, and Analytics
// =============================================================================

const { getOverviewMetrics, testSupabaseConnection } = require('./utils/db');
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

  try {
    const q = event.queryStringParameters || {};
    if (q.ping_supabase === 'true') {
      const pingResult = await testSupabaseConnection();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, ping: pingResult })
      };
    }

    const metrics = await getOverviewMetrics();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, metrics })
    };
  } catch (error) {
    console.error('Error fetching overview metrics:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', message: error.message })
    };
  }
};
