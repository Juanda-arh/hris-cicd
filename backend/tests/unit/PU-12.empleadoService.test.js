/**
 * PU-12 · Servicio de empleados: creación con documento duplicado
 * Caso del plan: el repositorio mockeado retorna un registro existente.
 * Resultado esperado: Lanza ConflictError y no invoca el método de inserción.
 * Técnica: jest.mock sobre el repositorio de personas (no se usa PostgreSQL).
 * Código bajo prueba: src/services/empleadoService.js
 */
jest.mock('../../src/repositories/personaRepository');
jest.mock('../../src/services/auditService');

const personaRepository = require('../../src/repositories/personaRepository');
const auditService = require('../../src/services/auditService');
const empleadoService = require('../../src/services/empleadoService');
const { ConflictError, ForbiddenError, NotFoundError, ValidationError } = require('../../src/utils/errors');

const ADMIN = { id: 1, rol: 'Administrador' };
const LIDER = { id: 2, rol: 'Lider' };
const EMPLEADO = { id: 3, rol: 'Empleado' };

const NUEVO = {
  nombre: 'Laura Pérez',
  cedula: '1094000111',
  correo: 'Laura.Perez@MSMechanical.test',
  fechaNacimiento: '1994-04-10',
  eps: 'Sura',
  arl: 'Positiva',
  fondoPension: 'Porvenir',
  cesantias: 'Protección',
  liderId: 2,
  clave: 'Empleado123*',
};

describe('PU-12 · Servicio de empleados', () => {
  beforeEach(() => {
    personaRepository.findDuplicado.mockResolvedValue(null);
    personaRepository.findById.mockImplementation(async (id) => ({
      1: { id: 1, rol: 'Administrador', lider_id: null },
      2: { id: 2, rol: 'Lider', lider_id: null },
      3: { id: 3, rol: 'Empleado', lider_id: 2, clave_hash: 'hash' },
      4: { id: 4, rol: 'Empleado', lider_id: 99 },
    })[id] || null);
    personaRepository.insert.mockImplementation(async (datos) => ({ id: 50, ...datos, clave_hash: datos.claveHash }));
  });

  describe('creación con duplicados', () => {
    test('documento duplicado → ConflictError y no invoca insert', async () => {
      personaRepository.findDuplicado.mockResolvedValue({ id: 4, cedula: NUEVO.cedula, correo: 'otra@msmechanical.test', usuario: 'otra' });

      await expect(empleadoService.crear(ADMIN, NUEVO)).rejects.toThrow(ConflictError);
      await expect(empleadoService.crear(ADMIN, NUEVO)).rejects.toThrow('An employee with this document number already exists');
      expect(personaRepository.insert).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    test('correo duplicado (sin importar mayúsculas) → ConflictError y no invoca insert', async () => {
      personaRepository.findDuplicado.mockResolvedValue({ id: 4, cedula: '999999', correo: 'laura.perez@msmechanical.test', usuario: 'laura.perez' });

      await expect(empleadoService.crear(ADMIN, NUEVO)).rejects.toThrow('An employee with this email already exists');
      expect(personaRepository.insert).not.toHaveBeenCalled();
    });

    test('se busca el duplicado por documento, correo normalizado y usuario', async () => {
      await empleadoService.crear(ADMIN, NUEVO);
      expect(personaRepository.findDuplicado).toHaveBeenCalledWith({
        cedula: '1094000111',
        correo: 'laura.perez@msmechanical.test',
        usuario: 'laura.perez',
      });
    });
  });

  describe('creación válida', () => {
    test('sin duplicados inserta una vez, guarda el hash y no devuelve secretos', async () => {
      const creado = await empleadoService.crear(ADMIN, NUEVO);

      expect(personaRepository.insert).toHaveBeenCalledTimes(1);
      const insertado = personaRepository.insert.mock.calls[0][0];
      expect(insertado).toEqual(expect.objectContaining({ rol: 'Empleado', diasVacaciones: 15, usuario: 'laura.perez', liderId: 2 }));
      expect(insertado.claveHash).toMatch(/^\$2[aby]\$/);
      expect(creado).not.toHaveProperty('clave_hash');
      expect(auditService.registrar).toHaveBeenCalledWith(ADMIN, expect.objectContaining({ accion: 'CREAR_EMPLEADO', registroId: 50 }));
    });

    test('datos inválidos → ValidationError sin consultar duplicados', async () => {
      await expect(empleadoService.crear(ADMIN, { ...NUEVO, eps: '' })).rejects.toThrow(ValidationError);
      expect(personaRepository.findDuplicado).not.toHaveBeenCalled();
    });

    test('un liderId que no es Líder → ValidationError', async () => {
      await expect(empleadoService.crear(ADMIN, { ...NUEVO, liderId: 3 })).rejects.toThrow('liderId must reference an existing person with role Lider');
      expect(personaRepository.insert).not.toHaveBeenCalled();
    });

    test('solo el Administrador crea empleados', async () => {
      await expect(empleadoService.crear(LIDER, NUEVO)).rejects.toThrow(ForbiddenError);
      await expect(empleadoService.crear(EMPLEADO, NUEVO)).rejects.toThrow(ForbiddenError);
      expect(personaRepository.findDuplicado).not.toHaveBeenCalled();
    });
  });

  describe('consulta y actualización', () => {
    test('Empleado ve su perfil y recibe 403 con el de otro (sin consultar la BD)', async () => {
      await expect(empleadoService.obtener(EMPLEADO, 3)).resolves.toEqual(expect.objectContaining({ id: 3 }));
      personaRepository.findById.mockClear();
      await expect(empleadoService.obtener(EMPLEADO, 4)).rejects.toThrow(ForbiddenError);
      expect(personaRepository.findById).not.toHaveBeenCalled();
    });

    test('Líder ve a su equipo pero no a otros; Admin ve a todos', async () => {
      await expect(empleadoService.obtener(LIDER, 3)).resolves.toEqual(expect.objectContaining({ id: 3 }));
      await expect(empleadoService.obtener(LIDER, 4)).rejects.toThrow(ForbiddenError);
      await expect(empleadoService.obtener(ADMIN, 4)).resolves.toEqual(expect.objectContaining({ id: 4 }));
      await expect(empleadoService.obtener(ADMIN, 404)).rejects.toThrow(NotFoundError);
    });

    test('listar: Admin todos, Líder su equipo, Empleado 403', async () => {
      personaRepository.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      personaRepository.findByLider.mockResolvedValue([{ id: 3 }]);
      await expect(empleadoService.listar(ADMIN)).resolves.toHaveLength(2);
      await expect(empleadoService.listar(LIDER)).resolves.toHaveLength(1);
      expect(personaRepository.findByLider).toHaveBeenCalledWith(2);
      await expect(empleadoService.listar(EMPLEADO)).rejects.toThrow(ForbiddenError);
    });

    test('obtenerPropio devuelve el perfil del token', async () => {
      await expect(empleadoService.obtenerPropio(EMPLEADO)).resolves.toEqual(expect.objectContaining({ id: 3 }));
      await expect(empleadoService.obtenerPropio({ id: 404, rol: 'Empleado' })).rejects.toThrow(NotFoundError);
    });

    test('el Administrador actualiza campos editables y queda auditado', async () => {
      personaRepository.update.mockResolvedValue({ id: 3, eps: 'Sanitas', dias_vacaciones: 20 });
      const actualizado = await empleadoService.actualizar(ADMIN, 3, { eps: 'Sanitas', diasVacaciones: '20', cedula: '1' });

      expect(personaRepository.update).toHaveBeenCalledWith(3, { eps: 'Sanitas', diasVacaciones: 20 });
      expect(actualizado.eps).toBe('Sanitas');
      expect(auditService.registrar).toHaveBeenCalledWith(ADMIN, expect.objectContaining({ accion: 'ACTUALIZAR_EMPLEADO', registroId: 3 }));
    });

    test('actualizar sin campos editables, con datos inválidos o sobre un id inexistente falla', async () => {
      await expect(empleadoService.actualizar(ADMIN, 3, { cedula: '123' })).rejects.toThrow('No editable fields were provided');
      await expect(empleadoService.actualizar(ADMIN, 3, { telefono: '12' })).rejects.toThrow(ValidationError);
      await expect(empleadoService.actualizar(ADMIN, 404, { eps: 'Sura' })).rejects.toThrow(NotFoundError);
      await expect(empleadoService.actualizar(ADMIN, 2, { liderId: 2 })).rejects.toThrow('An employee cannot be their own leader');
      await expect(empleadoService.actualizar(LIDER, 3, { eps: 'Sura' })).rejects.toThrow(ForbiddenError);
      expect(personaRepository.update).not.toHaveBeenCalled();
    });
  });
});
