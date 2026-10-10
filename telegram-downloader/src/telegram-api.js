// =============================================================================
// Telegram Direct File Downloader - Telegram Bot API Client
// Wraps official Telegram Bot API with token hiding & direct streaming
// =============================================================================

const https = require('https');
const http = require('http');
const { config } = require('./config');

/**
 * Mask bot token in any text/error message to prevent leaking secrets
 */
function sanitizeLog(text) {
  if (!text || typeof text !== 'string') return text;
  if (!config.botToken) return text;
  return text.split(config.botToken).join('BOT_TOKEN_REDACTED');
}

/**
 * Call official Telegram Bot API
 */
async function callApi(method, params = {}, httpMethod = 'POST') {
  if (!config.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured in .env');
  }

  return new Promise((resolve, reject) => {
    try {
      const url = new URL(`${config.apiRoot}/bot${config.botToken}/${method}`);
      const isPost = httpMethod.toUpperCase() === 'POST';
      let postData = '';

      if (isPost) {
        postData = JSON.stringify(params);
      } else if (params && Object.keys(params).length > 0) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null) {
            url.searchParams.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
          }
        });
      }

      const client = url.protocol === 'https:' ? https : http;
      const options = {
        method: isPost ? 'POST' : 'GET',
        headers: isPost ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        } : {},
        timeout: config.downloadTimeoutMs
      };

      const req = client.request(url, options, (res) => {
        let rawData = '';
        res.on('data', chunk => { rawData += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Failed to parse Telegram API response: ${sanitizeLog(rawData)}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Telegram API network error: ${sanitizeLog(err.message)}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Telegram API request timed out'));
      });

      if (isPost && postData) {
        req.write(postData);
      }
      req.end();
    } catch (err) {
      reject(new Error(`Telegram API call failed: ${sanitizeLog(err.message)}`));
    }
  });
}

/**
 * Get bot info
 */
async function getMe() {
  return await callApi('getMe', {}, 'GET');
}

/**
 * Get chat / channel information
 */
async function getChat(chatId) {
  return await callApi('getChat', { chat_id: chatId });
}

/**
 * Get file metadata and file_path using official getFile API
 */
async function getFile(fileId) {
  if (!fileId) throw new Error('file_id is required');
  const res = await callApi('getFile', { file_id: fileId });
  if (!res.ok) {
    const desc = res.description || 'Unknown error';
    if (desc.includes('file is too big')) {
      throw new Error('Telegram Bot API limit: File exceeds 20MB limit of Telegram Cloud Bot API. (Run a local Bot API server for up to 2GB).');
    }
    throw new Error(`Telegram getFile failed: ${sanitizeLog(desc)}`);
  }
  return res.result;
}

/**
 * Open a direct readable stream to the Telegram file server
 * api.telegram.org/file/bot<token>/<file_path>
 */
function getFileDownloadStream(filePath) {
  if (!config.botToken) throw new Error('Missing TELEGRAM_BOT_TOKEN');
  if (!filePath) throw new Error('Missing filePath');

  const fileUrl = `${config.apiRoot}/file/bot${config.botToken}/${filePath}`;
  const u = new URL(fileUrl);
  const client = u.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.get(u, {
      headers: {
        'User-Agent': 'TechiFilesDownloader/1.0.0 (Node.js Stream Engine)'
      },
      timeout: config.downloadTimeoutMs
    }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          stream: res
        });
      } else {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          reject(new Error(`Failed to stream from Telegram file server (HTTP ${res.statusCode}): ${sanitizeLog(body)}`));
        });
      }
    });

    req.on('error', (err) => {
      reject(new Error(`Stream network error: ${sanitizeLog(err.message)}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Streaming timed out while connecting to Telegram'));
    });
  });
}

/**
 * Send Telegram message
 */
async function sendMessage(chatId, text, extra = {}) {
  return await callApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...extra
  });
}

/**
 * Poll updates for bot daemon
 */
async function getUpdates(offset = 0, limit = 100, timeout = 25) {
  return await callApi('getUpdates', { offset, limit, timeout });
}

module.exports = {
  callApi,
  getMe,
  getChat,
  getFile,
  getFileDownloadStream,
  sendMessage,
  getUpdates,
  sanitizeLog
};
