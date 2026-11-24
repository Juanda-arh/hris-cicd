/**
 * PU-10 · Servicio de vacaciones con repositorio mockeado: validación de saldo y descuento al aprobar
 * Resultado esperado: Rechaza si excede el saldo; al aprobar descuenta exactamente los días solicitados.
 * Técnica: jest.mock sobre los repositorios (no se usa PostgreSQL).
 * Código bajo prueba: src/services/vacacionesService.js
 */
jest.mock('../../src/repositories/personaRepository');
jest.mock('../../src/repositories/permisoRepository');
jest.mock('../../src/services/auditService');

const personaRepository = require('../../src/repositories/personaRepository');
const permisoRepository = require('../../src/repositories/permisoRepository');
const auditService = require('../../src/services/auditService');
const vacacionesService = require('../../src/services/vacacionesService');
const { ConflictError, ForbiddenError, NotFoundError, ValidationError } = require('../../src/utils/errors');

const LIDER = { id: 2, rol: 'Lider' };
const EMPLEADO = { id: 3, rol: 'Empleado' };
// Del lunes 1 al viernes 5 de marzo de 2027: 5 días hábiles
const SEMANA = { fechaInicio: '2027-03-01', fechaFin: '2027-03-05' };

describe('PU-10 · Servicio de vacaciones (repositorio mockeado)', () => {
  let personas;
  let permisos;

  beforeEach(() => {
    personas = {
      2: { id: 2, rol: 'Lider', dias_vacaciones: 15, lider_id: null },
      3: { id: 3, rol: 'Empleado', dias_vacaciones: 15, lider_id: 2 },
    };
    permisos = {};

    personaRepository.findById.mockImplementation(async (id) => (personas[id] ? { ...personas[id] } : null));
    permisoRepository.sumDiasPendientes.mockResolvedValue(0);
    permisoRepository.insert.mockImplementation(async (datos) => ({
      id: 10,
      empleado_id: datos.empleadoId,
      tipo: datos.tipo,
      dias_habiles: datos.diasHabiles,
      estado: 'Pendiente',
    }));
    permisoRepository.findById.mockImplementation(async (id) => (permisos[id] ? { ...permisos[id] } : null));
    // Simula la transacción del repositorio: cambia el estado y descuenta el saldo
    permisoRepository.decidir.mockImplementation(async ({ id, estado, empleadoId, diasADescontar }) => {
      personas[empleadoId].dias_vacaciones -= diasADescontar;
      permisos[id].estado = estado;
      return { ...permisos[id] };
    });
  });

  describe('validación de saldo al solicitar', () => {
    test('días solicitados = saldo → se crea en estado Pendiente', async () => {
      personas[3].dias_vacaciones = 5;
      const permiso = await vacacionesService.solicitar(EMPLEADO, SEMANA);
      expect(permiso.estado).toBe('Pendiente');
      expect(permisoRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ empleadoId: 3, diasHabiles: 5, tipo: 'Vacaciones' }));
    });

    test('saldo + 1 → rechaza con ValidationError y no inserta', async () => {
      personas[3].dias_vacaciones = 4;
      await expect(vacacionesService.solicitar(EMPLEADO, SEMANA)).rejects.toThrow(ValidationError);
      await expect(vacacionesService.solicitar(EMPLEADO, SEMANA)).rejects.toThrow('Requested days (5) exceed the available vacation balance (4)');
      expect(permisoRepository.insert).not.toHaveBeenCalled();
    });

    test('los días de solicitudes pendientes reducen el saldo disponible', async () => {
      permisoRepository.sumDiasPendientes.mockResolvedValue(12);
      await expect(vacacionesService.solicitar(EMPLEADO, SEMANA)).rejects.toThrow('available vacation balance (3)');
      expect(permisoRepository.insert).not.toHaveBeenCalled();
    });

    test('fecha final anterior a la inicial → ValidationError', async () => {
      await expect(vacacionesService.solicitar(EMPLEADO, { fechaInicio: '2027-03-05', fechaFin: '2027-03-01' })).rejects.toThrow(ValidationError);
    });

    test('un rango sin días hábiles o un tipo desconocido → ValidationError', async () => {
      await expect(vacacionesService.solicitar(EMPLEADO, { fechaInicio: '2027-03-06', fechaFin: '2027-03-07' })).rejects.toThrow('any business day');
      await expect(vacacionesService.solicitar(EMPLEADO, { ...SEMANA, tipo: 'Licencia' })).rejects.toThrow(ValidationError);
      await expect(vacacionesService.solicitar(EMPLEADO, {})).rejects.toThrow('Start date is required');
    });

    test('una Ausencia no consume saldo de vacaciones', async () => {
      personas[3].dias_vacaciones = 0;
      await vacacionesService.solicitar(EMPLEADO, { ...SEMANA, tipo: 'Ausencia' });
      expect(permisoRepository.insert).toHaveBeenCalledTimes(1);
      expect(permisoRepository.sumDiasPendientes).not.toHaveBeenCalled();
    });

    test('el saldo informa días disponibles y comprometidos', async () => {
      permisoRepository.sumDiasPendientes.mockResolvedValue(5);
      await expect(vacacionesService.consultarSaldo(EMPLEADO)).resolves.toEqual({ diasDisponibles: 15, diasPendientes: 5, diasSolicitables: 10 });
    });
  });

  describe('descuento al aprobar', () => {
    beforeEach(() => {
      permisos[10] = { id: 10, empleado_id: 3, empleado_lider_id: 2, tipo: 'Vacaciones', dias_habiles: 5, estado: 'Pendiente' };
    });

    test('al aprobar descuenta exactamente los días solicitados', async () => {
      const resultado = await vacacionesService.decidir(LIDER, 10, { decision: 'Aprobado' });

      expect(resultado.estado).toBe('Aprobado');
      expect(permisoRepository.decidir).toHaveBeenCalledWith(
        expect.objectContaining({ id: 10, estado: 'Aprobado', decididoPor: 2, empleadoId: 3, diasADescontar: 5 }),
      );
      expect(personas[3].dias_vacaciones).toBe(10);
      expect(auditService.registrar).toHaveBeenCalledWith(LIDER, expect.objectContaining({ accion: 'APROBAR_PERMISO' }));
    });

    test('al rechazar no se descuenta ningún día', async () => {
      await vacacionesService.decidir(LIDER, 10, { decision: 'Rechazado', comentario: 'Peak season' });
      expect(permisoRepository.decidir).toHaveBeenCalledWith(expect.objectContaining({ estado: 'Rechazado', diasADescontar: 0 }));
      expect(personas[3].dias_vacaciones).toBe(15);
    });

    test('si al aprobar el saldo ya no alcanza → ConflictError y no se modifica nada', async () => {
      personas[3].dias_vacaciones = 4;
      await expect(vacacionesService.decidir(LIDER, 10, { decision: 'Aprobado' })).rejects.toThrow(ConflictError);
      expect(permisoRepository.decidir).not.toHaveBeenCalled();
    });

    test('nadie decide su propia solicitud → ForbiddenError', async () => {
      permisos[11] = { id: 11, empleado_id: 2, empleado_lider_id: null, tipo: 'Vacaciones', dias_habiles: 1, estado: 'Pendiente' };
      await expect(vacacionesService.decidir(LIDER, 11, { decision: 'Aprobado' })).rejects.toThrow('You cannot decide on your own request');
    });

    test('un líder solo decide sobre su equipo → ForbiddenError', async () => {
      permisos[10].empleado_lider_id = 99;
      await expect(vacacionesService.decidir(LIDER, 10, { decision: 'Aprobado' })).rejects.toThrow(ForbiddenError);
    });

    test('decisión inválida → ValidationError; solicitud inexistente → NotFoundError', async () => {
      await expect(vacacionesService.decidir(LIDER, 10, { decision: 'Aprobada' })).rejects.toThrow(ValidationError);
      await expect(vacacionesService.decidir(LIDER, 999, { decision: 'Aprobado' })).rejects.toThrow(NotFoundError);
    });
  });
});
