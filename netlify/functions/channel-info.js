// =============================================================================
// Netlify Function: channel-info.js
// Public Telegram Channel Community Statistics & Member Details API
// =============================================================================

const { getSecurityHeaders } = require('./utils/auth-middleware');

let cache = {
  data: null,
  expiresAt: 0
};

exports.handler = async (event, context) => {
  const headers = getSecurityHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Check in-memory cache (2-minute TTL to prevent Telegram API rate limits)
  const now = Date.now();
  if (cache.data && now < cache.expiresAt) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(cache.data)
    };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const rawChannel = process.env.TELEGRAM_CHANNEL_ID || '@techiemuthuraj';
  const channelId = rawChannel.startsWith('@') ? rawChannel : `@${rawChannel}`;

  // Default fallback information if Telegram API is unreachable or unconfigured
  let channelData = {
    success: true,
    channel: {
      title: 'Techie Muthuraj | Tech Updates',
      username: 'techiemuthuraj',
      handle: '@techiemuthuraj',
      member_count: 78,
      member_count_display: '78+ Active Community Members',
      description: '🚀 Tech Updates • AI • Apps • Software • Tips\n💻 Latest tech news, tools & useful resources\n🤖 AI Tools | Android | Windows | Web | Tutorials\n⚡ Stay Updated. Stay @techiemuthuraj',
      invite_link: 'https://t.me/techiemuthuraj',
      verified: true,
      perks: [
        { icon: '🔑', label: 'VIP Access Tokens', desc: 'Single & multi-use access tokens for gapped files' },
        { icon: '⚡', label: 'Daily Releases', desc: 'Fresh tools, APK modifications & developer utilities' },
        { icon: '🛡️', label: 'VirusTotal Clean', desc: 'All published releases verified and malware-free' },
        { icon: '🚀', label: 'Zero Speed Limits', desc: 'Direct downloads with signed high-speed tickets' }
      ],
      socials: {
        telegram: 'https://t.me/techiemuthuraj',
        youtube: 'https://youtube.com/@techiemuthuraj',
        instagram: 'https://instagram.com/techiemuthuraj'
      },
      cached_at: new Date().toISOString()
    }
  };

  if (token && channelId) {
    try {
      // 1. Fetch Chat Profile & Description
      const chatRes = await fetch(
        `https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(channelId)}`
      ).then(r => r.json());

      // 2. Fetch Live Member Count
      const countRes = await fetch(
        `https://api.telegram.org/bot${token}/getChatMemberCount?chat_id=${encodeURIComponent(channelId)}`
      ).then(r => r.json());

      if (chatRes && chatRes.ok && chatRes.result) {
        const c = chatRes.result;
        channelData.channel.title = c.title || channelData.channel.title;
        channelData.channel.username = c.username || 'techiemuthuraj';
        channelData.channel.handle = `@${c.username || 'techiemuthuraj'}`;
        channelData.channel.description = c.description || channelData.channel.description;
        channelData.channel.invite_link = c.invite_link || `https://t.me/${c.username || 'techiemuthuraj'}`;
      }

      if (countRes && countRes.ok && typeof countRes.result === 'number') {
        const count = countRes.result;
        channelData.channel.member_count = count;
        channelData.channel.member_count_display = `${count.toLocaleString()}+ Active Members`;
      }
    } catch (err) {
      console.warn('[channel-info] Telegram API query failed, using resilient fallback:', err.message);
    }
  }

  // Update in-memory cache for 120 seconds
  cache = {
    data: channelData,
    expiresAt: now + 120000
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(channelData)
  };
};
