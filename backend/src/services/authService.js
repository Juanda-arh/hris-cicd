'use strict';

const config = require('../config');
const personaRepository = require('../repositories/personaRepository');
const twoFactorService = require('./twoFactorService');
const { comparePassword, hashPassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');
const { validarLogin, parseId } = require('../utils/validators');
const { AuthenticationError, ForbiddenError, ValidationError } = require('../utils/errors');

const CREDENCIALES_INVALIDAS = 'Invalid credentials';

// Hash de referencia: si el usuario no existe igual se ejecuta bcrypt, para que el tiempo
// de respuesta no revele qué usuarios existen
let hashFicticio = null;
async function obtenerHashFicticio() {
  if (!hashFicticio) {
    hashFicticio = await hashPassword('not-a-real-password');
  }
  return hashFicticio;
}

async function login({ usuario, clave } = {}) {
  const errores = validarLogin({ usuario, clave });
  if (errores.length > 0) {
    throw new ValidationError(errores.join('. '), errores);
  }

  const persona = await personaRepository.findByLogin(String(usuario).trim());
  const hash = persona && persona.clave_hash ? persona.clave_hash : await obtenerHashFicticio();
  const claveCorrecta = await comparePassword(clave, hash);

  if (!persona || !persona.clave_hash || !claveCorrecta || persona.estado !== 'Activo') {
    throw new AuthenticationError(CREDENCIALES_INVALIDAS);
  }

  if (persona.rol === config.ROLES.ADMIN) {
    if (!persona.totp_secret) {
      throw new ForbiddenError('Two-factor authentication is not configured for this administrator account');
    }
    twoFactorService.crearReto(persona.id);
    return {
      requiereOtp: true,
      personaId: persona.id,
      message: 'Enter the 6-digit code from your authenticator app',
    };
  }

  return { token: generateToken(persona) };
}

async function verificarOtp({ personaId, codigo } = {}) {
  const id = parseId(personaId);
  if (!id || codigo === undefined || codigo === null || String(codigo).trim() === '') {
    throw new ValidationError('personaId and codigo are required');
  }

  const persona = await personaRepository.findById(id);
  if (!persona || persona.rol !== config.ROLES.ADMIN || !persona.totp_secret || persona.estado !== 'Activo') {
    throw new AuthenticationError('Invalid verification code');
  }

  twoFactorService.verificarReto(persona, String(codigo).trim());
  return { token: generateToken(persona) };
}

module.exports = { login, verificarOtp, CREDENCIALES_INVALIDAS };
