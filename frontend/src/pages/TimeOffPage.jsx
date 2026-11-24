import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getMyEmployee } from '../api/absenceApi';
import { getOrgChart } from '../api/employeesApi';
import { getCalendar } from '../api/requestsApi';
import {
  createRequest,
  getBalance,
  getVacationHistory,
  listMyRequests,
} from '../api/timeOffApi';
import { PageHeader } from '../components/AppLayout';
import { ErrorIcon } from '../components/FormField';
import { getErrorMessage } from '../utils/errors';
import { bossesFromOrgChart } from '../utils/people';
import { localDate } from '../utils/requests';
import { MAX_PDF_MB, MAX_REASON, REQUEST_TYPES, addDays, businessDays, iso, reasonPrefix, todayIso, validatePdf } from '../utils/timeOff';
import {
  ApprovalFlow,
  BalanceCard,
  CancelModal,
  ComingUp,
  MyCalendar,
  RequestHistory,
} from './TimeOffParts';
import './NewEmployeePage.css';
import './EmployeeProfilePage.css';
import './EmployeeTabs.css';
import './PeoplePage.css';
import './RequestsPage.css';
import './TimeOffPage.css';

const MAX_RANGE_DAYS = 92; // limit of the calendar endpoint (used for the holiday preview)

function TypeIcon({ name }) {
  const paths = {
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.01',
    plus: 'M12 5v14M5 12h14',
  };
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

const EMPTY_FORM = { type: 'vacation', start: '', end: '', reason: '' };

// Time off for the logged-in employee or leader: new request, balance, own calendar and history
export default function TimeOffPage() {
  const today = todayIso();
  const year = Number(today.slice(0, 4));

  const [me, setMe] = useState(null);
  const [reviewer, setReviewer] = useState(null);
  const [balance, setBalance] = useState(null);
  const [usedThisYear, setUsedThisYear] = useState(null);
  const [requests, setRequests] = useState(null);
  const [upcoming, setUpcoming] = useState({ eventos: [], festivos: [] });
  const [loadError, setLoadError] = useState('');
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const formRef = useRef(null);

  const [month, setMonth] = useState(() => { const t = localDate(today); return new Date(t.getFullYear(), t.getMonth(), 1); });
  const [monthData, setMonthData] = useState(null);
  const [rangeHolidays, setRangeHolidays] = useState(null); // holidays of the chosen dates, for the preview

  const type = REQUEST_TYPES.find((t) => t.key === form.type);
  const isVacation = type.tipo === 'Vacaciones';
  const prefix = reasonPrefix(type);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  // Who am I and who reviews my requests (my leader, from the org chart)
  useEffect(() => {
    let active = true;
    Promise.all([getMyEmployee(), getOrgChart().catch(() => null)])
      .then(([employee, chart]) => {
        if (!active) return;
        setMe(employee);
        const boss = chart ? bossesFromOrgChart(chart).get(employee.id) : null;
        if (boss) {
          const nodes = [...(chart.organigrama || []), ...(chart.sinAsignar || [])];
          const find = (list) => list.reduce((found, n) => found || (n.empleadoId === boss.id ? n : find(n.subordinados || [])), null);
          const node = find(nodes);
          setReviewer({ nombre: boss.nombre, cargo: node?.cargo || null });
        }
      })
      .catch((err) => { if (active) setLoadError(getErrorMessage(err)); });
    return () => { active = false; };
  }, []);

  // Balance, history, worked holidays and the next three months (reloaded after every change)
  useEffect(() => {
    let active = true;
    getBalance().then((b) => { if (active) setBalance(b); }).catch((err) => { if (active) setLoadError(getErrorMessage(err)); });
    getVacationHistory(year).then((h) => { if (active) setUsedThisYear(h.resumen?.diasTomados ?? 0); }).catch(() => {});
    listMyRequests().then((r) => { if (active) setRequests(r); }).catch((err) => { if (active) setLoadError(getErrorMessage(err)); });
    getCalendar(today, iso(addDays(localDate(today), MAX_RANGE_DAYS - 1)))
      .then((c) => { if (active) setUpcoming(c); })
      .catch(() => {});
    return () => { active = false; };
  }, [version, year, today]);

  // The month shown in "My calendar"
  useEffect(() => {
    let active = true;
    const from = iso(month);
    const to = iso(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    getCalendar(from, to)
      .then((c) => { if (active) setMonthData({ ...c, key: from }); })
      .catch(() => { if (active) setMonthData({ eventos: [], festivos: [], key: from }); });
    return () => { active = false; };
  }, [month, version]);

  // Holidays inside the chosen dates, to preview how many business days the request takes
  const end = isVacation ? form.end : form.end || form.start;
  const validRange = form.start && end && end >= form.start
    && (localDate(end) - localDate(form.start)) / 86400000 < MAX_RANGE_DAYS;
  useEffect(() => {
    if (!validRange) return undefined;
    let active = true;
    getCalendar(form.start, end)
      .then((c) => { if (active) setRangeHolidays({ key: `${form.start}|${end}`, set: new Set(c.festivos || []) }); })
      .catch(() => {});
    return () => { active = false; };
  }, [form.start, end, validRange]);
  // With the "festivosDescuentan" contract weekday holidays are working days, so they do count
  const countsHolidays = Boolean(balance?.festivosDescuentan);
  const preview = validRange && rangeHolidays?.key === `${form.start}|${end}`
    ? businessDays(form.start, end, countsHolidays ? new Set() : rangeHolidays.set)
    : null;

  // Only the user's own requests (a leader's calendar response also brings their team)
  const mine = useCallback((list) => (me ? (list || []).filter((e) => e.empleado_id === me.id) : []), [me]);
  const monthEvents = useMemo(() => (monthData?.key === iso(month) ? mine(monthData.eventos) : []), [monthData, month, mine]);
  const monthHolidays = useMemo(() => new Set(monthData?.key === iso(month) ? monthData.festivos : []), [monthData, month]);
  const upcomingEvents = useMemo(() => mine(upcoming.eventos), [upcoming, mine]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
    setSubmitError('');
  }

  function pickFile(candidate) {
    if (!candidate) return;
    const problem = validatePdf(candidate);
    setErrors((e) => ({ ...e, file: problem }));
    if (!problem) setFile(candidate);
  }

  function validate() {
    const e = {};
    if (!form.start) e.start = 'Choose the start date';
    else if (isVacation && form.start < today) e.start = 'Vacations cannot start in the past';
    if (isVacation && !form.end) e.end = 'Choose the end date';
    if (form.end && form.start && form.end < form.start) e.end = 'The end date cannot be before the start date';
    if (!form.reason.trim()) e.reason = 'Write the reason';
    if (type.documentRequired && !file) e.file = 'Attach the medical certificate';
    if (preview === 0) e.end = 'The selected dates have no business days';
    else if (isVacation && preview && balance && preview > balance.diasDisponibles) {
      e.end = `You are asking for ${preview} days and have ${balance.diasDisponibles} available`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setSubmitError('');
    try {
      await createRequest({
        tipo: type.tipo,
        fechaInicio: form.start,
        fechaFin: form.end || null,
        motivo: `${prefix}${form.reason.trim()}`,
      }, file);
      setForm(EMPTY_FORM);
      setFile(null);
      setToast('Request sent. Your reviewer was notified, and you will get the answer by email and in the portal.');
      setVersion((v) => v + 1);
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setFile(null);
    setErrors({});
    setSubmitError('');
  }

  function done(message) {
    setModal(null);
    setToast(message);
    setVersion((v) => v + 1);
  }

  const fieldError = (name) => errors[name] && <p className="form-field__error" id={`to-${name}-error`}><ErrorIcon />{errors[name]}</p>;

  return (
    <>
      <PageHeader crumbs={[{ label: 'Time off & leave' }]} />

      {toast && (
        <div className="toast req-toast" role="status">
          <span>{toast}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setToast('')}>×</button>
        </div>
      )}

      <main className="app__content time-off">
        {loadError && <p className="profile__alert" role="alert">{loadError}</p>}

        <div className="to-top">
          <form ref={formRef} className="to-form" onSubmit={submit} noValidate>
            <h1 className="new-employee__title">New request</h1>
            <p className="new-employee__subtitle">
              {reviewer ? 'Your direct leader reviews it.' : 'Administration reviews it.'} You will get the answer by email and in the portal.
            </p>

            <p className="to-eyebrow">Type</p>
            <div className="to-types" role="radiogroup" aria-label="Type of request">
              {REQUEST_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={form.type === t.key}
                  className={`to-type${form.type === t.key ? ' is-active' : ''}`}
                  onClick={() => { update('type', t.key); setErrors({}); }}
                >
                  <TypeIcon name={t.icon} /> {t.label}
                </button>
              ))}
            </div>
            {type.documentRequired && (
              <p className="to-note">Sick leave needs a medical certificate or disability from your EPS. Upload it below so it can be registered.</p>
            )}
            {!isVacation && !type.documentRequired && (
              <p className="to-note">Absences do not use your vacation days. The end date is optional for a single day.</p>
            )}

            <div className="to-dates">
              <div className={`form-field${errors.start ? ' has-error' : ''}`}>
                <label htmlFor="to-start">Start date <span className="form-field__required" aria-hidden="true">*</span></label>
                <input id="to-start" type="date" value={form.start} min={isVacation ? today : undefined}
                  aria-invalid={Boolean(errors.start)} aria-describedby={errors.start ? 'to-start-error' : undefined}
                  onChange={(e) => update('start', e.target.value)} />
                {fieldError('start')}
              </div>
              <div className={`form-field${errors.end ? ' has-error' : ''}`}>
                <label htmlFor="to-end">
                  End date {isVacation ? <span className="form-field__required" aria-hidden="true">*</span> : <span className="req-optional">(optional)</span>}
                </label>
                <input id="to-end" type="date" value={form.end} min={form.start || (isVacation ? today : undefined)}
                  aria-invalid={Boolean(errors.end)} aria-describedby={errors.end ? 'to-end-error' : undefined}
                  onChange={(e) => update('end', e.target.value)} />
                {fieldError('end')}
              </div>
            </div>
            {preview !== null && !errors.end && (
              <p className="to-preview" role="status">
                {preview} business day{preview === 1 ? '' : 's'}
                {isVacation && balance && ` · ${Math.max(balance.diasDisponibles - preview, 0)} left after this request`}
              </p>
            )}

            <div className={`form-field${errors.reason ? ' has-error' : ''}`}>
              <div className="req-field-head">
                <label htmlFor="to-reason">Reason <span className="form-field__required" aria-hidden="true">*</span></label>
                <span className="char-count" aria-hidden="true">{form.reason.length} / {MAX_REASON - prefix.length}</span>
              </div>
              <textarea id="to-reason" rows={3} maxLength={MAX_REASON - prefix.length} value={form.reason}
                aria-invalid={Boolean(errors.reason)} aria-describedby={errors.reason ? 'to-reason-error' : undefined}
                onChange={(e) => update('reason', e.target.value)} />
              {fieldError('reason')}
            </div>

            <div className={`form-field${errors.file ? ' has-error' : ''}`}>
              <p className="to-label">
                {type.documentRequired ? <>Medical certificate <span className="req-optional">(required)</span></> : <>Supporting document <span className="req-optional">(optional)</span></>}
              </p>
              {file ? (
                <div className="cert-file">
                  <span className="cert-file__icon" aria-hidden="true">PDF</span>
                  <span className="cert-file__text"><strong>{file.name}</strong><span>{Math.max(1, Math.round(file.size / 1024))} KB · Ready to send</span></span>
                  <button type="button" className="icon-button" aria-label="Remove file" onClick={() => setFile(null)}>×</button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`to-drop${dragging ? ' is-dragging' : ''}`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]); }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4.5 20.5h15" /></svg>
                  <span><strong>{type.documentRequired ? 'Drag the medical certificate' : 'Drag a PDF'}</strong> · PDF · max {MAX_PDF_MB} MB</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { pickFile(e.target.files[0]); e.target.value = ''; }} />
              {fieldError('file')}
            </div>

            {submitError && <p className="profile__alert" role="alert">{submitError}</p>}
            <div className="to-actions">
              <button type="submit" className="btn btn--orange" disabled={saving}>{saving ? 'Sending…' : 'Submit request'}</button>
              <button type="button" className="btn" disabled={saving} onClick={resetForm}>Cancel</button>
            </div>
          </form>

          <aside className="to-side">
            <BalanceCard balance={balance} usedThisYear={usedThisYear} year={year} />
            <ApprovalFlow reviewer={reviewer} />
            {balance?.festivosDescuentan && (
              <p className="to-note to-contract">
                Your contract counts weekday holidays as working days. To take one off, request it as vacation: it uses one day of your balance.
              </p>
            )}
          </aside>
        </div>

        <section className="to-section">
          <div className="to-section__head"><h2>My calendar</h2><span>Your own absences and holidays</span></div>
          <div className="to-calendar-row">
            <MyCalendar
              month={month}
              onMonth={(delta) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))}
              events={monthEvents}
              holidays={monthHolidays}
              loading={monthData?.key !== iso(month)}
            />
            <ComingUp events={upcomingEvents} holidays={upcoming.festivos || []} today={today} requests={requests || []} />
          </div>
        </section>

        <section className="to-section">
          <div className="to-section__head"><h2>Request history</h2><span>Pending and upcoming requests can be cancelled</span></div>
          {!requests ? <p className="tab-empty" role="status">Loading requests…</p> : (
            <RequestHistory
              requests={requests}
              today={today}
              onCancel={(r) => setModal({ type: 'cancel', request: r })}
              onDone={done}
              onError={(message) => setToast(message)}
            />
          )}
        </section>
      </main>

      {modal?.type === 'cancel' && <CancelModal request={modal.request} onClose={() => setModal(null)} onDone={done} />}
    </>
  );
}
