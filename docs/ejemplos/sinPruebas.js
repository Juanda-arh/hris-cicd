'use strict';

// ARCHIVO DE DEMOSTRACIÓN — no forma parte del backend.
// Sirve para el escenario "cobertura por debajo del 80 %" de la guía:
//   cp docs/ejemplos/sinPruebas.js backend/src/utils/sinPruebas.js
// Ninguna prueba lo usa, así que todas sus líneas cuentan como no cubiertas y el
// umbral de ./src/utils/ (80 % de líneas, medido sobre toda la carpeta) deja de cumplirse.
// Tiene ~70 líneas ejecutables a propósito: con menos, el promedio de la carpeta seguiría sobre 80 %.

const SMMLV = 1423500;
const AUXILIO_TRANSPORTE = 200000;
const PORCENTAJE_SALUD = 0.04;
const PORCENTAJE_PENSION = 0.04;

function redondear(valor) {
  return Math.round(valor * 100) / 100;
}

function tieneAuxilioTransporte(salario) {
  return salario <= SMMLV * 2;
}

function baseLiquidacion(salario) {
  let base = salario;
  if (tieneAuxilioTransporte(salario)) {
    base += AUXILIO_TRANSPORTE;
  }
  return base;
}

function calcularPrima(salario, diasTrabajados) {
  const base = baseLiquidacion(salario);
  const prima = (base * diasTrabajados) / 360;
  return redondear(prima);
}

function calcularCesantias(salario, diasTrabajados) {
  const base = baseLiquidacion(salario);
  const cesantias = (base * diasTrabajados) / 360;
  return redondear(cesantias);
}

function calcularInteresesCesantias(cesantias, diasTrabajados) {
  const intereses = (cesantias * diasTrabajados * 0.12) / 360;
  return redondear(intereses);
}

function calcularVacacionesPendientes(salario, diasPendientes) {
  const valorDia = salario / 30;
  const total = valorDia * diasPendientes;
  return redondear(total);
}

function calcularHorasExtra(salario, horasDiurnas, horasNocturnas) {
  const valorHora = salario / 230;
  const diurnas = valorHora * 1.25 * horasDiurnas;
  const nocturnas = valorHora * 1.75 * horasNocturnas;
  return redondear(diurnas + nocturnas);
}

function calcularDeducciones(salario) {
  const salud = salario * PORCENTAJE_SALUD;
  const pension = salario * PORCENTAJE_PENSION;
  let fondoSolidaridad = 0;
  if (salario >= SMMLV * 4) {
    fondoSolidaridad = salario * 0.01;
  }
  return {
    salud: redondear(salud),
    pension: redondear(pension),
    fondoSolidaridad: redondear(fondoSolidaridad),
    total: redondear(salud + pension + fondoSolidaridad),
  };
}

function calcularLiquidacion({ salario, diasTrabajados, diasVacacionesPendientes = 0, horasDiurnas = 0, horasNocturnas = 0 }) {
  if (!Number.isFinite(salario) || salario <= 0) {
    throw new Error('Salary must be a positive number');
  }
  if (!Number.isInteger(diasTrabajados) || diasTrabajados < 0) {
    throw new Error('Worked days must be a whole number');
  }
  const prima = calcularPrima(salario, diasTrabajados);
  const cesantias = calcularCesantias(salario, diasTrabajados);
  const intereses = calcularInteresesCesantias(cesantias, diasTrabajados);
  const vacaciones = calcularVacacionesPendientes(salario, diasVacacionesPendientes);
  const extras = calcularHorasExtra(salario, horasDiurnas, horasNocturnas);
  const deducciones = calcularDeducciones(salario);
  const devengado = prima + cesantias + intereses + vacaciones + extras;
  const neto = devengado - deducciones.total;
  return {
    prima,
    cesantias,
    intereses,
    vacaciones,
    extras,
    deducciones,
    devengado: redondear(devengado),
    neto: redondear(neto),
  };
}

function resumenLiquidacion(liquidacion) {
  const lineas = [];
  lineas.push(`Bonus: ${liquidacion.prima}`);
  lineas.push(`Severance: ${liquidacion.cesantias}`);
  lineas.push(`Severance interest: ${liquidacion.intereses}`);
  lineas.push(`Vacation: ${liquidacion.vacaciones}`);
  lineas.push(`Overtime: ${liquidacion.extras}`);
  lineas.push(`Deductions: ${liquidacion.deducciones.total}`);
  lineas.push(`Net: ${liquidacion.neto}`);
  return lineas.join('\n');
}

module.exports = {
  calcularPrima,
  calcularCesantias,
  calcularInteresesCesantias,
  calcularVacacionesPendientes,
  calcularHorasExtra,
  calcularDeducciones,
  calcularLiquidacion,
  resumenLiquidacion,
};
