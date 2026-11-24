'use strict';

const config = require('../config');
const { calcularEdad, esFechaValida, hoyISO } = require('./dates');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USUARIO = /^[A-Za-z0-9._-]{3,50}$/;
const DOCUMENTO = /^\d{6,10}$/;
const TELEFONO = /^\d{10}$/;

const vacio = (valor) => valor === undefined || valor === null || String(valor).trim() === '';
const texto = (valor) => String(valor).trim();

function isEmail(valor) {
  return typeof valor === 'string' && EMAIL.test(valor.trim()) && valor.trim().length <= 100;
}

function isDocumento(valor) {
  return DOCUMENTO.test(String(valor ?? '').trim());
}

function esEnteroEnRango(valor, minimo, maximo) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= minimo && numero <= maximo;
}

function validarLogin({ usuario, clave } = {}) {
  const errores = [];
  if (vacio(usuario)) {
    errores.push('Username or email is required');
  } else if (texto(usuario).includes('@')) {
    if (!isEmail(usuario)) errores.push('Email format is invalid');
  } else if (!USUARIO.test(texto(usuario))) {
    errores.push('Username format is invalid');
  }
  if (vacio(clave)) {
    errores.push('Password is required');
  }
  return errores;
}

// Reglas de cada campo de un empleado. `requerido` aplica solo al crear.
const REGLAS_EMPLEADO = {
  nombre: { requerido: 'Full name is required', valida: (v) => texto(v).length <= 100, mensaje: 'Full name must have at most 100 characters' },
  cedula: { requerido: 'Document number is required', valida: isDocumento, mensaje: 'Document number must contain 6 to 10 digits' },
  correo: { requerido: 'Email is required', valida: isEmail, mensaje: 'Email format is invalid' },
  fechaNacimiento: { requerido: 'Date of birth is required' },
  eps: { requerido: 'EPS (health insurance) is required', valida: (v) => texto(v).length <= 50, mensaje: 'EPS must have at most 50 characters' },
  arl: { requerido: 'ARL (occupational risk insurer) is required', valida: (v) => texto(v).length <= 50, mensaje: 'ARL must have at most 50 characters' },
  fondoPension: { requerido: 'Pension fund is required', valida: (v) => texto(v).length <= 50, mensaje: 'Pension fund must have at most 50 characters' },
  cesantias: { requerido: 'Severance fund is required', valida: (v) => texto(v).length <= 50, mensaje: 'Severance fund must have at most 50 characters' },
  telefono: { valida: (v) => TELEFONO.test(texto(v)), mensaje: 'Phone number must contain exactly 10 digits' },
  direccion: { valida: (v) => texto(v).length <= 100, mensaje: 'Address must have at most 100 characters' },
  diasVacaciones: { valida: (v) => esEnteroEnRango(v, 0, 365), mensaje: 'Vacation days must be a whole number between 0 and 365' },
  liderId: { valida: (v) => esEnteroEnRango(v, 1, Number.MAX_SAFE_INTEGER), mensaje: 'Leader id must be a positive whole number' },
  rol: { valida: (v) => [config.ROLES.LIDER, config.ROLES.EMPLEADO].includes(v), mensaje: 'Role must be Lider or Empleado' },
  clave: { valida: (v) => typeof v === 'string' && v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v), mensaje: 'Password must have at least 8 characters, including letters and numbers' },
  estado: { valida: (v) => ['Activo', 'Inactivo'].includes(v), mensaje: 'Status must be Activo or Inactivo' },
};

function validarFechaNacimiento(valor, { hoy, edadMinima }) {
  if (!esFechaValida(valor)) return 'Date of birth must be a valid date in the format YYYY-MM-DD';
  if (valor > hoy) return 'Date of birth cannot be in the future';
  if (calcularEdad(valor, hoy) < edadMinima) return `Employee must be at least ${edadMinima} years old`;
  return null;
}

// Devuelve la lista de errores (en inglés); vacía si los datos son válidos.
// Con parcial: true solo valida los campos presentes (actualizaciones).
function validarEmpleado(datos = {}, { hoy = hoyISO(), edadMinima = config.edadMinima, parcial = false } = {}) {
  const errores = [];
  for (const [campo, regla] of Object.entries(REGLAS_EMPLEADO)) {
    const valor = datos[campo];
    if (vacio(valor)) {
      if (regla.requerido && !parcial) errores.push(regla.requerido);
      continue;
    }
    if (campo === 'fechaNacimiento') {
      const error = validarFechaNacimiento(texto(valor), { hoy, edadMinima });
      if (error) errores.push(error);
    } else if (!regla.valida(valor)) {
      errores.push(regla.mensaje);
    }
  }
  return errores;
}

function validarContacto({ nombre, parentesco, telefono, ciudad } = {}) {
  const errores = [];
  if (vacio(nombre)) errores.push('Contact name is required');
  else if (texto(nombre).length > 100) errores.push('Contact name must have at most 100 characters');
  if (vacio(parentesco)) errores.push('Relationship is required');
  else if (texto(parentesco).length > 30) errores.push('Relationship must have at most 30 characters');
  if (!TELEFONO.test(texto(telefono ?? ''))) errores.push('Contact phone number must contain exactly 10 digits');
  if (!vacio(ciudad) && texto(ciudad).length > 50) errores.push('City must have at most 50 characters');
  return errores;
}

function parseId(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 && String(valor).trim() === String(numero) ? numero : null;
}

module.exports = {
  isEmail,
  isDocumento,
  validarLogin,
  validarEmpleado,
  validarContacto,
  parseId,
};
