const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const EXTENSION_ID = process.env.EXTENSION_ID || '';

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be a valid TCP port.');
}

if (!/^[a-p]{32}$/.test(EXTENSION_ID)) {
  throw new Error('Set EXTENSION_ID to the 32-character ID shown for the unpacked Chrome extension.');
}

module.exports = {
  host: '127.0.0.1',
  port: PORT,
  allowedOrigin: `chrome-extension://${EXTENSION_ID}`
};
