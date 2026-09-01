const http = require('http');
const logger = require('./utils/logger');

function startHealthServer() {
  const port = Number(process.env.PORT || 0);
  if (!port) {
    logger.info('No PORT set; skipping HTTP health server.');
    return null;
  }

  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/' || req.url === '/ready') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'donut-nation-2-bot', ts: new Date().toISOString() }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(port, '0.0.0.0', () => {
    logger.info(`Health server listening on ${port}`);
  });
  server.on('error', (err) => logger.warn(`Health server error: ${err.message}`));
  return server;
}

module.exports = { startHealthServer };
