'use strict';

const { ValidationError } = require('./errors');

function entero(valor, porDefecto, minimo, maximo, mensaje) {
  if (valor === undefined || valor === null || valor === '') return porDefecto;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
    throw new ValidationError(mensaje);
  }
  return numero;
}

// ?limite=&offset= (máximo 100 por página, como espera el frontend)
function parseLimiteOffset({ limite, offset } = {}) {
  return {
    limite: entero(limite, 100, 1, 100, 'limite must be a whole number between 1 and 100'),
    offset: entero(offset, 0, 0, Number.MAX_SAFE_INTEGER, 'offset must be a whole number greater than or equal to 0'),
  };
}

// ?pagina=&porPagina= (auditoría)
function parsePagina({ pagina, porPagina } = {}) {
  const numeroPagina = entero(pagina, 1, 1, Number.MAX_SAFE_INTEGER, 'pagina must be a whole number greater than 0');
  const tamanio = entero(porPagina, 20, 1, 100, 'porPagina must be a whole number between 1 and 100');
  return { pagina: numeroPagina, porPagina: tamanio, limite: tamanio, offset: (numeroPagina - 1) * tamanio };
}

module.exports = { parseLimiteOffset, parsePagina };
