/**
 * PU-13 · Servicio de auditoría
 * Resultado esperado: Registra la acción cuando existe usuario autenticado; no registra acciones del sistema (sin usuario).
 * Técnica: jest.mock sobre el repositorio de auditoría.
 * Código bajo prueba: src/services/auditService.js
 */
jest.mock('../../src/repositories/auditoriaRepository');

const auditoriaRepository = require('../../src/repositories/auditoriaRepository');
const auditService = require('../../src/services/auditService');
const { ValidationError } = require('../../src/utils/errors');

const ADMIN = { id: 1, rol: 'Administrador' };
const ACCION = { accion: 'ACTUALIZAR_EMPLEADO', tabla: 'personas', registroId: 3, detalle: { campos: ['eps'] } };

describe('PU-13 · Servicio de auditoría', () => {
  beforeEach(() => {
    auditoriaRepository.insert.mockImplementation(async (datos) => ({ id: 1, ...datos, fecha: new Date() }));
  });

  test('registra la acción cuando existe usuario autenticado', async () => {
    const registro = await auditService.registrar(ADMIN, ACCION);

    expect(auditoriaRepository.insert).toHaveBeenCalledTimes(1);
    expect(auditoriaRepository.insert).toHaveBeenCalledWith({
      personaId: 1,
      accion: 'ACTUALIZAR_EMPLEADO',
      tablaAfectada: 'personas',
      registroId: 3,
      detalle: { campos: ['eps'] },
    });
    expect(registro).toEqual(expect.objectContaining({ personaId: 1, accion: 'ACTUALIZAR_EMPLEADO', fecha: expect.any(Date) }));
  });

  test.each([
    ['null', null],
    ['undefined', undefined],
    ['sin id', { rol: 'Administrador' }],
  ])('no registra acciones del sistema (usuario %s)', async (_caso, usuario) => {
    await expect(auditService.registrar(usuario, ACCION)).resolves.toBeNull();
    expect(auditoriaRepository.insert).not.toHaveBeenCalled();
  });

  test('una entrada sin acción o sin tabla es un error de programación', async () => {
    await expect(auditService.registrar(ADMIN, { tabla: 'personas' })).rejects.toThrow(TypeError);
    await expect(auditService.registrar(ADMIN, { accion: 'X' })).rejects.toThrow(TypeError);
    expect(auditoriaRepository.insert).not.toHaveBeenCalled();
  });

  test('listar pagina y pasa los filtros al repositorio', async () => {
    auditoriaRepository.list.mockResolvedValue({ registros: [{ id: 1 }], total: 45 });

    const resultado = await auditService.listar({ pagina: '2', porPagina: '20', accion: 'CREAR_EMPLEADO', personaId: '1', fechaInicio: '2026-10-01' });

    expect(auditoriaRepository.list).toHaveBeenCalledWith(
      { fechaInicio: '2026-10-01', fechaFin: null, personaId: 1, accion: 'CREAR_EMPLEADO' },
      { limite: 20, offset: 20 },
    );
    expect(resultado).toEqual({ registros: [{ id: 1 }], total: 45, pagina: 2, porPagina: 20, totalPaginas: 3 });
  });

  test('listar rechaza filtros mal formados', async () => {
    await expect(auditService.listar({ fechaInicio: '01/10/2026' })).rejects.toThrow(ValidationError);
    await expect(auditService.listar({ personaId: 'abc' })).rejects.toThrow(ValidationError);
    await expect(auditService.listar({ pagina: '0' })).rejects.toThrow(ValidationError);
    expect(auditoriaRepository.list).not.toHaveBeenCalled();
  });
});
