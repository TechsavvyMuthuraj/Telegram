// =============================================================================
// Techie Post Manager - Configuration & Environment Integration
// Bot: @TechiePostManagerBot
// =============================================================================

require('dotenv').config();

const config = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '8782200110:AAERijk34maFtjIXC6DFaxTFUBs1SI5Q7fo',
  botUsername: process.env.TELEGRAM_BOT_USERNAME || 'TechiePostManagerBot',
  defaultChannelId: process.env.TELEGRAM_CHANNEL_ID || '@techiemuthuraj',
  portalUrl: process.env.PORTAL_URL || 'https://techsavvymuthuraj.dev/',
  
  // Authorized Admin Usernames & IDs
  adminUsernames: [
    'techiemuthuraj',
    'techiemuthurajofficial'
  ],
  adminChatIds: [
    // Can be dynamically expanded or learned from first admin /start
  ],

  // Bot Information
  botName: 'Techie Post Manager',
  version: '1.0.0',
  phase: 'Phase 1 - Architecture, Main Menu & Telegram Chat Interface'
};

module.exports = config;
