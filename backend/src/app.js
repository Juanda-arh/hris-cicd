'use strict';

const express = require('express');
const cors = require('./middlewares/cors');
const { authenticate } = require('./middlewares/auth');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const { health } = require('./controllers/healthController');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors);
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', health);

  // Rutas públicas
  app.use('/api/auth', require('./controllers/authController'));

  // Todo lo demás exige token
  app.use('/api/empleados', authenticate, require('./controllers/empleadoController'));
  app.use('/api/contactos-emergencia', authenticate, require('./controllers/contactoController'));
  app.use('/api/permisos', authenticate, require('./controllers/permisoController'));
  app.use('/api/comprobantes', authenticate, require('./controllers/comprobanteController'));
  app.use('/api/auditoria', authenticate, require('./controllers/auditoriaController'));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
