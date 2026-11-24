import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getEmployee, getTeamContacts, listPositions } from '../api/employeesApi';
import { PageHeader } from '../components/AppLayout';
import { getErrorMessage } from '../utils/errors';
import {
  ageFrom,
  firstName,
  formatDate,
  genderLabel,
  initials,
  maritalLabel,
  positionSummary,
  STATUS_LABELS,
} from '../utils/people';
import EmployeeTimeOffTab from './EmployeeTimeOffTab';
import './EmployeeProfilePage.css';
import './EmployeeTabs.css';
import './PeoplePage.css';

// A leader looks at someone on their team: everything is read-only, with no ID number, salary or social security
const TABS = ['Personal details', 'Position', 'Time Off', 'Emergency Contacts'];

async function loadMember(id) {
  const [employee, positions, contacts] = await Promise.all([
    getEmployee(id),
    listPositions(id),
    getTeamContacts(id),
  ]);
  return { id, employee, positions, contacts };
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

function StatusBadge({ status }) {
  return <span className={`status status--${status.toLowerCase()}`}>{STATUS_LABELS[status] || status}</span>;
}

export default function TeamMemberPage() {
  const { id } = useParams();
  const [member, setMember] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(TABS[0]);

  useEffect(() => {
    let active = true;
    loadMember(id)
      .then((data) => { if (active) { setMember(data); setError(''); } })
      .catch((err) => {
        if (!active) return;
        const status = err.response?.status;
        setError(status === 404
          ? 'This person is not on your team.'
          : status === 403
            ? 'You do not have permission to view your team yet. Ask administration to enable it.'
            : getErrorMessage(err));
      });
    return () => { active = false; };
  }, [id]);

  const crumbs = [{ label: 'My Team', to: '/my-team' }];

  if (error) {
    return (
      <>
        <PageHeader crumbs={crumbs} />
        <main className="app__content">
          <p className="profile__alert" role="alert">{error}</p>
          <Link to="/my-team" className="btn">Back to My Team</Link>
        </main>
      </>
    );
  }

  if (!member || member.id !== id) {
    return (
      <>
        <PageHeader crumbs={crumbs} />
        <main className="app__content"><p role="status" className="profile__loading">Loading…</p></main>
      </>
    );
  }

  const { employee, positions, contacts } = member;
  const { current, hireDate } = positionSummary(positions);
  const currentCargo = current?.cargo || employee.cargo;

  return (
    <>
      <PageHeader crumbs={[...crumbs, { label: employee.nombre }, { label: tab }]} />

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
                {[currentCargo, hireDate && `Joined ${formatDate(hireDate)}`, 'On your team'].filter(Boolean).join('  ·  ')}
              </p>
            </div>
          </div>
          <p className="readonly-note">View only — administration keeps this information up to date.</p>
        </div>

        <div className="tabs" role="tablist" aria-label="Team member sections">
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

        {tab === 'Personal details' && (
          <div className="profile__columns">
            <div className="profile__main">
              <section aria-labelledby="personal-title">
                <h2 id="personal-title" className="section-title">Personal information</h2>
                <DataRows
                  rows={[
                    ['Full name', employee.nombre],
                    ['Date of birth', employee.fecha_nacimiento && `${formatDate(employee.fecha_nacimiento)} · ${ageFrom(employee.fecha_nacimiento)} years`],
                    ['Marital status', maritalLabel(employee.estado_civil)],
                    ['Gender', genderLabel(employee.genero)],
                    ['Phone', employee.telefono],
                    ['Corporate email', employee.correo],
                    ['Address', employee.direccion],
                  ]}
                />
              </section>
            </div>
            <div className="profile__side">
              <section aria-labelledby="position-title">
                <h2 id="position-title" className="section-title">Current position</h2>
                <DataRows
                  rows={[
                    ['Position', currentCargo],
                    ['Area', current?.area],
                    ['Function', current?.funcion],
                    ['Hire date', hireDate && formatDate(hireDate)],
                    ['Vacation days', employee.dias_vacaciones != null && `${employee.dias_vacaciones} available`],
                    ['Status', <StatusBadge key="status" status={employee.estado} />],
                  ]}
                />
              </section>
              <section aria-labelledby="contacts-side-title">
                <h2 id="contacts-side-title" className="section-title">Emergency contacts</h2>
                <DataRows rows={contacts.length > 0 ? contacts.map((c) => [`${c.nombre} (${c.parentesco})`, c.telefono]) : [['Contacts', 'None registered']]} />
              </section>
            </div>
          </div>
        )}

        {tab === 'Position' && (
          <div className="position-tab">
            <section className="current-card" aria-labelledby="current-title">
              <div className="current-card__head">
                <div className="current-card__title">
                  <h2 id="current-title">Current position</h2>
                  {current && <span className="tag-current">Current</span>}
                </div>
              </div>
              {current
                ? (
                  <div className="current-card__body">
                    <div className="current-card__info">
                      <p className="current-card__name">{current.cargo}</p>
                      <div className="chips">
                        {current.area && <span className="chip chip--blue">Area: {current.area}</span>}
                        {current.funcion && <span className="chip">Function: {current.funcion}</span>}
                      </div>
                      <p className="timeline__dates">Since {formatDate(current.inicio)}</p>
                    </div>
                  </div>
                )
                : <p className="tab-empty">{firstName(employee.nombre)} has no current position.</p>}
            </section>

            <section aria-labelledby="history-title">
              <div className="tab-section-head"><h2 id="history-title">Position history</h2></div>
              {positions.length === 0
                ? <p className="tab-empty">No positions registered yet.</p>
                : (
                  <ol className="timeline">
                    {positions.map((position) => (
                      <li key={position.id} className={!position.fin ? 'is-current' : ''}>
                        <article className="timeline__card">
                          <div className="timeline__top">
                            <div className="timeline__title">
                              <h3>{position.cargo}</h3>
                              {position.area && <span className="chip chip--blue">{position.area}</span>}
                            </div>
                          </div>
                          <p className="timeline__dates">
                            {formatDate(position.inicio)} — {position.fin ? formatDate(position.fin) : 'present'}
                          </p>
                          {position.motivo && <p className="timeline__reason"><strong>Reason:</strong> {position.motivo}</p>}
                        </article>
                      </li>
                    ))}
                  </ol>
                )}
            </section>
          </div>
        )}

        {tab === 'Time Off' && <EmployeeTimeOffTab employee={employee} />}

        {tab === 'Emergency Contacts' && (
          <section aria-labelledby="contacts-title">
            <div className="tab-section-head"><h2 id="contacts-title">Emergency contacts</h2></div>
            {contacts.length === 0
              ? <p className="tab-empty">{firstName(employee.nombre)} has no emergency contacts yet.</p>
              : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Name</th>
                        <th scope="col">Relationship</th>
                        <th scope="col">Phone</th>
                        <th scope="col">City</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((c) => (
                        <tr key={c.id}>
                          <td>{c.nombre}</td>
                          <td>{c.parentesco}</td>
                          <td className="nowrap"><a href={`tel:${c.telefono}`}>{c.telefono}</a></td>
                          <td>{c.ciudad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            <p className="tab-footnote">These people will be contacted in an emergency involving {firstName(employee.nombre)}.</p>
          </section>
        )}
      </main>
    </>
  );
}
