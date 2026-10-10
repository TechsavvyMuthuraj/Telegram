// =============================================================================
// techiemuthuraj Files - Admin Dashboard SPA Controller (admin.html)
// Overview, File CRUD, Bulk Token Generator, User Tracking, Logs, & Telegram Sync
// =============================================================================

let currentAdminTab = 'overview';
let cachedAdminFiles = [];
let cachedAdminTokens = [];
let lastGeneratedTokens = [];

document.addEventListener('DOMContentLoaded', () => {
  checkAdminSession();
  setupAdminNavigation();
  setupAdminLoginEvents();
});

/**
 * Setup Admin Login Event Listeners (Enter key, autofocus, password toggle)
 */
function setupAdminLoginEvents() {
  const keyInput = document.getElementById('admin-login-key');
  if (keyInput) {
    keyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdminLogin(e);
      }
    });
  }

  const confirmInput = document.getElementById('confirm-modal-input-field');
  if (confirmInput) {
    confirmInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        closeCyberConfirm(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeCyberConfirm(false);
      }
    });
  }
}

/**
 * Auto-focus Admin Secret Key input
 */
function focusAdminKeyInput() {
  setTimeout(() => {
    const keyInput = document.getElementById('admin-login-key');
    if (keyInput) {
      keyInput.focus();
      keyInput.select();
    }
  }, 120);
}

/**
 * Check admin session; show login modal if unauthenticated
 */
async function checkAdminSession() {
  const adminKey = getAdminKey();
  const authModal = document.getElementById('admin-auth-modal');

  if (!adminKey) {
    if (authModal) {
      openModal('admin-auth-modal');
      focusAdminKeyInput();
    }
    return;
  }

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.auth);
    if (res && res.authenticated) {
      if (authModal) closeModal('admin-auth-modal');
      loadActiveTab();
    } else {
      throw new Error('Invalid key');
    }
  } catch (err) {
    setAdminKey(null);
    if (authModal) {
      openModal('admin-auth-modal');
      focusAdminKeyInput();
    }
  }
}

/**
 * Handle Admin Login Form Submission
 */
async function handleAdminLogin(e) {
  if (e) e.preventDefault();
  const keyInput = document.getElementById('admin-login-key');
  const errorEl = document.getElementById('admin-login-error');
  const submitBtn = document.getElementById('admin-login-submit-btn');
  const btnIcon = document.getElementById('admin-btn-icon');
  const btnText = document.getElementById('admin-btn-text');
  const modalBox = document.querySelector('#admin-auth-modal .modal-box');
  const key = keyInput ? keyInput.value.trim() : '';

  if (!key) {
    showAdminLoginError('Please enter an Admin Secret Key.');
    triggerShakeAnimation(modalBox);
    if (keyInput) keyInput.focus();
    return;
  }

  // Loading UI feedback
  if (submitBtn) submitBtn.disabled = true;
  if (btnIcon) btnIcon.innerHTML = '⏳';
  if (btnText) btnText.innerText = 'Verifying Secret Key...';
  if (errorEl) errorEl.style.display = 'none';

  try {
    const res = await fetch(APP_CONFIG.endpoints.auth, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret_key: key })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      setAdminKey(key);
      if (errorEl) errorEl.style.display = 'none';
      if (btnIcon) btnIcon.innerHTML = '✅';
      if (btnText) btnText.innerText = 'Access Granted!';
      showToast('Authenticated as Administrator', 'success');

      setTimeout(() => {
        closeModal('admin-auth-modal');
        loadActiveTab();
      }, 350);
    } else {
      const errMsg = data.error || 'Access denied. Invalid administrator secret.';
      showAdminLoginError(errMsg);
      triggerShakeAnimation(modalBox);
      if (keyInput) {
        keyInput.focus();
        keyInput.select();
      }
    }
  } catch (err) {
    showAdminLoginError(err.message || 'Network error during login.');
    triggerShakeAnimation(modalBox);
    if (keyInput) keyInput.focus();
  } finally {
    if (submitBtn && !getAdminKey()) {
      submitBtn.disabled = false;
      if (btnIcon) btnIcon.innerHTML = '🔓';
      if (btnText) btnText.innerText = 'Unlock Admin Console';
    }
  }
}

/**
 * Display formatted error banner
 */
function showAdminLoginError(msg) {
  const errorEl = document.getElementById('admin-login-error');
  if (errorEl) {
    errorEl.innerHTML = `<span>⚠️</span><span>${msg}</span>`;
    errorEl.style.display = 'flex';
  }
}

/**
 * Trigger shake animation on modal box
 */
function triggerShakeAnimation(el) {
  if (!el) return;
  el.classList.remove('shake-error');
  void el.offsetWidth; // Force CSS reflow
  el.classList.add('shake-error');
  setTimeout(() => el.classList.remove('shake-error'), 600);
}

/**
 * Toggle Admin Secret Key input visibility (password vs plain text)
 */
function toggleAdminPasswordVisibility() {
  const keyInput = document.getElementById('admin-login-key');
  const icon = document.getElementById('admin-pwd-toggle-icon');
  if (!keyInput) return;

  if (keyInput.type === 'password') {
    keyInput.type = 'text';
    if (icon) icon.textContent = '🙈';
  } else {
    keyInput.type = 'password';
    if (icon) icon.textContent = '👁️';
  }
  keyInput.focus();
}

function handleAdminLogout() {
  setAdminKey(null);
  showToast('Logged out of admin console', 'info');
  setTimeout(() => window.location.reload(), 500);
}

// =============================================================================
// REUSABLE CYBER CONFIRMATION & PROMPT MODAL SYSTEM (Replaces confirm & prompt)
// =============================================================================
let cyberConfirmResolver = null;

function showCyberConfirm({
  title = 'Confirm Action',
  icon = '⚠️',
  message = 'Are you sure you want to perform this action?',
  detail = 'This action will immediately update Supabase Cloud and cannot be undone.',
  confirmText = 'Confirm',
  confirmClass = 'btn-danger',
  showInput = false,
  inputLabel = 'Reason / Note',
  inputValue = '',
  inputPlaceholder = 'Enter reason...'
} = {}) {
  return new Promise((resolve) => {
    cyberConfirmResolver = resolve;

    const iconEl = document.getElementById('confirm-modal-icon');
    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-message');
    const detailEl = document.getElementById('confirm-modal-detail');
    const actionBtn = document.getElementById('confirm-modal-action-btn');
    const inputGroup = document.getElementById('confirm-modal-input-group');
    const inputField = document.getElementById('confirm-modal-input-field');
    const inputLabelEl = document.getElementById('confirm-modal-input-label');

    if (iconEl) iconEl.innerText = icon;
    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerHTML = message;
    if (detailEl) detailEl.innerText = detail;

    if (actionBtn) {
      actionBtn.className = `btn ${confirmClass}`;
      actionBtn.innerText = confirmText;
    }

    if (showInput && inputGroup && inputField) {
      inputGroup.style.display = 'block';
      if (inputLabelEl) inputLabelEl.innerText = inputLabel;
      inputField.value = inputValue;
      inputField.placeholder = inputPlaceholder;
      setTimeout(() => inputField.focus(), 150);
    } else if (inputGroup) {
      inputGroup.style.display = 'none';
      if (actionBtn) setTimeout(() => actionBtn.focus(), 150);
    }

    openModal('custom-confirm-modal');
  });
}

function closeCyberConfirm(confirmed) {
  closeModal('custom-confirm-modal');
  if (cyberConfirmResolver) {
    if (!confirmed) {
      cyberConfirmResolver(false);
    } else {
      const inputGroup = document.getElementById('confirm-modal-input-group');
      if (inputGroup && inputGroup.style.display !== 'none') {
        const val = document.getElementById('confirm-modal-input-field').value.trim();
        cyberConfirmResolver(val || 'Revoked by administrator');
      } else {
        cyberConfirmResolver(true);
      }
    }
    cyberConfirmResolver = null;
  }
}

/**
 * Mobile Admin Sidebar Drawer Control
 */
function toggleAdminSidebar() {
  const sidebar = document.querySelector('.admin-sidebar');
  const backdrop = document.getElementById('admin-sidebar-backdrop');
  if (sidebar) sidebar.classList.toggle('open');
  if (backdrop) backdrop.classList.toggle('active');
}

function closeAdminSidebar() {
  const sidebar = document.querySelector('.admin-sidebar');
  const backdrop = document.getElementById('admin-sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('active');
}

/**
 * Tab Navigation Setup
 */
function setupAdminNavigation() {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      if (!tab) return;

      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      const targetTabEl = document.getElementById(`tab-${tab}`);
      if (targetTabEl) targetTabEl.classList.add('active');

      const pageTitle = document.getElementById('admin-page-title');
      if (pageTitle) {
        pageTitle.innerText = item.querySelector('.nav-label')?.innerText || 'Dashboard';
      }

      // Auto-close sidebar on mobile after choosing a section
      if (window.innerWidth <= 900) {
        closeAdminSidebar();
      }

      currentAdminTab = tab;
      loadActiveTab();
    });
  });
}

function loadActiveTab() {
  switch (currentAdminTab) {
    case 'overview':
      loadOverview();
      break;
    case 'files':
      loadFilesTab();
      break;
    case 'tokens':
      loadTokensTab();
      break;
    case 'users':
      loadUsersTab();
      break;
    case 'telegram':
      loadTelegramTab();
      break;
    case 'logs':
      loadLogsTab();
      break;
    case 'settings':
      loadSettingsTab();
      break;
  }
}

// =============================================================================
// TAB 1: OVERVIEW
// =============================================================================
async function loadOverview() {
  try {
    const res = await apiRequest(APP_CONFIG.endpoints.overview);
    if (!res || !res.success) return;

    const m = res.metrics;
    document.getElementById('stat-total-files').innerText = m.total_files;
    document.getElementById('stat-active-tokens').innerText = m.active_tokens;
    document.getElementById('stat-total-downloads').innerText = m.total_downloads;
    document.getElementById('stat-rejected-attempts').innerText = m.rejected_attempts;

    // Database mode indicator
    const dbModeEl = document.getElementById('badge-db-mode');
    if (dbModeEl) {
      if (m.database_mode === 'live_supabase') {
        dbModeEl.className = 'badge badge-emerald';
        dbModeEl.innerText = '⚡ Live Supabase PostgreSQL';
      } else {
        dbModeEl.className = 'badge badge-cyan';
        dbModeEl.innerText = '💾 Local Atomic Engine (Ready for Supabase)';
      }
    }

    // Top files table
    const topFilesTable = document.getElementById('overview-top-files');
    if (topFilesTable) {
      topFilesTable.innerHTML = m.top_files.map(f => `
        <tr>
          <td><strong class="mono" style="color: var(--accent-cyan);">${f.file_code}</strong></td>
          <td>${f.title}</td>
          <td><span class="badge badge-neutral">${f.category}</span></td>
          <td><strong>${f.download_count}</strong> downloads</td>
        </tr>
      `).join('') || '<tr><td colspan="4" style="text-align: center;">No downloads yet</td></tr>';
    }

    // Recent activity log
    const recentLogsTable = document.getElementById('overview-recent-logs');
    if (recentLogsTable) {
      recentLogsTable.innerHTML = m.recent_logs.map(l => createLogRowHtml(l)).join('') || 
        '<tr><td colspan="5" style="text-align: center;">No recent events</td></tr>';
    }
  } catch (err) {
    showToast(`Failed to load overview: ${err.message}`, 'error');
  }
}

// =============================================================================
// TAB 2: FILE MANAGEMENT
// =============================================================================
async function loadFilesTab() {
  const tbody = document.getElementById('admin-files-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading files...</td></tr>';

  try {
    const res = await apiRequest(`${APP_CONFIG.endpoints.files}?admin=true`);
    if (res && res.success) {
      cachedAdminFiles = res.files;
      renderAdminFilesTable(cachedAdminFiles);
      populateFileSelectDropdowns(cachedAdminFiles);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--accent-rose);">Error: ${err.message}</td></tr>`;
  }
}

let selectedFileIds = new Set();

function renderAdminFilesTable(files) {
  const tbody = document.getElementById('admin-files-tbody');
  if (!tbody) return;

  if (files.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No files found. Click "Add New File" to get started.</td></tr>';
    return;
  }

  tbody.innerHTML = files.map(f => {
    const isChecked = selectedFileIds.has(f.id) ? 'checked' : '';
    const safeTitle = (f.title || '').replace(/'/g, "\\'");
    return `
      <tr>
        <td style="text-align: center;">
          <input type="checkbox" class="file-select-checkbox custom-checkbox" value="${f.id}" ${isChecked} onchange="updateSelectedFilesUI()" />
        </td>
        <td><span class="mono" style="color: var(--accent-cyan); font-weight: 600;">${f.file_code}</span></td>
        <td>
          <strong>${f.title}</strong>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${f.source_reference ? `Ref: ${f.source_reference.slice(0, 32)}...` : ''}</div>
        </td>
        <td><span class="badge badge-neutral">${f.category}</span></td>
        <td><span class="badge badge-indigo">${f.file_type}</span> ${f.file_size}</td>
        <td><span class="badge badge-cyan">${f.source_type}</span></td>
        <td><strong>${f.download_count}</strong></td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-secondary btn-sm" onclick="openEditFileModal('${f.id}')" title="Edit File">✏️</button>
            <button class="btn btn-primary btn-sm" onclick="quickGenerateTokenForFile('${f.id}')" title="Generate Token">🔑</button>
            <button class="btn btn-danger btn-sm" onclick="deleteFilePrompt('${f.id}', '${safeTitle}')" title="Delete File Permanently">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  updateSelectedFilesUI();
}

function toggleSelectAllFiles(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.file-select-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = masterCheckbox.checked;
    if (masterCheckbox.checked) {
      selectedFileIds.add(cb.value);
    } else {
      selectedFileIds.delete(cb.value);
    }
  });
  updateSelectedFilesUI();
}

function updateSelectedFilesUI() {
  const checkboxes = document.querySelectorAll('.file-select-checkbox');
  selectedFileIds.clear();
  checkboxes.forEach(cb => {
    if (cb.checked) selectedFileIds.add(cb.value);
  });

  const masterCheckbox = document.getElementById('select-all-files');
  if (masterCheckbox) {
    masterCheckbox.checked = checkboxes.length > 0 && selectedFileIds.size === checkboxes.length;
    masterCheckbox.indeterminate = selectedFileIds.size > 0 && selectedFileIds.size < checkboxes.length;
  }

  const batchBar = document.getElementById('batch-files-bar');
  const countEl = document.getElementById('batch-files-count');
  if (batchBar && countEl) {
    if (selectedFileIds.size > 0) {
      batchBar.style.display = 'flex';
      countEl.innerText = `${selectedFileIds.size} file${selectedFileIds.size > 1 ? 's' : ''} selected`;
    } else {
      batchBar.style.display = 'none';
    }
  }
}

function clearSelectedFiles() {
  selectedFileIds.clear();
  const checkboxes = document.querySelectorAll('.file-select-checkbox');
  checkboxes.forEach(cb => { cb.checked = false; });
  const master = document.getElementById('select-all-files');
  if (master) {
    master.checked = false;
    master.indeterminate = false;
  }
  const batchBar = document.getElementById('batch-files-bar');
  if (batchBar) batchBar.style.display = 'none';
}

async function bulkDeleteSelectedFiles() {
  const ids = Array.from(selectedFileIds);
  if (ids.length === 0) return;

  const confirmed = await showCyberConfirm({
    title: 'Delete Selected Files',
    icon: '🗑️',
    message: `Are you sure you want to permanently delete <strong>${ids.length} selected file(s)</strong>?`,
    detail: 'All selected files and their associated access tokens will be erased from Supabase Cloud immediately.',
    confirmText: `Delete ${ids.length} File(s)`,
    confirmClass: 'btn-danger'
  });

  if (!confirmed) return;

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.files, {
      method: 'DELETE',
      body: JSON.stringify({ ids })
    });
    showToast(res.message || `${ids.length} file(s) removed successfully`, 'success');
    clearSelectedFiles();
    loadFilesTab();
  } catch (err) {
    showToast(`Bulk delete failed: ${err.message}`, 'error');
  }
}

function filterAdminFiles(query) {
  const q = query.toLowerCase();
  const filtered = cachedAdminFiles.filter(f => 
    f.title.toLowerCase().includes(q) ||
    f.file_code.toLowerCase().includes(q) ||
    f.category.toLowerCase().includes(q)
  );
  renderAdminFilesTable(filtered);
}

function openAddFileModal() {
  document.getElementById('file-modal-title').innerText = 'Add New File';
  document.getElementById('file-form-id').value = '';
  document.getElementById('file-form-title').value = '';
  document.getElementById('file-form-code').value = '';
  document.getElementById('file-form-category').value = 'Software';
  document.getElementById('file-form-type').value = 'ZIP';
  document.getElementById('file-form-size').value = '';
  document.getElementById('file-form-desc').value = '';
  document.getElementById('file-form-source-type').value = 'direct_url';
  document.getElementById('file-form-source-ref').value = '';
  document.getElementById('file-form-external-url').value = '';
  document.getElementById('file-form-preview').value = '';
  openModal('file-crud-modal');
}

function openEditFileModal(fileId) {
  const f = cachedAdminFiles.find(item => item.id === fileId);
  if (!f) return;

  document.getElementById('file-modal-title').innerText = 'Edit File Metadata';
  document.getElementById('file-form-id').value = f.id;
  document.getElementById('file-form-title').value = f.title;
  document.getElementById('file-form-code').value = f.file_code;
  document.getElementById('file-form-category').value = f.category;
  document.getElementById('file-form-type').value = f.file_type;
  document.getElementById('file-form-size').value = f.file_size;
  document.getElementById('file-form-desc').value = f.description || '';
  document.getElementById('file-form-source-type').value = f.source_type;
  document.getElementById('file-form-source-ref').value = f.source_reference || '';
  document.getElementById('file-form-external-url').value = f.external_download_url || '';
  document.getElementById('file-form-preview').value = f.preview_url || '';
  openModal('file-crud-modal');
}

async function handleSaveFileForm(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('file-form-id').value;
  const payload = {
    title: document.getElementById('file-form-title').value.trim(),
    file_code: document.getElementById('file-form-code').value.trim(),
    category: document.getElementById('file-form-category').value,
    file_type: document.getElementById('file-form-type').value,
    file_size: document.getElementById('file-form-size').value.trim() || 'Unknown',
    description: document.getElementById('file-form-desc').value.trim(),
    source_type: document.getElementById('file-form-source-type').value,
    source_reference: document.getElementById('file-form-source-ref').value.trim(),
    external_download_url: document.getElementById('file-form-external-url').value.trim(),
    preview_url: document.getElementById('file-form-preview').value.trim()
  };

  if (!payload.title) {
    showToast('File title is required', 'warning');
    return;
  }

  try {
    if (id) {
      payload.id = id;
      await apiRequest(APP_CONFIG.endpoints.files, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast('File updated successfully', 'success');
    } else {
      await apiRequest(APP_CONFIG.endpoints.files, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast('File created successfully', 'success');
    }
    closeModal('file-crud-modal');
    loadFilesTab();
  } catch (err) {
    showToast(`Failed to save file: ${err.message}`, 'error');
  }
}

async function deleteFilePrompt(fileId, fileTitle) {
  const confirmed = await showCyberConfirm({
    title: 'Delete File',
    icon: '🗑️',
    message: `Are you sure you want to permanently delete "<strong>${fileTitle}</strong>"?`,
    detail: 'This will erase the file from Supabase Cloud. Active tokens linked to it will also be removed.',
    confirmText: 'Delete Permanently',
    confirmClass: 'btn-danger'
  });

  if (!confirmed) return;

  try {
    await apiRequest(`${APP_CONFIG.endpoints.files}?id=${fileId}`, {
      method: 'DELETE'
    });
    showToast(`"${fileTitle}" deleted successfully`, 'success');
    selectedFileIds.delete(fileId);
    loadFilesTab();
  } catch (err) {
    showToast(`Failed to delete: ${err.message}`, 'error');
  }
}

// =============================================================================
// TAB 3: TOKEN MANAGEMENT
// =============================================================================
let selectedTokenIds = new Set();

async function loadTokensTab() {
  const tbody = document.getElementById('admin-tokens-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Loading tokens...</td></tr>';

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.tokens);
    if (res && res.success) {
      cachedAdminTokens = res.tokens;
      renderAdminTokensTable(cachedAdminTokens);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--accent-rose);">Error: ${err.message}</td></tr>`;
  }
}

function renderAdminTokensTable(tokens) {
  const tbody = document.getElementById('admin-tokens-tbody');
  if (!tbody) return;

  if (tokens.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No tokens generated yet. Click "Generate Tokens" above.</td></tr>';
    return;
  }

  tbody.innerHTML = tokens.map(t => {
    let statusChip = '<span class="status-pill status-active">Active</span>';
    if (t.is_revoked) {
      statusChip = '<span class="status-pill status-revoked">Revoked</span>';
    } else if (t.expires_at && new Date(t.expires_at) < new Date()) {
      statusChip = '<span class="status-pill status-expired">Expired</span>';
    } else if (t.max_downloads !== null && t.download_count >= t.max_downloads) {
      statusChip = '<span class="status-pill status-exhausted">Exhausted</span>';
    }

    const limitDisplay = t.max_downloads === null ? 'Unlimited' : `${t.download_count} / ${t.max_downloads}`;
    const isChecked = selectedTokenIds.has(t.id) ? 'checked' : '';
    const safePreview = (t.token_preview || '').replace(/'/g, "\\'");

    return `
      <tr>
        <td style="text-align: center;">
          <input type="checkbox" class="token-select-checkbox custom-checkbox" value="${t.id}" ${isChecked} onchange="updateSelectedTokensUI()" />
        </td>
        <td><strong class="mono" style="color: var(--accent-cyan);">${t.token_preview}</strong></td>
        <td>
          <strong>${t.files ? t.files.file_code : 'N/A'}</strong>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${t.files ? t.files.title : ''}</div>
        </td>
        <td>${t.user_identifier || '<em style="color: var(--text-muted);">Public/Anon</em>'}</td>
        <td>${limitDisplay}</td>
        <td>${statusChip}</td>
        <td style="font-size: 0.78rem; color: var(--text-muted);">${formatDate(t.expires_at)}</td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            ${!t.is_revoked ? `
              <button class="btn btn-warning btn-sm" onclick="revokeTokenPrompt('${t.id}', '${safePreview}')" title="Revoke Token" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.45);">🚫</button>
            ` : '<span style="color: var(--text-muted); font-size: 0.75rem; padding: 0.2rem 0.4rem;">Revoked</span>'}
            <button class="btn btn-danger btn-sm" onclick="deleteTokenPrompt('${t.id}', '${safePreview}')" title="Delete Token Permanently">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  updateSelectedTokensUI();
}

function toggleSelectAllTokens(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.token-select-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = masterCheckbox.checked;
    if (masterCheckbox.checked) {
      selectedTokenIds.add(cb.value);
    } else {
      selectedTokenIds.delete(cb.value);
    }
  });
  updateSelectedTokensUI();
}

function updateSelectedTokensUI() {
  const checkboxes = document.querySelectorAll('.token-select-checkbox');
  selectedTokenIds.clear();
  checkboxes.forEach(cb => {
    if (cb.checked) selectedTokenIds.add(cb.value);
  });

  const masterCheckbox = document.getElementById('select-all-tokens');
  if (masterCheckbox) {
    masterCheckbox.checked = checkboxes.length > 0 && selectedTokenIds.size === checkboxes.length;
    masterCheckbox.indeterminate = selectedTokenIds.size > 0 && selectedTokenIds.size < checkboxes.length;
  }

  const batchBar = document.getElementById('batch-tokens-bar');
  const countEl = document.getElementById('batch-tokens-count');
  if (batchBar && countEl) {
    if (selectedTokenIds.size > 0) {
      batchBar.style.display = 'flex';
      countEl.innerText = `${selectedTokenIds.size} token${selectedTokenIds.size > 1 ? 's' : ''} selected`;
    } else {
      batchBar.style.display = 'none';
    }
  }
}

function clearSelectedTokens() {
  selectedTokenIds.clear();
  const checkboxes = document.querySelectorAll('.token-select-checkbox');
  checkboxes.forEach(cb => { cb.checked = false; });
  const master = document.getElementById('select-all-tokens');
  if (master) {
    master.checked = false;
    master.indeterminate = false;
  }
  const batchBar = document.getElementById('batch-tokens-bar');
  if (batchBar) batchBar.style.display = 'none';
}

async function bulkRevokeSelectedTokens() {
  const ids = Array.from(selectedTokenIds);
  if (ids.length === 0) return;

  const reason = await showCyberConfirm({
    title: 'Bulk Revoke Tokens',
    icon: '🚫',
    message: `Revoke access for <strong>${ids.length} selected token(s)</strong>?`,
    detail: 'Users will immediately be denied downloads when attempting to use these tokens.',
    confirmText: `Revoke ${ids.length} Tokens`,
    confirmClass: 'btn-warning',
    showInput: true,
    inputLabel: 'Reason for Revocation',
    inputValue: 'Bulk revoked by administrator',
    inputPlaceholder: 'Enter reason...'
  });

  if (!reason) return;

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.tokens, {
      method: 'PUT',
      body: JSON.stringify({ ids, reason: typeof reason === 'string' ? reason : 'Bulk revoked by administrator' })
    });
    showToast(res.message || `${ids.length} token(s) revoked successfully`, 'success');
    clearSelectedTokens();
    loadTokensTab();
  } catch (err) {
    showToast(`Bulk revoke failed: ${err.message}`, 'error');
  }
}

async function bulkDeleteSelectedTokens() {
  const ids = Array.from(selectedTokenIds);
  if (ids.length === 0) return;

  const confirmed = await showCyberConfirm({
    title: 'Delete Tokens Permanently',
    icon: '🗑️',
    message: `Permanently delete <strong>${ids.length} selected token(s)</strong> from database?`,
    detail: 'These tokens will be completely removed from Supabase Cloud.',
    confirmText: `Delete ${ids.length} Tokens`,
    confirmClass: 'btn-danger'
  });

  if (!confirmed) return;

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.tokens, {
      method: 'DELETE',
      body: JSON.stringify({ ids })
    });
    showToast(res.message || `${ids.length} token(s) deleted permanently`, 'success');
    clearSelectedTokens();
    loadTokensTab();
  } catch (err) {
    showToast(`Bulk delete failed: ${err.message}`, 'error');
  }
}

async function deleteTokenPrompt(tokenId, preview = '') {
  const confirmed = await showCyberConfirm({
    title: 'Delete Access Token',
    icon: '🗑️',
    message: `Permanently delete token <strong>${preview || 'selected token'}</strong>?`,
    detail: 'This token record will be completely erased from the database.',
    confirmText: 'Delete Token',
    confirmClass: 'btn-danger'
  });

  if (!confirmed) return;

  try {
    await apiRequest(`${APP_CONFIG.endpoints.tokens}?id=${tokenId}`, {
      method: 'DELETE'
    });
    showToast('Token deleted successfully', 'success');
    selectedTokenIds.delete(tokenId);
    loadTokensTab();
  } catch (err) {
    showToast(`Delete failed: ${err.message}`, 'error');
  }
}

function filterAdminTokens(query) {
  const q = query.toLowerCase();
  const filtered = cachedAdminTokens.filter(t => 
    (t.token_preview && t.token_preview.toLowerCase().includes(q)) ||
    (t.user_identifier && t.user_identifier.toLowerCase().includes(q)) ||
    (t.files && t.files.file_code.toLowerCase().includes(q))
  );
  renderAdminTokensTable(filtered);
}

function populateFileSelectDropdowns(files) {
  const select = document.getElementById('gen-token-file-select');
  if (!select) return;

  select.innerHTML = files.map(f => `
    <option value="${f.id}">${f.file_code} - ${f.title}</option>
  `).join('');
}

function openGenerateTokenModal() {
  document.getElementById('gen-token-count').value = '1';
  document.getElementById('gen-token-limit').value = '1';
  document.getElementById('gen-token-expiry').value = '7';
  document.getElementById('gen-token-user').value = '';
  document.getElementById('token-gen-output-box').style.display = 'none';
  openModal('token-generator-modal');
}

function quickGenerateTokenForFile(fileId) {
  openGenerateTokenModal();
  const select = document.getElementById('gen-token-file-select');
  if (select) select.value = fileId;
}

async function handleGenerateTokensSubmit(e) {
  if (e) e.preventDefault();

  const fileId = document.getElementById('gen-token-file-select').value;
  const count = parseInt(document.getElementById('gen-token-count').value, 10) || 1;
  const maxDownloadsRaw = document.getElementById('gen-token-limit').value;
  const expiryDays = document.getElementById('gen-token-expiry').value;
  const userIdentifier = document.getElementById('gen-token-user').value.trim();

  const maxDownloads = maxDownloadsRaw === 'unlimited' ? null : parseInt(maxDownloadsRaw, 10);

  const payload = {
    file_id: fileId,
    count,
    max_downloads: maxDownloads,
    expires_in_days: expiryDays === 'never' ? null : parseInt(expiryDays, 10),
    user_identifier: userIdentifier || null
  };

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.tokens, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res && res.success && res.tokens) {
      lastGeneratedTokens = res.tokens;
      showToast(`Successfully created ${res.count} token(s)!`, 'success');

      // Display tokens in output box for copy/export
      const outputBox = document.getElementById('token-gen-output-box');
      const outputText = document.getElementById('token-gen-output-text');
      outputBox.style.display = 'block';

      const tokenListString = res.tokens.map(t => t.token).join('\n');
      outputText.innerText = tokenListString;

      loadTokensTab();
    }
  } catch (err) {
    showToast(`Token generation failed: ${err.message}`, 'error');
  }
}

function copyLastGeneratedTokens() {
  const text = lastGeneratedTokens.map(t => t.token).join('\n');
  copyToClipboard(text, `${lastGeneratedTokens.length} token(s) copied to clipboard!`);
}

function exportTokensAsCSV() {
  if (lastGeneratedTokens.length === 0) {
    showToast('No newly generated tokens to export', 'warning');
    return;
  }

  const csvRows = [
    ['Token', 'Preview', 'Max Downloads', 'Expires At', 'User Tag'].join(',')
  ];

  lastGeneratedTokens.forEach(t => {
    csvRows.push([
      t.token,
      t.preview,
      t.max_downloads === null ? 'Unlimited' : t.max_downloads,
      t.expires_at || 'Never',
      t.user_identifier || ''
    ].join(','));
  });

  downloadTextFile(csvRows.join('\n'), 'tokens_export.csv', 'text/csv');
  showToast('Exported CSV file', 'success');
}

async function revokeTokenPrompt(tokenId, preview = '') {
  const reason = await showCyberConfirm({
    title: 'Revoke Access Token',
    icon: '🚫',
    message: `Revoke access for token <strong>${preview || 'selected token'}</strong>?`,
    detail: 'Users will immediately be denied file downloads when using this token.',
    confirmText: 'Revoke Access',
    confirmClass: 'btn-warning',
    showInput: true,
    inputLabel: 'Reason for Revocation',
    inputValue: 'Revoked by administrator',
    inputPlaceholder: 'Enter reason...'
  });

  if (!reason) return;

  try {
    await apiRequest(APP_CONFIG.endpoints.tokens, {
      method: 'PUT',
      body: JSON.stringify({ id: tokenId, reason: typeof reason === 'string' ? reason : 'Revoked by administrator' })
    });
    showToast('Token revoked successfully', 'success');
    loadTokensTab();
  } catch (err) {
    showToast(`Revocation failed: ${err.message}`, 'error');
  }
}

// =============================================================================
// TELEGRAM FILE DIRECT DOWNLOAD GENERATOR
// =============================================================================
let currentResolvedDirectFile = null;

function toggleDirectDownloaderCard() {
  const card = document.getElementById('admin-direct-downloader-card');
  if (card) {
    const isHidden = card.style.display === 'none';
    card.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      const input = document.getElementById('admin-tg-direct-input');
      if (input) input.focus();
    }
  }
}

async function handleGenerateDirectDownload() {
  const input = document.getElementById('admin-tg-direct-input');
  const btn = document.getElementById('admin-tg-direct-btn');
  const resultBox = document.getElementById('admin-tg-direct-result');
  const rawUrl = input ? input.value.trim() : '';

  if (!rawUrl) {
    showToast('Please enter a Telegram file link or Bot File ID', 'warning');
    if (input) input.focus();
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spin">⚡</span> Resolving File...';
  if (resultBox) resultBox.style.display = 'none';

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.telegramDirectDownload, {
      method: 'POST',
      body: JSON.stringify({ link: rawUrl })
    });

    if (!res || !res.success) {
      throw new Error(res?.error || 'Failed to resolve Telegram file.');
    }

    currentResolvedDirectFile = res;
    renderDirectDownloadResult(res);
    showToast('Direct download link generated successfully!', 'success');
  } catch (err) {
    showToast(err.message || 'Error generating direct download', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Generate Direct Download ⚡';
  }
}

function renderDirectDownloadResult(fileData) {
  const box = document.getElementById('admin-tg-direct-result');
  if (!box) return;

  const downloadHref = fileData.direct_download_url;
  const fullDownloadUrl = window.location.origin + downloadHref;

  box.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1.25rem;">
      <div style="display: flex; gap: 0.85rem; align-items: center;">
        <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: rgba(0, 242, 254, 0.15); border: 1px solid rgba(0, 242, 254, 0.4); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink: 0;">
          📦
        </div>
        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.2rem;">
            <span class="badge badge-emerald">Ready for Direct Download</span>
            <span class="badge badge-indigo">${fileData.file_type || 'FILE'}</span>
            <span style="font-size: 0.82rem; color: var(--accent-cyan); font-weight: 600;">${fileData.file_size || ''}</span>
          </div>
          <h4 style="margin: 0.2rem 0; font-size: 1.15rem; color: var(--text-primary);">${fileData.file_name || fileData.title}</h4>
          <div style="font-size: 0.78rem; color: var(--text-muted); word-break: break-all;">
            Source Link: <a href="${fileData.original_link}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-cyan); text-decoration: underline;">${fileData.original_link}</a>
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
        <a href="${downloadHref}" class="btn btn-success" download style="text-decoration: none; padding: 0.65rem 1.25rem; font-weight: 700;">
          🚀 Download File Directly Now
        </a>
        <button class="btn btn-secondary btn-sm" onclick="copyDirectDownloadUrl('${fullDownloadUrl}')">
          📋 Copy Direct URL
        </button>
        <button class="btn btn-primary btn-sm" onclick="addResolvedFileToCatalog()">
          📦 Save to Catalog (1-Click)
        </button>
      </div>
    </div>
  `;
  box.style.display = 'block';
}

function copyDirectDownloadUrl(url) {
  navigator.clipboard.writeText(url).then(() => {
    showToast('Direct download link copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Link copied!', 'info');
  });
}

function addResolvedFileToCatalog() {
  if (!currentResolvedDirectFile) return;
  openAddFileModal();
  const titleField = document.getElementById('file-form-title');
  const sourceRefField = document.getElementById('file-form-source-ref');
  const extUrlField = document.getElementById('file-form-ext-url');
  const catField = document.getElementById('file-form-category');

  if (titleField) titleField.value = currentResolvedDirectFile.title || currentResolvedDirectFile.file_name;
  if (sourceRefField) sourceRefField.value = currentResolvedDirectFile.original_link;
  if (extUrlField && currentResolvedDirectFile.external_url) {
    extUrlField.value = currentResolvedDirectFile.external_url;
  }
  if (catField && currentResolvedDirectFile.category) {
    catField.value = currentResolvedDirectFile.category;
  }
}

// =============================================================================
// TAB 4: USER MANAGEMENT & COMPLETE USER DETAIL TRACKING
// =============================================================================
let cachedAdminUsers = [];
let selectedUserForModal = null;
const selectedUserIds = new Set();

async function loadUsersTab() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2.5rem;"><span class="spin" style="display:inline-block; font-size:1.8rem; color:var(--accent-cyan); margin-bottom: 0.5rem;">⚡</span><p style="color:var(--text-muted);">Loading comprehensive user records...</p></td></tr>';

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.users);
    if (res && res.success) {
      cachedAdminUsers = res.users || [];
      renderAdminUsers(cachedAdminUsers);
      updateUserStats(cachedAdminUsers);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--accent-rose); padding: 2rem;">Error: ${err.message}</td></tr>`;
  }
}

function updateUserStats(users) {
  const totalEl = document.getElementById('users-stat-total');
  const membersEl = document.getElementById('users-stat-members');
  const tokensEl = document.getElementById('users-stat-tokens');
  const downloadsEl = document.getElementById('users-stat-downloads');

  if (!users) return;

  const totalUsers = users.length;
  const channelMembers = users.filter(u => u.is_channel_member).length;
  const totalTokens = users.reduce((acc, u) => acc + (u.total_tokens || 0), 0);
  const totalDownloads = users.reduce((acc, u) => acc + (u.total_downloads_used || 0), 0);

  if (totalEl) totalEl.innerText = totalUsers;
  if (membersEl) membersEl.innerText = channelMembers;
  if (tokensEl) tokensEl.innerText = totalTokens;
  if (downloadsEl) downloadsEl.innerText = totalDownloads;
}

// -----------------------------------------------------------------------------
// USER MANAGEMENT: SELECTION & BATCH ACTIONS
// -----------------------------------------------------------------------------
function toggleSelectAllUsers(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.user-select-checkbox');
  const isChecked = masterCheckbox.checked;

  checkboxes.forEach(cb => {
    cb.checked = isChecked;
    const userId = cb.value;
    if (isChecked) {
      selectedUserIds.add(userId);
    } else {
      selectedUserIds.delete(userId);
    }
  });

  updateUserSelectionCount();
}

function toggleUserSelection(userId, isChecked) {
  if (isChecked) {
    selectedUserIds.add(userId);
  } else {
    selectedUserIds.delete(userId);
  }
  updateUserSelectionCount();
}

function updateUserSelectionCount() {
  const checkboxes = document.querySelectorAll('.user-select-checkbox');
  const masterCheckbox = document.getElementById('select-all-users');

  if (masterCheckbox) {
    masterCheckbox.checked = checkboxes.length > 0 && selectedUserIds.size === checkboxes.length;
    masterCheckbox.indeterminate = selectedUserIds.size > 0 && selectedUserIds.size < checkboxes.length;
  }

  const batchBar = document.getElementById('batch-users-bar');
  const countEl = document.getElementById('batch-users-count');
  if (batchBar && countEl) {
    if (selectedUserIds.size > 0) {
      batchBar.style.display = 'flex';
      countEl.innerText = `${selectedUserIds.size} user${selectedUserIds.size > 1 ? 's' : ''} selected`;
    } else {
      batchBar.style.display = 'none';
    }
  }
}

function clearSelectedUsers() {
  selectedUserIds.clear();
  const checkboxes = document.querySelectorAll('.user-select-checkbox');
  checkboxes.forEach(cb => { cb.checked = false; });
  const master = document.getElementById('select-all-users');
  if (master) {
    master.checked = false;
    master.indeterminate = false;
  }
  const batchBar = document.getElementById('batch-users-bar');
  if (batchBar) batchBar.style.display = 'none';
}

async function bulkDeleteSelectedUsers() {
  const ids = Array.from(selectedUserIds);
  if (ids.length === 0) return;

  const confirmed = await showCyberConfirm({
    title: 'Delete Users Permanently',
    icon: '🗑️',
    message: `Permanently delete <strong>${ids.length} selected user(s)</strong> from database?`,
    detail: 'This will purge their user records, tracking statistics, and session data. Assigned access tokens will remain intact unless deleted separately.',
    confirmText: `Delete ${ids.length} Users`,
    confirmClass: 'btn-danger'
  });

  if (!confirmed) return;

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.users, {
      method: 'DELETE',
      body: JSON.stringify({ ids })
    });
    showToast(res.message || `${ids.length} user(s) deleted successfully`, 'success');
    clearSelectedUsers();
    loadUsersTab();
  } catch (err) {
    showToast(`Bulk user delete failed: ${err.message}`, 'error');
  }
}

async function deleteSingleUser(userId, identifier) {
  const confirmed = await showCyberConfirm({
    title: 'Delete User Record',
    icon: '🗑️',
    message: `Permanently delete user <strong>${identifier || userId}</strong>?`,
    detail: 'This will remove the user record from the database and active session tracking.',
    confirmText: 'Delete User',
    confirmClass: 'btn-danger'
  });

  if (!confirmed) return;

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.users, {
      method: 'DELETE',
      body: JSON.stringify({ id: userId })
    });
    showToast(res.message || 'User deleted successfully', 'success');
    if (selectedUserIds.has(userId)) {
      selectedUserIds.delete(userId);
      updateUserSelectionCount();
    }
    loadUsersTab();
  } catch (err) {
    showToast(`Failed to delete user: ${err.message}`, 'error');
  }
}

async function handleDeleteUserFromModal() {
  if (!selectedUserForModal) return;
  const userId = selectedUserForModal.id;
  const identifier = selectedUserForModal.identifier || selectedUserForModal.display_name;
  closeModal('admin-user-details-modal');
  await deleteSingleUser(userId, identifier);
}

function renderAdminUsers(users) {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">No tracked users found.</td></tr>';
    updateUserSelectionCount();
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isTg = (u.identifier || '').startsWith('@') || u.telegram_id;
    const isMember = Boolean(u.is_channel_member);
    const isBlocked = Boolean(u.is_blocked);
    const isSelected = selectedUserIds.has(u.id);

    return `
      <tr style="${isBlocked ? 'opacity: 0.65;' : ''} ${isSelected ? 'background: rgba(0, 242, 254, 0.05);' : ''}">
        <td style="text-align: center; width: 44px;">
          <input type="checkbox" class="custom-checkbox user-select-checkbox" value="${u.id}" 
            ${isSelected ? 'checked' : ''} 
            onchange="toggleUserSelection('${u.id}', this.checked)" 
            title="Select user ${u.identifier}" />
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 34px; height: 34px; border-radius: 50%; background: ${isMember ? 'linear-gradient(135deg, #0088cc, #29b6f6)' : 'var(--bg-tertiary)'}; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; border: 1px solid var(--border-subtle); flex-shrink: 0;">
              ${isTg ? '✈️' : '👤'}
            </div>
            <div>
              <strong style="color: var(--accent-cyan); font-size: 0.92rem; font-family: monospace;">${u.identifier}</strong>
              ${isBlocked ? '<span class="badge badge-rose" style="margin-left: 0.35rem; font-size: 0.68rem;">Blocked</span>' : ''}
            </div>
          </div>
        </td>
        <td>
          <div style="font-weight: 600; font-size: 0.9rem;">${u.display_name || u.identifier}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}</div>
        </td>
        <td>
          <span class="mono" style="font-size: 0.82rem; background: var(--bg-tertiary); padding: 0.2rem 0.5rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            ${u.telegram_id ? u.telegram_id : 'Manual / Web'}
          </span>
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <span class="badge ${u.is_verified ? 'badge-emerald' : 'badge-neutral'}" style="font-size: 0.72rem;">
              ${u.is_verified ? '🛡️ Verified Original' : 'Manual Entry'}
            </span>
            <span class="badge ${isMember ? 'badge-indigo' : 'badge-neutral'}" style="font-size: 0.72rem;">
              ${isMember ? '💎 Channel Member' : 'Standard User'}
            </span>
          </div>
        </td>
        <td>
          <span class="badge badge-indigo" style="font-size: 0.82rem; cursor: pointer;" onclick="openUserDetailsModal('${u.id}')" title="Click to view tokens">
            ${u.active_tokens || 0} active / ${u.total_tokens || 0} total
          </span>
        </td>
        <td>
          <strong>${u.total_downloads_used || 0}</strong> downloads
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" onclick="openUserDetailsModal('${u.id}')" title="View complete details, tokens, and logs">
              👁️ Details
            </button>
            <button class="btn btn-secondary btn-sm" onclick="quickAssignTokenToUser('${u.identifier}')" title="Assign a new access token">
              + Token
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteSingleUser('${u.id}', '${(u.identifier || u.display_name || '').replace(/'/g, "\\'")}')" title="Remove user record">
              🗑️ Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  updateUserSelectionCount();
}

function filterAdminUsers(query) {
  if (!cachedAdminUsers) return;
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    renderAdminUsers(cachedAdminUsers);
    return;
  }
  const filtered = cachedAdminUsers.filter(u => 
    (u.identifier && u.identifier.toLowerCase().includes(q)) ||
    (u.display_name && u.display_name.toLowerCase().includes(q)) ||
    (u.telegram_id && String(u.telegram_id).includes(q)) ||
    (u.notes && u.notes.toLowerCase().includes(q))
  );
  renderAdminUsers(filtered);
}

function openUserDetailsModal(userId) {
  const user = cachedAdminUsers.find(u => u.id === userId);
  if (!user) return;
  selectedUserForModal = user;

  // Header and Profile
  const titleEl = document.getElementById('modal-user-title');
  const subtitleEl = document.getElementById('modal-user-subtitle');
  const statusBadge = document.getElementById('modal-user-status-badge');
  const tgIdEl = document.getElementById('modal-user-tg-id');
  const channelStatusEl = document.getElementById('modal-user-channel-status');
  const authStatusEl = document.getElementById('modal-user-auth-status');
  const createdAtEl = document.getElementById('modal-user-created-at');
  const notesInput = document.getElementById('modal-user-notes-input');
  const blockToggleBtn = document.getElementById('modal-user-block-toggle-btn');

  if (titleEl) titleEl.innerText = user.display_name || user.identifier;
  if (subtitleEl) subtitleEl.innerText = user.identifier;
  if (statusBadge) {
    statusBadge.className = user.is_blocked ? 'badge badge-rose' : 'badge badge-emerald';
    statusBadge.innerText = user.is_blocked ? 'Blocked' : 'Active';
  }
  if (tgIdEl) tgIdEl.innerText = user.telegram_id || 'Not Linked';
  if (channelStatusEl) {
    channelStatusEl.innerText = user.is_channel_member ? '💎 Official Subscriber (@techiemuthuraj)' : '✈️ Not Subscribed to Channel';
    channelStatusEl.style.color = user.is_channel_member ? '#10b981' : 'var(--text-muted)';
  }
  if (authStatusEl) {
    authStatusEl.innerText = user.is_verified ? '🛡️ Verified Original Telegram User' : 'Manual / Web Entry';
  }
  if (createdAtEl) {
    createdAtEl.innerText = user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A';
  }
  if (notesInput) notesInput.value = user.notes || '';
  if (blockToggleBtn) {
    blockToggleBtn.innerText = user.is_blocked ? '✅ Unblock User' : '🚫 Block User';
    blockToggleBtn.className = user.is_blocked ? 'btn btn-success btn-sm' : 'btn btn-secondary btn-sm';
  }

  // Populate Assigned Tokens
  const tokensTbody = document.getElementById('modal-user-tokens-tbody');
  if (tokensTbody) {
    const tokens = user.tokens || [];
    if (tokens.length === 0) {
      tokensTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No access tokens assigned yet.</td></tr>';
    } else {
      tokensTbody.innerHTML = tokens.map(t => {
        const isExhausted = t.max_downloads !== null && t.download_count >= t.max_downloads;
        const isExpired = t.expires_at && new Date(t.expires_at) < new Date();
        const statusText = t.is_revoked ? 'Revoked' : (isExpired ? 'Expired' : (isExhausted ? 'Exhausted' : 'Active'));
        const badgeClass = t.is_revoked ? 'badge-rose' : (isExpired ? 'badge-warning' : (isExhausted ? 'badge-neutral' : 'badge-emerald'));

        return `
          <tr>
            <td><strong class="mono" style="color: var(--accent-cyan); font-size: 0.82rem;">${t.token_preview}</strong></td>
            <td>
              <div style="font-weight: 600;">${t.file_title}</div>
              <div class="mono" style="font-size: 0.72rem; color: var(--text-muted);">${t.file_code}</div>
            </td>
            <td><strong>${t.download_count}</strong> / ${t.max_downloads === null ? '∞' : t.max_downloads}</td>
            <td style="font-size: 0.78rem;">${t.expires_at ? new Date(t.expires_at).toLocaleDateString() : 'Never'}</td>
            <td><span class="badge ${badgeClass}" style="font-size: 0.7rem;">${statusText}</span></td>
            <td>
              ${!t.is_revoked ? `
                <button class="btn btn-danger btn-sm" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;" onclick="revokeTokenFromModal('${t.id}', '${t.token_preview}')">
                  Revoke
                </button>
              ` : '<span style="color: var(--text-muted); font-size: 0.72rem;">Revoked</span>'}
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // Populate Downloads History
  const downloadsTbody = document.getElementById('modal-user-downloads-tbody');
  if (downloadsTbody) {
    const logs = user.downloads || [];
    if (logs.length === 0) {
      downloadsTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No downloads recorded for this user yet.</td></tr>';
    } else {
      downloadsTbody.innerHTML = logs.map(l => `
        <tr>
          <td><strong style="color: var(--text-primary); font-size: 0.85rem;">${l.file_code || 'TM-FILE'}</strong></td>
          <td style="font-size: 0.78rem;">${l.created_at || l.timestamp ? new Date(l.created_at || l.timestamp).toLocaleString() : 'N/A'}</td>
          <td><span class="badge badge-emerald" style="font-size: 0.7rem;">${l.status || 'authorized'}</span></td>
          <td class="mono" style="font-size: 0.75rem; color: var(--text-muted);">${l.ip_hash ? l.ip_hash.slice(0, 16) + '...' : 'GDPR Protected'}</td>
        </tr>
      `).join('');
    }
  }

  openModal('admin-user-details-modal');
}

function assignTokenForCurrentModalUser() {
  if (!selectedUserForModal) return;
  closeModal('admin-user-details-modal');
  quickAssignTokenToUser(selectedUserForModal.identifier);
}

async function handleToggleBlockUser() {
  if (!selectedUserForModal) return;
  const newBlockedState = !selectedUserForModal.is_blocked;
  const actionText = newBlockedState ? 'block' : 'unblock';

  const confirmed = await showCyberConfirm({
    title: `${newBlockedState ? 'Block' : 'Unblock'} User`,
    icon: newBlockedState ? '🚫' : '✅',
    message: `Are you sure you want to <strong>${actionText}</strong> user <strong>${selectedUserForModal.identifier}</strong>?`,
    detail: newBlockedState 
      ? 'Blocked users will not be allowed to claim file downloads or authenticate on the web portal.' 
      : 'Unblocked users will regain access to their valid tokens.',
    confirmText: newBlockedState ? 'Block User' : 'Unblock User',
    confirmClass: newBlockedState ? 'btn-danger' : 'btn-success'
  });

  if (!confirmed) return;

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.users, {
      method: 'PUT',
      body: JSON.stringify({
        id: selectedUserForModal.id,
        action: 'toggle_block',
        is_blocked: newBlockedState
      })
    });

    if (res && res.success) {
      selectedUserForModal.is_blocked = newBlockedState;
      showToast(`User ${newBlockedState ? 'blocked' : 'unblocked'} successfully`, 'success');
      loadUsersTab();
      openUserDetailsModal(selectedUserForModal.id);
    }
  } catch (err) {
    showToast(`Failed to update user: ${err.message}`, 'error');
  }
}

async function handleSaveUserNotes() {
  if (!selectedUserForModal) return;
  const notesInput = document.getElementById('modal-user-notes-input');
  const newNotes = notesInput ? notesInput.value.trim() : '';

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.users, {
      method: 'PUT',
      body: JSON.stringify({
        id: selectedUserForModal.id,
        notes: newNotes
      })
    });

    if (res && res.success) {
      selectedUserForModal.notes = newNotes;
      showToast('User notes saved successfully', 'success');
      loadUsersTab();
    }
  } catch (err) {
    showToast(`Failed to save notes: ${err.message}`, 'error');
  }
}

async function revokeTokenFromModal(tokenId, preview) {
  await revokeTokenPrompt(tokenId, preview);
  if (selectedUserForModal) {
    // Reload users and refresh modal
    const res = await apiRequest(APP_CONFIG.endpoints.users);
    if (res && res.success) {
      cachedAdminUsers = res.users || [];
      openUserDetailsModal(selectedUserForModal.id);
    }
  }
}

function quickAssignTokenToUser(userIdentifier) {
  openGenerateTokenModal();
  const userInput = document.getElementById('gen-token-user');
  if (userInput) userInput.value = userIdentifier;
}

// =============================================================================
// TAB 5: TELEGRAM CHANNEL INTEGRATION
// =============================================================================
async function loadTelegramTab() {
  try {
    const res = await apiRequest(APP_CONFIG.endpoints.telegramSync);
    if (!res || !res.success) return;

    const statusBadge = document.getElementById('tg-bot-status-badge');
    const botNameEl = document.getElementById('tg-bot-username');
    const channelIdEl = document.getElementById('tg-channel-id');

    if (res.bot_status && res.bot_status.connected) {
      statusBadge.className = 'badge badge-emerald';
      statusBadge.innerText = 'Connected & Operational';
      botNameEl.innerText = `@${res.bot_status.bot.username} (ID: ${res.bot_status.bot.id})`;
    } else {
      statusBadge.className = 'badge badge-rose';
      statusBadge.innerText = 'Not Connected / Token Missing';
      botNameEl.innerText = res.bot_status.error || 'Configure TELEGRAM_BOT_TOKEN in .env or Netlify';
    }

    channelIdEl.innerText = res.channel_id || 'Not configured (set TELEGRAM_CHANNEL_ID in .env)';

    // Webhook status
    const whBadge = document.getElementById('tg-webhook-status-badge');
    const whCurrentUrl = document.getElementById('tg-webhook-current-url');
    const whPending = document.getElementById('tg-webhook-pending');
    const whError = document.getElementById('tg-webhook-error');
    const whInput = document.getElementById('tg-webhook-url-input');

    if (whInput && !whInput.value) {
      whInput.value = `${window.location.origin}/api/telegram-webhook`;
    }

    if (res.webhook_info && res.webhook_info.ok) {
      const info = res.webhook_info.result;
      if (info.url) {
        whBadge.className = 'badge badge-emerald';
        whBadge.innerText = 'Webhook Active';
        whCurrentUrl.innerText = info.url;
        whPending.innerText = info.pending_update_count || '0';
        whError.innerText = info.last_error_message ? `${info.last_error_message} (${formatDate(info.last_error_date * 1000)})` : 'None';
      } else {
        whBadge.className = 'badge badge-amber';
        whBadge.innerText = 'No Webhook Set';
        whCurrentUrl.innerText = 'None (Telegram polling or unconfigured)';
        whPending.innerText = '0';
        whError.innerText = 'None';
      }
    }
  } catch (err) {
    showToast(`Failed to load Telegram status: ${err.message}`, 'error');
  }
}

async function handleSetWebhook(e) {
  if (e) e.preventDefault();
  const urlInput = document.getElementById('tg-webhook-url-input');
  const url = urlInput.value.trim();

  if (!url) {
    showToast('Please enter a valid webhook URL', 'warning');
    return;
  }

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.telegramSync, {
      method: 'POST',
      body: JSON.stringify({
        action: 'set_webhook',
        webhook_url: url
      })
    });

    if (res && res.success) {
      showToast('Telegram webhook registered successfully!', 'success');
      loadTelegramTab();
    } else {
      showToast(`Telegram webhook error: ${res.message || 'Failed to set'}`, 'error');
    }
  } catch (err) {
    showToast(`Failed to set webhook: ${err.message}`, 'error');
  }
}

async function handleDeleteWebhook() {
  const confirmed = await showCyberConfirm({
    title: 'Remove Webhook',
    icon: '⚡',
    message: 'Are you sure you want to remove the live Telegram webhook integration?',
    detail: 'The bot will cease receiving channel updates and document uploads until re-registered.',
    confirmText: 'Remove Webhook',
    confirmClass: 'btn-danger'
  });
  if (!confirmed) return;

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.telegramSync, {
      method: 'POST',
      body: JSON.stringify({ action: 'delete_webhook' })
    });

    if (res && res.success) {
      showToast('Telegram webhook removed successfully', 'success');
      loadTelegramTab();
    }
  } catch (err) {
    showToast(`Failed to remove webhook: ${err.message}`, 'error');
  }
}

async function handleMapTelegramPost(e) {
  if (e) e.preventDefault();

  const postUrl = document.getElementById('tg-post-url').value.trim();
  const fileTitle = document.getElementById('tg-post-title').value.trim();
  const category = document.getElementById('tg-post-category').value;
  const fileType = document.getElementById('tg-post-type').value;
  const fileSize = document.getElementById('tg-post-size').value.trim();
  const externalUrl = document.getElementById('tg-post-external-url').value.trim();

  if (!postUrl) {
    showToast('Please enter a Telegram message URL or channel link', 'warning');
    return;
  }

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.telegramSync, {
      method: 'POST',
      body: JSON.stringify({
        post_url: postUrl,
        title: fileTitle,
        category,
        file_type: fileType,
        file_size: fileSize,
        external_download_url: externalUrl
      })
    });

    if (res && res.success) {
      showToast('Telegram post successfully mapped to catalog!', 'success');
      document.getElementById('tg-post-url').value = '';
      document.getElementById('tg-post-title').value = '';
      loadFilesTab();
    }
  } catch (err) {
    showToast(`Failed to map post: ${err.message}`, 'error');
  }
}

// =============================================================================
// TAB 6: ACTIVITY & AUDIT LOGS
// =============================================================================
async function loadLogsTab() {
  const tbody = document.getElementById('admin-logs-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">Loading audit trail...</td></tr>';

  try {
    const res = await apiRequest(`${APP_CONFIG.endpoints.logs}?limit=100`);
    if (res && res.success) {
      tbody.innerHTML = res.logs.map(l => createLogRowHtml(l)).join('') || 
        '<tr><td colspan="5" style="text-align: center;">No activity recorded yet</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--accent-rose);">Error: ${err.message}</td></tr>`;
  }
}

function createLogRowHtml(log) {
  const badgeMap = {
    'authorized': '<span class="status-pill status-active">Authorized</span>',
    'download_completed': '<span class="status-pill status-active">Downloaded</span>',
    'rejected_invalid': '<span class="status-pill status-revoked">Invalid Token</span>',
    'rejected_expired': '<span class="status-pill status-expired">Expired Token</span>',
    'rejected_exhausted': '<span class="status-pill status-exhausted">Limit Reached</span>',
    'rejected_revoked': '<span class="status-pill status-revoked">Revoked Token</span>',
    'rejected_mismatch': '<span class="status-pill status-expired">Wrong File</span>',
    'rejected_rate_limit': '<span class="status-pill status-revoked">Rate Limited</span>'
  };

  const statusBadge = badgeMap[log.status] || `<span class="status-pill status-exhausted">${log.status}</span>`;

  return `
    <tr>
      <td style="font-size: 0.78rem; color: var(--text-muted);">${formatDate(log.created_at)}</td>
      <td><span class="mono" style="color: var(--accent-cyan); font-size: 0.82rem;">${log.file_code || log.file_id?.slice(0, 8) || 'N/A'}</span></td>
      <td><span class="mono" style="font-size: 0.82rem;">${log.token_preview || 'None'}</span></td>
      <td>${statusBadge}</td>
      <td class="mono" style="font-size: 0.78rem; color: var(--text-muted);">${log.ip_hash || 'unknown'}</td>
    </tr>
  `;
}

// =============================================================================
// TAB 7: SETTINGS & SYSTEM HEALTH
// =============================================================================
async function loadSettingsTab() {
  try {
    const res = await apiRequest(APP_CONFIG.endpoints.overview);
    if (!res || !res.success) return;

    const m = res.metrics;
    updateDatabaseModeBadge(m);

    // Update Supabase health card
    const sbBadge = document.getElementById('health-supabase-badge');
    const sbDesc = document.getElementById('health-supabase-desc');
    const sbMeta = document.getElementById('health-supabase-meta');
    const sbFileCount = document.getElementById('health-file-count');
    const sbTokenCount = document.getElementById('health-token-count');

    if (m.database_mode === 'live_supabase') {
      if (sbBadge) {
        sbBadge.className = 'badge badge-emerald';
        sbBadge.innerText = '⚡ Live PostgreSQL Active';
      }
      if (sbDesc) {
        sbDesc.innerText = 'Connected and synchronizing in real time with Supabase Cloud.';
      }
      if (sbMeta) {
        const latency = m.supabase_health?.latency_ms ? `${m.supabase_health.latency_ms}ms latency | ` : '';
        sbMeta.innerText = `${latency}Project: ${m.supabase_url || 'https://klelgazjpgogsmdrbbql.supabase.co'}`;
      }
      if (sbFileCount) sbFileCount.innerText = m.total_files;
      if (sbTokenCount) sbTokenCount.innerText = m.active_tokens;
    } else {
      if (sbBadge) {
        sbBadge.className = 'badge badge-cyan';
        sbBadge.innerText = '💾 Local Atomic Engine (Ready for Supabase)';
      }
      if (sbDesc) {
        sbDesc.innerText = 'Running local memory engine. Connect live Supabase in .env.';
      }
      if (sbFileCount) sbFileCount.innerText = m.total_files;
      if (sbTokenCount) sbTokenCount.innerText = m.active_tokens;
    }
  } catch (err) {
    console.warn('Failed to load settings telemetry:', err);
  }
}

/**
 * Ping Supabase live database on demand
 */
async function pingSupabaseLive(btn) {
  const icon = document.getElementById('health-ping-icon');
  const text = document.getElementById('health-ping-text');
  if (btn) btn.disabled = true;
  if (icon) icon.innerText = '⏳';
  if (text) text.innerText = 'Pinging Supabase...';

  try {
    const res = await apiRequest(`${APP_CONFIG.endpoints.overview}?ping_supabase=true`);
    if (res && res.ping) {
      const p = res.ping;
      if (p.connected) {
        showToast(`Supabase Connected! Ping: ${p.latency_ms}ms (${p.tables?.files ?? 0} files)`, 'success');
        const sbBadge = document.getElementById('health-supabase-badge');
        const sbMeta = document.getElementById('health-supabase-meta');
        if (sbBadge) {
          sbBadge.className = 'badge badge-emerald';
          sbBadge.innerText = `⚡ Connected (${p.latency_ms}ms)`;
        }
        if (sbMeta) {
          sbMeta.innerText = `Verified ${p.latency_ms}ms | Files: ${p.tables?.files} | Tokens: ${p.tables?.access_tokens} | ${p.url}`;
        }
      } else {
        showToast(`Supabase Error: ${p.error || p.message}`, 'error');
      }
    }
    await loadSettingsTab();
  } catch (err) {
    showToast(`Ping failed: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (icon) icon.innerText = '⚡';
    if (text) text.innerText = 'Ping Supabase Database';
  }
}

function updateDatabaseModeBadge(metrics) {
  const dbModeEl = document.getElementById('badge-db-mode');
  if (!dbModeEl || !metrics) return;

  if (metrics.database_mode === 'live_supabase') {
    dbModeEl.className = 'badge badge-emerald';
    dbModeEl.innerText = '⚡ Live Supabase PostgreSQL';
  } else {
    dbModeEl.className = 'badge badge-cyan';
    dbModeEl.innerText = '💾 Local Atomic Engine (Ready for Supabase)';
  }
}

function downloadTextFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
