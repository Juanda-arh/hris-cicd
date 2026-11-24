import Modal from '../components/Modal';
import { shortName } from '../utils/people';
import { TYPE_LABELS, formatRange, localDate } from '../utils/requests';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CHIPS = 3; // the rest is summarised as "+N more"
const STATE_ORDER = { review: 0, ongoing: 1, approved: 2 };
const STATE_LABELS = { review: 'In review', approved: 'Approved', ongoing: 'Ongoing' };

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function stateOf(event) {
  if (event.estado === 'Pendiente') return 'review';
  if (event.situacion === 'En curso') return 'ongoing';
  return 'approved';
}

// Requests that touch a given day, review first
function eventsOn(events, key) {
  return events
    .filter((e) => e.fecha_inicio.slice(0, 10) <= key && (e.fecha_fin || e.fecha_inicio).slice(0, 10) >= key)
    .sort((a, b) => STATE_ORDER[stateOf(a)] - STATE_ORDER[stateOf(b)] || a.empleado_nombre.localeCompare(b.empleado_nombre));
}

/**
 * Month calendar (Sunday first) with a note per person who is out each business day,
 * in the style of a phone calendar. Clicking a day opens its detail.
 */
export function MonthGrid({ period, events, holidays, today, onDay }) {
  const first = new Date(period.anio, period.mes - 1, 1);
  const daysInMonth = new Date(period.anio, period.mes, 0).getDate();
  const leading = first.getDay();
  const cells = [
    ...Array.from({ length: leading }, (_, i) => ({ date: new Date(period.anio, period.mes - 1, i - leading + 1), outside: true })),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ date: new Date(period.anio, period.mes - 1, i + 1), outside: false })),
  ];
  while (cells.length % 7) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), outside: true });
  }

  return (
    <div className="mcal" role="grid" aria-label="Absence calendar">
      {WEEKDAYS.map((d, i) => (
        <span key={d} className={`mcal__weekday${i === 0 ? ' is-sunday' : ''}`} role="columnheader">{d}</span>
      ))}
      {cells.map(({ date, outside }) => {
        const key = iso(date);
        if (outside) return <span key={key} className="mcal__day is-outside" aria-hidden="true"><span className="mcal__num">{date.getDate()}</span></span>;
        const weekend = date.getDay() === 0 || date.getDay() === 6;
        const holiday = holidays.has(key);
        // Absences only count on business days: weekends and holidays show no notes
        const list = weekend || holiday ? [] : eventsOn(events, key);
        const label = `${date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}${holiday ? ', public holiday' : ''}${list.length ? `, ${list.length} ${list.length === 1 ? 'person' : 'people'} out` : ''}`;
        return (
          <button
            key={key}
            type="button"
            role="gridcell"
            className={['mcal__day', weekend && 'is-weekend', holiday && 'is-holiday', key === today && 'is-today', date.getDay() === 0 && 'is-sunday'].filter(Boolean).join(' ')}
            aria-label={label}
            onClick={() => onDay(key)}
          >
            <span className="mcal__num">{date.getDate()}</span>
            {holiday && <span className="mcal__chip mcal__chip--holiday">Holiday</span>}
            {list.slice(0, MAX_CHIPS).map((e) => (
              <span key={e.id} className={`mcal__chip mcal__chip--${stateOf(e)}`} title={`${e.empleado_nombre} · ${STATE_LABELS[stateOf(e)]}`}>
                {shortName(e.empleado_nombre)}
              </span>
            ))}
            {list.length > MAX_CHIPS && <span className="mcal__more">+{list.length - MAX_CHIPS} more</span>}
          </button>
        );
      })}
    </div>
  );
}

// Floating window with everyone who is out that day; each one opens its request
export function DayModal({ dayKey, events, holidays, positionOf, onClose, onOpen }) {
  const date = localDate(dayKey);
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const holiday = holidays.has(dayKey);
  const list = weekend || holiday ? [] : eventsOn(events, dayKey);
  const subtitle = holiday
    ? 'Public holiday: nobody works this day.'
    : weekend
      ? 'Non-working day.'
      : list.length === 0 ? 'Nobody is out this day.' : `${list.length} ${list.length === 1 ? 'person is' : 'people are'} out. Open one to see the request.`;

  return (
    <Modal
      eyebrow={date.toLocaleDateString('en-US', { weekday: 'long' })}
      title={date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
      subtitle={subtitle}
      onClose={onClose}
      footer={<button type="button" className="btn" onClick={onClose}>Close</button>}
    >
      {list.length > 0 && (
        <ul className="mcal-day">
          {list.map((e) => {
            const state = stateOf(e);
            return (
              <li key={e.id}>
                <button type="button" className="mcal-day__item" onClick={() => onOpen(e)}>
                  <span className={`mcal-day__bar mcal-day__bar--${state}`} aria-hidden="true" />
                  <span className="mcal-day__text">
                    <strong>{e.empleado_nombre}</strong>
                    <span>
                      {[positionOf(e.empleado_id), TYPE_LABELS[e.tipo] || e.tipo, formatRange(e.fecha_inicio, e.fecha_fin), `${e.dias_habiles} business day${e.dias_habiles === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className={`mcal-day__state mcal-day__state--${state}`}>{STATE_LABELS[state]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
