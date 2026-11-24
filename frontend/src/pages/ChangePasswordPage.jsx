import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { changePassword } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';
import AuthLayout from '../components/AuthLayout';
import PasswordField from '../components/PasswordField';
import PasswordRequirements from '../components/PasswordRequirements';
import { meetsAllRules } from '../utils/passwordRules';

export default function ChangePasswordPage() {
  const { isAuthenticated, updateToken, logout } = useAuth();
  const navigate = useNavigate();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Without a session there is nothing to change
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const allRulesMet = meetsAllRules(next);
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSubmit = current && allRulesMet && next === confirm && !loading;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setError('');
    setLoading(true);
    try {
      const data = await changePassword(current, next);
      updateToken(data.token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleSignOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <AuthLayout>
      <form className="auth__form" onSubmit={handleSubmit} noValidate>
        <p className="auth__label-top">First sign-in</p>
        <h2 className="auth__title auth__title--tight">Set a new password.</h2>
        <p className="auth__subtitle">
          For your security, replace your temporary password before continuing.
        </p>

        <PasswordField
          id="current-password"
          label="Current password"
          autoComplete="current-password"
          value={current}
          onChange={setCurrent}
          invalid={Boolean(error)}
        />
        <PasswordField
          id="new-password"
          label="New password"
          autoComplete="new-password"
          value={next}
          onChange={setNext}
        />
        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          invalid={mismatch}
        />

        {mismatch && (
          <p className="auth__error" role="alert">
            Passwords don&apos;t match. Type the same password in both fields.
          </p>
        )}
        {error && (
          <p className="auth__error" role="alert">
            {error}
          </p>
        )}

        <PasswordRequirements password={next} />

        <button className="btn-primary" type="submit" disabled={!canSubmit}>
          {loading ? 'Updating…' : 'Update password'}
        </button>

        <div className="auth__links">
          <button type="button" className="auth__link" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
