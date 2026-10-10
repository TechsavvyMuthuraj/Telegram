// =============================================================================
// techiemuthuraj Files - Telegram Bot & Channel Integration Helper
// Secure server-side Telegram API interactions without exposing bot credentials
// =============================================================================

const https = require('https');

/**
 * Get Telegram Bot Token from environment variable
 */
function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

/**
 * Get Telegram Channel ID or Username from environment variable
 */
function getChannelId() {
  return process.env.TELEGRAM_CHANNEL_ID || null;
}

/**
 * Get Webhook Secret from environment variable
 */
function getWebhookSecret() {
  return process.env.TELEGRAM_WEBHOOK_SECRET || 'tm_webhook_sec_2026';
}

/**
 * Make an HTTPS request to Telegram Bot API (GET or POST)
 */
async function callTelegramApi(method, params = {}, httpMethod = 'GET') {
  const token = getBotToken();
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured in environment variables.');
  }

  return new Promise((resolve, reject) => {
    let url;
    let postData = '';

    if (httpMethod.toUpperCase() === 'POST') {
      url = new URL(`https://api.telegram.org/bot${token}/${method}`);
      postData = JSON.stringify(params);
    } else {
      url = new URL(`https://api.telegram.org/bot${token}/${method}`);
      if (params && Object.keys(params).length > 0) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null) {
            url.searchParams.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
          }
        });
      }
    }

    const options = {
      method: httpMethod.toUpperCase(),
      headers: httpMethod.toUpperCase() === 'POST' ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      } : {}
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error(`Failed to parse Telegram API response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);

    if (httpMethod.toUpperCase() === 'POST' && postData) {
      req.write(postData);
    }
    req.end();
  });
}

/**
 * Test bot credentials and fetch bot profile
 */
async function getBotProfile() {
  try {
    const res = await callTelegramApi('getMe');
    if (res.ok) {
      return {
        connected: true,
        bot: {
          id: res.result.id,
          username: res.result.username,
          first_name: res.result.first_name,
          can_join_groups: res.result.can_join_groups,
          can_read_all_group_messages: res.result.can_read_all_group_messages
        }
      };
    }
    return { connected: false, error: res.description || 'Unknown Telegram error' };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

/**
 * Set Webhook for Telegram Bot API
 */
async function setTelegramWebhook(webhookUrl, secretToken) {
  const secret = secretToken || getWebhookSecret();
  const payload = {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ['channel_post', 'message', 'edited_channel_post']
  };
  return callTelegramApi('setWebhook', payload, 'POST');
}

/**
 * Get current Webhook status and info
 */
async function getTelegramWebhookInfo() {
  return callTelegramApi('getWebhookInfo', {}, 'GET');
}

/**
 * Delete current Webhook
 */
async function deleteTelegramWebhook() {
  return callTelegramApi('deleteWebhook', { drop_pending_updates: false }, 'POST');
}

/**
 * Send message to a chat or channel
 */
async function sendTelegramMessage(chatId, text, options = {}) {
  if (!getBotToken()) {
    return { ok: false, simulated: true, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: options.parse_mode || 'HTML',
    reply_markup: options.reply_markup || undefined,
    disable_web_page_preview: options.disable_web_page_preview || false
  };
  return callTelegramApi('sendMessage', payload, 'POST');
}

/**
 * Fetch file metadata from Telegram Bot API
 */
async function getTelegramFileMeta(fileId) {
  try {
    const res = await callTelegramApi('getFile', { file_id: fileId });
    if (res.ok && res.result && res.result.file_path) {
      return {
        success: true,
        file_id: res.result.file_id,
        file_unique_id: res.result.file_unique_id,
        file_size: res.result.file_size,
        file_path: res.result.file_path
      };
    }
    return {
      success: false,
      error: res.description || 'Failed to retrieve file from Telegram Bot API'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Parse a Telegram message link
 */
function parseTelegramMessageLink(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/https?:\/\/t\.me\/(?:c\/(\d+)|([a-zA-Z0-9_]+))\/(\d+)/i);
  if (!match) return null;
  
  if (match[1]) {
    return {
      isPrivate: true,
      chatId: `-100${match[1]}`,
      messageId: parseInt(match[3], 10),
      rawUrl: url
    };
  } else {
    return {
      isPrivate: false,
      channelUsername: match[2],
      messageId: parseInt(match[3], 10),
      rawUrl: url
    };
  }
}

/**
 * Explanations and limitations of Telegram Bot API
 */
const TELEGRAM_DOCUMENTATION = {
  limits: [
    {
      name: "File Download Limit (Bot API)",
      limit: "20 MB",
      solution: "For files exceeding 20 MB, host them on external secure storage (Cloudflare R2, Supabase Storage, Google Drive, AWS S3) or provide Telegram Channel direct post links."
    },
    {
      name: "File Upload Limit (Bot API)",
      limit: "50 MB",
      solution: "Use the desktop/web Telegram client directly in your channel to upload larger files up to 2 GB (or 4 GB with Telegram Premium)."
    },
    {
      name: "Bot Channel Permissions",
      requirement: "Administrator with 'Post Messages' or at least member with access",
      solution: "Add your bot as an Administrator to your channel so it can read updates or forward files."
    }
  ]
};

module.exports = {
  getBotToken,
  getChannelId,
  getWebhookSecret,
  callTelegramApi,
  getBotProfile,
  setTelegramWebhook,
  getTelegramWebhookInfo,
  deleteTelegramWebhook,
  sendTelegramMessage,
  getTelegramFileMeta,
  parseTelegramMessageLink,
  TELEGRAM_DOCUMENTATION
};
