'use strict';

const config = require('../config');
const personaRepository = require('../repositories/personaRepository');
const auditService = require('./auditService');
const { puedeVerPersona } = require('./accesoService');
const { hashPassword } = require('../utils/password');
const { toPersonaDTO, toPersonaListDTO } = require('../utils/personaDto');
const { validarEmpleado } = require('../utils/validators');
const { ConflictError, ForbiddenError, NotFoundError, ValidationError } = require('../utils/errors');

const { ADMIN, LIDER, EMPLEADO } = config.ROLES;

// Lo que el Administrador puede cambiar de un empleado existente
const CAMPOS_EDITABLES = ['nombre', 'telefono', 'direccion', 'eps', 'arl', 'fondoPension', 'cesantias', 'diasVacaciones', 'liderId', 'estado'];

function exigirAdministrador(usuario) {
  if (!usuario || usuario.rol !== ADMIN) {
    throw new ForbiddenError('Only an administrator can manage employees');
  }
}

function lanzarSiHayErrores(errores) {
  if (errores.length > 0) {
    throw new ValidationError(errores.join('. '), errores);
  }
}

const recortar = (valor) => (typeof valor === 'string' ? valor.trim() : valor);
const opcional = (valor) => (valor === undefined || valor === null || String(valor).trim() === '' ? undefined : recortar(valor));

// El nombre de usuario es la parte del correo antes de la @ (misma regla del frontend)
function usuarioDesdeCorreo(correo) {
  return correo.slice(0, correo.indexOf('@')).toLowerCase();
}

function mensajeDuplicado(existente, nuevo) {
  if (existente.cedula === nuevo.cedula) return 'An employee with this document number already exists';
  if (existente.correo.toLowerCase() === nuevo.correo) return 'An employee with this email already exists';
  return 'An employee with this username already exists';
}

async function validarLider(liderId, personaId = null) {
  if (personaId !== null && Number(liderId) === Number(personaId)) {
    throw new ValidationError('An employee cannot be their own leader');
  }
  const lider = await personaRepository.findById(Number(liderId));
  if (!lider || lider.rol !== LIDER) {
    throw new ValidationError('liderId must reference an existing person with role Lider');
  }
}

async function listar(usuario) {
  if (usuario.rol === ADMIN) {
    return toPersonaListDTO(await personaRepository.findAll());
  }
  if (usuario.rol === LIDER) {
    return toPersonaListDTO(await personaRepository.findByLider(usuario.id));
  }
  throw new ForbiddenError('Employees can only view their own profile');
}

async function obtener(usuario, id) {
  // Un empleado que pide otro id recibe 403 sin consultar: no se revela si el id existe
  if (usuario.rol === EMPLEADO && Number(id) !== Number(usuario.id)) {
    throw new ForbiddenError('You can only view your own profile');
  }
  const persona = await personaRepository.findById(id);
  if (!persona) {
    throw new NotFoundError('Employee not found');
  }
  if (!puedeVerPersona(usuario, persona)) {
    throw new ForbiddenError('You can only view your own profile or the profiles of your team');
  }
  return toPersonaDTO(persona);
}

async function obtenerPropio(usuario) {
  const persona = await personaRepository.findById(usuario.id);
  if (!persona) {
    throw new NotFoundError('Employee not found');
  }
  return toPersonaDTO(persona);
}

async function crear(usuario, datos = {}, { hoy } = {}) {
  exigirAdministrador(usuario);
  lanzarSiHayErrores(validarEmpleado(datos, hoy ? { hoy } : {}));

  const nuevo = {
    nombre: recortar(datos.nombre),
    cedula: recortar(datos.cedula),
    correo: recortar(datos.correo).toLowerCase(),
    fechaNacimiento: recortar(datos.fechaNacimiento),
    telefono: opcional(datos.telefono),
    direccion: opcional(datos.direccion),
    eps: recortar(datos.eps),
    arl: recortar(datos.arl),
    fondoPension: recortar(datos.fondoPension),
    cesantias: recortar(datos.cesantias),
    diasVacaciones: datos.diasVacaciones === undefined || datos.diasVacaciones === '' ? 15 : Number(datos.diasVacaciones),
    rol: datos.rol || EMPLEADO,
    liderId: opcional(datos.liderId) === undefined ? undefined : Number(datos.liderId),
  };
  nuevo.usuario = usuarioDesdeCorreo(nuevo.correo);

  const existente = await personaRepository.findDuplicado({ cedula: nuevo.cedula, correo: nuevo.correo, usuario: nuevo.usuario });
  if (existente) {
    throw new ConflictError(mensajeDuplicado(existente, nuevo));
  }
  if (nuevo.liderId !== undefined) {
    await validarLider(nuevo.liderId);
  }
  if (datos.clave) {
    nuevo.claveHash = await hashPassword(datos.clave);
  }

  const creada = await personaRepository.insert(nuevo);
  await auditService.registrar(usuario, {
    accion: 'CREAR_EMPLEADO',
    tabla: 'personas',
    registroId: creada.id,
    detalle: { cedula: nuevo.cedula, correo: nuevo.correo, rol: nuevo.rol },
  });
  return toPersonaDTO(creada);
}

async function actualizar(usuario, id, datos = {}) {
  exigirAdministrador(usuario);
  const cambios = {};
  for (const campo of CAMPOS_EDITABLES) {
    if (datos[campo] !== undefined) cambios[campo] = recortar(datos[campo]);
  }
  if (Object.keys(cambios).length === 0) {
    throw new ValidationError(`No editable fields were provided. Editable fields: ${CAMPOS_EDITABLES.join(', ')}`);
  }
  lanzarSiHayErrores(validarEmpleado(cambios, { parcial: true }));

  const actual = await personaRepository.findById(id);
  if (!actual) {
    throw new NotFoundError('Employee not found');
  }
  if (cambios.liderId !== undefined && cambios.liderId !== null && cambios.liderId !== '') {
    await validarLider(cambios.liderId, id);
    cambios.liderId = Number(cambios.liderId);
  } else if (cambios.liderId === '') {
    cambios.liderId = null;
  }
  if (cambios.diasVacaciones !== undefined) {
    cambios.diasVacaciones = Number(cambios.diasVacaciones);
  }

  const actualizada = await personaRepository.update(id, cambios);
  await auditService.registrar(usuario, {
    accion: 'ACTUALIZAR_EMPLEADO',
    tabla: 'personas',
    registroId: id,
    detalle: { campos: Object.keys(cambios) },
  });
  return toPersonaDTO(actualizada);
}

module.exports = { listar, obtener, obtenerPropio, crear, actualizar, CAMPOS_EDITABLES };
