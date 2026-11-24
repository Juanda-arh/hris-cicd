import { useEffect, useState } from 'react';
import { downloadEmployeeReceipts, getReceiptLink, listEmployeeReceipts } from '../api/employeeRecordsApi';
import { saveFile } from '../api/files';
import { getErrorMessage } from '../utils/errors';
import { formatDate } from '../utils/people';
import './PeoplePage.css';
import './EmployeeTabs.css';

const PAGE_SIZE = 10;

function monthOf(value) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M4.5 20.5h15" />
    </svg>
  );
}

// kind: 'comprobantes' (pay stubs) | 'comprobantes-seguridad-social'. Same endpoints, same screen.
export default function EmployeeReceiptsTab({ employee, kind, title, noun }) {
  const [receipts, setReceipts] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    listEmployeeReceipts(kind, employee.id)
      .then((data) => {
        if (!active) return;
        setReceipts(data);
        setLoadError('');
      })
      .catch((err) => { if (active) setLoadError(getErrorMessage(err)); });
    return () => { active = false; };
  }, [kind, employee.id]);

  // The tab is opened before the request so the browser does not block it as a pop-up
  async function openReceipt(receipt) {
    setError('');
    setBusy(receipt.id);
    const tab = window.open('', '_blank');
    try {
      const { url } = await getReceiptLink(kind, receipt.id);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (err) {
      if (tab) tab.close();
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function downloadAll() {
    setError('');
    setBusy('all');
    try {
      saveFile(await downloadEmployeeReceipts(kind, employee.id));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const list = receipts || [];
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const first = (currentPage - 1) * PAGE_SIZE;
  const rows = list.slice(first, first + PAGE_SIZE);

  return (
    <section aria-labelledby={`${kind}-title`}>
      <div className="tab-section-head tab-section-head--action">
        <h2 id={`${kind}-title`}>{title}</h2>
        {list.length > 0 && (
          <button type="button" className="btn" disabled={busy === 'all'} onClick={downloadAll}>
            <DownloadIcon /> {busy === 'all' ? 'Preparing…' : 'Download all'}
          </button>
        )}
      </div>

      {(loadError || error) && <p className="profile__alert" role="alert">{loadError || error}</p>}
      {!loadError && !receipts && <p className="tab-empty" role="status">Loading {noun}s…</p>}
      {receipts && list.length === 0 && <p className="tab-empty">This employee has no {noun}s yet.</p>}

      {rows.length > 0 && (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">Date</th>
                  <th scope="col">Format</th>
                  <th scope="col" className="align-right">Download</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((receipt) => (
                  <tr key={receipt.id}>
                    <td>{monthOf(receipt.fecha)}</td>
                    <td className="nowrap is-muted">{formatDate(receipt.fecha)}</td>
                    <td className="is-muted">PDF</td>
                    <td className="align-right">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Open the ${noun} of ${monthOf(receipt.fecha)}`}
                        disabled={busy === receipt.id}
                        onClick={() => openReceipt(receipt)}
                      >
                        <DownloadIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="people__footer">
            <span>Showing {first + 1}–{first + rows.length} of {list.length}</span>
            {pageCount > 1 && (
              <span className="people__pager">
                <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button>
                <span>{currentPage} / {pageCount}</span>
                <button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>›</button>
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
