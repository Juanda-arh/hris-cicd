import { useEffect, useState } from 'react';
import {
  cancelCertificate,
  getMyPositions,
  getMyProfile,
  getSignedCertificateUrl,
  listMyCertificates,
  requestCertificate,
} from '../api/selfServiceApi';
import { PageHeader } from '../components/AppLayout';
import { ErrorIcon } from '../components/FormField';
import Logo from '../components/Logo';
import Modal from '../components/Modal';
import { getErrorMessage } from '../utils/errors';
import { formatDate, formatId, formatMoney, positionSummary } from '../utils/people';
import './EmployeeProfilePage.css';
import './CertificatesPage.css';
import './EmployeeTabs.css';
import './PeoplePage.css';
import './SelfService.css';

const STATUS = {
  Pendiente: { label: 'In review', tone: 'pendiente' },
  Aprobado: { label: 'Approved', tone: 'aprobado' },
  Rechazado: { label: 'Rejected', tone: 'rechazado' },
  Cancelado: { label: 'Cancelled', tone: 'cancelado' },
};

const STEPS = [
  'You request it with today’s details',
  'HR signs it or tells you why not',
  'It arrives by email and stays here to download',
];

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 11v6M12 7.5v.01" />
    </svg>
  );
}

function Status({ estado }) {
  const s = STATUS[estado] || { label: estado, tone: 'cancelado' };
  return <span className={`cert-status cert-status--${s.tone}`}>{s.label}</span>;
}

async function loadAll() {
  const [requests, me, positions] = await Promise.all([listMyCertificates(), getMyProfile(), getMyPositions()]);
  return { requests, me, positions };
}

export default function MyCertificatesPage() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(null); // 'request' | { cancel: request }
  const [working, setWorking] = useState(false);
  const [modalError, setModalError] = useState('');
  const [toast, setToast] = useState('');
  const [actionError, setActionError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    loadAll()
      .then((result) => { if (active) setData(result); })
      .catch((err) => {
        if (!active) return;
        setLoadError(err.response?.status === 404 || err.response?.status === 403
          ? 'Employment certificates are for employees: your account has no employee record.'
          : getErrorMessage(err));
      });
    return () => { active = false; };
  }, [version]);

  const crumbs = [{ label: 'My certificates' }];

  if (loadError || !data) {
    return (
      <>
        <PageHeader crumbs={crumbs} />
        <main className="app__content">
          {loadError
            ? <p className="profile__alert" role="alert">{loadError}</p>
            : <p className="profile__loading" role="status">Loading your certificates…</p>}
        </main>
      </>
    );
  }

  const { requests, me, positions } = data;
  const { current, hireDate } = positionSummary(positions);
  const pending = requests.find((r) => r.estado === 'Pendiente');
  const canRequest = !pending && Boolean(current) && me.estado !== 'Inactivo';
  const blockedReason = pending
    ? 'You already have a pending request'
    : !current
      ? 'You need a current position first — ask HR'
      : me.estado === 'Inactivo' ? 'Inactive employees cannot request one' : '';

  function openModal(next) {
    setModalError('');
    setModal(next);
  }

  async function send() {
    setWorking(true);
    setModalError('');
    try {
      await requestCertificate();
      setModal(null);
      setToast('Your request was sent. HR will review it and you will get an email when it is ready.');
      setVersion((v) => v + 1);
    } catch (err) {
      setModalError(getErrorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  async function cancel(request) {
    setWorking(true);
    setModalError('');
    try {
      await cancelCertificate(request.id);
      setModal(null);
      setToast('Your request was cancelled.');
      setVersion((v) => v + 1);
    } catch (err) {
      setModalError(getErrorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  async function download(request) {
    setActionError('');
    // Opened right away so the browser does not block it; it is pointed to the file when the link arrives
    const tab = window.open('', '_blank');
    try {
      const url = await getSignedCertificateUrl(request.id);
      if (tab) tab.location.replace(url);
      else window.location.assign(url);
    } catch (err) {
      if (tab) tab.close();
      setActionError(`The certificate could not be downloaded: ${getErrorMessage(err)}`);
    }
  }

  return (
    <>
      <PageHeader crumbs={crumbs} />

      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setToast('')}>×</button>
        </div>
      )}

      <main className="app__content self-cert">
        <div className="self-cert__head">
          <div>
            <h1 className="self__title">Employment certificates</h1>
            <p className="self__subtitle">Request your certificate; HR signs it and sends it to you by email.</p>
          </div>
          <div className="self-cert__request">
            <button type="button" className="btn btn--dark" disabled={!canRequest} onClick={() => openModal('request')}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Request certificate
            </button>
            {blockedReason && <span>{blockedReason}</span>}
          </div>
        </div>

        <ol className="self-cert__steps" aria-label="How it works">
          {STEPS.map((text, i) => (
            <li key={text}><span className="self-cert__step-n">{i + 1}</span>{text}</li>
          ))}
        </ol>

        {pending && (
          <div className="self-cert__pending" role="status">
            <div>
              <strong>Your request is under review</strong>
              <span>Sent {formatDate(pending.fecha_solicitud)}{current ? ` · ${current.cargo}` : ''} · HR will email you when it is signed.</span>
            </div>
            <button type="button" className="btn" onClick={() => openModal({ cancel: pending })}>Cancel request</button>
          </div>
        )}

        {actionError && <p className="profile__alert" role="alert">{actionError}</p>}

        <section aria-labelledby="requests-title">
          <h2 id="requests-title" className="self-cert__title">My requests</h2>
          {requests.length === 0
            ? <p className="self__empty">You have not requested any certificate yet.</p>
            : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Requested</th>
                      <th scope="col">Certificate</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="align-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r.id}>
                        <td className="nowrap self__mono">{formatDate(r.fecha_solicitud)}</td>
                        <td>
                          Employment certificate
                          <span className="cell-note">
                            {r.estado === 'Rechazado' && r.motivo_rechazo
                              ? `Reason: ${r.motivo_rechazo}`
                              : r.estado === 'Cancelado'
                                ? 'You cancelled it'
                                : r.fecha_respuesta ? `Answered ${formatDate(r.fecha_respuesta)}` : 'Waiting for HR'}
                          </span>
                        </td>
                        <td><Status estado={r.estado} /></td>
                        <td className="align-right nowrap">
                          {r.estado === 'Aprobado' && <button type="button" className="btn btn--small" onClick={() => download(r)}>Download signed</button>}
                          {r.estado === 'Pendiente' && <button type="button" className="btn btn--small btn--text" onClick={() => openModal({ cancel: r })}>Cancel</button>}
                          {(r.estado === 'Rechazado' || r.estado === 'Cancelado') && <span className="self__muted">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </section>
      </main>

      {modal === 'request' && (
        <Modal
          title="Request employment certificate"
          subtitle="Review the details your certificate will include."
          onClose={() => setModal(null)}
          footer={(
            <>
              <button type="button" className="btn" disabled={working} onClick={() => setModal(null)}>Cancel</button>
              <button type="button" className="btn btn--dark" disabled={working} onClick={send}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7z" /></svg>
                {working ? 'Sending…' : 'Send request'}
              </button>
            </>
          )}
        >
          <div className="self-cert__review">
            <dl className="self-cert__details">
              <div><dt>Name</dt><dd>{me.nombre}</dd></div>
              <div><dt>ID number</dt><dd className="self__mono">{formatId(me.cedula)}</dd></div>
              <div><dt>Employed since</dt><dd>{hireDate ? formatDate(hireDate) : '—'}</dd></div>
              <div><dt>Position</dt><dd>{current?.cargo || '—'}</dd></div>
              <div><dt>Monthly salary</dt><dd className="self__mono">{current?.sueldo != null ? `${formatMoney(current.sueldo)} USD` : '—'}</dd></div>
            </dl>
            <figure className="self-cert__preview" aria-hidden="true">
              <div className="self-cert__sheet">
                <span className="self-cert__stripes" />
                <span className="self-cert__logo"><Logo name="ms-systems" height={10} /></span>
                <strong>Employment certificate</strong>
                <i /><i /><i /><i /><i className="is-short" />
                <span className="self-cert__stripes self-cert__stripes--foot" />
              </div>
              <figcaption>Format preview</figcaption>
            </figure>
          </div>
          <p className="self__info self__info--blue"><InfoIcon /><span>Today’s details are used. If your position or salary changes later, this request won’t change.</span></p>
          <p className="self-cert__footnote">Is any detail wrong? Email Human Talent before requesting it.</p>
          {modalError && <p className="profile__alert" role="alert"><ErrorIcon /> {modalError}</p>}
        </Modal>
      )}

      {modal?.cancel && (
        <Modal
          title="Cancel this request?"
          subtitle={`Sent ${formatDate(modal.cancel.fecha_solicitud)}. HR will no longer review it; you can request a new one later.`}
          onClose={() => setModal(null)}
          footer={(
            <>
              <button type="button" className="btn" disabled={working} onClick={() => setModal(null)}>Keep it</button>
              <button type="button" className="btn btn--danger" disabled={working} onClick={() => cancel(modal.cancel)}>
                {working ? 'Cancelling…' : 'Cancel request'}
              </button>
            </>
          )}
        >
          {modalError ? <p className="profile__alert" role="alert"><ErrorIcon /> {modalError}</p> : null}
        </Modal>
      )}
    </>
  );
}
