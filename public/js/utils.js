// =============================================================================
// techiemuthuraj Files - Frontend Shared Utilities
// Toast notifications, clipboard helpers, date formatters, and theme toggler
// =============================================================================

/**
 * Show a floating Toast alert
 * @param {string} message - Message text
 * @param {'success'|'error'|'info'|'warning'} type - Toast type
 * @param {number} duration - Auto dismiss duration in ms (default: 4000)
 */
function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  toast.innerHTML = `
    <span style="font-weight: 800; font-size: 1.1rem;">${iconMap[type] || '•'}</span>
    <span style="flex: 1;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

/**
 * Copy text to user clipboard with toast notification
 */
async function copyToClipboard(text, successMessage = 'Copied to clipboard!') {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    showToast(successMessage, 'success');
  } catch (err) {
    showToast('Failed to copy to clipboard', 'error');
  }
}

/**
 * Format ISO date string into readable UTC/local date
 */
function formatDate(isoString) {
  if (!isoString) return 'Never / None';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
}

/**
 * Open Modal by ID
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

/**
 * Close Modal by ID
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/**
 * Initialize theme toggle (dark/light)
 */
function initTheme() {
  const savedTheme = localStorage.getItem('tm_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const target = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', target);
  localStorage.setItem('tm_theme', target);
  updateThemeIcon(target);
}

function updateThemeIcon(theme) {
  const btns = document.querySelectorAll('.theme-toggle-btn');
  btns.forEach(btn => {
    btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
  });
}

// Initialize theme on load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  // Handle mobile drawer clicks outside
  document.addEventListener('click', (e) => {
    const drawer = document.getElementById('mobile-nav-drawer');
    const toggleBtn = document.getElementById('mobile-menu-btn');
    if (!drawer || !drawer.classList.contains('active')) return;
    if (!drawer.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
      closeMobileNav();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 992) {
      closeMobileNav();
    }
  });
});

/**
 * Global Mobile Navigation Drawer Controller
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
