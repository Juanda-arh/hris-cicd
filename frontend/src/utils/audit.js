// Audit log helpers: what each action is called, which module it belongs to and how its detail reads.

// Every action the API records (the value is the exact name the `accion` filter expects)
export const AUDIT_ACTIONS = [
  // People
  { value: 'CREAR_EMPLEADO', label: 'Created employee', module: 'People' },
  { value: 'EDITAR_EMPLEADO', label: 'Edited employee', module: 'People' },
  { value: 'ACTUALIZAR_FOTO', label: 'Updated photo', module: 'People' },
  { value: 'DESACTIVAR_EMPLEADO', label: 'Deactivated employee', module: 'People' },
  { value: 'REACTIVAR_EMPLEADO', label: 'Reactivated employee', module: 'People' },
  { value: 'ASIGNAR_LIDER', label: 'Assigned leader', module: 'People' },
  { value: 'CREAR_CARGO', label: 'Created position', module: 'People' },
  { value: 'EDITAR_CARGO', label: 'Edited position', module: 'People' },
  { value: 'CAMBIAR_SALARIO', label: 'Updated salary', module: 'People' },
  { value: 'CREAR_LIDER', label: 'Created leader', module: 'People' },
  { value: 'ASIGNAR_ROL_LIDER', label: 'Made employee a leader', module: 'People' },
  { value: 'EDITAR_LIDER', label: 'Edited leader', module: 'People' },
  { value: 'ELIMINAR_LIDER', label: 'Removed leader', module: 'People' },
  { value: 'CAMBIO_ESTADO_AUTOMATICO', label: 'Status changed automatically', module: 'People' },
  // Account
  { value: 'CREAR_LOGIN_EMPLEADO', label: 'Created employee login', module: 'Account' },
  { value: 'CREAR_LOGIN_LIDER', label: 'Created leader login', module: 'Account' },
  { value: 'EDITAR_DATOS_PROPIOS', label: 'Edited own details', module: 'Account' },
  // Requests
  { value: 'SOLICITAR_PERMISO', label: 'Requested time off', module: 'Requests' },
  { value: 'APROBAR_PERMISO', label: 'Approved request', module: 'Requests' },
  { value: 'RECHAZAR_PERMISO', label: 'Rejected request', module: 'Requests' },
  { value: 'CANCELAR_PERMISO', label: 'Cancelled request', module: 'Requests' },
  { value: 'SOLICITAR_SOPORTE_PERMISO', label: 'Asked for supporting document', module: 'Requests' },
  { value: 'SUBIR_SOPORTE_PERMISO', label: 'Uploaded supporting document', module: 'Requests' },
  { value: 'DESCARGAR_SOPORTE_PERMISO', label: 'Downloaded supporting document', module: 'Requests' },
  // Certificates
  { value: 'SOLICITAR_CERTIFICADO', label: 'Requested certificate', module: 'Certificates' },
  { value: 'APROBAR_CERTIFICADO', label: 'Approved certificate', module: 'Certificates' },
  { value: 'RECHAZAR_CERTIFICADO', label: 'Rejected certificate', module: 'Certificates' },
  { value: 'CANCELAR_CERTIFICADO', label: 'Cancelled certificate', module: 'Certificates' },
  // Payroll
  { value: 'CARGA_MASIVA_COMPROBANTES', label: 'Published pay stubs', module: 'Payroll' },
  { value: 'REEMPLAZAR_COMPROBANTE', label: 'Replaced pay stub', module: 'Payroll' },
  { value: 'SUBIR_MI_COMPROBANTE', label: 'Uploaded own pay stub', module: 'Payroll' },
  { value: 'REEMPLAZAR_MI_COMPROBANTE', label: 'Replaced own pay stub', module: 'Payroll' },
  { value: 'DESCARGAR_TODOS_COMPROBANTES', label: 'Downloaded all pay stubs', module: 'Payroll' },
  { value: 'CARGA_MASIVA_COMPROBANTES_SEGURIDAD_SOCIAL', label: 'Published social security slips', module: 'Payroll' },
  { value: 'REEMPLAZAR_COMPROBANTE_SEGURIDAD_SOCIAL', label: 'Replaced social security slip', module: 'Payroll' },
  { value: 'SUBIR_MI_COMPROBANTE_SEGURIDAD_SOCIAL', label: 'Uploaded own social security slip', module: 'Payroll' },
  { value: 'REEMPLAZAR_MI_COMPROBANTE_SEGURIDAD_SOCIAL', label: 'Replaced own social security slip', module: 'Payroll' },
  { value: 'DESCARGAR_TODOS_COMPROBANTES_SEGURIDAD_SOCIAL', label: 'Downloaded all social security slips', module: 'Payroll' },
  // Org chart
  { value: 'EDITAR_ORGANIGRAMA', label: 'Edited org chart', module: 'Org Chart' },
];

const ACTIONS_BY_VALUE = new Map(AUDIT_ACTIONS.map((action) => [action.value, action]));

// Table the API names in `tabla_afectada` → module, for actions this list does not know yet
const MODULE_BY_TABLE = {
  empleado: 'People',
  persona: 'Account',
  cargo: 'People',
  lider: 'People',
  login: 'Account',
  permiso: 'Requests',
  solicitud_certificado: 'Certificates',
  comprobante: 'Payroll',
  comprobantes_seguridad_social: 'Payroll',
};

// "ALGO_NUEVO" → "Algo nuevo": an action that is not in the list still reads well
function humanize(text = '') {
  const words = String(text).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function actionLabel(action) {
  return ACTIONS_BY_VALUE.get(action)?.label ?? humanize(action);
}

export function moduleOf(record) {
  return ACTIONS_BY_VALUE.get(record.accion)?.module ?? MODULE_BY_TABLE[record.tabla_afectada] ?? humanize(record.tabla_afectada);
}

export const AUDIT_ROLE_LABELS = { admin: 'Admin', lider: 'Leader', empleado: 'Employee', system: 'System' };

/* ---------- Detail ---------- */

// Field names the API uses in `detalle`, in English
const FIELD_LABELS = {
  empleado_id: 'Employee ID',
  persona_id: 'Person ID',
  lider_id: 'Leader ID',
  jefe_anterior_empleado_id: 'Previous manager ID',
  jefe_nuevo_empleado_id: 'New manager ID',
  usuario: 'Username',
  motivo: 'Reason',
  mensaje: 'Message',
  tipo: 'Type',
  fecha: 'Date',
  fecha_inicio: 'From',
  fecha_fin: 'To',
  fecha_solicitud: 'Requested on',
  fecha_cancelacion: 'Cancelled on',
  fecha_anterior: 'Previous date',
  fecha_nueva: 'New date',
  fecha_automatica: 'Automatic date',
  dias_habiles: 'Business days',
  dias_devueltos: 'Days returned',
  dias_vacaciones: 'Vacation days',
  soporte: 'Supporting document',
  estado: 'Status',
  estado_anterior: 'Previous status',
  tipo_cancelacion: 'Cancellation',
  reemplazo: 'Replacement',
  solicitado: 'Requested by reviewer',
  puede_ver_equipo: 'Can see team',
  camposModificados: 'Changed',
  cargo: 'Position',
  area: 'Area',
  funcion: 'Duties',
  eps: 'EPS',
  arl: 'ARL',
  fondo_pension: 'Pension fund',
  cesantias: 'Severance fund',
  nombre: 'Name',
  correo: 'Email',
  telefono: 'Phone',
  direccion: 'Address',
  fecha_nacimiento: 'Date of birth',
  genero: 'Gender',
  estado_civil: 'Marital status',
  archivo: 'File',
  total_recibidos: 'Files received',
  asignados: 'Assigned',
  desde: 'From',
  hasta: 'To',
  comprobantes: 'Files',
  empleados: 'Employees',
  comentario: 'Comment',
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

function formatValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    const items = value.map(formatValue).filter(Boolean);
    return items.length ? items.join(', ') : null;
  }
  if (typeof value === 'object') return null; // nested data does not fit in one line
  if (typeof value === 'string' && ISO_DATE.test(value)) {
    const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }
  }
  return String(value);
}

// The detail is a JSON object whose shape depends on the action; it is shown as "Field: value · Field: value"
export function formatDetail(detail) {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return formatValue(detail) ?? '—';

  const parts = Object.entries(detail)
    .map(([field, value]) => {
      const text = formatValue(field === 'camposModificados' && Array.isArray(value) ? value.map((f) => FIELD_LABELS[f] ?? humanize(f)) : value);
      return text === null ? null : `${FIELD_LABELS[field] ?? humanize(field)}: ${text}`;
    })
    .filter(Boolean);

  return parts.length ? parts.join(' · ') : '—';
}

/* ---------- Dates ---------- */

// The API filters by day in Colombia time, so the log is shown in that same time zone
const TIME_ZONE = 'America/Bogota';

export function formatAuditDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const day = date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: TIME_ZONE });
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIME_ZONE });
  return `${day} · ${time}`;
}

// "YYYY-MM-DD" → "Oct 01, 2026"
export function formatFilterDate(value) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}
