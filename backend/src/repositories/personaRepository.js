'use strict';

const db = require('../db/pool');

const SELECT_PERSONA = `
  SELECT p.*, l.nombre AS lider_nombre
    FROM personas p
    LEFT JOIN personas l ON l.id = p.lider_id`;

// Nombre del campo en la API (camelCase) -> columna en la tabla
const COLUMNAS = {
  nombre: 'nombre',
  cedula: 'cedula',
  correo: 'correo',
  usuario: 'usuario',
  claveHash: 'clave_hash',
  rol: 'rol',
  fechaNacimiento: 'fecha_nacimiento',
  telefono: 'telefono',
  direccion: 'direccion',
  eps: 'eps',
  arl: 'arl',
  fondoPension: 'fondo_pension',
  cesantias: 'cesantias',
  diasVacaciones: 'dias_vacaciones',
  liderId: 'lider_id',
  estado: 'estado',
};

async function findById(id) {
  const { rows } = await db.query(`${SELECT_PERSONA} WHERE p.id = $1`, [id]);
  return rows[0] || null;
}

// El usuario puede iniciar sesión con su nombre de usuario o con su correo
async function findByLogin(identificador) {
  const { rows } = await db.query(
    `${SELECT_PERSONA} WHERE LOWER(p.usuario) = LOWER($1) OR LOWER(p.correo) = LOWER($1) LIMIT 1`,
    [identificador],
  );
  return rows[0] || null;
}

async function findDuplicado({ cedula, correo, usuario }) {
  const { rows } = await db.query(
    `SELECT id, cedula, correo, usuario FROM personas
      WHERE cedula = $1 OR LOWER(correo) = LOWER($2) OR LOWER(usuario) = LOWER($3)
      LIMIT 1`,
    [cedula, correo, usuario],
  );
  return rows[0] || null;
}

async function findAll() {
  const { rows } = await db.query(`${SELECT_PERSONA} ORDER BY p.id`);
  return rows;
}

async function findByLider(liderId) {
  const { rows } = await db.query(`${SELECT_PERSONA} WHERE p.lider_id = $1 ORDER BY p.id`, [liderId]);
  return rows;
}

async function insert(datos) {
  const campos = Object.keys(COLUMNAS).filter((campo) => datos[campo] !== undefined);
  const columnas = campos.map((campo) => COLUMNAS[campo]);
  const marcadores = campos.map((_, i) => `$${i + 1}`);
  const { rows } = await db.query(
    `INSERT INTO personas (${columnas.join(', ')}) VALUES (${marcadores.join(', ')}) RETURNING id`,
    campos.map((campo) => datos[campo]),
  );
  return findById(rows[0].id);
}

async function update(id, cambios) {
  const campos = Object.keys(COLUMNAS).filter((campo) => cambios[campo] !== undefined);
  if (campos.length === 0) return findById(id);
  const asignaciones = campos.map((campo, i) => `${COLUMNAS[campo]} = $${i + 2}`);
  const { rowCount } = await db.query(
    `UPDATE personas SET ${asignaciones.join(', ')}, actualizado_en = NOW() WHERE id = $1`,
    [id, ...campos.map((campo) => cambios[campo])],
  );
  return rowCount === 0 ? null : findById(id);
}

module.exports = { findById, findByLogin, findDuplicado, findAll, findByLider, insert, update };
