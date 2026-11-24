// Variables de entorno de prueba. En el pipeline se definen en el propio paso;
// aquí se dan valores por defecto para que `npm test` funcione en local sin .env.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
// Hash más rápido en pruebas (en producción se usan 10 rondas)
process.env.BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS || '4';
