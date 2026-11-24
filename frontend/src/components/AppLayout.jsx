import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { countUnreadNotifications } from '../api/employeesApi';
import { NOTIFICATIONS_CHANGED } from '../api/notificationsApi';
import { useAuth } from '../context/AuthContext';
import { initials } from '../utils/people';
import Logo from './Logo';
import './AppLayout.css';

const SELF_SERVICE = {
  title: 'Self-service',
  items: [
    { to: '/my-profile', label: 'My Profile' },
    { to: '/time-off', label: 'Time Off & Leave' },
    { to: '/pay-stubs', label: 'Pay Stubs' },
    { to: '/my-certificates', label: 'Certificates' },
    { to: '/my-org-chart', label: 'Org Chart' },
  ],
};

// The admin has no time off, pay stubs or certificates of their own: only their profile and the org chart
const ADMIN_SELF_SERVICE = {
  ...SELF_SERVICE,
  items: SELF_SERVICE.items.filter((item) => ['/my-profile', '/my-org-chart'].includes(item.to)),
};

const ADMIN_NAV = [
  {
    title: 'Administration',
    items: [
      { to: '/people', label: 'People' },
      { to: '/requests', label: 'Requests' },
      { to: '/certificates', label: 'Certificates' },
      { to: '/payroll', label: 'Payroll' },
      { to: '/absence-calendar', label: 'Absence Calendar' },
      { to: '/reports', label: 'Reports' },
      { to: '/audit', label: 'Audit' },
    ],
  },
  ADMIN_SELF_SERVICE,
];

const LEADER_NAV = [
  {
    title: 'My team',
    items: [
      { to: '/team-requests', label: 'Requests' },
      { to: '/my-team', label: 'My Team' },
      { to: '/team-calendar', label: 'Absence Calendar' },
    ],
  },
  SELF_SERVICE,
];

// The employee only has self-service, with their own absences in the calendar right after Time Off
const EMPLOYEE_NAV = [
  {
    ...SELF_SERVICE,
    items: SELF_SERVICE.items.flatMap((item) => (item.to === '/time-off' ? [item, { to: '/my-calendar', label: 'Absence Calendar' }] : [item])),
  },
];

const NAV_BY_ROLE = { admin: ADMIN_NAV, lider: LEADER_NAV, empleado: EMPLOYEE_NAV };

const ROLE_LABELS = { admin: 'Administrator', lider: 'Leader', empleado: 'Employee' };

function NotificationsLink() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () => countUnreadNotifications()
      .then((count) => { if (active) setUnread(count); })
      .catch(() => {}); // the badge is secondary: without it the page still works
    refresh();
    // Marking notifications as read on the notifications page updates the badge right away
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => {
      active = false;
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
    };
  }, []);

  return (
    <Link
      to="/notifications"
      className="app__bell"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </svg>
      {unread > 0 && <span className="app__bell-badge">{unread > 99 ? '99+' : unread}</span>}
    </Link>
  );
}

// Shell of the private pages: black sidebar (top bar plus drawer on mobile) and the cream content area.
export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app">
      <aside className={`app__side${menuOpen ? ' is-open' : ''}`}>
        <div className="app__side-top">
          <Logo name="ms-systems" height={26} />
          <div className="app__side-mobile">
            <span className="app__avatar" aria-hidden="true">{initials(user.nombre)}</span>
            <NotificationsLink />
            <button
              type="button"
              className="app__menu-toggle"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                {menuOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>

        <div className="app__side-body">
          <nav aria-label="Main menu">
            {(NAV_BY_ROLE[user.rol] || EMPLOYEE_NAV).map((section) => (
              <div key={section.title} className="app__nav-section">
                <p className="app__nav-title">{section.title}</p>
                <ul>
                  {section.items.map((item) => (
                    <li key={item.to}>
                      <NavLink to={item.to} className="app__nav-link" onClick={() => setMenuOpen(false)}>
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="app__side-foot">
            <div className="app__stripes" aria-hidden="true"><span /><span /><span /></div>
            <div className="app__user">
              <span className="app__avatar" aria-hidden="true">{initials(user.nombre)}</span>
              <span className="app__user-text">
                <span className="app__user-name">{user.nombre}</span>
                <span className="app__user-role">{ROLE_LABELS[user.rol] || user.rol}</span>
              </span>
            </div>
            <button type="button" className="app__signout" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </aside>

      <div className="app__main">
        <Outlet />
      </div>
    </div>
  );
}

// Header row of each page: breadcrumb on the left, actions and the bell on the right
export function PageHeader({ crumbs, children }) {
  return (
    <header className="app__topbar">
      <p className="app__crumbs">
        {crumbs.map((crumb, i) => (
          <span key={`${i}-${crumb.label}`}>
            {i > 0 && <span aria-hidden="true"> · </span>}
            {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
          </span>
        ))}
      </p>
      <div className="app__topbar-actions">
        {children}
        <span className="app__topbar-bell"><NotificationsLink /></span>
      </div>
    </header>
  );
}
