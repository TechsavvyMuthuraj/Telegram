// =============================================================================
// Techie Post Manager - Interactive Keyboard Menus
// Interactive button layout for @TechiePostManagerBot
// =============================================================================

/**
 * Main Interactive Menu (Inline Keyboard format)
 */
function getMainMenuInline() {
  return {
    inline_keyboard: [
      [
        { text: '📝 Create New Post', callback_data: 'menu:create_post' },
        { text: '🎨 Premium Text Designer', callback_data: 'menu:designer' }
      ],
      [
        { text: '📢 Announcement Creator', callback_data: 'menu:announcement' },
        { text: '🖼 Photo Post', callback_data: 'menu:photo_post' }
      ],
      [
        { text: '🎬 Video Post', callback_data: 'menu:video_post' },
        { text: '📁 File & Document Post', callback_data: 'menu:file_post' }
      ],
      [
        { text: '🔗 Link & Download Post', callback_data: 'menu:link_post' },
        { text: '👁 Preview Post', callback_data: 'menu:preview_post' }
      ],
      [
        { text: '🚀 Publish Post', callback_data: 'menu:publish_post' },
        { text: '📅 Schedule Post', callback_data: 'menu:schedule_post' }
      ],
      [
        { text: '📂 My Drafts', callback_data: 'menu:drafts' },
        { text: '🗂 Post Templates', callback_data: 'menu:templates' }
      ],
      [
        { text: '📣 Channel Manager', callback_data: 'menu:channels' },
        { text: '🤖 AI Content Assistant', callback_data: 'menu:ai_assistant' }
      ],
      [
        { text: '📊 Analytics', callback_data: 'menu:analytics' },
        { text: '⚙️ Settings', callback_data: 'menu:settings' }
      ],
      [
        { text: '🔐 Admin Panel', callback_data: 'menu:admin_panel' },
        { text: '❓ Help', callback_data: 'menu:help' }
      ]
    ]
  };
}

/**
 * Main Interactive Reply Keyboard (Persistent Chat Buttons)
 */
function getMainMenuReplyKeyboard() {
  return {
    keyboard: [
      [{ text: '📝 Create New Post' }, { text: '🎨 Premium Text Designer' }],
      [{ text: '📢 Announcement Creator' }, { text: '🖼 Photo Post' }],
      [{ text: '🎬 Video Post' }, { text: '📁 File & Document Post' }],
      [{ text: '🔗 Link & Download Post' }, { text: '👁 Preview Post' }],
      [{ text: '🚀 Publish Post' }, { text: '📅 Schedule Post' }],
      [{ text: '📂 My Drafts' }, { text: '🗂 Post Templates' }],
      [{ text: '📣 Channel Manager' }, { text: '🤖 AI Content Assistant' }],
      [{ text: '📊 Analytics' }, { text: '⚙️ Settings' }],
      [{ text: '🔐 Admin Panel' }, { text: '❓ Help' }]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
}

/**
 * Post Type Selection Submenu
 */
function getPostTypeKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '💬 Text Post', callback_data: 'type:text' },
        { text: '🖼 Photo with Caption', callback_data: 'type:photo' }
      ],
      [
        { text: '🎬 Video Post', callback_data: 'type:video' },
        { text: '📁 Document / APK / ZIP', callback_data: 'type:doc' }
      ],
      [
        { text: '🔗 Link & Buttons Post', callback_data: 'type:link_btn' },
        { text: '📢 Formatted Announcement', callback_data: 'type:announce' }
      ],
      [
        { text: '⬅️ Back to Main Menu', callback_data: 'nav:main_menu' }
      ]
    ]
  };
}

/**
 * Post Templates Selection Submenu
 */
function getTemplatesKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '⚡ Software Update', callback_data: 'tmpl:software' },
        { text: '📱 App Release', callback_data: 'tmpl:app' }
      ],
      [
        { text: '📥 Download Drop', callback_data: 'tmpl:download' },
        { text: '▶️ YouTube Upload', callback_data: 'tmpl:youtube' }
      ],
      [
        { text: '🌐 Website Launch', callback_data: 'tmpl:website' },
        { text: '🛠 Maintenance Notice', callback_data: 'tmpl:maint' }
      ],
      [
        { text: '📢 Announcement', callback_data: 'tmpl:announce' },
        { text: '📚 Tutorial Guide', callback_data: 'tmpl:tutorial' }
      ],
      [
        { text: '📋 Changelog', callback_data: 'tmpl:changelog' },
        { text: '🎁 Free Resource', callback_data: 'tmpl:resource' }
      ],
      [
        { text: '💼 Job Alert', callback_data: 'tmpl:job' },
        { text: '🎓 Exam Notification', callback_data: 'tmpl:exam' }
      ],
      [
        { text: '👥 Community Update', callback_data: 'tmpl:community' }
      ],
      [
        { text: '⬅️ Back to Main Menu', callback_data: 'nav:main_menu' }
      ]
    ]
  };
}

/**
 * Post Action Controls (Preview / Edit / Publish / Draft)
 */
function getPostActionKeyboard(hasDraft = true) {
  return {
    inline_keyboard: [
      [
        { text: '👁 Preview Post', callback_data: 'action:preview' },
        { text: '🚀 Publish Now', callback_data: 'action:publish_confirm' }
      ],
      [
        { text: '✏️ Edit Text', callback_data: 'action:edit_text' },
        { text: '🔘 Add Buttons', callback_data: 'action:add_buttons' }
      ],
      [
        { text: '📅 Schedule', callback_data: 'action:schedule' },
        { text: '💾 Save Draft', callback_data: 'action:save_draft' }
      ],
      [
        { text: '🗑️ Discard Draft', callback_data: 'action:discard_draft' },
        { text: '⬅️ Main Menu', callback_data: 'nav:main_menu' }
      ]
    ]
  };
}

/**
 * Channel Selector Keyboard
 */
function getChannelSelectorKeyboard(channelUsername = '@techiemuthuraj') {
  return {
    inline_keyboard: [
      [
        { text: `✅ Target: ${channelUsername}`, callback_data: 'channel:select_main' }
      ],
      [
        { text: '🔍 Check Bot Permissions', callback_data: 'channel:check_perms' },
        { text: '➕ Add Another Channel', callback_data: 'channel:add_new' }
      ],
      [
        { text: '⬅️ Back to Main Menu', callback_data: 'nav:main_menu' }
      ]
    ]
  };
}

module.exports = {
  getMainMenuInline,
  getMainMenuReplyKeyboard,
  getPostTypeKeyboard,
  getTemplatesKeyboard,
  getPostActionKeyboard,
  getChannelSelectorKeyboard
};
