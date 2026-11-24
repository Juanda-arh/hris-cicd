import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  addMyContact,
  getMyContacts,
  getMyProfile,
  updateMyContact,
  updateMyData,
  updateMyPhoto,
} from '../api/selfServiceApi';
import { PageHeader } from '../components/AppLayout';
import Field, { ErrorIcon } from '../components/FormField';
import {
  ARL_OPTIONS,
  EPS_OPTIONS,
  PENSION_OPTIONS,
  RELATIONSHIPS,
  SEVERANCE_OPTIONS,
  validatePhoto,
} from '../utils/employeeForm';
import { getErrorMessage } from '../utils/errors';
import { formatId, genderLabel, initials, maritalLabel } from '../utils/people';
import { LockIcon } from './MyProfilePage';
import './EmployeeProfilePage.css';
import './NewEmployeePage.css';
import './SelfService.css';

// The employee edits everything the API lets them change about themselves. ID number, gender,
// marital status and vacation days stay with HR (the API does not accept them from the employee).
const PHONE = /^\d{10}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERSONAL = ['nombre', 'correo', 'telefono', 'fechaNacimiento', 'direccion', 'eps', 'arl', 'fondoPension', 'cesantias'];
const CONTACT_FIELDS = ['nombre', 'parentesco', 'telefono', 'ciudad'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formFrom(employee) {
  return {
    nombre: employee.nombre || '',
    correo: employee.correo || '',
    telefono: employee.telefono || '',
    fechaNacimiento: (employee.fecha_nacimiento || '').slice(0, 10),
    direccion: employee.direccion || '',
    eps: employee.eps || '',
    arl: employee.arl || '',
    fondoPension: employee.fondo_pension || '',
    cesantias: employee.cesantias || '',
  };
}

function contactFrom(c) {
  return { key: `c${c.id}`, id: c.id, nombre: c.nombre || '', parentesco: c.parentesco || '', telefono: c.telefono || '', ciudad: c.ciudad || '', original: c };
}

function validate(form, contacts) {
  const errors = {};
  if (!form.nombre.trim()) errors.nombre = 'Enter your full name.';
  else if (form.nombre.trim().length > 100) errors.nombre = 'Use at most 100 characters.';
  if (!EMAIL.test(form.correo.trim()) || form.correo.trim().length > 100) errors.correo = 'Enter a valid email address.';
  if (!PHONE.test(form.telefono.trim())) errors.telefono = 'Enter a 10-digit phone number.';
  if (!form.fechaNacimiento) errors.fechaNacimiento = 'Select your date of birth.';
  else if (form.fechaNacimiento >= today()) errors.fechaNacimiento = 'The date must be in the past.';
  if (!form.direccion.trim()) errors.direccion = 'Enter your address.';
  else if (form.direccion.trim().length > 100) errors.direccion = 'Use at most 100 characters.';
  if (!form.eps) errors.eps = 'Select your EPS.';
  if (!form.arl) errors.arl = 'Select your ARL.';
  if (!form.fondoPension) errors.fondoPension = 'Select your pension fund.';
  if (!form.cesantias) errors.cesantias = 'Select your severance fund.';

  contacts.forEach((c) => {
    const k = (field) => `${c.key}-${field}`;
    if (!c.nombre.trim()) errors[k('nombre')] = 'Enter a name.';
    else if (c.nombre.trim().length > 100) errors[k('nombre')] = 'Use at most 100 characters.';
    if (!c.parentesco) errors[k('parentesco')] = 'Select the relationship.';
    if (!PHONE.test(c.telefono.trim())) errors[k('telefono')] = 'Enter a 10-digit phone number.';
    if (!c.ciudad.trim()) errors[k('ciudad')] = 'Enter the city.';
    else if (c.ciudad.trim().length > 50) errors[k('ciudad')] = 'Use at most 50 characters.';
  });
  return errors;
}

// A value HR typed that is not in the list is kept as an option so it is not lost
const withCurrent = (options, value) => (value && !options.includes(value) ? [value, ...options] : options);

export default function MyProfileEditPage() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const newKey = useRef(0);
  const [employee, setEmployee] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getMyProfile(), getMyContacts()])
      .then(([me, mine]) => {
        if (!active) return;
        setEmployee(me);
        setForm(formFrom(me));
        setContacts(mine.map(contactFrom));
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err.response?.status === 404
          ? 'Your account has no employee record, so there is no personal information to edit.'
          : getErrorMessage(err));
      });
    return () => { active = false; };
  }, []);

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const errorCount = Object.keys(errors).length;
  const crumbs = [{ label: 'My Profile', to: '/my-profile' }, { label: 'Edit personal information' }];

  function clearError(key) {
    if (errors[key]) setErrors((x) => { const next = { ...x }; delete next[key]; return next; });
  }

  function bind(name) {
    return {
      value: form[name],
      onChange: (e) => {
        const value = e.target.value;
        setForm((f) => ({ ...f, [name]: value }));
        clearError(name);
      },
    };
  }

  function bindContact(contact, field) {
    return {
      value: contact[field],
      onChange: (e) => {
        const value = e.target.value;
        setContacts((list) => list.map((c) => (c.key === contact.key ? { ...c, [field]: value } : c)));
        clearError(`${contact.key}-${field}`);
      },
    };
  }

  function addContact() {
    newKey.current += 1;
    setContacts((list) => [...list, { key: `n${newKey.current}`, id: null, nombre: '', parentesco: '', telefono: '', ciudad: '' }]);
  }

  function removeNewContact(key) {
    setContacts((list) => list.filter((c) => c.key !== key));
    setErrors((x) => Object.fromEntries(Object.entries(x).filter(([k]) => !k.startsWith(`${key}-`))));
  }

  function choosePhoto(file) {
    setPhotoError('');
    if (!file) return;
    const problem = validatePhoto(file);
    if (problem) {
      setPhotoError(problem);
      return;
    }
    setPhoto(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaveError('');
    const found = validate(form, contacts);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Only what changed is sent
    const original = formFrom(employee);
    const changes = {};
    PERSONAL.forEach((field) => {
      const value = typeof form[field] === 'string' ? form[field].trim() : form[field];
      if (value !== original[field]) changes[field] = value;
    });
    const contactChanges = contacts
      .map((c) => {
        const clean = Object.fromEntries(CONTACT_FIELDS.map((f) => [f, c[f].trim()]));
        if (!c.id) return { contact: c, body: clean, isNew: true };
        const diff = Object.fromEntries(CONTACT_FIELDS.filter((f) => clean[f] !== (c.original[f] || '')).map((f) => [f, clean[f]]));
        return Object.keys(diff).length ? { contact: c, body: diff, isNew: false } : null;
      })
      .filter(Boolean);

    if (Object.keys(changes).length === 0 && contactChanges.length === 0 && !photo) {
      navigate('/my-profile', { state: { toast: 'There were no changes to save.' } });
      return;
    }

    setSaving(true);
    const done = [];
    try {
      if (Object.keys(changes).length > 0) {
        try {
          await updateMyData(employee.id, changes);
          done.push('personal details');
        } catch (err) {
          const message = getErrorMessage(err);
          if (err.response?.status === 409 && /phone/i.test(message)) setErrors({ telefono: 'That phone number is already registered to someone else.' });
          else if (err.response?.status === 409 && /email|correo/i.test(message)) setErrors({ correo: 'That email is already registered to someone else.' });
          else setSaveError(message);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }

      for (const { contact, body, isNew } of contactChanges) {
        try {
          if (isNew) {
            const saved = await addMyContact(body);
            // Saved: from now on it is an existing contact, so a retry does not create it twice
            setContacts((list) => list.map((c) => (c.key === contact.key ? contactFrom(saved) : c)));
          } else {
            await updateMyContact(contact.id, body);
          }
        } catch (err) {
          setSaveError(`${done.length ? `Your ${done.join(' and ')} were saved, but the` : 'The'} emergency contact “${body.nombre || contact.nombre}” could not be saved: ${getErrorMessage(err)}`);
          if (done.length) setEmployee((me) => ({ ...me, ...Object.fromEntries(Object.entries(changes).map(([k, v]) => [k === 'fechaNacimiento' ? 'fecha_nacimiento' : k === 'fondoPension' ? 'fondo_pension' : k, v])) }));
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
      if (contactChanges.length) done.push('emergency contacts');

      if (photo) {
        try {
          await updateMyPhoto(employee.id, photo);
        } catch (err) {
          navigate('/my-profile', {
            state: { toast: `${done.length ? `Your ${done.join(' and ')} were saved, but the` : 'The'} photo could not be uploaded: ${getErrorMessage(err)}` },
          });
          return;
        }
      }
      navigate('/my-profile', { state: { toast: 'Your personal information was updated.' } });
    } finally {
      setSaving(false);
    }
  }

  if (loadError || !form) {
    return (
      <>
        <PageHeader crumbs={crumbs} />
        <main className="app__content">
          {loadError
            ? (
              <>
                <p className="profile__alert" role="alert">{loadError}</p>
                <Link to="/my-profile" className="btn">Back to My Profile</Link>
              </>
            )
            : <p className="profile__loading" role="status">Loading your information…</p>}
        </main>
      </>
    );
  }

  const select = (name, label, options, placeholder = 'Select') => (
    <Field id={name} label={label} required error={errors[name]}>
      {(p) => (
        <select {...p} {...bind(name)}>
          <option value="">{placeholder}</option>
          {withCurrent(options, form[name]).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </Field>
  );

  return (
    <>
      <PageHeader crumbs={crumbs} />
      <main className="app__content self-edit">
        <h1 className="self__title">Edit personal information</h1>
        <p className="self__subtitle">Update your personal details, social security and emergency contacts.</p>

        {errorCount > 0 && (
          <p className="self__error-banner" role="alert">
            <ErrorIcon /> Fix {errorCount} {errorCount === 1 ? 'field' : 'fields'} to save your changes.
          </p>
        )}
        {saveError && <p className="self__error-banner" role="alert"><ErrorIcon /> {saveError}</p>}

        <form className="self-edit__layout" onSubmit={handleSubmit} noValidate>
          <div className="self-edit__main">
            <h2 className="section-title">Personal details</h2>
            <div className="form-grid self-edit__grid">
              <Field id="nombre" label="Full name" required wide error={errors.nombre}>
                {(p) => <input {...p} type="text" maxLength={100} autoComplete="name" {...bind('nombre')} />}
              </Field>
              <Field id="correo" label="Email" required error={errors.correo}>
                {(p) => <input {...p} type="email" maxLength={100} autoComplete="email" {...bind('correo')} />}
              </Field>
              <Field id="telefono" label="Phone" required error={errors.telefono}>
                {(p) => <input {...p} type="tel" inputMode="numeric" maxLength={10} autoComplete="tel" {...bind('telefono')} />}
              </Field>
              <Field id="fechaNacimiento" label="Date of birth" required error={errors.fechaNacimiento}>
                {(p) => <input {...p} type="date" max={today()} {...bind('fechaNacimiento')} />}
              </Field>
              <Field id="direccion" label="Address" required error={errors.direccion}>
                {(p) => <input {...p} type="text" maxLength={100} autoComplete="street-address" {...bind('direccion')} />}
              </Field>
            </div>

            <h2 className="section-title self-edit__section">Social security</h2>
            <div className="form-grid self-edit__grid">
              {select('eps', 'EPS (health)', EPS_OPTIONS)}
              {select('arl', 'ARL (occupational risk)', ARL_OPTIONS)}
              {select('fondoPension', 'Pension fund', PENSION_OPTIONS)}
              {select('cesantias', 'Severance fund (Cesantías)', SEVERANCE_OPTIONS)}
            </div>

            <div className="self-edit__section">
              <div className="self__section-head">
                <h2 className="section-title section-title--plain">Emergency contacts</h2>
                <button type="button" className="btn btn--small" onClick={addContact}>+ Add contact</button>
              </div>
              {contacts.length === 0 && <p className="self__empty">You have no emergency contacts yet. Add at least one.</p>}
              {contacts.map((c, i) => (
                <fieldset key={c.key} className="self-edit__contact">
                  <legend className="self-edit__contact-head">
                    <span>{c.id ? `Contact ${i + 1}` : 'New contact'}</span>
                    {!c.id && <button type="button" className="btn btn--text btn--small" onClick={() => removeNewContact(c.key)}>Remove</button>}
                  </legend>
                  <div className="form-grid">
                    <Field id={`${c.key}-nombre`} label="Name" required error={errors[`${c.key}-nombre`]}>
                      {(p) => <input {...p} type="text" maxLength={100} {...bindContact(c, 'nombre')} />}
                    </Field>
                    <Field id={`${c.key}-parentesco`} label="Relationship" required error={errors[`${c.key}-parentesco`]}>
                      {(p) => (
                        <select {...p} {...bindContact(c, 'parentesco')}>
                          <option value="">Select</option>
                          {withCurrent(RELATIONSHIPS, c.parentesco).map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      )}
                    </Field>
                    <Field id={`${c.key}-telefono`} label="Phone" required error={errors[`${c.key}-telefono`]}>
                      {(p) => <input {...p} type="tel" inputMode="numeric" maxLength={10} {...bindContact(c, 'telefono')} />}
                    </Field>
                    <Field id={`${c.key}-ciudad`} label="City" required error={errors[`${c.key}-ciudad`]}>
                      {(p) => <input {...p} type="text" maxLength={50} {...bindContact(c, 'ciudad')} />}
                    </Field>
                  </div>
                </fieldset>
              ))}
              {contacts.some((c) => c.id) && <p className="self-edit__photo-hint">To delete a saved contact, ask HR.</p>}
            </div>

            <div className="self-edit__section">
              <div className="self__section-head">
                <h2 className="section-title section-title--plain">Managed by HR</h2>
                <span className="self__managed"><LockIcon /> Read only</span>
              </div>
              <dl className="data-rows">
                <div><dt>ID number</dt><dd className="self__mono">{formatId(employee.cedula) || '—'}</dd></div>
                <div><dt>Gender</dt><dd>{genderLabel(employee.genero) || '—'}</dd></div>
                <div><dt>Marital status</dt><dd>{maritalLabel(employee.estado_civil) || '—'}</dd></div>
                <div><dt>Vacation days</dt><dd>{employee.dias_vacaciones != null ? `${employee.dias_vacaciones} available` : '—'}</dd></div>
              </dl>
            </div>

            <p className="self__info">
              <LockIcon />
              <span>Your ID number, gender, marital status, position, position history and vacation days are managed by HR. Contact HR to change them.</span>
            </p>

            <div className="self-edit__actions">
              <Link to="/my-profile" className="btn">Cancel</Link>
              <button type="submit" className="btn btn--dark" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </div>

          <aside className="self-edit__photo" aria-labelledby="photo-title">
            <p id="photo-title" className="self-edit__photo-title">Photo</p>
            {preview || employee.foto_url
              ? <img className="self-edit__photo-img" src={preview || employee.foto_url} alt={preview ? 'New photo preview' : 'Current photo'} />
              : <span className="self-edit__photo-img self-edit__photo-img--empty" aria-hidden="true">{initials(employee.nombre)}</span>}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="New photo"
              onChange={(e) => { choosePhoto(e.target.files[0]); e.target.value = ''; }}
            />
            <div className="self-edit__photo-actions">
              <button type="button" className="btn" onClick={() => fileRef.current.click()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4.5 20.5h15" /></svg>
                Upload new photo
              </button>
              {photo && <button type="button" className="btn btn--text" onClick={() => setPhoto(null)}>Keep current</button>}
            </div>
            {photoError
              ? <p className="form-field__error"><ErrorIcon />{photoError}</p>
              : <p className="self-edit__photo-hint">{photo ? 'It is uploaded when you save.' : 'JPG, PNG or WEBP · max 2 MB · square works best.'}</p>}
          </aside>
        </form>
      </main>
    </>
  );
}
