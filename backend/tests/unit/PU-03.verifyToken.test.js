/**
 * PU-03 · verifyToken()
 * Caso del plan: rechaza tokens expirados o con firma inválida.
 * Resultado esperado: Lanza error de autenticación en ambos casos.
 * Técnica: Jest con temporizadores simulados (el reloj se adelanta sin esperar).
 * Código bajo prueba: src/utils/jwt.js
 */
const jwt = require('jsonwebtoken');
const { generateToken, verifyToken } = require('../../src/utils/jwt');
const { AuthenticationError } = require('../../src/utils/errors');

describe('PU-03 · verifyToken()', () => {
  const INICIO = new Date('2026-10-17T12:00:00Z');

  beforeEach(() => {
    jest.useFakeTimers({ now: INICIO });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('acepta un token vigente y devuelve id y rol', () => {
    const token = generateToken({ id: 3, rol: 'Empleado' });
    expect(verifyToken(token)).toEqual({ id: 3, rol: 'Empleado' });
  });

  test('sigue vigente un segundo antes de expirar (1h)', () => {
    const token = generateToken({ id: 3, rol: 'Empleado' });
    jest.setSystemTime(INICIO.getTime() + 59 * 60 * 1000 + 59 * 1000);
    expect(() => verifyToken(token)).not.toThrow();
  });

  test('rechaza un token expirado con AuthenticationError', () => {
    const token = generateToken({ id: 3, rol: 'Empleado' });
    jest.setSystemTime(INICIO.getTime() + 61 * 60 * 1000);
    expect(() => verifyToken(token)).toThrow(AuthenticationError);
    expect(() => verifyToken(token)).toThrow('Token expired');
  });

  test('rechaza un token firmado con otro secreto', () => {
    const token = jwt.sign({ id: 1, rol: 'Administrador' }, 'otro-secreto', { expiresIn: '1h' });
    expect(() => verifyToken(token)).toThrow(AuthenticationError);
    expect(() => verifyToken(token)).toThrow('Invalid token');
  });

  test('rechaza un token alterado (payload cambiado sin volver a firmar)', () => {
    const [cabecera, , firma] = generateToken({ id: 3, rol: 'Empleado' }).split('.');
    const payloadFalso = Buffer.from(JSON.stringify({ id: 3, rol: 'Administrador' })).toString('base64url');
    expect(() => verifyToken(`${cabecera}.${payloadFalso}.${firma}`)).toThrow(AuthenticationError);
  });

  test('rechaza tokens malformados o con algoritmo "none"', () => {
    const sinFirma = jwt.sign({ id: 1, rol: 'Administrador' }, null, { algorithm: 'none' });
    for (const token of ['abc', '', 'a.b.c', sinFirma]) {
      expect(() => verifyToken(token)).toThrow(AuthenticationError);
    }
  });

  test('rechaza un token bien firmado pero con un rol que no existe', () => {
    const token = jwt.sign({ id: 1, rol: 'Root' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    expect(() => verifyToken(token)).toThrow('Invalid token');
  });
});
