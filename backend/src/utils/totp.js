'use strict';

// TOTP (RFC 6238) sobre HOTP (RFC 4226) con HMAC-SHA1, 6 dígitos y pasos de 30 s.
// Es el mismo esquema que usan Google Authenticator, Microsoft Authenticator, Authy, etc.

const crypto = require('crypto');

const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PASO_SEGUNDOS = 30;
const DIGITOS = 6;

function base32Decode(texto) {
  const limpio = String(texto).toUpperCase().replace(/\s+/g, '').replace(/=+$/, '');
  if (limpio.length === 0) {
    throw new TypeError('Secret must not be empty');
  }
  let bits = 0;
  let acumulado = 0;
  const bytes = [];
  for (const caracter of limpio) {
    const indice = ALFABETO_BASE32.indexOf(caracter);
    if (indice === -1) {
      throw new TypeError('Secret is not valid base32');
    }
    acumulado = (acumulado << 5) | indice;
    bits += 5;
    if (bits >= 8) {
      bytes.push((acumulado >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function base32Encode(buffer) {
  let bits = 0;
  let acumulado = 0;
  let salida = '';
  for (const byte of buffer) {
    acumulado = (acumulado << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO_BASE32[(acumulado >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    salida += ALFABETO_BASE32[(acumulado << (5 - bits)) & 31];
  }
  return salida;
}

function hotp(clave, contador, digitos = DIGITOS) {
  const mensaje = Buffer.alloc(8);
  mensaje.writeBigUInt64BE(BigInt(contador));
  const hmac = crypto.createHmac('sha1', clave).update(mensaje).digest();
  const desplazamiento = hmac[hmac.length - 1] & 0x0f;
  const binario = hmac.readUInt32BE(desplazamiento) & 0x7fffffff;
  return String(binario % 10 ** digitos).padStart(digitos, '0');
}

function contadorDeTiempo(tiempoMs, paso = PASO_SEGUNDOS) {
  return Math.floor(tiempoMs / 1000 / paso);
}

function generateTOTP(secreto, { time = Date.now(), step = PASO_SEGUNDOS, digits = DIGITOS } = {}) {
  return hotp(base32Decode(secreto), contadorDeTiempo(time, step), digits);
}

// Acepta el código del paso actual y de `window` pasos antes y después (desfase de reloj)
function verifyTOTP(codigo, secreto, { time = Date.now(), window = 1, step = PASO_SEGUNDOS, digits = DIGITOS } = {}) {
  const texto = String(codigo ?? '').trim();
  if (!new RegExp(`^\\d{${digits}}$`).test(texto)) {
    return false;
  }
  const clave = base32Decode(secreto);
  const actual = contadorDeTiempo(time, step);
  for (let desfase = -window; desfase <= window; desfase += 1) {
    const esperado = hotp(clave, actual + desfase, digits);
    if (crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(texto))) {
      return true;
    }
  }
  return false;
}

function segundosRestantes(time = Date.now(), step = PASO_SEGUNDOS) {
  return step - (Math.floor(time / 1000) % step);
}

function generateSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes));
}

function buildOtpAuthUri({ secret, label, issuer = 'HRIS' }) {
  const etiqueta = encodeURIComponent(`${issuer}:${label}`);
  const parametros = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(DIGITOS), period: String(PASO_SEGUNDOS) });
  return `otpauth://totp/${etiqueta}?${parametros.toString()}`;
}

module.exports = {
  base32Decode,
  base32Encode,
  hotp,
  generateTOTP,
  verifyTOTP,
  segundosRestantes,
  generateSecret,
  buildOtpAuthUri,
};
