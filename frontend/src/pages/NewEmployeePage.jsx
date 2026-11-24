import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createEmergencyContact,
  createEmployee,
  createEmployeeLogin,
  createLeader,
  createLeaderLogin,
  createPosition,
  listLeaders,
} from '../api/employeesApi';
import { PageHeader } from '../components/AppLayout';
import Field, { ErrorIcon } from '../components/FormField';
import PasswordRequirements from '../components/PasswordRequirements';
import {
  ARL_OPTIONS,
  emptyContact,
  EPS_OPTIONS,
  GENDERS,
  INITIAL_FORM,
  MARITAL_STATUSES,
  MAX_PHOTO_MB,
  PENSION_OPTIONS,
  RELATIONSHIPS,
  SEVERANCE_OPTIONS,
  STEPS,
  usernameFromEmail,
  validatePhoto,
  validateStep,
} from '../utils/employeeForm';
import { getErrorMessage } from '../utils/errors';
import './NewEmployeePage.css';

function SelectOptions({ options }) {
  return (
    <>
      <option value="">Select</option>
      {options.map((option) => {
        const { value, label } = typeof option === 'string' ? { value: option, label: option } : option;
        return <option key={value} value={value}>{label}</option>;
      })}
    </>
  );
}

function Stepper({ current }) {
  return (
    <ol className="stepper">
      {STEPS.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={label} className={`stepper__step is-${state}`} aria-current={i === current ? 'step' : undefined}>
            <span className="stepper__box" aria-hidden="true">
              {state === 'done' ? '✓' : i + 1}
            </span>
            <span className="stepper__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function PhotoPicker({ photo, error, onPick, onRemove }) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!photo) return undefined;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(photo);
    return () => { reader.onload = null; };
  }, [photo]);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) onPick(e.dataTransfer.files[0]);
  }

  return (
    <div className="photo">
      <label
        className={`photo__drop${dragging ? ' is-dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files[0]) onPick(e.target.files[0]);
            e.target.value = '';
          }}
        />
        {photo && preview
          ? <img src={preview} alt="Employee preview" />
          : (
            <span className="photo__empty">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" />
                <circle cx="9" cy="10" r="1.5" />
                <path d="m21 16-5-5L6 19" />
              </svg>
              <span>Employee photo</span>
              <span>Drag it here or browse · JPG, PNG or WEBP · max {MAX_PHOTO_MB} MB</span>
            </span>
          )}
      </label>
      {photo && <button type="button" className="photo__remove" onClick={onRemove}>Remove photo</button>}
      {error && <p className="form-field__error"><ErrorIcon />{error}</p>}
    </div>
  );
}

function Summary({ form, leaderName }) {
  const roleLabel = form.rol === 'lider' ? 'Leader' : 'Employee';
  return (
    <aside className="summary" aria-label="New employee summary">
      <p className="summary__title">New employee</p>
      <p className="summary__name">{form.nombre}</p>
      <p>ID {form.cedula}</p>
      <p>{form.correo}</p>
      <p>Holidays deducted from vacation: {form.festivosDescuentan ? 'Yes' : 'No'}</p>
      {form.cargo && <p className="summary__group">{form.cargo} · {form.area}</p>}
      {form.inicio && <p>Since {form.inicio}</p>}
      {(leaderName || form.rol === 'lider') && (
        <p className="summary__group">{leaderName ? `Leader: ${leaderName} · ` : ''}Role: {roleLabel}</p>
      )}
      {form.rol === 'lider' && <p>Can view their team: {form.puedeVerEquipo ? 'Yes' : 'No'}</p>}
    </aside>
  );
}

export default function NewEmployeePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [leaders, setLeaders] = useState([]);
  const [leadersError, setLeadersError] = useState('');

  // Saving takes several API calls. What already went through is remembered here, so saving
  // again after an error continues where it stopped instead of creating the person twice.
  const saved = useRef({ contacts: new Set() });
  // Same information for the screen, which locks whatever can no longer change
  const [locked, setLocked] = useState({ person: false, position: false, login: false, contacts: [] });
  const nextContactId = useRef(2);

  useEffect(() => {
    let active = true;
    listLeaders()
      .then((data) => { if (active) setLeaders(data.filter((leader) => leader.estado !== 'Inactivo')); })
      .catch((err) => { if (active) setLeadersError(getErrorMessage(err)); });
    return () => { active = false; };
  }, []);

  const leaderName = useMemo(
    () => leaders.find((leader) => String(leader.id) === form.liderId)?.nombre || '',
    [leaders, form.liderId]
  );

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const rest = { ...current };
      delete rest[name];
      return rest;
    });
  }

  // Common props for a simple control bound to a form field
  function bind(name) {
    return {
      value: form[name],
      onChange: (e) => setField(name, e.target.value),
    };
  }

  function setContact(id, name, value) {
    setForm((current) => ({
      ...current,
      contactos: current.contactos.map((contact) => (contact.id === id ? { ...contact, [name]: value } : contact)),
    }));
    setErrors((current) => {
      const key = `contacto-${id}-${name}`;
      if (!current[key]) return current;
      const rest = { ...current };
      delete rest[key];
      return rest;
    });
  }

  function addContact() {
    const id = nextContactId.current;
    nextContactId.current += 1;
    setForm((current) => ({ ...current, contactos: [...current.contactos, emptyContact(id)] }));
  }

  function removeContact(id) {
    setForm((current) => ({ ...current, contactos: current.contactos.filter((contact) => contact.id !== id) }));
  }

  function pickPhoto(file) {
    const problem = validatePhoto(file);
    setPhotoError(problem);
    if (!problem) setPhoto(file);
  }

  function goToStep(next) {
    setStep(next);
    setErrors({});
    setBanner('');
    window.scrollTo({ top: 0 });
  }

  function validateCurrentStep() {
    const stepErrors = validateStep(step, form);
    setErrors(stepErrors);
    const valid = Object.keys(stepErrors).length === 0;
    setBanner('');
    if (!valid) window.scrollTo({ top: 0 });
    return valid;
  }

  function handleNext(e) {
    e.preventDefault();
    if (step === STEPS.length - 1) {
      handleSave();
      return;
    }
    if (validateCurrentStep()) goToStep(step + 1);
  }

  function personPayload() {
    return {
      nombre: form.nombre.trim(),
      cedula: form.cedula.trim(),
      fechaNacimiento: form.fechaNacimiento,
      telefono: form.telefono.trim(),
      correo: form.correo.trim(),
      estadoCivil: form.estadoCivil,
      genero: form.genero,
      direccion: form.direccion.trim(),
      eps: form.eps,
      arl: form.arl,
      fondoPension: form.fondoPension,
      cesantias: form.cesantias,
      diasVacaciones: form.diasVacaciones.trim(),
      // The API expects the text "true" or "false" (it travels as form-data when there is a photo)
      festivosDescuentan: String(form.festivosDescuentan),
      liderId: form.liderId || null,
    };
  }

  async function savePerson() {
    if (saved.current.personaId) return;
    const payload = personPayload();
    if (form.rol === 'lider') {
      const leader = await createLeader({ ...payload, puedeVerEquipo: form.puedeVerEquipo }, photo);
      saved.current = { ...saved.current, leaderId: leader.id, employeeId: leader.empleadoId, personaId: leader.personaId };
    } else {
      const employee = await createEmployee(payload, photo);
      saved.current = { ...saved.current, employeeId: employee.id, personaId: employee.personaId };
    }
    setLocked((current) => ({ ...current, person: true }));
  }

  async function savePosition() {
    if (saved.current.position) return;
    await createPosition(saved.current.employeeId, {
      cargo: form.cargo.trim(),
      area: form.area.trim(),
      funcion: form.funcion.trim() || null,
      motivo: 'New hire',
      sueldo: form.sueldo.trim(),
      inicio: form.inicio,
    });
    saved.current.position = true;
    setLocked((current) => ({ ...current, position: true }));
  }

  async function saveLogin() {
    if (saved.current.login) return;
    const result = saved.current.leaderId
      ? await createLeaderLogin(saved.current.leaderId, form.clave)
      : await createEmployeeLogin(saved.current.employeeId, form.clave);
    saved.current.login = result.usuario;
    setLocked((current) => ({ ...current, login: true }));
  }

  async function saveContacts() {
    for (const contact of form.contactos) {
      if (saved.current.contacts.has(contact.id)) continue;
      await createEmergencyContact(saved.current.personaId, {
        nombre: contact.nombre.trim(),
        parentesco: contact.parentesco,
        telefono: contact.telefono.trim(),
        ciudad: contact.ciudad.trim(),
      });
      saved.current.contacts.add(contact.id);
      setLocked((current) => ({ ...current, contacts: [...current.contacts, contact.id] }));
    }
  }

  async function handleSave() {
    if (!validateCurrentStep()) return;

    setSaving(true);
    const stages = [
      { run: savePerson, step: 0, what: 'the employee' },
      { run: savePosition, step: 1, what: 'the position' },
      { run: saveLogin, step: 3, what: 'the login' },
      { run: saveContacts, step: 4, what: 'the emergency contacts' },
    ];

    for (const stage of stages) {
      try {
        await stage.run();
      } catch (err) {
        const message = getErrorMessage(err).replace(/.?$/, '.');
        setStep(stage.step);
        setBanner(saved.current.personaId
          ? `The employee was created, but ${stage.what} could not be saved: ${message} Fix it and save again; nothing will be duplicated.`
          : message);
        setSaving(false);
        window.scrollTo({ top: 0 });
        return;
      }
    }

    navigate('/people', {
      replace: true,
      state: { created: `${form.nombre.trim()} was added. Username: ${saved.current.login}. Share the temporary password with them privately.` },
    });
  }

  const lastStep = step === STEPS.length - 1;
  const notice = banner || (Object.keys(errors).length > 0 ? 'Please fix the highlighted fields before continuing.' : '');
  const username = usernameFromEmail(form.correo);

  return (
    <>
      <PageHeader crumbs={[{ label: 'People', to: '/people' }, { label: 'New employee' }]} />

      <main className="app__content new-employee">
        <h1 className="new-employee__title">Add employee</h1>
        <p className="new-employee__subtitle">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>

        <Stepper current={step} />

        {notice && (
          <p className="new-employee__banner" role="alert"><ErrorIcon />{notice}</p>
        )}

        <form className="new-employee__layout" onSubmit={handleNext} noValidate>
          <div className="new-employee__form">
            {step === 0 && (
              <fieldset className="form-grid" disabled={locked.person}>
                <legend className="sr-only">Personal information</legend>
                <Field id="nombre" label="Full name" required error={errors.nombre}>
                  {(p) => <input {...p} type="text" autoComplete="off" {...bind('nombre')} />}
                </Field>
                <Field id="cedula" label="ID number" required error={errors.cedula}>
                  {(p) => <input {...p} type="text" autoComplete="off" {...bind('cedula')} />}
                </Field>
                <Field id="fechaNacimiento" label="Date of birth" required error={errors.fechaNacimiento}>
                  {(p) => <input {...p} type="date" {...bind('fechaNacimiento')} />}
                </Field>
                <Field id="telefono" label="Phone" required error={errors.telefono}>
                  {(p) => <input {...p} type="tel" inputMode="numeric" maxLength={10} autoComplete="off" {...bind('telefono')} />}
                </Field>
                <Field id="correo" label="Corporate email" required wide error={errors.correo}>
                  {(p) => <input {...p} type="email" autoComplete="off" {...bind('correo')} />}
                </Field>
                <Field id="estadoCivil" label="Marital status" required error={errors.estadoCivil}>
                  {(p) => <select {...p} {...bind('estadoCivil')}><SelectOptions options={MARITAL_STATUSES} /></select>}
                </Field>
                <Field id="genero" label="Gender" required error={errors.genero}>
                  {(p) => <select {...p} {...bind('genero')}><SelectOptions options={GENDERS} /></select>}
                </Field>
                <Field id="direccion" label="Address" required wide error={errors.direccion}>
                  {(p) => <input {...p} type="text" autoComplete="off" {...bind('direccion')} />}
                </Field>
                <Field id="eps" label="EPS (health)" required error={errors.eps}>
                  {(p) => <select {...p} {...bind('eps')}><SelectOptions options={EPS_OPTIONS} /></select>}
                </Field>
                <Field id="arl" label="ARL (occupational risk)" required error={errors.arl}>
                  {(p) => <select {...p} {...bind('arl')}><SelectOptions options={ARL_OPTIONS} /></select>}
                </Field>
                <Field id="fondoPension" label="Pension fund" required error={errors.fondoPension}>
                  {(p) => <select {...p} {...bind('fondoPension')}><SelectOptions options={PENSION_OPTIONS} /></select>}
                </Field>
                <Field id="cesantias" label="Severance fund (cesantías)" required error={errors.cesantias}>
                  {(p) => <select {...p} {...bind('cesantias')}><SelectOptions options={SEVERANCE_OPTIONS} /></select>}
                </Field>
                <Field id="diasVacaciones" label="Vacation days" required wide hint="Days available from the hire date" error={errors.diasVacaciones}>
                  {(p) => <input {...p} type="text" inputMode="numeric" {...bind('diasVacaciones')} />}
                </Field>
                <label className="form-check form-check--detail form-field--wide">
                  <input
                    type="checkbox"
                    checked={form.festivosDescuentan}
                    onChange={(e) => setField('festivosDescuentan', e.target.checked)}
                  />
                  <span>
                    Holidays not worked are deducted from vacation days
                    <small>Each weekday holiday takes 1 day from their balance, unless they report beforehand that they will work it.</small>
                  </span>
                </label>
              </fieldset>
            )}

            {step === 1 && (
              <fieldset className="form-grid" disabled={locked.position}>
                <legend className="sr-only">Position and salary</legend>
                <Field id="cargo" label="Position" required hint="At most 300 characters" error={errors.cargo}>
                  {(p) => <input {...p} type="text" maxLength={300} autoComplete="off" {...bind('cargo')} />}
                </Field>
                <Field id="area" label="Area or department" required error={errors.area}>
                  {(p) => <input {...p} type="text" maxLength={50} autoComplete="off" {...bind('area')} />}
                </Field>
                <Field id="inicio" label="Hire date" required error={errors.inicio}>
                  {(p) => <input {...p} type="date" {...bind('inicio')} />}
                </Field>
                <Field id="sueldo" label="Monthly salary (USD)" required hint="Numbers only, up to 2 decimals" error={errors.sueldo}>
                  {(p) => <input {...p} type="text" inputMode="decimal" autoComplete="off" {...bind('sueldo')} />}
                </Field>
                <Field id="funcion" label="Function" wide error={errors.funcion}>
                  {(p) => <input {...p} type="text" maxLength={50} placeholder="e.g. Site follow-up" autoComplete="off" {...bind('funcion')} />}
                </Field>
              </fieldset>
            )}

            {step === 2 && (
              <fieldset className="form-stack" disabled={locked.person}>
                <legend className="sr-only">Leader and permissions</legend>
                <Field
                  id="liderId"
                  label="Leader"
                  error={errors.liderId || leadersError}
                  hint={leaders.length === 0
                    ? 'There are no leaders yet: you can assign one later from their profile.'
                    : 'Optional. The person they will report to — it can also be assigned later from their profile.'}
                >
                  {(p) => (
                    <select {...p} {...bind('liderId')}>
                      <option value="">{leaders.length === 0 ? 'No leaders available' : 'No leader for now'}</option>
                      {leaders.map((leader) => <option key={leader.id} value={leader.id}>{leader.nombre}</option>)}
                    </select>
                  )}
                </Field>

                <div role="radiogroup" aria-labelledby="role-title">
                  <p id="role-title" className="choice-title">System role &amp; permissions</p>
                  <div className="choices choices--2 choices--top">
                    <div className="choice-column">
                      <label className={`choice${form.rol === 'lider' ? ' is-selected' : ''}`}>
                        <input type="radio" name="rol" checked={form.rol === 'lider'} onChange={() => setField('rol', 'lider')} />
                        <span className="choice__box" aria-hidden="true" />
                        <span className="choice__name">Leader</span>
                        <span className="choice__text">Reviews their team and approves requests.</span>
                      </label>
                      {form.rol === 'lider' && (
                        <label className="form-check form-check--detail">
                          <input
                            type="checkbox"
                            checked={form.puedeVerEquipo}
                            onChange={(e) => setField('puedeVerEquipo', e.target.checked)}
                          />
                          <span>
                            Can view their team
                            <small>Their team members, and the team&apos;s pay stubs and social security receipts.</small>
                          </span>
                        </label>
                      )}
                    </div>
                    <label className={`choice${form.rol === 'empleado' ? ' is-selected' : ''}`}>
                      <input type="radio" name="rol" checked={form.rol === 'empleado'} onChange={() => setField('rol', 'empleado')} />
                      <span className="choice__box" aria-hidden="true" />
                      <span className="choice__name">Employee</span>
                      <span className="choice__text">Own profile, time off, pay stubs and certificates.</span>
                    </label>
                  </div>
                </div>
              </fieldset>
            )}

            {step === 3 && (
              <fieldset className="form-stack" disabled={locked.login}>
                <legend className="sr-only">Credentials and login</legend>
                <Field id="loginEmail" label="Login email" hint={`Their username will be: ${username}`}>
                  {(p) => <input {...p} type="email" value={form.correo} readOnly className="is-readonly" />}
                </Field>

                <Field id="clave" label="Temporary password" required hint="You define it and share it with them privately." error={errors.clave}>
                  {(p) => (
                    <div className="input-with-toggle">
                      <input {...p} type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...bind('clave')} />
                      <button type="button" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  )}
                </Field>
                <PasswordRequirements password={form.clave} />

                <label className="form-check">
                  <input type="checkbox" checked disabled readOnly />
                  Require a password change at first login
                </label>
              </fieldset>
            )}

            {step === 4 && (
              <div className="form-stack">
                {form.contactos.map((contact, i) => {
                  const key = (name) => `contacto-${contact.id}-${name}`;
                  const control = (name) => ({
                    value: contact[name],
                    onChange: (e) => setContact(contact.id, name, e.target.value),
                  });
                  return (
                    <fieldset key={contact.id} className="contact" disabled={locked.contacts.includes(contact.id)}>
                      <legend className="sr-only">Contact {i + 1}</legend>
                      <div className="contact__head">
                        <span>Contact {i + 1}</span>
                        {form.contactos.length > 1 && !locked.contacts.includes(contact.id) && (
                          <button
                            type="button"
                            className="contact__remove"
                            aria-label={`Remove contact ${i + 1}`}
                            onClick={() => removeContact(contact.id)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="contact__grid">
                        <Field id={key('nombre')} label="Name" required error={errors[key('nombre')]}>
                          {(p) => <input {...p} type="text" autoComplete="off" {...control('nombre')} />}
                        </Field>
                        <Field id={key('parentesco')} label="Relationship" required error={errors[key('parentesco')]}>
                          {(p) => <select {...p} {...control('parentesco')}><SelectOptions options={RELATIONSHIPS} /></select>}
                        </Field>
                        <Field id={key('telefono')} label="Phone" required error={errors[key('telefono')]}>
                          {(p) => <input {...p} type="tel" inputMode="numeric" maxLength={10} autoComplete="off" {...control('telefono')} />}
                        </Field>
                        <Field id={key('ciudad')} label="City" required error={errors[key('ciudad')]}>
                          {(p) => <input {...p} type="text" maxLength={50} autoComplete="off" {...control('ciudad')} />}
                        </Field>
                      </div>
                    </fieldset>
                  );
                })}
                <button type="button" className="add-contact" onClick={addContact}>
                  <span aria-hidden="true">+</span> Add another contact
                </button>
              </div>
            )}

            <div className="new-employee__actions">
              <button type="button" className="btn btn--text" onClick={() => navigate('/people')} disabled={saving}>
                Cancel
              </button>
              <span className="new-employee__actions-right">
                <button type="button" className="btn" disabled={step === 0 || saving} onClick={() => goToStep(step - 1)}>
                  Back
                </button>
                {!lastStep && <button type="submit" className="btn btn--dark">Next</button>}
                <button
                  type={lastStep ? 'submit' : 'button'}
                  className={`btn${lastStep ? ' btn--orange' : ''}`}
                  disabled={!lastStep || saving}
                >
                  {saving ? 'Saving…' : 'Save employee'}
                </button>
              </span>
            </div>
          </div>

          <div className="new-employee__side">
            {step === 0
              ? <PhotoPicker photo={photo} error={photoError} onPick={pickPhoto} onRemove={() => setPhoto(null)} />
              : <Summary form={form} leaderName={leaderName} />}
          </div>
        </form>
      </main>
    </>
  );
}
