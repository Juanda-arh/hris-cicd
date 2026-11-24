'use strict';

const config = require('../config');
const { AppError, NotFoundError } = require('../utils/errors');

const PG_UNIQUE_VIOLATION = '23505';

// Traduce cualquier error a { status, body }. El stack solo se incluye en desarrollo/pruebas
// y nunca en producción.
function traducirError(err) {
  if (err instanceof AppError) {
    const body = { error: err.message };
    if (err.details !== undefined) body.details = err.details;
    return { status: err.statusCode, body };
  }
  if (err && err.type === 'entity.parse.failed') {
    return { status: 400, body: { error: 'Malformed JSON in request body' } };
  }
  if (err && err.type === 'entity.too.large') {
    return { status: 413, body: { error: 'Request body is too large' } };
  }
  if (err && err.code === PG_UNIQUE_VIOLATION) {
    return { status: 409, body: { error: 'A record with the same unique data already exists' } };
  }
  return { status: 500, body: { error: 'Internal server error' } };
}

// Express reconoce el manejador de errores porque recibe 4 parámetros
function errorHandler(err, req, res, _next) {
  const { status, body } = traducirError(err);
  if (status >= 500) {
    console.error('[error]', err);
    if (!config.isProduction && err && err.stack) {
      body.stack = err.stack;
    }
  }
  res.status(status).json(body);
}

function notFoundHandler(req, res, next) {
  next(new NotFoundError(`Route not found: ${req.method} ${req.path}`));
}

module.exports = { errorHandler, notFoundHandler, traducirError };
