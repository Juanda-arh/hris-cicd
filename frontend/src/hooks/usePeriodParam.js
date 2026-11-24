import { useSearchParams } from 'react-router-dom';
import { currentPeriod, parsePeriodKey, periodKey } from '../utils/period';

// Periodo seleccionado en la URL (?periodo=2026-09), compartido entre las pestañas de Payroll
export default function usePeriodParam() {
  const [params, setParams] = useSearchParams();
  const period = parsePeriodKey(params.get('periodo')) ?? currentPeriod();
  const setPeriod = (p) => setParams({ periodo: periodKey(p) }, { replace: true });
  return [period, setPeriod];
}
