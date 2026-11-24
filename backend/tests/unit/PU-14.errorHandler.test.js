/**
 * PU-14 · Manejador global de errores
 * Resultado esperado: Mapea cada tipo de error a su código HTTP con mensaje en inglés; no expone el stack trace en producción.
 * Código bajo prueba: src/middlewares/errorHandler.js (más una petición real a la app de Express, sin base de datos)
 */
const { errorHandler, notFoundHandler } = require('../../src/middlewares/errorHandler');
const { createApp } = require('../../src/app');
const {
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} = require('../../src/utils/errors');

function crearRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function manejar(error) {
  const res = crearRes();
  errorHandler(error, {}, res, jest.fn());
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
}

describe('PU-14 · Manejador global de errores', () => {
  const entornoOriginal = process.env.NODE_ENV;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = entornoOriginal;
  });

  test.each([
    [new ValidationError('The end date cannot be before the start date'), 400],
    [new AuthenticationError('Invalid credentials'), 401],
    [new ForbiddenError('You can only view your own profile'), 403],
    [new NotFoundError('Employee not found'), 404],
    [new ConflictError('An employee with this document number already exists'), 409],
  ])('%s → HTTP %i con el mismo mensaje en inglés', (error, codigo) => {
    const { status, body } = manejar(error);
    expect(status).toBe(codigo);
    expect(body).toEqual({ error: error.message });
  });

  test('incluye el detalle de los errores de validación', () => {
    const { body } = manejar(new ValidationError('Email is required. EPS is required', ['Email is required', 'EPS is required']));
    expect(body.details).toEqual(['Email is required', 'EPS is required']);
  });

  test('JSON mal formado (body-parser) → 400', () => {
    const error = Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed', status: 400 });
    expect(manejar(error)).toEqual({ status: 400, body: { error: 'Malformed JSON in request body' } });
  });

  test('cuerpo demasiado grande → 413', () => {
    expect(manejar({ type: 'entity.too.large' }).status).toBe(413);
  });

  test('violación de unicidad de PostgreSQL (23505) → 409', () => {
    const error = Object.assign(new Error('duplicate key value violates unique constraint "personas_cedula_key"'), { code: '23505' });
    const { status, body } = manejar(error);
    expect(status).toBe(409);
    expect(body.error).toBe('A record with the same unique data already exists');
    expect(body.error).not.toContain('personas_cedula_key');
  });

  test('en producción un error inesperado → 500 "Internal server error" sin stack trace', () => {
    process.env.NODE_ENV = 'production';
    const { status, body } = manejar(new Error('connection to 10.0.0.5 refused'));
    expect(status).toBe(500);
    expect(body).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(body)).not.toMatch(/at .*\.js|10\.0\.0\.5/);
  });

  test('en desarrollo el 500 incluye el stack para depurar', () => {
    process.env.NODE_ENV = 'development';
    const { body } = manejar(new Error('boom'));
    expect(body.error).toBe('Internal server error');
    expect(body.stack).toContain('Error: boom');
  });

  test('ruta inexistente → NotFoundError (404)', () => {
    const next = jest.fn();
    notFoundHandler({ method: 'GET', path: '/api/nada' }, {}, next);
    expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    expect(next.mock.calls[0][0].message).toBe('Route not found: GET /api/nada');
  });

  describe('integrado en la app de Express (sin base de datos)', () => {
    let servidor;
    let base;

    beforeAll(async () => {
      servidor = createApp().listen(0);
      await new Promise((resolve) => servidor.once('listening', resolve));
      base = `http://127.0.0.1:${servidor.address().port}`;
    });

    afterAll(async () => {
      await new Promise((resolve) => servidor.close(resolve));
    });

    test('POST con JSON inválido → 400', async () => {
      const respuesta = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"usuario": ' });
      expect(respuesta.status).toBe(400);
      await expect(respuesta.json()).resolves.toEqual({ error: 'Malformed JSON in request body' });
    });

    test('endpoint protegido sin token → 401; ruta desconocida → 404', async () => {
      expect((await fetch(`${base}/api/empleados`)).status).toBe(401);
      expect((await fetch(`${base}/api/no-existe`)).status).toBe(404);
    });
  });
});
