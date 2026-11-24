'use strict';

const config = require('../config');

const { ADMIN, LIDER } = config.ROLES;

// Administrador: todo. Líder: él mismo y su equipo. Empleado: solo él mismo.
function puedeVerPersona(usuario, persona) {
  if (!usuario || !persona) return false;
  if (usuario.rol === ADMIN) return true;
  if (Number(persona.id) === Number(usuario.id)) return true;
  return usuario.rol === LIDER && Number(persona.lider_id) === Number(usuario.id);
}

module.exports = { puedeVerPersona };
