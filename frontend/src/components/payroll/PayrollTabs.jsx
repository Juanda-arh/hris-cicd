import { NavLink, useLocation } from 'react-router-dom';

// Las pestañas conservan el ?periodo= seleccionado
export default function PayrollTabs({ pendingReceipts }) {
  const { search } = useLocation();
  return (
    <nav className="tabs">
      <NavLink to={`/payroll/pay-stubs${search}`} className={({ isActive }) => `tabs__item ${isActive ? 'is-active' : ''}`}>
        Pay Stubs
      </NavLink>
      <NavLink
        to={`/payroll/social-security${search}`}
        className={({ isActive }) => `tabs__item ${isActive ? 'is-active' : ''}`}
      >
        {({ isActive }) => (
          <>
            Social Security Receipts
            {!isActive && pendingReceipts > 0 && <span className="tabs__count">{pendingReceipts}</span>}
          </>
        )}
      </NavLink>
    </nav>
  );
}
