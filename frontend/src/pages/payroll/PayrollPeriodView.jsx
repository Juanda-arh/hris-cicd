import { useState } from 'react';
import { PageHeader } from '../../components/AppLayout';
import PayrollTabs from '../../components/payroll/PayrollTabs';
import PeriodSelect from '../../components/payroll/PeriodSelect';
import ProgressCard from '../../components/payroll/ProgressCard';
import BulkUpload from '../../components/payroll/BulkUpload';
import PreviousPeriods from '../../components/payroll/PreviousPeriods';
import DocumentTable from '../../components/payroll/DocumentTable';
import Pagination from '../../components/payroll/Pagination';
import Notice from '../../components/payroll/Notice';
import { DownloadIcon } from '../../components/Icons';
import usePagination from '../../hooks/usePagination';
import usePayrollPeriod from '../../hooks/usePayrollPeriod';
import usePeriodParam from '../../hooks/usePeriodParam';
import { bulkUpload, downloadAll, getReceiptLink, replaceReceipt, uploadForEmployee } from '../../api/payrollApi';
import { periodKey } from '../../utils/period';
import { getErrorMessage } from '../../utils/errors';
import './Payroll.css';

// Resume el reporte de la carga masiva en un aviso
function bulkNotice(report) {
  const details = [
    ...(report.empleadoNoEncontrado ?? []).map((f) => `${f}: no employee with that username`),
    ...(report.rechazados ?? []).map((f) => `${f}: rejected (not a PDF or ZIP, or no username)`),
    ...(report.errores ?? []).map((e) => `${e.archivo}: ${e.motivo}`),
    ...(report.avisos ?? []).map((e) => `${e.archivo}: ${e.motivo}`),
  ];
  const ok = report.asignados === report.totalRecibidos;
  return {
    type: ok ? 'success' : 'warning',
    text: `${report.asignados} of ${report.totalRecibidos} file(s) assigned.`,
    details,
  };
}

/**
 * Plantilla compartida por "Pay Stubs" y "Social Security Receipts".
 * kind: 'comprobantes' | 'comprobantes-seguridad-social'
 */
export default function PayrollPeriodView({ kind, copy, columns, meta, progress, pendingReceipts }) {
  const [period, setPeriod] = usePeriodParam();
  const { loading, error, rows, previous, done, total, reload } = usePayrollPeriod(kind, period);
  const { page, setPage, totalPages, pageItems } = usePagination(rows, 6);
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fecha = periodKey(period); // "YYYY-MM": el backend lo guarda como día 01 del mes

  async function run(id, action, successText) {
    setBusyId(id);
    setNotice(null);
    try {
      const result = await action();
      if (result?.asignados === 0) setNotice(bulkNotice(result));
      else if (successText) setNotice({ type: 'success', text: successText });
      await reload();
    } catch (err) {
      setNotice({ type: 'error', text: getErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  }

  async function handleView(row) {
    // Se abre la pestaña antes del await para que el navegador no la bloquee
    const win = window.open('', '_blank');
    try {
      const { url } = await getReceiptLink(kind, row.receipt.id);
      if (win) win.location.href = url;
      else window.location.assign(url);
    } catch (err) {
      win?.close();
      setNotice({ type: 'error', text: getErrorMessage(err) });
    }
  }

  async function handleBulk(files) {
    if (files.length === 0) {
      setNotice({ type: 'warning', text: 'No files found in the selection.' });
      return;
    }
    setBulkBusy(true);
    setNotice(null);
    try {
      setNotice(bulkNotice(await bulkUpload(kind, files, fecha)));
      await reload();
    } catch (err) {
      const report = err.response?.data?.reporte;
      setNotice(report ? { ...bulkNotice(report), type: 'error' } : { type: 'error', text: getErrorMessage(err) });
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    setNotice(null);
    try {
      await downloadAll(kind, period);
    } catch (err) {
      // responseType blob: el error JSON llega como Blob
      let text = getErrorMessage(err);
      const blob = err.response?.data;
      if (blob instanceof Blob) {
        try {
          text = JSON.parse(await blob.text()).error || text;
        } catch {
          /* respuesta no JSON */
        }
      }
      setNotice({ type: 'error', text });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <PageHeader crumbs={[{ label: 'Payroll', to: '/payroll' }, { label: copy.crumb }]}>
        <span className="payroll payroll__actions">
          <PeriodSelect value={period} onChange={setPeriod} />
          <button className="btn btn--outline" onClick={handleDownload} disabled={downloading || done === 0}>
            <DownloadIcon /> {downloading ? 'Preparing…' : 'Download'}
          </button>
        </span>
      </PageHeader>

      <main className="app__content payroll">

      <PayrollTabs pendingReceipts={pendingReceipts} />

      <section className="intro">
        <h1>{copy.title(period)}</h1>
        <p className="muted">{copy.description}</p>
      </section>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      {error ? (
        <div className="state-box">
          <p>{error}</p>
          <button className="btn btn--outline" onClick={reload}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <section className="summary">
            <ProgressCard
              done={done}
              total={total}
              verb={progress.verb}
              footLeft={progress.footLeft(period)}
              accent={progress.accent}
              loading={loading}
            />
            <BulkUpload
              onFiles={handleBulk}
              onError={(text) => setNotice({ type: 'error', text })}
              busy={bulkBusy}
            />
            <PreviousPeriods periods={previous} onSelect={setPeriod} />
          </section>

          {loading && rows.length === 0 ? (
            <p className="state-box muted">Loading employees…</p>
          ) : rows.length === 0 ? (
            <p className="state-box muted">There are no active employees.</p>
          ) : (
            <>
              <DocumentTable
                rows={pageItems}
                columns={columns}
                statusLabel={copy.statusLabel}
                doneStatus={copy.doneStatus}
                meta={meta}
                busyId={busyId}
                onView={handleView}
                onUpload={(row, file) =>
                  run(row.id, () => uploadForEmployee(kind, row.usuario, file, fecha), `Uploaded for ${row.nombre}.`)
                }
                onReplace={(row, file) =>
                  run(row.id, () => replaceReceipt(kind, row.receipt.id, file), `Replaced for ${row.nombre}.`)
                }
              />
              <Pagination
                page={page}
                totalPages={totalPages}
                onChange={setPage}
                shown={pageItems.length}
                total={rows.length}
              />
            </>
          )}
        </>
      )}
      </main>
    </>
  );
}
