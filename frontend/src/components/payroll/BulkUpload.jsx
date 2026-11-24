import { useRef, useState } from 'react';
import { UploadIcon } from '../Icons';

// Archivos que el sistema operativo pone en una carpeta: no son del usuario y no deben contar en el reporte
const SYSTEM_FILES = ['desktop.ini', 'thumbs.db'];
const isSystemFile = (f) => f.name.startsWith('.') || SYSTEM_FILES.includes(f.name.toLowerCase());

async function readEntry(entry) {
  if (entry.isFile) {
    return new Promise((resolve, reject) => entry.file((file) => resolve([file]), reject));
  }
  const reader = entry.createReader();
  const files = [];
  // readEntries entrega por lotes (100 en Chrome): se repite hasta que devuelva uno vacío
  for (;;) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) return files;
    for (const child of batch) files.push(...(await readEntry(child)));
  }
}

// Lo soltado puede traer carpetas, que dataTransfer.files no recorre
async function filesFromDrop(dataTransfer) {
  // las entradas se deben leer antes del primer await: después el navegador vacía dataTransfer
  const entries = Array.from(dataTransfer.items ?? [])
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean);
  if (entries.length === 0) return Array.from(dataTransfer.files);

  const groups = await Promise.all(entries.map(readEntry));
  return groups.flat();
}

// Carga masiva: una carpeta, un .zip o varios PDF. Cada PDF debe empezar por el usuario del empleado ("laura.gomez septiembre.pdf").
export default function BulkUpload({ onFiles, onError, busy }) {
  const filesRef = useRef(null);
  const folderRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  // El backend reporta lo que no sea PDF: así el admin ve qué archivos de la carpeta no se tomaron
  function handle(fileList) {
    onFiles(Array.from(fileList ?? []).filter((f) => !isSystemFile(f)));
  }

  function handleInput(e) {
    handle(e.target.files);
    e.target.value = '';
  }

  async function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    try {
      handle(await filesFromDrop(e.dataTransfer));
    } catch {
      onError('Could not read the dropped files. Please try again.');
    }
  }

  return (
    <div className="bulk">
      <p className="eyebrow">Bulk upload</p>
      <button
        type="button"
        className={`dropzone ${dragging ? 'is-dragging' : ''}`}
        disabled={busy}
        onClick={() => filesRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <UploadIcon />
        {busy ? (
          <span>Uploading…</span>
        ) : (
          <span>
            <strong>Drag a folder, ZIP or PDFs</strong> named by username
          </span>
        )}
      </button>
      <div className="bulk__actions">
        <button type="button" className="btn btn--outline" disabled={busy} onClick={() => folderRef.current?.click()}>
          Select folder
        </button>
        <button type="button" className="btn btn--outline" disabled={busy} onClick={() => filesRef.current?.click()}>
          Select ZIP or PDFs
        </button>
      </div>
      <input
        ref={filesRef}
        type="file"
        accept="application/pdf,.pdf,application/zip,application/x-zip-compressed,.zip"
        multiple
        hidden
        onChange={handleInput}
      />
      <input ref={folderRef} type="file" webkitdirectory="" multiple hidden onChange={handleInput} />
    </div>
  );
}
