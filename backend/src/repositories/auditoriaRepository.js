'use strict';

const db = require('../db/pool');

async function insert({ personaId, accion, tablaAfectada, registroId, detalle }) {
  const { rows } = await db.query(
    `INSERT INTO auditoria (persona_id, accion, tabla_afectada, registro_id, detalle)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [personaId, accion, tablaAfectada, registroId ?? null, detalle ? JSON.stringify(detalle) : null],
  );
  return rows[0];
}

async function list({ fechaInicio = null, fechaFin = null, personaId = null, accion = null }, { limite, offset }) {
  const filtros = `
      WHERE ($1::date IS NULL OR a.fecha >= $1::date)
        AND ($2::date IS NULL OR a.fecha < $2::date + 1)
        AND ($3::int IS NULL OR a.persona_id = $3)
        AND ($4::text IS NULL OR a.accion = $4)`;
  const parametros = [fechaInicio, fechaFin, personaId, accion];
  const [registros, total] = await Promise.all([
    db.query(
      `SELECT a.id, a.persona_id, p.nombre AS persona_nombre, p.usuario, p.rol,
              a.accion, a.tabla_afectada, a.registro_id, a.detalle, a.fecha
         FROM auditoria a JOIN personas p ON p.id = a.persona_id
       ${filtros}
        ORDER BY a.fecha DESC, a.id DESC
        LIMIT $5 OFFSET $6`,
      [...parametros, limite, offset],
    ),
    db.query(`SELECT COUNT(*)::int AS total FROM auditoria a ${filtros}`, parametros),
  ]);
  return { registros: registros.rows, total: total.rows[0].total };
}

module.exports = { insert, list };
