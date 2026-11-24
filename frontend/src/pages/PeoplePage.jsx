import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getOrgChart, listEmployees, listPendingRequests } from '../api/employeesApi';
import { PageHeader } from '../components/AppLayout';
import { getErrorMessage } from '../utils/errors';
import { bossesFromOrgChart, formatId, shortName } from '../utils/people';

// Hidden by default: always the same length, so it does not reveal how long the ID number is
const HIDDEN_ID = '••••••••••';

function EyeIcon({ open }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  );
}
import './PeoplePage.css';

const PAGE_SIZE = 10;
const ROLE_LABELS = { lider: 'Leader', empleado: 'Employee' };
const ON_LEAVE = ['Vacaciones', 'Permiso'];

const STATUS_FILTERS = {
  active: { label: 'Status: active', test: (e) => e.estado !== 'Inactivo' },
  leave: { label: 'Status: on leave', test: (e) => ON_LEAVE.includes(e.estado) },
  inactive: { label: 'Status: inactive', test: (e) => e.estado === 'Inactivo' },
  all: { label: 'Status: all', test: () => true },
};

function normalize(text = '') {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function digitsOnly(text = '') {
  return text.replace(/\D/g, '');
}

export default function PeoplePage() {
  const created = useLocation().state?.created;

  const [employees, setEmployees] = useState([]);
  const [leaders, setLeaders] = useState(new Map());
  const [pendingRequests, setPendingRequests] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [shownIds, setShownIds] = useState(() => new Set());

  useEffect(() => {
    let active = true;

    listEmployees()
      .then((data) => { if (active) setEmployees(data); })
      .catch((err) => { if (active) setError(getErrorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });

    // Secondary data: if it fails, the list still works and shows a dash
    getOrgChart()
      .then((chart) => { if (active) setLeaders(bossesFromOrgChart(chart)); })
      .catch(() => {});
    listPendingRequests()
      .then((data) => { if (active) setPendingRequests(data.length); })
      .catch(() => {});

    return () => { active = false; };
  }, []);

  const counts = useMemo(() => ({
    active: employees.filter(STATUS_FILTERS.active.test).length,
    leave: employees.filter(STATUS_FILTERS.leave.test).length,
    inactive: employees.filter(STATUS_FILTERS.inactive.test).length,
  }), [employees]);

  const filtered = useMemo(() => {
    const text = normalize(search.trim());
    const digits = digitsOnly(search);
    return employees.filter((employee) => {
      const matchesSearch = !text
        || normalize(employee.nombre).includes(text)
        || (digits && digitsOnly(employee.cedula).includes(digits));
      return matchesSearch
        && (role === 'all' || employee.rol === role)
        && STATUS_FILTERS[status].test(employee);
    });
  }, [employees, search, role, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const rows = filtered.slice(firstIndex, firstIndex + PAGE_SIZE);

  function toggleId(employeeId) {
    setShownIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  // Any filter change goes back to the first page
  function changeFilter(setter) {
    return (e) => {
      setter(e.target.value);
      setPage(1);
    };
  }

  return (
    <>
      <PageHeader crumbs={[{ label: 'People' }]}>
        <Link to="/people/new" className="btn btn--orange">New employee</Link>
      </PageHeader>

      <main className="app__content people">
        {created && <p className="people__notice" role="status">{created}</p>}

        <dl className="people__stats">
          <div>
            <dt>Active employees</dt>
            <dd>{loading ? '—' : counts.active}</dd>
          </div>
          <div>
            <dt>Requests to approve</dt>
            <dd className={pendingRequests > 0 ? 'is-alert' : ''}>
              {pendingRequests === null ? '—' : pendingRequests >= 100 ? '100+' : pendingRequests}
            </dd>
          </div>
          <div>
            <dt>On leave</dt>
            <dd>{loading ? '—' : counts.leave}</dd>
          </div>
          <div>
            <dt>Inactive</dt>
            <dd>{loading ? '—' : counts.inactive}</dd>
          </div>
        </dl>

        <div className="people__filters">
          <label className="people__search">
            <span className="sr-only">Search by name or ID number</span>
            <input
              type="search"
              placeholder="Search by name or ID number"
              value={search}
              onChange={changeFilter(setSearch)}
            />
          </label>
          <label>
            <span className="sr-only">Role</span>
            <select value={role} onChange={changeFilter(setRole)}>
              <option value="all">Role: all</option>
              <option value="lider">Role: leader</option>
              <option value="empleado">Role: employee</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Status</span>
            <select value={status} onChange={changeFilter(setStatus)}>
              {Object.entries(STATUS_FILTERS).map(([value, filter]) => (
                <option key={value} value={value}>{filter.label}</option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="people__error" role="alert">{error}</p>}

        {!error && (
          <table className="people__table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Position</th>
                <th scope="col">Leader</th>
                <th scope="col">Role</th>
                <th scope="col">Days</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((employee) => (
                <tr key={employee.id}>
                  <td className="people__name">
                    {employee.nombre}
                    <span className="people__id">
                      <span>{shownIds.has(employee.id) ? formatId(employee.cedula) : HIDDEN_ID}</span>
                      <button
                        type="button"
                        className="people__eye"
                        aria-pressed={shownIds.has(employee.id)}
                        aria-label={`${shownIds.has(employee.id) ? 'Hide' : 'Show'} ID number of ${employee.nombre}`}
                        onClick={() => toggleId(employee.id)}
                      >
                        <EyeIcon open={shownIds.has(employee.id)} />
                      </button>
                    </span>
                  </td>
                  <td className="people__position">{employee.cargo || 'No position'}</td>
                  <td className="people__leader">
                    {leaders.has(employee.id) ? shortName(leaders.get(employee.id).nombre) : '—'}
                  </td>
                  <td className="people__role">{ROLE_LABELS[employee.rol] || employee.rol}</td>
                  <td className="people__days">{employee.dias_vacaciones}</td>
                  <td className="people__open">
                    <Link to={`/people/${employee.id}`} aria-label={`Open ${employee.nombre}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!error && !loading && rows.length === 0 && (
          <p className="people__empty">
            {employees.length === 0 ? 'There are no employees yet.' : 'No employees match these filters.'}
          </p>
        )}
        {loading && <p className="people__empty" role="status">Loading employees…</p>}

        {!error && !loading && filtered.length > 0 && (
          <div className="people__footer">
            <span>
              Showing {firstIndex + 1}–{firstIndex + rows.length} of {filtered.length}
            </span>
            <span className="people__pager">
              <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button>
              <span>{currentPage} / {pageCount}</span>
              <button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>›</button>
            </span>
          </div>
        )}
      </main>
    </>
  );
}
