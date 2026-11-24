import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getMyContacts, getMyPositions, getMyProfile } from '../api/selfServiceApi';
import { PageHeader } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';
import {
  ageFrom,
  formatDate,
  formatId,
  formatMoney,
  genderLabel,
  initials,
  maritalLabel,
  positionSummary,
  STATUS_LABELS,
} from '../utils/people';
import './EmployeeProfilePage.css';
import './EmployeeTabs.css';
import './PeoplePage.css';
import './SelfService.css';

const ROLE_NAMES = { admin: 'Administrator', lider: 'Leader', empleado: 'Employee' };

async function loadMine() {
  const [employee, positions, contacts] = await Promise.all([
    getMyProfile(),
    getMyPositions(),
    getMyContacts().catch(() => []), // contacts are secondary: the profile still shows without them
  ]);
  return { employee, positions, contacts };
}

function DataRows({ rows }) {
  return (
    <dl className="data-rows">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="1" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export default function MyProfilePage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [noRecord, setNoRecord] = useState(false);
  const [toast, setToast] = useState(location.state?.toast || '');

  useEffect(() => {
    let active = true;
    loadMine()
      .then((result) => { if (active) setData(result); })
      .catch((err) => {
        if (!active) return;
        if (err.response?.status === 404) setNoRecord(true);
        else setError(getErrorMessage(err));
      });
    return () => { active = false; };
  }, []);

  // A message from the edit page: once shown, a reload must not repeat it
  useEffect(() => {
    if (location.state?.toast) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  const crumbs = [{ label: 'My Profile' }];
  const actions = (
    <>
      <Link to={user.rol === 'empleado' ? '/account/password' : '/change-password'} className="btn">
        <LockIcon />
        Change password
      </Link>
      {data && (
        <Link to="/my-profile/edit" className="btn btn--dark">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" /></svg>
          Edit personal information
        </Link>
      )}
    </>
  );

  if (noRecord) {
    return (
      <>
        <PageHeader crumbs={crumbs}>{actions}</PageHeader>
        <main className="app__content">
          <h1 className="self__title">{user.nombre}</h1>
          <p className="self__empty">
            Your {ROLE_NAMES[user.rol]?.toLowerCase() || 'user'} account has no employee record, so there is no personal profile to show.
            You can still change your password.
          </p>
        </main>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader crumbs={crumbs}>{actions}</PageHeader>
        <main className="app__content">
          {error
            ? <p className="profile__alert" role="alert">{error}</p>
            : <p className="profile__loading" role="status">Loading your profile…</p>}
        </main>
      </>
    );
  }

  const { employee, positions, contacts } = data;
  const { current } = positionSummary(positions);
  const status = employee.estado || 'Activo';

  return (
    <>
      <PageHeader crumbs={crumbs}>{actions}</PageHeader>

      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setToast('')}>×</button>
        </div>
      )}

      <main className="app__content profile">
        <div className="profile__head">
          <div className="profile__identity">
            {employee.foto_url
              ? <img className="profile__photo self__photo" src={employee.foto_url} alt="" />
              : <span className="profile__photo self__photo" aria-hidden="true">{initials(employee.nombre)}</span>}
            <div>
              <h1 className="self__name">{employee.nombre}</h1>
              <p className="profile__meta">{[current?.cargo, current?.area].filter(Boolean).join(' · ') || 'No current position'}</p>
              <p className="self__badges">
                <span className={`self__badge${status === 'Activo' ? ' self__badge--ok' : ''}`}>{(STATUS_LABELS[status] || status).toUpperCase()}</span>
                <span className="self__badge">ROLE: {(ROLE_NAMES[user.rol] || user.rol).toUpperCase()}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="profile__columns">
          <div className="profile__main">
            <section aria-labelledby="personal-title">
              <h2 id="personal-title" className="section-title">Personal details</h2>
              <DataRows
                rows={[
                  ['ID number', <span key="id" className="self__mono">{formatId(employee.cedula)}</span>],
                  ['Date of birth', employee.fecha_nacimiento && <span key="dob" className="self__mono">{formatDate(employee.fecha_nacimiento)} · {ageFrom(employee.fecha_nacimiento)}</span>],
                  ['Marital status', maritalLabel(employee.estado_civil)],
                  ['Gender', genderLabel(employee.genero)],
                  ['Corporate email', employee.correo],
                  ['Phone', employee.telefono && <span key="tel" className="self__mono">{employee.telefono}</span>],
                  ['Address', employee.direccion],
                  ['EPS (health)', employee.eps],
                ]}
              />
            </section>
          </div>

          <div className="profile__side">
            <section aria-labelledby="benefits-title">
              <div className="self__section-head">
                <h2 id="benefits-title" className="section-title section-title--plain">Benefits &amp; time off</h2>
                <span className="self__managed"><LockIcon /> Managed by HR</span>
              </div>
              <DataRows
                rows={[
                  ['ARL (occupational risk)', employee.arl],
                  ['Pension fund', employee.fondo_pension],
                  ['Severance fund (Cesantías)', employee.cesantias],
                  ['Vacation days', employee.dias_vacaciones != null && `${employee.dias_vacaciones} available`],
                ]}
              />
            </section>

            <section aria-labelledby="contacts-title">
              <h2 id="contacts-title" className="section-title">Emergency contacts</h2>
              {contacts.length === 0
                ? <p className="self__empty">No emergency contacts yet. Ask HR to add them.</p>
                : <DataRows rows={contacts.map((c) => [`${c.nombre} · ${c.parentesco}`, <span key={c.id} className="self__mono">{c.telefono}</span>])} />}
            </section>
          </div>
        </div>

        <section className="self__history" aria-labelledby="history-title">
          <div className="self__history-head">
            <h2 id="history-title">Position history</h2>
            <span>Salaries are visible only to you and HR</span>
          </div>
          {positions.length === 0
            ? <p className="self__empty">No positions registered yet.</p>
            : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Position</th>
                      <th scope="col">Area</th>
                      <th scope="col">Start date</th>
                      <th scope="col">End date</th>
                      <th scope="col">Salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p) => (
                      <tr key={p.id}>
                        <td>{p.cargo}</td>
                        <td>{p.area || '—'}</td>
                        <td className="nowrap self__mono">{formatDate(p.inicio)}</td>
                        <td className="nowrap self__mono">{p.fin ? formatDate(p.fin) : <span className="self__current">CURRENT</span>}</td>
                        <td className="nowrap self__mono">{p.sueldo != null ? `${formatMoney(p.sueldo)} USD` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </section>
      </main>
    </>
  );
}
