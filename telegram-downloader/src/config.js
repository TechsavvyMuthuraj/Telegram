// =============================================================================
// Telegram Direct File Downloader - Configuration & MIME Registry
// =============================================================================

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  baseUrl: (process.env.BASE_URL || `http://localhost:${process.env.PORT || '5000'}`).replace(/\/+$/, ''),
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  botUsername: process.env.TELEGRAM_BOT_USERNAME || 'TechiePostManagerBot',
  defaultChannel: process.env.DEFAULT_CHANNEL || '@techiemuthuraj',
  secretKey: process.env.SECRET_KEY || 'telegram-downloader-default-key-2026',
  streamChunkSize: parseInt(process.env.STREAM_CHUNK_SIZE || '65536', 10),
  downloadTimeoutMs: parseInt(process.env.DOWNLOAD_TIMEOUT_MS || '60000', 10),
  apiRoot: process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org'
};

const MIME_MAP = {
  '.apk': 'application/vnd.android.package-archive',
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.tar.gz': 'application/gzip',
  '.gz': 'application/gzip',
  '.pdf': 'application/pdf',
  '.exe': 'application/x-msdownload',
  '.msi': 'application/x-msi',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.bin': 'application/octet-stream'
};

/**
 * Format bytes into readable format
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0 || isNaN(bytes)) return 'Unknown Size';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Infer MIME type from filename
 */
function getMimeType(fileName) {
  if (!fileName) return 'application/octet-stream';
  const ext = path.extname(fileName).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

/**
 * Infer category name
 */
function getFileCategory(fileName, mimeType = '') {
  const name = (fileName || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (name.endsWith('.apk') || mime.includes('android.package-archive')) return 'APK';
  if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z') || name.endsWith('.tar.gz')) return 'ZIP';
  if (name.endsWith('.pdf') || mime.includes('pdf')) return 'PDF';
  if (name.endsWith('.mp4') || name.endsWith('.mkv') || name.endsWith('.avi') || mime.startsWith('video/')) return 'Video';
  if (name.endsWith('.mp3') || name.endsWith('.m4a') || name.endsWith('.flac') || mime.startsWith('audio/')) return 'Audio';
  if (name.endsWith('.jpg') || name.endsWith('.png') || name.endsWith('.webp') || mime.startsWith('image/')) return 'Image';
  if (name.endsWith('.doc') || name.endsWith('.docx') || name.endsWith('.txt')) return 'Document';
  return 'General';
}

module.exports = {
  config,
  MIME_MAP,
  formatBytes,
  getMimeType,
  getFileCategory
};
