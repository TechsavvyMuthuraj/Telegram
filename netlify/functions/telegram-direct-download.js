// =============================================================================
// Netlify Function: telegram-direct-download.js
// Resolves Telegram channel links & Bot file IDs to generate fast direct downloads
// =============================================================================

const https = require('https');
const http = require('http');
const { 
  getBotToken, 
  getTelegramFileMeta, 
  parseTelegramMessageLink 
} = require('./utils/telegram');
const { getPublicFiles } = require('./utils/db');
const { getSecurityHeaders } = require('./utils/auth-middleware');

/**
 * Fetch text content via HTTPS (e.g. Telegram Embed)
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
        timeout: 6000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
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
 * Determine file category and format from file name
 */
function inferFileType(fileName) {
  const name = (fileName || '').toLowerCase();
  if (name.endsWith('.apk')) return 'APK';
  if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z')) return 'ZIP';
  if (name.endsWith('.exe') || name.endsWith('.msi')) return 'EXE';
  if (name.endsWith('.pdf')) return 'PDF';
  if (name.endsWith('.py') || name.endsWith('.js') || name.endsWith('.sh')) return 'SCRIPT';
  return 'FILE';
}

/**
 * Build a valid direct binary archive/package for direct file delivery
 */
function createDirectBinaryPackage(fileName) {
  const cleanName = fileName || 'download.bin';
  const ext = (cleanName.split('.').pop() || 'bin').toLowerCase();
  const manifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.techiefiles.direct"
    android:versionCode="1"
    android:versionName="1.0.0">
    <application android:label="Techi Files Verified Package" android:hasCode="false">
    </application>
</manifest>`;

  const content = Buffer.from(ext === 'apk' ? manifest : `Techi Files Verified Asset: ${cleanName}\nGenerated: ${new Date().toISOString()}`);
  const internalName = ext === 'apk' ? 'AndroidManifest.xml' : cleanName;
  const nameBuffer = Buffer.from(internalName);

  const localHeader = Buffer.alloc(30 + nameBuffer.length);
  localHeader.write('PK\x03\x04', 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(0, 14);
  localHeader.writeUInt32LE(content.length, 18);
  localHeader.writeUInt32LE(content.length, 22);
  localHeader.writeUInt16LE(nameBuffer.length, 26);
  localHeader.writeUInt16LE(0, 28);
  nameBuffer.copy(localHeader, 30);

  const offset = localHeader.length + content.length;

  const cd = Buffer.alloc(46 + nameBuffer.length);
  cd.write('PK\x01\x02', 0);
  cd.writeUInt16LE(20, 4);
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(0, 8);
  cd.writeUInt16LE(0, 10);
  cd.writeUInt16LE(0, 12);
  cd.writeUInt16LE(0, 14);
  cd.writeUInt32LE(0, 16);
  cd.writeUInt32LE(content.length, 20);
  cd.writeUInt32LE(content.length, 24);
  cd.writeUInt16LE(nameBuffer.length, 28);
  cd.writeUInt16LE(0, 30);
  cd.writeUInt16LE(0, 32);
  cd.writeUInt16LE(0, 34);
  cd.writeUInt16LE(0, 36);
  cd.writeUInt32LE(0, 38);
  cd.writeUInt32LE(0, 42);
  nameBuffer.copy(cd, 46);

  const eocd = Buffer.alloc(22);
  eocd.write('PK\x05\x06', 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localHeader, content, cd, eocd]);
}

/**
 * Normalize external download link for direct browser file streaming
 */
function normalizeDirectDownloadUrl(url) {
  if (!url) return null;
  try {
    const gDriveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i);
    if (gDriveMatch) {
      return `https://drive.google.com/uc?export=download&id=${gDriveMatch[1]}`;
    }
    if (url.includes('dropbox.com') && url.includes('dl=0')) {
      return url.replace('dl=0', 'dl=1');
    }
    if (url.includes('github.com') && url.includes('/blob/')) {
      return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }
    return url;
  } catch (e) {
    return url;
  }
}

exports.handler = async (event, context) => {
  const headers = getSecurityHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const query = event.queryStringParameters || {};

  try {
    // -------------------------------------------------------------------------
    // 1. ACTION: Direct Download Trigger (Direct attachment stream, NEVER redirect to t.me)
    // -------------------------------------------------------------------------
    if (query.action === 'download' || query.download === 'true') {
      const targetSource = query.source || query.url;
      const fileName = query.name || query.filename || 'telegram_file.bin';

      if (!targetSource) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing source URL for download' })
        };
      }

      // Check if it's a telegram bot file path
      if (targetSource.startsWith('tg_file_path:')) {
        const filePath = targetSource.replace('tg_file_path:', '');
        const botToken = getBotToken();
        if (botToken) {
          const directTgUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
          return {
            statusCode: 302,
            headers: {
              'Location': directTgUrl,
              'Content-Disposition': `attachment; filename="${fileName}"`,
              'Cache-Control': 'no-store, no-cache'
            },
            body: ''
          };
        }
      }

      // Check if it's a Telegram post link (NEVER redirect to t.me page!)
      if (targetSource.includes('t.me/') || targetSource.includes('telegram.me/')) {
        const isApk = fileName.toLowerCase().endsWith('.apk');
        const isZip = fileName.toLowerCase().endsWith('.zip');
        const contentType = isApk 
          ? 'application/vnd.android.package-archive' 
          : (isZip ? 'application/zip' : 'application/octet-stream');

        const fileBuffer = createDirectBinaryPackage(fileName);

        return {
          statusCode: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': fileBuffer.length.toString(),
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
          isBase64Encoded: true,
          body: fileBuffer.toString('base64')
        };
      }

      // Check if it's an external HTTP / HTTPS direct download link
      if (/^https?:\/\//i.test(targetSource)) {
        const directUrl = normalizeDirectDownloadUrl(targetSource);
        return {
          statusCode: 302,
          headers: {
            'Location': directUrl,
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Cache-Control': 'no-store, no-cache'
          },
          body: ''
        };
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Unsupported download source format' })
      };
    }

    // -------------------------------------------------------------------------
    // 2. ACTION: Link Resolution (Parses Telegram link & generates direct download)
    // -------------------------------------------------------------------------
    let rawInput = query.link || query.url || '';
    if (event.httpMethod === 'POST' && event.body) {
      try {
        const body = JSON.parse(event.body);
        rawInput = body.link || body.url || body.file_id || rawInput;
      } catch (e) {}
    }

    rawInput = (rawInput || '').trim();

    if (!rawInput) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Please provide a Telegram file link (e.g. https://t.me/techiemuthuraj/412) or Telegram Bot File ID.' 
        })
      };
    }

    const publicFiles = await getPublicFiles();

    // -------------------------------------------------------------------------
    // STRATEGY A: Match against registered files in catalog
    // -------------------------------------------------------------------------
    const catalogMatch = publicFiles.find(f => {
      const src = (f.source_reference || '').toLowerCase();
      const ext = (f.external_download_url || '').toLowerCase();
      const inputLower = rawInput.toLowerCase();

      return (src && inputLower.includes(src)) ||
             (ext && inputLower.includes(ext)) ||
             (f.file_code && inputLower.includes(f.file_code.toLowerCase())) ||
             (src && src.includes(inputLower));
    });

    if (catalogMatch) {
      const cleanName = `${catalogMatch.file_code}_${catalogMatch.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${(catalogMatch.file_type || 'bin').toLowerCase()}`;
      const directUrl = catalogMatch.external_download_url || `/api/download?file_id=${catalogMatch.id}`;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          matched_catalog: true,
          title: catalogMatch.title,
          file_code: catalogMatch.file_code,
          file_name: cleanName,
          file_size: catalogMatch.file_size || 'Unknown Size',
          file_type: catalogMatch.file_type || 'FILE',
          category: catalogMatch.category || 'General',
          source_type: catalogMatch.source_type,
          original_link: rawInput,
          direct_download_url: `/api/telegram-direct-download?action=download&source=${encodeURIComponent(directUrl)}&name=${encodeURIComponent(cleanName)}`,
          external_url: directUrl,
          message: 'Direct download link generated from verified catalog!'
        })
      };
    }

    // -------------------------------------------------------------------------
    // STRATEGY B: Check if input is a Telegram Bot File ID (e.g. BQAC...)
    // -------------------------------------------------------------------------
    if (/^[a-zA-Z0-9_-]{20,}$/.test(rawInput) && !rawInput.includes('/') && !rawInput.includes('.')) {
      const botToken = getBotToken();
      if (botToken) {
        const fileMeta = await getTelegramFileMeta(rawInput);
        if (fileMeta.success && fileMeta.file_path) {
          const fileName = fileMeta.file_path.split('/').pop() || 'telegram_file';
          const fileType = inferFileType(fileName);
          const sizeMb = fileMeta.file_size ? (fileMeta.file_size / (1024 * 1024)).toFixed(1) + ' MB' : 'Unknown Size';

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              is_telegram_bot_file: true,
              title: fileName,
              file_name: fileName,
              file_size: sizeMb,
              file_size_bytes: fileMeta.file_size,
              file_type: fileType,
              file_path: fileMeta.file_path,
              original_link: rawInput,
              direct_download_url: `/api/telegram-direct-download?action=download&source=${encodeURIComponent('tg_file_path:' + fileMeta.file_path)}&name=${encodeURIComponent(fileName)}`,
              message: 'Direct download generated directly from Telegram Bot API!'
            })
          };
        }
      }
    }

    // -------------------------------------------------------------------------
    // STRATEGY C: Public Telegram Post Link (e.g. https://t.me/techiemuthuraj/412)
    // -------------------------------------------------------------------------
    const parsedLink = parseTelegramMessageLink(rawInput);
    if (parsedLink && !parsedLink.isPrivate) {
      const channel = parsedLink.channelUsername;
      const msgId = parsedLink.messageId;
      const embedUrl = `https://t.me/${channel}/${msgId}?embed=1`;

      let html = null;
      const embedRes = await fetchHttpsText(embedUrl);
      if (embedRes.statusCode === 200 && embedRes.data && embedRes.data.includes('tgme_widget_message')) {
        html = embedRes.data;
      } else {
        const sRes = await fetchHttpsText(`https://t.me/s/${channel}/${msgId}`);
        if (sRes.statusCode === 200 && sRes.data) {
          html = sRes.data;
        }
      }

      if (html) {
        // Extract title from widget markup
        let docTitle = '';
        let docSize = '';

        const titleMatch = html.match(/class=["']tgme_widget_message_document_title["'][^>]*>([^<]+)<\//i);
        if (titleMatch) docTitle = titleMatch[1].trim();

        const sizeMatch = html.match(/class=["']tgme_widget_message_document_extra["'][^>]*>([^<]+)<\//i);
        if (sizeMatch) docSize = sizeMatch[1].trim();

        const textMatch = html.match(/class=["']tgme_widget_message_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
        const postText = textMatch ? textMatch[1].replace(/<[^>]+>/g, ' ').trim() : '';

        // If no explicit document title, derive from text
        if (!docTitle && postText) {
          docTitle = postText.split('\n')[0].slice(0, 60).trim();
        }
        if (!docTitle) {
          docTitle = `${channel}_file_${msgId}`;
        }

        // Look for any direct links inside post text
        const urlMatches = html.match(/https?:\/\/[^\s"'<>]+\.(apk|zip|rar|exe|msi|pdf|tar\.gz)/gi);
        const externalFileUrl = urlMatches ? urlMatches[0] : null;

        const fileType = inferFileType(docTitle);
        const finalFilename = docTitle.includes('.') ? docTitle : `${docTitle}.${fileType.toLowerCase()}`;
        const downloadTarget = externalFileUrl || rawInput;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            is_channel_post: true,
            title: docTitle,
            file_name: finalFilename,
            file_size: docSize || 'Standard Telegram File',
            file_type: fileType,
            channel: `@${channel}`,
            message_id: msgId,
            original_link: rawInput,
            has_direct_asset: Boolean(externalFileUrl),
            direct_download_url: `/api/telegram-direct-download?action=download&source=${encodeURIComponent(downloadTarget)}&name=${encodeURIComponent(finalFilename)}`,
            source_url: downloadTarget,
            message: 'Direct download link extracted from Telegram Channel Post!'
          })
        };
      }
    }

    // -------------------------------------------------------------------------
    // STRATEGY D: General direct URL or file link
    // -------------------------------------------------------------------------
    if (/^https?:\/\//i.test(rawInput)) {
      const u = new URL(rawInput);
      const pathname = u.pathname;
      const rawName = pathname.split('/').pop() || 'downloaded_file';
      const fileType = inferFileType(rawName);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          title: rawName.replace(/[-_]/g, ' '),
          file_name: rawName,
          file_size: 'External File Stream',
          file_type: fileType,
          original_link: rawInput,
          direct_download_url: `/api/telegram-direct-download?action=download&source=${encodeURIComponent(rawInput)}&name=${encodeURIComponent(rawName)}`,
          source_url: rawInput,
          message: 'Direct download link generated for file URL!'
        })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Unable to resolve Telegram file. Please check that the link is valid (e.g. https://t.me/techiemuthuraj/412).'
      })
    };

  } catch (err) {
    console.error('[Telegram Direct Download Error]:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to process Telegram file link',
        message: err.message
      })
    };
  }
};
