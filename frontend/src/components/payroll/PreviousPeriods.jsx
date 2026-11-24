import { periodLabel } from '../../utils/period';

export default function PreviousPeriods({ periods, onSelect }) {
  return (
    <div className="previous">
      <p className="eyebrow">Previous periods</p>
      <ul>
        {periods.map((p) => (
          <li key={periodLabel(p.period)}>
            <button type="button" className="previous__row" onClick={() => onSelect(p.period)}>
              <span className="previous__label">{periodLabel(p.period)}</span>
              <span className="mono previous__count">
                {p.done} / {p.total}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
