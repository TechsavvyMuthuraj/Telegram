// =============================================================================
// Netlify Function: users.js
// Admin User Management, Detailed Tracking, Moderation & Token Associations
// =============================================================================

const { 
  getUsersAdmin, 
  getTokensAdmin, 
  getLogsAdmin,
  getAllFilesAdmin,
  upsertAppUser,
  updateAppUser,
  deleteAppUser,
  deleteMultipleAppUsers
} = require('./utils/db');
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
    // -------------------------------------------------------------------------
    // 1. GET: Fetch all users with complete details, tokens & download activity
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'GET') {
      const users = await getUsersAdmin();
      const allTokens = await getTokensAdmin();
      const allLogs = await getLogsAdmin(1000);
      const allFiles = await getAllFilesAdmin();

      const filesMap = new Map();
      allFiles.forEach(f => {
        filesMap.set(f.id, f);
      });

      const userList = users.map(u => {
        const uId = u.id;
        const uIdentifier = (u.identifier || '').toLowerCase();

        // 1. Matched Tokens
        const userTokens = allTokens.filter(t => 
          (t.user_id && t.user_id === uId) || 
          (t.user_identifier && t.user_identifier.toLowerCase() === uIdentifier)
        ).map(t => {
          const fileInfo = filesMap.get(t.file_id) || {};
          return {
            id: t.id,
            token_preview: t.token_preview,
            file_id: t.file_id,
            file_code: fileInfo.file_code || t.file_code || 'TM-FILE',
            file_title: fileInfo.title || t.file_title || 'Digital Asset',
            download_count: t.download_count || 0,
            max_downloads: t.max_downloads,
            is_revoked: Boolean(t.is_revoked),
            revoked_reason: t.revoked_reason,
            expires_at: t.expires_at,
            created_at: t.created_at
          };
        });

        const totalTokens = userTokens.length;
        const now = new Date();
        const activeTokens = userTokens.filter(t => 
          !t.is_revoked && (!t.expires_at || new Date(t.expires_at) > now) && (t.max_downloads === null || t.download_count < t.max_downloads)
        ).length;
        const totalDownloadsUsed = userTokens.reduce((acc, t) => acc + (t.download_count || 0), 0);

        // 2. Matched Download Logs
        const userTokenIds = new Set(userTokens.map(t => t.id));
        const userLogs = allLogs.filter(l => 
          (l.user_identifier && l.user_identifier.toLowerCase() === uIdentifier) ||
          (l.token_id && userTokenIds.has(l.token_id))
        ).slice(0, 50);

        const lastDownloadAt = userLogs.length > 0 ? userLogs[0].timestamp || userLogs[0].created_at : null;

        // 3. Extract Metadata from notes / user fields
        let telegramId = u.telegram_id || null;
        let isChannelMember = Boolean(u.is_channel_member);
        let memberStatus = u.member_status || (isChannelMember ? 'member' : 'standard');
        let isVerified = Boolean(u.is_verified || u.identifier.startsWith('@'));

        if (!telegramId && u.notes) {
          const tgMatch = u.notes.match(/ID:\s*([0-9]+)/i);
          if (tgMatch) telegramId = tgMatch[1];
          if (/member:\s*yes/i.test(u.notes)) isChannelMember = true;
        }

        return {
          id: u.id,
          identifier: u.identifier,
          display_name: u.display_name || u.identifier,
          notes: u.notes || '',
          is_blocked: Boolean(u.is_blocked),
          telegram_id: telegramId,
          is_channel_member: isChannelMember,
          member_status: memberStatus,
          is_verified: isVerified,
          created_at: u.created_at,
          updated_at: u.updated_at,
          total_tokens: totalTokens,
          active_tokens: activeTokens,
          total_downloads_used: totalDownloadsUsed,
          last_download_at: lastDownloadAt,
          tokens: userTokens,
          downloads: userLogs
        };
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, users: userList })
      };
    }

    // -------------------------------------------------------------------------
    // 2. PUT: Update user (Block / Unblock / Update Notes)
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'PUT') {
      const body = event.body ? JSON.parse(event.body) : {};
      const userId = body.id || body.user_id;

      if (!userId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing user id' })
        };
      }

      const updates = {};
      if (body.action === 'toggle_block') {
        updates.is_blocked = Boolean(body.is_blocked);
      } else {
        if (body.is_blocked !== undefined) updates.is_blocked = Boolean(body.is_blocked);
        if (body.notes !== undefined) updates.notes = body.notes;
        if (body.display_name !== undefined) updates.display_name = body.display_name;
      }

      const updatedUser = await updateAppUser(userId, updates);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, user: updatedUser })
      };
    }

    // -------------------------------------------------------------------------
    // 3. POST: Create / Register user manually
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      const identifier = body.identifier || body.username;

      if (!identifier) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing identifier or username' })
        };
      }

      const newUser = await upsertAppUser({
        identifier,
        display_name: body.display_name,
        notes: body.notes,
        is_blocked: Boolean(body.is_blocked),
        telegram_id: body.telegram_id,
        is_channel_member: Boolean(body.is_channel_member),
        member_status: body.member_status || 'member'
      });

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ success: true, user: newUser })
      };
    }

    // -------------------------------------------------------------------------
    // 4. DELETE: Remove single or multiple users
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'DELETE') {
      let body = {};
      try {
        if (event.body) body = JSON.parse(event.body);
      } catch (e) {}

      const queryParams = event.queryStringParameters || {};
      const singleId = body.id || body.userId || queryParams.id;
      const multipleIds = body.ids || body.userIds;

      if (Array.isArray(multipleIds) && multipleIds.length > 0) {
        const result = await deleteMultipleAppUsers(multipleIds);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: `Successfully removed ${result.count || multipleIds.length} user(s)`,
            deleted_count: result.count || multipleIds.length,
            ids: multipleIds
          })
        };
      }

      if (singleId) {
        const result = await deleteAppUser(singleId);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'User successfully removed',
            deleted_id: singleId
          })
        };
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'User ID or array of IDs is required for deletion' })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };

  } catch (error) {
    console.error('Error in users handler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', message: error.message })
    };
  }
};
