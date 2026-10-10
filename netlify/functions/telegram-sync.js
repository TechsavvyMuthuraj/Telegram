// =============================================================================
// Netlify Function: telegram-sync.js
// Telegram Bot Connectivity Test, Webhook Management, & Channel Post Mapping API
// =============================================================================

const { 
  getBotProfile, 
  parseTelegramMessageLink, 
  getTelegramFileMeta,
  getBotToken,
  getChannelId,
  getWebhookSecret,
  setTelegramWebhook,
  getTelegramWebhookInfo,
  deleteTelegramWebhook,
  TELEGRAM_DOCUMENTATION 
} = require('./utils/telegram');
const { createFile } = require('./utils/db');
const { verifyAdminAuth, getSecurityHeaders } = require('./utils/auth-middleware');

exports.handler = async (event, context) => {
  const headers = getSecurityHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Admin authentication required
  const auth = verifyAdminAuth(event.headers);
  if (!auth.authorized) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: auth.error })
    };
  }

  const method = event.httpMethod;
  const path = event.path || '';

  try {
    // -------------------------------------------------------------------------
    // GET: Check Bot Status, Webhook Info & Environment Configuration
    // -------------------------------------------------------------------------
    if (method === 'GET') {
      const hasToken = Boolean(getBotToken());
      const channelId = getChannelId();

      let botStatus = { connected: false, error: 'TELEGRAM_BOT_TOKEN not configured in environment variables.' };
      let webhookInfo = null;

      if (hasToken) {
        botStatus = await getBotProfile();
        try {
          webhookInfo = await getTelegramWebhookInfo();
        } catch (e) {
          webhookInfo = { ok: false, error: e.message };
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          bot_configured: hasToken,
          channel_configured: Boolean(channelId),
          channel_id: channelId ? (channelId.startsWith('@') ? channelId : `${channelId.slice(0, 4)}****`) : null,
          bot_status: botStatus,
          webhook_info: webhookInfo,
          webhook_secret: getWebhookSecret(),
          documentation: TELEGRAM_DOCUMENTATION
        })
      };
    }

    // -------------------------------------------------------------------------
    // POST: Manage Webhooks or Map Post
    // -------------------------------------------------------------------------
    if (method === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};

      // A. Action: Set Telegram Webhook
      if (body.action === 'set_webhook') {
        const { webhook_url, secret_token } = body;
        if (!webhook_url) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'webhook_url is required' })
          };
        }

        const res = await setTelegramWebhook(webhook_url, secret_token);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: res.ok,
            result: res,
            message: res.ok ? 'Webhook successfully registered with Telegram' : res.description
          })
        };
      }

      // B. Action: Delete Telegram Webhook
      if (body.action === 'delete_webhook') {
        const res = await deleteTelegramWebhook();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: res.ok,
            result: res,
            message: res.ok ? 'Webhook successfully removed from Telegram' : res.description
          })
        };
      }

      // C. Action: Map Channel Post
      const { post_url, telegram_file_id, title, category, description, file_type, file_size } = body;

      if (!post_url && !telegram_file_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Either post_url (e.g. https://t.me/channel/123) or telegram_file_id is required.'
          })
        };
      }

      let parsedPost = null;
      let sourceType = 'telegram_link';
      let sourceRef = post_url;

      if (post_url) {
        parsedPost = parseTelegramMessageLink(post_url);
        if (!parsedPost) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid Telegram post URL format.' })
          };
        }
        sourceRef = parsedPost.rawUrl;
      }

      if (telegram_file_id) {
        sourceType = 'telegram_bot';
        sourceRef = telegram_file_id;
      }

      const newFile = await createFile({
        title: title || (parsedPost ? `Telegram Post #${parsedPost.messageId}` : 'Telegram Resource'),
        description: description || `Resource published via Telegram channel post: ${sourceRef}`,
        category: category || 'General',
        file_type: file_type || 'ZIP',
        file_size: file_size || 'Unknown',
        source_type: sourceType,
        source_reference: sourceRef,
        external_download_url: body.external_download_url || (sourceType === 'telegram_link' ? sourceRef : null)
      });

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Telegram resource mapped to file catalog successfully.',
          file: newFile,
          parsed_post: parsedPost
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };

  } catch (err) {
    console.error('Error in telegram-sync handler:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', message: err.message })
    };
  }
};
