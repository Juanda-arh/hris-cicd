import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { downloadMyReceipts, getReceiptLink, listMyReceipts, uploadMySocialSecurity } from '../api/myReceiptsApi';
import { PageHeader } from '../components/AppLayout';
import { getErrorMessage } from '../utils/errors';
import { localDate } from '../utils/requests';
import { MAX_PDF_MB, todayIso, validatePdf } from '../utils/timeOff';
import './NewEmployeePage.css';
import './EmployeeProfilePage.css';
import './EmployeeTabs.css';
import './PeoplePage.css';
import './RequestsPage.css';
import './MyPayStubsPage.css';

const PAGE_SIZE = 6;
const pad = (n) => String(n).padStart(2, '0');
const monthKey = (fecha) => fecha.slice(0, 7); // "2026-09"
const monthName = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const shortDate = (fecha) => localDate(fecha).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });

// Social security: the receipt of a month is due on the last day of the next month
function dueDate(key) {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  return new Date(y, m + 1, 0);
}
function previousMonthKey(today) {
  const d = localDate(today);
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`;
}

function DownloadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4.5 20.5h15" /></svg>;
}
function UploadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4.5 20.5h15" /></svg>;
}
function ReplaceIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 8a8 8 0 0 0-14.6-2M4 16a8 8 0 0 0 14.6 2M4 3v4h4M20 21v-4h-4" /></svg>;
}

function Pager({ page, pageCount, total, shown, year, onPage }) {
  if (total === 0) return null;
  return (
    <div className="people__footer">
      <span>Showing {shown} of {total} in {year}</span>
      {pageCount > 1 && (
        <span className="people__pager">
          <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => onPage(page - 1)}>‹</button>
          <span>{page} / {pageCount}</span>
          <button type="button" aria-label="Next page" disabled={page === pageCount} onClick={() => onPage(page + 1)}>›</button>
        </span>
      )}
    </div>
  );
}

/**
 * My pay stubs and social security receipts (employee and leader).
 * tab: 'pay-stubs' (published by HR, download only) | 'social-security' (the person uploads, replaces and downloads)
 */
export default function MyPayStubsPage({ tab }) {
  const kind = tab === 'social-security' ? 'comprobantes-seguridad-social' : 'comprobantes';
  const today = todayIso();
  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [loaded, setLoaded] = useState(null); // { key, list }
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(null); // id or month being processed
  const [zipping, setZipping] = useState(false);

  const key = `${kind}|${year}|${version}`;
  useEffect(() => {
    let active = true;
    listMyReceipts(kind, year)
      .then((list) => { if (active) { setLoaded({ key, list }); setError(''); } })
      .catch((err) => { if (active) { setLoaded({ key, list: [] }); setError(getErrorMessage(err)); } });
    return () => { active = false; };
  }, [kind, year, version, key]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  const list = useMemo(() => (loaded?.key === key ? loaded.list : null), [loaded, key]);

  async function download(id) {
    const tabWindow = window.open('', '_blank'); // opened before the await so the browser does not block it
    setBusy(id);
    try {
      const { url } = await getReceiptLink(kind, id);
      if (tabWindow) tabWindow.location.href = url; else window.location.assign(url);
    } catch (err) {
      tabWindow?.close();
      setToast(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function downloadAll() {
    setZipping(true);
    try {
      await downloadMyReceipts(kind, year);
    } catch (err) {
      setToast(getErrorMessage(err));
    } finally {
      setZipping(false);
    }
  }

  // Years with something to look at: from 5 years back to the current one
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <>
      <PageHeader crumbs={[{ label: 'Pay stubs' }, { label: tab === 'social-security' ? 'Social security receipts' : 'Pay stubs' }]}>
        <label className="ps-year">
          <span className="sr-only">Year</span>
          <select className="btn" value={year} onChange={(e) => { setYear(Number(e.target.value)); setPage(1); }}>
            {years.map((y) => <option key={y} value={y}>Year: {y}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn--dark" disabled={zipping || !list || list.length === 0} onClick={downloadAll}>
          <DownloadIcon /> {zipping ? 'Preparing…' : 'Download all'}
        </button>
      </PageHeader>

      {toast && (
        <div className="toast req-toast" role="status">
          <span>{toast}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setToast('')}>×</button>
        </div>
      )}

      <main className="app__content my-pay">
        <nav className="ps-tabs" aria-label="Pay stubs sections">
          <NavLink to="/pay-stubs" end className={({ isActive }) => `ps-tab${isActive ? ' is-active' : ''}`}>Pay Stubs</NavLink>
          <NavLink to="/pay-stubs/social-security" className={({ isActive }) => `ps-tab${isActive ? ' is-active' : ''}`}>Social Security Receipts</NavLink>
        </nav>

        {error && <p className="profile__alert" role="alert">{error}</p>}

        {tab === 'social-security' ? (
          <SocialSecurity
            list={list}
            year={year}
            today={today}
            page={page}
            onPage={setPage}
            busy={busy}
            setBusy={setBusy}
            onDownload={download}
            onDone={(message) => { setToast(message); setVersion((v) => v + 1); }}
            onError={setToast}
          />
        ) : (
          <PayStubs list={list} year={year} page={page} onPage={setPage} busy={busy} onDownload={download} />
        )}
      </main>
    </>
  );
}

/* ---------- Pay stubs: published by HR, the person can only download them ---------- */
function PayStubs({ list, year, page, onPage, busy, onDownload }) {
  const rows = list || [];
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const latest = rows[0];

  return (
    <div className="ps-layout">
      <section>
        <h1 className="new-employee__title">My pay stubs</h1>
        <p className="new-employee__subtitle">Published by HR. Only you and the HR team can see them.</p>

        {!list && <p className="tab-empty" role="status">Loading pay stubs…</p>}
        {list && rows.length === 0 && (
          <div className="ps-empty">
            <strong>No pay stubs in {year}</strong>
            <span>When HR publishes one, it appears here and you get a notification.</span>
          </div>
        )}
        {rows.length > 0 && (
          <table className="ps-table">
            <thead><tr><th scope="col">Period</th><th scope="col">Published</th><th scope="col">Type</th><th scope="col">File</th><th scope="col" className="align-right">Actions</th></tr></thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td className="ps-table__period">{monthName(monthKey(r.fecha))}</td>
                  <td className="ps-table__date ps-mono">{shortDate(r.fecha)}</td>
                  <td className="ps-table__type">Pay stub</td>
                  <td className="ps-table__file ps-mono">PDF</td>
                  <td className="ps-table__actions">
                    <button type="button" className="req-link" disabled={busy === r.id} onClick={() => onDownload(r.id)}>
                      {busy === r.id ? 'Opening…' : 'Download'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager page={current} pageCount={pageCount} total={rows.length} shown={visible.length} year={year} onPage={onPage} />
      </section>

      <aside className="ps-side">
        {latest && (
          <div className="ps-card">
            <p className="ps-eyebrow">Latest pay stub</p>
            <p className="ps-card__title">{monthName(monthKey(latest.fecha))}</p>
            <dl className="ps-card__facts">
              <div><dt>Published</dt><dd className="ps-mono">{localDate(latest.fecha).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</dd></div>
              <div><dt>File</dt><dd className="ps-mono">PDF</dd></div>
            </dl>
            <button type="button" className="btn btn--orange ps-card__cta" disabled={busy === latest.id} onClick={() => onDownload(latest.id)}>
              <DownloadIcon /> {busy === latest.id ? 'Opening…' : 'Download PDF'}
            </button>
            <p className="ps-note">Pay stub amounts appear inside the PDF, never on screen.</p>
          </div>
        )}
        <div className="ps-certs">
          <p className="ps-eyebrow">Certificates</p>
          <div className="ps-certs__row"><span>Employment certificate</span><Link to="/my-certificates" className="req-link">Request</Link></div>
        </div>
      </aside>
    </div>
  );
}

/* ---------- Social security: one receipt per month, uploaded by the person ---------- */
function SocialSecurity({ list, year, today, page, onPage, busy, setBusy, onDownload, onDone, onError }) {
  const fileRef = useRef(null);
  const [target, setTarget] = useState(null); // month the file chooser is for
  const [dragging, setDragging] = useState(false);
  const dueKey = previousMonthKey(today); // the receipt due now (end of the current month)
  const currentMonth = today.slice(0, 7);

  // One row per month of the year up to the month that is due (a receipt uploaded for a later month also shows)
  const months = useMemo(() => {
    if (!list) return [];
    const byMonth = new Map();
    list.forEach((r) => { if (!byMonth.has(monthKey(r.fecha))) byMonth.set(monthKey(r.fecha), r); }); // newest first
    const lastKey = String(year) < currentMonth.slice(0, 4) ? `${year}-12` : dueKey;
    const keys = new Set([...byMonth.keys()]);
    for (let m = 1; m <= 12; m += 1) {
      const k = `${year}-${pad(m)}`;
      if (k <= lastKey) keys.add(k);
    }
    return [...keys].sort().reverse().map((k) => ({ key: k, receipt: byMonth.get(k) || null }));
  }, [list, year, dueKey, currentMonth]);

  const pageCount = Math.max(1, Math.ceil(months.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = months.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const due = months.find((m) => m.key === dueKey);
  const received = (list || []).length;

  function choose(monthKeyValue) {
    setTarget(monthKeyValue);
    fileRef.current?.click();
  }

  async function upload(file, monthKeyValue) {
    if (!file || !monthKeyValue) return;
    const problem = validatePdf(file);
    if (problem) { onError(problem); return; }
    const existing = months.find((m) => m.key === monthKeyValue)?.receipt;
    setBusy(monthKeyValue);
    try {
      await uploadMySocialSecurity(monthKeyValue, file, existing?.id);
      onDone(`${monthName(monthKeyValue)} receipt ${existing ? 'replaced' : 'uploaded'}. HR can see it now.`);
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const statusOf = (m) => {
    if (m.receipt) return 'received';
    return dueDate(m.key) < localDate(today) ? 'missing' : 'pending';
  };
  const STATUS = { received: 'Received', pending: 'Pending', missing: 'Missing' };

  return (
    <section>
      <h1 className="new-employee__title">My social security receipts</h1>
      <p className="new-employee__subtitle">Upload your monthly social security receipt (PILA). HR reviews it and keeps it in your record.</p>

      {/* The receipt due now (only when the chosen year includes it) */}
      {due && (
        !due.receipt ? (
          <div className="ps-banner">
            <span className="ps-banner__icon" aria-hidden="true"><UploadIcon /></span>
            <span className="ps-banner__text">
              <strong>{monthName(due.key)} receipt <span className="ps-status ps-status--pending">{received === 0 ? 'Not uploaded' : 'Pending'}</span></strong>
              <span>Due {dueDate(due.key).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.</span>
            </span>
            <button type="button" className="btn btn--orange" disabled={busy === due.key} onClick={() => choose(due.key)}>
              <UploadIcon /> {busy === due.key ? 'Uploading…' : 'Upload receipt'}
            </button>
          </div>
        ) : (
          <div className="ps-banner ps-banner--ok">
            <span className="ps-banner__text"><strong>{monthName(due.key)} receipt <span className="ps-status ps-status--received">Received</span></strong><span>You are up to date.</span></span>
          </div>
        )
      )}

      {!list && <p className="tab-empty" role="status">Loading receipts…</p>}
      {list && months.length === 0 && (
        <div className="ps-empty">
          <strong>No receipts yet</strong>
          <span>Upload your social security receipt every month. It is due on the last day of the next month.</span>
        </div>
      )}
      {months.length > 0 && (
        <table className="ps-table ps-table--ss">
          <thead><tr><th scope="col">Period</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col">File</th><th scope="col" className="align-right">Actions</th></tr></thead>
          <tbody>
            {visible.map((m) => {
              const status = statusOf(m);
              return (
                <tr key={m.key}>
                  <td className="ps-table__period">{monthName(m.key)}</td>
                  <td className={`ps-table__date ps-mono${m.receipt ? '' : ' is-empty'}`}>{m.receipt ? shortDate(m.receipt.fecha) : '—'}</td>
                  <td className="ps-table__status"><span className={`ps-status ps-status--${status}`}>{STATUS[status]}</span></td>
                  <td className={`ps-table__file ps-mono${m.receipt ? '' : ' is-empty'}`}>{m.receipt ? 'PDF' : '—'}</td>
                  <td className="ps-table__actions">
                    {m.receipt && (
                      <button type="button" className="req-link" disabled={busy === m.receipt.id} onClick={() => onDownload(m.receipt.id)}>
                        {busy === m.receipt.id ? 'Opening…' : 'Download'}
                      </button>
                    )}
                    <button type="button" className="btn btn--small" disabled={busy === m.key} onClick={() => choose(m.key)}>
                      {m.receipt ? <><ReplaceIcon /> Replace</> : <><UploadIcon /> Upload</>}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <Pager page={current} pageCount={pageCount} total={months.length} shown={visible.length} year={year} onPage={onPage} />

      {due && (
        <div className="ps-upload">
          <p className="to-label">Upload {monthName(due.key)} receipt</p>
          <button
            type="button"
            className={`ps-drop${dragging ? ' is-dragging' : ''}`}
            onClick={() => choose(due.key)}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files[0], due.key); }}
          >
            <UploadIcon />
            <span><strong>Drag your receipt PDF here</strong> or browse · max {MAX_PDF_MB} MB{due.receipt ? ' · replaces the current one' : ''}</span>
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="ps-file" onChange={(e) => { upload(e.target.files[0], target); e.target.value = ''; }} />
      <span className="sr-only" aria-live="polite">{busy ? 'Uploading…' : ''}</span>
    </section>
  );
}
