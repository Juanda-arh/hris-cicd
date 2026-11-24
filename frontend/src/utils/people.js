import { GENDERS, MARITAL_STATUSES } from './employeeForm';

export const ROLE_LABELS = { lider: 'Leader', empleado: 'Employee' };

export const STATUS_LABELS = {
  Activo: 'Active',
  Inactivo: 'Inactive',
  Vacaciones: 'On vacation',
  Permiso: 'On leave',
};

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

export function formatId(id = '') {
  return /^\d+$/.test(id) ? id.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : id;
}

// "Carlos Betancur Ríos" -> "C. Betancur"
export function shortName(name = '') {
  const parts = name.trim().split(/\s+/);
  return parts.length < 2 ? name : `${parts[0][0]}. ${parts[1]}`;
}

export function firstName(name = '') {
  return name.trim().split(/\s+/)[0];
}

// The API sends dates as "YYYY-MM-DD": they are read as local dates so they never shift a day
function localDate(value) {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

export function formatDate(value) {
  if (!value) return '—';
  return localDate(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

// Date and time values (a moment, not a calendar day), shown in the browser's time zone
export function formatTimestamp(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export function formatMoney(value, decimals = 2) {
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function dayBefore(value) {
  const date = localDate(value);
  date.setDate(date.getDate() - 1);
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// "4 years, 8 months"
export function timeSince(value) {
  const start = localDate(value);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) return 'Not started yet';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  if (rest > 0 || years === 0) parts.push(`${rest} ${rest === 1 ? 'month' : 'months'}`);
  return parts.join(', ');
}

export function ageFrom(value) {
  const birth = localDate(value);
  const now = new Date();
  const hadBirthday = now.getMonth() > birth.getMonth()
    || (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  return now.getFullYear() - birth.getFullYear() - (hadBirthday ? 0 : 1);
}

export function genderLabel(value) {
  return GENDERS.find((option) => option.value === value)?.label || value || '—';
}

export function maritalLabel(value) {
  return MARITAL_STATUSES.find((option) => option.value === value)?.label || value || '—';
}

// The employee list does not say who each person reports to; the org chart does.
// Returns a Map: employee id -> { id, nombre } of their boss.
export function bossesFromOrgChart(chart) {
  const bosses = new Map();
  const visit = (node, boss) => {
    if (boss) bosses.set(node.empleadoId, { id: boss.empleadoId, nombre: boss.nombre });
    node.subordinados.forEach((child) => visit(child, node));
  };
  [...(chart.organigrama || []), ...(chart.sinAsignar || [])].forEach((root) => visit(root, null));
  return bosses;
}

// Everyone above this employee: choosing one of them as part of their team would create a loop
export function bossChain(bosses, employeeId) {
  const chain = new Set();
  let current = bosses.get(employeeId);
  while (current && !chain.has(current.id)) {
    chain.add(current.id);
    current = bosses.get(current.id);
  }
  return chain;
}

// The current position, or the latest one if there is none. Hire date: the start of the first one.
export function positionSummary(positions) {
  const current = positions.find((position) => !position.fin) || positions[0] || null;
  const hireDate = positions.reduce(
    (earliest, position) => (!earliest || position.inicio < earliest ? position.inicio : earliest),
    null
  );
  return { current, hireDate };
}
