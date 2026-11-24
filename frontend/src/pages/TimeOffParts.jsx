import { useMemo, useRef, useState } from 'react';
import { cancelRequest, uploadSupportingDocument } from '../api/timeOffApi';
import { ErrorIcon } from '../components/FormField';
import Modal from '../components/Modal';
import { getErrorMessage } from '../utils/errors';
import { formatTimestamp } from '../utils/people';
import { localDate } from '../utils/requests';
import { STATUS_LABELS, canCancel, describeRequest, formatPeriod, iso, todayIso, validatePdf } from '../utils/timeOff';

export function Status({ estado }) {
  return <span className={`to-status to-status--${estado.toLowerCase()}`}>{STATUS_LABELS[estado] || estado}</span>;
}

/* ---------- Balance ---------- */
export function BalanceCard({ balance, usedThisYear, year }) {
  if (!balance) return <div className="to-card to-balance"><p className="to-eyebrow">Your balance</p><p className="tab-empty">Loading…</p></div>;
  const total = Math.max(1, balance.diasDisponibles + balance.diasPendientes + (usedThisYear || 0));
  return (
    <div className="to-card to-balance">
      <p className="to-eyebrow">Your balance</p>
      <p className="to-balance__value">
        <span className="to-balance__number">{balance.diasDisponibles}</span>
        <span>{balance.diasDisponibles === 1 ? 'day' : 'days'} available</span>
      </p>
      <div className="to-balance__bar" aria-hidden="true">
        <span className="to-balance__used" style={{ width: `${((usedThisYear || 0) / total) * 100}%` }} />
        <span className="to-balance__pending" style={{ width: `${(balance.diasPendientes / total) * 100}%` }} />
      </div>
      <div className="to-balance__foot">
        <span>{usedThisYear ?? '—'} used in {year}</span>
        <span>{balance.diasPendientes} pending approval</span>
      </div>
    </div>
  );
}

/* ---------- Approval flow ---------- */
export function ApprovalFlow({ reviewer }) {
  return (
    <div className="to-flow">
      <p className="to-eyebrow">Approval flow</p>
      <ol>
        <li className="is-done">
          <strong>Submitted by you</strong>
          <span>When you send it</span>
        </li>
        <li className="is-current">
          <strong>{reviewer ? 'Your leader’s review' : 'Administration review'}</strong>
          <span>{reviewer ? [reviewer.nombre, reviewer.cargo].filter(Boolean).join(' · ') : 'You have no leader assigned'}</span>
        </li>
        <li>
          <strong>HR is notified</strong>
          <span>Administration can also decide</span>
        </li>
      </ol>
    </div>
  );
}

/* ---------- My calendar (Sunday first) ---------- */
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function MyCalendar({ month, onMonth, events, holidays, loading }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  const stateOf = (d) => {
    const key = iso(d);
    const event = events.find((e) => e.fecha_inicio.slice(0, 10) <= key && (e.fecha_fin || e.fecha_inicio).slice(0, 10) >= key);
    return event ? (event.estado === 'Pendiente' ? 'pending' : 'approved') : null;
  };
  return (
    <div className="to-cal">
      <div className="to-cal__head">
        <button type="button" aria-label="Previous month" onClick={() => onMonth(-1)}>‹</button>
        <span>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
        <button type="button" aria-label="Next month" onClick={() => onMonth(1)}>›</button>
      </div>
      <div className={`to-cal__grid${loading ? ' is-loading' : ''}`} role="grid">
        {WEEKDAYS.map((d, i) => <span key={i} className="to-cal__weekday" aria-hidden="true">{d}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} className="to-cal__day is-empty" aria-hidden="true" />;
          const weekend = d.getDay() === 0 || d.getDay() === 6;
          const holiday = holidays.has(iso(d));
          const state = stateOf(d);
          const cls = ['to-cal__day', weekend && 'is-off', holiday && !weekend && 'is-holiday', state && !weekend && !holiday && `is-${state}`].filter(Boolean).join(' ');
          const label = [d.getDate(), holiday && 'holiday', weekend && 'weekend', state].filter(Boolean).join(' · ');
          return <span key={iso(d)} role="gridcell" className={cls} title={label} aria-label={label}>{d.getDate()}</span>;
        })}
      </div>
      <ul className="to-legend">
        <li><span className="to-swatch is-approved" />Approved</li>
        <li><span className="to-swatch is-pending" />Pending</li>
        <li><span className="to-swatch is-holiday" />Holiday</li>
        <li><span className="to-swatch is-off" />Non-working day</li>
      </ul>
    </div>
  );
}

/* ---------- Coming up: own requests and weekday holidays of the next months ---------- */
// requests: the user's own requests, to show the type they chose (the calendar does not send the reason)
export function ComingUp({ events, holidays, today, requests = [] }) {
  const items = useMemo(() => {
    const list = events
      .filter((e) => (e.fecha_fin || e.fecha_inicio).slice(0, 10) >= today)
      .map((e) => ({ key: `r${e.id}`, date: e.fecha_inicio.slice(0, 10), when: formatPeriod(e.fecha_inicio, e.fecha_fin).replace(/ \d{4}$/, ''), what: describeRequest(requests.find((r) => r.id === e.id) || e).label, badge: e.estado === 'Pendiente' ? 'pending' : 'approved' }));
    holidays.forEach((h) => {
      const d = localDate(h);
      if (h >= today && d.getDay() !== 0 && d.getDay() !== 6) {
        list.push({ key: `h${h}`, date: h, when: d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }), what: 'Public holiday', badge: 'holiday' });
      }
    });
    return list.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  }, [events, holidays, today, requests]);

  return (
    <div className="to-coming">
      <p className="to-eyebrow">Coming up</p>
      {items.length === 0 ? <p className="to-note">Nothing in the next three months.</p> : (
        <ul>
          {items.map((it) => (
            <li key={it.key}>
              <span className="to-mono">{it.when}</span>
              <span>{it.what}</span>
              <span className={`to-badge to-badge--${it.badge}`}>{it.badge}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Request history ---------- */
const PAGE_SIZE = 8;

function UploadButton({ request, onDone, onError }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  async function pick(file) {
    if (!file) return;
    const problem = validatePdf(file);
    if (problem) { onError(problem); return; }
    setBusy(true);
    try {
      await uploadSupportingDocument(request.id, file);
      onDone('The supporting document was uploaded. Your reviewers were notified.');
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" className="btn btn--small" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? 'Uploading…' : request.tiene_soporte ? 'Replace document' : 'Upload document'}
      </button>
      <input ref={ref} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} />
    </>
  );
}

export function RequestHistory({ requests, today, onCancel, onDone, onError }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = requests.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  if (requests.length === 0) return <p className="people__empty">You have not sent any requests yet.</p>;
  return (
    <>
      <table className="to-table">
        <thead>
          <tr>
            <th scope="col">Period</th><th scope="col">Type</th><th scope="col">Days</th>
            <th scope="col">Submitted</th><th scope="col">Status</th><th scope="col" className="align-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const { label } = describeRequest(r);
            const cancellable = canCancel(r, today);
            const askForDoc = r.soporte_pendiente && ['Pendiente', 'Aprobado'].includes(r.estado);
            return (
              <tr key={r.id}>
                <td className="to-table__period to-mono">{formatPeriod(r.fecha_inicio, r.fecha_fin)}</td>
                <td className="to-table__type">{label}</td>
                <td className="to-table__days to-mono">{r.dias_habiles}</td>
                <td className="to-table__sent to-mono">{formatTimestamp(r.creado_en)}</td>
                <td className="to-table__status">
                  <Status estado={r.estado} />
                  {r.comentario_decision && <span className="to-table__comment">“{r.comentario_decision}”</span>}
                  {askForDoc && <span className="to-table__comment is-alert">Document requested{r.soporte_solicitud_mensaje ? `: ${r.soporte_solicitud_mensaje}` : ''}</span>}
                </td>
                <td className="to-table__action">
                  {askForDoc && <UploadButton request={r} onDone={onDone} onError={onError} />}
                  {cancellable && <button type="button" className="btn btn--small to-btn-cancel" onClick={() => onCancel(r)}>Cancel request</button>}
                  {!askForDoc && !cancellable && <span className="to-dash" aria-label="No action">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pageCount > 1 && (
        <div className="people__footer">
          <span>Showing {(current - 1) * PAGE_SIZE + 1}–{(current - 1) * PAGE_SIZE + rows.length} of {requests.length}</span>
          <span className="people__pager">
            <button type="button" aria-label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)}>‹</button>
            <span>{current} / {pageCount}</span>
            <button type="button" aria-label="Next page" disabled={current === pageCount} onClick={() => setPage(current + 1)}>›</button>
          </span>
        </div>
      )}
    </>
  );
}

/* ---------- Cancel modal ---------- */
export function CancelModal({ request, onClose, onDone }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { label } = describeRequest(request);
  const started = request.estado === 'Aprobado' && request.fecha_inicio.slice(0, 10) <= todayIso();

  async function confirm() {
    setSaving(true);
    setError('');
    try {
      const result = await cancelRequest(request.id);
      const returned = result.diasDevueltos ? ` ${result.diasDevueltos} day${result.diasDevueltos === 1 ? '' : 's'} went back to your balance.` : '';
      onDone(result.tipoCancelacion === 'PARCIAL'
        ? `Your ${label.toLowerCase()} was shortened to end today.${returned}`
        : `Your request was cancelled.${returned}`);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Cancel this request?"
      subtitle={started
        ? 'It already started: it will end today and the days you did not take go back to your balance.'
        : 'Your leader will be notified and the days go back to your balance. This can’t be undone.'}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn" disabled={saving} onClick={onClose}>Keep request</button>
          <button type="button" className="btn to-btn-cancel" disabled={saving} onClick={confirm}>{saving ? 'Cancelling…' : 'Cancel request'}</button>
        </>
      )}
    >
      {error && <p className="profile__alert" role="alert"><ErrorIcon /> {error}</p>}
      <div className="person-card">
        <span className="person-card__text">
          <strong>{label} · {formatPeriod(request.fecha_inicio, request.fecha_fin)}</strong>
          <span>{request.dias_habiles} business day{request.dias_habiles === 1 ? '' : 's'} · submitted {formatTimestamp(request.creado_en)}</span>
        </span>
        <Status estado={request.estado} />
      </div>
    </Modal>
  );
}
