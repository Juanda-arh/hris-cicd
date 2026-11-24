export function ErrorIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7v6M12 16.5v.01" />
    </svg>
  );
}

// Label + control + hint or error. The control comes as a render function so it gets the ids it needs.
export default function Field({ id, label, required = false, hint, error, wide = false, children }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`form-field${wide ? ' form-field--wide' : ''}${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && <span className="form-field__required" aria-hidden="true"> *</span>}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy, required })}
      {error
        ? <p id={`${id}-error`} className="form-field__error"><ErrorIcon />{error}</p>
        : hint && <p id={`${id}-hint`} className="form-field__hint">{hint}</p>}
    </div>
  );
}
