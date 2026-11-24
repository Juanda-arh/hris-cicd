/**
 * PU-09 · Cálculo de días de una solicitud de vacaciones a partir del rango de fechas
 * Resultado esperado: Cantidad de días correcta; lanza error si la fecha final es anterior a la inicial.
 * Regla: se cuentan días hábiles (lunes a viernes), con ambas fechas incluidas.
 * Código bajo prueba: src/utils/dates.js (contarDiasHabiles)
 */
const { contarDiasHabiles } = require('../../src/utils/dates');
const { ValidationError } = require('../../src/utils/errors');

describe('PU-09 · Cálculo de días de una solicitud de vacaciones', () => {
  test('de lunes a viernes de la misma semana son 5 días hábiles', () => {
    expect(contarDiasHabiles('2027-03-01', '2027-03-05')).toBe(5);
  });

  test('una solicitud de un solo día (inicio = fin) cuenta 1 día', () => {
    expect(contarDiasHabiles('2027-03-03', '2027-03-03')).toBe(1);
  });

  test('de viernes a lunes son 2 días: el fin de semana no cuenta', () => {
    expect(contarDiasHabiles('2027-03-05', '2027-03-08')).toBe(2);
  });

  test('un rango solo de fin de semana tiene 0 días hábiles', () => {
    expect(contarDiasHabiles('2027-03-06', '2027-03-07')).toBe(0);
  });

  test('dos semanas completas son 10 días hábiles', () => {
    expect(contarDiasHabiles('2027-03-01', '2027-03-12')).toBe(10);
  });

  test('cruza el 29 de febrero de un año bisiesto', () => {
    expect(contarDiasHabiles('2028-02-28', '2028-03-01')).toBe(3);
  });

  test('lanza ValidationError si la fecha final es anterior a la inicial', () => {
    expect(() => contarDiasHabiles('2027-03-05', '2027-03-01')).toThrow(ValidationError);
    expect(() => contarDiasHabiles('2027-03-05', '2027-03-01')).toThrow('The end date cannot be before the start date');
  });

  test('lanza ValidationError con fechas mal escritas o inexistentes', () => {
    expect(() => contarDiasHabiles('2027/03/01', '2027-03-05')).toThrow(ValidationError);
    expect(() => contarDiasHabiles('2027-02-30', '2027-03-05')).toThrow(ValidationError);
  });
});
