require('dotenv').config();
const express = require('express');
const { host, port, allowedOrigin } = require('./config');
const { createRouter } = require('./routes');

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin !== allowedOrigin) {
    return res.status(403).json({ error: 'This extension origin is not allowed.' });
  }
  res.set('Access-Control-Allow-Origin', allowedOrigin);
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
const standardJsonParser = express.json({ limit: '64kb' });
const planningJsonParser = express.json({ limit: '1mb' });
app.use((req, res, next) => {
  const parser = req.path.startsWith('/api/planning/') ? planningJsonParser : standardJsonParser;
  parser(req, res, next);
});
app.use('/api', createRouter());
app.use((error, req, res, next) => {
  if (error && error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'The request is too large.' });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'The request body must be valid JSON.' });
  }
  return res.status(500).json({ error: 'The request could not be completed.' });
});

app.listen(port, host, () => {
  console.log(`Requirement Analysis Assistant backend listening on http://${host}:${port}`);
});
