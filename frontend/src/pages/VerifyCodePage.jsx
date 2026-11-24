import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { verifyOtp } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';
import AuthLayout from '../components/AuthLayout';
import OtpInput from '../components/OtpInput';

export default function VerifyCodePage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { personaId, remember } = useLocation().state ?? {};

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Opened directly (or after a reload): there is no pending login, start over
  if (!personaId) return <Navigate to="/login" replace />;

  const canSubmit = code.length === 6 && !loading;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setError('');
    setLoading(true);
    try {
      const data = await verifyOtp(personaId, code);
      const user = login(data.token, Boolean(remember));
      navigate(user.debeCambiarClave ? '/change-password' : '/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <form className="auth__form" onSubmit={handleSubmit} noValidate>
        <p className="auth__label-top">Two-step verification</p>
        <h2 className="auth__title auth__title--tight">Enter your code.</h2>
        <p className="auth__subtitle">
          We sent a 6-digit code to your email. It expires in 5 minutes.
        </p>

        <div className="field" role="group" aria-labelledby="otp-label">
          <span id="otp-label" className="field__label">
            Verification code
          </span>
          <OtpInput value={code} onChange={setCode} invalid={Boolean(error)} autoFocus />
        </div>

        {error && (
          <p className="auth__error" role="alert">
            {error}
          </p>
        )}

        <button className="btn-primary" type="submit" disabled={!canSubmit}>
          {loading ? 'Verifying…' : 'Verify and sign in'}
        </button>

        <div className="auth__links">
          <button type="button" className="auth__link" onClick={() => navigate('/login', { replace: true })}>
            Back to sign in
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
