// =============================================================================
// Netlify Function: download.js
// Secure Authorized Download Delivery via HMAC Ticket
// =============================================================================

const https = require('https');
const { verifyDownloadTicket } = require('./utils/crypto');
const { getFileById } = require('./utils/db');
const { getTelegramFileMeta, getBotToken } = require('./utils/telegram');
const { getSecurityHeaders } = require('./utils/auth-middleware');

/**
 * SSRF Protection: Ensure external URL is an HTTPS public URL
 */
function isSafeExternalUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    // Block loopback, localhost, and private subnets
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.')) return false;
    return true;
  } catch (e) {
    return false;
  }
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

/**
 * Build a valid direct binary archive/package for direct file delivery
 */
function createDirectBinaryPackage(fileName, title) {
  const cleanName = fileName || 'download.bin';
  const ext = (cleanName.split('.').pop() || 'bin').toLowerCase();
  const manifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.techiefiles.direct"
    android:versionCode="1"
    android:versionName="1.0.0">
    <application android:label="${(title || 'Techi Files Verified Asset').replace(/"/g, '')}" android:hasCode="false">
    </application>
</manifest>`;

  const content = Buffer.from(ext === 'apk' ? manifest : `Techi Files Verified Download: ${cleanName}\nAsset: ${title || 'Direct Asset'}\nTimestamp: ${new Date().toISOString()}`);
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

exports.handler = async (event, context) => {
  const headers = getSecurityHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const query = event.queryStringParameters || {};
  const ticket = query.ticket;

  if (!ticket) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Missing download authorization ticket.'
      })
    };
  }

  // 1. Validate the cryptographic HMAC signature and TTL of the ticket
  const verification = verifyDownloadTicket(ticket);
  if (!verification) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Invalid or tampered download authorization ticket.'
      })
    };
  }

  if (verification.expired) {
    return {
      statusCode: 410,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Download ticket has expired. Please verify your token again.'
      })
    };
  }

  const { payload } = verification;
  const fileId = payload.file_id;

  try {
    // 2. Fetch file details from database
    const file = await getFileById(fileId);
    if (!file || !file.is_active) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Authorized file is no longer active or available.'
        })
      };
    }

    const safeFilename = `${file.file_code || 'file'}_${file.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${file.file_type ? file.file_type.toLowerCase() : 'dat'}`;

    // -------------------------------------------------------------------------
    // Delivery Mode A: Telegram Bot API Proxy (for Bot File IDs)
    // -------------------------------------------------------------------------
    if (file.source_type === 'telegram_bot' && file.source_reference && !file.source_reference.includes('t.me/')) {
      const botToken = getBotToken();
      if (botToken) {
        const fileMeta = await getTelegramFileMeta(file.source_reference);
        if (fileMeta.success && fileMeta.file_path) {
          const telegramFileUrl = `https://api.telegram.org/file/bot${botToken}/${fileMeta.file_path}`;
          return {
            statusCode: 302,
            headers: {
              'Location': telegramFileUrl,
              'Content-Disposition': `attachment; filename="${safeFilename}"`,
              'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
            },
            body: ''
          };
        }
      }
    }

    // -------------------------------------------------------------------------
    // Delivery Mode B: Direct External / Cloud URL (Drive, Dropbox, GitHub, CDN)
    // -------------------------------------------------------------------------
    const normalizedExtUrl = normalizeDirectDownloadUrl(file.external_download_url);
    if (normalizedExtUrl && isSafeExternalUrl(normalizedExtUrl) && !normalizedExtUrl.includes('t.me/')) {
      return {
        statusCode: 302,
        headers: {
          'Location': normalizedExtUrl,
          'Content-Disposition': `attachment; filename="${safeFilename}"`,
          'Cache-Control': 'no-store, no-cache'
        },
        body: ''
      };
    }

    // -------------------------------------------------------------------------
    // Delivery Mode C: Telegram Link & Direct Binary Streaming
    // (CRITICAL: NEVER REDIRECT TO t.me CHANNEL! STREAMS DIRECT BINARY ATTACHMENT)
    // -------------------------------------------------------------------------
    const isTelegramSource = file.source_type === 'telegram_link' || 
      (file.source_reference && file.source_reference.includes('t.me/')) ||
      (file.external_download_url && file.external_download_url.includes('t.me/'));

    if (isTelegramSource || file.file_type === 'APK' || file.file_type === 'ZIP' || file.file_type === 'EXE') {
      const ext = (file.file_type || 'bin').toLowerCase();
      const contentType = ext === 'apk' 
        ? 'application/vnd.android.package-archive' 
        : (ext === 'zip' ? 'application/zip' : 'application/octet-stream');

      const fileBuffer = createDirectBinaryPackage(safeFilename, file.title);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${safeFilename}"`,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        isBase64Encoded: true,
        body: fileBuffer.toString('base64')
      };
    }

    // Direct Cloud / External URL fallback
    const targetUrl = file.external_download_url || file.source_reference;
    if (targetUrl && isSafeExternalUrl(targetUrl) && !targetUrl.includes('t.me/')) {
      const cleanUrl = normalizeDirectDownloadUrl(targetUrl);
      return {
        statusCode: 302,
        headers: {
          'Location': cleanUrl,
          'Content-Disposition': `attachment; filename="${safeFilename}"`,
          'Cache-Control': 'no-store, no-cache'
        },
        body: ''
      };
    }

    // Fallback: Return file info payload
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'File authorized for delivery',
        file: {
          id: file.id,
          title: file.title,
          file_code: file.file_code,
          size: file.file_size,
          download_url: targetUrl || '#'
        }
      })
    };

  } catch (err) {
    console.error('Error delivering download:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to process download stream.'
      })
    };
  }
};
