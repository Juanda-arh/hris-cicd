import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getOrganizationSize, getSizeByArea, getTeamSizeByLeader } from '../api/reportsApi';
import { PageHeader } from '../components/AppLayout';
import { getErrorMessage } from '../utils/errors';
import './NewEmployeePage.css';
import './EmployeeProfilePage.css';
import './EmployeeTabs.css';
import './ReportsPage.css';

const REPORTS = [
  { key: 'organization', label: 'Organization Size', load: getOrganizationSize },
  { key: 'area', label: 'Organization Size by Area', load: getSizeByArea },
  { key: 'leader', label: 'Team Size by Leader', load: getTeamSizeByLeader },
];

// Bar colours, in order (from the design)
const COLORS = ['orange', 'yellow', 'blue', 'mint', 'black', 'grey'];
const colorOf = (i) => COLORS[i % COLORS.length];

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const inWords = (n) => NUMBER_WORDS[n] ?? String(n);

function share(part, total) {
  if (!total) return '0%';
  const value = (part / total) * 100;
  return `${value === 100 ? '100' : value.toFixed(1)}%`;
}

const todayLabel = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const areaName = (area) => area ?? 'No area';

/* ---------- Organization size ---------- */
function OrganizationReport({ data }) {
  const active = data.total; // every employee who is not inactive
  const total = active + data.inactivos;
  const states = data.porEstado || {};
  const leaders = data.lideres || 0;

  return (
    <>
      <dl className="rep-stats">
        <div className="rep-stats--grey"><dt>Total employees</dt><dd>{total}</dd></div>
        <div className="rep-stats--mint"><dt>Active</dt><dd>{active}</dd></div>
        <div className="rep-stats--grey rep-stats--boxed"><dt>Inactive</dt><dd>{data.inactivos}</dd></div>
      </dl>

      <div className="rep-split" role="img" aria-label={`Active ${active}, inactive ${data.inactivos}`}>
        <span className="rep-split__active" style={{ width: share(active, total) === '0%' ? 0 : `${(active / total) * 100}%` }} />
      </div>
      <ul className="rep-legend">
        <li><span className="rep-swatch rep-swatch--black" />Active · {active} ({share(active, total)})</li>
        <li><span className="rep-swatch rep-swatch--grey" />Inactive · {data.inactivos} ({share(data.inactivos, total)})</li>
      </ul>

      <div className="rep-tables">
        <table className="rep-table">
          <thead><tr><th scope="col">Status</th><th scope="col">People</th><th scope="col">Share</th></tr></thead>
          <tbody>
            <tr><td>Active</td><td className="rep-num">{active}</td><td className="rep-num">{share(active, total)}</td></tr>
            <tr className="rep-table__sub"><td>Working</td><td className="rep-num">{states.Activo ?? 0}</td><td className="rep-num">{share(states.Activo ?? 0, total)}</td></tr>
            <tr className="rep-table__sub"><td>On vacation</td><td className="rep-num">{states.Vacaciones ?? 0}</td><td className="rep-num">{share(states.Vacaciones ?? 0, total)}</td></tr>
            <tr className="rep-table__sub"><td>On leave</td><td className="rep-num">{states.Permiso ?? 0}</td><td className="rep-num">{share(states.Permiso ?? 0, total)}</td></tr>
            <tr><td>Inactive</td><td className="rep-num">{data.inactivos}</td><td className="rep-num">{share(data.inactivos, total)}</td></tr>
            <tr className="rep-table__total"><td>Total</td><td className="rep-num">{total}</td><td className="rep-num">{total ? '100%' : '0%'}</td></tr>
          </tbody>
        </table>

        <table className="rep-table">
          <thead><tr><th scope="col">Active by system role</th><th scope="col">People</th></tr></thead>
          <tbody>
            <tr><td>Leader</td><td className="rep-num">{leaders}</td></tr>
            <tr><td>Employee</td><td className="rep-num">{Math.max(active - leaders, 0)}</td></tr>
            <tr className="rep-table__total"><td>Total</td><td className="rep-num">{active}</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------- By area ---------- */
function AreaReport({ data }) {
  const areas = data.areas || [];
  const max = Math.max(1, ...areas.map((a) => a.total));
  if (areas.length === 0) return <p className="tab-empty">There are no active employees yet.</p>;

  return (
    <>
      {/* Desktop: columns */}
      <div className="rep-columns" role="img" aria-label="Active employees by area">
        {areas.map((a, i) => (
          <div key={areaName(a.area)} className="rep-columns__item">
            <span className="rep-columns__plot">
              <span className={`rep-columns__bar rep-fill--${colorOf(i)}`} style={{ height: `${(a.total / max) * 100}%` }}>
                <span className="rep-columns__value">{a.total}</span>
              </span>
            </span>
            <span className="rep-columns__label">{areaName(a.area)}</span>
          </div>
        ))}
      </div>

      {/* Mobile: horizontal bars */}
      <ul className="rep-bars rep-bars--compact" aria-hidden="true">
        {areas.map((a, i) => (
          <li key={areaName(a.area)}>
            <span className="rep-bars__head"><span>{areaName(a.area)}</span><span className="rep-num">{a.total}</span></span>
            <span className="rep-bars__track"><span className={`rep-bars__fill rep-fill--${colorOf(i)}`} style={{ width: `${(a.total / max) * 100}%` }} /></span>
          </li>
        ))}
      </ul>

      <table className="rep-table rep-table--wide">
        <thead><tr><th scope="col">Area</th><th scope="col">Active employees</th><th scope="col">Share</th></tr></thead>
        <tbody>
          {areas.map((a) => (
            <tr key={areaName(a.area)}>
              <td className={a.area ? '' : 'rep-muted'}>{areaName(a.area)}</td>
              <td className="rep-num">{a.total}</td>
              <td className="rep-num">{share(a.total, data.total)}</td>
            </tr>
          ))}
          <tr className="rep-table__total"><td>Total</td><td className="rep-num">{data.total}</td><td className="rep-num">{data.total ? '100%' : '0%'}</td></tr>
        </tbody>
      </table>
      {areas.some((a) => a.area === null) && (
        <p className="rep-note">“No area”: employees without a current position, or whose position has no area.</p>
      )}
    </>
  );
}

/* ---------- By leader ---------- */
function LeaderReport({ data }) {
  const leaders = data.lideres || [];
  const max = Math.max(1, ...leaders.map((l) => l.directos));
  if (leaders.length === 0) return <p className="tab-empty">There are no active leaders yet.</p>;

  return (
    <>
      <ul className="rep-bars">
        {leaders.map((l, i) => (
          <li key={l.liderId} className="rep-bars__row">
            <span className="rep-bars__who">
              <strong>{l.nombre}</strong>
              <span>{l.area || l.cargo || '—'}</span>
            </span>
            <span className="rep-bars__track"><span className={`rep-bars__fill rep-fill--${colorOf(i)}`} style={{ width: `${(l.directos / max) * 100}%` }} /></span>
            <span className="rep-num rep-bars__value">{l.directos}</span>
          </li>
        ))}
      </ul>

      <table className="rep-table rep-table--wide">
        <thead>
          <tr>
            <th scope="col">Leader</th>
            <th scope="col">Area</th>
            <th scope="col">Team size</th>
            <th scope="col">Whole branch</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {leaders.map((l) => (
            <tr key={l.liderId}>
              <td>{l.nombre}</td>
              <td className={l.area ? '' : 'rep-muted'}>{l.area || '—'}</td>
              <td className="rep-num">{l.directos}</td>
              <td className="rep-num">{l.totalEquipo}</td>
              <td className="rep-num">{share(l.directos, data.totalEmpleados)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="rep-note">
        Team size: people who report directly to the leader. Whole branch: everyone below them, including their sub-leaders’ teams.
        {' '}{data.sinLider > 0 && `${data.sinLider} active employee${data.sinLider === 1 ? ' has' : 's have'} no leader (the CEO included).`}
      </p>
    </>
  );
}

function subtitle(key, data) {
  const asOf = `as of ${todayLabel()}`;
  if (key === 'organization') return `Total employees in the portal, active and inactive · ${asOf}`;
  if (key === 'area') {
    const n = (data.areas || []).filter((a) => a.area !== null).length;
    return `${data.total} active employees across ${inWords(n)} area${n === 1 ? '' : 's'} · ${asOf}`;
  }
  return `People reporting directly to each leader · active employees · ${asOf}`;
}

export default function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const report = REPORTS.find((r) => r.key === params.get('type')) ?? REPORTS[0];

  const [state, setState] = useState({ key: null, data: null, error: '' });

  useEffect(() => {
    let active = true;
    report.load()
      .then((data) => { if (active) setState({ key: report.key, data, error: '' }); })
      .catch((err) => { if (active) setState({ key: report.key, data: null, error: getErrorMessage(err) }); });
    return () => { active = false; };
  }, [report]);

  const ready = state.key === report.key && state.data;
  const loading = state.key !== report.key;
  const titles = { organization: 'Organization size', area: 'Organization size by area', leader: 'Team size by leader' };

  return (
    <>
      <PageHeader crumbs={[{ label: 'Reports' }, { label: report.label }]} />

      <main className="app__content reports">
        <aside className="reports__side">
          <p className="reports__eyebrow">Report type</p>
          <nav aria-label="Report type">
            <ul className="reports__types">
              {REPORTS.map((r) => (
                <li key={r.key}>
                  <button
                    type="button"
                    className={`reports__type${r.key === report.key ? ' is-active' : ''}`}
                    aria-current={r.key === report.key ? 'page' : undefined}
                    onClick={() => setParams({ type: r.key })}
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <section className="reports__main" aria-live="polite">
          <h1 className="new-employee__title">{titles[report.key]}</h1>
          {ready && <p className="new-employee__subtitle">{subtitle(report.key, state.data)}</p>}

          {loading && <p className="tab-empty" role="status">Loading report…</p>}
          {state.key === report.key && state.error && <p className="profile__alert" role="alert">{state.error}</p>}

          {ready && report.key === 'organization' && <OrganizationReport data={state.data} />}
          {ready && report.key === 'area' && <AreaReport data={state.data} />}
          {ready && report.key === 'leader' && <LeaderReport data={state.data} />}
        </section>
      </main>
    </>
  );
}
