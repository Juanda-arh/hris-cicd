'use strict';

const { ValidationError } = require('./errors');

const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Convierte 'YYYY-MM-DD' en una fecha UTC (sin hora) y rechaza fechas imposibles como 2023-02-30
function parseFecha(texto, campo = 'date') {
  const coincidencia = FORMATO_FECHA.exec(String(texto ?? ''));
  if (!coincidencia) {
    throw new ValidationError(`The ${campo} must use the format YYYY-MM-DD`);
  }
  const [, anio, mes, dia] = coincidencia.map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
    throw new ValidationError(`The ${campo} is not a valid calendar date`);
  }
  return fecha;
}

function esFechaValida(texto) {
  try {
    parseFecha(texto);
    return true;
  } catch {
    return false;
  }
}

// Fecha de hoy como 'YYYY-MM-DD' (hora local del servidor)
function hoyISO(ahora = new Date()) {
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

// Años cumplidos. Quien nació un 29 de febrero cumple el 1 de marzo en los años no bisiestos.
function calcularEdad(fechaNacimiento, hoy = hoyISO()) {
  const nacimiento = parseFecha(fechaNacimiento, 'date of birth');
  const referencia = parseFecha(hoy, 'reference date');
  if (nacimiento > referencia) {
    throw new ValidationError('The date of birth cannot be in the future');
  }
  let edad = referencia.getUTCFullYear() - nacimiento.getUTCFullYear();
  const mesActual = referencia.getUTCMonth();
  const mesNacimiento = nacimiento.getUTCMonth();
  if (mesActual < mesNacimiento || (mesActual === mesNacimiento && referencia.getUTCDate() < nacimiento.getUTCDate())) {
    edad -= 1;
  }
  return edad;
}

// Días hábiles (lunes a viernes) entre dos fechas, ambas inclusive
function contarDiasHabiles(fechaInicio, fechaFin) {
  const inicio = parseFecha(fechaInicio, 'start date');
  const fin = parseFecha(fechaFin, 'end date');
  if (fin < inicio) {
    throw new ValidationError('The end date cannot be before the start date');
  }
  let dias = 0;
  for (let t = inicio.getTime(); t <= fin.getTime(); t += MS_POR_DIA) {
    const diaSemana = new Date(t).getUTCDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      dias += 1;
    }
  }
  return dias;
}

module.exports = { parseFecha, esFechaValida, hoyISO, calcularEdad, contarDiasHabiles };
