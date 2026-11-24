import { useState } from 'react';
import { changeSalary, createPosition, updatePosition } from '../api/employeesApi';
import Field from '../components/FormField';
import Modal from '../components/Modal';
import { getErrorMessage } from '../utils/errors';
import { dayBefore, formatDate, formatMoney, timeSince } from '../utils/people';
import './NewEmployeePage.css';
import './EmployeeTabs.css';

const SALARY = /^\d+(\.\d{1,2})?$/;
const MAX_REASON = 255;

function withoutKey(values, key) {
  if (!values[key]) return values;
  const rest = { ...values };
  delete rest[key];
  return rest;
}

function validSalary(value) {
  const text = value.trim();
  return SALARY.test(text) && Number(text) < 10000000000;
}

function percentChange(before, after) {
  if (!before) return '';
  const change = ((after - before) / before) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
}

function ChangeChip({ before, after }) {
  const text = percentChange(before, after);
  if (!text) return null;
  return <span className={`change-chip${after < before ? ' change-chip--down' : ''}`}>{text}</span>;
}

function ReasonField({ id, label, value, onChange, error, hint }) {
  return (
    <Field id={id} label={label} required error={error} hint={hint}>
      {(p) => (
        <>
          <textarea
            {...p}
            rows={3}
            maxLength={MAX_REASON}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="char-count" aria-hidden="true">{value.length} / {MAX_REASON}</span>
        </>
      )}
    </Field>
  );
}

function PositionModal({ employeeId, position, current, employeeName, onClose, onSaved }) {
  const editing = Boolean(position);
  const [form, setForm] = useState({
    cargo: position?.cargo || '',
    area: position?.area || '',
    funcion: position?.funcion || '',
    motivo: position?.motivo || '',
    sueldo: '',
    inicio: position?.inicio || '',
    fin: position?.fin || '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function setField(name, value) {
    setForm((values) => ({ ...values, [name]: value }));
    setErrors((current) => withoutKey(current, name));
  }

  function set(name) {
    return (e) => setField(name, e.target.value);
  }

  // A new position with no end date closes the current one the day before it starts
  const closesCurrent = !editing && current && !form.fin;

  function validate() {
    const next = {};
    if (!form.cargo.trim()) next.cargo = 'Enter the position';
    if (!form.area.trim()) next.area = 'Enter the area or department';
    if (!form.motivo.trim()) next.motivo = 'Enter the reason for the position';
    if (!editing && !validSalary(form.sueldo)) next.sueldo = 'Enter a number with at most 2 decimals';
    if (!form.inicio) next.inicio = 'Select the start date';
    else if (closesCurrent && form.inicio <= current.inicio) {
      next.inicio = `It must start after the current position (${formatDate(current.inicio)})`;
    }
    if (form.fin && form.inicio && form.fin < form.inicio) next.fin = 'It cannot be before the start date';
    return next;
  }

  // When editing, only what changed is sent: older positions may lack fields the API requires when present
  function changesFrom(payload) {
    return Object.fromEntries(
      Object.entries(payload).filter(([key, value]) => value !== (position[key] ?? null))
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length > 0) return;

    const payload = {
      cargo: form.cargo.trim(),
      area: form.area.trim(),
      funcion: form.funcion.trim() || null,
      motivo: form.motivo.trim(),
      inicio: form.inicio,
      fin: form.fin || null,
    };

    setSaving(true);
    try {
      if (editing) {
        const changes = changesFrom(payload);
        if (Object.keys(changes).length === 0) {
          onClose();
          return;
        }
        await updatePosition(position.id, changes);
        onSaved('The position was updated.');
      } else {
        await createPosition(employeeId, { ...payload, sueldo: form.sueldo.trim() });
        onSaved(`${payload.cargo} was registered.`);
      }
    } catch (err) {
      setFormError(getErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? 'Edit position' : 'Register position'}
      eyebrow={employeeName}
      subtitle={editing ? 'Corrects this record. It does not count as a new position in the history.' : undefined}
      onClose={onClose}
      footer={(
        <>
          {!editing && <span className="modal__foot-note">Without an end date, it becomes the current position.</span>}
          <button type="button" className="btn" disabled={saving} onClick={onClose}>Cancel</button>
          <button type="submit" form="position-form" className="btn btn--dark" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Register position'}
          </button>
        </>
      )}
    >
      <form id="position-form" className="modal-form" onSubmit={handleSubmit} noValidate>
        {formError && <p className="profile__alert" role="alert">{formError}</p>}

        {closesCurrent && (
          <p className="modal-notice">
            The current position, <strong>{current.cargo}</strong>, will close
            {form.inicio ? <> on <strong>{formatDate(dayBefore(form.inicio))}</strong>, the day before this one starts.</> : ' the day before this one starts.'}
          </p>
        )}

        <div className="form-grid">
          <Field id="cargo" label="Position" required hint="At most 300 characters" error={errors.cargo}>
            {(p) => <input {...p} type="text" maxLength={300} autoComplete="off" value={form.cargo} onChange={set('cargo')} />}
          </Field>
          <Field id="area" label="Area or department" required error={errors.area}>
            {(p) => <input {...p} type="text" maxLength={50} autoComplete="off" value={form.area} onChange={set('area')} />}
          </Field>
          <Field id="funcion" label="Function" wide>
            {(p) => <input {...p} type="text" maxLength={50} autoComplete="off" value={form.funcion} onChange={set('funcion')} />}
          </Field>
        </div>

        <ReasonField
          id="motivo"
          label="Reason for the position"
          value={form.motivo}
          onChange={(value) => setField('motivo', value)}
          error={errors.motivo}
          hint="It will be shown in the position history."
        />

        <div className="form-grid">
          {editing
            ? (
              <Field id="sueldo-readonly" label="Monthly salary (USD)" wide hint="To change the salary of the current position, use Change salary.">
                {(p) => <input {...p} type="text" value={formatMoney(position.sueldo)} readOnly className="is-readonly" />}
              </Field>
            )
            : (
              <Field id="sueldo" label="Monthly salary (USD)" required wide hint="Numbers only, up to 2 decimals" error={errors.sueldo}>
                {(p) => <input {...p} type="text" inputMode="decimal" autoComplete="off" value={form.sueldo} onChange={set('sueldo')} />}
              </Field>
            )}
          <Field id="inicio" label="Start date" required error={errors.inicio}>
            {(p) => <input {...p} type="date" value={form.inicio} onChange={set('inicio')} />}
          </Field>
          <Field id="fin" label="End date" error={errors.fin}>
            {(p) => <input {...p} type="date" value={form.fin} onChange={set('fin')} />}
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function SalaryModal({ employeeId, employeeName, current, onClose, onSaved }) {
  const [salary, setSalary] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const valid = validSalary(salary);
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

  async function handleSubmit(e) {
    e.preventDefault();
    const next = {};
    if (!valid) next.salary = 'Enter a number with at most 2 decimals';
    else if (Number(salary) === current.sueldo) next.salary = 'It is the same as the current salary';
    if (!reason.trim()) next.reason = 'Enter the reason for the change';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await changeSalary(employeeId, salary.trim(), reason.trim());
      onSaved(`The salary was changed to ${formatMoney(salary)} USD.`);
    } catch (err) {
      setFormError(getErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Change salary"
      eyebrow={`${employeeName} · ${current.cargo}`}
      subtitle="Only the salary of the current position changes; everything else stays the same."
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn" disabled={saving} onClick={onClose}>Cancel</button>
          <button type="submit" form="salary-form" className="btn btn--dark" disabled={saving}>
            {saving ? 'Saving…' : 'Save new salary'}
          </button>
        </>
      )}
    >
      <form id="salary-form" className="modal-form" onSubmit={handleSubmit} noValidate>
        {formError && <p className="profile__alert" role="alert">{formError}</p>}

        <div className="salary-compare">
          <div className="salary-box">
            <span className="salary-box__label">Current salary</span>
            <span className="salary-box__value">{formatMoney(current.sueldo)}</span>
            <span className="salary-box__hint">USD per month</span>
          </div>
          <span className="salary-compare__arrow" aria-hidden="true">→</span>
          <div className={`salary-box salary-box--input${errors.salary ? ' has-error' : ''}`}>
            <label className="salary-box__label" htmlFor="new-salary">New salary *</label>
            <input
              id="new-salary"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={salary}
              aria-invalid={Boolean(errors.salary)}
              aria-describedby={errors.salary ? 'new-salary-error' : undefined}
              onChange={(e) => {
                setSalary(e.target.value);
                setErrors((current) => withoutKey(current, 'salary'));
              }}
            />
            {valid && Number(salary) !== current.sueldo && (
              <ChangeChip before={current.sueldo} after={Number(salary)} />
            )}
          </div>
        </div>
        {errors.salary && <p id="new-salary-error" className="form-field__error">{errors.salary}</p>}

        <ReasonField
          id="reason"
          label="Reason for the change"
          value={reason}
          onChange={(value) => {
            setReason(value);
            setErrors((current) => withoutKey(current, 'reason'));
          }}
          error={errors.reason}
        />

        <p className="note">It will be logged with today&apos;s date ({today}), the previous salary, the new one and the reason.</p>

        {current.cambiosSalario?.length > 0 && (
          <section aria-labelledby="previous-changes">
            <h3 id="previous-changes" className="section-title section-title--plain">Previous changes in this position</h3>
            <ul className="mini-list">
              {current.cambiosSalario.map((change) => (
                <li key={change.id}>
                  <span>{formatDate(change.fecha)} · {formatMoney(change.sueldo_anterior)} → {formatMoney(change.sueldo_nuevo)}</span>
                  <span>{change.motivo}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </form>
    </Modal>
  );
}

function EditButton({ label, onClick, text = false }) {
  return (
    <button type="button" className={text ? 'edit-link' : 'icon-button'} aria-label={label} onClick={onClick}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20h4L19 9l-4-4L4 16v4z" />
        <path d="m13.5 6.5 4 4" />
      </svg>
      {text && <span>Edit</span>}
    </button>
  );
}

export default function EmployeePositionTab({ employee, positions, inactive, onChanged }) {
  const [modal, setModal] = useState(null);

  const current = positions.find((position) => !position.fin) || null;
  const first = positions[positions.length - 1] || null;
  const latest = positions[0] || null;
  const salaryChanges = current?.cambiosSalario || [];
  const hireDate = positions.reduce(
    (earliest, position) => (!earliest || position.inicio < earliest ? position.inicio : earliest),
    null
  );

  function saved(message) {
    setModal(null);
    onChanged(message);
  }

  return (
    <div className="position-tab">
      {!inactive && (
        <div className="tab-actions">
          <button type="button" className="btn" disabled={!current} onClick={() => setModal({ type: 'salary' })}>Change salary</button>
          <button type="button" className="btn btn--dark" onClick={() => setModal({ type: 'register' })}>
            <span aria-hidden="true">+</span> Register position
          </button>
        </div>
      )}

      <div className="position-columns">
        <div className="position-main">
          <section className="current-card" aria-labelledby="current-title">
            <div className="current-card__head">
              <div className="current-card__title">
                <h2 id="current-title">Current position</h2>
                {current && <span className="tag-current">Current</span>}
              </div>
              {current && (
                <div className="current-card__dates">
                  <span>Since {formatDate(current.inicio)} · no end date</span>
                  <EditButton label="Edit current position" onClick={() => setModal({ type: 'edit', position: current })} />
                </div>
              )}
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
                    {current.motivo && (
                      <div className="current-card__reason">
                        <span>Reason</span>
                        <p>{current.motivo}</p>
                      </div>
                    )}
                  </div>
                  <div className="salary-box">
                    <span className="salary-box__label">Monthly salary</span>
                    <span className="salary-box__value">{formatMoney(current.sueldo)}</span>
                    <span className="salary-box__hint">
                      USD{salaryChanges[0] ? ` · last change ${formatDate(salaryChanges[0].fecha)}` : ''}
                    </span>
                  </div>
                </div>
              )
              : <p className="tab-empty">This employee has no current position.</p>}
          </section>

          <section aria-labelledby="salary-title">
            <div className="tab-section-head">
              <h2 id="salary-title">Salary changes</h2>
              <span>{salaryChanges.length} {salaryChanges.length === 1 ? 'record' : 'records'} in this position</span>
            </div>
            {salaryChanges.length === 0
              ? <p className="tab-empty">No salary changes in this position yet.</p>
              : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Previous</th>
                        <th scope="col">New</th>
                        <th scope="col">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaryChanges.map((change) => (
                        <tr key={change.id}>
                          <td className="nowrap">{formatDate(change.fecha)}</td>
                          <td className="nowrap is-muted">{formatMoney(change.sueldo_anterior)}</td>
                          <td className="nowrap">
                            {formatMoney(change.sueldo_nuevo)}{' '}
                            <ChangeChip before={change.sueldo_anterior} after={change.sueldo_nuevo} />
                          </td>
                          <td>{change.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </section>

          <section aria-labelledby="history-title">
            <div className="tab-section-head">
              <h2 id="history-title">Position history</h2>
              <span>Most recent first</span>
            </div>
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
                          <div className="timeline__right">
                            <span className="timeline__salary">{formatMoney(position.sueldo)} USD</span>
                            <EditButton text label={`Edit ${position.cargo}`} onClick={() => setModal({ type: 'edit', position })} />
                          </div>
                        </div>
                        <p className="timeline__dates">
                          {formatDate(position.inicio)} — {position.fin ? formatDate(position.fin) : 'present'}
                        </p>
                        {position.motivo && <p className="timeline__reason"><strong>Reason:</strong> {position.motivo}</p>}
                        <p className="timeline__previous">
                          {position.cargoAnterior
                            ? `Previous position: ${position.cargoAnterior.cargo} · ${formatMoney(position.cargoAnterior.sueldo)} USD`
                            : 'First position in the company'}
                        </p>
                      </article>
                    </li>
                  ))}
                </ol>
              )}
          </section>
        </div>

        <aside className="position-side" aria-label="Summary">
          <div className="summary-dark">
            <p className="summary-dark__title">Summary</p>
            <div>
              <span>Time in the company</span>
              <strong>{hireDate ? timeSince(hireDate) : '—'}</strong>
            </div>
            <div>
              <span>Positions held</span>
              <strong>{positions.length}</strong>
            </div>
            <div>
              <span>Salary since hire</span>
              <strong>{first ? `${formatMoney(first.sueldo, 0)} → ${formatMoney(latest.sueldo, 0)} USD` : '—'}</strong>
            </div>
          </div>
          <div className="who-sees">
            <h2>Who sees what</h2>
            <p>The leader sees this history without salaries. Only administration registers salary changes.</p>
          </div>
        </aside>
      </div>

      {modal?.type === 'register' && (
        <PositionModal
          employeeId={employee.id}
          employeeName={employee.nombre}
          current={current}
          onClose={() => setModal(null)}
          onSaved={saved}
        />
      )}
      {modal?.type === 'edit' && (
        <PositionModal
          employeeId={employee.id}
          employeeName={employee.nombre}
          position={modal.position}
          onClose={() => setModal(null)}
          onSaved={saved}
        />
      )}
      {modal?.type === 'salary' && current && (
        <SalaryModal
          employeeId={employee.id}
          employeeName={employee.nombre}
          current={current}
          onClose={() => setModal(null)}
          onSaved={saved}
        />
      )}
    </div>
  );
}
