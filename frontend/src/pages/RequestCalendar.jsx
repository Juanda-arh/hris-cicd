import { useEffect, useMemo, useState } from 'react';
import { getCalendar } from '../api/requestsApi';
import { formatRange, localDate } from '../utils/requests';
import { shortName } from '../utils/people';

// Sunday first: S M T W T F S
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MAX_DAYS = 92; // limit of the calendar endpoint

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monthName = (d, style = 'long') => d.toLocaleDateString('en-US', { month: style });

function overlaps(event, from, to) {
  return localDate(event.fecha_inicio) <= to && localDate(event.fecha_fin || event.fecha_inicio) >= from;
}

/**
 * Coverage of the request's dates and a month calendar with the requested days.
 * team: { ids: Set of employee ids, size, label } — the people whose absences matter for this request.
 */
export default function RequestCalendar({ request, team }) {
  const start = localDate(request.fecha_inicio);
  const end = localDate(request.fecha_fin || request.fecha_inicio);

  // Months the request touches: they can be browsed with the arrows
  const months = useMemo(() => {
    const list = [];
    for (let m = new Date(start.getFullYear(), start.getMonth(), 1); m <= end; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      list.push(m);
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.fecha_inicio, request.fecha_fin]);
  const [index, setIndex] = useState(0);
  const month = months[Math.min(index, months.length - 1)];

  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  // One call covers every month of the request (capped at the endpoint's 92 days)
  useEffect(() => {
    let active = true;
    const from = months[0];
    const lastMonth = months[months.length - 1];
    let to = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
    if ((to - from) / 86400000 + 1 > MAX_DAYS) to = addDays(from, MAX_DAYS - 1);
    getCalendar(iso(from), iso(to))
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [months]);

  const holidays = useMemo(() => new Set(data?.festivos || []), [data]);

  // Other people of the team who are out (pending or approved) during the request
  const teamEvents = useMemo(
    () => (data?.eventos || []).filter((e) => e.id !== request.id && e.empleado_id !== request.empleado_id && team.ids.has(e.empleado_id)),
    [data, request.id, request.empleado_id, team.ids]
  );
  const overlapping = teamEvents.filter((e) => overlaps(e, start, end));
  const peopleOut = new Set([request.empleado_id, ...overlapping.map((e) => e.empleado_id)]).size;

  // Calendar grid, Sunday first (getDay(): 0 = Sunday)
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leading = first.getDay();
  const cells = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];

  const statusClass = `is-${request.estado.toLowerCase()}`;
  const legendLabel = { Pendiente: 'Request in review', Aprobado: 'Approved request', Rechazado: 'Rejected request', Cancelado: 'Cancelled request' }[request.estado];

  return (
    <section className="req-cal" aria-label="Coverage and calendar">
      <p className="req-cal__eyebrow">{monthName(start)} coverage</p>
      <dl className="req-cal__facts">
        <div>
          <dt>People out {formatRange(request.fecha_inicio, request.fecha_fin)}</dt>
          <dd className="req-mono">{data ? `${peopleOut} of ${team.size}` : error ? '—' : '…'}</dd>
        </div>
        <div>
          <dt>Compared with</dt>
          <dd>{team.label}</dd>
        </div>
        {overlapping.length > 0 && (
          <div className="req-cal__others">
            <dt>Also out</dt>
            <dd>
              <ul>
                {overlapping.map((e) => (
                  <li key={e.id}>
                    {shortName(e.empleado_nombre)} <span className="req-mono">{formatRange(e.fecha_inicio, e.fecha_fin)}</span>
                    {e.estado === 'Pendiente' && <span className="req-cal__tag">in review</span>}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>

      <div className="req-cal__head">
        <p className="req-cal__eyebrow">Team calendar · {monthName(month)}{month.getFullYear() !== new Date().getFullYear() ? ` ${month.getFullYear()}` : ''}</p>
        {months.length > 1 && (
          <span className="req-cal__nav">
            <button type="button" aria-label="Previous month" disabled={index === 0} onClick={() => setIndex(index - 1)}>‹</button>
            <button type="button" aria-label="Next month" disabled={index >= months.length - 1} onClick={() => setIndex(index + 1)}>›</button>
          </span>
        )}
      </div>

      {error && <p className="req-cal__error">The calendar could not be loaded.</p>}

      <div className="req-cal__grid" role="grid" aria-label={`${monthName(month)} ${month.getFullYear()}`}>
        {WEEKDAYS.map((d, i) => <span key={i} className="req-cal__weekday" aria-hidden="true">{d}</span>)}
        {cells.map((date, i) => {
          if (!date) return <span key={`e${i}`} className="req-cal__day is-empty" aria-hidden="true" />;
          const key = iso(date);
          const weekend = date.getDay() === 0 || date.getDay() === 6;
          const holiday = holidays.has(key);
          const requested = date >= start && date <= end;
          const others = teamEvents.filter((e) => overlaps(e, date, date));
          const label = [
            `${date.getDate()} ${monthName(date)}`,
            requested && legendLabel,
            holiday && 'public holiday',
            weekend && 'weekend',
            others.length > 0 && `out: ${others.map((e) => e.empleado_nombre).join(', ')}`,
          ].filter(Boolean).join(' · ');
          return (
            <span
              key={key}
              role="gridcell"
              title={label}
              aria-label={label}
              className={[
                'req-cal__day',
                (weekend || holiday) && 'is-off',
                requested && statusClass,
                requested && (weekend || holiday) && 'is-requested-off',
              ].filter(Boolean).join(' ')}
            >
              {date.getDate()}
              {others.length > 0 && <span className="req-cal__dot" aria-hidden="true" />}
            </span>
          );
        })}
      </div>

      <ul className="req-cal__legend">
        <li><span className={`req-cal__swatch ${statusClass}`} />{legendLabel}</li>
        <li><span className="req-cal__swatch is-off" />Non-working day</li>
        {teamEvents.length > 0 && <li><span className="req-cal__swatch req-cal__swatch--dot" />Someone else out</li>}
      </ul>
    </section>
  );
}
