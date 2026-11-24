/**
 * PU-06 · Servicio 2FA: verificación de código TOTP
 * Resultado esperado: Acepta el código vigente; rechaza código inválido o fuera de la ventana de tiempo.
 * Técnica: Jest con tiempo simulado; vectores oficiales del RFC 6238; repositorio mockeado para el flujo de login.
 * Código bajo prueba: src/utils/totp.js, src/services/twoFactorService.js, src/services/authService.js
 */
jest.mock('../../src/repositories/personaRepository');

const jwt = require('jsonwebtoken');
const personaRepository = require('../../src/repositories/personaRepository');
const totp = require('../../src/utils/totp');
const twoFactorService = require('../../src/services/twoFactorService');
const authService = require('../../src/services/authService');
const { hashPassword } = require('../../src/utils/password');
const { AuthenticationError, ForbiddenError, ValidationError } = require('../../src/utils/errors');

const SECRETO = 'JBSWY3DPEHPK3PXP'; // secreto semilla del Administrador
const AHORA = Date.UTC(2026, 9, 17, 12, 0, 0); // inicio exacto de un paso de 30 s

describe('PU-06 · Servicio 2FA: verificación de código TOTP', () => {
  describe('algoritmo TOTP (RFC 6238, HMAC-SHA1)', () => {
    // Secreto del apéndice B del RFC: "12345678901234567890" en ASCII
    const SECRETO_RFC = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    test('el secreto del RFC en base32 corresponde al texto ASCII', () => {
      expect(totp.base32Decode(SECRETO_RFC).toString('ascii')).toBe('12345678901234567890');
      expect(totp.base32Encode(Buffer.from('12345678901234567890'))).toBe(SECRETO_RFC);
    });

    test.each([
      [59, '94287082'],
      [1111111109, '07081804'],
      [1111111111, '14050471'],
      [1234567890, '89005924'],
      [2000000000, '69279037'],
      [20000000000, '65353130'],
    ])('vector del RFC 6238: T = %i s → %s', (segundos, esperado) => {
      expect(totp.generateTOTP(SECRETO_RFC, { time: segundos * 1000, digits: 8 })).toBe(esperado);
    });

    test('con 6 dígitos (Google Authenticator) son los últimos 6 del vector', () => {
      expect(totp.generateTOTP(SECRETO_RFC, { time: 59 * 1000 })).toBe('287082');
    });

    test('un secreto que no es base32 lanza error', () => {
      expect(() => totp.generateTOTP('no-es-base32!', { time: AHORA })).toThrow(TypeError);
      expect(() => totp.base32Decode('')).toThrow(TypeError);
    });

    test('genera secretos nuevos y el enlace otpauth:// para la app', () => {
      const nuevo = totp.generateSecret();
      expect(nuevo).toMatch(/^[A-Z2-7]{32}$/);
      expect(totp.buildOtpAuthUri({ secret: SECRETO, label: 'admin' })).toBe(
        'otpauth://totp/HRIS%3Aadmin?secret=JBSWY3DPEHPK3PXP&issuer=HRIS&algorithm=SHA1&digits=6&period=30',
      );
      expect(totp.segundosRestantes(AHORA + 10 * 1000)).toBe(20);
    });
  });

  describe('verificación con tiempo simulado (ventana ±1 paso de 30 s)', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    test('acepta el código vigente', () => {
      const codigo = totp.generateTOTP(SECRETO, { time: AHORA });
      expect(twoFactorService.verificarCodigo(SECRETO, codigo, AHORA)).toBe(true);
    });

    test('acepta el código del paso anterior y del siguiente (desfase de reloj)', () => {
      const anterior = totp.generateTOTP(SECRETO, { time: AHORA - 30 * 1000 });
      const siguiente = totp.generateTOTP(SECRETO, { time: AHORA + 30 * 1000 });
      expect(twoFactorService.verificarCodigo(SECRETO, anterior, AHORA)).toBe(true);
      expect(twoFactorService.verificarCodigo(SECRETO, siguiente, AHORA)).toBe(true);
    });

    test('rechaza códigos fuera de la ventana de tiempo (±60 s)', () => {
      const viejo = totp.generateTOTP(SECRETO, { time: AHORA - 60 * 1000 });
      const futuro = totp.generateTOTP(SECRETO, { time: AHORA + 60 * 1000 });
      expect(twoFactorService.verificarCodigo(SECRETO, viejo, AHORA)).toBe(false);
      expect(twoFactorService.verificarCodigo(SECRETO, futuro, AHORA)).toBe(false);
    });

    test('un código expira cuando el reloj simulado avanza 90 s', () => {
      jest.useFakeTimers({ now: AHORA });
      const codigo = totp.generateTOTP(SECRETO);
      expect(totp.verifyTOTP(codigo, SECRETO)).toBe(true);
      jest.setSystemTime(AHORA + 90 * 1000);
      expect(totp.verifyTOTP(codigo, SECRETO)).toBe(false);
    });

    test('rechaza códigos inválidos', () => {
      const validos = [-1, 0, 1].map((paso) => totp.generateTOTP(SECRETO, { time: AHORA + paso * 30 * 1000 }));
      let incorrecto = validos[1];
      while (validos.includes(incorrecto)) {
        incorrecto = String((Number(incorrecto) + 1) % 1000000).padStart(6, '0');
      }
      for (const codigo of [incorrecto, '12345', '1234567', 'abcdef', '', null, undefined]) {
        expect(twoFactorService.verificarCodigo(SECRETO, codigo, AHORA)).toBe(false);
      }
    });

    test('sin secreto configurado no acepta ningún código', () => {
      const codigo = totp.generateTOTP(SECRETO, { time: AHORA });
      expect(twoFactorService.verificarCodigo(null, codigo, AHORA)).toBe(false);
    });
  });

  describe('reto temporal creado en el login', () => {
    const admin = { id: 1, totp_secret: SECRETO };
    const codigoEn = (ms) => totp.generateTOTP(SECRETO, { time: ms });

    beforeEach(() => {
      twoFactorService.limpiarRetos();
    });

    test('sin login previo, un código correcto por sí solo no da acceso', () => {
      expect(() => twoFactorService.verificarReto(admin, codigoEn(AHORA), AHORA)).toThrow(AuthenticationError);
    });

    test('con reto vigente y código correcto se acepta, y el reto es de un solo uso', () => {
      twoFactorService.crearReto(admin.id, AHORA);
      expect(twoFactorService.verificarReto(admin, codigoEn(AHORA), AHORA)).toBe(true);
      expect(twoFactorService.tieneRetoVigente(admin.id, AHORA)).toBe(false);
      expect(() => twoFactorService.verificarReto(admin, codigoEn(AHORA), AHORA)).toThrow(AuthenticationError);
    });

    test('el reto expira a los 5 minutos', () => {
      twoFactorService.crearReto(admin.id, AHORA);
      const despues = AHORA + 5 * 60 * 1000 + 1;
      expect(twoFactorService.tieneRetoVigente(admin.id, despues)).toBe(false);
      expect(() => twoFactorService.verificarReto(admin, codigoEn(despues), despues)).toThrow('Verification code expired');
    });

    test('después de 5 intentos fallidos el reto se invalida', () => {
      twoFactorService.crearReto(admin.id, AHORA);
      for (let i = 0; i < 5; i += 1) {
        expect(() => twoFactorService.verificarReto(admin, 'abcdef', AHORA)).toThrow('Invalid verification code');
      }
      expect(() => twoFactorService.verificarReto(admin, codigoEn(AHORA), AHORA)).toThrow('Verification code expired');
    });
  });

  describe('flujo de login con 2FA (repositorio mockeado)', () => {
    let personas;

    beforeAll(async () => {
      personas = {
        admin: { id: 1, usuario: 'admin', rol: 'Administrador', estado: 'Activo', totp_secret: SECRETO, clave_hash: await hashPassword('Admin123*') },
        adminSin2fa: { id: 7, usuario: 'admin2', rol: 'Administrador', estado: 'Activo', totp_secret: null, clave_hash: await hashPassword('Admin123*') },
        empleado: { id: 3, usuario: 'ana.torres', rol: 'Empleado', estado: 'Activo', totp_secret: null, clave_hash: await hashPassword('Empleado123*') },
      };
    });

    beforeEach(() => {
      twoFactorService.limpiarRetos();
      personaRepository.findByLogin.mockImplementation(async (u) => Object.values(personas).find((p) => p.usuario === u) || null);
      personaRepository.findById.mockImplementation(async (id) => Object.values(personas).find((p) => p.id === id) || null);
    });

    test('Administrador con credenciales válidas: no recibe token, se le pide el código', async () => {
      const respuesta = await authService.login({ usuario: 'admin', clave: 'Admin123*' });
      expect(respuesta).toEqual(expect.objectContaining({ requiereOtp: true, personaId: 1 }));
      expect(respuesta).not.toHaveProperty('token');
    });

    test('código válido después del login → JWT con rol Administrador', async () => {
      await authService.login({ usuario: 'admin', clave: 'Admin123*' });
      const { token } = await authService.verificarOtp({ personaId: 1, codigo: totp.generateTOTP(SECRETO) });
      expect(jwt.decode(token)).toEqual(expect.objectContaining({ id: 1, rol: 'Administrador' }));
    });

    test('código inválido → AuthenticationError (401) y no se emite token', async () => {
      await authService.login({ usuario: 'admin', clave: 'Admin123*' });
      await expect(authService.verificarOtp({ personaId: 1, codigo: '000000x' })).rejects.toThrow(AuthenticationError);
    });

    test('verify-otp sin login previo → 401 aunque el código sea correcto', async () => {
      await expect(authService.verificarOtp({ personaId: 1, codigo: totp.generateTOTP(SECRETO) })).rejects.toThrow(AuthenticationError);
    });

    test('verify-otp para quien no es Administrador → 401', async () => {
      await expect(authService.verificarOtp({ personaId: 3, codigo: '123456' })).rejects.toThrow('Invalid verification code');
    });

    test('verify-otp sin personaId o sin código → 400', async () => {
      await expect(authService.verificarOtp({ codigo: '123456' })).rejects.toThrow(ValidationError);
      await expect(authService.verificarOtp({ personaId: 1 })).rejects.toThrow(ValidationError);
    });

    test('Administrador sin 2FA configurado → 403', async () => {
      await expect(authService.login({ usuario: 'admin2', clave: 'Admin123*' })).rejects.toThrow(ForbiddenError);
    });

    test('Empleado con credenciales válidas recibe el token directamente', async () => {
      const { token } = await authService.login({ usuario: 'ana.torres', clave: 'Empleado123*' });
      expect(jwt.decode(token)).toEqual(expect.objectContaining({ id: 3, rol: 'Empleado' }));
    });

    test('contraseña incorrecta y usuario inexistente → el mismo 401 "Invalid credentials"', async () => {
      await expect(authService.login({ usuario: 'ana.torres', clave: 'Incorrecta1*' })).rejects.toThrow('Invalid credentials');
      await expect(authService.login({ usuario: 'no.existe', clave: 'Incorrecta1*' })).rejects.toThrow('Invalid credentials');
    });

    test('campos vacíos o correo con formato inválido → 400', async () => {
      await expect(authService.login({ usuario: '', clave: '' })).rejects.toThrow(ValidationError);
      await expect(authService.login({ usuario: 'ana@correo', clave: 'x' })).rejects.toThrow('Email format is invalid');
      expect(personaRepository.findByLogin).not.toHaveBeenCalled();
    });
  });
});
