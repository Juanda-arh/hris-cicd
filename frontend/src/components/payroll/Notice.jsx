// Mensaje de resultado (éxito / aviso / error) con botón para cerrarlo
export default function Notice({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className={`notice notice--${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
      <div>
        <p>{notice.text}</p>
        {notice.details?.length > 0 && (
          <ul className="notice__details">
            {notice.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" className="notice__close" onClick={onClose} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
