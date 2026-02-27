// MIME type map: file extension → Content-Type
const MIME_TYPES = {
  // HTML
  'html': 'text/html',
  'htm': 'text/html',
  // CSS
  'css': 'text/css',
  // JavaScript
  'js': 'application/javascript',
  'mjs': 'application/javascript',
  // JSON
  'json': 'application/json',
  // Images
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'svg': 'image/svg+xml',
  'ico': 'image/x-icon',
  'webp': 'image/webp',
  'avif': 'image/avif',
  // Fonts
  'woff': 'font/woff',
  'woff2': 'font/woff2',
  'ttf': 'font/ttf',
  'otf': 'font/otf',
  'eot': 'application/vnd.ms-fontobject',
  // Media
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'mp3': 'audio/mpeg',
  'ogg': 'audio/ogg',
  // Documents
  'pdf': 'application/pdf',
  'xml': 'application/xml',
  'txt': 'text/plain',
  'md': 'text/plain',
  'csv': 'text/csv',
  // Data
  'wasm': 'application/wasm',
};

// Binary file extensions (skip UTF-8 text decoding)
const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'mp4', 'webm', 'mp3', 'ogg',
  'pdf', 'wasm', 'zip', 'gz',
]);

function getMimeType(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function isBinary(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}
