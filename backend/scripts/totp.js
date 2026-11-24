#!/usr/bin/env node
'use strict';

// Imprime el código 2FA vigente del Administrador (el mismo que mostraría Google Authenticator).
//   npm run totp                     -> usa el secreto semilla JBSWY3DPEHPK3PXP
//   npm run totp -- OTRO_SECRETO      -> usa otro secreto base32
//   npm run totp -- --uri             -> imprime además el enlace otpauth:// para registrar la app
// Dentro del contenedor: docker compose exec api npm run totp

const { generateTOTP, segundosRestantes, buildOtpAuthUri } = require('../src/utils/totp');

const argumentos = process.argv.slice(2);
const mostrarUri = argumentos.includes('--uri');
const soloCodigo = argumentos.includes('--quiet');
const secreto = argumentos.find((a) => !a.startsWith('--')) || process.env.TOTP_SECRET || 'JBSWY3DPEHPK3PXP';

const codigo = generateTOTP(secreto);
if (soloCodigo) {
  console.log(codigo);
} else {
  console.log(`Code: ${codigo}  (valid for ${segundosRestantes()} more seconds)`);
  if (mostrarUri) {
    console.log(buildOtpAuthUri({ secret: secreto, label: 'admin' }));
  }
}
