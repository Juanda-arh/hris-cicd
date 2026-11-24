'use strict';

const config = require('./config');
const db = require('./db/pool');
const { createApp } = require('./app');

// Falla al arrancar (y no en la primera petición) si falta el secreto del JWT
try {
  void config.jwtSecret;
} catch (err) {
  console.error(`[config] ${err.message}. Set it in the .env file.`);
  process.exit(1);
}

const server = createApp().listen(config.port, () => {
  console.log(`[hris] API listening on port ${config.port} (${config.env})`);
});

function apagar(senal) {
  console.log(`[hris] ${senal} received, shutting down`);
  server.close(async () => {
    await db.close().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
