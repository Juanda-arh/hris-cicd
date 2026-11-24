import { useCallback, useEffect, useState } from 'react';
import { listEmployees, listReceipts } from '../api/payrollApi';
import { shiftPeriod } from '../utils/period';
import { getErrorMessage } from '../utils/errors';

/**
 * Empleados activos + estado de su comprobante en el periodo.
 * Devuelve filas { ...empleado, receipt } donde receipt es el comprobante del mes (o null).
 * withPrevious: además calcula el avance de los 2 meses anteriores.
 */
export default function usePayrollPeriod(kind, period, { withPrevious = true } = {}) {
  const { anio, mes } = period;
  const [state, setState] = useState({ loading: true, error: '', rows: [], previous: [] });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const prevPeriods = withPrevious ? [shiftPeriod({ anio, mes }, -1), shiftPeriod({ anio, mes }, -2)] : [];
      const [employees, receipts, ...prevReceipts] = await Promise.all([
        listEmployees(),
        listReceipts(kind, { anio, mes }),
        ...prevPeriods.map((p) => listReceipts(kind, p)),
      ]);

      const active = employees.filter((e) => e.estado !== 'Inactivo');
      const activeIds = new Set(active.map((e) => e.id));

      // Si hay más de uno en el mes, el listado viene del más reciente al más antiguo: se toma el primero
      const byEmployee = new Map();
      receipts.forEach((r) => {
        if (!byEmployee.has(r.empleado_id)) byEmployee.set(r.empleado_id, r);
      });

      const rows = active.map((e) => ({ ...e, receipt: byEmployee.get(e.id) ?? null }));

      const previous = prevPeriods.map((p, i) => ({
        period: p,
        done: new Set(prevReceipts[i].map((r) => r.empleado_id).filter((id) => activeIds.has(id))).size,
        total: active.length,
      }));

      setState({ loading: false, error: '', rows, previous });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: getErrorMessage(err) }));
    }
  }, [kind, anio, mes, withPrevious]);

  useEffect(() => {
    load();
  }, [load]);

  const done = state.rows.filter((r) => r.receipt).length;
  return { ...state, done, total: state.rows.length, reload: load };
}
