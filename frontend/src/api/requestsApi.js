import client from './client';

const PAGE = 100; // the API returns at most 100 per call

// Every request the admin can review. The endpoint is paginated, so it is read page by page.
export async function listAllRequests() {
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await client.get('/api/permisos/revision', { params: { limite: PAGE, offset } });
    all.push(...data);
    if (data.length < PAGE) return all;
  }
}

export async function getRequest(id) {
  const { data } = await client.get(`/api/permisos/${id}`);
  return data;
}

// decision: 'Aprobado' | 'Rechazado'
export async function decideRequest(id, decision, comentario) {
  const { data } = await client.patch(`/api/permisos/${id}/decision`, {
    decision,
    comentario: comentario?.trim() || null,
  });
  return data;
}

// Asks the employee for the supporting PDF (informative: does not block the decision)
export async function askForSupportingDocument(id, mensaje) {
  const { data } = await client.patch(`/api/permisos/${id}/solicitar-soporte`, {
    mensaje: mensaje?.trim() || null,
  });
  return data;
}

// Returns { url, expiraEnSegundos }: a signed link that downloads the PDF
export async function getSupportingDocumentLink(id) {
  const { data } = await client.get(`/api/permisos/${id}/soporte`);
  return data;
}

// Requests that touch the range plus the public holidays in it (at most 92 days).
// Does not include reasons or documents (privacy).
export async function getCalendar(desde, hasta) {
  const { data } = await client.get('/api/permisos/calendario', { params: { desde, hasta } });
  return data;
}
