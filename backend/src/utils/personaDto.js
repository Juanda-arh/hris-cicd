'use strict';

const { calcularEdad } = require('./dates');

// Lista blanca: solo estos campos salen en las respuestas. Cualquier columna nueva
// (clave_hash, totp_secret o las que se agreguen) queda fuera hasta que se incluya aquí.
const CAMPOS_PUBLICOS = Object.freeze([
  'id',
  'nombre',
  'cedula',
  'correo',
  'usuario',
  'rol',
  'fecha_nacimiento',
  'telefono',
  'direccion',
  'eps',
  'arl',
  'fondo_pension',
  'cesantias',
  'dias_vacaciones',
  'lider_id',
  'lider_nombre',
  'estado',
  'creado_en',
  'actualizado_en',
]);

function toPersonaDTO(fila) {
  if (!fila) return null;
  const dto = {};
  for (const campo of CAMPOS_PUBLICOS) {
    if (fila[campo] !== undefined) dto[campo] = fila[campo];
  }
  if (fila.fecha_nacimiento) {
    try {
      dto.edad = calcularEdad(fila.fecha_nacimiento);
    } catch {
      dto.edad = null;
    }
  }
  // Se informa si tiene 2FA, nunca el secreto
  dto.tiene_2fa = Boolean(fila.totp_secret);
  return dto;
}

function toPersonaListDTO(filas = []) {
  return filas.map(toPersonaDTO);
}

module.exports = { CAMPOS_PUBLICOS, toPersonaDTO, toPersonaListDTO };
