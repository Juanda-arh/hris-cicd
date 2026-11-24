import PayrollPeriodView from './PayrollPeriodView';
import { lastDayLabel, periodLabel, shiftPeriod } from '../../utils/period';

const receiptMonth = (r) =>
  r.receipt ? new Date(`${r.receipt.fecha}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';

export default function SocialSecurityPage() {
  return (
    <PayrollPeriodView
      kind="comprobantes-seguridad-social"
      pendingReceipts={0}
      copy={{
        crumb: 'Social security receipts',
        title: (p) => `${periodLabel(p)} receipts`,
        description:
          'Employees upload their social security receipt (PILA) every month. You can upload or replace it for them.',
        statusLabel: 'Receipt',
        doneStatus: 'received',
      }}
      progress={{ verb: 'received', accent: 'black', footLeft: (p) => `Due ${lastDayLabel(shiftPeriod(p, 1))}` }}
      columns={[
        { key: 'usuario', label: 'User', className: 'mono', render: (r) => r.usuario ?? '—' },
        { key: 'period', label: 'Period', className: 'mono', render: receiptMonth },
      ]}
      meta={(r) => [r.cargo, r.usuario, r.receipt && receiptMonth(r)].filter(Boolean).join(' · ')}
    />
  );
}
