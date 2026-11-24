'use strict';

// Configuración leída de variables de entorno en el momento de usarla (getters),
// para que las pruebas puedan cambiar process.env sin recargar módulos.

const ROLES = Object.freeze({
  ADMIN: 'Administrador',
  LIDER: 'Lider',
  EMPLEADO: 'Empleado',
});

function entero(nombre, porDefecto) {
  const valor = Number.parseInt(process.env[nombre], 10);
  return Number.isNaN(valor) ? porDefecto : valor;
}

const config = {
  ROLES,

  get env() {
    return process.env.NODE_ENV || 'development';
  },

  get isProduction() {
    return this.env === 'production';
  },

  get port() {
    return entero('PORT', 3000);
  },

  get jwtSecret() {
    const secreto = process.env.JWT_SECRET;
    if (!secreto) {
      throw new Error('JWT_SECRET is not set');
    }
    return secreto;
  },

  get jwtExpiresIn() {
    return process.env.JWT_EXPIRES_IN || '1h';
  },

  get bcryptRounds() {
    return entero('BCRYPT_ROUNDS', 10);
  },

  // Tiempo de vida del reto 2FA que se crea en el login del Administrador
  get otpChallengeTtlMs() {
    return entero('OTP_CHALLENGE_TTL_SECONDS', 300) * 1000;
  },

  get otpMaxAttempts() {
    return entero('OTP_MAX_ATTEMPTS', 5);
  },

  get edadMinima() {
    return entero('EDAD_MINIMA', 18);
  },

  get corsOrigins() {
    return (process.env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((origen) => origen.trim())
      .filter(Boolean);
  },

  get database() {
    if (process.env.DATABASE_URL) {
      return { connectionString: process.env.DATABASE_URL };
    }
    // Sin DATABASE_URL, pg usa PGHOST, PGPORT, PGUSER, PGPASSWORD y PGDATABASE
    return {};
  },
};

module.exports = config;
