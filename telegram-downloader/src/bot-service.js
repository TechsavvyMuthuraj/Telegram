// =============================================================================
// Telegram Direct File Downloader - Telegram Bot Service
// Listens to bot commands (/dl, /start) and forwarded files to return direct download links
// =============================================================================

const { config, formatBytes, getFileCategory, getMimeType } = require('./config');
const { getUpdates, sendMessage, getFile, sanitizeLog } = require('./telegram-api');
const { resolveTelegramFile } = require('./resolver');
const { generateDownloadToken } = require('./token-manager');

let isPolling = false;
let lastUpdateId = 0;

/**
 * Handle incoming bot message
 */
async function handleBotMessage(message) {
  if (!message || !message.chat) return;
  const chatId = message.chat.id;
  const text = (message.text || '').trim();

  // 1. Direct File / Document Uploaded or Forwarded
  const doc = message.document || message.video || message.audio;
  if (doc && doc.file_id) {
    try {
      const fileName = doc.file_name || `${doc.file_id.slice(0, 8)}.bin`;
      const sizeBytes = doc.file_size || 0;
      const mime = doc.mime_type || getMimeType(fileName);
      const category = getFileCategory(fileName, mime);

      const fileMeta = await getFile(doc.file_id);
      const token = generateDownloadToken({
        source: `tg_file_path:${fileMeta.file_path}`,
        name: fileName,
        size: sizeBytes,
        mime
      });

      const downloadUrl = `${config.baseUrl}/api/download/${token}`;

      const replyText = `
📥 <b>Direct Download Link Generated!</b>

📦 <b>Filename:</b> <code>${fileName}</code>
📊 <b>File Size:</b> ${formatBytes(sizeBytes)}
🏷️ <b>Category:</b> ${category}
⚡ <b>Status:</b> Ready for direct download

🔗 <b>Direct Link:</b>
${downloadUrl}

📋 <b>Tap to Copy Link:</b>
<code>${downloadUrl}</code>
      `.trim();

      await sendMessage(chatId, replyText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬇️ Direct Download', url: downloadUrl }]
          ]
        }
      });
      return;
    } catch (err) {
      await sendMessage(chatId, `⚠️ <b>Error resolving file:</b> ${sanitizeLog(err.message)}`);
      return;
    }
  }

  // 2. /start or /help Command
  if (/^\/(?:start|help)$/i.test(text)) {
    const welcome = `
👋 <b>Welcome to Telegram Direct File Downloader!</b>

This bot converts Telegram post links and files into direct, high-speed download links.

⚡ <b>How to Use:</b>
1. Send a Telegram post link:
   <code>https://t.me/channelname/123</code>
2. Use the download command:
   <code>/dl https://t.me/channelname/123</code>
3. Or forward any file/APK/ZIP directly to this bot!

🛡️ <i>Your download links stream securely without exposing bot tokens.</i>
    `.trim();

    await sendMessage(chatId, welcome, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🌐 Open File Portal', url: 'https://techiefile.netlify.app/' },
            { text: '✈️ Official Channel', url: 'https://t.me/techiemuthuraj' }
          ]
        ]
      }
    });
    return;
  }

  // 3. /dl <link> or message containing a Telegram link
  const dlMatch = text.match(/^\/dl\s+(.+)$/i);
  const targetUrl = dlMatch ? dlMatch[1].trim() : text;

  if (targetUrl.includes('t.me/') || targetUrl.includes('telegram.me/') || /^[a-zA-Z0-9_-]{20,}$/.test(targetUrl)) {
    await sendMessage(chatId, '🔍 <i>Resolving Telegram file metadata...</i>');

    const result = await resolveTelegramFile(targetUrl);

    if (!result.success) {
      let errorMsg = `❌ <b>Resolution Failed:</b> ${result.error}\n`;
      if (result.resolution_steps) {
        errorMsg += `\n💡 <b>How to fix:</b>\n${result.resolution_steps.join('\n')}`;
      }
      await sendMessage(chatId, errorMsg);
      return;
    }

    const file = result.file;
    const responseMsg = `
📥 <b>Direct Download Link Generated!</b>

📦 <b>Filename:</b> <code>${file.name}</code>
📊 <b>File Size:</b> ${file.size_formatted}
🏷️ <b>Category:</b> ${file.category}
⚡ <b>Status:</b> Ready for direct download

🔗 <b>Direct Download Link:</b>
${result.download_url}

📋 <b>Tap Below to Copy:</b>
<code>${result.copy_link}</code>
    `.trim();

    await sendMessage(chatId, responseMsg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬇️ Download Now', url: result.download_url }]
        ]
      }
    });
    return;
  }

  // If text is not recognized
  if (text.startsWith('/')) {
    await sendMessage(chatId, `Unknown command. Send a Telegram link like: <code>https://t.me/channelname/123</code> or use <code>/dl &lt;link&gt;</code>.`);
  }
}

/**
 * Start long polling loop
 */
async function startBotPolling() {
  if (isPolling) return;
  isPolling = true;

  console.log(`[Bot Service] Polling started for @${config.botUsername}...`);

  while (isPolling) {
    try {
      const updates = await getUpdates(lastUpdateId + 1, 50, 20);
      if (updates && updates.ok && Array.isArray(updates.result)) {
        for (const update of updates.result) {
          lastUpdateId = update.update_id;
          if (update.message) {
            await handleBotMessage(update.message);
          }
        }
      }
    } catch (err) {
      if (isPolling) {
        // Sleep 3 seconds on error before retrying
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
}

/**
 * Stop polling
 */
function stopBotPolling() {
  isPolling = false;
  console.log('[Bot Service] Polling stopped.');
}

module.exports = {
  startBotPolling,
  stopBotPolling,
  handleBotMessage
};
