import client from './client';

// The logged-in employee's or leader's own receipts.
// kind: 'comprobantes' (pay stubs: download only) | 'comprobantes-seguridad-social' (upload, replace, download)

const base = (kind) => `/api/${kind}`;
const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

// [{ id, fecha }] of the year, newest first
export async function listMyReceipts(kind, anio) {
  const { data } = await client.get(`${base(kind)}/mis-comprobantes`, { params: { anio } });
  return data;
}

// Returns { url }: a temporary link that downloads the PDF
export async function getReceiptLink(kind, id) {
  const { data } = await client.get(`${base(kind)}/${id}/descargar`);
  return data;
}

// ZIP with every own receipt of the year
export async function downloadMyReceipts(kind, anio) {
  try {
    const res = await client.get(`${base(kind)}/mis-comprobantes/descargar`, { params: { anio }, responseType: 'blob' });
    const name = /filename="?([^";]+)"?/.exec(res.headers['content-disposition'] || '')?.[1] || `${kind}-${anio}.zip`;
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    // With responseType blob the API's JSON error arrives as a Blob: read it back so it can be shown
    const body = err.response?.data;
    if (body instanceof Blob) {
      try { err.response.data = JSON.parse(await body.text()); } catch { err.response.data = {}; }
    }
    throw err;
  }
}

// Social security only: upload the receipt of a month ("YYYY-MM"). If there is already one that month, it is replaced.
export async function uploadMySocialSecurity(fecha, file, existingId) {
  const form = new FormData();
  form.append('archivo', file);
  form.append('fecha', fecha);
  if (existingId) {
    const { data } = await client.put(`${base('comprobantes-seguridad-social')}/mis-comprobantes/${existingId}`, form, multipart);
    return data;
  }
  const { data } = await client.post(`${base('comprobantes-seguridad-social')}/mis-comprobantes`, form, multipart);
  return data;
}
