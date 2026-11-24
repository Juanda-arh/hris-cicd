/**
 * PU-08 · Validador de datos de empleado
 * Caso del plan: campos obligatorios (EPS, ARL, fondo de pensión, cesantías), formato de correo y documento.
 * Resultado esperado: Retorna la lista de errores en inglés para datos inválidos y ninguno para datos válidos.
 * Código bajo prueba: src/utils/validators.js (validarEmpleado)
 */
const { validarEmpleado } = require('../../src/utils/validators');

describe('PU-08 · Validador de datos de empleado', () => {
  const HOY = '2026-10-17';
  const VALIDO = {
    nombre: 'Ana María Torres',
    cedula: '1094567890',
    correo: 'ana.torres@msmechanical.test',
    fechaNacimiento: '1995-06-15',
    telefono: '3001234567',
    eps: 'Sura',
    arl: 'Positiva',
    fondoPension: 'Porvenir',
    cesantias: 'Protección',
    diasVacaciones: 15,
  };
  const validar = (cambios) => validarEmpleado({ ...VALIDO, ...cambios }, { hoy: HOY });

  test('datos válidos → ningún error', () => {
    expect(validar({})).toEqual([]);
  });

  test.each([
    ['eps', 'EPS (health insurance) is required'],
    ['arl', 'ARL (occupational risk insurer) is required'],
    ['fondoPension', 'Pension fund is required'],
    ['cesantias', 'Severance fund is required'],
  ])('sin %s → "%s"', (campo, mensaje) => {
    expect(validar({ [campo]: '' })).toEqual([mensaje]);
    expect(validar({ [campo]: undefined })).toEqual([mensaje]);
  });

  test.each(['ana.torres@', 'ana.torres.com', 'ana torres@correo.com', '@correo.com'])('correo "%s" → error de formato', (correo) => {
    expect(validar({ correo })).toEqual(['Email format is invalid']);
  });

  test.each(['12A4567', '12345', '12345678901', '10.945.678'])('documento "%s" → error de formato', (cedula) => {
    expect(validar({ cedula })).toEqual(['Document number must contain 6 to 10 digits']);
  });

  test('un objeto vacío devuelve todos los obligatorios, en inglés', () => {
    expect(validarEmpleado({}, { hoy: HOY })).toEqual([
      'Full name is required',
      'Document number is required',
      'Email is required',
      'Date of birth is required',
      'EPS (health insurance) is required',
      'ARL (occupational risk insurer) is required',
      'Pension fund is required',
      'Severance fund is required',
    ]);
  });

  test('edad mínima (18): exactamente 18 años es válido; un día menos no', () => {
    expect(validar({ fechaNacimiento: '2008-10-17' })).toEqual([]);
    expect(validar({ fechaNacimiento: '2008-10-18' })).toEqual(['Employee must be at least 18 years old']);
  });

  test('fecha de nacimiento futura o inválida', () => {
    expect(validar({ fechaNacimiento: '2030-01-01' })).toEqual(['Date of birth cannot be in the future']);
    expect(validar({ fechaNacimiento: '1995-02-30' })).toEqual(['Date of birth must be a valid date in the format YYYY-MM-DD']);
  });

  test('campos opcionales con formato inválido', () => {
    expect(validar({ telefono: '300123' })).toEqual(['Phone number must contain exactly 10 digits']);
    expect(validar({ diasVacaciones: 400 })).toEqual(['Vacation days must be a whole number between 0 and 365']);
    expect(validar({ rol: 'Administrador' })).toEqual(['Role must be Lider or Empleado']);
    expect(validar({ clave: 'corta' })).toEqual(['Password must have at least 8 characters, including letters and numbers']);
  });

  test('en modo parcial (actualización) solo valida los campos enviados', () => {
    expect(validarEmpleado({ eps: 'Sanitas' }, { hoy: HOY, parcial: true })).toEqual([]);
    expect(validarEmpleado({ correo: 'malo' }, { hoy: HOY, parcial: true })).toEqual(['Email format is invalid']);
  });
});
