// =============================================================================
// Techie Post Manager - Premium Channel Post Templates
// Pre-crafted, beautifully formatted Telegram HTML templates
// =============================================================================

const templates = {
  software: {
    id: 'software',
    name: '⚡ Software Update',
    badge: 'NEW UPDATE',
    build: ({ title = 'New Software Release', version = 'v2.4.0', details = '', downloadUrl = 'https://techsavvymuthuraj.dev/' }) => `
🚀 <b>SOFTWARE UPDATE: ${title}</b>
━━━━━━━━━━━━━━━━━━━━━
🏷️ <b>Version:</b> <code>${version}</code>
📅 <b>Release Date:</b> <code>${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</code>
🛡️ <b>Security Scan:</b> <code>100% Clean / Verified</code>

✨ <b>What's New in this Build:</b>
${details || '• Enhanced performance and startup speed\n• Fixed minor bugs and improved memory management\n• New modern UI improvements'}

📥 <b>Direct Download & Access Token:</b>
👉 <a href="${downloadUrl}">Claim Download on Techi Files</a>

━━━━━━━━━━━━━━━━━━━━━
⚡ <i>Stay Updated with @techiemuthuraj</i>
    `.trim(),
    buttons: [
      [{ text: '⬇️ Download Now', url: 'https://techsavvymuthuraj.dev/' }],
      [{ text: '💬 Join Discussion', url: 'https://t.me/techiemuthuraj' }]
    ]
  },

  app: {
    id: 'app',
    name: '📱 Application Release (APK / Mobile)',
    badge: 'APP RELEASE',
    build: ({ title = 'TurboSpeed Optimizer Pro', version = 'v4.5.1', size = '14.8 MB', downloadUrl = 'https://techsavvymuthuraj.dev/' }) => `
🔥 <b>EXCLUSIVE APP RELEASE</b>
━━━━━━━━━━━━━━━━━━━━━
📦 <b>App:</b> <b>${title}</b>
🏷️ <b>Version:</b> <code>${version}</code>
📊 <b>Size:</b> <code>${size}</code>
🛡️ <b>Status:</b> <code>Ad-Free / Pre-Scanned</code>

🎯 <b>Key Features:</b>
• Ultra-fast execution with zero background drain
• Modern dark cyber interface
• All premium features unlocked

📥 <b>Download & Token Access:</b>
👉 <a href="${downloadUrl}">Get APK on Techi Files</a>

━━━━━━━━━━━━━━━━━━━━━
⚡ <i>Published by @techiemuthuraj</i>
    `.trim(),
    buttons: [
      [{ text: '📥 Direct Download', url: 'https://techsavvymuthuraj.dev/' }],
      [{ text: '✈️ Official Channel', url: 'https://t.me/techiemuthuraj' }]
    ]
  },

  download: {
    id: 'download',
    name: '📥 Download Announcement',
    badge: 'DOWNLOAD DROP',
    build: ({ title = 'Developer Utility Suite 2026', code = 'TM-TOOL-771', downloadUrl = 'https://techsavvymuthuraj.dev/' }) => `
⚡ <b>NEW FILE DROP: TOKEN-GATED DOWNLOAD</b>
━━━━━━━━━━━━━━━━━━━━━
📁 <b>Resource:</b> <b>${title}</b>
🔑 <b>File Code:</b> <code>${code}</code>
🟢 <b>Access Level:</b> <code>VIP Channel Member</code>

💡 <b>Instructions:</b>
1. Tap the link below to open Techi Files.
2. Enter your authorized member token.
3. Enjoy direct, atomic high-speed download!

👉 <b><a href="${downloadUrl}">Unlock Download Now</a></b>

━━━━━━━━━━━━━━━━━━━━━
🛡️ <i>Protected by Cryptographic Checksums</i>
    `.trim(),
    buttons: [
      [{ text: '🔑 Unlock File on Web', url: 'https://techsavvymuthuraj.dev/' }]
    ]
  },

  youtube: {
    id: 'youtube',
    name: '▶️ YouTube Video Upload',
    badge: 'NEW VIDEO',
    build: ({ title = 'Complete Full-Stack Web App Tutorial', videoUrl = 'https://youtube.com/@techiemuthuraj' }) => `
🎬 <b>NEW VIDEO IS LIVE ON YOUTUBE!</b>
━━━━━━━━━━━━━━━━━━━━━
📺 <b>Title:</b> <b>${title}</b>
👤 <b>Creator:</b> <b>Techie Muthuraj</b>

💡 <i>In this video, we dive deep into practical steps, configuration tips, and full source code walk-throughs!</i>

👉 <b>Watch Now:</b> <a href="${videoUrl}">${videoUrl}</a>

👍 <i>Like, Share, and Subscribe for daily tech updates!</i>
━━━━━━━━━━━━━━━━━━━━━
🔔 <i>Turn on channel notifications!</i>
    `.trim(),
    buttons: [
      [{ text: '▶️ Watch Video', url: 'https://youtube.com/@techiemuthuraj' }],
      [{ text: '🔔 Subscribe', url: 'https://youtube.com/@techiemuthuraj' }]
    ]
  },

  website: {
    id: 'website',
    name: '🌐 Website Launch',
    badge: 'WEBSITE LAUNCH',
    build: ({ title = 'Techi Files Web Portal', url = 'https://techsavvymuthuraj.dev/' }) => `
🚀 <b>OFFICIAL WEBSITE ANNOUNCEMENT</b>
━━━━━━━━━━━━━━━━━━━━━
🌐 <b>Portal:</b> <b>${title}</b>
🔗 <b>URL:</b> <a href="${url}">${url}</a>

⚡ <b>Highlights:</b>
• Token-gated digital download infrastructure
• Real-time Telegram user verification
• Cyber neon dark & light themes with instant streaming

👉 Explore now: <a href="${url}">${url}</a>
━━━━━━━━━━━━━━━━━━━━━
⚡ <i>Built with pride by @techiemuthuraj</i>
    `.trim(),
    buttons: [
      [{ text: '🌐 Visit Website', url: 'https://techsavvymuthuraj.dev/' }]
    ]
  },

  maint: {
    id: 'maint',
    name: '🛠 Maintenance Notice',
    badge: 'SYSTEM NOTICE',
    build: ({ service = 'Download Server Gateways', duration = '30 minutes' }) => `
⚠️ <b>SCHEDULED SYSTEM MAINTENANCE NOTICE</b>
━━━━━━━━━━━━━━━━━━━━━
⚙️ <b>Service:</b> <code>${service}</code>
⏱️ <b>Expected Downtime:</b> <code>${duration}</code>
📅 <b>Window:</b> <code>Scheduled Window</code>

🔧 We are deploying performance upgrades, security patches, and database optimization.
Thank you for your patience! Normal operations will resume shortly.

━━━━━━━━━━━━━━━━━━━━━
⚡ <i>@techiemuthuraj Infrastructure Team</i>
    `.trim(),
    buttons: [
      [{ text: '📡 Check System Health', url: 'https://techsavvymuthuraj.dev/admin.html' }]
    ]
  },

  announce: {
    id: 'announce',
    name: '📢 Important Announcement',
    badge: 'ANNOUNCEMENT',
    build: ({ headline = 'Exciting Community Milestone!', message = 'Thank you to all members for supporting our channel!' }) => `
📢 <b>IMPORTANT COMMUNITY ANNOUNCEMENT</b>
━━━━━━━━━━━━━━━━━━━━━
🌟 <b>${headline}</b>

${message}

🤝 <i>We are committed to bringing you the best developer tools, clean APKs, and tutorials every day!</i>

━━━━━━━━━━━━━━━━━━━━━
⚡ <i>Stay connected: @techiemuthuraj</i>
    `.trim(),
    buttons: [
      [{ text: '✈️ Share with Friends', url: 'https://t.me/share/url?url=https://t.me/techiemuthuraj' }]
    ]
  },

  tutorial: {
    id: 'tutorial',
    name: '📚 Tutorial & Guide',
    badge: 'STEP-BY-STEP GUIDE',
    build: ({ topic = 'How to Verify and Download Files with Tokens', steps = '' }) => `
📖 <b>STEP-BY-STEP TUTORIAL: ${topic}</b>
━━━━━━━━━━━━━━━━━━━━━
${steps || '1️⃣ Obtain your token from channel posts.\n2️⃣ Visit https://techsavvymuthuraj.dev/.\n3️⃣ Enter your token to generate a direct 5-minute atomic download link!\n4️⃣ Start your high-speed download instantly.'}

💡 <i>Need help? Ask in the community or reach out to our bot!</i>
━━━━━━━━━━━━━━━━━━━━━
⚡ <i>Tutorial by @techiemuthuraj</i>
    `.trim(),
    buttons: [
      [{ text: '📖 Read Documentation', url: 'https://techsavvymuthuraj.dev/' }]
    ]
  },

  changelog: {
    id: 'changelog',
    name: '📋 Changelog',
    badge: 'CHANGELOG',
    build: ({ version = 'v2.0.0', changes = '' }) => `
📋 <b>CHANGELOG: Build ${version}</b>
━━━━━━━━━━━━━━━━━━━━━
✅ <b>Added:</b>
${changes || '• Realtime Supabase PostgreSQL integration\n• Automated post manager bot\n• Mobile responsive layout enhancements'}

🔄 <b>Improved:</b>
• Database query latency & memory usage
• Rate limiting and session validation

━━━━━━━━━━━━━━━━━━━━━
⚡ <i>Track changes on @techiemuthuraj</i>
    `.trim(),
    buttons: [
      [{ text: '📦 View Files', url: 'https://techsavvymuthuraj.dev/' }]
    ]
  },

  resource: {
    id: 'resource',
    name: '🎁 Free Resource Drop',
    badge: 'FREE ASSET',
    build: ({ title = 'Free Developer Script Pack', link = 'https://techsavvymuthuraj.dev/' }) => `
🎁 <b>FREE RESOURCE FOR OUR COMMUNITY</b>
━━━━━━━━━━━━━━━━━━━━━
💎 <b>Asset:</b> <b>${title}</b>
💰 <b>Price:</b> <code>100% FREE for Subscribers</code>

👉 <b>Download Link:</b>
<a href="${link}">${link}</a>

✨ <i>Enjoy and feel free to share with fellow developers!</i>
━━━━━━━━━━━━━━━━━━━━━
⚡ <i>@techiemuthuraj Exclusive Drops</i>
    `.trim(),
    buttons: [
      [{ text: '🎁 Claim Free Resource', url: 'https://techsavvymuthuraj.dev/' }]
    ]
  },

  job: {
    id: 'job',
    name: '💼 Job Opportunity Alert',
    badge: 'CAREER NOTIFICATION',
    build: ({ role = 'Frontend / Full-Stack Developer', company = 'Tech Partner', applyUrl = 'https://techsavvymuthuraj.dev/' }) => `
💼 <b>CAREER OPPORTUNITY NOTIFICATION</b>
━━━━━━━━━━━━━━━━━━━━━
🏢 <b>Company:</b> <b>${company}</b>
🎯 <b>Role:</b> <b>${role}</b>
📍 <b>Location:</b> <code>Remote / Hybrid</code>

📋 <b>Requirements:</b>
• JavaScript / TypeScript proficiency
• Experience with web APIs & modern stacks
• Passion for building clean user experiences

👉 <b>Apply Here:</b> <a href="${applyUrl}">View Details & Apply</a>
━━━━━━━━━━━━━━━━━━━━━
⚡ <i>Curated by @techiemuthuraj</i>
    `.trim(),
    buttons: [
      [{ text: '💼 View Job Details', url: 'https://techsavvymuthuraj.dev/' }]
    ]
  },

  exam: {
    id: 'exam',
    name: '🎓 Exam Notification',
    badge: 'EXAM ALERT',
    build: ({ exam = 'National Tech Aptitude Test', date = 'October 2026', link = 'https://techsavvymuthuraj.dev/' }) => `
🎓 <b>IMPORTANT EXAM NOTIFICATION</b>
━━━━━━━━━━━━━━━━━━━━━
📝 <b>Exam / Drive:</b> <b>${exam}</b>
📅 <b>Important Date:</b> <code>${date}</code>

ℹ️ <i>Registration and hall ticket download links are now open. Review syllabus and guidelines before the deadline!</i>

👉 <b>Official Portal:</b> <a href="${link}">Access Registration</a>
━━━━━━━━━━━━━━━━━━━━━
⚡ <i>Educational Alerts by @techiemuthuraj</i>
    `.trim(),
    buttons: [
      [{ text: '🎓 Portal Link', url: 'https://techsavvymuthuraj.dev/' }]
    ]
  },

  community: {
    id: 'community',
    name: '👥 Community Announcement',
    badge: 'COMMUNITY',
    build: ({ title = 'Welcome to Our New Members!', text = '' }) => `
👥 <b>COMMUNITY UPDATE: ${title}</b>
━━━━━━━━━━━━━━━━━━━━━
${text || 'Welcome to all our new subscribers! You now have access to verified digital tools, APKs, and dev packages.\n\nBe sure to keep notifications ON so you never miss a token drop!'}

💬 <i>Join our channels:</i>
• Telegram: @techiemuthuraj
• YouTube: @techiemuthuraj
• Instagram: @techiemuthuraj
━━━━━━━━━━━━━━━━━━━━━
⚡ <i>Your Tech Journey Starts Here</i>
    `.trim(),
    buttons: [
      [{ text: '✈️ Telegram Channel', url: 'https://t.me/techiemuthuraj' }],
      [{ text: '▶️ YouTube Channel', url: 'https://youtube.com/@techiemuthuraj' }]
    ]
  }
};

module.exports = templates;
