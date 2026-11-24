'use strict';

const auditoriaRepository = require('../repositories/auditoriaRepository');
const { esFechaValida } = require('../utils/dates');
const { ValidationError } = require('../utils/errors');
const { parsePagina } = require('../utils/paginacion');
const { parseId } = require('../utils/validators');

// Registra una acción hecha por un usuario autenticado.
// Las acciones del sistema (sin usuario: semillas, tareas automáticas) no se auditan y devuelven null.
async function registrar(usuario, { accion, tabla, registroId = null, detalle = null } = {}) {
  if (!usuario || usuario.id === undefined || usuario.id === null) {
    return null;
  }
  if (!accion || !tabla) {
    throw new TypeError('Audit entries require an action and a table');
  }
  return auditoriaRepository.insert({
    personaId: usuario.id,
    accion,
    tablaAfectada: tabla,
    registroId,
    detalle,
  });
}

async function listar(consulta = {}) {
  const { fechaInicio, fechaFin, personaId, accion } = consulta;
  for (const [nombre, valor] of Object.entries({ fechaInicio, fechaFin })) {
    if (valor && !esFechaValida(valor)) {
      throw new ValidationError(`${nombre} must be a valid date in the format YYYY-MM-DD`);
    }
  }
  if (personaId && !parseId(personaId)) {
    throw new ValidationError('personaId must be a positive whole number');
  }
  const { pagina, porPagina, limite, offset } = parsePagina(consulta);
  const { registros, total } = await auditoriaRepository.list(
    {
      fechaInicio: fechaInicio || null,
      fechaFin: fechaFin || null,
      personaId: personaId ? Number(personaId) : null,
      accion: accion || null,
    },
    { limite, offset },
  );
  return { registros, total, pagina, porPagina, totalPaginas: Math.ceil(total / porPagina) };
}

module.exports = { registrar, listar };
