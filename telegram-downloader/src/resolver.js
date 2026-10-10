// =============================================================================
// Telegram Direct File Downloader - Post & File Resolver
// Resolves Telegram posts & file IDs into verified direct downloadable assets
// =============================================================================

const https = require('https');
const http = require('http');
const { config, formatBytes, getMimeType, getFileCategory } = require('./config');
const { parseTelegramLink } = require('./link-parser');
const { getFile, getChat, sanitizeLog } = require('./telegram-api');
const { generateDownloadToken } = require('./token-manager');

/**
 * Fetch HTML/text content from HTTPS URL (e.g., Telegram post embed)
 */
function fetchHttpsText(targetUrl) {
  return new Promise((resolve) => {
    try {
      const u = new URL(targetUrl);
      const req = https.get(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 8000
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, data }));
      });
      req.on('error', (err) => resolve({ statusCode: 500, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ statusCode: 504, error: 'Timeout' }); });
    } catch (e) {
      resolve({ statusCode: 400, error: e.message });
    }
  });
}

/**
 * Resolve a Telegram post link or file ID to direct download metadata
 */
async function resolveTelegramFile(input) {
  const parsed = parseTelegramLink(input);
  if (!parsed.valid) {
    return {
      success: false,
      error: parsed.error,
      code: 'INVALID_LINK'
    };
  }

  // ---------------------------------------------------------------------------
  // Case 1: Direct Telegram Bot File ID
  // ---------------------------------------------------------------------------
  if (parsed.type === 'bot_file_id') {
    try {
      const fileMeta = await getFile(parsed.fileId);
      const filePath = fileMeta.file_path;
      const rawName = filePath ? filePath.split('/').pop() : `file_${parsed.fileId.slice(0, 8)}`;
      const mime = getMimeType(rawName);
      const category = getFileCategory(rawName, mime);
      const sizeBytes = fileMeta.file_size || 0;

      const token = generateDownloadToken({
        source: `tg_file_path:${filePath}`,
        name: rawName,
        size: sizeBytes,
        mime
      });

      const downloadUrl = `${config.baseUrl}/api/download/${token}`;

      return {
        success: true,
        file: {
          name: rawName,
          size_bytes: sizeBytes,
          size_formatted: formatBytes(sizeBytes),
          mime_type: mime,
          category,
          status: 'ready'
        },
        download_url: downloadUrl,
        copy_link: downloadUrl,
        source_type: 'bot_file_id',
        message: 'Direct download link generated via Telegram Bot API'
      };
    } catch (err) {
      return {
        success: false,
        error: sanitizeLog(err.message),
        code: 'FILE_ID_RESOLVE_FAILED'
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Case 2: Private Channel Link (t.me/c/...)
  // ---------------------------------------------------------------------------
  if (parsed.type === 'private_channel_post') {
    return {
      success: false,
      code: 'PRIVATE_CHANNEL_RESTRICTED',
      error: `Inaccessible post: Telegram restricts bots from accessing private channel posts (${parsed.chatId}/${parsed.messageId}) without channel permissions.`,
      resolution_steps: [
        `1. Add @${config.botUsername} to your private channel as an Administrator with 'Post Messages' rights.`,
        '2. Or forward the message directly to the bot in a private chat to generate an instant download link.'
      ]
    };
  }

  // ---------------------------------------------------------------------------
  // Case 3: Public Channel Post Link (t.me/channelname/123)
  // ---------------------------------------------------------------------------
  if (parsed.type === 'channel_post') {
    const channel = parsed.cleanChannel;
    const msgId = parsed.messageId;

    // Verify channel access via Telegram Bot API
    let chatAccessible = false;
    let chatTitle = channel;
    try {
      const chatInfo = await getChat(`@${channel}`);
      if (chatInfo.ok && chatInfo.result) {
        chatAccessible = true;
        chatTitle = chatInfo.result.title || channel;
      }
    } catch (e) {
      // Chat may still be accessible via web widget
    }

    // Inspect post contents via Telegram widget embed
    const embedRes = await fetchHttpsText(parsed.embedUrl);
    let html = (embedRes.statusCode === 200 && embedRes.data && embedRes.data.includes('tgme_widget_message'))
      ? embedRes.data
      : null;

    if (!html) {
      const sRes = await fetchHttpsText(parsed.previewUrl);
      if (sRes.statusCode === 200 && sRes.data) {
        html = sRes.data;
      }
    }

    if (!html) {
      return {
        success: false,
        code: 'POST_INACCESSIBLE',
        error: `Unable to access post https://t.me/${channel}/${msgId}. Post may have been deleted, channel is private, or requires membership.`,
        resolution_steps: [
          `Ensure the channel @${channel} is public, or add @${config.botUsername} as an Administrator to the channel.`
        ]
      };
    }

    // Extract title, size, and post details
    let docTitle = '';
    let docSize = '';

    const titleMatch = html.match(/class=["']tgme_widget_message_document_title["'][^>]*>([^<]+)<\//i);
    if (titleMatch) docTitle = titleMatch[1].trim();

    const sizeMatch = html.match(/class=["']tgme_widget_message_document_extra["'][^>]*>([^<]+)<\//i);
    if (sizeMatch) docSize = sizeMatch[1].trim();

    const textMatch = html.match(/class=["']tgme_widget_message_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const postText = textMatch ? textMatch[1].replace(/<[^>]+>/g, ' ').trim() : '';

    // Check if post text contains links to direct downloadable files (.apk, .zip, etc.)
    const directFileUrlMatch = html.match(/https?:\/\/[^\s"'<>]+\.(apk|zip|rar|7z|tar\.gz|pdf|exe|msi|mp4|mp3)/gi);
    const externalAssetUrl = directFileUrlMatch ? directFileUrlMatch[0] : null;

    if (!docTitle && postText) {
      docTitle = postText.split('\n')[0].slice(0, 60).trim();
    }
    if (!docTitle) {
      docTitle = `${channel}_post_${msgId}`;
    }

    const mime = getMimeType(docTitle);
    const category = getFileCategory(docTitle, mime);

    // Format safe file name with extension
    let fileName = docTitle;
    if (!fileName.includes('.')) {
      const ext = category === 'APK' ? '.apk' : (category === 'ZIP' ? '.zip' : (category === 'PDF' ? '.pdf' : '.bin'));
      fileName = `${fileName}${ext}`;
    }

    // Generate direct stream download token
    const downloadSource = externalAssetUrl 
      ? `external_url:${externalAssetUrl}` 
      : `channel_post:@${channel}/${msgId}:${fileName}`;

    const token = generateDownloadToken({
      source: downloadSource,
      name: fileName,
      size: docSize || 0,
      mime
    });

    const downloadUrl = `${config.baseUrl}/api/download/${token}`;

    return {
      success: true,
      file: {
        name: fileName,
        size_bytes: null,
        size_formatted: docSize || 'Standard Telegram File',
        mime_type: mime,
        category,
        channel: `@${channel}`,
        message_id: msgId,
        channel_title: chatTitle,
        status: 'ready'
      },
      download_url: downloadUrl,
      copy_link: downloadUrl,
      source_type: 'channel_post',
      is_bot_accessible: chatAccessible,
      message: 'Direct download link generated for Telegram channel post!'
    };
  }

  // ---------------------------------------------------------------------------
  // Case 4: Generic Direct URL
  // ---------------------------------------------------------------------------
  if (parsed.type === 'direct_url') {
    const u = new URL(parsed.url);
    const rawName = u.pathname.split('/').pop() || 'downloaded_file';
    const mime = getMimeType(rawName);
    const category = getFileCategory(rawName, mime);

    const token = generateDownloadToken({
      source: `external_url:${parsed.url}`,
      name: rawName,
      size: 0,
      mime
    });

    const downloadUrl = `${config.baseUrl}/api/download/${token}`;

    return {
      success: true,
      file: {
        name: rawName,
        size_bytes: null,
        size_formatted: 'External Stream',
        mime_type: mime,
        category,
        status: 'ready'
      },
      download_url: downloadUrl,
      copy_link: downloadUrl,
      source_type: 'direct_url',
      message: 'Direct download link generated for URL'
    };
  }

  return {
    success: false,
    error: 'Unrecognized link type',
    code: 'UNKNOWN_TYPE'
  };
}

module.exports = {
  resolveTelegramFile
};
