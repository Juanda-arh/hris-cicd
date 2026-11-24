import StatusBadge from './StatusBadge';
import { PrimaryLink, ReplaceButton } from './FileAction';

/**
 * Tabla en escritorio y lista de tarjetas en móvil.
 * Cada fila es un empleado con `receipt` (comprobante del periodo) o null.
 * columns: [{ key, label, render(row), className }]: columnas extra entre "Position" y el estado.
 */
export default function DocumentTable({ rows, columns, statusLabel, doneStatus, meta, busyId, onView, onUpload, onReplace }) {
  function actions(row) {
    const hasFile = Boolean(row.receipt);
    const busy = busyId === row.id;
    return {
      status: hasFile ? doneStatus : 'pending',
      link: (
        <PrimaryLink
          hasFile={hasFile}
          canUpload={Boolean(row.usuario)}
          busy={busy}
          onView={() => onView(row)}
          onUpload={(f) => onUpload(row, f)}
        />
      ),
      replace: <ReplaceButton disabled={!hasFile || busy} onReplace={(f) => onReplace(row, f)} />,
    };
  }

  return (
    <>
      <table className="doc-table desktop-only-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Position</th>
            {columns.map((c) => (
              <th key={c.key} className={c.className}>
                {c.label}
              </th>
            ))}
            <th>{statusLabel}</th>
            <th className="right">Replace</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const a = actions(row);
            return (
              <tr key={row.id} className={busyId === row.id ? 'is-busy' : ''}>
                <td>{row.nombre}</td>
                <td>{row.cargo ?? '—'}</td>
                {columns.map((c) => (
                  <td key={c.key} className={c.className}>
                    {c.render(row)}
                  </td>
                ))}
                <td>
                  <div className="status-cell">
                    <StatusBadge status={a.status} />
                    {a.link}
                  </div>
                </td>
                <td className="right">{a.replace}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="doc-cards mobile-only">
        {rows.map((row) => {
          const a = actions(row);
          return (
            <li key={row.id} className={`doc-card ${busyId === row.id ? 'is-busy' : ''}`}>
              <div className="doc-card__top">
                <span className="doc-card__name">{row.nombre}</span>
                <StatusBadge status={a.status} />
              </div>
              <p className="doc-card__meta">{meta(row)}</p>
              <div className="doc-card__actions">
                {a.link}
                {a.replace}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
