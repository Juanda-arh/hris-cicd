/**
 * PU-04 · Middleware de autenticación con req/res simulados
 * Resultado esperado: Sin header Authorization responde 401; con token válido adjunta req.user y llama next().
 * Técnica: mocks de req, res y next con jest.fn().
 * Código bajo prueba: src/middlewares/auth.js (authenticate)
 */
const jwt = require('jsonwebtoken');
const { authenticate } = require('../../src/middlewares/auth');
const { generateToken } = require('../../src/utils/jwt');

function crearRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('PU-04 · Middleware de autenticación (authenticate)', () => {
  test('sin header Authorization responde 401 y no llama next()', () => {
    const req = { headers: {} };
    const res = crearRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication token is missing' });
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  test('con un esquema distinto de Bearer responde 401', () => {
    const token = generateToken({ id: 3, rol: 'Empleado' });
    const res = crearRes();
    const next = jest.fn();

    authenticate({ headers: { authorization: `Basic ${token}` } }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('con token válido adjunta req.user y llama next()', () => {
    const token = generateToken({ id: 3, rol: 'Empleado' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = crearRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: 3, rol: 'Empleado' });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('con token expirado responde 401 "Token expired"', () => {
    const vencido = jwt.sign({ id: 3, rol: 'Empleado', exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
    const res = crearRes();
    const next = jest.fn();

    authenticate({ headers: { authorization: `Bearer ${vencido}` } }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
    expect(next).not.toHaveBeenCalled();
  });

  test('con token alterado responde 401 "Invalid token"', () => {
    const token = `${generateToken({ id: 3, rol: 'Empleado' })}x`;
    const res = crearRes();
    const next = jest.fn();

    authenticate({ headers: { authorization: `Bearer ${token}` } }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });
});
