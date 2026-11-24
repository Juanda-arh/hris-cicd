#!/usr/bin/env node
'use strict';

// Genera un resumen en Markdown de la ejecución de Jest para $GITHUB_STEP_SUMMARY:
//  - tabla PU-01 ... PU-15 con estado, número de pruebas y fallidas
//  - lista de pruebas fallidas con el primer renglón del error
//  - cobertura de líneas por capa (services, utils, middlewares) contra el umbral
// Lee coverage/jest-results.json (jest --json) y coverage/coverage-summary.json (reporter json-summary).
// Uso: node scripts/ci-summary.js [carpeta-coverage] >> "$GITHUB_STEP_SUMMARY"

const fs = require('fs');
const path = require('path');

const carpeta = path.resolve(process.argv[2] || 'coverage');
const CASOS = Array.from({ length: 15 }, (_, i) => `PU-${String(i + 1).padStart(2, '0')}`);
const CAPAS = [
  { nombre: 'services', ruta: '/src/services/', umbral: 80 },
  { nombre: 'utils', ruta: '/src/utils/', umbral: 80 },
  { nombre: 'middlewares', ruta: '/src/middlewares/', umbral: null },
];

function leerJson(archivo) {
  try {
    return JSON.parse(fs.readFileSync(path.join(carpeta, archivo), 'utf8'));
  } catch {
    return null;
  }
}

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const sinAnsi = (texto) => String(texto || '').replace(ANSI, '');
const primeraLinea = (texto) => sinAnsi(texto).split('\n').map((l) => l.trim()).find(Boolean) || '';
// Primer renglón del error más los renglones "Expected:" / "Received:" de Jest, si existen
const resumenError = (texto) => {
  const lineas = sinAnsi(texto).split('\n').map((l) => l.trim());
  const valores = lineas.filter((l) => /^(Expected|Received)\b/.test(l)).slice(0, 2);
  return [primeraLinea(texto), ...valores].join(' · ');
};
const escaparTabla = (texto) => String(texto).replace(/\|/g, '\\|');

function seccionPruebas(resultados, salida) {
  if (!resultados) {
    salida.push('> ⚠️ `coverage/jest-results.json` was not found: Jest did not finish (check the log of the test step).', '');
    return false;
  }

  const porCaso = new Map();
  for (const suite of resultados.testResults || []) {
    const caso = CASOS.find((c) => path.basename(suite.name).startsWith(`${c}.`));
    if (caso) porCaso.set(caso, suite);
  }

  salida.push('| Caso | Archivo | Estado | Pruebas | Fallidas |', '|---|---|---|---:|---:|');
  for (const caso of CASOS) {
    const suite = porCaso.get(caso);
    if (!suite) {
      salida.push(`| ${caso} | — | ⚠️ not found | 0 | 0 |`);
      continue;
    }
    const pruebas = suite.assertionResults || [];
    const fallidas = pruebas.filter((p) => p.status === 'failed').length;
    const ok = suite.status === 'passed' && fallidas === 0;
    const estado = ok ? '✅ passed' : '❌ failed';
    salida.push(`| ${caso} | \`${path.basename(suite.name)}\` | ${estado} | ${pruebas.length} | ${fallidas} |`);
  }
  salida.push('');

  const fallos = [];
  for (const suite of resultados.testResults || []) {
    const archivo = path.basename(suite.name);
    const pruebasFallidas = (suite.assertionResults || []).filter((p) => p.status === 'failed');
    for (const prueba of pruebasFallidas) {
      fallos.push(`- **${archivo}** › ${escaparTabla(prueba.fullName)}\n  \`${escaparTabla(resumenError(prueba.failureMessages && prueba.failureMessages[0]))}\``);
    }
    if (suite.status === 'failed' && pruebasFallidas.length === 0) {
      fallos.push(`- **${archivo}** › suite failed to run\n  \`${escaparTabla(primeraLinea(suite.message))}\``);
    }
  }
  if (fallos.length > 0) {
    salida.push('### ❌ Failed tests', '', ...fallos, '');
  }

  salida.push(
    `**Total:** ${resultados.numPassedTests} passed, ${resultados.numFailedTests} failed, ${resultados.numTotalTests} tests in ${resultados.numTotalTestSuites} suites.`,
    '',
  );
  return resultados.numFailedTests === 0 && resultados.numFailedTestSuites === 0 && porCaso.size === CASOS.length;
}

function seccionCobertura(resumen, salida) {
  salida.push('### Coverage by layer (lines)', '');
  if (!resumen) {
    salida.push('> ⚠️ `coverage/coverage-summary.json` was not found.', '');
    return false;
  }
  let cumple = true;
  salida.push('| Layer | Lines covered | % | Threshold | Status |', '|---|---:|---:|---:|---|');
  for (const capa of CAPAS) {
    let total = 0;
    let cubiertas = 0;
    for (const [archivo, datos] of Object.entries(resumen)) {
      if (archivo !== 'total' && archivo.replace(/\\/g, '/').includes(capa.ruta)) {
        total += datos.lines.total;
        cubiertas += datos.lines.covered;
      }
    }
    const pct = total === 0 ? 100 : (cubiertas / total) * 100;
    let estado = 'ℹ️ informative';
    if (capa.umbral !== null) {
      const ok = pct >= capa.umbral;
      cumple = cumple && ok;
      estado = ok ? '✅ ok' : '❌ below threshold';
    }
    salida.push(`| \`src/${capa.nombre}\` | ${cubiertas}/${total} | ${pct.toFixed(2)} % | ${capa.umbral === null ? '—' : `${capa.umbral} %`} | ${estado} |`);
  }
  salida.push(`| **total** | ${resumen.total.lines.covered}/${resumen.total.lines.total} | ${resumen.total.lines.pct} % | — | |`, '');
  return cumple;
}

function main() {
  const resultados = leerJson('jest-results.json');
  const resumen = leerJson('coverage-summary.json');
  const cuerpo = [];
  const pruebasOk = seccionPruebas(resultados, cuerpo);
  const coberturaOk = seccionCobertura(resumen, cuerpo);
  const ok = pruebasOk && coberturaOk;
  const titulo = ok
    ? '## ✅ Unit tests PU-01 … PU-15: all passed'
    : '## ❌ Unit tests PU-01 … PU-15: FAILED — the pipeline stops here';
  process.stdout.write(`${[titulo, '', ...cuerpo].join('\n')}\n`);
}

main();
