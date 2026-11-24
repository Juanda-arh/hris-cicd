import { useEffect, useMemo, useRef, useState } from 'react';
import { exportAudit, listAudit } from '../api/auditApi';
import { listEmployees } from '../api/employeesApi';
import { PageHeader } from '../components/AppLayout';
import { ChevronLeft, ChevronRight } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import {
  AUDIT_ACTIONS,
  AUDIT_ROLE_LABELS,
  actionLabel,
  formatAuditDate,
  formatDetail,
  formatFilterDate,
  moduleOf,
} from '../utils/audit';
import { getErrorMessage } from '../utils/errors';
import './NewEmployeePage.css';
import './EmployeeProfilePage.css';
import './AuditPage.css';

const PAGE_SIZE = 8;
const EMPTY_FILTERS = { fechaInicio: '', fechaFin: '', personaId: '', accion: '' };

// To fill the "User" filter the most recent entries are read once (up to 1000): the API has no list of every user
const USERS_PAGE_SIZE = 100;
const USERS_MAX_PAGES = 10;

/* ---------- Icons ---------- */
function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M4.5 20.5h15" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H6v18h12V7l-4-4ZM14 3v4h4M9 12h6M9 16h6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

/* ---------- Date range: a field that opens two date pickers ---------- */
function rangeLabel(from, to) {
  if (!from && !to) return '';
  if (from && to) {
    if (from === to) return formatFilterDate(from);
    // Same year: "Oct 01 — Oct 30, 2026"
    const start = from.slice(0, 4) === to.slice(0, 4) ? formatFilterDate(from).replace(/, \d{4}$/, '') : formatFilterDate(from);
    return `${start} — ${formatFilterDate(to)}`;
  }
  return from ? `From ${formatFilterDate(from)}` : `Until ${formatFilterDate(to)}`;
}

function DateRangeField({ from, to, onChange }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const label = rangeLabel(from, to);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => { if (!boxRef.current?.contains(event.target)) setOpen(false); };
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="audit-filter audit-date" ref={boxRef}>
      <span className="audit-filter__label" id="audit-date-label">Date</span>
      <button
        type="button"
        className="audit-field audit-date__toggle"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby="audit-date-label audit-date-value"
        onClick={() => setOpen((value) => !value)}
      >
        <span id="audit-date-value" className={label ? 'audit-date__value' : 'audit-date__placeholder'}>
          {label || 'All dates'}
        </span>
        <CalendarIcon />
      </button>

      {open && (
        <div className="audit-date__panel" role="dialog" aria-label="Date range">
          <label>
            <span>From</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} />
          </label>
          <div className="audit-date__actions">
            <button type="button" className="btn btn--text" disabled={!from && !to} onClick={() => onChange('', '')}>
              Clear dates
            </button>
            <button type="button" className="btn btn--dark" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Pagination ---------- */
// e.g. [1, 2, 3, '…', 156]
function pageList(page, totalPages) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

function AuditPagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="audit-pager" aria-label="Pages">
      <button type="button" className="audit-pager__btn" disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <ChevronLeft />
      </button>
      {pageList(page, totalPages).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="audit-pager__gap" aria-hidden="true">…</span>
        ) : (
          <button
            key={p}
            type="button"
            className={`audit-pager__btn${p === page ? ' is-active' : ''}`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        )
      )}
      <button type="button" className="audit-pager__btn" disabled={page === totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">
        <ChevronRight />
      </button>
    </nav>
  );
}

const formatCount = (n) => Number(n).toLocaleString('en-US');

export default function AuditPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ key: null, data: null, error: '' });
  const [knownUsers, setKnownUsers] = useState(() => new Map()); // personaId → name
  const [roleByName, setRoleByName] = useState(() => new Map());
  const [exporting, setExporting] = useState('');
  const [exportError, setExportError] = useState('');

  const requestKey = JSON.stringify({ filters, page });

  // Entries of the current page
  useEffect(() => {
    let active = true;
    listAudit(filters, page, PAGE_SIZE)
      .then((data) => { if (active) setResult({ key: requestKey, data, error: '' }); })
      .catch((err) => { if (active) setResult({ key: requestKey, data: null, error: getErrorMessage(err) }); });
    return () => { active = false; };
  }, [filters, page, requestKey]);

  // Users for the filter: whoever appears in the most recent entries
  useEffect(() => {
    let active = true;
    (async () => {
      const found = new Map();
      for (let p = 1; p <= USERS_MAX_PAGES; p++) {
        const data = await listAudit({}, p, USERS_PAGE_SIZE);
        data.registros.forEach((r) => { if (r.persona_id && r.persona_nombre) found.set(r.persona_id, r.persona_nombre); });
        if (p >= data.totalPaginas) break;
      }
      if (active) setKnownUsers((prev) => new Map([...found, ...prev]));
    })().catch(() => {}); // without it the filter still lists the users of the page on screen
    return () => { active = false; };
  }, []);

  // Roles: leaders and employees come from the people list; anyone else with a login is an admin
  useEffect(() => {
    let active = true;
    listEmployees()
      .then((employees) => {
        if (active) setRoleByName(new Map((employees || []).map((e) => [e.nombre, e.rol])));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const loading = result.key !== requestKey;
  const data = result.key === requestKey ? result.data : null;
  const records = useMemo(() => data?.registros ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, data?.totalPaginas ?? 1);
  const hasFilters = Object.values(filters).some(Boolean);

  const users = useMemo(() => {
    const all = new Map(knownUsers);
    records.forEach((r) => { if (r.persona_id && r.persona_nombre && !all.has(r.persona_id)) all.set(r.persona_id, r.persona_nombre); });
    if (user?.personaId && user?.nombre && !all.has(user.personaId)) all.set(user.personaId, user.nombre);
    return [...all].map(([id, name]) => ({ id: String(id), name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [knownUsers, records, user]);

  function roleOf(record) {
    if (!record.persona_id) return AUDIT_ROLE_LABELS.system;
    if (record.persona_id === user?.personaId) return AUDIT_ROLE_LABELS[user.rol] ?? AUDIT_ROLE_LABELS.admin;
    const role = roleByName.get(record.persona_nombre);
    if (role) return AUDIT_ROLE_LABELS[role] ?? role;
    return roleByName.size ? AUDIT_ROLE_LABELS.admin : '—';
  }

  function updateFilters(changes) {
    setFilters((prev) => ({ ...prev, ...changes }));
    setPage(1);
    setExportError('');
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setExportError('');
  }

  async function handleExport(format) {
    setExporting(format);
    setExportError('');
    try {
      await exportAudit(format, filters);
    } catch (err) {
      setExportError(getErrorMessage(err));
    } finally {
      setExporting('');
    }
  }

  const canExport = !loading && !result.error && total > 0 && !exporting;
  const first = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <>
      <PageHeader crumbs={[{ label: 'Audit log' }]}>
        <button type="button" className="btn" disabled={!canExport} onClick={() => handleExport('csv')}>
          <DownloadIcon /> {exporting === 'csv' ? 'Exporting…' : 'Export CSV (Excel)'}
        </button>
        <button type="button" className="btn btn--dark" disabled={!canExport} onClick={() => handleExport('pdf')}>
          <FileIcon /> {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
        </button>
      </PageHeader>

      <main className="app__content audit">
        <h1 className="new-employee__title">Audit log</h1>
        <p className="new-employee__subtitle audit__subtitle">
          Every action performed by users in the portal: who, when and what. System events are not logged.
        </p>

        <div className="audit-filters" role="search" aria-label="Filter the audit log">
          <DateRangeField
            from={filters.fechaInicio}
            to={filters.fechaFin}
            onChange={(fechaInicio, fechaFin) => updateFilters({ fechaInicio, fechaFin })}
          />

          <label className="audit-filter">
            <span className="audit-filter__label">User</span>
            <select className="audit-field" value={filters.personaId} onChange={(e) => updateFilters({ personaId: e.target.value })}>
              <option value="">All users</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>

          <label className="audit-filter">
            <span className="audit-filter__label">Action</span>
            <select className="audit-field" value={filters.accion} onChange={(e) => updateFilters({ accion: e.target.value })}>
              <option value="">All actions</option>
              {AUDIT_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </label>

          <button type="button" className="btn btn--text audit-filters__clear" disabled={!hasFilters} onClick={clearFilters}>
            Clear filters
          </button>
        </div>

        {exportError && <p className="profile__alert" role="alert">{exportError}</p>}
        {result.error && result.key === requestKey && <p className="profile__alert" role="alert">{result.error}</p>}

        <section aria-live="polite" aria-busy={loading}>
          {loading && !data && <p className="audit__status" role="status">Loading audit log…</p>}

          {data && records.length === 0 && (
            <div className="audit-empty">
              <span className="audit-empty__icon"><SearchIcon /></span>
              <p className="audit-empty__title">{hasFilters ? 'No entries match these filters' : 'No entries yet'}</p>
              <p className="audit-empty__text">
                {hasFilters
                  ? 'Try another date range or user, or clear the filters to see every action.'
                  : 'Actions performed in the portal will appear here.'}
              </p>
            </div>
          )}

          {records.length > 0 && (
            <>
              <table className="audit-table">
                <thead>
                  <tr>
                    <th scope="col">Date &amp; time</th>
                    <th scope="col">User</th>
                    <th scope="col">Role</th>
                    <th scope="col">Action</th>
                    <th scope="col">Module</th>
                    <th scope="col">Detail</th>
                    <th scope="col">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td className="audit-table__date">{formatAuditDate(r.fecha)}</td>
                      <td className="audit-table__user">{r.persona_nombre || 'System'}</td>
                      <td className="audit-table__role">{roleOf(r)}</td>
                      <td className="audit-table__action">{actionLabel(r.accion)}</td>
                      <td className="audit-table__module">{moduleOf(r)}</td>
                      <td className="audit-table__detail">{formatDetail(r.detalle)}</td>
                      <td className="audit-table__record">
                        {r.tabla_afectada}{r.registro_id !== null && r.registro_id !== undefined ? ` #${r.registro_id}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="audit-footer">
                <span>Showing {formatCount(first)} – {formatCount(last)} of {formatCount(total)} entries</span>
                <AuditPagination page={page} totalPages={totalPages} onChange={setPage} />
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}
