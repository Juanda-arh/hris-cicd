import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { changePassword } from '../api/authApi';
import { PageHeader } from '../components/AppLayout';
import Field, { ErrorIcon } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';
import { meetsAllRules, PASSWORD_RULES } from '../utils/passwordRules';
import { LockIcon } from './MyProfilePage';
import './EmployeeProfilePage.css';
import './NewEmployeePage.css';
import './SelfService.css';

// The employee changes their own password from inside the portal (Figma: Employee / Account / Change Password).
// The API asks for the current password too, so it is part of the form.
function PasswordInput({ id, value, onChange, autoComplete, fieldProps }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-with-toggle">
      <input {...fieldProps} id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

function validate({ current, next, confirm }) {
  const errors = {};
  if (!current) errors.current = 'Enter your current password.';
  if (!next) errors.next = 'Enter a new password.';
  else if (!meetsAllRules(next)) errors.next = 'The new password does not meet the requirements.';
  else if (next === current) errors.next = 'Use a password different from the current one.';
  if (!confirm) errors.confirm = 'Confirm the new password.';
  else if (next && confirm !== next) errors.confirm = 'The passwords do not match.';
  return errors;
}

export default function AccountPasswordPage() {
  const { updateToken } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (name) => (value) => {
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((x) => { const copy = { ...x }; delete copy[name]; return copy; });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setSaveError('');
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const data = await changePassword(form.current, form.next);
      // The old session token stops working once the password changes: the API sends a new one
      updateToken(data.token);
      navigate('/my-profile', { state: { toast: 'Your password was updated. Use the new one the next time you sign in.' } });
    } catch (err) {
      if (err.response?.status === 401) setErrors({ current: 'Your current password is incorrect.' });
      else setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const errorCount = Object.keys(errors).length;

  return (
    <>
      <PageHeader crumbs={[{ label: 'Account' }, { label: 'Change password' }]} />
      <main className="app__content self-password">
        <h1 className="self__title">Change password</h1>
        <p className="self__subtitle">You’re already signed in, so you only need your current password and a new one.</p>

        {errorCount > 0 && (
          <p className="self__error-banner" role="alert">
            <ErrorIcon /> Fix {errorCount} {errorCount === 1 ? 'field' : 'fields'} to update your password.
          </p>
        )}
        {saveError && <p className="self__error-banner" role="alert"><ErrorIcon /> {saveError}</p>}

        <div className="self-password__layout">
          <form className="self-password__form" onSubmit={handleSubmit} noValidate>
            <Field id="current-password" label="Current password" required error={errors.current}>
              {(p) => <PasswordInput id="current-password" value={form.current} onChange={set('current')} autoComplete="current-password" fieldProps={p} />}
            </Field>
            <Field id="new-password" label="New password" required error={errors.next}>
              {(p) => <PasswordInput id="new-password" value={form.next} onChange={set('next')} autoComplete="new-password" fieldProps={p} />}
            </Field>
            <Field id="confirm-password" label="Confirm new password" required error={errors.confirm}>
              {(p) => <PasswordInput id="confirm-password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" fieldProps={p} />}
            </Field>

            <div className="self-password__actions">
              <Link to="/my-profile" className="btn">Cancel</Link>
              <button type="submit" className="btn btn--dark" disabled={saving}>{saving ? 'Updating…' : 'Update password'}</button>
            </div>
          </form>

          <aside className="self-password__side">
            <div className="self-password__reqs" aria-live="polite">
              <p className="self-password__reqs-title">Password requirements</p>
              <ul>
                {PASSWORD_RULES.map((rule) => {
                  const met = rule.test(form.next);
                  return (
                    <li key={rule.id} className={met ? 'is-met' : ''}>
                      <span className="self-password__check" aria-hidden="true">{met ? '✓' : ''}</span>
                      {rule.label}
                      <span className="sr-only">{met ? ' — met' : ' — not met yet'}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="self__info">
              <LockIcon />
              <span>You stay signed in on this device. Use the new password the next time you sign in.</span>
            </p>
          </aside>
        </div>
      </main>
    </>
  );
}
