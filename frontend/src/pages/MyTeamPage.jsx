import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyTeam } from '../api/employeesApi';
import { saveFile } from '../api/files';
import { PageHeader } from '../components/AppLayout';
import { getErrorMessage } from '../utils/errors';
import { STATUS_LABELS } from '../utils/people';
import './PeoplePage.css';
import './EmployeeProfilePage.css';
import './EmployeeTabs.css';

const PAGE_SIZE = 10;
const ON_LEAVE = ['Vacaciones', 'Permiso'];
// Byte order mark: lets Excel read accents in the CSV correctly
const BOM = String.fromCharCode(0xfeff);

function normalize(text = '') {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv(team) {
  const header = ['Name', 'Email', 'Phone', 'Position', 'Vacation days', 'Status'];
  const lines = team.map((person) => [
    person.nombre, person.correo, person.telefono, person.cargo, person.dias_vacaciones, STATUS_LABELS[person.estado] || person.estado,
  ].map(csvCell).join(','));
  const blob = new Blob([BOM, [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  saveFile({ blob, filename: `my-team-${new Date().toISOString().slice(0, 10)}.csv` });
}

export default function MyTeamPage() {
  const [team, setTeam] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    getMyTeam()
      .then((data) => { if (active) setTeam(data); })
      .catch((err) => {
        if (!active) return;
        setError(err.response?.status === 403
          ? 'You do not have permission to view your team yet. Ask administration to enable it.'
          : getErrorMessage(err));
      });
    return () => { active = false; };
  }, []);

  const people = useMemo(() => team || [], [team]);
  const filtered = useMemo(() => {
    const text = normalize(search.trim());
    return people.filter((person) => !text
      || normalize(person.nombre).includes(text)
      || normalize(person.cargo || '').includes(text));
  }, [people, search]);

  const active = people.filter((person) => person.estado !== 'Inactivo');
  const outToday = people.filter((person) => ON_LEAVE.includes(person.estado)).length;
  const averageDays = active.length
    ? (active.reduce((total, person) => total + (person.dias_vacaciones || 0), 0) / active.length).toFixed(1)
    : '—';

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const first = (currentPage - 1) * PAGE_SIZE;
  const rows = filtered.slice(first, first + PAGE_SIZE);

  return (
    <>
      <PageHeader crumbs={[{ label: 'My Team' }]}>
        {people.length > 0 && (
          <button type="button" className="btn" onClick={() => exportCsv(people)}>Export CSV</button>
        )}
      </PageHeader>

      <main className="app__content people">
        <h1 className="new-employee__title my-team__title">My Team</h1>
        <p className="new-employee__subtitle">The people who report to you, their position and their vacation days.</p>

        {error && <p className="profile__alert" role="alert">{error}</p>}
        {!error && !team && <p className="tab-empty" role="status">Loading your team…</p>}

        {team && (
          <>
            <dl className="people__stats time-off__stats">
              <div>
                <dt><span className="stat-mark stat-mark--blue" aria-hidden="true" />People</dt>
                <dd>{people.length}</dd>
              </div>
              <div>
                <dt><span className="stat-mark stat-mark--yellow" aria-hidden="true" />Out today</dt>
                <dd>{outToday}</dd>
              </div>
              <div>
                <dt><span className="stat-mark stat-mark--green" aria-hidden="true" />Avg. vacation days</dt>
                <dd>{averageDays}</dd>
              </div>
              <div>
                <dt><span className="stat-mark" aria-hidden="true" />Active</dt>
                <dd>{active.length}</dd>
              </div>
            </dl>

            {people.length === 0
              ? <p className="tab-empty">Nobody reports to you yet. Administration assigns the people on your team.</p>
              : (
                <>
                  <div className="people__filters">
                    <label className="people__search">
                      <span className="sr-only">Search by name or position</span>
                      <input
                        type="search"
                        placeholder="Search by name or position"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                      />
                    </label>
                  </div>

                  {rows.length === 0
                    ? <p className="people__empty">Nobody on your team matches this search.</p>
                    : (
                      <div className="table-scroll">
                        <table className="data-table my-team__table">
                          <thead>
                            <tr>
                              <th scope="col">Name</th>
                              <th scope="col">Position</th>
                              <th scope="col">Phone</th>
                              <th scope="col">Vacation days</th>
                              <th scope="col">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((person) => (
                              <tr key={person.id}>
                                <td>
                                  <Link to={`/my-team/${person.id}`} className="people__name-link">{person.nombre}</Link>
                                  <span className="cell-note">{person.correo}</span>
                                </td>
                                <td>{person.cargo || 'No position'}</td>
                                <td className="nowrap">{person.telefono || '—'}</td>
                                <td>{person.dias_vacaciones}</td>
                                <td>
                                  <span className={`status status--${person.estado.toLowerCase()}`}>
                                    {STATUS_LABELS[person.estado] || person.estado}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                  {filtered.length > 0 && (
                    <div className="people__footer">
                      <span>Showing {first + 1}–{first + rows.length} of {filtered.length}</span>
                      {pageCount > 1 && (
                        <span className="people__pager">
                          <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button>
                          <span>{currentPage} / {pageCount}</span>
                          <button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>›</button>
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
          </>
        )}
      </main>
    </>
  );
}
