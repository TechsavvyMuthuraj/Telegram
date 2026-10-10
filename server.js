// =============================================================================
// Techi Files - Local Development & Production Server
// Serves /public and mounts Netlify Functions at /.netlify/functions/* & /api/*
// =============================================================================

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8888;
const PUBLIC_DIR = path.join(__dirname, 'public');
const FUNCTIONS_DIR = path.join(__dirname, 'netlify', 'functions');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Function handler loader with hot-reloading for dev environment
function getFunctionHandler(funcName) {
  const modPath = path.join(FUNCTIONS_DIR, `${funcName}.js`);
  if (!fs.existsSync(modPath)) return null;
  try {
    // Reload environment variables so live edits in .env take effect immediately
    require('dotenv').config({ override: true });

    // Clear require cache for functions and utils
    Object.keys(require.cache).forEach(cacheKey => {
      if (cacheKey.includes(path.join('netlify', 'functions'))) {
        delete require.cache[cacheKey];
      }
    });

    return require(modPath).handler;
  } catch (err) {
    console.error(`[Server] Failed to load function '${funcName}':`, err.message);
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = reqUrl.pathname;
  const parsedQuery = Object.fromEntries(reqUrl.searchParams.entries());

  // ---------------------------------------------------------------------------
  // Check for Serverless Function Routing
  // Supports both /.netlify/functions/<name> and /api/<name>
  // ---------------------------------------------------------------------------
  let funcName = null;
  if (pathname.startsWith('/.netlify/functions/')) {
    funcName = pathname.replace('/.netlify/functions/', '').split('/')[0];
  } else if (pathname.startsWith('/api/')) {
    funcName = pathname.replace('/api/', '').split('/')[0];
  }

  if (funcName) {
    const handler = getFunctionHandler(funcName);
    if (handler) {
      // Collect body
      let bodyData = '';
      req.on('data', chunk => { bodyData += chunk; });
      req.on('end', async () => {
        const event = {
          httpMethod: req.method,
          path: req.url,
          headers: req.headers,
          queryStringParameters: parsedQuery,
          body: bodyData || null
        };

        try {
          const result = await handler(event, {});
          const status = result.statusCode || 200;
          const headers = result.headers || {};

          if (result.isBase64Encoded && result.body) {
            const buf = Buffer.from(result.body, 'base64');
            headers['Content-Length'] = buf.length.toString();
            res.writeHead(status, headers);
            res.end(buf);
          } else {
            res.writeHead(status, headers);
            res.end(result.body || '');
          }
        } catch (err) {
          console.error(`Error executing function ${funcName}:`, err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Function Execution Failed', message: err.message }));
        }
      });
      return;
    }
  }

  // ---------------------------------------------------------------------------
  // Static File Serving
  // ---------------------------------------------------------------------------
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  // If file doesn't exist, check with .html extension
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>404 Not Found - techiemuthuraj Files</title>
        <style>body{background:#0a0c10;color:#f0f6fc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
        .box{text-align:center;padding:2rem;background:#161b22;border:1px solid #30363d;border-radius:12px;}a{color:#58a6ff;}</style></head>
        <body><div class="box"><h1>404 Not Found</h1><p>The requested page <code>${pathname}</code> was not found.</p><a href="/">Return to Home</a></div></body>
        </html>
      `);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`
=============================================================================
⚡ Techi Files - Production Server
=============================================================================
  🌐 Public Portal       : http://localhost:${PORT}/
  📁 File Details Page   : http://localhost:${PORT}/file.html?id=TM-APK-901
  🛡️ Admin Dashboard     : http://localhost:${PORT}/admin.html
  🔌 Telegram Webhook    : http://localhost:${PORT}/api/telegram-webhook
  ⚡ Netlify API Base    : http://localhost:${PORT}/api/files
=============================================================================
`);
});
