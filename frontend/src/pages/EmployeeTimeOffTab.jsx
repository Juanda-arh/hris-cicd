import { useEffect, useState } from 'react';
import { getTimeOff } from '../api/employeeRecordsApi';
import { getErrorMessage } from '../utils/errors';
import { formatDate, shortName } from '../utils/people';
import './PeoplePage.css';
import './EmployeeTabs.css';

const PAGE_SIZE = 10;

const TYPE_LABELS = { Vacaciones: 'Vacation', Ausencia: 'Absence' };
const SITUATIONS = {
  Tomado: { label: 'Taken', className: 'taken' },
  'En curso': { label: 'In progress', className: 'progress' },
  Programado: { label: 'Scheduled', className: 'scheduled' },
  Pendiente: { label: 'Pending', className: 'pending' },
  Rechazado: { label: 'Rejected', className: 'rejected' },
  Cancelado: { label: 'Cancelled', className: 'cancelled' },
};

function period(request) {
  const end = request.fecha_fin || request.fecha_inicio;
  return end === request.fecha_inicio
    ? formatDate(request.fecha_inicio)
    : `${formatDate(request.fecha_inicio)} — ${formatDate(end)}`;
}

export default function EmployeeTimeOffTab({ employee }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    getTimeOff(employee.id)
      .then((result) => {
        if (!active) return;
        setData(result);
        setError('');
      })
      .catch((err) => { if (active) setError(getErrorMessage(err)); });
    return () => { active = false; };
  }, [employee.id]);

  if (error) return <p className="profile__alert" role="alert">{error}</p>;
  if (!data) return <p className="tab-empty" role="status">Loading time off…</p>;

  const { balance, summary, requests } = data;
  const thisYear = String(new Date().getFullYear());
  const takenThisYear = requests
    .filter((request) => request.tipo === 'Vacaciones' && request.fecha_inicio.startsWith(thisYear))
    .reduce((total, request) => total + (request.dias_tomados || 0), 0);

  const pageCount = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const first = (currentPage - 1) * PAGE_SIZE;
  const rows = requests.slice(first, first + PAGE_SIZE);

  return (
    <div className="time-off">
      <dl className="people__stats time-off__stats">
        <div>
          <dt><span className="stat-mark stat-mark--blue" aria-hidden="true" />Available days</dt>
          <dd>{balance.diasDisponibles}</dd>
        </div>
        <div>
          <dt><span className="stat-mark stat-mark--green" aria-hidden="true" />Taken in {thisYear}</dt>
          <dd>{takenThisYear}</dd>
        </div>
        <div>
          <dt><span className="stat-mark stat-mark--yellow" aria-hidden="true" />Pending approval</dt>
          <dd>{balance.diasPendientes}</dd>
        </div>
        <div>
          <dt><span className="stat-mark" aria-hidden="true" />Scheduled</dt>
          <dd>{summary.diasPorTomar}</dd>
        </div>
      </dl>

      <section aria-labelledby="requests-title">
        <div className="tab-section-head">
          <h2 id="requests-title">Request history</h2>
          <span>{requests.length} {requests.length === 1 ? 'request' : 'requests'}</span>
        </div>

        {requests.length === 0
          ? <p className="tab-empty">This employee has no time off requests yet.</p>
          : (
            <>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Period</th>
                      <th scope="col">Type</th>
                      <th scope="col">Days</th>
                      <th scope="col">Decided by</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((request) => {
                      const situation = SITUATIONS[request.situacion] || { label: request.situacion, className: 'cancelled' };
                      return (
                        <tr key={request.id}>
                          <td className="nowrap">{period(request)}</td>
                          <td>
                            {TYPE_LABELS[request.tipo] || request.tipo}
                            {request.motivo && <span className="cell-note">{request.motivo}</span>}
                          </td>
                          <td>{request.dias_habiles}</td>
                          <td className="nowrap">{request.aprobado_por_nombre ? shortName(request.aprobado_por_nombre) : '—'}</td>
                          <td>
                            <span className={`leave-status leave-status--${situation.className}`}>{situation.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {pageCount > 1 && (
                <div className="people__footer">
                  <span>Showing {first + 1}–{first + rows.length} of {requests.length}</span>
                  <span className="people__pager">
                    <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button>
                    <span>{currentPage} / {pageCount}</span>
                    <button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>›</button>
                  </span>
                </div>
              )}
            </>
          )}
      </section>
    </div>
  );
}
