// =============================================================================
// techiemuthuraj Files - Public Portal Logic (index.html)
// Catalog rendering, filtering, search, and quick token unlock modal
// =============================================================================

let allFiles = [];
let currentCategory = 'All';
let selectedFileForModal = null;

document.addEventListener('DOMContentLoaded', () => {
  initCatalog();
  setupEventListeners();
  initChannelInfo();
  setupMobileDrawerEvents();
  initUserAuth();
});

/**
 * Mobile Drawer & Window Resize Event Listeners
 */
function setupMobileDrawerEvents() {
  document.addEventListener('click', (e) => {
    const drawer = document.getElementById('mobile-nav-drawer');
    const toggleBtn = document.getElementById('mobile-menu-btn');
    if (!drawer || !drawer.classList.contains('active')) return;
    if (!drawer.contains(e.target) && !toggleBtn.contains(e.target)) {
      closeMobileNav();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 992) {
      closeMobileNav();
    }
  });
}

/**
 * Mobile Navigation Drawer Toggle & Close
 */
function toggleMobileNav() {
  const drawer = document.getElementById('mobile-nav-drawer');
  const btn = document.getElementById('mobile-menu-btn');
  if (!drawer) return;
  const isOpen = drawer.classList.contains('active');
  if (isOpen) {
    closeMobileNav();
  } else {
    drawer.classList.add('active');
    if (btn) btn.innerText = '✕';
  }
}

function closeMobileNav() {
  const drawer = document.getElementById('mobile-nav-drawer');
  const btn = document.getElementById('mobile-menu-btn');
  if (drawer) drawer.classList.remove('active');
  if (btn) btn.innerText = '☰';
}

/**
 * Load Telegram Channel Community Information & Live Member Stats
 */
async function initChannelInfo() {
  try {
    const res = await apiRequest(APP_CONFIG.endpoints.channelInfo);
    if (res && res.success && res.channel) {
      const c = res.channel;
      const titleEl = document.getElementById('channel-live-title');
      const countEl = document.getElementById('channel-member-count');
      const descEl = document.getElementById('channel-live-desc');
      const inviteBtn = document.getElementById('channel-invite-btn');
      const joinBtnText = document.getElementById('channel-join-btn-text');

      const memberCountFormatted = `${c.member_count}+`;
      if (titleEl) titleEl.innerText = c.title;
      if (countEl) countEl.innerText = memberCountFormatted;
      if (descEl && c.description) descEl.innerText = c.description;
      if (inviteBtn && c.invite_link) inviteBtn.href = c.invite_link;
      if (joinBtnText) joinBtnText.innerText = `Join ${c.handle} Channel (${c.member_count}+ Members) ✈️`;

      // Update hero and mobile drawer live member counters
      const heroCountEl = document.getElementById('hero-live-member-count');
      if (heroCountEl) heroCountEl.innerText = memberCountFormatted;

      const drawerCountEl = document.getElementById('mobile-drawer-member-count');
      if (drawerCountEl) drawerCountEl.innerText = memberCountFormatted;

      document.querySelectorAll('.live-channel-member-count').forEach(el => {
        el.innerText = memberCountFormatted;
      });
    }
  } catch (err) {
    console.warn('[Portal] Failed to fetch channel info:', err);
  }
}

/**
 * Initialize Catalog: Fetch files from API
 */
async function initCatalog() {
  const grid = document.getElementById('files-grid');
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem;">
      <div class="spin" style="font-size: 2rem; display: inline-block; color: var(--accent-cyan); margin-bottom: 1rem;">⚡</div>
      <p style="color: var(--text-secondary);">Loading verified digital files...</p>
    </div>
  `;

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.files);
    if (res && res.success && Array.isArray(res.files)) {
      allFiles = res.files;
      renderFiles();
    } else {
      throw new Error('Could not retrieve file catalog.');
    }
  } catch (err) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem;">
        <p style="color: var(--accent-rose); font-weight: 600; margin-bottom: 0.5rem;">⚠️ Failed to load catalog</p>
        <p style="color: var(--text-muted); font-size: 0.9rem;">${err.message}</p>
        <button class="btn btn-secondary btn-sm" style="margin-top: 1rem;" onclick="initCatalog()">Retry</button>
      </div>
    `;
  }
}

/**
 * Render Files based on search and active category
 */
function renderFiles() {
  const grid = document.getElementById('files-grid');
  if (!grid) return;

  const searchInput = document.getElementById('search-input');
  const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';

  let filtered = allFiles.filter(file => {
    const matchesCat = currentCategory === 'All' || file.category.toLowerCase() === currentCategory.toLowerCase();
    const matchesSearch = !searchVal || 
      file.title.toLowerCase().includes(searchVal) ||
      (file.description && file.description.toLowerCase().includes(searchVal)) ||
      (file.file_code && file.file_code.toLowerCase().includes(searchVal));
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle);">
        <p style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</p>
        <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem;">No files found</h3>
        <p style="color: var(--text-secondary); font-size: 0.9rem; max-width: 400px; margin: 0 auto;">No matching resources for category "${currentCategory}" with the search query.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(file => createFileCardHtml(file)).join('');
}

/**
 * Generate Procedural Cyberpunk SVG Art for each file category
 */
function getCategorySvgArt(category, fileCode) {
  const cat = (category || 'General').toLowerCase();

  if (cat.includes('apk')) {
    return `
      <svg width="100%" height="100%" viewBox="0 0 360 180" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="apkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#10b981" />
            <stop offset="50%" stop-color="#00f2fe" />
            <stop offset="100%" stop-color="#6366f1" />
          </linearGradient>
          <filter id="glowApk" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <rect width="360" height="180" fill="#090f1d" />
        <!-- Tech grid lines -->
        <path d="M0,45 H360 M0,90 H360 M0,135 H360 M60,0 V180 M120,0 V180 M180,0 V180 M240,0 V180 M300,0 V180" stroke="rgba(0,242,254,0.06)" stroke-width="1" />
        <!-- Circuit paths -->
        <path d="M40,90 L90,90 L120,40 L160,40 M200,140 L240,140 L270,90 L320,90" stroke="url(#apkGrad)" stroke-width="2" fill="none" opacity="0.6" />
        <circle cx="160" cy="40" r="4" fill="#00f2fe" filter="url(#glowApk)" />
        <circle cx="200" cy="140" r="4" fill="#10b981" filter="url(#glowApk)" />
        <!-- Android Cyber Symbol -->
        <g transform="translate(145, 48)" filter="url(#glowApk)">
          <path d="M15,22 C15,10 25,0 35,0 C45,0 55,10 55,22 Z" fill="url(#apkGrad)" opacity="0.9" />
          <line x1="22" y1="2" x2="14" y2="-8" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" />
          <line x1="48" y1="2" x2="56" y2="-8" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" />
          <circle cx="27" cy="12" r="2.5" fill="#060911" />
          <circle cx="43" cy="12" r="2.5" fill="#060911" />
          <rect x="15" y="26" width="40" height="38" rx="6" fill="url(#apkGrad)" opacity="0.8" />
          <rect x="5" y="28" width="6" height="26" rx="3" fill="url(#apkGrad)" opacity="0.7" />
          <rect x="59" y="28" width="6" height="26" rx="3" fill="url(#apkGrad)" opacity="0.7" />
          <rect x="23" y="66" width="7" height="18" rx="3" fill="url(#apkGrad)" opacity="0.7" />
          <rect x="40" y="66" width="7" height="18" rx="3" fill="url(#apkGrad)" opacity="0.7" />
        </g>
      </svg>
    `;
  }

  if (cat.includes('tool')) {
    return `
      <svg width="100%" height="100%" viewBox="0 0 360 180" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="toolGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#00f2fe" />
            <stop offset="50%" stop-color="#a855f7" />
            <stop offset="100%" stop-color="#ec4899" />
          </linearGradient>
          <filter id="glowTool" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <rect width="360" height="180" fill="#0c0e1a" />
        <!-- Tech grid lines -->
        <path d="M0,45 H360 M0,90 H360 M0,135 H360 M60,0 V180 M120,0 V180 M180,0 V180 M240,0 V180 M300,0 V180" stroke="rgba(236,72,153,0.06)" stroke-width="1" />
        <!-- DevOps infinity / server matrix -->
        <g transform="translate(130, 45)" filter="url(#glowTool)">
          <path d="M15,45 C-15,15 15,-15 50,45 C85,105 115,75 85,45 C55,15 85,-15 50,45 C15,105 -15,75 15,45 Z" stroke="url(#toolGrad)" stroke-width="5" fill="none" opacity="0.85" />
          <circle cx="50" cy="45" r="7" fill="#00f2fe" />
          <circle cx="15" cy="45" r="4" fill="#ec4899" />
          <circle cx="85" cy="45" r="4" fill="#a855f7" />
        </g>
        <path d="M30,150 L80,150 L110,120 M250,60 L280,30 L330,30" stroke="url(#toolGrad)" stroke-width="2" fill="none" opacity="0.5" />
      </svg>
    `;
  }

  if (cat.includes('software')) {
    return `
      <svg width="100%" height="100%" viewBox="0 0 360 180" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="softGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#3b82f6" />
            <stop offset="50%" stop-color="#6366f1" />
            <stop offset="100%" stop-color="#a855f7" />
          </linearGradient>
          <filter id="glowSoft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <rect width="360" height="180" fill="#0a0c16" />
        <path d="M0,45 H360 M0,90 H360 M0,135 H360 M60,0 V180 M120,0 V180 M180,0 V180 M240,0 V180 M300,0 V180" stroke="rgba(99,102,241,0.06)" stroke-width="1" />
        <!-- Audio / Studio spectrum waves -->
        <g transform="translate(100, 40)" filter="url(#glowSoft)">
          <rect x="0" y="30" width="8" height="40" rx="4" fill="url(#softGrad)" opacity="0.7" />
          <rect x="18" y="15" width="8" height="70" rx="4" fill="url(#softGrad)" opacity="0.85" />
          <rect x="36" y="35" width="8" height="30" rx="4" fill="url(#softGrad)" opacity="0.75" />
          <rect x="54" y="5" width="8" height="90" rx="4" fill="url(#softGrad)" opacity="0.95" />
          <rect x="72" y="20" width="8" height="60" rx="4" fill="url(#softGrad)" opacity="0.8" />
          <rect x="90" y="40" width="8" height="20" rx="4" fill="url(#softGrad)" opacity="0.7" />
          <rect x="108" y="10" width="8" height="80" rx="4" fill="url(#softGrad)" opacity="0.9" />
          <rect x="126" y="25" width="8" height="50" rx="4" fill="url(#softGrad)" opacity="0.8" />
          <rect x="144" y="45" width="8" height="10" rx="4" fill="url(#softGrad)" opacity="0.6" />
        </g>
      </svg>
    `;
  }

  // Default: Scripts / Developer codes
  return `
    <svg width="100%" height="100%" viewBox="0 0 360 180" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="scrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f59e0b" />
          <stop offset="50%" stop-color="#ec4899" />
          <stop offset="100%" stop-color="#00f2fe" />
        </linearGradient>
        <filter id="glowScr" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <rect width="360" height="180" fill="#0a0c16" />
      <path d="M0,45 H360 M0,90 H360 M0,135 H360 M60,0 V180 M120,0 V180 M180,0 V180 M240,0 V180 M300,0 V180" stroke="rgba(245,158,11,0.06)" stroke-width="1" />
      <!-- Code Brackets & Lightning -->
      <g transform="translate(135, 45)" filter="url(#glowScr)">
        <path d="M15,10 L-10,45 L15,80" stroke="url(#scrGrad)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <path d="M75,10 L100,45 L75,80" stroke="url(#scrGrad)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <!-- Lightning Center -->
        <polygon points="48,15 32,45 46,45 38,75 58,40 44,40" fill="#00f2fe" />
      </g>
    </svg>
  `;
}

/**
 * Build HTML for single file card
 */
function createFileCardHtml(file) {
  const artSvg = getCategorySvgArt(file.category, file.file_code);
  const preview = file.preview_url || '';

  return `
    <div class="file-card">
      <div class="file-card-preview">
        ${preview ? `
          <img 
            class="file-card-img" 
            src="${preview}" 
            alt="${file.title}" 
            loading="lazy" 
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" 
          />
        ` : ''}
        <div class="file-card-art-banner" style="${preview ? 'display: none;' : 'display: flex;'}">
          ${artSvg}
        </div>
        <span class="file-card-type-badge">${file.file_type || 'FILE'}</span>
        <span class="file-card-code mono">${file.file_code || ''}</span>
      </div>
      <div class="file-card-content">
        <h3 class="file-card-title" title="${file.title}">${file.title}</h3>
        <p class="file-card-desc">${file.description || 'Verified downloadable asset for channel members.'}</p>
        <div class="file-card-meta">
          <span>📦 ${file.file_size || 'N/A'}</span>
          <span>⚡ ${file.download_count || 0} downloads</span>
          <span>🏷️ ${file.category}</span>
        </div>
        <div class="file-card-actions">
          <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="openQuickUnlockModal('${file.id}')">
            🔑 Unlock Download
          </button>
          <a href="/file.html?id=${file.file_code || file.id}" class="btn btn-secondary btn-sm" title="View File Details">
            ℹ️ Details
          </a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Setup Event Listeners for search & filters
 */
function setupEventListeners() {
  // Category Pills
  const catPills = document.querySelectorAll('.cat-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.getAttribute('data-cat') || 'All';
      renderFiles();
    });
  });

  // Search input debounce and clear button
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      if (searchClearBtn) searchClearBtn.style.display = searchInput.value.trim() ? 'inline-flex' : 'none';
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        renderFiles();
      }, 250);
    });
  }

  // Token input auto-formatting in modal and clear button
  const tokenInput = document.getElementById('modal-token-input');
  const tokenClearBtn = document.getElementById('modal-token-clear-btn');
  if (tokenInput) {
    tokenInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
      if (tokenClearBtn) tokenClearBtn.style.display = e.target.value.trim() ? 'inline-flex' : 'none';
    });
  }

  // Telegram direct download input clear button
  const directInput = document.getElementById('portal-tg-direct-input');
  const directClearBtn = document.getElementById('portal-tg-direct-clear-btn');
  if (directInput) {
    directInput.addEventListener('input', (e) => {
      if (directClearBtn) directClearBtn.style.display = e.target.value.trim() ? 'inline-flex' : 'none';
    });
    directInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') handlePortalDirectDownload();
    });
  }
}

/**
 * Clear the Search Input
 */
function clearSearchInput() {
  const input = document.getElementById('search-input');
  const btn = document.getElementById('search-clear-btn');
  if (input) {
    input.value = '';
    input.focus();
  }
  if (btn) btn.style.display = 'none';
  renderFiles();
}

/**
 * Clear the Telegram Direct Download Input
 */
function clearTgDirectInput() {
  const input = document.getElementById('portal-tg-direct-input');
  const btn = document.getElementById('portal-tg-direct-clear-btn');
  const resBox = document.getElementById('portal-tg-direct-result');
  if (input) {
    input.value = '';
    input.focus();
  }
  if (btn) btn.style.display = 'none';
  if (resBox) resBox.style.display = 'none';
}

/**
 * Clear the Quick Unlock Token Input
 */
function clearModalTokenInput() {
  const input = document.getElementById('modal-token-input');
  const btn = document.getElementById('modal-token-clear-btn');
  if (input) {
    input.value = '';
    input.focus();
  }
  if (btn) btn.style.display = 'none';
}

/**
 * Open Quick Unlock Modal for a specific file
 */
function openQuickUnlockModal(fileId) {
  const file = allFiles.find(f => f.id === fileId);
  if (!file) return;

  selectedFileForModal = file;

  document.getElementById('modal-file-title').innerText = file.title;
  document.getElementById('modal-file-code').innerText = file.file_code || '';
  document.getElementById('modal-file-size').innerText = file.file_size || '';
  document.getElementById('modal-file-id-hidden').value = file.id;

  const tokenInput = document.getElementById('modal-token-input');
  tokenInput.value = '';

  const statusAlert = document.getElementById('modal-status-alert');
  statusAlert.className = 'status-alert';
  statusAlert.innerHTML = '';

  const downloadArea = document.getElementById('modal-download-area');
  downloadArea.style.display = 'none';

  const verifyBtn = document.getElementById('modal-verify-btn');
  verifyBtn.disabled = false;
  verifyBtn.innerHTML = 'Verify Token';

  openModal('quick-unlock-modal');
}

/**
 * Handle Token Verification in Quick Modal
 */
async function handleModalVerify() {
  const fileId = document.getElementById('modal-file-id-hidden').value;
  const tokenInput = document.getElementById('modal-token-input');
  const token = tokenInput.value.trim().toUpperCase();

  const statusAlert = document.getElementById('modal-status-alert');
  const downloadArea = document.getElementById('modal-download-area');
  const verifyBtn = document.getElementById('modal-verify-btn');

  if (!token) {
    statusAlert.className = 'status-alert status-alert-error active';
    statusAlert.innerHTML = '<strong>Error:</strong> Please enter an access token.';
    return;
  }

  verifyBtn.disabled = true;
  verifyBtn.innerHTML = '<span class="spin">⚡</span> Verifying on Server...';

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.verifyToken, {
      method: 'POST',
      body: JSON.stringify({ file_id: fileId, token })
    });

    if (res.success) {
      statusAlert.className = 'status-alert status-alert-success active';
      const remainingText = res.file.downloads_remaining !== null 
        ? `${res.file.downloads_remaining} downloads remaining` 
        : 'Unlimited downloads';

      statusAlert.innerHTML = `
        <strong>✓ Authorization Granted!</strong><br />
        Token verified successfully. (${remainingText})
      `;

      // Render Download Button with short-lived ticket
      const downloadUrl = `${APP_CONFIG.endpoints.download}?ticket=${encodeURIComponent(res.download_ticket)}`;
      downloadArea.innerHTML = `
        <a href="${downloadUrl}" class="btn btn-success btn-lg" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; text-decoration: none;" download>
          🚀 Download File (${res.file.title})
        </a>
        <p style="text-align: center; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">
          Download ticket is securely signed and valid for 5 minutes.
        </p>
      `;
      downloadArea.style.display = 'block';
      verifyBtn.style.display = 'none';
    }
  } catch (err) {
    const errorData = err.data || {};
    statusAlert.className = 'status-alert status-alert-error active';
    
    let errMsg = errorData.message || err.message || 'Token verification failed.';
    if (errorData.error_code === 'DOWNLOAD_LIMIT_REACHED') {
      errMsg = '⛔ <strong>Download limit reached:</strong> This token has already been used the maximum number of times.';
    } else if (errorData.error_code === 'TOKEN_EXPIRED') {
      errMsg = '⏰ <strong>Token expired:</strong> The expiration date for this token has passed.';
    } else if (errorData.error_code === 'TOKEN_REVOKED') {
      errMsg = '🚫 <strong>Token revoked:</strong> This token has been cancelled by the administrator.';
    } else if (errorData.error_code === 'TOKEN_FILE_MISMATCH') {
      errMsg = '🔀 <strong>File mismatch:</strong> This token belongs to a different resource in the catalog.';
    } else if (errorData.error_code === 'RATE_LIMIT_EXCEEDED') {
      errMsg = '⏳ <strong>Rate limited:</strong> Too many verification attempts. Please wait.';
    }

    statusAlert.innerHTML = errMsg;
    verifyBtn.disabled = false;
    verifyBtn.innerHTML = 'Verify Token';
  }
}

// =============================================================================
// Telegram User Authentication & Automatic Ownership Verification
// =============================================================================

let currentAuthSessionId = null;
let authPollInterval = null;
let isLoginEnforced = false;

/**
 * Initialize User Authentication state on page load
 */
function initUserAuth() {
  // Check if opened natively as a Telegram Mini App
  if (window.Telegram && window.Telegram.WebApp) {
    try {
      const tgApp = window.Telegram.WebApp;
      tgApp.ready();
      tgApp.expand();

      const tgUser = tgApp.initDataUnsafe?.user;
      if (tgUser && (tgUser.username || tgUser.id)) {
        const username = tgUser.username || `user_${tgUser.id}`;
        let currentSession = getUserSession();
        if (!currentSession || currentSession.username !== username) {
          setUserSession({
            username: username,
            telegram_id: tgUser.id,
            first_name: tgUser.first_name || username,
            display_name: `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() || username,
            is_channel_member: true,
            is_original: true,
            auth_type: 'telegram_miniapp'
          });
        }
      }
    } catch (err) {
      console.warn('[Telegram WebApp] Initialization note:', err);
    }
  }

  const session = getUserSession();
  renderUserAuthState(session);

  // Enforce Telegram login before accessing root page
  if (!session || !session.username) {
    openLoginModal(true);
  }

  // Setup click outside listener for user dropdown
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('user-dropdown-menu');
    const pill = document.getElementById('header-user-pill');
    if (!dropdown || dropdown.style.display === 'none') return;
    if (!dropdown.contains(e.target) && (!pill || !pill.contains(e.target))) {
      dropdown.style.display = 'none';
    }
  });

  // Guard modal backdrop clicks when login is enforced
  const loginModal = document.getElementById('user-login-modal');
  if (loginModal) {
    loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal && isLoginEnforced) {
        const cur = getUserSession();
        if (!cur || !cur.username) {
          showToast('Please sign in with Telegram first to access Techi Files.', 'warning');
        }
      }
    });
  }

  // Auto-filter and paste handler for 6-digit PIN input
  const pinInput = document.getElementById('auth-pin-input');
  const pinClearBtn = document.getElementById('auth-pin-clear-btn');
  const pinTextClear = document.getElementById('auth-pin-text-clear');

  if (pinInput) {
    pinInput.addEventListener('input', (e) => {
      const clean = e.target.value.replace(/[^0-9]/g, '');
      if (e.target.value !== clean) {
        e.target.value = clean;
      }
      const hasVal = clean.length > 0;
      if (pinClearBtn) pinClearBtn.style.display = hasVal ? 'inline-flex' : 'none';
      if (pinTextClear) pinTextClear.style.display = hasVal ? 'inline' : 'none';

      if (clean.length === 6) {
        submitAuthPinCode();
      }
    });

    pinInput.addEventListener('paste', (e) => {
      setTimeout(() => {
        const text = pinInput.value;
        const match = text.match(/\b([0-9]{6})\b/) || text.match(/([0-9]{6})/);
        if (match) {
          pinInput.value = match[1];
          if (pinClearBtn) pinClearBtn.style.display = 'inline-flex';
          if (pinTextClear) pinTextClear.style.display = 'inline';
          submitAuthPinCode();
        }
      }, 15);
    });
  }

  // Clear button & input formatting for Username input
  const usernameInput = document.getElementById('auth-username-input');
  const usernameClearBtn = document.getElementById('auth-username-clear-btn');
  const usernameTextClear = document.getElementById('auth-username-text-clear');

  if (usernameInput) {
    usernameInput.addEventListener('input', (e) => {
      let val = e.target.value;
      if (val.startsWith('@')) {
        val = val.replace(/^@+/, '');
        e.target.value = val;
      }
      const hasVal = val.trim().length > 0;
      if (usernameClearBtn) usernameClearBtn.style.display = hasVal ? 'inline-flex' : 'none';
      if (usernameTextClear) usernameTextClear.style.display = hasVal ? 'inline' : 'none';
    });

    usernameInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        startAuthChallenge();
      }
    });
  }
}

/**
 * Clear the username input field
 */
function clearAuthUsernameInput() {
  const input = document.getElementById('auth-username-input');
  const clearBtn = document.getElementById('auth-username-clear-btn');
  const textClear = document.getElementById('auth-username-text-clear');
  const errEl = document.getElementById('auth-input-error');

  if (input) {
    input.value = '';
    input.focus();
  }
  if (clearBtn) clearBtn.style.display = 'none';
  if (textClear) textClear.style.display = 'none';
  if (errEl) {
    errEl.style.display = 'none';
    errEl.innerText = '';
  }
}

/**
 * Clear the PIN input field
 */
function clearAuthPinInput() {
  const input = document.getElementById('auth-pin-input');
  const clearBtn = document.getElementById('auth-pin-clear-btn');
  const textClear = document.getElementById('auth-pin-text-clear');
  const errEl = document.getElementById('auth-pin-error');

  if (input) {
    input.value = '';
    input.focus();
  }
  if (clearBtn) clearBtn.style.display = 'none';
  if (textClear) textClear.style.display = 'none';
  if (errEl) {
    errEl.style.display = 'none';
    errEl.innerText = '';
  }
}

/**
 * Render Header and Mobile Drawer Auth States
 */
function renderUserAuthState(session) {
  const loginBtn = document.getElementById('header-login-btn');
  const userPill = document.getElementById('header-user-pill');
  const userHandleEl = document.getElementById('header-user-handle');
  const mobileLoginBtn = document.getElementById('mobile-login-btn');
  const mobileUserCard = document.getElementById('mobile-user-card');
  const mobileUserHandle = document.getElementById('mobile-user-handle');
  const mobileUserStatus = document.getElementById('mobile-user-status');

  // Dropdown elements
  const dropName = document.getElementById('dropdown-user-name');
  const dropHandle = document.getElementById('dropdown-user-handle');
  const dropId = document.getElementById('dropdown-user-id');
  const dropMember = document.getElementById('dropdown-badge-member');
  const dropMemberStatus = document.getElementById('dropdown-member-status');

  if (session && session.username) {
    const displayHandle = '@' + session.username.replace(/^@+/, '');
    if (loginBtn) loginBtn.style.display = 'none';
    if (userPill) userPill.style.display = 'inline-flex';
    if (userHandleEl) userHandleEl.innerText = displayHandle;

    if (mobileLoginBtn) mobileLoginBtn.style.display = 'none';
    if (mobileUserCard) mobileUserCard.style.display = 'block';
    if (mobileUserHandle) mobileUserHandle.innerText = displayHandle;
    if (mobileUserStatus) {
      mobileUserStatus.innerText = session.is_channel_member 
        ? '💎 Official Channel Member' 
        : '🛡️ Verified Original Account';
    }

    if (dropName) dropName.innerText = session.display_name || session.username;
    if (dropHandle) dropHandle.innerText = displayHandle;
    if (dropId) dropId.innerText = session.telegram_id || 'Auth-Verified';
    if (dropMemberStatus) {
      dropMemberStatus.innerText = session.is_channel_member ? 'Member' : 'Verified User';
    }
    if (dropMember) {
      dropMember.style.display = session.is_channel_member ? 'inline-flex' : 'none';
    }
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (userPill) userPill.style.display = 'none';
    if (mobileLoginBtn) mobileLoginBtn.style.display = 'block';
    if (mobileUserCard) mobileUserCard.style.display = 'none';
  }
}

/**
 * Toggle user profile dropdown
 */
function toggleUserDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('user-dropdown-menu');
  if (!dropdown) return;
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

/**
 * User Logout
 */
function handleUserLogout() {
  clearUserSession();
  renderUserAuthState(null);
  const dropdown = document.getElementById('user-dropdown-menu');
  if (dropdown) dropdown.style.display = 'none';
  showToast('Logged out of Techi Files.', 'info');
  // Re-gate the root page
  setTimeout(() => {
    openLoginModal(true);
  }, 300);
}

/**
 * Open Login Modal (supports enforced gating)
 */
function openLoginModal(enforced = false) {
  if (typeof enforced === 'boolean') {
    isLoginEnforced = enforced;
  } else {
    const currentSession = getUserSession();
    isLoginEnforced = (!currentSession || !currentSession.username);
  }

  const closeBtn = document.getElementById('login-modal-close');
  const banner = document.getElementById('auth-enforced-banner');
  if (closeBtn) closeBtn.style.display = isLoginEnforced ? 'none' : 'block';
  if (banner) banner.style.display = isLoginEnforced ? 'block' : 'none';

  resetAuthModal();
  openModal('user-login-modal');
  setTimeout(() => {
    const pinInput = document.getElementById('auth-pin-input');
    if (pinInput) pinInput.focus();
  }, 200);
}

/**
 * Switch Auth Tab between 6-digit PIN and Username Verification
 */
function switchAuthTab(tab) {
  const pinBtn = document.getElementById('auth-tab-pin-btn');
  const userBtn = document.getElementById('auth-tab-username-btn');
  const pinPane = document.getElementById('auth-tab-pin-pane');
  const userPane = document.getElementById('auth-tab-username-pane');

  if (tab === 'pin') {
    if (pinBtn) pinBtn.classList.add('active');
    if (userBtn) userBtn.classList.remove('active');
    if (pinPane) pinPane.style.display = 'block';
    if (userPane) userPane.style.display = 'none';
    const pinInput = document.getElementById('auth-pin-input');
    if (pinInput) setTimeout(() => pinInput.focus(), 60);
  } else {
    if (userBtn) userBtn.classList.add('active');
    if (pinBtn) pinBtn.classList.remove('active');
    if (userPane) userPane.style.display = 'block';
    if (pinPane) pinPane.style.display = 'none';
    const userInput = document.getElementById('auth-username-input');
    if (userInput) setTimeout(() => userInput.focus(), 60);
  }
}

/**
 * Submit 6-digit PIN code received from Telegram bot
 */
async function submitAuthPinCode() {
  const pinInput = document.getElementById('auth-pin-input');
  const btn = document.getElementById('auth-pin-submit-btn');
  const errEl = document.getElementById('auth-pin-error');
  if (!pinInput) return;

  const pin = pinInput.value.trim().replace(/[^0-9]/g, '');

  if (errEl) {
    errEl.style.display = 'none';
    errEl.innerText = '';
  }

  if (!pin || pin.length !== 6) {
    if (errEl) {
      errEl.innerText = 'Please enter a valid 6-digit numeric PIN code.';
      errEl.style.display = 'block';
    }
    pinInput.focus();
    return;
  }

  const originalBtnText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Verifying PIN...</span>';
  }

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.userAuth, {
      method: 'POST',
      body: JSON.stringify({
        action: 'verify_pin',
        code: pin
      })
    });

    if (!res || !res.success) {
      throw new Error(res?.error || res?.message || 'Invalid or expired PIN code. Please type /login in @TechiePostManagerBot.');
    }

    if (res.status === 'verified' && res.user) {
      handleAuthSuccess(res);
    } else {
      throw new Error(res.message || 'Verification pending. Please confirm this PIN code in @TechiePostManagerBot.');
    }
  } catch (err) {
    if (errEl) {
      errEl.innerText = err.message || 'Verification failed. Please check the PIN code.';
      errEl.style.display = 'block';
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnText;
    }
  }
}

/**
 * Close Login Modal
 */
function closeLoginModal(force = false) {
  const currentSession = getUserSession();
  if (!force && isLoginEnforced && (!currentSession || !currentSession.username)) {
    showToast('Please sign in with Telegram first to access Techi Files.', 'warning');
    return;
  }
  isLoginEnforced = false;
  stopAuthPolling();
  closeModal('user-login-modal');
}

/**
 * Reset Login Modal to Step 1
 */
function resetAuthModal() {
  stopAuthPolling();
  currentAuthSessionId = null;

  const stepInput = document.getElementById('auth-step-input');
  const stepVerify = document.getElementById('auth-step-verify');
  const stepSuccess = document.getElementById('auth-step-success');
  const stepFake = document.getElementById('auth-step-fake');

  if (stepInput) stepInput.style.display = 'block';
  if (stepVerify) stepVerify.style.display = 'none';
  if (stepSuccess) stepSuccess.style.display = 'none';
  if (stepFake) stepFake.style.display = 'none';

  const errEl = document.getElementById('auth-input-error');
  if (errEl) {
    errEl.style.display = 'none';
    errEl.innerText = '';
  }

  clearAuthUsernameInput();
  clearAuthPinInput();
  switchAuthTab('pin');
}

/**
 * Stop active polling timer
 */
function stopAuthPolling() {
  if (authPollInterval) {
    clearInterval(authPollInterval);
    authPollInterval = null;
  }
}

/**
 * Start Telegram Auth Challenge
 */
async function startAuthChallenge(isDirectBot = false) {
  const usernameInput = document.getElementById('auth-username-input');
  const errEl = document.getElementById('auth-input-error');
  const rawUsername = usernameInput ? usernameInput.value.trim() : '';
  const cleanUsername = rawUsername.replace(/^@+/, '');

  if (errEl) errEl.style.display = 'none';

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.userAuth, {
      method: 'POST',
      body: JSON.stringify({
        action: 'create_challenge',
        username: cleanUsername
      })
    });

    if (!res || !res.success) {
      throw new Error(res?.error || 'Failed to initialize verification challenge.');
    }

    currentAuthSessionId = res.session_id;

    // Populate Step 2 UI
    const targetHandleEl = document.getElementById('auth-target-handle');
    const displayCodeEl = document.getElementById('auth-display-code');
    const codeSubEl = document.getElementById('auth-code-sub');
    const deeplinkBtn = document.getElementById('auth-bot-deeplink-btn');

    if (targetHandleEl) {
      targetHandleEl.innerText = cleanUsername ? `@${cleanUsername}` : 'Any Telegram Account';
    }
    if (displayCodeEl) displayCodeEl.innerText = res.code;
    if (codeSubEl) codeSubEl.innerText = res.code;
    if (deeplinkBtn) deeplinkBtn.href = res.deep_link;

    // Switch view to Step 2
    document.getElementById('auth-step-input').style.display = 'none';
    document.getElementById('auth-step-verify').style.display = 'block';

    // If direct bot requested, open deep link
    if (isDirectBot) {
      window.open(res.deep_link, '_blank', 'noopener,noreferrer');
    }

    // Start automatic polling
    startAuthPolling(currentAuthSessionId);

  } catch (err) {
    if (errEl) {
      errEl.innerText = err.message || 'Could not connect to authentication service.';
      errEl.style.display = 'block';
    }
  }
}

/**
 * Poll Auth Status every 1.8 seconds
 */
function startAuthPolling(sessionId) {
  stopAuthPolling();

  authPollInterval = setInterval(async () => {
    try {
      const res = await apiRequest(`${APP_CONFIG.endpoints.userAuth}?session_id=${encodeURIComponent(sessionId)}`);

      if (res && res.status === 'verified') {
        stopAuthPolling();
        handleAuthSuccess(res);
      } else if (res && res.status === 'rejected_fake') {
        stopAuthPolling();
        handleAuthFakeDetected(res);
      } else if (res && res.status === 'expired') {
        stopAuthPolling();
        showToast('Verification challenge expired. Please generate a new code.', 'error');
        resetAuthModal();
      }
    } catch (e) {
      console.warn('[AuthPoll] check failed:', e);
    }
  }, 1800);
}

/**
 * Handle Verified Success Event
 */
function handleAuthSuccess(res) {
  const user = res.user;
  setUserSession({
    ...user,
    token: res.token
  });

  renderUserAuthState(user);

  const stepInput = document.getElementById('auth-step-input');
  const stepVerify = document.getElementById('auth-step-verify');
  const stepFake = document.getElementById('auth-step-fake');
  if (stepInput) stepInput.style.display = 'none';
  if (stepVerify) stepVerify.style.display = 'none';
  if (stepFake) stepFake.style.display = 'none';
  document.getElementById('auth-step-success').style.display = 'block';

  const successHandleEl = document.getElementById('auth-success-handle');
  const communityEl = document.getElementById('auth-success-community');
  if (successHandleEl) successHandleEl.innerText = `@${user.username}`;
  if (communityEl) {
    communityEl.innerText = user.is_channel_member 
      ? '💎 Official Channel Member (@techiemuthuraj)' 
      : '✈️ Telegram Channel Subscriber';
  }

  isLoginEnforced = false;
  const closeBtn = document.getElementById('login-modal-close');
  if (closeBtn) closeBtn.style.display = 'block';

  showToast(`Authenticated as @${user.username}!`, 'success');

  // Auto-close modal after brief celebration and reveal full root page
  setTimeout(() => {
    closeLoginModal(true);
  }, 2000);
}

/**
 * Handle Imposter / Fake Account Detected Event
 */
function handleAuthFakeDetected(res) {
  document.getElementById('auth-step-verify').style.display = 'none';
  document.getElementById('auth-step-fake').style.display = 'block';

  const claimedEl = document.getElementById('auth-fake-claimed');
  const actualEl = document.getElementById('auth-fake-actual');
  const reasonEl = document.getElementById('auth-fake-explanation');

  if (claimedEl) claimedEl.innerText = `@${res.claimed_username}`;
  if (actualEl) actualEl.innerText = `@${res.actual_username}`;
  if (reasonEl) {
    reasonEl.innerText = `You entered @${res.claimed_username}, but the Telegram account that tapped Start was @${res.actual_username}!`;
  }
}

/**
 * Copy 6-digit Code to Clipboard
 */
function copyAuthCode() {
  const codeEl = document.getElementById('auth-display-code');
  const btn = document.getElementById('copy-code-btn');
  if (!codeEl) return;
  const code = codeEl.innerText.trim();

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      if (btn) btn.innerText = '✓ Copied!';
      setTimeout(() => {
        if (btn) btn.innerText = '📋 Copy';
      }, 2000);
    }).catch(() => {
      if (btn) btn.innerText = '✓ Copied!';
    });
  } else {
    if (btn) btn.innerText = '✓ Copied!';
  }
}

/**
 * Handle Telegram Direct Download on public portal
 */
async function handlePortalDirectDownload() {
  const input = document.getElementById('portal-tg-direct-input');
  const btn = document.getElementById('portal-tg-direct-btn');
  const resultBox = document.getElementById('portal-tg-direct-result');
  const rawUrl = input ? input.value.trim() : '';

  if (!rawUrl) {
    showToast('Please enter a Telegram file link', 'warning');
    if (input) input.focus();
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spin">⚡</span> Resolving File Link...';
  if (resultBox) resultBox.style.display = 'none';

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.telegramDirectDownload, {
      method: 'POST',
      body: JSON.stringify({ link: rawUrl })
    });

    if (!res || !res.success) {
      throw new Error(res?.error || 'Failed to resolve Telegram file.');
    }

    const downloadHref = res.direct_download_url;
    resultBox.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
          <span class="badge badge-emerald">Ready for Direct Download</span>
          <span style="font-size: 0.85rem; color: var(--accent-cyan); font-weight: 700;">${res.file_size || ''}</span>
        </div>
        <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.75rem 1rem;">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">File Name</div>
          <h4 style="margin: 0.2rem 0 0; font-size: 1.05rem; color: var(--text-primary); word-break: break-all;">${res.file_name || res.title}</h4>
        </div>
        <div style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
          <a href="${downloadHref}" class="btn btn-success" download style="text-decoration: none; justify-content: center; padding: 0.75rem 1rem; font-weight: 700; flex: 1; min-width: 180px;">
            🚀 Download File Directly Now
          </a>
          <button type="button" class="btn btn-secondary" onclick="copyDirectDownloadLink('${downloadHref.replace(/'/g, "\\'")}')" style="justify-content: center; padding: 0.75rem 1rem;">
            📋 Copy Link
          </button>
        </div>
      </div>
    `;
    resultBox.style.display = 'block';
    showToast('Direct download link ready!', 'success');
  } catch (err) {
    showToast(err.message || 'Error resolving file', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Generate Direct Download Link ⚡';
  }
}

/**
 * Copy Direct Download Link to Clipboard
 */
function copyDirectDownloadLink(url) {
  if (!url) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Direct download link copied to clipboard! 📋', 'success');
    }).catch(() => {
      showToast('Direct download link copied! 📋', 'success');
    });
  } else {
    showToast('Direct download link copied! 📋', 'success');
  }
}


