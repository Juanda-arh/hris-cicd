import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { forgotPassword, resetPassword } from '../api/authApi';
import { getErrorMessage } from '../utils/errors';
import { meetsAllRules } from '../utils/passwordRules';
import AuthLayout from '../components/AuthLayout';
import OtpInput from '../components/OtpInput';
import PasswordField from '../components/PasswordField';
import PasswordRequirements from '../components/PasswordRequirements';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 45;

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M21 3 3 10.5l7 2.5 2.5 7L21 3Z" strokeLinejoin="round" />
      <path d="M10 13 21 3" />
    </svg>
  );
}

function formatCountdown(seconds) {
  return `0:${String(seconds).padStart(2, '0')}`;
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  // 'email' = ask for the email · 'reset' = code + new password
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);

  const [code, setCode] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const [error, setError] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  // Countdown before the code can be requested again
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const validEmail = EMAIL_PATTERN.test(email.trim());
  const formatError = touched && email.trim() !== '' && !validEmail;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSend = validEmail && !loading;
  const canReset =
    code.length === 6 && meetsAllRules(next) && next === confirm && !loading;

  async function handleSendCode(e) {
    e.preventDefault();
    if (!canSend) return;

    setError('');
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setStep('reset');
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || loading) return;

    setError('');
    setCodeError(false);
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setCode('');
      setNotice('A new code was sent. The previous one no longer works.');
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    if (!canReset) return;

    setError('');
    setCodeError(false);
    setNotice('');
    setLoading(true);
    try {
      await resetPassword(email.trim(), code, next, confirm);
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch (err) {
      if (err.response?.status === 401) {
        setCodeError(true);
        setError('The code is incorrect or expired. Check it or request a new one.');
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  function handleChangeEmail() {
    setStep('email');
    setCode('');
    setNext('');
    setConfirm('');
    setCooldown(0);
    setError('');
    setCodeError(false);
    setNotice('');
  }

  if (step === 'reset') {
    return (
      <AuthLayout>
        <form className="auth__form" onSubmit={handleReset} noValidate>
          <p className="auth__label-top">Reset password</p>
          <h2 className="auth__title auth__title--tight">Enter the code and your new password.</h2>
          <p className="auth__subtitle">
            We sent a 6-digit code to <strong>{email.trim()}</strong>. It expires in 5 minutes.
          </p>

          <div className="field" role="group" aria-labelledby="otp-label">
            <span id="otp-label" className="field__label">
              Verification code
            </span>
            <OtpInput
              value={code}
              onChange={(v) => {
                setCode(v);
                setCodeError(false);
                setError('');
              }}
              invalid={codeError}
              autoFocus
            />
            <p className="resend">
              Didn&apos;t get it?{' '}
              <button
                type="button"
                className="auth__link"
                onClick={handleResend}
                disabled={cooldown > 0 || loading}
              >
                Resend code
              </button>
              {cooldown > 0 && <span className="resend__wait">available in {formatCountdown(cooldown)}</span>}
            </p>
          </div>

          <PasswordField
            id="reset-new-password"
            label="New password"
            autoComplete="new-password"
            value={next}
            onChange={setNext}
          />
          <PasswordField
            id="reset-confirm-password"
            label="Confirm new password"
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
            invalid={mismatch}
          />

          {notice && (
            <p className="auth__notice" role="status">
              {notice}
            </p>
          )}
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

          <button className="btn-primary" type="submit" disabled={!canReset}>
            {loading ? 'Resetting…' : 'Reset password'}
          </button>

          <div className="auth__links">
            <button type="button" className="auth__link" onClick={handleChangeEmail}>
              Use a different email
            </button>
            <button type="button" className="auth__link" onClick={() => navigate('/login')}>
              Back to sign in
            </button>
          </div>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form className="auth__form" onSubmit={handleSendCode} noValidate>
        <p className="auth__label-top">Forgot password</p>
        <h2 className="auth__title auth__title--tight">Reset your password.</h2>
        <p className="auth__subtitle">
          Enter the email you use to sign in. We&apos;ll send you a 6-digit verification code to
          create a new password.
        </p>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={formatError || Boolean(error)}
          />
        </div>

        {formatError && (
          <p className="auth__error" role="alert">
            Enter a valid email address, e.g. name@example.com
          </p>
        )}
        {error && (
          <p className="auth__error" role="alert">
            {error}
          </p>
        )}

        <button className="btn-primary" type="submit" disabled={!canSend}>
          <SendIcon />
          {loading ? 'Sending…' : 'Send code'}
        </button>

        <p className="auth__note">
          If the email is registered, the code arrives in a few minutes. Check your spam folder too.
        </p>

        <div className="auth__links">
          <button type="button" className="auth__link" onClick={() => navigate('/login')}>
            Back to sign in
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
