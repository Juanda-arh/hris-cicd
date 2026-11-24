import { useEffect, useMemo, useState } from 'react';
import { listEmployees, getOrgChart } from '../api/employeesApi';
import { decideRequest, listAllRequests } from '../api/requestsApi';
import { PageHeader } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { getErrorMessage } from '../utils/errors';
import { bossesFromOrgChart, formatId, shortName } from '../utils/people';
import { currentPeriod, parsePeriodKey, periodKey, recentPeriods } from '../utils/period';
import {
  TYPE_LABELS,
  formatRange,
  localDate,
  overlapsPeriod,
  periodOf,
  samePeriod,
} from '../utils/requests';
import { AskDocumentModal, RejectModal, RequestDetailModal, RequestStatus } from './RequestModals';
import './NewEmployeePage.css';
import './EmployeeProfilePage.css';
import './EmployeeTabs.css';
import './PeoplePage.css';
import './RequestsPage.css';

const PAGE_SIZE = 10;

function normalize(text = '') {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const digitsOnly = (text = '') => text.replace(/\D/g, '');

const shortMonth = (p) => new Date(p.anio, p.mes - 1, 1).toLocaleDateString('en-US', { month: 'short' });

// Shared by the admin (/requests: every employee) and the leader (/team-requests: their team only).
// The API decides what each one sees: a leader without "can view team" gets a 403 and sees no requests.
export default function RequestsPage() {
  const { user } = useAuth();
  const isLeader = user?.rol === 'lider';
  const [noPermission, setNoPermission] = useState(false);
  const [requests, setRequests] = useState(null);
  const [employees, setEmployees] = useState(new Map());
  const [leaders, setLeaders] = useState(new Map());
  const [loadError, setLoadError] = useState('');
  const [version, setVersion] = useState(0);

  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [leader, setLeader] = useState('all');
  const [status, setStatus] = useState('Pendiente');
  const [period, setPeriod] = useState('all');
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState(new Set());
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');

  // The message goes away on its own so it never stays over the page
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    let active = true;
    listAllRequests()
      .then((data) => {
        if (!active) return;
        setRequests(data);
        setLoadError('');
      })
      .catch((err) => {
        if (!active) return;
        // Leader without permission to view their team: the page shows no requests, with a note
        if (isLeader && err.response?.status === 403) {
          setNoPermission(true);
          setRequests([]);
          setLoadError('');
          return;
        }
        setLoadError(getErrorMessage(err));
      });
    // Secondary data: without it the list still works and shows a dash
    listEmployees()
      .then((data) => { if (active) setEmployees(new Map(data.map((e) => [e.id, e]))); })
      .catch(() => {});
    getOrgChart()
      .then((chart) => { if (active) setLeaders(bossesFromOrgChart(chart)); })
      .catch(() => {});
    return () => { active = false; };
  }, [version, isLeader]);

  const now = currentPeriod();
  const selectedPeriod = parsePeriodKey(period);
  const daysPeriod = selectedPeriod ?? now;

  const stats = useMemo(() => {
    const list = requests || [];
    const decidedThisMonth = (r, estado) => r.estado === estado && r.fecha_decision && samePeriod(periodOf(r.fecha_decision), now);
    return {
      pending: list.filter((r) => r.estado === 'Pendiente').length,
      approved: list.filter((r) => decidedThisMonth(r, 'Aprobado')).length,
      rejected: list.filter((r) => decidedThisMonth(r, 'Rechazado')).length,
      days: list
        .filter((r) => ['Pendiente', 'Aprobado'].includes(r.estado) && samePeriod(periodOf(r.fecha_inicio), daysPeriod))
        .reduce((sum, r) => sum + (r.dias_habiles || 0), 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, daysPeriod.anio, daysPeriod.mes, now.anio, now.mes]);

  // Leaders that appear in the requests, for the filter
  const leaderOptions = useMemo(() => {
    const map = new Map();
    (requests || []).forEach((r) => {
      const boss = leaders.get(r.empleado_id);
      if (boss) map.set(boss.id, boss.nombre);
    });
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [requests, leaders]);

  const filtered = useMemo(() => {
    const text = normalize(search.trim());
    const digits = digitsOnly(search);
    return (requests || [])
      .filter((r) => {
        const employee = employees.get(r.empleado_id);
        const matchesSearch = !text
          || normalize(r.empleado_nombre).includes(text)
          || (digits && digitsOnly(employee?.cedula).includes(digits));
        return matchesSearch
          && (type === 'all' || r.tipo === type)
          && (status === 'all' || r.estado === status)
          && (leader === 'all' || String(leaders.get(r.empleado_id)?.id) === leader)
          && (!selectedPeriod || overlapsPeriod(r, selectedPeriod));
      })
      .sort((a, b) => localDate(a.fecha_inicio) - localDate(b.fecha_inicio));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, employees, leaders, search, type, status, leader, period]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const rows = filtered.slice(firstIndex, firstIndex + PAGE_SIZE);

  // Only pending requests can be approved; the selection never keeps rows that are no longer visible
  const selectable = rows.filter((r) => r.estado === 'Pendiente');
  const selectedRows = filtered.filter((r) => selected.has(r.id) && r.estado === 'Pendiente');
  const allOnPageSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));

  function changeFilter(setter) {
    return (e) => {
      setter(e.target.value);
      setPage(1);
      setSelected(new Set());
    };
  }

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      selectable.forEach((r) => (allOnPageSelected ? next.delete(r.id) : next.add(r.id)));
      return next;
    });
  }

  function finished(message) {
    setModal(null);
    setToast(message);
    setSelected(new Set());
    setVersion((v) => v + 1);
  }

  const leaderOf = (r) => leaders.get(r.empleado_id);

  // People the request is compared with: the employee's team (same leader), or everyone if they have no leader
  function teamOf(r) {
    const boss = leaderOf(r);
    const active = [...employees.values()].filter((e) => e.estado !== 'Inactivo');
    if (!boss) return { ids: new Set(active.map((e) => e.id)), size: active.length || 1, label: 'Whole company' };
    const ids = new Set(active.filter((e) => leaders.get(e.id)?.id === boss.id).map((e) => e.id));
    ids.add(r.empleado_id);
    return { ids, size: ids.size, label: `${shortName(boss.nombre)}'s team` };
  }
  const positionOf = (r) => employees.get(r.empleado_id)?.cargo;

  return (
    <>
      <PageHeader crumbs={[{ label: 'Requests' }]}>
        <button
          type="button"
          className="btn btn--dark"
          disabled={selectedRows.length === 0}
          onClick={() => setModal({ type: 'bulk' })}
        >
          Approve selected{selectedRows.length > 0 ? ` (${selectedRows.length})` : ''}
        </button>
      </PageHeader>

      {toast && (
        <div className="toast req-toast" role="status">
          <span>{toast}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setToast('')}>×</button>
        </div>
      )}

      <main className="app__content requests">
        <h1 className="new-employee__title">{isLeader ? 'Team requests' : 'Company requests'}</h1>
        <p className="new-employee__subtitle">
          {isLeader
            ? 'Vacation and absence requests from the people on your team. Approve or reject the ones in review, and ask for a supporting document when you need one.'
            : 'Vacation and absence requests from every employee. Approve or reject the ones in review, and ask for a supporting document when you need one.'}
        </p>

        <dl className="req-stats">
          <div className="req-stats--pending">
            <dt>In review</dt>
            <dd>{requests ? stats.pending : '—'}</dd>
          </div>
          <div className="req-stats--approved">
            <dt>Approved this month</dt>
            <dd>{requests ? stats.approved : '—'}</dd>
          </div>
          <div className="req-stats--rejected">
            <dt>Rejected this month</dt>
            <dd>{requests ? stats.rejected : '—'}</dd>
          </div>
          <div className="req-stats--days">
            <dt>Days requested in {shortMonth(daysPeriod)}</dt>
            <dd>{requests ? stats.days : '—'}</dd>
          </div>
        </dl>

        <div className="people__filters req-filters">
          <label className="people__search">
            <span className="sr-only">Search</span>
            <input type="search" placeholder={isLeader ? 'Search by name' : 'Search by name or ID number'} value={search} onChange={changeFilter(setSearch)} />
          </label>
          <label>
            <span className="sr-only">Type</span>
            <select value={type} onChange={changeFilter(setType)}>
              <option value="all">Type: all</option>
              <option value="Vacaciones">Type: vacation</option>
              <option value="Ausencia">Type: absence</option>
            </select>
          </label>
          {/* The leader only sees their own team: the leader filter would have one option */}
          {!isLeader && (
            <label>
              <span className="sr-only">Leader</span>
              <select value={leader} onChange={changeFilter(setLeader)}>
                <option value="all">Leader: all</option>
                {leaderOptions.map(([id, name]) => (
                  <option key={id} value={String(id)}>Leader: {shortName(name)}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span className="sr-only">Status</span>
            <select value={status} onChange={changeFilter(setStatus)}>
              <option value="Pendiente">Status: in review</option>
              <option value="Aprobado">Status: approved</option>
              <option value="Rechazado">Status: rejected</option>
              <option value="Cancelado">Status: cancelled</option>
              <option value="all">Status: all</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Period</span>
            <select value={period} onChange={changeFilter(setPeriod)}>
              <option value="all">Period: all</option>
              {recentPeriods(12).map((p) => (
                <option key={periodKey(p)} value={periodKey(p)}>Period: {shortMonth(p)} {p.anio}</option>
              ))}
            </select>
          </label>
        </div>

        {noPermission && (
          <p className="people__notice" role="status">
            You do not have permission to view your team’s requests yet. Ask administration to enable it.
          </p>
        )}
        {loadError && <p className="profile__alert" role="alert">{loadError}</p>}
        {!loadError && !requests && <p className="tab-empty" role="status">Loading requests…</p>}
        {requests && rows.length === 0 && (
          <p className="people__empty">
            {noPermission
              ? 'No requests to show.'
              : requests.length === 0
                ? (isLeader ? 'Your team has no requests yet.' : 'There are no requests yet.')
                : 'No requests match these filters.'}
          </p>
        )}

        {rows.length > 0 && (
          <table className="req-table">
            <thead>
              <tr>
                <th scope="col" className="req-table__check">
                  <input
                    type="checkbox"
                    aria-label="Select all requests in review on this page"
                    checked={allOnPageSelected}
                    disabled={selectable.length === 0}
                    onChange={toggleAll}
                  />
                </th>
                <th scope="col">Employee</th>
                <th scope="col">Type</th>
                <th scope="col">Period</th>
                {!isLeader && <th scope="col">Leader</th>}
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={selected.has(r.id) ? 'is-selected' : ''}>
                  <td className="req-table__check">
                    {r.estado === 'Pendiente' && (
                      <input
                        type="checkbox"
                        aria-label={`Select the request of ${r.empleado_nombre}`}
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                    )}
                  </td>
                  <td className="req-table__employee">
                    <strong>{r.empleado_nombre}</strong>
                    <span className="req-mono req-sub">
                      {positionOf(r) || (employees.get(r.empleado_id)?.cedula ? `ID ${formatId(employees.get(r.empleado_id).cedula)}` : '')}
                    </span>
                  </td>
                  <td className="req-table__type">
                    {TYPE_LABELS[r.tipo] || r.tipo}
                    {r.soporte_pendiente && <span className="req-flag" title="Supporting document requested">Doc. requested</span>}
                  </td>
                  <td className="req-table__period req-mono">{formatRange(r.fecha_inicio, r.fecha_fin)}</td>
                  {!isLeader && <td className="req-table__leader">{leaderOf(r) ? shortName(leaderOf(r).nombre) : '—'}</td>}
                  <td className="req-table__status"><RequestStatus status={r.estado} /></td>
                  <td className="req-table__open">
                    <button type="button" className="req-link" onClick={() => setModal({ type: 'detail', request: r })}>
                      Open<span className="sr-only"> request of {r.empleado_nombre}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {rows.length > 0 && (
          <div className="people__footer">
            <span>Showing {firstIndex + 1}–{firstIndex + rows.length} of {filtered.length}</span>
            <span className="people__pager">
              <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button>
              <span>{currentPage} / {pageCount}</span>
              <button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>›</button>
            </span>
          </div>
        )}
      </main>

      {modal?.type === 'detail' && (
        <RequestDetailModal
          requestId={modal.request.id}
          employee={employees.get(modal.request.empleado_id)}
          leader={leaderOf(modal.request)}
          team={teamOf(modal.request)}
          onClose={() => setModal(null)}
          onDone={finished}
          onReject={(request, comment) => setModal({ type: 'reject', request, comment })}
          onAskDocument={(request) => setModal({ type: 'document', request })}
        />
      )}
      {modal?.type === 'reject' && (
        <RejectModal
          request={modal.request}
          employee={employees.get(modal.request.empleado_id)}
          initialComment={modal.comment}
          onClose={() => setModal(null)}
          onDone={finished}
        />
      )}
      {modal?.type === 'document' && (
        <AskDocumentModal request={modal.request} onClose={() => setModal(null)} onDone={finished} />
      )}
      {modal?.type === 'bulk' && (
        <BulkApproveModal requests={selectedRows} onClose={() => setModal(null)} onDone={finished} />
      )}
    </>
  );
}

// Approves several requests one by one; the ones that fail (e.g. not enough vacation days) are listed
function BulkApproveModal({ requests, onClose, onDone }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState([]);

  async function run() {
    setRunning(true);
    const failed = [];
    for (const [i, r] of requests.entries()) {
      try {
        await decideRequest(r.id, 'Aprobado');
      } catch (err) {
        failed.push({ request: r, message: getErrorMessage(err) });
      }
      setProgress(i + 1);
    }
    const approved = requests.length - failed.length;
    if (failed.length === 0) {
      onDone(`${approved} request${approved === 1 ? '' : 's'} approved.`);
      return;
    }
    setFailures(failed);
    setRunning(false);
  }

  const done = failures.length > 0;
  return (
    <Modal
      title={done ? 'Some requests were not approved' : `Approve ${requests.length} request${requests.length === 1 ? '' : 's'}?`}
      subtitle={done
        ? `${requests.length - failures.length} of ${requests.length} approved. These need your attention:`
        : 'Each employee receives a notification and an email. Vacation days are deducted from their balance.'}
      onClose={done ? () => onDone(`${requests.length - failures.length} of ${requests.length} requests approved.`) : onClose}
      footer={done ? (
        <button type="button" className="btn btn--dark" onClick={() => onDone(`${requests.length - failures.length} of ${requests.length} requests approved.`)}>Close</button>
      ) : (
        <>
          <button type="button" className="btn" disabled={running} onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--dark" disabled={running} onClick={run}>
            {running ? `Approving ${progress} / ${requests.length}…` : 'Approve'}
          </button>
        </>
      )}
    >
      <ul className="req-bulk-list">
        {(done ? failures.map((f) => f.request) : requests).map((r) => (
          <li key={r.id}>
            <span>
              <strong>{r.empleado_nombre}</strong> · {TYPE_LABELS[r.tipo] || r.tipo} · <span className="req-mono">{formatRange(r.fecha_inicio, r.fecha_fin)}</span>
            </span>
            {done && <span className="req-bulk-list__error">{failures.find((f) => f.request.id === r.id).message}</span>}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
