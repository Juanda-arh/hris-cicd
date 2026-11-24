'use strict';

// Servicio 2FA del Administrador.
// El login con usuario y contraseña crea un "reto" temporal; verify-otp solo emite el token
// si existe un reto vigente para esa persona. Así el código TOTP por sí solo no da acceso.

const config = require('../config');
const { verifyTOTP } = require('../utils/totp');
const { AuthenticationError } = require('../utils/errors');

const retos = new Map();

function crearReto(personaId, ahora = Date.now()) {
  const reto = { expiraEn: ahora + config.otpChallengeTtlMs, intentos: 0 };
  retos.set(String(personaId), reto);
  return { expiraEn: reto.expiraEn };
}

function tieneRetoVigente(personaId, ahora = Date.now()) {
  const reto = retos.get(String(personaId));
  return Boolean(reto) && reto.expiraEn > ahora;
}

// Verifica el código TOTP contra el secreto (paso actual ± 1 paso de 30 s)
function verificarCodigo(secreto, codigo, ahora = Date.now()) {
  if (!secreto) return false;
  return verifyTOTP(codigo, secreto, { time: ahora, window: 1 });
}

// Valida reto + código. Si es correcto el reto se consume (un solo uso).
function verificarReto(persona, codigo, ahora = Date.now()) {
  const clave = String(persona.id);
  const reto = retos.get(clave);
  if (!reto || reto.expiraEn <= ahora) {
    retos.delete(clave);
    throw new AuthenticationError('Verification code expired or was not requested. Please sign in again');
  }
  if (!verificarCodigo(persona.totp_secret, codigo, ahora)) {
    reto.intentos += 1;
    if (reto.intentos >= config.otpMaxAttempts) {
      retos.delete(clave);
    }
    throw new AuthenticationError('Invalid verification code');
  }
  retos.delete(clave);
  return true;
}

function limpiarRetos() {
  retos.clear();
}

module.exports = { crearReto, tieneRetoVigente, verificarCodigo, verificarReto, limpiarRetos };
