'use strict';

const db = require('../db/pool');

// GET /health: 200 si la API y la base de datos responden; 503 si la base de datos no responde
async function health(req, res) {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'up', uptime: Math.round(process.uptime()) });
  } catch {
    res.status(503).json({ status: 'error', database: 'down' });
  }
}

module.exports = { health };
