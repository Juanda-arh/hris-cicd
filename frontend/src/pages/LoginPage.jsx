import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { login as loginRequest } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';
import AuthLayout from '../components/AuthLayout';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const passwordReset = useLocation().state?.passwordReset;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password) {
      setError('Enter your username or email and your password.');
      return;
    }

    setLoading(true);
    try {
      const data = await loginRequest(identifier.trim(), password);

      if (data.requiereOtp) {
        navigate('/verify-code', { state: { personaId: data.personaId, remember } });
        return;
      }

      const user = login(data.token, remember);
      navigate(user.debeCambiarClave ? '/change-password' : '/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <form className="auth__form" onSubmit={handleSubmit} noValidate>
        <p className="auth__label-top">Sign in</p>
        <h2 className="auth__title">Welcome back.</h2>

        {passwordReset && (
          <p className="auth__notice" role="status">
            Your password was updated. Sign in with your new password.
          </p>
        )}

        <div className="field">
          <label htmlFor="identifier">User or email</label>
          <input
            id="identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            aria-invalid={Boolean(error)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="field__row">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(error)}
            />
            <button
              type="button"
              className="field__toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && (
          <p className="auth__error" role="alert">
            {error}
          </p>
        )}

        <div className="auth__options">
          <label className="check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span className="check__box" aria-hidden="true" />
            Remember me
          </label>
          <a className="auth__link" href="/forgot-password">
            Forgot your password?
          </a>
        </div>

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in to portal'}
        </button>

        <p className="auth__help">
          Trouble signing in? Email <a href="mailto:admin@msmechanicalllc.com">admin@msmechanicalllc.com</a>
        </p>
      </form>
    </AuthLayout>
  );
}
