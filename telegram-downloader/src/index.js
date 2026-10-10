// =============================================================================
// Telegram Direct File Downloader - Main Service Entry Point
// Starts API Server and Telegram Bot Command Listener
// =============================================================================

const { config } = require('./config');
const { createApiServer } = require('./api-server');
const { startBotPolling, stopBotPolling } = require('./bot-service');
const { getMe } = require('./telegram-api');

async function main() {
  console.log(`
=============================================================================
⚡ TELEGRAM DIRECT FILE DOWNLOADER SERVICE (NODE.JS)
=============================================================================
  Service Mode  : REST API & Telegram Bot Command Engine
  HTTP Port     : ${config.port}
  Base URL      : ${config.baseUrl}
  MIME Support  : APK, ZIP, PDF, Video, Audio, Documents, Images
  Stream Engine : Direct Chunked Streaming (Zero Local Storage)
=============================================================================
  `);

  // 1. Verify Bot Token Connection
  if (config.botToken) {
    try {
      const me = await getMe();
      if (me.ok) {
        console.log(`[Telegram Bot] Connected successfully: @${me.result.username} (${me.result.first_name})`);
      } else {
        console.warn(`[Telegram Bot] Warning: Unable to verify bot (@${config.botUsername})`);
      }
    } catch (err) {
      console.warn(`[Telegram Bot] Warning: ${err.message}`);
    }
  } else {
    console.warn('[Telegram Bot] TELEGRAM_BOT_TOKEN is not set. Bot features will be disabled.');
  }

  // 2. Start HTTP API Server
  const server = createApiServer();
  server.listen(config.port, () => {
    console.log(`[API Server] Running at: ${config.baseUrl}`);
    console.log(`  • Resolve Post Link : POST ${config.baseUrl}/api/resolve`);
    console.log(`  • Direct Stream URL : GET  ${config.baseUrl}/api/download/:token`);
    console.log(`  • Health Status     : GET  ${config.baseUrl}/api/status`);
    console.log('-------------------------------------------------------------');
  });

  // 3. Start Bot Poller in Background
  if (config.botToken && !process.env.DISABLE_BOT_POLLER) {
    startBotPolling().catch(err => {
      console.error('[Bot Service] Error during polling:', err.message);
    });
  }

  // 4. Graceful Shutdown Handlers
  const shutdown = () => {
    console.log('\n[Shutdown] Shutting down Telegram Downloader service...');
    stopBotPolling();
    server.close(() => {
      console.log('[Shutdown] HTTP Server terminated.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  });
}

module.exports = { main };
