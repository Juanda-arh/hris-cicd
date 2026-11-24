import client from './client';

// Self-service: what an employee or leader sees and changes about themselves.
// An admin account has no employee record: these answer 404 for it.

export async function getMyProfile() {
  const { data } = await client.get('/api/empleados/me');
  return data;
}

// Own position history, with salaries (only the person and HR see them)
export async function getMyPositions() {
  const { data } = await client.get('/api/empleados/me/cargos');
  return data;
}

export async function getMyContacts() {
  const { data } = await client.get('/api/contactos-emergencia/mis-contactos');
  return data;
}

// Own emergency contacts: they can be added and edited (the API has no way to delete them)
export async function addMyContact(contact) {
  const { data } = await client.post('/api/contactos-emergencia/mis-contactos', contact);
  return data;
}

export async function updateMyContact(contactId, changes) {
  const { data } = await client.patch(`/api/contactos-emergencia/mis-contactos/${contactId}`, changes);
  return data;
}

// Name, email, phone, address, date of birth, EPS, ARL, pension and severance funds:
// the same route admins use to edit someone's personal data
export async function updateMyData(employeeId, changes) {
  const { data } = await client.patch(`/api/editarDatosPropios/${employeeId}`, changes);
  return data;
}

export async function updateMyPhoto(employeeId, photo) {
  const body = new FormData();
  body.append('foto', photo);
  const { data } = await client.patch(`/api/empleados/${employeeId}/foto`, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// ---------- Employment certificates ----------

export async function listMyCertificates() {
  const { data } = await client.get('/api/certificados/mis-solicitudes');
  return data;
}

// The certificate is generated with today's position and salary
export async function requestCertificate() {
  const { data } = await client.post('/api/certificados/solicitudes');
  return data;
}

export async function cancelCertificate(requestId) {
  const { data } = await client.patch(`/api/certificados/mis-solicitudes/${requestId}/cancelar`);
  return data;
}

// A short-lived link to the signed PDF
export async function getSignedCertificateUrl(requestId) {
  const { data } = await client.get(`/api/certificados/mis-solicitudes/${requestId}/descargar`);
  return data.url;
}
