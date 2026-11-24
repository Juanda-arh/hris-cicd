/**
 * PU-05 · Middleware authorize(roles)
 * Caso del plan: permite o bloquea según el rol.
 * Resultado esperado: Rol no permitido → 403; rol permitido → next().
 * Código bajo prueba: src/middlewares/auth.js (authorize)
 */
const { authorize } = require('../../src/middlewares/auth');

function crearRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function ejecutar(middleware, usuario) {
  const req = { user: usuario };
  const res = crearRes();
  const next = jest.fn();
  middleware(req, res, next);
  return { res, next };
}

describe('PU-05 · Middleware authorize(roles)', () => {
  test('rol no permitido → 403 y no llama next()', () => {
    const { res, next } = ejecutar(authorize('Administrador'), { id: 3, rol: 'Empleado' });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'You do not have permission to perform this action' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rol permitido → next()', () => {
    const { res, next } = ejecutar(authorize('Administrador'), { id: 1, rol: 'Administrador' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  // Tabla de decisión rol × acción (la misma de los casos CN-08 y de revisión de solicitudes)
  test.each([
    ['crear empleado', ['Administrador'], 'Administrador', true],
    ['crear empleado', ['Administrador'], 'Lider', false],
    ['crear empleado', ['Administrador'], 'Empleado', false],
    ['decidir solicitud', ['Administrador', 'Lider'], 'Administrador', true],
    ['decidir solicitud', ['Administrador', 'Lider'], 'Lider', true],
    ['decidir solicitud', ['Administrador', 'Lider'], 'Empleado', false],
  ])('%s con roles %j y usuario %s → permitido: %s', (_accion, roles, rol, permitido) => {
    const { res, next } = ejecutar(authorize(...roles), { id: 9, rol });
    if (permitido) {
      expect(next).toHaveBeenCalledTimes(1);
    } else {
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  });

  test('acepta la lista de roles como arreglo', () => {
    const { next } = ejecutar(authorize(['Administrador', 'Lider']), { id: 2, rol: 'Lider' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('sin usuario autenticado (req.user vacío) → 401', () => {
    const { res, next } = ejecutar(authorize('Administrador'), undefined);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
