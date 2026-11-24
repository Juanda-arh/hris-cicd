'use strict';

const { verifyToken } = require('../utils/jwt');
const { AuthenticationError, ForbiddenError } = require('../utils/errors');

function responder(res, error) {
  return res.status(error.statusCode).json({ error: error.message });
}

// Exige "Authorization: Bearer <token>". Con token válido deja { id, rol } en req.user.
function authenticate(req, res, next) {
  const cabecera = req.headers?.authorization || '';
  const [esquema, token] = cabecera.split(' ');
  if (esquema !== 'Bearer' || !token) {
    return responder(res, new AuthenticationError('Authentication token is missing'));
  }
  try {
    req.user = verifyToken(token);
  } catch (err) {
    return responder(res, err instanceof AuthenticationError ? err : new AuthenticationError('Invalid token'));
  }
  return next();
}

// authorize('Administrador', 'Lider'): deja pasar solo esos roles. Va después de authenticate.
function authorize(...roles) {
  const permitidos = roles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return responder(res, new AuthenticationError('Authentication required'));
    }
    if (!permitidos.includes(req.user.rol)) {
      return responder(res, new ForbiddenError('You do not have permission to perform this action'));
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
