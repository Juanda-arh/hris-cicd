'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { AuthenticationError } = require('./errors');

const ALGORITMO = 'HS256';
const ROLES_VALIDOS = Object.values(config.ROLES);

function generateToken(usuario) {
  if (!usuario || usuario.id === undefined || !ROLES_VALIDOS.includes(usuario.rol)) {
    throw new TypeError('A user with id and a valid role is required to sign a token');
  }
  return jwt.sign({ id: usuario.id, rol: usuario.rol }, config.jwtSecret, {
    algorithm: ALGORITMO,
    expiresIn: config.jwtExpiresIn,
  });
}

function verifyToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITMO] });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token expired');
    }
    throw new AuthenticationError('Invalid token');
  }
  if (payload.id === undefined || !ROLES_VALIDOS.includes(payload.rol)) {
    throw new AuthenticationError('Invalid token');
  }
  return { id: payload.id, rol: payload.rol };
}

module.exports = { generateToken, verifyToken };
