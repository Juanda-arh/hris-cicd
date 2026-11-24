import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notificationsApi';
import { PageHeader } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';
import { describeNotification, formatNotificationTime } from '../utils/notifications';
import './EmployeeProfilePage.css';
import './NotificationsPage.css';

const PAGE = 50;
const SUBTITLES = {
  admin: 'Requests, certificates and team updates that need your attention.',
  lider: 'Your team’s requests and updates about your own time off and certificates.',
  empleado: 'Updates about your requests, certificates and your team.',
};

const ICONS = {
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  upload: <path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19.5h14" />,
  doc: <><path d="M7 3.5h7l4 4V20.5H7z" /><path d="M14 3.5v4h4M9.5 12.5h5M9.5 16h5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  cancel: <><circle cx="12" cy="12" r="8.5" /><path d="M6 6l12 12" /></>,
  cake: <><path d="M4.5 20.5h15M5.5 20.5v-7h13v7M5.5 15.5c2 1.4 4 1.4 6.5 0s4.5-1.4 6.5 0" /><path d="M12 13.5v-3M12 7.5v.01" /></>,
  bell: <><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
};

function Icon({ name }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name] || ICONS.bell}
    </svg>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    listNotifications({ limit: PAGE })
      .then((data) => {
        if (!active) return;
        setItems(data);
        setHasMore(data.length === PAGE);
      })
      .catch((err) => { if (active) setError(getErrorMessage(err)); });
    return () => { active = false; };
  }, []);

  async function loadMore() {
    setBusy(true);
    try {
      const more = await listNotifications({ limit: PAGE, offset: items.length });
      setItems((list) => [...list, ...more.filter((n) => !list.some((x) => x.id === n.id))]);
      setHasMore(more.length === PAGE);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const described = (items || []).map((n) => ({ ...n, meta: describeNotification(n, user.rol) }));
  const unread = described.filter((n) => !n.leida);
  const pending = unread.filter((n) => n.meta.needsAction);
  const visible = filter === 'unread' ? unread : filter === 'pending' ? pending : described;

  function markLocally(ids) {
    setItems((list) => list.map((n) => (ids.includes(n.id) ? { ...n, leida: true } : n)));
  }

  async function markOne(n) {
    setActionError('');
    try {
      await markNotificationRead(n.id);
      markLocally([n.id]);
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  async function markAll() {
    setActionError('');
    setBusy(true);
    try {
      await markAllNotificationsRead();
      markLocally(unread.map((n) => n.id));
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Opening what it is about also marks it as read
  async function open(n) {
    if (!n.leida) {
      try {
        await markNotificationRead(n.id);
      } catch {
        // going there matters more than the read mark
      }
    }
    navigate(n.meta.action.to);
  }

  const filters = [
    ['all', 'All', described.length],
    ['unread', 'Unread', unread.length],
    ['pending', 'Pending actions', pending.length],
  ];

  return (
    <>
      <PageHeader crumbs={[{ label: 'Notifications' }]} />
      <main className="app__content notif">
        <div className="notif__head">
          <div>
            <h1 className="notif__title">Notifications</h1>
            <p className="notif__subtitle">{SUBTITLES[user.rol] || SUBTITLES.empleado}</p>
          </div>
          <button type="button" className="btn" disabled={busy || unread.length === 0} onClick={markAll}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
            Mark all as read
          </button>
        </div>

        <div className="notif__filters" role="group" aria-label="Show">
          {filters.map(([id, label, count]) => (
            <button key={id} type="button" className={`notif__filter${filter === id ? ' is-active' : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}
              <span className="notif__count">{count}{id === 'all' && hasMore ? '+' : ''}</span>
            </button>
          ))}
        </div>

        {actionError && <p className="profile__alert" role="alert">{actionError}</p>}
        {error && <p className="profile__alert" role="alert">{error}</p>}
        {!error && !items && <p className="profile__loading" role="status">Loading your notifications…</p>}

        {items && visible.length === 0 && (
          <div className="notif__empty">
            <span className="notif__empty-icon" aria-hidden="true"><Icon name={filter === 'all' ? 'bell' : 'check'} /></span>
            <p className="notif__empty-title">{filter === 'all' ? 'No notifications yet' : 'You’re all caught up'}</p>
            <p className="notif__empty-text">
              {filter === 'all'
                ? 'Updates about requests and certificates will show up here.'
                : filter === 'unread' ? 'There are no unread notifications.' : 'Nothing is waiting for you right now.'}
            </p>
          </div>
        )}

        {items && visible.length > 0 && (
          <ul className="notif__list">
            {visible.map((n) => (
              <li key={n.id} className={`notif__item${n.leida ? '' : ' is-unread'}`}>
                <span className={`notif__icon notif__icon--${n.meta.tone}`} aria-hidden="true"><Icon name={n.meta.icon} /></span>
                <div className="notif__body">
                  <p className="notif__message">{n.mensaje}</p>
                  <p className="notif__group">
                    {n.meta.group}
                    {n.meta.needsAction && !n.leida && <span className="notif__needs"> · Needs your action</span>}
                  </p>
                  {(n.meta.action || !n.leida) && (
                    <div className="notif__actions">
                      {n.meta.action && (
                        <button type="button" className="notif__link" onClick={() => open(n)}>{n.meta.action.label}</button>
                      )}
                      {!n.leida && (
                        <button type="button" className="notif__link notif__link--muted" onClick={() => markOne(n)}>Mark as read</button>
                      )}
                    </div>
                  )}
                </div>
                <div className="notif__meta">
                  <time dateTime={n.creada_en}>{formatNotificationTime(n.creada_en)}</time>
                  {!n.leida && <span className="notif__dot" aria-label="Unread" />}
                </div>
              </li>
            ))}
          </ul>
        )}

        {items && hasMore && filter === 'all' && (
          <button type="button" className="btn notif__more" disabled={busy} onClick={loadMore}>{busy ? 'Loading…' : 'Load older notifications'}</button>
        )}
      </main>
    </>
  );
}
