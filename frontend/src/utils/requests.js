// Helpers for leave requests (permisos)

export const TYPE_LABELS = { Vacaciones: 'Vacation', Ausencia: 'Absence' };

export const STATUS_LABELS = {
  Pendiente: 'In review',
  Aprobado: 'Approved',
  Rechazado: 'Rejected',
  Cancelado: 'Cancelled',
};

// "YYYY-MM-DD" read as a local date so it never shifts a day
export function localDate(value) {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

const day = (d) => String(d.getDate()).padStart(2, '0');
const month = (d) => d.toLocaleDateString('en-US', { month: 'short' });

// "12 – 23 Oct", "02 Oct", "28 Sep – 03 Oct", "29 Dec 2026 – 02 Jan 2027"
export function formatRange(start, end) {
  const a = localDate(start);
  const b = end ? localDate(end) : a;
  if (a.getTime() === b.getTime()) return `${day(a)} ${month(a)}`;
  if (a.getFullYear() !== b.getFullYear()) {
    return `${day(a)} ${month(a)} ${a.getFullYear()} – ${day(b)} ${month(b)} ${b.getFullYear()}`;
  }
  if (a.getMonth() === b.getMonth()) return `${day(a)} – ${day(b)} ${month(b)}`;
  return `${day(a)} ${month(a)} – ${day(b)} ${month(b)}`;
}

// { anio, mes } of a date or timestamp, in the browser's time zone
export function periodOf(value) {
  const d = value.length === 10 ? localDate(value) : new Date(value);
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}

export function samePeriod(a, b) {
  return a.anio === b.anio && a.mes === b.mes;
}

// Does the request [start, end] touch the month?
export function overlapsPeriod(request, { anio, mes }) {
  const first = new Date(anio, mes - 1, 1);
  const last = new Date(anio, mes, 0);
  const start = localDate(request.fecha_inicio);
  const end = request.fecha_fin ? localDate(request.fecha_fin) : start;
  return start <= last && end >= first;
}

// CSV with a BOM so Excel opens accents correctly
export function toCsv(rows, columns) {
  const escape = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.map((c) => escape(c.label)).join(',')];
  rows.forEach((row) => lines.push(columns.map((c) => escape(c.value(row))).join(',')));
  return `\uFEFF${lines.join('\r\n')}`;
}

export function downloadText(text, filename, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
