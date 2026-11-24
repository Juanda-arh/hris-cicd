import { localDate } from './requests';

// The API has two request types: Vacaciones and Ausencia. The design's four types map onto them;
// for absences the chosen type travels at the start of the reason ("Sick leave: …") so it can be shown later.
export const REQUEST_TYPES = [
  { key: 'vacation', label: 'Vacation', tipo: 'Vacaciones', icon: 'calendar' },
  { key: 'paid', label: 'Paid leave', tipo: 'Ausencia', icon: 'clock' },
  { key: 'family', label: 'Family emergency', tipo: 'Ausencia', icon: 'info' },
  { key: 'sick', label: 'Sick leave', tipo: 'Ausencia', icon: 'plus', documentRequired: true },
];

export const MAX_REASON = 100; // limit of the API, prefix included

export function reasonPrefix(type) {
  return type.tipo === 'Ausencia' ? `${type.label}: ` : '';
}

// { label, reason } of a request, reading the prefix back
export function describeRequest(request) {
  const motivo = request.motivo || '';
  if (request.tipo === 'Vacaciones') return { label: 'Vacation', reason: motivo };
  const type = REQUEST_TYPES.find((t) => t.tipo === 'Ausencia' && motivo.startsWith(reasonPrefix(t)));
  return type
    ? { label: type.label, reason: motivo.slice(reasonPrefix(type).length) }
    : { label: 'Absence', reason: motivo };
}

const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Today in Colombia, as "YYYY-MM-DD" (the backend works with that date)
export function todayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

// Business days between two dates (no weekends nor the given holidays), like the backend counts them
export function businessDays(start, end, holidays) {
  let count = 0;
  for (let d = localDate(start); d <= localDate(end); d = addDays(d, 1)) {
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    if (!weekend && !holidays.has(iso(d))) count += 1;
  }
  return count;
}

// "12 – 23 Oct 2026", "02 Oct 2026"
export function formatPeriod(start, end) {
  const a = localDate(start);
  const b = end ? localDate(end) : a;
  const day = (d) => pad(d.getDate());
  const mon = (d) => d.toLocaleDateString('en-US', { month: 'short' });
  if (a.getTime() === b.getTime()) return `${day(a)} ${mon(a)} ${a.getFullYear()}`;
  if (a.getFullYear() !== b.getFullYear()) return `${day(a)} ${mon(a)} ${a.getFullYear()} – ${day(b)} ${mon(b)} ${b.getFullYear()}`;
  if (a.getMonth() === b.getMonth()) return `${day(a)} – ${day(b)} ${mon(b)} ${b.getFullYear()}`;
  return `${day(a)} ${mon(a)} – ${day(b)} ${mon(b)} ${b.getFullYear()}`;
}

// A request that can still be cancelled by its owner (the backend has the final word)
export function canCancel(request, today) {
  if (request.estado === 'Pendiente') return true;
  if (request.estado !== 'Aprobado') return false;
  const end = (request.fecha_fin || request.fecha_inicio).slice(0, 10);
  return end > today;
}

export const STATUS_LABELS = { Pendiente: 'Pending', Aprobado: 'Approved', Rechazado: 'Rejected', Cancelado: 'Cancelled' };

// The API only accepts a real PDF of up to 5 MB as supporting document
export const MAX_PDF_MB = 5;
export function validatePdf(file) {
  const looksLikePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!looksLikePdf) return 'The document must be a PDF';
  if (file.size > MAX_PDF_MB * 1024 * 1024) return `The document must be at most ${MAX_PDF_MB} MB`;
  return '';
}
