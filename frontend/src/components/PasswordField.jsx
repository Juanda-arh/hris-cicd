import { useState } from 'react';

// Underlined password field with its own Show/Hide toggle.
export default function PasswordField({ id, label, value, onChange, autoComplete, invalid = false }) {
  const [show, setShow] = useState(false);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field__row">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
        />
        <button
          type="button"
          className="field__toggle"
          onClick={() => setShow((v) => !v)}
          aria-pressed={show}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );
}
