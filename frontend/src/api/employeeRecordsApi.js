import client from './client';
import { filenameFrom, readBlobError } from './files';

const LEAVE_TYPES = ['Vacaciones', 'Ausencia'];

// The history comes per type, so both are asked for and merged, most recent first.
// The balance and summary only count vacations.
export async function getTimeOff(employeeId) {
  const [vacations, absences] = await Promise.all(
    LEAVE_TYPES.map((tipo) => client.get(`/api/permisos/historial/${employeeId}`, { params: { tipo } }).then((r) => r.data))
  );
  const requests = [...vacations.historial, ...absences.historial]
    .sort((a, b) => (b.fecha_inicio.localeCompare(a.fecha_inicio) || b.creado_en.localeCompare(a.creado_en)));
  return { balance: vacations.saldo, summary: vacations.resumen, requests };
}

// kind: 'comprobantes' (pay stubs) | 'comprobantes-seguridad-social'
export async function listEmployeeReceipts(kind, employeeId) {
  const { data } = await client.get(`/api/${kind}/empleado/${employeeId}`);
  return data;
}

// Returns { url, expiraEnSegundos }: a temporary link to the PDF
export async function getReceiptLink(kind, receiptId) {
  const { data } = await client.get(`/api/${kind}/${receiptId}/descargar`);
  return data;
}

export async function downloadEmployeeReceipts(kind, employeeId) {
  try {
    const response = await client.get(`/api/${kind}/empleado/${employeeId}/descargar`, { responseType: 'blob' });
    return { blob: response.data, filename: filenameFrom(response.headers, `${kind}-${employeeId}.zip`) };
  } catch (err) {
    throw await readBlobError(err);
  }
}
