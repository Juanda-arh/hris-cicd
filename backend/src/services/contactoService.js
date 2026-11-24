'use strict';

const config = require('../config');
const personaRepository = require('../repositories/personaRepository');
const contactoRepository = require('../repositories/contactoRepository');
const auditService = require('./auditService');
const { puedeVerPersona } = require('./accesoService');
const { validarContacto } = require('../utils/validators');
const { ForbiddenError, NotFoundError, ValidationError } = require('../utils/errors');

async function listar(usuario, personaId) {
  if (usuario.rol === config.ROLES.EMPLEADO && Number(personaId) !== Number(usuario.id)) {
    throw new ForbiddenError('You can only view your own emergency contacts');
  }
  const persona = await personaRepository.findById(personaId);
  if (!persona) {
    throw new NotFoundError('Employee not found');
  }
  if (!puedeVerPersona(usuario, persona)) {
    throw new ForbiddenError('You can only view the emergency contacts of your team');
  }
  return contactoRepository.findByPersona(personaId);
}

async function crear(usuario, personaId, datos = {}) {
  if (usuario.rol !== config.ROLES.ADMIN && Number(personaId) !== Number(usuario.id)) {
    throw new ForbiddenError('You can only add emergency contacts to your own profile');
  }
  const errores = validarContacto(datos);
  if (errores.length > 0) {
    throw new ValidationError(errores.join('. '), errores);
  }
  const persona = await personaRepository.findById(personaId);
  if (!persona) {
    throw new NotFoundError('Employee not found');
  }
  const contacto = await contactoRepository.insert({
    personaId,
    nombre: String(datos.nombre).trim(),
    parentesco: String(datos.parentesco).trim(),
    telefono: String(datos.telefono).trim(),
    ciudad: datos.ciudad ? String(datos.ciudad).trim() : null,
  });
  await auditService.registrar(usuario, {
    accion: 'CREAR_CONTACTO',
    tabla: 'contactos_emergencia',
    registroId: contacto.id,
    detalle: { personaId },
  });
  return contacto;
}

module.exports = { listar, crear };
