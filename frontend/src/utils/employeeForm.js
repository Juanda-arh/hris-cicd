import { meetsAllRules } from './passwordRules';

export const STEPS = [
  'Personal information',
  'Position & salary',
  'Leader & permissions',
  'Credentials & login',
  'Emergency contact',
];

// The API stores these two lists in Spanish (CHECK constraints in the persona table)
export const GENDERS = [
  { value: 'Femenino', label: 'Female' },
  { value: 'Masculino', label: 'Male' },
  { value: 'Otro', label: 'Other' },
];

export const MARITAL_STATUSES = [
  { value: 'Soltero', label: 'Single' },
  { value: 'Casado', label: 'Married' },
  { value: 'Union libre', label: 'Common-law' },
  { value: 'Separado', label: 'Separated' },
  { value: 'Divorciado', label: 'Divorced' },
  { value: 'Viudo', label: 'Widowed' },
];

export const EPS_OPTIONS = ['Sura', 'Sanitas', 'Nueva EPS', 'Compensar', 'Famisanar', 'Salud Total', 'Coosalud', 'Aliansalud', 'Mutual Ser'];
export const ARL_OPTIONS = ['Sura', 'Positiva', 'Colmena', 'Bolívar', 'AXA Colpatria', 'La Equidad', 'Alfa'];
export const PENSION_OPTIONS = ['Porvenir', 'Protección', 'Colfondos', 'Skandia', 'Colpensiones'];
export const SEVERANCE_OPTIONS = ['Porvenir', 'Protección', 'Colfondos', 'Skandia', 'Fondo Nacional del Ahorro'];
export const RELATIONSHIPS = ['Mother', 'Father', 'Spouse', 'Partner', 'Sibling', 'Child', 'Relative', 'Friend'];

export const MAX_PHOTO_MB = 2;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\d{10}$/;
const SALARY = /^\d+(\.\d{1,2})?$/;

export function emptyContact(id) {
  return { id, nombre: '', parentesco: '', telefono: '', ciudad: '' };
}

export const INITIAL_FORM = {
  nombre: '',
  cedula: '',
  fechaNacimiento: '',
  telefono: '',
  correo: '',
  estadoCivil: '',
  genero: '',
  direccion: '',
  eps: '',
  arl: '',
  fondoPension: '',
  cesantias: '',
  diasVacaciones: '15',
  festivosDescuentan: false,
  cargo: '',
  area: '',
  inicio: '',
  sueldo: '',
  funcion: '',
  liderId: '',
  rol: 'empleado',
  puedeVerEquipo: true,
  clave: '',
  contactos: [emptyContact(1)],
};

// The username is the part of the email before the @ (same rule as the API)
export function usernameFromEmail(email) {
  const at = email.indexOf('@');
  return at === -1 ? '' : email.slice(0, at).trim();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function validatePersonal(form) {
  const errors = {};
  if (!form.nombre.trim()) errors.nombre = 'Enter the full name';
  else if (form.nombre.trim().length > 100) errors.nombre = 'Use at most 100 characters';

  if (!form.cedula.trim()) errors.cedula = 'Enter the ID number';
  else if (form.cedula.trim().length > 50) errors.cedula = 'Use at most 50 characters';

  if (!form.fechaNacimiento) errors.fechaNacimiento = 'Select the date of birth';
  else if (form.fechaNacimiento > today()) errors.fechaNacimiento = 'The date must be in the past';

  if (!PHONE.test(form.telefono.trim())) errors.telefono = 'Enter exactly 10 digits';

  if (!EMAIL.test(form.correo.trim()) || form.correo.trim().length > 100) errors.correo = 'Enter a valid email';
  else if (usernameFromEmail(form.correo).length > 50) errors.correo = 'The part before the @ must have at most 50 characters';

  if (!form.estadoCivil) errors.estadoCivil = 'Select a marital status';
  if (!form.genero) errors.genero = 'Select a gender';

  if (!form.direccion.trim()) errors.direccion = 'Enter the address';
  else if (form.direccion.trim().length > 100) errors.direccion = 'Use at most 100 characters';

  if (!form.eps) errors.eps = 'Select an EPS';
  if (!form.arl) errors.arl = 'Select an ARL';
  if (!form.fondoPension) errors.fondoPension = 'Select a pension fund';
  if (!form.cesantias) errors.cesantias = 'Select a severance fund';

  const days = form.diasVacaciones.trim();
  if (!/^\d+$/.test(days) || Number(days) > 365) errors.diasVacaciones = 'Use a whole number between 0 and 365';

  return errors;
}

function validatePosition(form) {
  const errors = {};
  if (!form.cargo.trim()) errors.cargo = 'Enter the position';
  else if (form.cargo.trim().length > 300) errors.cargo = 'Use at most 300 characters';

  if (!form.area.trim()) errors.area = 'Enter the area or department';
  else if (form.area.trim().length > 50) errors.area = 'Use at most 50 characters';

  if (!form.inicio) errors.inicio = 'Select the hire date';

  const salary = form.sueldo.trim();
  if (!SALARY.test(salary) || Number(salary) >= 10000000000) errors.sueldo = 'Enter a number with at most 2 decimals';

  if (form.funcion.trim().length > 50) errors.funcion = 'Use at most 50 characters';
  return errors;
}

// The leader is optional: it can be assigned later from the employee's profile
function validateLeader() {
  return {};
}

function validateCredentials(form) {
  return meetsAllRules(form.clave) ? {} : { clave: 'The password does not meet the requirements' };
}

function validateContacts(form) {
  const errors = {};
  form.contactos.forEach((contact) => {
    const prefix = `contacto-${contact.id}-`;
    if (!contact.nombre.trim()) errors[`${prefix}nombre`] = 'Enter a name';
    else if (contact.nombre.trim().length > 100) errors[`${prefix}nombre`] = 'Use at most 100 characters';
    if (!contact.parentesco) errors[`${prefix}parentesco`] = 'Select one';
    if (!PHONE.test(contact.telefono.trim())) errors[`${prefix}telefono`] = 'Enter exactly 10 digits';
    if (!contact.ciudad.trim()) errors[`${prefix}ciudad`] = 'Enter a city';
    else if (contact.ciudad.trim().length > 50) errors[`${prefix}ciudad`] = 'Use at most 50 characters';
  });
  return errors;
}

export function validateStep(step, form) {
  switch (step) {
    case 0: return validatePersonal(form);
    case 1: return validatePosition(form);
    case 2: return validateLeader();
    case 3: return validateCredentials(form);
    case 4: return validateContacts(form);
    default: return {};
  }
}

export function validatePhoto(file) {
  if (!PHOTO_TYPES.includes(file.type)) return 'The photo must be a JPG, PNG or WEBP image';
  if (file.size > MAX_PHOTO_MB * 1024 * 1024) return `The photo must be at most ${MAX_PHOTO_MB} MB`;
  return '';
}
