// =============================================================================
// Telegram Direct File Downloader - Link & Post Parser
// Parses Telegram post URLs, private channel links, and Telegram Bot file IDs
// =============================================================================

/**
 * Parse any incoming Telegram link or file reference
 */
function parseTelegramLink(input) {
  if (!input || typeof input !== 'string') {
    return {
      valid: false,
      error: 'Please provide a non-empty Telegram post link or file reference.'
    };
  }

  const trimmed = input.trim();

  // 1. Direct Telegram Bot File ID (alphanumeric with underscores/hyphens, length >= 20, no slash, no dot)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed) && !trimmed.includes('/') && !trimmed.includes('.')) {
    return {
      valid: true,
      type: 'bot_file_id',
      fileId: trimmed,
      raw: trimmed
    };
  }

  // 2. Standard Public Channel Post: https://t.me/channelname/123 or t.me/channelname/123
  const publicMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{4,32})\/([0-9]+)/i);
  if (publicMatch) {
    const channelUsername = publicMatch[1];
    const messageId = parseInt(publicMatch[2], 10);

    // Filter out reserved paths like /s/ or /c/
    if (channelUsername.toLowerCase() !== 'c' && channelUsername.toLowerCase() !== 's' && channelUsername.toLowerCase() !== 'joinchat') {
      return {
        valid: true,
        type: 'channel_post',
        channelUsername: `@${channelUsername}`,
        cleanChannel: channelUsername,
        messageId,
        embedUrl: `https://t.me/${channelUsername}/${messageId}?embed=1`,
        previewUrl: `https://t.me/s/${channelUsername}/${messageId}`,
        raw: trimmed
      };
    }
  }

  // 3. Public Web Channel Post: https://t.me/s/channelname/123
  const sMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/s\/([a-zA-Z0-9_]{4,32})\/([0-9]+)/i);
  if (sMatch) {
    const channelUsername = sMatch[1];
    const messageId = parseInt(sMatch[2], 10);
    return {
      valid: true,
      type: 'channel_post',
      channelUsername: `@${channelUsername}`,
      cleanChannel: channelUsername,
      messageId,
      embedUrl: `https://t.me/${channelUsername}/${messageId}?embed=1`,
      previewUrl: `https://t.me/s/${channelUsername}/${messageId}`,
      raw: trimmed
    };
  }

  // 4. Private Channel Link: https://t.me/c/1234567890/123
  const privateMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/c\/([0-9]+)\/([0-9]+)/i);
  if (privateMatch) {
    const internalChatId = privateMatch[1];
    const messageId = parseInt(privateMatch[2], 10);
    const standardChatId = `-100${internalChatId}`;

    return {
      valid: true,
      type: 'private_channel_post',
      isPrivate: true,
      chatId: standardChatId,
      messageId,
      raw: trimmed
    };
  }

  // 5. Generic direct web URL containing downloadable file
  if (/^https?:\/\//i.test(trimmed)) {
    return {
      valid: true,
      type: 'direct_url',
      url: trimmed,
      raw: trimmed
    };
  }

  return {
    valid: false,
    error: 'Unsupported link format. Expected format: https://t.me/channelname/123 or a Telegram file ID.',
    raw: trimmed
  };
}

module.exports = {
  parseTelegramLink
};
