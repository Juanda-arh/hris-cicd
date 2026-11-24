import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { forgotPassword } from '../api/authApi';
import {
  createEmployeeLogin,
  createLeaderLogin,
  getEmployee,
  listEmployees,
  listLeaders,
} from '../api/employeesApi';
import { PageHeader } from '../components/AppLayout';
import Field from '../components/FormField';
import PasswordRequirements from '../components/PasswordRequirements';
import { getErrorMessage } from '../utils/errors';
import { initials } from '../utils/people';
import { meetsAllRules } from '../utils/passwordRules';
import './NewEmployeePage.css';
import './EmployeeProfilePage.css';

async function loadAccess(id) {
  const [employee, employees, leaders] = await Promise.all([getEmployee(id), listEmployees(), listLeaders()]);
  return {
    employee,
    username: employees.find((item) => item.id === employee.id)?.usuario || null,
    leader: leaders.find((item) => item.empleado_id === employee.id) || null,
  };
}

function PasswordInput({ fieldProps, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-with-toggle">
      <input
        {...fieldProps}
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
    </div>
  );
}

// With no login yet, this page creates it. The API has no way for an admin to replace an
// existing password, so in that case the form stays locked and offers the reset code instead.
export default function EmployeePasswordPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    loadAccess(id)
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setLoadError(getErrorMessage(err)); });
    return () => { active = false; };
  }, [id]);

  const profilePath = `/people/${id}`;

  if (loadError || !data) {
    return (
      <>
        <PageHeader crumbs={[{ label: 'People', to: '/people' }]} />
        <main className="app__content">
          {loadError
            ? <p className="profile__alert" role="alert">{loadError}</p>
            : <p className="profile__loading" role="status">Loading employee…</p>}
        </main>
      </>
    );
  }

  const { employee, username, leader } = data;
  const hasLogin = Boolean(username);
  const title = hasLogin ? 'Change employee password' : 'Create login';

  async function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = {};
    if (!meetsAllRules(password)) nextErrors.password = 'The password does not meet the requirements';
    if (password !== confirmation) nextErrors.confirmation = 'The passwords do not match';
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const result = leader
        ? await createLeaderLogin(leader.id, password)
        : await createEmployeeLogin(employee.id, password);
      navigate(profilePath, {
        state: { toast: `Login created. Username: ${result.usuario}. Share the password with them privately.` },
      });
    } catch (err) {
      setFormError(getErrorMessage(err));
      setSaving(false);
    }
  }

  async function handleSendCode() {
    setSaving(true);
    setFormError('');
    try {
      await forgotPassword(employee.correo);
      navigate(profilePath, { state: { toast: `A password reset code was sent to ${employee.correo}.` } });
    } catch (err) {
      setFormError(getErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'People', to: '/people' },
          { label: employee.nombre, to: profilePath },
          { label: title },
        ]}
      />
      <main className="app__content new-employee">
        <h1 className="new-employee__title">{title}</h1>
        <p className="new-employee__subtitle">
          {hasLogin ? 'Password of this employee\'s portal account.' : 'They will be asked to change this password at first sign-in.'}
        </p>

        {formError && <p className="profile__alert" role="alert">{formError}</p>}

        <form className="new-employee__layout" onSubmit={handleSubmit} noValidate>
          <div className="new-employee__form">
            <div className="person-card">
              <span className="person-card__photo" aria-hidden="true">{initials(employee.nombre)}</span>
              <span className="person-card__text">
                <strong>{employee.nombre}</strong>
                <span>{employee.correo}</span>
              </span>
            </div>

            <fieldset className="form-stack form-stack--spaced" disabled={hasLogin}>
              <legend className="sr-only">New password</legend>
              <Field id="password" label="New password" required error={errors.password}>
                {(p) => <PasswordInput fieldProps={p} value={password} onChange={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: '' })); }} />}
              </Field>
              <Field id="confirmation" label="Confirm new password" required error={errors.confirmation}>
                {(p) => <PasswordInput fieldProps={p} value={confirmation} onChange={(value) => { setConfirmation(value); setErrors((current) => ({ ...current, confirmation: '' })); }} />}
              </Field>
            </fieldset>

            <div className="new-employee__actions">
              <Link to={profilePath} className="btn btn--text">Cancel</Link>
              <span className="new-employee__actions-right">
                {hasLogin
                  ? <button type="button" className="btn btn--dark" disabled={saving} onClick={handleSendCode}>{saving ? 'Sending…' : 'Send password reset code'}</button>
                  : <button type="submit" className="btn btn--dark" disabled={saving}>{saving ? 'Saving…' : 'Create login'}</button>}
              </span>
            </div>
          </div>

          <div className="new-employee__side new-employee__side--last">
            <PasswordRequirements password={password} />
            {hasLogin && (
              <p className="note">
                An administrator cannot set this password yet: the API has no such option. Send a reset code
                so {employee.nombre} can choose a new one by email.
              </p>
            )}
          </div>
        </form>
      </main>
    </>
  );
}
