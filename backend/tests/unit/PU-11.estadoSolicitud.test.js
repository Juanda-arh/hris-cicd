/**
 * PU-11 · Transición de estados de una solicitud
 * Resultado esperado: Pendiente → Aprobada/Rechazada permitido; desde Aprobada o Rechazada lanza error.
 * En la API los estados se llaman Pendiente, Aprobado y Rechazado (los mismos valores que usa el frontend).
 * Código bajo prueba: src/utils/estadoSolicitud.js
 */
const { ESTADOS, puedeTransicionar, validarTransicion } = require('../../src/utils/estadoSolicitud');
const { ConflictError, ValidationError } = require('../../src/utils/errors');

describe('PU-11 · Transición de estados de una solicitud', () => {
  test.each([
    ['Pendiente', 'Aprobado'],
    ['Pendiente', 'Rechazado'],
  ])('%s → %s está permitido', (actual, siguiente) => {
    expect(puedeTransicionar(actual, siguiente)).toBe(true);
    expect(validarTransicion(actual, siguiente)).toBe(siguiente);
  });

  test.each([
    ['Aprobado', 'Aprobado'],
    ['Aprobado', 'Rechazado'],
    ['Rechazado', 'Aprobado'],
    ['Rechazado', 'Rechazado'],
  ])('%s → %s lanza ConflictError (HTTP 409)', (actual, siguiente) => {
    expect(puedeTransicionar(actual, siguiente)).toBe(false);
    expect(() => validarTransicion(actual, siguiente)).toThrow(ConflictError);
    expect(() => validarTransicion(actual, siguiente)).toThrow(`State transition not allowed: the request is already ${actual}`);
  });

  test('el error de transición tiene statusCode 409', () => {
    try {
      validarTransicion(ESTADOS.APROBADO, ESTADOS.RECHAZADO);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.statusCode).toBe(409);
    }
  });

  test('no se puede "volver" a Pendiente: es una decisión inválida (400)', () => {
    expect(() => validarTransicion(ESTADOS.PENDIENTE, ESTADOS.PENDIENTE)).toThrow(ValidationError);
    expect(() => validarTransicion(ESTADOS.APROBADO, 'Cancelado')).toThrow(ValidationError);
  });

  test('un estado desconocido no permite transiciones', () => {
    expect(puedeTransicionar('Desconocido', ESTADOS.APROBADO)).toBe(false);
  });
});
