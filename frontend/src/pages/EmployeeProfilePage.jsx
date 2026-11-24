import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { forgotPassword } from '../api/authApi';
import {
  deactivateEmployee,
  getEmployee,
  listEmployees,
  listLeaders,
  listPositions,
  reactivateEmployee,
} from '../api/employeesApi';
import { PageHeader } from '../components/AppLayout';
import Modal from '../components/Modal';
import EmployeeContactsTab from './EmployeeContactsTab';
import EmployeePositionTab from './EmployeePositionTab';
import EmployeeReceiptsTab from './EmployeeReceiptsTab';
import EmployeeTimeOffTab from './EmployeeTimeOffTab';
import { getErrorMessage } from '../utils/errors';
import {
  ageFrom,
  firstName,
  formatDate,
  formatId,
  genderLabel,
  initials,
  maritalLabel,
  positionSummary,
  ROLE_LABELS,
  shortName,
  STATUS_LABELS,
} from '../utils/people';
import './EmployeeProfilePage.css';

const TABS = ['Personal details', 'Position', 'Time Off', 'Emergency Contacts', 'Pay Stubs', 'Social Security Receipts'];

async function loadProfile(id) {
  const [employee, positions, employees, leaders] = await Promise.all([
    getEmployee(id),
    listPositions(id),
    listEmployees(),
    listLeaders(),
  ]);
  // Role and username only come in the list of employees
  const listed = employees.find((item) => item.id === employee.id);
  return {
    id,
    employee,
    positions,
    role: listed?.rol,
    username: listed?.usuario || null,
    leader: leaders.find((leader) => leader.id === employee.lider_id) || null,
    ownLeaderRecord: leaders.find((leader) => leader.empleado_id === employee.id) || null,
  };
}

function StatusBadge({ status }) {
  return <span className={`status status--${status.toLowerCase()}`}>{STATUS_LABELS[status] || status}</span>;
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

export default function EmployeeProfilePage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState(TABS[0]);

  const [toast, setToast] = useState(location.state?.toast || '');
  const [actionError, setActionError] = useState('');
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    loadProfile(id)
      .then((data) => {
        if (!active) return;
        setProfile(data);
        setLoadError('');
      })
      .catch((err) => { if (active) setLoadError(getErrorMessage(err)); });
    return () => { active = false; };
  }, [id, version]);

  // The message came from another page: once shown, a reload must not repeat it
  useEffect(() => {
    if (location.state?.toast) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  const crumbs = [{ label: 'People', to: '/people' }];

  if (loadError && !profile) {
    return (
      <>
        <PageHeader crumbs={crumbs} />
        <main className="app__content">
          <p className="profile__alert" role="alert">{loadError}</p>
          <Link to="/people" className="btn">Back to People</Link>
        </main>
      </>
    );
  }

  if (!profile || profile.id !== id) {
    return (
      <>
        <PageHeader crumbs={crumbs} />
        <main className="app__content"><p role="status" className="profile__loading">Loading employee…</p></main>
      </>
    );
  }

  const { employee, positions, role, username, leader, ownLeaderRecord } = profile;
  const inactive = employee.estado === 'Inactivo';
  const { current, hireDate } = positionSummary(positions);
  const name = firstName(employee.nombre);

  async function runAction(action, message) {
    setWorking(true);
    setActionError('');
    try {
      await action();
      setToast(message);
      setVersion((value) => value + 1);
      return true;
    } catch (err) {
      setActionError(getErrorMessage(err));
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function handleDeactivate() {
    await runAction(() => deactivateEmployee(id), `${employee.nombre} was deactivated. Their records are kept.`);
    setConfirmingDeactivate(false);
    window.scrollTo({ top: 0 });
  }

  function handleReactivate() {
    runAction(() => reactivateEmployee(id), `${employee.nombre} was reactivated.`);
  }

  function handleSendReset() {
    runAction(() => forgotPassword(employee.correo), `A password reset code was sent to ${employee.correo}.`);
  }

  return (
    <>
      <PageHeader
        crumbs={[
          ...crumbs,
          { label: employee.nombre },
          { label: tab },
        ]}
      />

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
              ? <img className="profile__photo" src={employee.foto_url} alt="" />
              : <span className="profile__photo" aria-hidden="true">{initials(employee.nombre)}</span>}
            <div>
              <div className="profile__name-row">
                <h1>{employee.nombre}</h1>
                <StatusBadge status={employee.estado} />
              </div>
              <p className="profile__meta">
                {[
                  `ID ${formatId(employee.cedula)}`,
                  hireDate && `Joined ${formatDate(hireDate)}`,
                  leader && `Leader: ${shortName(leader.nombre)}`,
                ].filter(Boolean).join('  ·  ')}
              </p>
            </div>
          </div>

          <div className="profile__actions">
            {!inactive && <Link to={`/people/${id}/edit`} className="btn">Edit employee</Link>}
            {!inactive && <Link to={`/people/${id}/assign-leader`} className="btn">Assign leader</Link>}
            {inactive
              ? <button type="button" className="btn btn--orange" disabled={working} onClick={handleReactivate}>Reactivate employee</button>
              : <button type="button" className="btn btn--danger" onClick={() => { setActionError(''); setConfirmingDeactivate(true); }}>Deactivate employee</button>}
          </div>
        </div>

        <div className="tabs" role="tablist" aria-label="Employee sections">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              className={`tabs__tab${tab === item ? ' is-active' : ''}`}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {actionError && !confirmingDeactivate && <p className="profile__alert" role="alert">{actionError}</p>}

        {tab === 'Position' && (
          <EmployeePositionTab
            employee={employee}
            positions={positions}
            inactive={inactive}
            onChanged={(message) => {
              setToast(message);
              setVersion((value) => value + 1);
            }}
          />
        )}

        {tab === 'Emergency Contacts' && <EmployeeContactsTab employee={employee} onMessage={setToast} />}

        {tab === 'Time Off' && <EmployeeTimeOffTab employee={employee} />}

        {tab === 'Pay Stubs' && (
          <EmployeeReceiptsTab employee={employee} kind="comprobantes" title="Pay stubs" noun="pay stub" />
        )}

        {tab === 'Social Security Receipts' && (
          <EmployeeReceiptsTab
            employee={employee}
            kind="comprobantes-seguridad-social"
            title="Social security receipts"
            noun="social security receipt"
          />
        )}

        {tab === TABS[0] && (
          <>
            {inactive && (
              <p className="profile__inactive" role="status">
                <strong>{name} is inactive.</strong> They cannot sign in, and their records are kept. Reactivate them to restore access.
              </p>
            )}

            <div className="profile__columns">
              <div className="profile__main">
                <section aria-labelledby="personal-title">
                  <h2 id="personal-title" className="section-title">Personal information</h2>
                  <DataRows
                    rows={[
                      ['Full name', employee.nombre],
                      ['ID number', formatId(employee.cedula)],
                      ['Date of birth', employee.fecha_nacimiento && `${formatDate(employee.fecha_nacimiento)} · ${ageFrom(employee.fecha_nacimiento)} years`],
                      ['Marital status', maritalLabel(employee.estado_civil)],
                      ['Gender', genderLabel(employee.genero)],
                      ['Phone', employee.telefono],
                      ['Corporate email', employee.correo],
                      ['Address', employee.direccion],
                    ]}
                  />
                </section>

                <section aria-labelledby="social-title">
                  <h2 id="social-title" className="section-title">Social security &amp; benefits</h2>
                  <DataRows
                    rows={[
                      ['EPS (health)', employee.eps],
                      ['ARL (occupational risk)', employee.arl],
                      ['Pension fund', employee.fondo_pension],
                      ['Severance fund (cesantías)', employee.cesantias],
                      ['Vacation days', `${employee.dias_vacaciones} available`],
                      ['Holidays deducted from vacation', employee.festivos_descuentan ? 'Yes' : 'No'],
                    ]}
                  />
                </section>
              </div>

              <div className="profile__side">
                <section aria-labelledby="position-title">
                  <h2 id="position-title" className="section-title">Current position</h2>
                  <DataRows
                    rows={[
                      ['Position', current?.cargo],
                      ['Area', current?.area],
                      ['Leader', leader && shortName(leader.nombre)],
                      ['Hire date', hireDate && formatDate(hireDate)],
                      ['System role', ROLE_LABELS[role] || role],
                      ...(ownLeaderRecord ? [['Can view their team', ownLeaderRecord.puede_ver_equipo === false ? 'No' : 'Yes']] : []),
                      ['Status', <StatusBadge key="status" status={employee.estado} />],
                    ]}
                  />
                </section>

                <section className="access" aria-labelledby="access-title">
                  <h2 id="access-title" className="section-title section-title--plain">Access</h2>
                  <p className="access__text">
                    {username ? <>Username: <strong>{username}</strong></> : 'No login yet'}
                  </p>
                  {inactive
                    ? (
                      <>
                        <button type="button" className="btn" disabled>{username ? 'Change password' : 'Create login'}</button>
                        {username && <button type="button" className="btn" disabled>Send password reset code</button>}
                      </>
                    )
                    : (
                      <>
                        <Link to={`/people/${id}/password`} className="btn btn--dark">{username ? 'Change password' : 'Create login'}</Link>
                        {username && (
                          <button type="button" className="btn" disabled={working} onClick={handleSendReset}>
                            Send password reset code
                          </button>
                        )}
                      </>
                    )}
                </section>
              </div>
            </div>
          </>
        )}
      </main>

      {confirmingDeactivate && (
        <Modal
          title="Deactivate employee?"
          subtitle="They will lose access to the portal. Their records are kept, and you can reactivate them at any time."
          onClose={() => setConfirmingDeactivate(false)}
          footer={(
            <>
              <button type="button" className="btn" disabled={working} onClick={() => setConfirmingDeactivate(false)}>Cancel</button>
              <button type="button" className="btn btn--danger" disabled={working} onClick={handleDeactivate}>
                {working ? 'Deactivating…' : 'Deactivate employee'}
              </button>
            </>
          )}
        >
          <div className="person-card">
            <span className="person-card__photo" aria-hidden="true">{initials(employee.nombre)}</span>
            <span className="person-card__text">
              <strong>{employee.nombre}</strong>
              <span>{[current?.cargo, current?.area].filter(Boolean).join(' · ') || 'No position'}</span>
            </span>
            <StatusBadge status={employee.estado} />
          </div>
          {actionError && <p className="profile__alert" role="alert">{actionError}</p>}
        </Modal>
      )}
    </>
  );
}
