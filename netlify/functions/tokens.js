// =============================================================================
// Netlify Function: tokens.js
// Admin Token Generation, Bulk Creation, Revocation, and Management API
// =============================================================================

const { 
  getTokensAdmin, 
  createAccessTokens, 
  revokeToken, 
  revokeTokens,
  deleteTokens,
  getFileById 
} = require('./utils/db');
const { 
  generateSecureToken, 
  hashToken, 
  generateTokenPreview 
} = require('./utils/crypto');
const { verifyAdminAuth, getSecurityHeaders } = require('./utils/auth-middleware');

exports.handler = async (event, context) => {
  const headers = getSecurityHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // All token endpoints require Admin Authorization
  const auth = verifyAdminAuth(event.headers);
  if (!auth.authorized) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: auth.error })
    };
  }

  const method = event.httpMethod;
  const query = event.queryStringParameters || {};

  try {
    // -------------------------------------------------------------------------
    // GET: List Tokens
    // -------------------------------------------------------------------------
    if (method === 'GET') {
      const tokens = await getTokensAdmin({
        file_id: query.file_id,
        status: query.status,
        search: query.search
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, tokens })
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};

    // -------------------------------------------------------------------------
    // POST: Generate Token(s) - Single or Bulk
    // -------------------------------------------------------------------------
    if (method === 'POST') {
      const { 
        file_id, 
        count = 1, 
        max_downloads = 1, // 1 = single-use, null = unlimited, N = limited
        expires_in_days, 
        expires_at, 
        user_identifier,
        prefix = 'TM'
      } = body;

      if (!file_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'file_id is required' })
        };
      }

      const file = await getFileById(file_id);
      if (!file) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'File not found' })
        };
      }

      const generateCount = Math.min(Math.max(parseInt(count, 10) || 1, 1), 100);
      
      // Calculate expiration timestamp
      let calculatedExpiry = null;
      if (expires_at) {
        calculatedExpiry = new Date(expires_at).toISOString();
      } else if (expires_in_days && Number(expires_in_days) > 0) {
        calculatedExpiry = new Date(Date.now() + Number(expires_in_days) * 86400000).toISOString();
      }

      const generatedPlaintextTokens = [];
      const dbTokensToInsert = [];

      for (let i = 0; i < generateCount; i++) {
        const plaintextToken = generateSecureToken(prefix);
        const tokenHash = hashToken(plaintextToken);
        const tokenPreview = generateTokenPreview(plaintextToken);

        generatedPlaintextTokens.push(plaintextToken);
        dbTokensToInsert.push({
          file_id,
          user_identifier: user_identifier || (generateCount > 1 ? `Bulk Batch #${i + 1}` : null),
          token_hash: tokenHash,
          token_preview: tokenPreview,
          max_downloads: max_downloads === 'unlimited' || max_downloads === null ? null : parseInt(max_downloads, 10),
          download_count: 0,
          expires_at: calculatedExpiry,
          is_revoked: false,
          created_at: new Date().toISOString()
        });
      }

      await createAccessTokens(dbTokensToInsert);

      // Return plaintext tokens ONCE for admin copy/export
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          count: generateCount,
          file: {
            id: file.id,
            file_code: file.file_code,
            title: file.title
          },
          tokens: generatedPlaintextTokens.map((rawToken, idx) => ({
            token: rawToken,
            preview: dbTokensToInsert[idx].token_preview,
            max_downloads: dbTokensToInsert[idx].max_downloads,
            expires_at: dbTokensToInsert[idx].expires_at,
            user_identifier: dbTokensToInsert[idx].user_identifier
          }))
        })
      };
    }

    // -------------------------------------------------------------------------
    // PUT: Revoke Token(s) (Single or Bulk)
    // -------------------------------------------------------------------------
    if (method === 'PUT') {
      const { id, ids, reason } = body;
      const targetIds = ids || (id ? [id] : []);
      if (targetIds.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Token ID or array of IDs is required' })
        };
      }

      await revokeTokens(targetIds, reason || 'Revoked via Admin Console');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: targetIds.length === 1 ? 'Token revoked successfully' : `${targetIds.length} tokens revoked successfully`,
          revoked_ids: targetIds
        })
      };
    }

    // -------------------------------------------------------------------------
    // DELETE: Delete Token(s) Permanently (Single or Bulk)
    // -------------------------------------------------------------------------
    if (method === 'DELETE') {
      const ids = body.ids || (body.id ? [body.id] : null) || (query.ids ? query.ids.split(',') : null) || (query.id ? [query.id] : null);
      if (!ids || ids.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Token ID or array of IDs is required' })
        };
      }

      await deleteTokens(ids);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: ids.length === 1 ? 'Token deleted successfully' : `${ids.length} tokens deleted successfully`,
          deleted_ids: ids
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };

  } catch (error) {
    console.error('Error in tokens handler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', message: error.message })
    };
  }
};
