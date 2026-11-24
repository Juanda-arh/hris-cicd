import client from './client';

// Self-service time off: the logged-in employee or leader (the admin is not an employee)

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };
const PAGE = 100; // the API returns at most 100 per call

export async function getBalance() {
  const { data } = await client.get('/api/permisos/saldo');
  return data;
}

// Vacation history of a year: brings `resumen.diasTomados` (days already taken)
export async function getVacationHistory(anio) {
  const { data } = await client.get('/api/permisos/historial', { params: { tipo: 'Vacaciones', anio } });
  return data;
}

// Every request of the user, newest first (read page by page)
export async function listMyRequests() {
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await client.get('/api/permisos/mias', { params: { limite: PAGE, offset } });
    all.push(...data);
    if (data.length < PAGE) return all;
  }
}

// With a supporting PDF it travels as form-data (field "soporte"); without one, as JSON
export async function createRequest({ tipo, fechaInicio, fechaFin, motivo }, file) {
  if (!file) {
    const { data } = await client.post('/api/permisos', { tipo, fechaInicio, fechaFin: fechaFin || null, motivo });
    return data;
  }
  const form = new FormData();
  form.append('tipo', tipo);
  form.append('fechaInicio', fechaInicio);
  if (fechaFin) form.append('fechaFin', fechaFin);
  form.append('motivo', motivo);
  form.append('soporte', file);
  const { data } = await client.post('/api/permisos', form, multipart);
  return data;
}

// Returns { permiso, tipoCancelacion: 'COMPLETA' | 'PARCIAL', diasDevueltos }
export async function cancelRequest(id) {
  const { data } = await client.patch(`/api/permisos/${id}/cancelar`);
  return data;
}

export async function uploadSupportingDocument(id, file) {
  const form = new FormData();
  form.append('soporte', file);
  const { data } = await client.put(`/api/permisos/${id}/soporte`, form, multipart);
  return data;
}

