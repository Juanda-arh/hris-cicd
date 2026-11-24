import PayrollPeriodView from './PayrollPeriodView';
import usePayrollPeriod from '../../hooks/usePayrollPeriod';
import usePeriodParam from '../../hooks/usePeriodParam';
import { lastDayLabel, periodLabel } from '../../utils/period';

const maskId = (cedula) => (cedula ? `•••• ${String(cedula).slice(-4)}` : '—');

export default function PayStubsPage() {
  // Para el contador de la pestaña "Social Security Receipts"
  const [period] = usePeriodParam();
  const ss = usePayrollPeriod('comprobantes-seguridad-social', period, { withPrevious: false });

  return (
    <PayrollPeriodView
      kind="comprobantes"
      pendingReceipts={ss.loading ? 0 : ss.total - ss.done}
      copy={{
        crumb: 'Pay stubs',
        title: (p) => `${periodLabel(p)} period`,
        description: 'Upload pay stubs as PDF. Each employee sees only their own.',
        statusLabel: 'Pay stub',
        doneStatus: 'uploaded',
      }}
      progress={{ verb: 'uploaded', accent: 'orange', footLeft: (p) => `Closes ${lastDayLabel(p)}` }}
      columns={[
        { key: 'usuario', label: 'User', className: 'mono', render: (r) => r.usuario ?? '—' },
        { key: 'cedula', label: 'ID', className: 'mono', render: (r) => maskId(r.cedula) },
      ]}
      meta={(r) => [r.cargo, r.usuario, maskId(r.cedula)].filter(Boolean).join(' · ')}
    />
  );
}
