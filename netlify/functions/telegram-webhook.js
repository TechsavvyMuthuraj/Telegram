// =============================================================================
// Netlify Function: telegram-webhook.js
// Production Telegram Webhook Handler for Channel Posts & Bot Commands
// =============================================================================

const { 
  getWebhookSecret, 
  sendTelegramMessage, 
  getChannelId 
} = require('./utils/telegram');
const { 
  createFile, 
  getPublicFiles, 
  verifyAndClaimDownload 
} = require('./utils/db');
const { hashToken } = require('./utils/crypto');
const { getSecurityHeaders } = require('./utils/auth-middleware');
const { 
  verifySessionWithTelegramUser, 
  createAuthChallenge 
} = require('./utils/auth-sessions');

const PORTAL_URL = process.env.PORTAL_URL || 'https://techiefile.netlify.app/';

/**
 * Format bytes into human readable string (e.g. 14.5 MB)
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return 'Unknown';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Determine file category and format from file name and mime type
 */
function determineFileCategory(fileName, mimeType) {
  const name = (fileName || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (name.endsWith('.apk') || mime.includes('vnd.android.package-archive')) {
    return { category: 'APK', type: 'APK' };
  }
  if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z') || name.endsWith('.tar.gz')) {
    return { category: 'Tools', type: 'ZIP' };
  }
  if (name.endsWith('.exe') || name.endsWith('.msi') || name.endsWith('.dmg')) {
    return { category: 'Software', type: 'EXE' };
  }
  if (name.endsWith('.py') || name.endsWith('.sh') || name.endsWith('.js') || name.endsWith('.ts')) {
    return { category: 'Scripts', type: 'PY' };
  }
  if (name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx')) {
    return { category: 'Documents', type: 'PDF' };
  }
  return { category: 'General', type: 'FILE' };
}

exports.handler = async (event, context) => {
  const headers = getSecurityHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Telegram Webhooks are delivered via POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, message: 'Telegram Webhook Endpoint' })
    };
  }

  // Verify Telegram secret token header if configured
  const secretHeader = event.headers['x-telegram-bot-api-secret-token'];
  const expectedSecret = getWebhookSecret();
  if (expectedSecret && secretHeader && secretHeader !== expectedSecret) {
    console.warn('Rejected Telegram webhook: Secret token mismatch.');
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Unauthorized secret token' })
    };
  }

  try {
    const update = event.body ? JSON.parse(event.body) : {};

    // -------------------------------------------------------------------------
    // 1. Channel Post Update (Auto-sync file from channel to catalog)
    // -------------------------------------------------------------------------
    const channelPost = update.channel_post || update.edited_channel_post;
    if (channelPost) {
      const chat = channelPost.chat;
      const messageId = channelPost.message_id;
      const doc = channelPost.document || channelPost.video || channelPost.audio;
      const caption = channelPost.caption || '';
      const text = channelPost.text || '';

      const channelUsername = chat.username ? `@${chat.username}` : (chat.title || 'Channel');
      const channelPostUrl = chat.username ? `https://t.me/${chat.username}/${messageId}` : `https://t.me/c/${String(chat.id).replace('-100', '')}/${messageId}`;

      // A document or downloadable file was posted to the channel!
      if (doc) {
        const fileName = doc.file_name || `${channelUsername}_file_${messageId}`;
        const fileSizeBytes = doc.file_size || 0;
        const fileSizeStr = formatFileSize(fileSizeBytes);
        const { category, type } = determineFileCategory(fileName, doc.mime_type);

        // Derive title from caption or filename
        const titleLine = caption.split('\n')[0].replace(/^[#\*\-_\s]+/, '').trim();
        const finalTitle = titleLine || fileName.replace(/\.[^/.]+$/, '');

        // Generate file code
        const codeNum = Math.floor(100 + Math.random() * 900);
        const fileCode = `TM-${type}-${codeNum}`;

        const newFile = await createFile({
          file_code: fileCode,
          title: finalTitle,
          description: caption || `Shared in ${channelUsername} post #${messageId}. File: ${fileName}`,
          category: category,
          file_type: type,
          file_size: fileSizeStr,
          file_size_bytes: fileSizeBytes,
          source_type: 'telegram_bot',
          source_reference: doc.file_id,
          external_download_url: channelPostUrl,
          version: '1.0.0'
        });

        console.log(`[Telegram Webhook] Auto-registered channel file: ${newFile.file_code} (${finalTitle})`);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, synced_channel_post: true })
      };
    }

    // -------------------------------------------------------------------------
    // 2. Direct Bot Message (Commands: /start, /files, /verify, /help)
    // -------------------------------------------------------------------------
    const message = update.message;
    if (message && message.chat && message.text) {
      const chatId = message.chat.id;
      const text = message.text.trim();
      const firstName = message.from?.first_name || 'Member';

      // -----------------------------------------------------------------------
      // Command: /start with auth code or /login /verify /code
      // Example: /start auth_839201 or /login 839201
      // -----------------------------------------------------------------------
      const rawDigitsMatch = text.match(/^(?:auth_|tm_)?([0-9]{6})$/i);
      const startAuthMatch = text.match(/^\/start\s+(?:auth_|tm_)?([0-9]{6})/i);
      const verifyCmdMatch = text.match(/^\/(?:verify|login|code|auth)\s*(?:auth_|tm_)?([0-9]{6})/i);
      const codeMatch = rawDigitsMatch || startAuthMatch || verifyCmdMatch;

      if (codeMatch && codeMatch[1]) {
        const code = codeMatch[1];
        const authResult = await verifySessionWithTelegramUser({
          code: code,
          telegramUser: message.from || { id: chatId, first_name: firstName }
        });

        if (authResult.isFake) {
          const fakeMsg = `
🚫 <b>Verification Rejected: Imposter Alert</b>

We detected that you claimed to be <b>@${authResult.claimedUsername}</b> on the website, but your authentic Telegram account is <b>@${authResult.actualUsername}</b>!

⚠️ <b>Security Policy:</b>
To prevent unauthorized access and protect community members, users may only authenticate with their original Telegram account.

👉 Please return to the website and enter <b>@${authResult.actualUsername}</b> to verify successfully.
          `.trim();

          await sendTelegramMessage(chatId, fakeMsg, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🌐 Return to Techi Files', url: PORTAL_URL }]
              ]
            }
          });
        } else if (authResult.success) {
          const user = authResult.user;
          const memberBadge = user.is_channel_member ? '💎 <b>Official Channel Member (@techiemuthuraj)</b>' : '✈️ <i>Subscriber to @techiemuthuraj</i>';
          const successMsg = `
✅ <b>Authentication Verified!</b>

Welcome to Techi Files, <b>@${user.username}</b>!

🛡️ <b>Verification Details:</b>
• Status: <b>Original Telegram User Verified</b>
• Community: ${memberBadge}
• Telegram ID: <code>${user.telegram_id}</code>

⚡ <b>Your browser has been automatically authenticated!</b>
You can switch back to your browser now. Your download privileges and token access are unlocked.
          `.trim();

          await sendTelegramMessage(chatId, successMsg, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '⚡ Open Techi Files Portal', url: PORTAL_URL },
                  { text: '✈️ Official Channel', url: 'https://t.me/techiemuthuraj' }
                ]
              ]
            }
          });
        } else {
          // Code not found or expired
          const notFoundMsg = `
⚠️ <b>Verification Code Not Found or Expired</b>

The code <code>${code}</code> is invalid or expired.

<b>How to log in:</b>
1. Open the Techi Files website and click <b>Log In</b>.
2. Enter your username or click <b>Verify via Bot</b>.
3. Tap <b>Start</b> with the new code.
          `.trim();

          await sendTelegramMessage(chatId, notFoundMsg, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🌐 Open Website', url: PORTAL_URL }]
              ]
            }
          });
        }
      }

      // Command: /login or /verify without code (bot generates PIN for user)
      else if (/^\/(?:login|verify|code|auth)$/i.test(text)) {
        const userHandle = message.from?.username || '';
        const challenge = createAuthChallenge({ 
          claimedUsername: userHandle,
          telegramUser: message.from || { id: chatId, first_name: firstName, username: userHandle }
        });
        const pinMsg = `
🔐 <b>Techi Files Login PIN</b>

Your one-time 6-digit login PIN is:
👉 <pre><code>${challenge.code}</code></pre>

<b>Instructions:</b>
1. Open <a href="${PORTAL_URL}">Techi Files</a> on your browser.
2. Enter your 6-digit PIN: <code>${challenge.code}</code> in the login box.
3. Click <b>Verify PIN & Log In</b>.

<i>Valid for 5 minutes.</i>
        `.trim();

        await sendTelegramMessage(chatId, pinMsg, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🌐 Open Web Portal', url: PORTAL_URL }]
            ]
          }
        });
      }

      // Command: Standard /start (Welcome)
      else if (text.startsWith('/start')) {
        const welcomeMessage = `
⚡ <b>Welcome to Techi Files</b>, ${firstName}!

Access verified digital resources, software packages, Android APKs, and developer scripts with cryptographically gated access tokens by <b>@techiemuthuraj</b>.

<b>How to use:</b>
1. Browse available files on our web portal or channel.
2. Obtain an access token for your desired file.
3. Enter your token on the website to claim your secure download link!

🔐 <b>Web Login:</b>
Send /login to get an instant 6-digit login PIN for the website.
        `.trim();

        await sendTelegramMessage(chatId, welcomeMessage, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🌐 Open File Portal', url: PORTAL_URL },
                { text: '✈️ Official Channel', url: 'https://t.me/techiemuthuraj' }
              ],
              [
                { text: '📦 View Available Files', callback_data: 'view_files' }
              ]
            ]
          }
        });
      }

      // Command: /files or /catalog
      else if (text.startsWith('/files') || text.startsWith('/catalog')) {
        const publicFiles = await getPublicFiles();
        const topFiles = publicFiles.slice(0, 6);

        let catalogText = `📦 <b>Available Files Catalog:</b>\n\n`;
        topFiles.forEach((f, idx) => {
          catalogText += `<b>${idx + 1}. ${f.title}</b>\n`;
          catalogText += `   Code: <code>${f.file_code}</code> | ${f.file_size} [${f.category}]\n\n`;
        });
        catalogText += `<i>Enter any file code on the website with your access token to download!</i>`;

        await sendTelegramMessage(chatId, catalogText, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔑 Unlock File on Web', url: PORTAL_URL }]
            ]
          }
        });
      }

      // Command: /help
      else if (text.startsWith('/help')) {
        const helpText = `
🛡️ <b>Bot Commands:</b>

/start - Welcome message and quick links
/files - List latest available digital files
/help - Show this command list

<i>Need an access token? Contact @techiemuthuraj or check channel posts.</i>
        `.trim();

        await sendTelegramMessage(chatId, helpText);
      }

      // Direct Token Check attempt: User sends a token like TM-XXXX-XXXX-XXXX
      else if (/^TM-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/i.test(text)) {
        const reply = `
🔑 <b>Access Token Detected!</b>

Tokens are verified securely on our web portal to deliver your file directly:
👉 <b><a href="${PORTAL_URL}">Open Techi Files</a></b>

Paste your token in the verification box to claim your download!
        `.trim();

        await sendTelegramMessage(chatId, reply);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true })
    };

  } catch (err) {
    console.error('[Telegram Webhook Error]:', err);
    // Return 200 to Telegram so it doesn't repeatedly retry on payload errors
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, error: err.message })
    };
  }
};
