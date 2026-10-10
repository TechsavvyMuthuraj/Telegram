// =============================================================================
// Telegram Direct File Downloader - HTTP API Server
// Clean REST API for link resolution & binary file streaming (NO HTML / NO FRONTEND)
// =============================================================================

const http = require('http');
const { config } = require('./config');
const { resolveTelegramFile } = require('./resolver');
const { handleDownloadStream } = require('./streamer');
const { getMe } = require('./telegram-api');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, CORS_HEADERS);
  res.end(JSON.stringify(data, null, 2));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit for JSON bodies
        req.destroy();
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function createApiServer() {
  return http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname.replace(/\/+/g, '/');

    // Handle OPTIONS Preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      return res.end();
    }

    try {
      // -----------------------------------------------------------------------
      // 1. GET /health or /api/status
      // -----------------------------------------------------------------------
      if (req.method === 'GET' && (pathname === '/health' || pathname === '/api/status')) {
        let botStatus = 'unconfigured';
        let botDetails = null;

        if (config.botToken) {
          try {
            const me = await getMe();
            if (me.ok) {
              botStatus = 'connected';
              botDetails = {
                id: me.result.id,
                username: me.result.username,
                first_name: me.result.first_name
              };
            }
          } catch (e) {
            botStatus = 'error: ' + e.message;
          }
        }

        return sendJson(res, 200, {
          status: 'online',
          service: 'Telegram Direct File Downloader',
          version: '1.0.0',
          bot_status: botStatus,
          bot: botDetails,
          endpoints: {
            resolve: 'POST /api/resolve',
            download: 'GET /api/download/:token',
            status: 'GET /api/status'
          }
        });
      }

      // -----------------------------------------------------------------------
      // 2. POST /api/resolve
      // -----------------------------------------------------------------------
      if (req.method === 'POST' && (pathname === '/api/resolve' || pathname === '/resolve')) {
        const body = await parseJsonBody(req);
        const inputUrl = body.url || body.link || body.file_id || '';

        if (!inputUrl) {
          return sendJson(res, 400, {
            success: false,
            error: 'Missing "url" or "link" parameter in JSON payload. Example: { "url": "https://t.me/channelname/123" }'
          });
        }

        const result = await resolveTelegramFile(inputUrl);
        const status = result.success ? 200 : (result.code === 'INVALID_LINK' ? 400 : 422);
        return sendJson(res, status, result);
      }

      // -----------------------------------------------------------------------
      // 3. GET /api/download/:token
      // -----------------------------------------------------------------------
      if (req.method === 'GET' && pathname.startsWith('/api/download/')) {
        const token = pathname.replace('/api/download/', '');
        if (!token) {
          return sendJson(res, 400, { error: 'Missing download token' });
        }
        return await handleDownloadStream(req, res, token);
      }

      // -----------------------------------------------------------------------
      // 404 Not Found
      // -----------------------------------------------------------------------
      return sendJson(res, 404, {
        error: 'ENDPOINT_NOT_FOUND',
        message: `Route '${pathname}' not found. Use POST /api/resolve to convert links into downloads.`
      });

    } catch (err) {
      console.error('[API Server Error]:', err);
      return sendJson(res, 500, {
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message
      });
    }
  });
}

module.exports = {
  createApiServer
};
