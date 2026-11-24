// Periodos mensuales { anio, mes } (mes 1-12), en hora de Colombia como el backend.
const TZ = 'America/Bogota';

export function currentPeriod() {
  const [anio, mes] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' })
    .format(new Date())
    .split('-')
    .map(Number);
  return { anio, mes };
}

export function shiftPeriod({ anio, mes }, delta) {
  const d = new Date(anio, mes - 1 + delta, 1);
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}

// "2026-09" <-> { anio: 2026, mes: 9 }
export function periodKey({ anio, mes }) {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

export function parsePeriodKey(key) {
  const m = /^(\d{4})-(\d{2})$/.exec(key || '');
  if (!m) return null;
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12 ? { anio: Number(m[1]), mes } : null;
}

export function periodLabel({ anio, mes }, month = 'long') {
  return new Date(anio, mes - 1, 1).toLocaleDateString('en-US', { month, year: 'numeric' });
}

// "Sep 30": último día del periodo
export function lastDayLabel({ anio, mes }) {
  return new Date(anio, mes, 0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function recentPeriods(count = 12) {
  const now = currentPeriod();
  return Array.from({ length: count }, (_, i) => shiftPeriod(now, -i));
}
