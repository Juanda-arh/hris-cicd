'use strict';

const db = require('../db/pool');

async function findByPersona(personaId, { anio = null } = {}) {
  const { rows } = await db.query(
    `SELECT id, persona_id, periodo, fecha_pago AS fecha, salario_base, deducciones, neto
       FROM comprobantes_pago
      WHERE persona_id = $1 AND ($2::int IS NULL OR EXTRACT(YEAR FROM periodo) = $2)
      ORDER BY periodo DESC`,
    [personaId, anio],
  );
  return rows;
}

module.exports = { findByPersona };
