import client from './client';

// Audit log (admin only). Filters: fechaInicio, fechaFin (YYYY-MM-DD, Colombia time), personaId, accion.
// Empty filters are left out so the API does not read them as malformed.
function cleanFilters(filters = {}) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined));
}

// Returns { registros, total, pagina, porPagina, totalPaginas }
export async function listAudit(filters, pagina = 1, porPagina = 20) {
  const { data } = await client.get('/api/auditoria', { params: { ...cleanFilters(filters), pagina, porPagina } });
  return data;
}

// A blob error hides the API's message (e.g. "more than 5000 records"): it is read back so it can be shown
async function readBlobError(err) {
  const body = err.response?.data;
  if (body instanceof Blob) {
    try {
      err.response.data = JSON.parse(await body.text());
    } catch {
      err.response.data = {};
    }
  }
  return err;
}

function filenameFrom(headers, fallback) {
  const match = /filename="?([^";]+)"?/.exec(headers['content-disposition'] || '');
  return match ? match[1] : fallback;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// format: 'csv' | 'pdf'. Downloads the file with the records that match the filters (max 5000).
export async function exportAudit(format, filters) {
  try {
    const response = await client.get(`/api/auditoria/export/${format}`, {
      params: cleanFilters(filters),
      responseType: 'blob',
    });
    saveBlob(response.data, filenameFrom(response.headers, `audit_log.${format}`));
  } catch (err) {
    throw await readBlobError(err);
  }
}
