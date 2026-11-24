import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getOrgChart, listEmployees } from '../api/employeesApi';
import { getMyEmployee } from '../api/absenceApi';
import { getCalendar } from '../api/requestsApi';
import { PageHeader } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';
import { bossesFromOrgChart, shortName } from '../utils/people';
import { currentPeriod, parsePeriodKey, periodKey, periodLabel, shiftPeriod } from '../utils/period';
import { TYPE_LABELS, localDate } from '../utils/requests';
import { AskDocumentModal, RejectModal, RequestDetailModal } from './RequestModals';
import { DayModal, MonthGrid } from './AbsenceMonthView';
import './NewEmployeePage.css';
import './EmployeeProfilePage.css';
import './EmployeeTabs.css';
import './PeoplePage.css';
import './RequestsPage.css';
import './AbsenceCalendarPage.css';

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shortMonth = (d) => d.toLocaleDateString('en-US', { month: 'short' });

// How each day of a request is painted (legend of the design)
function stateOf(event) {
  if (event.estado === 'Pendiente') return 'review';
  if (event.situacion === 'En curso') return 'ongoing';
  return 'approved';
}
const STATE_LABELS = { review: 'In review', approved: 'Approved', ongoing: 'Ongoing' };

// Month options: 12 back and 6 ahead
function monthOptions() {
  const now = currentPeriod();
  return Array.from({ length: 19 }, (_, i) => shiftPeriod(now, 6 - i));
}

function normalize(text = '') {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Absence calendar. Admin (/absence-calendar): everyone in the company.
 * Leader (/team-calendar): themselves plus their team, only if they can view their team
 * (the calendar endpoint already applies that rule).
 */
export default function AbsenceCalendarPage() {
  const { user } = useAuth();
  const isLeader = user?.rol === 'lider';
  // The employee only sees their own requests (the calendar endpoint already limits them to that)
  const isEmployee = user?.rol === 'empleado';
  const isAdmin = !isLeader && !isEmployee;
  const [params, setParams] = useSearchParams();
  const period = parsePeriodKey(params.get('month')) ?? currentPeriod();
  // "calendar" (month with a note per person, the default) or "timeline" (one row per person)
  const view = params.get('view') === 'timeline' ? 'timeline' : 'calendar';
  const setParam = (changes) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    Object.entries(changes).forEach(([k, v]) => next.set(k, v));
    if (next.get('view') === 'calendar') next.delete('view');
    return next;
  });

  // { key: 'YYYY-MM', festivos, eventos, equipoVisible }: the key says which month it belongs to
  const [loaded, setLoaded] = useState(null);
  const [people, setPeople] = useState(null); // rows: [{ id, nombre, cargo }]
  const [leaders, setLeaders] = useState(new Map());
  const [error, setError] = useState('');
  const [noTeam, setNoTeam] = useState(false);
  const [version, setVersion] = useState(0);
  const [leaderFilter, setLeaderFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');

  const first = new Date(period.anio, period.mes - 1, 1);
  const last = new Date(period.anio, period.mes, 0);
  const days = Array.from({ length: last.getDate() }, (_, i) => new Date(period.anio, period.mes - 1, i + 1));

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  // Requests and holidays of the visible month
  useEffect(() => {
    let active = true;
    const key = periodKey(period);
    getCalendar(iso(new Date(period.anio, period.mes - 1, 1)), iso(new Date(period.anio, period.mes, 0)))
      .then((data) => { if (active) { setLoaded({ ...data, key }); setError(''); } })
      .catch((err) => { if (active) setError(getErrorMessage(err)); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.anio, period.mes, version]);

  // The people shown as rows (everyone, the leader and their team, or only the employee)
  useEffect(() => {
    let active = true;
    const done = (list) => { if (active) setPeople(list); };
    if (isEmployee) {
      getMyEmployee()
        .then((me) => done([{ id: me.id, nombre: me.nombre, cargo: null, isMe: true }]))
        .catch((err) => { if (active) { setError(getErrorMessage(err)); done([]); } });
    } else if (isLeader) {
      Promise.allSettled([getMyEmployee(), listEmployees()]).then(([me, team]) => {
        const rows = [];
        if (me.status === 'fulfilled') rows.push({ id: me.value.id, nombre: me.value.nombre, cargo: null, isMe: true });
        if (team.status === 'fulfilled') rows.push(...team.value.filter((e) => e.estado !== 'Inactivo'));
        else if (team.reason?.response?.status === 403 && active) setNoTeam(true);
        done(rows);
      });
    } else {
      listEmployees()
        .then((list) => done(list.filter((e) => e.estado !== 'Inactivo')))
        .catch((err) => { if (active) { setError(getErrorMessage(err)); done([]); } });
    }
    // Secondary: who each person reports to (leader filter and request detail)
    getOrgChart().then((chart) => { if (active) setLeaders(bossesFromOrgChart(chart)); }).catch(() => {});
    return () => { active = false; };
  }, [isLeader, isEmployee]);

  // While another month loads, nothing from the previous one is shown
  const calendar = loaded?.key === periodKey(period) ? loaded : null;
  const holidays = useMemo(() => new Set(calendar?.festivos || []), [calendar]);
  const isOff = (d) => d.getDay() === 0 || d.getDay() === 6 || holidays.has(iso(d));
  const businessDays = days.filter((d) => !isOff(d));

  // Rows: the people list plus anyone who has a request this month but is not in it
  const rows = useMemo(() => {
    if (!people) return [];
    const map = new Map(people.map((p) => [p.id, p]));
    (calendar?.eventos || []).forEach((e) => {
      if (!map.has(e.empleado_id)) map.set(e.empleado_id, { id: e.empleado_id, nombre: e.empleado_nombre, cargo: null });
    });
    const text = normalize(search.trim());
    return [...map.values()]
      .filter((p) => !text || normalize(p.nombre).includes(text))
      .filter((p) => leaderFilter === 'all' || String(leaders.get(p.id)?.id) === leaderFilter)
      .sort((a, b) => (b.isMe ? 1 : 0) - (a.isMe ? 1 : 0) || a.nombre.localeCompare(b.nombre));
  }, [people, calendar, search, leaderFilter, leaders]);

  const rowIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const events = useMemo(() => (calendar?.eventos || []).filter((e) => rowIds.has(e.empleado_id)), [calendar, rowIds]);

  // day key -> event, per person
  const cellsByPerson = useMemo(() => {
    const map = new Map();
    events.forEach((e) => {
      const start = localDate(e.fecha_inicio);
      const end = localDate(e.fecha_fin || e.fecha_inicio);
      const personDays = map.get(e.empleado_id) || new Map();
      for (let d = new Date(Math.max(start, first)); d <= end && d <= last; d.setDate(d.getDate() + 1)) {
        personDays.set(iso(d), e);
      }
      map.set(e.empleado_id, personDays);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, period.anio, period.mes]);

  // Summary under the calendar
  const summary = useMemo(() => {
    if (!calendar) return null;
    // Busiest week: the Monday–Friday stretch with the most different people out
    const weeks = [];
    businessDays.forEach((d) => {
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
      const key = iso(monday);
      let week = weeks.find((w) => w.key === key);
      if (!week) { week = { key, days: [] }; weeks.push(week); }
      week.days.push(d);
    });
    let busiest = null;
    weeks.forEach((w) => {
      const out = new Set();
      w.days.forEach((d) => cellsByPerson.forEach((personDays, id) => { if (personDays.has(iso(d))) out.add(id); }));
      if (out.size > 0 && (!busiest || out.size > busiest.people)) busiest = { ...w, people: out.size };
    });
    // Business days requested, out of the business days of everyone shown
    let requested = 0;
    cellsByPerson.forEach((personDays) => personDays.forEach((_, key) => { if (!isOff(localDate(key))) requested += 1; }));
    return {
      busiest,
      requested,
      capacity: businessDays.length * rows.length,
      inReview: events.filter((e) => e.estado === 'Pendiente').length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar, cellsByPerson, rows.length, events]);

  const leaderOptions = useMemo(() => {
    const map = new Map();
    (people || []).forEach((p) => { const boss = leaders.get(p.id); if (boss) map.set(boss.id, boss.nombre); });
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [people, leaders]);

  // Request detail (same window as in Requests): the team is the people with the same leader
  const employeesById = useMemo(() => new Map((people || []).map((p) => [p.id, p])), [people]);
  function teamOf(empleadoId) {
    const boss = leaders.get(empleadoId);
    const list = people || [];
    if (!boss) return { ids: new Set(list.map((p) => p.id)), size: list.length || 1, label: isLeader ? 'Your team' : 'Whole company' };
    const ids = new Set(list.filter((p) => leaders.get(p.id)?.id === boss.id).map((p) => p.id));
    ids.add(empleadoId);
    return { ids, size: ids.size, label: `${shortName(boss.nombre)}'s team` };
  }
  function finished(message) {
    setModal(null);
    setToast(message);
    setVersion((v) => v + 1);
  }

  const weekRange = (w) => {
    const a = w.days[0];
    const b = w.days[w.days.length - 1];
    return a.getTime() === b.getTime() ? `${a.getDate()} ${shortMonth(a)}` : `${a.getDate()} — ${b.getDate()} ${shortMonth(b)}`;
  };
  const loading = !calendar || !people;
  const today = iso(new Date());

  return (
    <>
      <PageHeader crumbs={[{ label: 'Absence calendar' }]}>
        {isAdmin && (
          <label className="cal-select">
            <span className="sr-only">Leader</span>
            <select className="btn" value={leaderFilter} onChange={(e) => setLeaderFilter(e.target.value)}>
              <option value="all">Leader: all</option>
              {leaderOptions.map(([id, name]) => <option key={id} value={String(id)}>Leader: {shortName(name)}</option>)}
            </select>
          </label>
        )}
        <label className="cal-select">
          <span className="sr-only">Month</span>
          <select className="btn" value={periodKey(period)} onChange={(e) => setParam({ month: e.target.value })}>
            {monthOptions().map((p) => <option key={periodKey(p)} value={periodKey(p)}>{periodLabel(p)}</option>)}
          </select>
        </label>
      </PageHeader>

      {toast && (
        <div className="toast req-toast" role="status">
          <span>{toast}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setToast('')}>×</button>
        </div>
      )}

      <main className="app__content absence">
        <div className="absence__head">
          <div>
            <h1 className="new-employee__title">{periodLabel(period)}</h1>
            <p className="new-employee__subtitle">
              {isEmployee
                ? 'Your own absences and the public holidays. Click a day to see the details.'
                : isLeader
                ? (noTeam ? 'Your own requests. You cannot view your team yet.' : 'You and your team. Check coverage before approving.')
                : 'Whole company. Filter by leader to check coverage before approving.'}
            </p>
          </div>
          <span className="absence__nav">
            <button type="button" aria-label="Previous month" onClick={() => setParam({ month: periodKey(shiftPeriod(period, -1)) })}>‹</button>
            <button type="button" aria-label="Next month" onClick={() => setParam({ month: periodKey(shiftPeriod(period, 1)) })}>›</button>
          </span>
        </div>

        {noTeam && (
          <p className="people__notice" role="status">
            You do not have permission to view your team’s absences yet. Ask administration to enable it.
          </p>
        )}
        {error && <p className="profile__alert" role="alert">{error}</p>}

        <div className="absence__tools">
          <label className="absence__search">
            <span className="sr-only">Search</span>
            <input type="search" placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <div className="absence__views" role="tablist" aria-label="View">
            {[['calendar', 'Calendar'], ['timeline', 'Timeline']].map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={view === key}
                className={`absence__view${view === key ? ' is-active' : ''}`} onClick={() => setParam({ view: key })}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading && !error && <p className="tab-empty" role="status">Loading calendar…</p>}

        {!loading && rows.length === 0 && <p className="people__empty">No people to show.</p>}

        {!loading && rows.length > 0 && view === 'calendar' && (
          <MonthGrid period={period} events={events} holidays={holidays} today={today} onDay={(key) => setModal({ type: 'day', key })} />
        )}

        {!loading && rows.length > 0 && view === 'timeline' && (
          <div className="absence__scroll">
            <table className="absence__grid" style={{ '--days': days.length }}>
              <thead>
                <tr>
                  <th scope="col" className="absence__person">Person</th>
                  {days.map((d) => (
                    <th key={d.getDate()} scope="col" className={`absence__daynum${iso(d) === today ? ' is-today' : ''}`} title={d.toDateString()}>
                      {d.getDate()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const personDays = cellsByPerson.get(p.id);
                  return (
                    <tr key={p.id}>
                      <th scope="row" className="absence__person">
                        <strong>{p.nombre}{p.isMe ? ' (you)' : ''}</strong>
                        <span>{(employeesById.get(p.id)?.cargo ?? p.cargo) || (p.isMe ? (isLeader ? 'Leader' : 'Employee') : '')}</span>
                      </th>
                      {days.map((d) => {
                        const key = iso(d);
                        const event = personDays?.get(key);
                        const off = isOff(d);
                        const state = event && stateOf(event);
                        const label = `${p.nombre}, ${d.getDate()} ${shortMonth(d)}${off ? ' · non-working day' : ''}${event ? ` · ${TYPE_LABELS[event.tipo] || event.tipo}, ${STATE_LABELS[state].toLowerCase()}` : ''}`;
                        const cls = ['absence__cell', off && 'is-off', event && !off && `is-${state}`, event && off && 'is-event-off'].filter(Boolean).join(' ');
                        return (
                          <td key={key} className={cls}>
                            {event ? (
                              <button type="button" aria-label={`${label}. Open request`} title={label} onClick={() => setModal({ type: 'detail', event })} />
                            ) : (
                              <span title={label} aria-label={label} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <ul className="absence__legend">
          {view === 'calendar' && <li className="absence__hint">Click a day to see who is out</li>}
          <li><span className="absence__swatch is-review" />In review</li>
          <li><span className="absence__swatch is-approved" />Approved</li>
          <li><span className="absence__swatch is-ongoing" />Ongoing</li>
          {view === 'calendar' && <li><span className="absence__swatch is-holiday" />Holiday</li>}
          <li><span className="absence__swatch is-off" />Non-working day</li>
        </ul>

        {summary && (
          <dl className="absence__summary">
            <div>
              <dt>Busiest week ({isEmployee ? 'you' : isLeader ? 'team' : 'company'})</dt>
              <dd>{summary.busiest ? `${weekRange(summary.busiest)} · ${summary.busiest.people} ${summary.busiest.people === 1 ? 'person' : 'people'}` : 'Nobody out'}</dd>
            </div>
            <div>
              <dt>In review this month</dt>
              <dd>{summary.inReview} {summary.inReview === 1 ? 'request' : 'requests'}</dd>
            </div>
            <div>
              <dt>Days requested</dt>
              <dd>{summary.requested} of {summary.capacity} business days</dd>
            </div>
          </dl>
        )}
      </main>

      {modal?.type === 'day' && (
        <DayModal
          dayKey={modal.key}
          events={events}
          holidays={holidays}
          positionOf={(id) => employeesById.get(id)?.cargo}
          onClose={() => setModal(null)}
          onOpen={(event) => setModal({ type: 'detail', event })}
        />
      )}
      {modal?.type === 'detail' && (
        <RequestDetailModal
          requestId={modal.event.id}
          employee={employeesById.get(modal.event.empleado_id)}
          leader={leaders.get(modal.event.empleado_id)}
          // The employee cannot see their team: no coverage block, only their own request
          team={isEmployee ? null : teamOf(modal.event.empleado_id)}
          readOnly={Boolean(employeesById.get(modal.event.empleado_id)?.isMe)}
          onClose={() => setModal(null)}
          onDone={finished}
          onReject={(request, comment) => setModal({ type: 'reject', request, comment })}
          onAskDocument={(request) => setModal({ type: 'document', request })}
        />
      )}
      {modal?.type === 'reject' && (
        <RejectModal
          request={modal.request}
          employee={employeesById.get(modal.request.empleado_id)}
          initialComment={modal.comment}
          onClose={() => setModal(null)}
          onDone={finished}
        />
      )}
      {modal?.type === 'document' && (
        <AskDocumentModal request={modal.request} onClose={() => setModal(null)} onDone={finished} />
      )}
    </>
  );
}
