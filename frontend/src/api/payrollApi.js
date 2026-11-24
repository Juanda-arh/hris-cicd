import client from './client';

// kind: 'comprobantes' (pago) | 'comprobantes-seguridad-social'
const base = (kind) => `/api/${kind}`;

// Axios convierte FormData a JSON si el Content-Type es application/json (el default del client).
// Con 'multipart/form-data' el navegador pone el boundary correcto.
const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

export async function listEmployees() {
  const { data } = await client.get('/api/empleados');
  return data;
}

export async function listReceipts(kind, { anio, mes }) {
  const { data } = await client.get(`${base(kind)}/todos`, { params: { anio, mes } });
  return data;
}

// Carga masiva: cada PDF se asigna al empleado cuyo usuario es la primera palabra del nombre del archivo.
// files puede traer los PDF de una carpeta o archivos .zip: el backend abre los ZIP y reporta cada PDF.
export async function bulkUpload(kind, files, fecha) {
  const form = new FormData();
  files.forEach((f) => form.append('archivo', f));
  if (fecha) form.append('fecha', fecha);
  const { data, status } = await client.post(`${base(kind)}/masivo`, form, multipart);
  return { ...data, status };
}

// No hay endpoint para que el admin suba el comprobante de UN empleado:
// se usa la carga masiva con un solo archivo renombrado "<usuario>.pdf".
export function uploadForEmployee(kind, usuario, file, fecha) {
  const renamed = new File([file], `${usuario}.pdf`, { type: 'application/pdf' });
  return bulkUpload(kind, [renamed], fecha);
}

export async function replaceReceipt(kind, id, file) {
  const form = new FormData();
  form.append('archivo', file);
  const { data } = await client.put(`${base(kind)}/${id}`, form, multipart);
  return data;
}

// Devuelve { url, expiraEnSegundos } (enlace temporal)
export async function getReceiptLink(kind, id) {
  const { data } = await client.get(`${base(kind)}/${id}/descargar`);
  return data;
}

// ZIP de todos los comprobantes del periodo
export async function downloadAll(kind, { anio, mes }) {
  const res = await client.get(`${base(kind)}/todos/descargar`, { params: { anio, mes }, responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const name = /filename="?([^"]+)"?/.exec(disposition)?.[1] || `${kind}-${anio}-${mes}.zip`;
  saveBlob(res.data, name);
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
