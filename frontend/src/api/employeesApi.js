import client from './client';

export async function listEmployees() {
  const { data } = await client.get('/api/empleados');
  return data;
}

export async function getEmployee(id) {
  const { data } = await client.get(`/api/empleados/${id}`);
  return data;
}

export async function listPositions(id) {
  const { data } = await client.get(`/api/empleados/${id}/cargos`);
  return data;
}

// What administration manages: eps, arl, fondo_pension, cesantias and dias_vacaciones
export async function updateEmployee(id, changes) {
  const { data } = await client.patch(`/api/empleados/${id}`, changes);
  return data;
}

// Name, email, phone, address and date of birth: the same route employees use for their own data
export async function updatePersonalData(id, changes) {
  const { data } = await client.patch(`/api/editarDatosPropios/${id}`, changes);
  return data;
}

export async function updateEmployeePhoto(id, photo) {
  const body = new FormData();
  body.append('foto', photo);
  const { data } = await client.patch(`/api/empleados/${id}/foto`, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function updateLeader(leaderId, changes) {
  const { data } = await client.patch(`/api/lideres/${leaderId}`, changes);
  return data;
}

export async function deactivateEmployee(id) {
  const { data } = await client.delete(`/api/empleados/${id}`);
  return data;
}

export async function reactivateEmployee(id) {
  const { data } = await client.patch(`/api/empleados/${id}/reactivar`);
  return data;
}

export async function updatePosition(positionId, changes) {
  const { data } = await client.patch(`/api/cargos/${positionId}`, changes);
  return data;
}

export async function changeSalary(employeeId, sueldo, motivo) {
  const { data } = await client.patch(`/api/empleados/${employeeId}/salario`, { sueldo, motivo });
  return data;
}

// A leader's view of the emergency contacts of someone on their team
export async function getTeamContacts(employeeId) {
  const { data } = await client.get('/api/contactos-emergencia/equipo', { params: { empleadoId: employeeId } });
  return data;
}

export async function listEmergencyContacts(personaId) {
  const { data } = await client.get(`/api/contactos-emergencia/persona/${personaId}`);
  return data;
}

export async function updateEmergencyContact(contactId, changes) {
  const { data } = await client.patch(`/api/contactos-emergencia/${contactId}`, changes);
  return data;
}

export async function deleteEmergencyContact(contactId) {
  const { data } = await client.delete(`/api/contactos-emergencia/${contactId}`);
  return data;
}

// The org chart endpoint is the one that rejects reporting loops
export async function changeBoss(employeeId, bossEmployeeId) {
  const { data } = await client.patch(`/api/organigrama/${employeeId}`, { jefeEmpleadoId: bossEmployeeId });
  return data;
}

// The team of the leader who is signed in (the API takes the leader from the session)
export async function getMyTeam() {
  const { data } = await client.get('/api/lideres/equipo');
  return data;
}

export async function listLeaders() {
  const { data } = await client.get('/api/lideres');
  return data;
}

export async function getOrgChart() {
  const { data } = await client.get('/api/organigrama');
  return data;
}

// The API returns at most 100 per page, so 100 means "100 or more"
export async function listPendingRequests() {
  const { data } = await client.get('/api/permisos/revision', {
    params: { estado: 'Pendiente', limite: 100 },
  });
  return data;
}

export async function countUnreadNotifications() {
  const { data } = await client.get('/api/notificaciones/contador');
  return data.noLeidas;
}

// With a photo it has to travel as form-data; without one, as plain JSON
function personBody(person, photo) {
  if (!photo) return person;
  const body = new FormData();
  Object.entries(person).forEach(([key, value]) => {
    if (value !== null && value !== undefined) body.append(key, value);
  });
  body.append('foto', photo);
  return body;
}

function personConfig(photo) {
  return photo ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined;
}

// Returns { id: employee id, personaId }
export async function createEmployee(person, photo) {
  const { data } = await client.post('/api/empleados', personBody(person, photo), personConfig(photo));
  return data;
}

// Returns { id: leader id, empleadoId, personaId }
export async function createLeader(person, photo) {
  const { data } = await client.post('/api/lideres/completo', personBody(person, photo), personConfig(photo));
  return data;
}

export async function createPosition(employeeId, position) {
  const { data } = await client.post(`/api/empleados/${employeeId}/cargos`, position);
  return data;
}

export async function createEmployeeLogin(employeeId, clave) {
  const { data } = await client.post(`/api/empleados/${employeeId}/login`, { clave });
  return data;
}

export async function createLeaderLogin(leaderId, clave) {
  const { data } = await client.post(`/api/lideres/${leaderId}/login`, { clave });
  return data;
}

export async function createEmergencyContact(personaId, contact) {
  const { data } = await client.post('/api/contactos-emergencia', { personaId, ...contact });
  return data;
}
