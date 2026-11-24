'use strict';

const config = require('../config');
const personaRepository = require('../repositories/personaRepository');
const permisoRepository = require('../repositories/permisoRepository');
const auditService = require('./auditService');
const { puedeVerPersona } = require('./accesoService');
const { contarDiasHabiles } = require('../utils/dates');
const { ESTADOS, validarTransicion } = require('../utils/estadoSolicitud');
const { parseLimiteOffset } = require('../utils/paginacion');
const { ConflictError, ForbiddenError, NotFoundError, ValidationError } = require('../utils/errors');

const { ADMIN, LIDER } = config.ROLES;
const TIPOS = ['Vacaciones', 'Ausencia'];

async function obtenerPersona(id) {
  const persona = await personaRepository.findById(id);
  if (!persona) {
    throw new NotFoundError('Employee not found');
  }
  return persona;
}

// Saldo = días de vacaciones del empleado; los días en solicitudes pendientes ya están comprometidos
async function consultarSaldo(usuario) {
  const persona = await obtenerPersona(usuario.id);
  const diasPendientes = await permisoRepository.sumDiasPendientes(usuario.id);
  return {
    diasDisponibles: persona.dias_vacaciones,
    diasPendientes,
    diasSolicitables: Math.max(persona.dias_vacaciones - diasPendientes, 0),
  };
}

async function solicitar(usuario, { tipo = 'Vacaciones', fechaInicio, fechaFin, motivo } = {}) {
  if (!TIPOS.includes(tipo)) {
    throw new ValidationError('Request type must be Vacaciones or Ausencia');
  }
  if (!fechaInicio) {
    throw new ValidationError('Start date is required');
  }
  if (motivo && String(motivo).length > 300) {
    throw new ValidationError('Reason must have at most 300 characters');
  }
  const fin = fechaFin || fechaInicio;
  const dias = contarDiasHabiles(fechaInicio, fin);
  if (dias === 0) {
    throw new ValidationError('The selected dates do not include any business day');
  }

  const persona = await obtenerPersona(usuario.id);
  if (tipo === 'Vacaciones') {
    const pendientes = await permisoRepository.sumDiasPendientes(usuario.id);
    const disponibles = Math.max(persona.dias_vacaciones - pendientes, 0);
    if (dias > disponibles) {
      throw new ValidationError(`Requested days (${dias}) exceed the available vacation balance (${disponibles})`);
    }
  }

  const permiso = await permisoRepository.insert({
    empleadoId: usuario.id,
    tipo,
    fechaInicio,
    fechaFin: fin,
    diasHabiles: dias,
    motivo: motivo ? String(motivo).trim() : null,
  });
  await auditService.registrar(usuario, {
    accion: 'CREAR_PERMISO',
    tabla: 'permisos',
    registroId: permiso.id,
    detalle: { tipo, dias },
  });
  return permiso;
}

async function listarPropias(usuario, consulta = {}) {
  return permisoRepository.findByEmpleado(usuario.id, parseLimiteOffset(consulta));
}

async function listarParaRevision(usuario, consulta = {}) {
  if (![ADMIN, LIDER].includes(usuario.rol)) {
    throw new ForbiddenError('Only leaders and administrators can review requests');
  }
  const estado = consulta.estado || null;
  if (estado && !Object.values(ESTADOS).includes(estado)) {
    throw new ValidationError('estado must be Pendiente, Aprobado or Rechazado');
  }
  return permisoRepository.findParaRevision({
    liderId: usuario.rol === LIDER ? usuario.id : null,
    estado,
    ...parseLimiteOffset(consulta),
  });
}

async function obtener(usuario, id) {
  const permiso = await permisoRepository.findById(id);
  if (!permiso) {
    throw new NotFoundError('Request not found');
  }
  if (!puedeVerPersona(usuario, { id: permiso.empleado_id, lider_id: permiso.empleado_lider_id })) {
    throw new ForbiddenError('You do not have permission to view this request');
  }
  return permiso;
}

async function decidir(usuario, id, { decision, comentario } = {}) {
  if (![ESTADOS.APROBADO, ESTADOS.RECHAZADO].includes(decision)) {
    throw new ValidationError('Decision must be Aprobado or Rechazado');
  }
  if (![ADMIN, LIDER].includes(usuario.rol)) {
    throw new ForbiddenError('Only leaders and administrators can decide on requests');
  }
  const permiso = await permisoRepository.findById(id);
  if (!permiso) {
    throw new NotFoundError('Request not found');
  }
  if (Number(permiso.empleado_id) === Number(usuario.id)) {
    throw new ForbiddenError('You cannot decide on your own request');
  }
  if (usuario.rol === LIDER && Number(permiso.empleado_lider_id) !== Number(usuario.id)) {
    throw new ForbiddenError('Leaders can only decide on requests from their own team');
  }
  validarTransicion(permiso.estado, decision);

  let diasADescontar = 0;
  if (decision === ESTADOS.APROBADO && permiso.tipo === 'Vacaciones') {
    const empleado = await obtenerPersona(permiso.empleado_id);
    if (permiso.dias_habiles > empleado.dias_vacaciones) {
      throw new ConflictError('The employee does not have enough vacation days to approve this request');
    }
    diasADescontar = permiso.dias_habiles;
  }

  const actualizado = await permisoRepository.decidir({
    id,
    estado: decision,
    decididoPor: usuario.id,
    comentario: comentario ? String(comentario).trim() : null,
    empleadoId: permiso.empleado_id,
    diasADescontar,
  });
  await auditService.registrar(usuario, {
    accion: decision === ESTADOS.APROBADO ? 'APROBAR_PERMISO' : 'RECHAZAR_PERMISO',
    tabla: 'permisos',
    registroId: id,
    detalle: { diasDescontados: diasADescontar },
  });
  return actualizado;
}

module.exports = { consultarSaldo, solicitar, listarPropias, listarParaRevision, obtener, decidir, TIPOS };
