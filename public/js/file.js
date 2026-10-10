// =============================================================================
// techiemuthuraj Files - Dedicated File Details & Token Verification Logic (file.html)
// =============================================================================

let currentFile = null;

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const fileId = params.get('id');

  if (!fileId) {
    showErrorState('No file specified in URL. Please select a file from the catalog.');
    return;
  }

  loadFileDetails(fileId);
  setupTokenInput();
});

/**
 * Fetch and render file details
 */
async function loadFileDetails(fileId) {
  const container = document.getElementById('file-details-container');
  if (!container) return;

  try {
    const res = await apiRequest(`${APP_CONFIG.endpoints.files}?id=${encodeURIComponent(fileId)}`);
    if (res && res.success && res.file) {
      currentFile = res.file;
      renderFileDetails(currentFile);
    } else {
      throw new Error('File not found or inactive.');
    }
  } catch (err) {
    showErrorState(err.message || 'Unable to retrieve file specifications.');
  }
}

/**
 * Render File Details UI
 */
function renderFileDetails(file) {
  document.title = `${file.title} - Techi Files`;

  // Breadcrumbs
  const breadcrumbName = document.getElementById('breadcrumb-file-name');
  if (breadcrumbName) breadcrumbName.innerText = file.title;

  // Title and summary
  document.getElementById('file-title').innerText = file.title;
  document.getElementById('file-desc').innerText = file.description || 'Verified downloadable asset for channel members.';
  document.getElementById('file-code-badge').innerText = file.file_code || '';
  document.getElementById('file-type-badge').innerText = file.file_type || 'FILE';
  document.getElementById('file-category-badge').innerText = file.category || 'General';

  // Specs
  document.getElementById('spec-size').innerText = file.file_size || 'Unknown';
  document.getElementById('spec-version').innerText = file.version || '1.0.0';
  document.getElementById('spec-downloads').innerText = `${file.download_count || 0} times`;
  document.getElementById('spec-date').innerText = formatDate(file.created_at);

  const previewImg = document.getElementById('file-preview-img');
  if (previewImg && file.preview_url) {
    previewImg.src = file.preview_url;
  }
}

/**
 * Format and monitor token input field
 */
function setupTokenInput() {
  const tokenInput = document.getElementById('page-token-input');
  if (!tokenInput) return;

  tokenInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });

  tokenInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      verifyFileToken();
    }
  });
}

/**
 * Execute Token Verification against Backend API
 */
async function verifyFileToken() {
  if (!currentFile) return;

  const tokenInput = document.getElementById('page-token-input');
  const token = tokenInput.value.trim().toUpperCase();

  const statusAlert = document.getElementById('page-status-alert');
  const verifyBtn = document.getElementById('page-verify-btn');
  const downloadSection = document.getElementById('page-download-section');

  if (!token) {
    statusAlert.className = 'status-alert status-alert-error active';
    statusAlert.innerHTML = '<strong>Validation Error:</strong> Please enter a valid access token.';
    return;
  }

  verifyBtn.disabled = true;
  verifyBtn.innerHTML = '<span class="spin">⚡</span> Cryptographic Verification...';

  try {
    const res = await apiRequest(APP_CONFIG.endpoints.verifyToken, {
      method: 'POST',
      body: JSON.stringify({
        file_id: currentFile.id,
        token: token
      })
    });

    if (res.success) {
      statusAlert.className = 'status-alert status-alert-success active';
      const remaining = res.file.downloads_remaining !== null 
        ? `${res.file.downloads_remaining} downloads remaining on this token` 
        : 'Unlimited downloads allowed';

      statusAlert.innerHTML = `
        <strong>✓ Authorization Successful!</strong><br />
        Token verified and valid for this file. (${remaining})
      `;

      // Build secure download link
      const downloadUrl = `${APP_CONFIG.endpoints.download}?ticket=${encodeURIComponent(res.download_ticket)}`;
      
      downloadSection.innerHTML = `
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-lg); padding: 1.5rem; text-align: center; margin-top: 1rem;">
          <h4 style="color: var(--accent-emerald); font-size: 1.15rem; margin-bottom: 0.5rem;">🔒 Download Link Ready</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
            A temporary, signed download ticket has been generated. This ticket will expire in 5 minutes.
          </p>
          <a href="${downloadUrl}" class="btn btn-success btn-lg" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; text-decoration: none;" download>
            🚀 Secure Download Now (${currentFile.file_size || 'File'})
          </a>
        </div>
      `;
      downloadSection.style.display = 'block';
      verifyBtn.style.display = 'none';
      tokenInput.disabled = true;
    }
  } catch (err) {
    const errorData = err.data || {};
    statusAlert.className = 'status-alert status-alert-error active';

    let errorHtml = `<strong>Access Denied:</strong> ${errorData.message || err.message}`;
    if (errorData.error_code === 'DOWNLOAD_LIMIT_REACHED') {
      errorHtml = '⛔ <strong>Download Limit Exhausted:</strong> This token has already been used the maximum number of times allowed by the administrator.';
    } else if (errorData.error_code === 'TOKEN_EXPIRED') {
      errorHtml = '⏰ <strong>Token Expired:</strong> This access token has expired and can no longer be used.';
    } else if (errorData.error_code === 'TOKEN_REVOKED') {
      errorHtml = '🚫 <strong>Token Revoked:</strong> This access token was revoked by the administrator.';
    } else if (errorData.error_code === 'TOKEN_FILE_MISMATCH') {
      errorHtml = '🔀 <strong>File Mismatch:</strong> This token is designated for a different file in our library. Each file requires its own authorized token.';
    } else if (errorData.error_code === 'RATE_LIMIT_EXCEEDED') {
      errorHtml = '⏳ <strong>Too Many Attempts:</strong> Rate limit exceeded. Please wait a minute before retrying.';
    }

    statusAlert.innerHTML = errorHtml;
    verifyBtn.disabled = false;
    verifyBtn.innerHTML = 'Verify Token';
  }
}

function showErrorState(message) {
  const container = document.getElementById('file-details-container');
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 5rem 1rem;">
        <p style="font-size: 3rem; margin-bottom: 1rem;">📁</p>
        <h2 style="font-size: 1.75rem; margin-bottom: 0.75rem;">File Not Found</h2>
        <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto 2rem;">${message}</p>
        <a href="/" class="btn btn-primary">Browse All Files</a>
      </div>
    `;
  }
}
