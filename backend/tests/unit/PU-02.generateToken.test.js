/**
 * PU-02 · generateToken()
 * Caso del plan: el payload incluye id y rol del usuario y la expiración configurada.
 * Resultado esperado: El token decodificado contiene id, rol y exp correctos.
 * Código bajo prueba: src/utils/jwt.js
 */
const jwt = require('jsonwebtoken');
const { generateToken } = require('../../src/utils/jwt');

describe('PU-02 · generateToken()', () => {
  const expiracionOriginal = process.env.JWT_EXPIRES_IN;

  afterEach(() => {
    process.env.JWT_EXPIRES_IN = expiracionOriginal;
  });

  test('el payload incluye id y rol del usuario y nada más de la persona', () => {
    const token = generateToken({ id: 3, rol: 'Empleado', correo: 'ana@test.co', clave_hash: '$2a$10$secreto' });
    const payload = jwt.decode(token);
    expect(payload.id).toBe(3);
    expect(payload.rol).toBe('Empleado');
    expect(payload).not.toHaveProperty('correo');
    expect(payload).not.toHaveProperty('clave_hash');
  });

  test('exp corresponde a la expiración configurada (JWT_EXPIRES_IN = 1h)', () => {
    process.env.JWT_EXPIRES_IN = '1h';
    const payload = jwt.decode(generateToken({ id: 2, rol: 'Lider' }));
    expect(payload.exp - payload.iat).toBe(3600);
  });

  test('exp cambia si cambia la configuración (JWT_EXPIRES_IN = 15m)', () => {
    process.env.JWT_EXPIRES_IN = '15m';
    const payload = jwt.decode(generateToken({ id: 1, rol: 'Administrador' }));
    expect(payload.exp - payload.iat).toBe(900);
  });

  test('el token está firmado con JWT_SECRET (HS256)', () => {
    const token = generateToken({ id: 3, rol: 'Empleado' });
    expect(jwt.decode(token, { complete: true }).header.alg).toBe('HS256');
    expect(() => jwt.verify(token, process.env.JWT_SECRET)).not.toThrow();
  });

  test('rechaza usuarios sin id o con un rol que no existe', () => {
    expect(() => generateToken({ rol: 'Empleado' })).toThrow(TypeError);
    expect(() => generateToken({ id: 1, rol: 'SuperAdmin' })).toThrow(TypeError);
    expect(() => generateToken(null)).toThrow(TypeError);
  });
});
