import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  changeBoss,
  getEmployee,
  getOrgChart,
  listEmployees,
  listLeaders,
} from '../api/employeesApi';
import { PageHeader } from '../components/AppLayout';
import { getErrorMessage } from '../utils/errors';
import { bossChain, bossesFromOrgChart, firstName, initials } from '../utils/people';
import './NewEmployeePage.css';
import './EmployeeProfilePage.css';

const NO_LEADER = 'none';

async function loadData(id) {
  const [employee, employees, leaders, chart] = await Promise.all([
    getEmployee(id),
    listEmployees(),
    listLeaders(),
    getOrgChart(),
  ]);
  const bosses = bossesFromOrgChart(chart);
  const positionOf = (employeeId) => employees.find((item) => item.id === employeeId)?.cargo || 'No position';

  return {
    employee,
    position: positionOf(employee.id),
    currentLeader: leaders.find((leader) => leader.id === employee.lider_id) || null,
    // Not themselves, and nobody who already reports to them: that would create a reporting loop
    candidates: leaders
      .filter((leader) => leader.estado !== 'Inactivo'
        && leader.empleado_id !== employee.id
        && !bossChain(bosses, leader.empleado_id).has(employee.id))
      .map((leader) => ({ ...leader, position: positionOf(leader.empleado_id) })),
  };
}

function normalize(text = '') {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function AssignLeaderPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('');
  const [choice, setChoice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    loadData(id)
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setLoadError(getErrorMessage(err)); });
    return () => { active = false; };
  }, [id]);

  const visible = useMemo(() => {
    if (!data) return [];
    const text = normalize(filter.trim());
    return data.candidates.filter((leader) => !text || normalize(leader.nombre).includes(text));
  }, [data, filter]);

  const crumbs = [{ label: 'People', to: '/people' }];
  if (loadError || !data) {
    return (
      <>
        <PageHeader crumbs={crumbs} />
        <main className="app__content">
          {loadError
            ? <p className="profile__alert" role="alert">{loadError}</p>
            : <p className="profile__loading" role="status">Loading employee…</p>}
        </main>
      </>
    );
  }

  const { employee, position, currentLeader, candidates } = data;
  const profilePath = `/people/${id}`;
  const inactive = employee.estado === 'Inactivo';
  const currentChoice = currentLeader ? currentLeader.id : NO_LEADER;
  const selected = choice ?? currentChoice;
  const selectedLeader = candidates.find((leader) => leader.id === selected) || null;
  const unchanged = selected === currentChoice;

  async function handleSubmit(e) {
    e.preventDefault();
    if (unchanged) return;
    setError('');
    setSaving(true);
    try {
      await changeBoss(employee.id, selectedLeader ? selectedLeader.empleado_id : null);
      navigate(profilePath, {
        state: {
          toast: selectedLeader
            ? `${selectedLeader.nombre} is now the leader of ${employee.nombre}.`
            : `${employee.nombre} no longer has a leader.`,
        },
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        crumbs={[
          ...crumbs,
          { label: employee.nombre, to: profilePath },
          { label: 'Assign leader' },
        ]}
      />
      <main className="app__content new-employee">
        <h1 className="new-employee__title">Assign leader</h1>
        <p className="new-employee__subtitle">Choose the person {firstName(employee.nombre)} will report to.</p>

        {inactive && <p className="profile__alert" role="alert">{employee.nombre} is inactive. Reactivate them first.</p>}
        {error && <p className="profile__alert" role="alert">{error}</p>}

        <form className="new-employee__layout" onSubmit={handleSubmit} noValidate>
          <div className="new-employee__form">
            <fieldset className="form-stack" disabled={inactive}>
              <legend className="sr-only">Assign leader</legend>

              <div className="person-card">
                <span className="person-card__photo" aria-hidden="true">{initials(employee.nombre)}</span>
                <span className="person-card__text">
                  <strong>{employee.nombre}</strong>
                  <span>{position}</span>
                </span>
              </div>

              <div className="form-field">
                <label htmlFor="filter">Search leader</label>
                <input
                  id="filter"
                  type="search"
                  placeholder="Type a name"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>

              <div role="radiogroup" aria-label="Leader">
                {candidates.length === 0 && (
                  <p className="team-empty">There are no leaders available. Add a leader first from New employee.</p>
                )}
                {candidates.length > 0 && visible.length === 0 && (
                  <p className="team-empty">No leaders match this search.</p>
                )}
                <ul className="team-list">
                  {visible.map((leader) => (
                    <li key={leader.id} className={selected === leader.id ? 'is-selected' : ''}>
                      <label>
                        <input
                          type="radio"
                          name="leader"
                          checked={selected === leader.id}
                          onChange={() => setChoice(leader.id)}
                        />
                        <span className="team-list__name">{leader.nombre}</span>
                        <span className="team-list__position">{leader.position}</span>
                        <span className="team-list__boss">{currentChoice === leader.id ? 'Current leader' : ''}</span>
                      </label>
                    </li>
                  ))}
                  {currentLeader && (
                    <li className={selected === NO_LEADER ? 'is-selected' : ''}>
                      <label>
                        <input
                          type="radio"
                          name="leader"
                          checked={selected === NO_LEADER}
                          onChange={() => setChoice(NO_LEADER)}
                        />
                        <span className="team-list__name">No leader</span>
                        <span className="team-list__position">Remove the current leader</span>
                        <span className="team-list__boss" />
                      </label>
                    </li>
                  )}
                </ul>
              </div>
            </fieldset>

            <div className="new-employee__actions">
              <Link to={profilePath} className="btn btn--text">Cancel</Link>
              <span className="new-employee__actions-right">
                <button type="submit" className="btn btn--dark" disabled={saving || inactive || unchanged}>
                  {saving ? 'Saving…' : 'Assign leader'}
                </button>
              </span>
            </div>
          </div>

          <div className="new-employee__side new-employee__side--last">
            <aside className="summary" aria-label="Summary">
              <p className="summary__title">Summary</p>
              <p>Current leader</p>
              <p className="summary__name">{currentLeader ? currentLeader.nombre : 'None'}</p>
              <p className="summary__group">New leader</p>
              <p className="summary__name">{selectedLeader ? selectedLeader.nombre : 'None'}</p>
            </aside>
            <p className="note">
              {firstName(employee.nombre)} will report to the selected leader, who will review their requests from now on.
            </p>
          </div>
        </form>
      </main>
    </>
  );
}
