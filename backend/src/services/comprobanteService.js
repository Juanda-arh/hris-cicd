'use strict';

const comprobanteRepository = require('../repositories/comprobanteRepository');
const { ValidationError } = require('../utils/errors');

// Solo los comprobantes de la persona autenticada: el id sale del token, nunca de la petición
async function listarPropios(usuario, { anio } = {}) {
  let filtroAnio = null;
  if (anio !== undefined && anio !== '') {
    filtroAnio = Number(anio);
    if (!Number.isInteger(filtroAnio) || filtroAnio < 2000 || filtroAnio > 2100) {
      throw new ValidationError('anio must be a year between 2000 and 2100');
    }
  }
  return comprobanteRepository.findByPersona(usuario.id, { anio: filtroAnio });
}

module.exports = { listarPropios };
