/**
 * PU-01 · hashPassword() / comparePassword()
 * Caso del plan: genera un hash distinto al texto plano y valida contraseña correcta e incorrecta.
 * Resultado esperado: Retorna true para la contraseña correcta y false para la incorrecta.
 * Código bajo prueba: src/utils/password.js
 */
const { hashPassword, comparePassword } = require('../../src/utils/password');

describe('PU-01 · hashPassword() / comparePassword()', () => {
  const CLAVE = 'Empleado123*';
  let hash;

  beforeAll(async () => {
    hash = await hashPassword(CLAVE);
  });

  test('genera un hash bcrypt distinto al texto plano', () => {
    expect(hash).not.toBe(CLAVE);
    expect(hash).not.toContain(CLAVE);
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
  });

  test('dos hashes de la misma contraseña son distintos (sal aleatoria)', async () => {
    const otroHash = await hashPassword(CLAVE);
    expect(otroHash).not.toBe(hash);
  });

  test('retorna true para la contraseña correcta', async () => {
    await expect(comparePassword(CLAVE, hash)).resolves.toBe(true);
  });

  test('retorna false para la contraseña incorrecta', async () => {
    await expect(comparePassword('empleado123*', hash)).resolves.toBe(false);
    await expect(comparePassword('OtraClave99*', hash)).resolves.toBe(false);
  });

  test('retorna false si la contraseña o el hash faltan', async () => {
    await expect(comparePassword('', hash)).resolves.toBe(false);
    await expect(comparePassword(CLAVE, '')).resolves.toBe(false);
    await expect(comparePassword(CLAVE, null)).resolves.toBe(false);
  });

  test('no permite hashear una contraseña vacía', async () => {
    await expect(hashPassword('')).rejects.toThrow(TypeError);
  });
});
