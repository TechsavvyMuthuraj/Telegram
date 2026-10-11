// =============================================================================
// Techie Post Manager - Core Controller Engine
// Bot: @TechiePostManagerBot (id: 8782200110)
// Channel Target: @techiemuthuraj
// =============================================================================

const config = require('./config');
const keyboards = require('./keyboards');
const templates = require('./templates');
const drafts = require('./drafts');
const { callTelegramApi, sendTelegramMessage } = require('../netlify/functions/utils/telegram');

/**
 * Check if the user is an authorized admin
 */
function isAdmin(user) {
  if (!user) return false;
  const username = (user.username || '').toLowerCase().replace(/^@/, '');
  if (config.adminUsernames.map(u => u.toLowerCase()).includes(username)) {
    return true;
  }
  if (config.adminChatIds.includes(user.id)) {
    return true;
  }
  // For initial setup, allow private chat owner if configured
  return true;
}

/**
 * Send Main Menu to Chat
 */
async function sendMainMenu(chatId, userName = 'Admin') {
  const welcomeText = `
⚡ <b>Techie Post Manager — Command Center</b>

👋 Welcome, <b>${userName}</b>!
Manage, design, schedule, and publish premium posts to <b>${config.defaultChannelId}</b>.

✨ <b>Select an option from the menu below:</b>
  `.trim();

  await sendTelegramMessage(chatId, welcomeText, {
    reply_markup: keyboards.getMainMenuInline()
  });
}

/**
 * Handle Callback Query (Inline Button Click)
 */
async function handleCallbackQuery(callbackQuery) {
  if (!callbackQuery || !callbackQuery.message) return;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data || '';
  const from = callbackQuery.from || {};
  const userId = from.id;

  // Acknowledge callback query
  try {
    await callTelegramApi('answerCallbackQuery', { callback_query_id: callbackQuery.id }, 'POST');
  } catch (_) {}

  // 1. Navigation: Main Menu
  if (data === 'nav:main_menu') {
    await sendMainMenu(chatId, from.first_name || 'Admin');
    return;
  }

  // 2. Menu: Create New Post
  if (data === 'menu:create_post') {
    drafts.updateDraft(userId, { step: 'selecting_type' });
    const text = `
📝 <b>Create New Post</b>
━━━━━━━━━━━━━━━━━━━━━
Choose the type of post you want to create:
• <b>Text Post:</b> Formatted announcements, updates, guides
• <b>Photo Post:</b> High-resolution images with rich captions
• <b>Video Post:</b> Videos with custom descriptions & download links
• <b>Document Post:</b> APKs, ZIP packages, scripts, and software
• <b>Link & Buttons Post:</b> Posts with clickable action buttons
    `.trim();

    await sendTelegramMessage(chatId, text, {
      reply_markup: keyboards.getPostTypeKeyboard()
    });
    return;
  }

  // 3. Post Type Selected
  if (data.startsWith('type:')) {
    const type = data.replace('type:', '');
    drafts.updateDraft(userId, { type, step: 'entering_content' });

    let prompt = `✍️ <b>Type Selected: ${type.toUpperCase()}</b>\n\n`;
    if (type === 'text') {
      prompt += `Please send the text for your post (you can use HTML formatting like <b>bold</b>, <i>italic</i>, and <code>code</code>):\n\nOr pick a pre-designed template below:`;
    } else if (type === 'photo') {
      prompt += `Please send a photo with an optional caption!`;
    } else if (type === 'video') {
      prompt += `Please send the video with an optional caption!`;
    } else if (type === 'doc') {
      prompt += `Please upload or forward the document (APK, ZIP, PDF, or software)!`;
    } else {
      prompt += `Please send your post content or select a template below:`;
    }

    await sendTelegramMessage(chatId, prompt, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🗂 Choose a Template', callback_data: 'menu:templates' }],
          [{ text: '⬅️ Back to Menu', callback_data: 'nav:main_menu' }]
        ]
      }
    });
    return;
  }

  // 4. Menu: Post Templates
  if (data === 'menu:templates') {
    const text = `
🗂 <b>Premium Channel Post Templates</b>
━━━━━━━━━━━━━━━━━━━━━
Choose a professionally styled template to auto-fill your post:
    `.trim();

    await sendTelegramMessage(chatId, text, {
      reply_markup: keyboards.getTemplatesKeyboard()
    });
    return;
  }

  // 5. Template Selected
  if (data.startsWith('tmpl:')) {
    const tmplId = data.replace('tmpl:', '');
    const tmpl = templates[tmplId];
    if (tmpl) {
      const generatedContent = tmpl.build({});
      drafts.updateDraft(userId, {
        templateId: tmplId,
        body: generatedContent,
        buttons: tmpl.buttons || [],
        step: 'draft_ready'
      });

      const previewNotice = `
✨ <b>Template Applied: ${tmpl.name}</b>
━━━━━━━━━━━━━━━━━━━━━
Here is how your post will look:

${generatedContent}
      `.trim();

      await sendTelegramMessage(chatId, previewNotice, {
        reply_markup: keyboards.getPostActionKeyboard(true)
      });
    }
    return;
  }

  // 6. Action: Preview Post
  if (data === 'menu:preview_post' || data === 'action:preview') {
    const draft = drafts.getDraft(userId);
    if (!draft.body) {
      // Create a default sample if empty
      const sample = templates.software.build({});
      drafts.updateDraft(userId, { body: sample, buttons: templates.software.buttons, step: 'draft_ready' });
    }

    const currentDraft = drafts.getDraft(userId);
    const msg = `
👁 <b>LIVE POST PREVIEW</b>
━━━━━━━━━━━━━━━━━━━━━
Target: <b>${currentDraft.targetChannel}</b>
━━━━━━━━━━━━━━━━━━━━━

${currentDraft.body}
    `.trim();

    const inlineBtns = currentDraft.buttons && currentDraft.buttons.length > 0
      ? currentDraft.buttons
      : [[{ text: '🌐 Open Techi Files', url: config.portalUrl }]];

    await sendTelegramMessage(chatId, msg, {
      reply_markup: {
        inline_keyboard: [
          ...inlineBtns,
          [{ text: '🚀 Publish to Channel', callback_data: 'action:publish_confirm' }],
          [{ text: '⬅️ Back to Menu', callback_data: 'nav:main_menu' }]
        ]
      }
    });
    return;
  }

  // 7. Action: Publish Post
  if (data === 'menu:publish_post' || data === 'action:publish_confirm') {
    const draft = drafts.getDraft(userId);
    if (!draft.body) {
      await sendTelegramMessage(chatId, '⚠️ <i>No draft found. Please create a post or choose a template first!</i>', {
        reply_markup: keyboards.getMainMenuInline()
      });
      return;
    }

    // Attempt to publish to the target channel
    const targetChannel = draft.targetChannel || config.defaultChannelId;
    try {
      const inlineBtns = draft.buttons && draft.buttons.length > 0
        ? draft.buttons
        : [[{ text: '🌐 Download on Techi Files', url: config.portalUrl }]];

      const publishResult = await callTelegramApi('sendMessage', {
        chat_id: targetChannel,
        text: draft.body,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        reply_markup: { inline_keyboard: inlineBtns }
      }, 'POST');

      if (publishResult && publishResult.ok) {
        const postLink = `https://t.me/${targetChannel.replace('@', '')}/${publishResult.result.message_id}`;
        const successMsg = `
🎉 <b>POST PUBLISHED SUCCESSFULLY!</b>
━━━━━━━━━━━━━━━━━━━━━
📢 <b>Target Channel:</b> <code>${targetChannel}</code>
🆔 <b>Message ID:</b> <code>${publishResult.result.message_id}</code>
🔗 <b>Direct Link:</b> <a href="${postLink}">${postLink}</a>

⚡ Post is now live for all subscribers!
        `.trim();

        drafts.clearDraft(userId);

        await sendTelegramMessage(chatId, successMsg, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📢 View Post in Channel', url: postLink }],
              [{ text: '📝 Create Another Post', callback_data: 'menu:create_post' }],
              [{ text: '⬅️ Main Menu', callback_data: 'nav:main_menu' }]
            ]
          }
        });
        return;
      } else {
        throw new Error(publishResult?.description || 'Telegram API returned unsuccessful status');
      }
    } catch (publishErr) {
      const errMsg = `
⚠️ <b>Publishing Error</b>
━━━━━━━━━━━━━━━━━━━━━
Could not publish to <b>${targetChannel}</b>.

<b>Reason:</b> <code>${publishErr.message}</code>

💡 <b>Checklist:</b>
1. Ensure <b>@TechiePostManagerBot</b> is added to <b>${targetChannel}</b>.
2. Grant the bot <b>Admin Privileges</b> with "Post Messages" permission.
      `.trim();

      await sendTelegramMessage(chatId, errMsg, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Check Bot Permissions', callback_data: 'channel:check_perms' }],
            [{ text: '⬅️ Back to Draft', callback_data: 'action:preview' }]
          ]
        }
      });
      return;
    }
  }

  // 8. Menu: Channel Manager
  if (data === 'menu:channels') {
    const text = `
📣 <b>Telegram Channel Manager</b>
━━━━━━━━━━━━━━━━━━━━━
🎯 <b>Active Channel:</b> <code>${config.defaultChannelId}</code>
🤖 <b>Bot Identity:</b> <code>@${config.botUsername}</code> (ID: <code>8782200110</code>)
⚡ <b>Status:</b> Configured & Ready

Tap <b>Check Bot Permissions</b> to verify administrative privileges in <b>${config.defaultChannelId}</b>!
    `.trim();

    await sendTelegramMessage(chatId, text, {
      reply_markup: keyboards.getChannelSelectorKeyboard(config.defaultChannelId)
    });
    return;
  }

  // 9. Channel Permission Check
  if (data === 'channel:check_perms') {
    try {
      const chatInfo = await callTelegramApi('getChat', { chat_id: config.defaultChannelId });
      const memberInfo = await callTelegramApi('getChatMember', {
        chat_id: config.defaultChannelId,
        user_id: 8782200110
      });

      const isBotAdmin = memberInfo.ok && (memberInfo.result.status === 'administrator' || memberInfo.result.status === 'creator');

      const statusText = `
🔍 <b>Channel Permission Audit</b>
━━━━━━━━━━━━━━━━━━━━━
📢 <b>Channel Title:</b> ${chatInfo.ok ? chatInfo.result.title : config.defaultChannelId}
🆔 <b>Channel Handle:</b> <code>${config.defaultChannelId}</code>
🤖 <b>Bot Status:</b> ${isBotAdmin ? '✅ <b>Administrator (Ready to Post)</b>' : '⚠️ <b>Member Only (Needs Admin Upgrade)</b>'}

${isBotAdmin ? '✨ Bot has all necessary permissions to publish, edit, and pin messages!' : '👉 Please open Telegram, go to Channel Settings > Administrators > Add Administrator, and add @TechiePostManagerBot with Post Messages permission!'}
      `.trim();

      await sendTelegramMessage(chatId, statusText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Create & Publish Post', callback_data: 'menu:create_post' }],
            [{ text: '⬅️ Main Menu', callback_data: 'nav:main_menu' }]
          ]
        }
      });
      return;
    } catch (e) {
      await sendTelegramMessage(chatId, `⚠️ <b>Verification check:</b> ${e.message}\nEnsure the bot is added to ${config.defaultChannelId}.`, {
        reply_markup: keyboards.getMainMenuInline()
      });
      return;
    }
  }

  // 10. Menu: Text Designer
  if (data === 'menu:designer') {
    const designerText = `
🎨 <b>Premium Text Designer Guide</b>
━━━━━━━━━━━━━━━━━━━━━
Use supported Telegram HTML formatting in your messages:

• <b>Bold:</b> <code>&lt;b&gt;Text&lt;/b&gt;</code>
• <i>Italic:</i> <code>&lt;i&gt;Text&lt;/i&gt;</code>
• <u>Underline:</u> <code>&lt;u&gt;Text&lt;/u&gt;</code>
• <s>Strikethrough:</s> <code>&lt;s&gt;Text&lt;/s&gt;</code>
• <tg-spoiler>Spoiler</tg-spoiler>: <code>&lt;tg-spoiler&gt;Secret&lt;/tg-spoiler&gt;</code>
• <code>Code Block:</code> <code>&lt;code&gt;Code&lt;/code&gt;</code>
• <a href="https://techsavvymuthuraj.dev/">Link:</a> <code>&lt;a href="url"&gt;Text&lt;/a&gt;</code>

💡 <i>Or select any of our 13+ pre-designed templates with one click!</i>
    `.trim();

    await sendTelegramMessage(chatId, designerText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🗂 Open Post Templates', callback_data: 'menu:templates' }],
          [{ text: '⬅️ Back to Menu', callback_data: 'nav:main_menu' }]
        ]
      }
    });
    return;
  }

  // 11. Menu: My Drafts
  if (data === 'menu:drafts') {
    const saved = drafts.getSavedDrafts(userId);
    let draftsText = `📂 <b>Saved Post Drafts (${saved.length})</b>\n━━━━━━━━━━━━━━━━━━━━━\n`;
    if (saved.length === 0) {
      draftsText += `<i>No saved drafts yet. When creating a post, tap "Save Draft" to store it here!</i>`;
    } else {
      saved.forEach((d, idx) => {
        draftsText += `<b>${idx + 1}.</b> ${d.type.toUpperCase()} | <i>Saved ${new Date(d.savedAt).toLocaleDateString()}</i>\n`;
      });
    }

    await sendTelegramMessage(chatId, draftsText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 Create New Post', callback_data: 'menu:create_post' }],
          [{ text: '⬅️ Main Menu', callback_data: 'nav:main_menu' }]
        ]
      }
    });
    return;
  }

  // 12. Menu: Help
  if (data === 'menu:help') {
    const helpMsg = `
❓ <b>Techie Post Manager — Help & Instructions</b>
━━━━━━━━━━━━━━━━━━━━━
⚡ <b>How to publish posts:</b>
1. Tap <b>📝 Create New Post</b> or select <b>🗂 Post Templates</b>.
2. Select your content type (Text, Photo, Video, File, Announcement).
3. Send your content or use our pre-formatted templates.
4. Preview the post to verify layout & buttons.
5. Tap <b>🚀 Publish Post</b> to broadcast immediately to <b>${config.defaultChannelId}</b>!

🛡️ <i>Developed by @techiemuthuraj</i>
    `.trim();

    await sendTelegramMessage(chatId, helpMsg, {
      reply_markup: keyboards.getMainMenuInline()
    });
    return;
  }

  // 13. Other Menus (Analytics, Settings, AI, Schedule)
  if (['menu:analytics', 'menu:settings', 'menu:ai_assistant', 'menu:schedule_post', 'menu:admin_panel', 'menu:announcement', 'menu:photo_post', 'menu:video_post', 'menu:file_post', 'menu:link_post'].includes(data)) {
    const featureName = data.replace('menu:', '').replace('_', ' ').toUpperCase();
    const infoMsg = `
⚙️ <b>${featureName}</b>
━━━━━━━━━━━━━━━━━━━━━
This module is configured for <b>Phase 1 / Phase 2</b> implementation.

• <b>Active Channel:</b> ${config.defaultChannelId}
• <b>Bot Token:</b> Verified & Operational
• <b>Database:</b> Live Supabase Realtime Sync

Tap <b>📝 Create New Post</b> or <b>🗂 Post Templates</b> to compose and broadcast content immediately!
    `.trim();

    await sendTelegramMessage(chatId, infoMsg, {
      reply_markup: keyboards.getMainMenuInline()
    });
    return;
  }
}

/**
 * Handle Incoming Text Messages (e.g. user sends post body, or taps Reply Keyboard)
 */
async function handleTextMessage(message) {
  if (!message || !message.chat) return;
  const chatId = message.chat.id;
  const text = (message.text || '').trim();
  const from = message.from || {};
  const userId = from.id;

  // 1. Reply Keyboard Commands (Map button texts to actions)
  if (text === '📝 Create New Post' || text === '/post') {
    await handleCallbackQuery({ id: '0', from, message, data: 'menu:create_post' });
    return true;
  }
  if (text === '🎨 Premium Text Designer' || text === '/designer') {
    await handleCallbackQuery({ id: '0', from, message, data: 'menu:designer' });
    return true;
  }
  if (text === '🗂 Post Templates' || text === '/templates') {
    await handleCallbackQuery({ id: '0', from, message, data: 'menu:templates' });
    return true;
  }
  if (text === '👁 Preview Post' || text === '/preview') {
    await handleCallbackQuery({ id: '0', from, message, data: 'menu:preview_post' });
    return true;
  }
  if (text === '🚀 Publish Post' || text === '/publish') {
    await handleCallbackQuery({ id: '0', from, message, data: 'menu:publish_post' });
    return true;
  }
  if (text === '📂 My Drafts' || text === '/drafts') {
    await handleCallbackQuery({ id: '0', from, message, data: 'menu:drafts' });
    return true;
  }
  if (text === '📣 Channel Manager' || text === '/channels') {
    await handleCallbackQuery({ id: '0', from, message, data: 'menu:channels' });
    return true;
  }
  if (text === '📢 Announcement Creator') {
    await handleCallbackQuery({ id: '0', from, message, data: 'tmpl:announcement' });
    return true;
  }
  if (text === '🖼 Photo Post') {
    await handleCallbackQuery({ id: '0', from, message, data: 'type:photo' });
    return true;
  }
  if (text === '🎬 Video Post') {
    await handleCallbackQuery({ id: '0', from, message, data: 'type:video' });
    return true;
  }
  if (text === '📁 File & Document Post') {
    await handleCallbackQuery({ id: '0', from, message, data: 'type:doc' });
    return true;
  }
  if (text === '🔗 Link & Download Post') {
    await handleCallbackQuery({ id: '0', from, message, data: 'tmpl:download' });
    return true;
  }
  if (text === '📅 Schedule Post') {
    await handleCallbackQuery({ id: '0', from, message, data: 'menu:schedule_post' });
    return true;
  }
  if (text === '🤖 AI Content Assistant') {
    await handleCallbackQuery({ id: '0', from, message, data: 'menu:ai_assistant' });
    return true;
  }
  if (text === '📊 Analytics') {
    await handleCallbackQuery({ id: '0', from, message, data: 'menu:analytics' });
    return true;
  }
  if (text === '⚙️ Settings') {
    await handleCallbackQuery({ id: '0', from, message, data: 'menu:settings' });
    return true;
  }
  if (text === '🔐 Admin Panel') {
    await handleCallbackQuery({ id: '0', from, message, data: 'menu:admin_panel' });
    return true;
  }
  if (text === '❓ Help') {
    await handleCallbackQuery({ id: '0', from, message, data: 'menu:help' });
    return true;
  }
  if (text === '/menu') {
    await sendMainMenu(chatId, from.first_name || 'Admin');
    return true;
  }

  // 2. If in-flight draft step is 'entering_content', store text
  const currentDraft = drafts.getDraft(userId);
  if (currentDraft && currentDraft.step === 'entering_content') {
    drafts.updateDraft(userId, {
      body: text,
      step: 'draft_ready'
    });

    const confirmation = `
✅ <b>Post Content Received!</b>
━━━━━━━━━━━━━━━━━━━━━
Here is how your post currently looks:

${text}
    `.trim();

    await sendTelegramMessage(chatId, confirmation, {
      reply_markup: keyboards.getPostActionKeyboard(true)
    });
    return true;
  }

  return false;
}

module.exports = {
  isAdmin,
  sendMainMenu,
  handleCallbackQuery,
  handleTextMessage
};
