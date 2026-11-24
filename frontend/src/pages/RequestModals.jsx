import { useEffect, useState } from 'react';
import { askForSupportingDocument, decideRequest, getRequest, getSupportingDocumentLink } from '../api/requestsApi';
import { ErrorIcon } from '../components/FormField';
import Modal from '../components/Modal';
import { getErrorMessage } from '../utils/errors';
import { formatTimestamp, initials } from '../utils/people';
import { STATUS_LABELS, TYPE_LABELS, formatRange } from '../utils/requests';
import RequestCalendar from './RequestCalendar';

const MAX_COMMENT = 255;

export function RequestStatus({ status }) {
  return <span className={`req-status req-status--${status.toLowerCase()}`}>{STATUS_LABELS[status] || status}</span>;
}

// Textarea with a character counter, used for comments and messages
function TextArea({ id, label, required, value, onChange, error, hint, placeholder }) {
  return (
    <div className={`form-field${error ? ' has-error' : ''}`}>
      <div className="req-field-head">
        <label htmlFor={id}>
          {label}
          {required ? <span className="form-field__required" aria-hidden="true"> *</span> : <span className="req-optional"> (optional)</span>}
        </label>
        <span className="char-count" aria-hidden="true">{value.length} / {MAX_COMMENT}</span>
      </div>
      <textarea
        id={id}
        rows={3}
        maxLength={MAX_COMMENT}
        value={value}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error
        ? <p id={`${id}-error`} className="form-field__error"><ErrorIcon />{error}</p>
        : hint && <p id={`${id}-hint`} className="form-field__hint">{hint}</p>}
    </div>
  );
}

function PersonCard({ request, employee }) {
  return (
    <div className="person-card">
      <span className="person-card__photo" aria-hidden="true">{initials(request.empleado_nombre)}</span>
      <span className="person-card__text">
        <strong>{request.empleado_nombre}</strong>
        <span>{[employee?.cargo, `Requested ${formatTimestamp(request.creado_en)}`].filter(Boolean).join(' · ')}</span>
      </span>
      <RequestStatus status={request.estado} />
    </div>
  );
}

// Full request: reason, supporting document and the actions the admin can take on it
// readOnly: only shows the request (e.g. a leader looking at their own request, which they cannot decide)
export function RequestDetailModal({ requestId, employee, leader, team, readOnly = false, onClose, onDone, onReject, onAskDocument }) {
  const [request, setRequest] = useState(null);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let active = true;
    getRequest(requestId)
      .then((data) => { if (active) setRequest(data); })
      .catch((err) => { if (active) setError(getErrorMessage(err)); });
    return () => { active = false; };
  }, [requestId]);

  async function approve() {
    setSaving(true);
    setError('');
    try {
      await decideRequest(request.id, 'Aprobado', comment);
      onDone(`The request of ${request.empleado_nombre} was approved.`);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  }

  async function openDocument() {
    // The tab is opened before the await so the browser does not block it
    const tab = window.open('', '_blank');
    setOpening(true);
    setError('');
    try {
      const { url } = await getSupportingDocumentLink(request.id);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (err) {
      tab?.close();
      setError(getErrorMessage(err));
    } finally {
      setOpening(false);
    }
  }

  const pending = !readOnly && request?.estado === 'Pendiente';
  const canAskDocument = !readOnly && request && ['Pendiente', 'Aprobado'].includes(request.estado);

  return (
    <Modal
      title={request ? `${TYPE_LABELS[request.tipo] || request.tipo} request` : 'Request'}
      eyebrow={request ? `Request #${request.id}` : undefined}
      onClose={onClose}
      footer={(
        <>
          {canAskDocument && (
            <button type="button" className="btn req-foot-left" disabled={saving} onClick={() => onAskDocument(request)}>
              Ask for document
            </button>
          )}
          {pending ? (
            <>
              <button type="button" className="btn" disabled={saving} onClick={() => onReject(request, comment)}>Reject</button>
              <button type="button" className="btn btn--dark" disabled={saving} onClick={approve}>
                {saving ? 'Approving…' : 'Approve'}
              </button>
            </>
          ) : (
            <button type="button" className="btn" onClick={onClose}>Close</button>
          )}
        </>
      )}
    >
      {error && <p className="profile__alert" role="alert">{error}</p>}
      {!request && !error && <p className="tab-empty" role="status">Loading request…</p>}

      {request && (
        <div className="modal-form">
          <PersonCard request={request} employee={employee} />

          <dl className="req-detail">
            <div><dt>Type</dt><dd>{TYPE_LABELS[request.tipo] || request.tipo}</dd></div>
            <div><dt>Dates</dt><dd className="req-mono">{formatRange(request.fecha_inicio, request.fecha_fin)}</dd></div>
            <div><dt>Business days</dt><dd className="req-mono">{request.dias_habiles}</dd></div>
            <div><dt>Leader</dt><dd>{leader?.nombre || '—'}</dd></div>
            <div className="req-detail--wide"><dt>Reason</dt><dd>{request.motivo || '—'}</dd></div>
            {request.estado !== 'Pendiente' && request.fecha_decision && (
              <div className="req-detail--wide">
                <dt>Decision</dt>
                <dd>
                  {STATUS_LABELS[request.estado]} on {formatTimestamp(request.fecha_decision)}
                  {request.comentario_decision && <span className="req-detail__note">“{request.comentario_decision}”</span>}
                </dd>
              </div>
            )}
            <div className="req-detail--wide">
              <dt>Supporting document</dt>
              <dd className="req-doc">
                {request.tiene_soporte ? (
                  <>
                    <span>PDF uploaded {formatTimestamp(request.soporte_subido_en)}</span>
                    <button type="button" className="btn btn--small" disabled={opening} onClick={openDocument}>
                      {opening ? 'Opening…' : 'Download PDF'}
                    </button>
                  </>
                ) : (
                  <span>None</span>
                )}
                {request.soporte_pendiente && (
                  <span className="req-detail__note">
                    Requested {formatTimestamp(request.soporte_solicitado_en)}, not uploaded yet
                    {request.soporte_solicitud_mensaje ? `: “${request.soporte_solicitud_mensaje}”` : ''}
                  </span>
                )}
              </dd>
            </div>
          </dl>

          {team && <RequestCalendar request={request} team={team} />}

          {pending && (
            <TextArea
              id="decision-comment"
              label="Comment for the employee"
              value={comment}
              onChange={setComment}
              hint="Sent with the decision by email and in their notifications."
            />
          )}
        </div>
      )}
    </Modal>
  );
}

export function RejectModal({ request, employee, initialComment = '', onClose, onDone }) {
  const [comment, setComment] = useState(initialComment);
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function reject() {
    if (!comment.trim()) {
      setFieldError('Enter the reason for the rejection');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await decideRequest(request.id, 'Rechazado', comment);
      onDone(`The request of ${request.empleado_nombre} was rejected.`);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Reject request?"
      subtitle="The employee is notified and can send a new request."
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn" disabled={saving} onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--orange" disabled={saving} onClick={reject}>
            {saving ? 'Rejecting…' : 'Reject request'}
          </button>
        </>
      )}
    >
      <div className="modal-form">
        {error && <p className="profile__alert" role="alert">{error}</p>}
        <PersonCard request={request} employee={employee} />
        <TextArea
          id="reject-reason"
          label="Rejection reason"
          required
          value={comment}
          onChange={(value) => { setComment(value); setFieldError(''); }}
          error={fieldError}
          hint="Write it for the employee: they will read it exactly as you wrote it."
        />
      </div>
    </Modal>
  );
}

// Asks the employee for the supporting PDF (e.g. a medical certificate)
export function AskDocumentModal({ request, onClose, onDone }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function send() {
    setSaving(true);
    setError('');
    try {
      await askForSupportingDocument(request.id, message);
      onDone(`${request.empleado_nombre} was asked for the supporting document.`);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Supporting document"
      title="Ask for a document"
      subtitle={`${request.empleado_nombre} gets a notification in the portal and can upload the PDF to this request. It does not block approving or rejecting it.`}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn" disabled={saving} onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--dark" disabled={saving} onClick={send}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z" />
            </svg>
            {saving ? 'Sending…' : 'Send'}
          </button>
        </>
      )}
    >
      <div className="modal-form">
        {error && <p className="profile__alert" role="alert">{error}</p>}
        {request.soporte_pendiente && (
          <p className="note">A document was already requested. Sending again updates the date and the message.</p>
        )}
        <TextArea
          id="document-message"
          label="What document do you need?"
          value={message}
          onChange={setMessage}
          placeholder="E.g. the medical certificate for 02 Oct"
        />
      </div>
    </Modal>
  );
}
