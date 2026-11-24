'use strict';

const bcrypt = require('bcryptjs');
const config = require('../config');

async function hashPassword(textoPlano) {
  if (typeof textoPlano !== 'string' || textoPlano.length === 0) {
    throw new TypeError('Password must be a non-empty string');
  }
  return bcrypt.hash(textoPlano, config.bcryptRounds);
}

async function comparePassword(textoPlano, hash) {
  if (typeof textoPlano !== 'string' || typeof hash !== 'string' || hash.length === 0) {
    return false;
  }
  return bcrypt.compare(textoPlano, hash);
}

module.exports = { hashPassword, comparePassword };
