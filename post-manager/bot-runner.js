// =============================================================================
// Techie Post Manager - Standalone Bot Runner (Long Polling)
// Bot: @TechiePostManagerBot (id: 8782200110)
// Usage: node post-manager/bot-runner.js or npm run bot
// =============================================================================

require('dotenv').config();
const { callTelegramApi, sendTelegramMessage } = require('../netlify/functions/utils/telegram');
const postManager = require('./post-manager');
const config = require('./config');

let isRunning = true;
let lastUpdateId = 0;

async function initBot() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 Techie Post Manager Bot Engine Starting...');
  console.log(`📌 Bot Username: @${config.botUsername}`);
  console.log(`📢 Default Channel: ${config.defaultChannelId}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const me = await callTelegramApi('getMe');
    if (!me.ok) {
      throw new Error(`Failed to verify bot token: ${me.description}`);
    }
    console.log(`✅ Telegram Bot Verified: @${me.result.username} (ID: ${me.result.id})`);

    // Remove existing webhook so getUpdates works cleanly in polling mode
    const delWebhook = await callTelegramApi('deleteWebhook', { drop_pending_updates: false });
    console.log(`📡 Webhook status cleared for polling: ${delWebhook.ok ? 'SUCCESS' : 'SKIPPED'}`);

    console.log('🚀 Listening for incoming updates... (Press Ctrl+C to stop)');
    pollUpdates();
  } catch (err) {
    console.error('❌ Bot Initialization Error:', err.message);
  }
}

async function pollUpdates() {
  while (isRunning) {
    try {
      const response = await callTelegramApi('getUpdates', {
        offset: lastUpdateId + 1,
        timeout: 20,
        allowed_updates: ['message', 'callback_query', 'channel_post']
      });

      if (response && response.ok && Array.isArray(response.result)) {
        for (const update of response.result) {
          lastUpdateId = update.update_id;
          await processUpdate(update);
        }
      }
    } catch (err) {
      if (err.message && err.message.includes('ETIMEDOUT')) {
        // normal polling timeout, continue
      } else {
        console.warn('⚠️ Polling warning:', err.message);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
}

async function processUpdate(update) {
  try {
    // 1. Callback query
    if (update.callback_query) {
      console.log(`[BOT] Callback Query from @${update.callback_query.from?.username || update.callback_query.from?.id}: ${update.callback_query.data}`);
      await postManager.handleCallbackQuery(update.callback_query);
      return;
    }

    // 2. Message
    if (update.message) {
      const msg = update.message;
      const text = msg.text || '';
      console.log(`[BOT] Message from @${msg.from?.username || msg.from?.id}: ${text || '[Media]'}`);
      await postManager.handleTextMessage(msg);
      return;
    }
  } catch (err) {
    console.error('❌ Error processing update:', err.message);
  }
}

process.on('SIGINT', () => {
  console.log('\n🛑 Stopping Techie Post Manager bot...');
  isRunning = false;
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Terminating Techie Post Manager bot...');
  isRunning = false;
  process.exit(0);
});

if (require.main === module) {
  initBot();
}

module.exports = { initBot, processUpdate };
