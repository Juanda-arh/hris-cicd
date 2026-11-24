import { useRef } from 'react';
import { ReplaceIcon } from '../Icons';

// Botón que abre un selector de PDF oculto
function FileButton({ onFile, className, disabled, title, children }) {
  const inputRef = useRef(null);

  function handleChange(e) {
    const file = e.target.files[0];
    if (file) onFile(file);
    e.target.value = '';
  }

  return (
    <>
      <button className={className} disabled={disabled} title={title} onClick={() => inputRef.current?.click()}>
        {children}
      </button>
      <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={handleChange} />
    </>
  );
}

// "View" si ya hay archivo, "Upload" si está pendiente
export function PrimaryLink({ hasFile, canUpload, busy, onView, onUpload }) {
  if (hasFile) {
    return (
      <button className="link" disabled={busy} onClick={onView}>
        View
      </button>
    );
  }
  return (
    <FileButton
      className="link"
      disabled={busy || !canUpload}
      title={canUpload ? undefined : 'This employee has no access user yet'}
      onFile={onUpload}
    >
      Upload
    </FileButton>
  );
}

export function ReplaceButton({ disabled, onReplace }) {
  return (
    <FileButton className="btn btn--outline btn--replace" disabled={disabled} onFile={onReplace}>
      <ReplaceIcon /> Replace
    </FileButton>
  );
}
