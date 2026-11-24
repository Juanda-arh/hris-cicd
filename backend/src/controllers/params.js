'use strict';

const { parseId } = require('../utils/validators');
const { ValidationError } = require('../utils/errors');

// Lee un id numérico de la ruta o del cuerpo; si no es válido responde 400
function idDe(valor, nombre = 'id') {
  const id = parseId(valor);
  if (!id) {
    throw new ValidationError(`${nombre} must be a positive whole number`);
  }
  return id;
}

module.exports = { idDe };
