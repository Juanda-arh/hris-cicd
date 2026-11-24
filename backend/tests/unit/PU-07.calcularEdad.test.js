/**
 * PU-07 · calcularEdad(fechaNacimiento) a partir de la fecha de nacimiento
 * Resultado esperado: Edad correcta cuando el cumpleaños es hoy, mañana y para nacidos un 29 de febrero.
 * Técnica: valores límite. Regla: quien nació un 29 de febrero cumple el 1 de marzo en años no bisiestos.
 * Código bajo prueba: src/utils/dates.js
 */
const { calcularEdad } = require('../../src/utils/dates');
const { ValidationError } = require('../../src/utils/errors');

describe('PU-07 · calcularEdad(fechaNacimiento)', () => {
  const HOY = '2026-10-17';

  test('cumpleaños hoy: ya cumplió los años', () => {
    expect(calcularEdad('2000-10-17', HOY)).toBe(26);
  });

  test('cumpleaños mañana: todavía no los cumple', () => {
    expect(calcularEdad('2000-10-18', HOY)).toBe(25);
  });

  test('cumpleaños ayer: ya cumplió los años', () => {
    expect(calcularEdad('2000-10-16', HOY)).toBe(26);
  });

  describe('nacidos un 29 de febrero', () => {
    test('año no bisiesto, 28 de febrero: todavía no cumple', () => {
      expect(calcularEdad('2000-02-29', '2023-02-28')).toBe(22);
    });

    test('año no bisiesto, 1 de marzo: ya cumplió', () => {
      expect(calcularEdad('2000-02-29', '2023-03-01')).toBe(23);
    });

    test('año bisiesto: cumple el 29 de febrero y no el 28', () => {
      expect(calcularEdad('2000-02-29', '2024-02-28')).toBe(23);
      expect(calcularEdad('2000-02-29', '2024-02-29')).toBe(24);
    });
  });

  test('sin fecha de referencia usa la fecha actual (temporizador simulado)', () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 17, 12, 0, 0) });
    try {
      expect(calcularEdad('2008-10-17')).toBe(18);
      expect(calcularEdad('2008-10-18')).toBe(17);
    } finally {
      jest.useRealTimers();
    }
  });

  test('el mismo día de nacimiento tiene 0 años', () => {
    expect(calcularEdad(HOY, HOY)).toBe(0);
  });

  test('una fecha de nacimiento futura lanza ValidationError', () => {
    expect(() => calcularEdad('2026-10-18', HOY)).toThrow(ValidationError);
  });

  test('fechas imposibles o con otro formato lanzan ValidationError', () => {
    expect(() => calcularEdad('2023-02-29', HOY)).toThrow(ValidationError);
    expect(() => calcularEdad('17/10/2000', HOY)).toThrow(ValidationError);
  });
});
