'use strict';

const config = require('../config');

// CORS básico para el frontend (Vite en http://localhost:5173 por defecto; CORS_ORIGIN acepta una lista separada por comas)
function cors(req, res, next) {
  const origen = req.headers.origin;
  const permitidos = config.corsOrigins;
  if (origen && (permitidos.includes('*') || permitidos.includes(origen))) {
    res.setHeader('Access-Control-Allow-Origin', permitidos.includes('*') ? '*' : origen);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
}

module.exports = cors;
