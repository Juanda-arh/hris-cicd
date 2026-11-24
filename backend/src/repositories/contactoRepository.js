'use strict';

const db = require('../db/pool');

async function findByPersona(personaId) {
  const { rows } = await db.query(
    `SELECT id, persona_id, nombre, parentesco, telefono, ciudad, creado_en
       FROM contactos_emergencia WHERE persona_id = $1 ORDER BY id`,
    [personaId],
  );
  return rows;
}

async function insert({ personaId, nombre, parentesco, telefono, ciudad }) {
  const { rows } = await db.query(
    `INSERT INTO contactos_emergencia (persona_id, nombre, parentesco, telefono, ciudad)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, persona_id, nombre, parentesco, telefono, ciudad, creado_en`,
    [personaId, nombre, parentesco, telefono, ciudad ?? null],
  );
  return rows[0];
}

module.exports = { findByPersona, insert };
