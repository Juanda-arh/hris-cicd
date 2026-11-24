'use strict';

const { Pool, types } = require('pg');
const config = require('../config');

// DATE (OID 1082) llega como texto 'YYYY-MM-DD': sin conversión a Date ni corrimientos por zona horaria
types.setTypeParser(1082, (valor) => valor);
// NUMERIC (OID 1700) llega como número
types.setTypeParser(1700, (valor) => (valor === null ? null : Number(valor)));

let pool = null;

// El pool se crea de forma perezosa: importar este módulo no abre conexiones
function getPool() {
  if (!pool) {
    pool = new Pool({ max: 10, ...config.database });
    pool.on('error', (err) => {
      console.error('[db] Unexpected error on idle client:', err.message);
    });
  }
  return pool;
}

function query(texto, parametros) {
  return getPool().query(texto, parametros);
}

async function withTransaction(trabajo) {
  const cliente = await getPool().connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await trabajo(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    cliente.release();
  }
}

async function close() {
  if (pool) {
    const actual = pool;
    pool = null;
    await actual.end();
  }
}

module.exports = { query, withTransaction, close };
