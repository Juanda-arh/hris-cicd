'use strict';

const { ConflictError, ValidationError } = require('./errors');

const ESTADOS = Object.freeze({
  PENDIENTE: 'Pendiente',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
});

// Máquina de estados de una solicitud: solo se decide una vez, desde Pendiente
const TRANSICIONES = Object.freeze({
  [ESTADOS.PENDIENTE]: [ESTADOS.APROBADO, ESTADOS.RECHAZADO],
  [ESTADOS.APROBADO]: [],
  [ESTADOS.RECHAZADO]: [],
});

function puedeTransicionar(actual, siguiente) {
  return (TRANSICIONES[actual] || []).includes(siguiente);
}

function validarTransicion(actual, siguiente) {
  if (![ESTADOS.APROBADO, ESTADOS.RECHAZADO].includes(siguiente)) {
    throw new ValidationError('Decision must be Aprobado or Rechazado');
  }
  if (!puedeTransicionar(actual, siguiente)) {
    throw new ConflictError(`State transition not allowed: the request is already ${actual}`);
  }
  return siguiente;
}

module.exports = { ESTADOS, TRANSICIONES, puedeTransicionar, validarTransicion };
