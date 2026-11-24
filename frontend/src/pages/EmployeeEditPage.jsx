import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getEmployee,
  listEmployees,
  listLeaders,
  updateEmployee,
  updateEmployeePhoto,
  updatePersonalData,
  updateLeader,
} from '../api/employeesApi';
import { PageHeader } from '../components/AppLayout';
import Field, { ErrorIcon } from '../components/FormField';
import {
  ARL_OPTIONS,
  EPS_OPTIONS,
  GENDERS,
  MARITAL_STATUSES,
  MAX_PHOTO_MB,
  PENSION_OPTIONS,
  SEVERANCE_OPTIONS,
  validatePhoto,
} from '../utils/employeeForm';
import { getErrorMessage } from '../utils/errors';
import { initials } from '../utils/people';
import './NewEmployeePage.css';
import './EmployeeProfilePage.css';
import './EmployeeEditPage.css';

async function loadData(id) {
  const [employee, employees, leaders] = await Promise.all([getEmployee(id), listEmployees(), listLeaders()]);
  const listed = employees.find((item) => item.id === employee.id);
  return {
    employee,
    isLeader: listed?.rol === 'lider',
    ownLeaderRecord: leaders.find((item) => item.empleado_id === employee.id) || null,
    boss: leaders.find((item) => item.id === employee.lider_id) || null,
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERSONAL_FIELDS = ['nombre', 'fecha_nacimiento', 'telefono', 'correo', 'direccion'];
const WORK_FIELDS = ['eps', 'arl', 'fondo_pension', 'cesantias'];

function initialForm(employee, ownLeaderRecord) {
  return {
    nombre: employee.nombre || '',
    cedula: employee.cedula || '',
    fecha_nacimiento: employee.fecha_nacimiento?.slice(0, 10) || '',
    telefono: employee.telefono || '',
    correo: employee.correo || '',
    direccion: employee.direccion || '',
    estado_civil: employee.estado_civil || '',
    genero: employee.genero || '',
    eps: employee.eps || '',
    arl: employee.arl || '',
    fondo_pension: employee.fondo_pension || '',
    cesantias: employee.cesantias || '',
    dias_vacaciones: String(employee.dias_vacaciones ?? 0),
    festivos_descuentan: employee.festivos_descuentan === true,
    puede_ver_equipo: ownLeaderRecord ? ownLeaderRecord.puede_ver_equipo !== false : false,
  };
}

// An entity saved before these lists existed stays available, so editing never loses it
function FundSelect({ fieldProps, options, value, onChange }) {
  const all = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select {...fieldProps} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Not set</option>
      {all.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function PhotoPanel({ employee, photo, error, onPick, onRemove }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!photo) return undefined;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(photo);
    return () => { reader.onload = null; };
  }, [photo]);

  const shown = photo ? preview : employee.foto_url;

  return (
    <section className="photo-panel" aria-labelledby="photo-title">
      <h2 id="photo-title">Photo</h2>
      <div className="photo-panel__preview">
        {shown
          ? <img src={shown} alt={photo ? 'New employee photo' : 'Current employee photo'} />
          : <span aria-hidden="true">{initials(employee.nombre)}</span>}
      </div>
      <div className="photo-panel__actions">
        <input
          ref={inputRef}
          id="photo-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files[0]) onPick(e.target.files[0]);
            e.target.value = '';
          }}
        />
        <button type="button" className="btn btn--small" onClick={() => inputRef.current.click()}>Upload new photo</button>
        {photo && <button type="button" className="photo__remove" onClick={onRemove}>Remove</button>}
      </div>
      {error
        ? <p className="form-field__error"><ErrorIcon />{error}</p>
        : <p className="form-field__hint">JPG, PNG or WEBP, up to {MAX_PHOTO_MB} MB.</p>}
    </section>
  );
}

export default function EmployeeEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // What is saved right now: a retry after an error only sends what is still different
  const saved = useRef(null);

  useEffect(() => {
    let active = true;
    loadData(id)
      .then((result) => {
        if (!active) return;
        const values = initialForm(result.employee, result.ownLeaderRecord);
        saved.current = values;
        setData(result);
        setForm(values);
      })
      .catch((err) => { if (active) setLoadError(getErrorMessage(err)); });
    return () => { active = false; };
  }, [id]);

  const crumbs = [{ label: 'People', to: '/people' }];
  if (loadError || !data || !form) {
    return (
      <>
        <PageHeader crumbs={crumbs} />
        <main className="app__content">
          {loadError
            ? <p className="profile__alert" role="alert">{loadError}</p>
            : <p className="profile__loading" role="status">Loading employee…</p>}
        </main>
      </>
    );
  }

  const { employee, isLeader, ownLeaderRecord, boss } = data;
  const profilePath = `/people/${id}`;

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const rest = { ...current };
      delete rest[name];
      return rest;
    });
  }

  function pickPhoto(file) {
    const problem = validatePhoto(file);
    setPhotoError(problem);
    if (!problem) setPhoto(file);
  }

  function validate() {
    const next = {};
    const was = saved.current;
    if (!form.nombre.trim()) next.nombre = 'Enter the full name';
    if (!form.fecha_nacimiento) next.fecha_nacimiento = 'Select the date of birth';
    else if (form.fecha_nacimiento > new Date().toISOString().slice(0, 10)) next.fecha_nacimiento = 'The date must be in the past';
    if (!EMAIL.test(form.correo.trim())) next.correo = 'Enter a valid email';
    // Older records may lack these: they can stay empty, but a saved value cannot be erased
    if (form.telefono.trim() ? !/^\d{10}$/.test(form.telefono.trim()) : was.telefono) next.telefono = 'Enter exactly 10 digits';
    if (!form.direccion.trim() && was.direccion) next.direccion = 'Enter the address';
    const days = form.dias_vacaciones.trim();
    if (!/^\d+$/.test(days) || Number(days) > 365) next.dias_vacaciones = 'Use a whole number between 0 and 365';
    return next;
  }

  function personalChanges() {
    const changes = {};
    PERSONAL_FIELDS.forEach((name) => {
      const value = form[name].trim();
      if (value !== saved.current[name]) changes[name] = value;
    });
    return changes;
  }

  function employeeChanges() {
    const changes = {};
    WORK_FIELDS.forEach((name) => {
      if (form[name] !== saved.current[name]) changes[name] = form[name] || null;
    });
    if (form.dias_vacaciones.trim() !== saved.current.dias_vacaciones) {
      changes.dias_vacaciones = form.dias_vacaciones.trim();
    }
    if (form.festivos_descuentan !== saved.current.festivos_descuentan) {
      changes.festivos_descuentan = form.festivos_descuentan;
    }
    return changes;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFormError('');
      window.scrollTo({ top: 0 });
      return;
    }

    setSaving(true);
    setFormError('');
    let uploadingPhoto = false;
    try {
      const personal = personalChanges();
      if (Object.keys(personal).length > 0) {
        await updatePersonalData(id, personal);
        saved.current = { ...saved.current, ...personal };
      }
      const changes = employeeChanges();
      if (Object.keys(changes).length > 0) {
        await updateEmployee(id, changes);
        const work = Object.fromEntries(WORK_FIELDS.map((name) => [name, form[name]]));
        saved.current = {
          ...saved.current,
          ...work,
          dias_vacaciones: form.dias_vacaciones.trim(),
          festivos_descuentan: form.festivos_descuentan,
        };
      }
      if (ownLeaderRecord && form.puede_ver_equipo !== saved.current.puede_ver_equipo) {
        await updateLeader(ownLeaderRecord.id, { puede_ver_equipo: form.puede_ver_equipo });
        saved.current = { ...saved.current, puede_ver_equipo: form.puede_ver_equipo };
      }
      if (photo) {
        uploadingPhoto = true;
        await updateEmployeePhoto(id, photo);
      }
      navigate(profilePath, { state: { toast: `The changes to ${form.nombre.trim()} were saved.` } });
    } catch (err) {
      const message = getErrorMessage(err).replace(/\.?$/, '.');
      setFormError(uploadingPhoto
        ? `The other changes were saved, but the photo could not be uploaded: ${message} You can remove it and continue, or try again.`
        : message);
      setSaving(false);
      window.scrollTo({ top: 0 });
    }
  }

  const fundProps = (name) => ({ value: form[name], onChange: (value) => setField(name, value) });
  const bind = (name) => ({ value: form[name], onChange: (e) => setField(name, e.target.value) });
  const notice = formError || (Object.keys(errors).length > 0 ? 'Please fix the highlighted fields before saving.' : '');

  return (
    <>
      <PageHeader
        crumbs={[
          ...crumbs,
          { label: employee.nombre, to: profilePath },
          { label: 'Edit employee' },
        ]}
      />
      <main className="app__content new-employee">
        <h1 className="new-employee__title">Edit employee</h1>
        <p className="new-employee__subtitle">Update the personal and work information of {employee.nombre}.</p>

        {notice && <p className="profile__alert" role="alert">{notice}</p>}

        <form className="new-employee__layout" onSubmit={handleSubmit} noValidate>
          <div className="new-employee__form edit-sections">
            <section aria-labelledby="edit-personal-title">
              <h2 id="edit-personal-title" className="section-title edit-title">Personal information</h2>
              <div className="form-grid">
                <Field id="nombre" label="Full name" required wide error={errors.nombre}>
                  {(p) => <input {...p} type="text" maxLength={100} autoComplete="off" {...bind('nombre')} />}
                </Field>
                <Field id="fecha_nacimiento" label="Date of birth" required error={errors.fecha_nacimiento}>
                  {(p) => <input {...p} type="date" {...bind('fecha_nacimiento')} />}
                </Field>
                <Field id="telefono" label="Phone" required error={errors.telefono}>
                  {(p) => <input {...p} type="tel" inputMode="numeric" maxLength={10} autoComplete="off" {...bind('telefono')} />}
                </Field>
                <Field id="correo" label="Corporate email" required wide hint="Their username does not change; they can also sign in with this email." error={errors.correo}>
                  {(p) => <input {...p} type="email" maxLength={100} autoComplete="off" {...bind('correo')} />}
                </Field>
                <Field id="direccion" label="Address" required wide error={errors.direccion}>
                  {(p) => <input {...p} type="text" maxLength={100} autoComplete="off" {...bind('direccion')} />}
                </Field>
              </div>
              <fieldset className="form-grid edit-locked" disabled>
                <legend className="sr-only">Information that cannot be changed</legend>
                <Field id="cedula" label="ID number" wide hint="ID number, marital status and gender cannot be changed from the portal.">
                  {(p) => <input {...p} type="text" readOnly value={form.cedula} />}
                </Field>
                <Field id="estado_civil" label="Marital status">{(p) => (
                  <select {...p} value={form.estado_civil} onChange={() => {}}>
                    <option value="">—</option>
                    {MARITAL_STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                )}</Field>
                <Field id="genero" label="Gender">{(p) => (
                  <select {...p} value={form.genero} onChange={() => {}}>
                    <option value="">—</option>
                    {GENDERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                )}</Field>
              </fieldset>
            </section>

            <section aria-labelledby="edit-social-title">
              <h2 id="edit-social-title" className="section-title edit-title">Social security &amp; benefits</h2>
              <div className="form-grid">
                <Field id="eps" label="EPS (health)">
                  {(p) => <FundSelect fieldProps={p} options={EPS_OPTIONS} {...fundProps('eps')} />}
                </Field>
                <Field id="arl" label="ARL (occupational risk)">
                  {(p) => <FundSelect fieldProps={p} options={ARL_OPTIONS} {...fundProps('arl')} />}
                </Field>
                <Field id="fondo_pension" label="Pension fund">
                  {(p) => <FundSelect fieldProps={p} options={PENSION_OPTIONS} {...fundProps('fondo_pension')} />}
                </Field>
                <Field id="cesantias" label="Severance fund (cesantías)">
                  {(p) => <FundSelect fieldProps={p} options={SEVERANCE_OPTIONS} {...fundProps('cesantias')} />}
                </Field>
                <Field id="dias_vacaciones" label="Vacation days" required wide hint="Whole number between 0 and 365" error={errors.dias_vacaciones}>
                  {(p) => (
                    <input
                      {...p}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={form.dias_vacaciones}
                      onChange={(e) => setField('dias_vacaciones', e.target.value)}
                    />
                  )}
                </Field>
                <label className="form-check form-check--detail form-field--wide">
                  <input
                    type="checkbox"
                    checked={form.festivos_descuentan}
                    onChange={(e) => setField('festivos_descuentan', e.target.checked)}
                  />
                  <span>
                    Holidays not worked are deducted from vacation days
                    <small>Each weekday holiday takes 1 day from their balance, unless they report beforehand that they will work it.</small>
                  </span>
                </label>
              </div>
            </section>

            <section aria-labelledby="edit-team-title">
              <h2 id="edit-team-title" className="section-title edit-title">Leader &amp; permissions</h2>
              <div className="edit-leader">
                <span>
                  <span className="edit-leader__label">Reports to</span>
                  <strong>{boss ? boss.nombre : 'No leader'}</strong>
                </span>
                <Link to={`${profilePath}/assign-leader`} className="btn btn--small">Change leader</Link>
              </div>
              {isLeader && ownLeaderRecord && (
                <label className="form-check form-check--detail edit-permission">
                  <input
                    type="checkbox"
                    checked={form.puede_ver_equipo}
                    onChange={(e) => setField('puede_ver_equipo', e.target.checked)}
                  />
                  <span>
                    Can view their team
                    <small>Their team members, and the team&apos;s pay stubs and social security receipts.</small>
                  </span>
                </label>
              )}
            </section>

            <div className="new-employee__actions">
              <span />
              <span className="new-employee__actions-right">
                <Link to={profilePath} className="btn">Cancel</Link>
                <button type="submit" className="btn btn--dark" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
              </span>
            </div>
          </div>

          <div className="new-employee__side">
            <PhotoPanel
              employee={employee}
              photo={photo}
              error={photoError}
              onPick={pickPhoto}
              onRemove={() => { setPhoto(null); setPhotoError(''); }}
            />
          </div>
        </form>
      </main>
    </>
  );
}
