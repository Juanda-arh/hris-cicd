'use strict';

const db = require('../db/pool');
const { ConflictError } = require('../utils/errors');

const SELECT_PERMISO = `
  SELECT s.*, e.nombre AS empleado_nombre, e.lider_id AS empleado_lider_id,
         d.nombre AS aprobado_por_nombre
    FROM permisos s
    JOIN personas e ON e.id = s.empleado_id
    LEFT JOIN personas d ON d.id = s.decidido_por`;

async function findById(id) {
  const { rows } = await db.query(`${SELECT_PERMISO} WHERE s.id = $1`, [id]);
  return rows[0] || null;
}

async function findByEmpleado(empleadoId, { limite = 100, offset = 0 } = {}) {
  const { rows } = await db.query(
    `${SELECT_PERMISO} WHERE s.empleado_id = $1 ORDER BY s.fecha_solicitud DESC, s.id DESC LIMIT $2 OFFSET $3`,
    [empleadoId, limite, offset],
  );
  return rows;
}

// Solicitudes para revisar: todas (Administrador) o las del equipo de un líder
async function findParaRevision({ liderId = null, estado = null, limite = 100, offset = 0 } = {}) {
  const { rows } = await db.query(
    `${SELECT_PERMISO}
      WHERE ($1::int IS NULL OR e.lider_id = $1)
        AND ($2::text IS NULL OR s.estado = $2)
      ORDER BY s.fecha_solicitud DESC, s.id DESC
      LIMIT $3 OFFSET $4`,
    [liderId, estado, limite, offset],
  );
  return rows;
}

async function sumDiasPendientes(empleadoId, tipo = 'Vacaciones') {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(dias_habiles), 0)::int AS dias
       FROM permisos WHERE empleado_id = $1 AND tipo = $2 AND estado = 'Pendiente'`,
    [empleadoId, tipo],
  );
  return rows[0].dias;
}

async function insert({ empleadoId, tipo, fechaInicio, fechaFin, diasHabiles, motivo }) {
  const { rows } = await db.query(
    `INSERT INTO permisos (empleado_id, tipo, fecha_inicio, fecha_fin, dias_habiles, motivo)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [empleadoId, tipo, fechaInicio, fechaFin, diasHabiles, motivo ?? null],
  );
  return findById(rows[0].id);
}

// Cambia el estado y, si corresponde, descuenta el saldo en la misma transacción.
// Las condiciones del WHERE evitan carreras: si otra petición ya decidió o el saldo cambió, se revierte todo.
async function decidir({ id, estado, decididoPor, comentario, empleadoId, diasADescontar = 0 }) {
  await db.withTransaction(async (cliente) => {
    const actualizado = await cliente.query(
      `UPDATE permisos
          SET estado = $2, decidido_por = $3, comentario_decision = $4, fecha_decision = NOW()
        WHERE id = $1 AND estado = 'Pendiente'`,
      [id, estado, decididoPor, comentario ?? null],
    );
    if (actualizado.rowCount === 0) {
      throw new ConflictError('State transition not allowed: the request was already decided');
    }
    if (diasADescontar > 0) {
      const descuento = await cliente.query(
        `UPDATE personas SET dias_vacaciones = dias_vacaciones - $2, actualizado_en = NOW()
          WHERE id = $1 AND dias_vacaciones >= $2`,
        [empleadoId, diasADescontar],
      );
      if (descuento.rowCount === 0) {
        throw new ConflictError('The employee no longer has enough vacation days for this request');
      }
    }
  });
  return findById(id);
}

module.exports = { findById, findByEmpleado, findParaRevision, sumDiasPendientes, insert, decidir };
