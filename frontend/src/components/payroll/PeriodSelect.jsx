import { periodKey, parsePeriodKey, periodLabel, recentPeriods } from '../../utils/period';

// Botón "Period: September 2026" con un <select> nativo encima (accesible y funciona en móvil)
export default function PeriodSelect({ value, onChange }) {
  const options = recentPeriods(12);
  const key = periodKey(value);
  if (!options.some((p) => periodKey(p) === key)) options.unshift(value);

  return (
    <label className="btn btn--outline period-select">
      Period: {periodLabel(value)}
      <select value={key} onChange={(e) => onChange(parsePeriodKey(e.target.value))} aria-label="Select period">
        {options.map((p) => (
          <option key={periodKey(p)} value={periodKey(p)}>
            {periodLabel(p)}
          </option>
        ))}
      </select>
    </label>
  );
}
