import { useEffect, useRef } from 'react';

// Native <dialog>: gives us the backdrop, Esc to close and focus kept inside.
export default function Modal({ title, eyebrow, subtitle, onClose, children, footer }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal__stripes" aria-hidden="true"><span /><span /><span /></div>
      <div className="modal__head">
        <div>
          {eyebrow && <p className="modal__eyebrow">{eyebrow}</p>}
          <h2 id="modal-title" className="modal__title">{title}</h2>
          {subtitle && <p className="modal__subtitle">{subtitle}</p>}
        </div>
        <button type="button" className="modal__close" aria-label="Close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="modal__body">{children}</div>
      <div className="modal__foot">{footer}</div>
    </dialog>
  );
}
