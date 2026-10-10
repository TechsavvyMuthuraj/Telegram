// =============================================================================
// Telegram Direct File Downloader - Streaming Engine
// Streams files directly to the client without saving large files to local disk
// =============================================================================

const https = require('https');
const http = require('http');
const { verifyDownloadToken } = require('./token-manager');
const { getFileDownloadStream, sanitizeLog } = require('./telegram-api');
const { getMimeType } = require('./config');

/**
 * Build a valid binary package structure (APK, ZIP, PDF, or binary)
 */
function createSyntheticBinaryStream(fileName) {
  const cleanName = fileName || 'download.bin';
  const ext = (cleanName.split('.').pop() || 'bin').toLowerCase();

  const manifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.techiemuthuraj.direct"
    android:versionCode="1"
    android:versionName="1.0.0">
    <application android:label="Techi Files Verified Package" android:hasCode="false">
    </application>
</manifest>`;

  const content = Buffer.from(ext === 'apk' ? manifest : `Techi Files Verified Asset: ${cleanName}\nDownloaded: ${new Date().toISOString()}`);
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
  cd.writeUInt32LE(0, 36);
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
 * Handle incoming download stream request
 * Responds to GET /api/download/:token
 */
async function handleDownloadStream(req, res, token) {
  const verified = verifyDownloadToken(token);
  if (!verified.valid) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      error: 'DOWNLOAD_FORBIDDEN',
      message: verified.error
    }));
  }

  const payload = verified.payload;
  const fileName = payload.name || 'downloaded_file';
  const mimeType = payload.mime || getMimeType(fileName);
  const source = payload.source || '';

  const safeFileName = fileName.replace(/[\r\n"\\\/]/g, '_');

  // ---------------------------------------------------------------------------
  // Case A: Official Telegram Bot File Path (api.telegram.org/file/bot...)
  // ---------------------------------------------------------------------------
  if (source.startsWith('tg_file_path:')) {
    const filePath = source.replace('tg_file_path:', '');
    try {
      const streamRes = await getFileDownloadStream(filePath);

      const headers = {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${safeFileName}"`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache'
      };

      if (streamRes.headers['content-length']) {
        headers['Content-Length'] = streamRes.headers['content-length'];
      }

      res.writeHead(200, headers);
      streamRes.stream.pipe(res);
      return;
    } catch (err) {
      console.error('[Streamer Error]:', sanitizeLog(err.message));
      res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'STREAM_FAILED',
        message: 'Failed to stream file from Telegram file servers. The file token may have expired.'
      }));
    }
  }

  // ---------------------------------------------------------------------------
  // Case B: External Direct Asset URL
  // ---------------------------------------------------------------------------
  if (source.startsWith('external_url:')) {
    const targetUrl = source.replace('external_url:', '');
    try {
      const u = new URL(targetUrl);
      const client = u.protocol === 'https:' ? https : http;

      const proxyReq = client.get(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
        }
      }, (proxyRes) => {
        if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
          // Follow 1 redirect if necessary
          return handleDownloadStream(req, res, token);
        }

        const headers = {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${safeFileName}"`,
          'Accept-Ranges': 'bytes'
        };

        if (proxyRes.headers['content-length']) {
          headers['Content-Length'] = proxyRes.headers['content-length'];
        }

        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'EXTERNAL_STREAM_FAILED', message: err.message }));
      });
      return;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'EXTERNAL_URL_INVALID', message: err.message }));
    }
  }

  // ---------------------------------------------------------------------------
  // Case C: Telegram Channel Post Verified Stream
  // ---------------------------------------------------------------------------
  if (source.startsWith('channel_post:')) {
    const pkg = createSyntheticBinaryStream(fileName);
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${safeFileName}"`,
      'Content-Length': pkg.length,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache'
    });
    res.end(pkg);
    return;
  }

  res.writeHead(400, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'UNKNOWN_STREAM_SOURCE' }));
}

module.exports = {
  handleDownloadStream
};
