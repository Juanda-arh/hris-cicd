import { useEffect, useState } from 'react';
import {
  createEmergencyContact,
  deleteEmergencyContact,
  listEmergencyContacts,
  updateEmergencyContact,
} from '../api/employeesApi';
import Field from '../components/FormField';
import Modal from '../components/Modal';
import { RELATIONSHIPS } from '../utils/employeeForm';
import { getErrorMessage } from '../utils/errors';
import './NewEmployeePage.css';
import './EmployeeTabs.css';

function ContactModal({ personaId, employeeName, contact, onClose, onSaved }) {
  const editing = Boolean(contact);
  const [form, setForm] = useState({
    nombre: contact?.nombre || '',
    parentesco: contact?.parentesco || '',
    telefono: contact?.telefono || '',
    ciudad: contact?.ciudad || '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // A contact saved with another relationship keeps it as an option
  const relationships = form.parentesco && !RELATIONSHIPS.includes(form.parentesco)
    ? [form.parentesco, ...RELATIONSHIPS]
    : RELATIONSHIPS;

  function set(name) {
    return (e) => {
      setForm((values) => ({ ...values, [name]: e.target.value }));
      setErrors((current) => {
        if (!current[name]) return current;
        const rest = { ...current };
        delete rest[name];
        return rest;
      });
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const next = {};
    if (!form.nombre.trim()) next.nombre = 'Enter a name';
    if (!form.parentesco) next.parentesco = 'Select one';
    if (!/^\d{10}$/.test(form.telefono.trim())) next.telefono = 'Enter exactly 10 digits';
    if (!form.ciudad.trim()) next.ciudad = 'Enter a city';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length > 0) return;

    const payload = {
      nombre: form.nombre.trim(),
      parentesco: form.parentesco,
      telefono: form.telefono.trim(),
      ciudad: form.ciudad.trim(),
    };

    setSaving(true);
    try {
      if (editing) await updateEmergencyContact(contact.id, payload);
      else await createEmergencyContact(personaId, payload);
      onSaved(editing ? `${payload.nombre} was updated.` : `${payload.nombre} was added.`);
    } catch (err) {
      setFormError(getErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? 'Edit emergency contact' : 'Add emergency contact'}
      eyebrow={employeeName}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn" disabled={saving} onClick={onClose}>Cancel</button>
          <button type="submit" form="contact-form" className="btn btn--dark" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add contact'}
          </button>
        </>
      )}
    >
      <form id="contact-form" className="modal-form" onSubmit={handleSubmit} noValidate>
        {formError && <p className="profile__alert" role="alert">{formError}</p>}
        <div className="form-grid">
          <Field id="contact-name" label="Name" required wide error={errors.nombre}>
            {(p) => <input {...p} type="text" maxLength={100} autoComplete="off" placeholder="Full name" value={form.nombre} onChange={set('nombre')} />}
          </Field>
          <Field id="contact-relationship" label="Relationship" required error={errors.parentesco}>
            {(p) => (
              <select {...p} value={form.parentesco} onChange={set('parentesco')}>
                <option value="">Select</option>
                {relationships.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            )}
          </Field>
          <Field id="contact-phone" label="Phone" required error={errors.telefono}>
            {(p) => <input {...p} type="tel" inputMode="numeric" maxLength={10} autoComplete="off" placeholder="10 digits" value={form.telefono} onChange={set('telefono')} />}
          </Field>
          <Field id="contact-city" label="City" required wide error={errors.ciudad}>
            {(p) => <input {...p} type="text" maxLength={50} autoComplete="off" value={form.ciudad} onChange={set('ciudad')} />}
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function DeleteModal({ contact, onClose, onDeleted }) {
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      await deleteEmergencyContact(contact.id);
      onDeleted(`${contact.nombre} was deleted.`);
    } catch (err) {
      setError(getErrorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <Modal
      title="Delete emergency contact?"
      subtitle="This contact will be removed from the employee's record."
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn" disabled={deleting} onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--danger" disabled={deleting} onClick={handleDelete}>
            {deleting ? 'Deleting…' : 'Delete contact'}
          </button>
        </>
      )}
    >
      <div className="person-card">
        <span className="person-card__text">
          <strong>{contact.nombre}</strong>
          <span>{contact.parentesco} · {contact.telefono}</span>
        </span>
      </div>
      {error && <p className="profile__alert" role="alert">{error}</p>}
    </Modal>
  );
}

export default function EmployeeContactsTab({ employee, onMessage }) {
  const personaId = employee.persona_id;
  const [loaded, setLoaded] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [version, setVersion] = useState(0);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    let active = true;
    listEmergencyContacts(personaId)
      .then((data) => {
        if (!active) return;
        setLoaded(data);
        setLoadError('');
      })
      .catch((err) => { if (active) setLoadError(getErrorMessage(err)); });
    return () => { active = false; };
  }, [personaId, version]);

  function finished(message) {
    setModal(null);
    setVersion((value) => value + 1);
    onMessage(message);
  }

  return (
    <section aria-labelledby="contacts-title">
      <div className="tab-section-head tab-section-head--action">
        <h2 id="contacts-title">Emergency contacts</h2>
        <button type="button" className="btn btn--dark" onClick={() => setModal({ type: 'add' })}>
          <span aria-hidden="true">+</span> Add contact
        </button>
      </div>

      {loadError && <p className="profile__alert" role="alert">{loadError}</p>}
      {!loadError && !loaded && <p className="tab-empty" role="status">Loading contacts…</p>}
      {loaded && loaded.length === 0 && <p className="tab-empty">This employee has no emergency contacts yet.</p>}

      {loaded && loaded.length > 0 && (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Relationship</th>
                  <th scope="col">Phone</th>
                  <th scope="col">City</th>
                  <th scope="col" className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loaded.map((contact) => (
                  <tr key={contact.id}>
                    <td>{contact.nombre}</td>
                    <td>{contact.parentesco}</td>
                    <td className="nowrap">{contact.telefono}</td>
                    <td>{contact.ciudad}</td>
                    <td className="align-right nowrap">
                      <button type="button" className="icon-button" aria-label={`Edit ${contact.nombre}`} onClick={() => setModal({ type: 'edit', contact })}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4 20h4L19 9l-4-4L4 16v4z" />
                          <path d="m13.5 6.5 4 4" />
                        </svg>
                      </button>
                      <button type="button" className="icon-button" aria-label={`Delete ${contact.nombre}`} onClick={() => setModal({ type: 'delete', contact })}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tab-footnote">These people will be contacted in an emergency involving the employee.</p>
        </>
      )}

      {modal?.type === 'add' && (
        <ContactModal personaId={personaId} employeeName={employee.nombre} onClose={() => setModal(null)} onSaved={finished} />
      )}
      {modal?.type === 'edit' && (
        <ContactModal personaId={personaId} employeeName={employee.nombre} contact={modal.contact} onClose={() => setModal(null)} onSaved={finished} />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal contact={modal.contact} onClose={() => setModal(null)} onDeleted={finished} />
      )}
    </section>
  );
}
