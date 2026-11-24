import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import VerifyCodePage from './pages/VerifyCodePage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ProtectedRoute from './routes/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AppLayout from './components/AppLayout';
import PeoplePage from './pages/PeoplePage';
import NewEmployeePage from './pages/NewEmployeePage';
import EmployeeProfilePage from './pages/EmployeeProfilePage';
import EmployeePasswordPage from './pages/EmployeePasswordPage';
import EmployeeEditPage from './pages/EmployeeEditPage';
import AssignLeaderPage from './pages/AssignLeaderPage';
import CertificatesPage from './pages/CertificatesPage';
import RequestsPage from './pages/RequestsPage';
import ReportsPage from './pages/ReportsPage';
import AbsenceCalendarPage from './pages/AbsenceCalendarPage';
import TimeOffPage from './pages/TimeOffPage';
import MyPayStubsPage from './pages/MyPayStubsPage';
import AuditPage from './pages/AuditPage';
import PayStubsPage from './pages/payroll/PayStubsPage';
import SocialSecurityPage from './pages/payroll/SocialSecurityPage';
import MyTeamPage from './pages/MyTeamPage';
import TeamMemberPage from './pages/TeamMemberPage';
import OrgChartPage from './pages/OrgChartPage';
import MyProfilePage from './pages/MyProfilePage';
import MyProfileEditPage from './pages/MyProfileEditPage';
import MyCertificatesPage from './pages/MyCertificatesPage';
import AccountPasswordPage from './pages/AccountPasswordPage';
import NotificationsPage from './pages/NotificationsPage';

// Pantallas temporales, hasta construir las reales
function Placeholder({ title }) {
  return (
    <main style={{ padding: 32 }}>
      <h1>{title}</h1>
      <p>
        <Link to="/">Back to home</Link>
      </p>
    </main>
  );
}

function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (user.rol === 'admin') return <Navigate to="/people" replace />;
  // The leader and the employee start on their own profile
  if (user.rol === 'lider' || user.rol === 'empleado') return <Navigate to="/my-profile" replace />;

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <main style={{ padding: 32 }}>
      <h1>Home</h1>
      <p>
        {user.nombre} · {user.rol}
      </p>
      <p>
        <Link to="/team">Team (admin, lider)</Link> · <Link to="/admin">Admin (admin)</Link> ·{' '}
        <Link to="/payroll/pay-stubs">Payroll (admin)</Link>
      </p>
      <button type="button" onClick={handleLogout}>
        Sign out
      </button>
    </main>
  );
}

// Time off is for people with an employee record (employees and leaders); the admin is not one
function TimeOffRoute() {
  const { user } = useAuth();
  return user.rol === 'admin' ? <Placeholder title="Time Off & Leave" /> : <TimeOffPage />;
}

// Own pay stubs are for people with an employee record (employees and leaders); the admin is not one
function MyPayStubsRoute({ tab }) {
  const { user } = useAuth();
  return user.rol === 'admin' ? <Placeholder title="Pay Stubs" /> : <MyPayStubsPage tab={tab} />;
}

export default function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-code" element={<VerifyCodePage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Cualquier usuario con sesión */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Home />} />
      </Route>

      {/* Autoservicio: admin, líder y empleado */}
      <Route element={<ProtectedRoute roles={['admin', 'lider', 'empleado']} />}>
        <Route element={<AppLayout />}>
          <Route path="/my-profile" element={<MyProfilePage />} />
          <Route path="/my-profile/edit" element={<MyProfileEditPage />} />
          <Route path="/my-certificates" element={<MyCertificatesPage />} />
          <Route path="/my-org-chart" element={<OrgChartPage />} />
          {/* Pantallas compartidas que todavía no existen */}
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/time-off" element={<TimeOffRoute />} />
          <Route path="/pay-stubs" element={<MyPayStubsRoute tab="pay-stubs" />} />
          <Route path="/pay-stubs/social-security" element={<MyPayStubsRoute tab="social-security" />} />
        </Route>
      </Route>

      {/* Solo empleado */}
      <Route element={<ProtectedRoute roles={['empleado']} />}>
        <Route element={<AppLayout />}>
          <Route path="/home" element={<Navigate to="/my-profile" replace />} />
          <Route path="/my-calendar" element={<AbsenceCalendarPage />} />
          <Route path="/account/password" element={<AccountPasswordPage />} />
        </Route>
      </Route>

      {/* Solo admin y líder */}
      <Route element={<ProtectedRoute roles={['admin', 'lider']} />}>
        <Route path="/team" element={<Placeholder title="Team" />} />
      </Route>

      {/* Solo líder */}
      <Route element={<ProtectedRoute roles={['lider']} />}>
        <Route element={<AppLayout />}>
          <Route path="/my-team" element={<MyTeamPage />} />
          <Route path="/my-team/:id" element={<TeamMemberPage />} />
          {/* Pantallas del menú del líder que todavía no existen */}
          <Route path="/leader-home" element={<Navigate to="/my-profile" replace />} />
          <Route path="/team-requests" element={<RequestsPage />} />
          <Route path="/team-calendar" element={<AbsenceCalendarPage />} />
        </Route>
      </Route>

      {/* Solo admin */}
      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route path="/admin" element={<Placeholder title="Admin" />} />
        <Route element={<AppLayout />}>
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/people/new" element={<NewEmployeePage />} />
          <Route path="/people/:id" element={<EmployeeProfilePage />} />
          <Route path="/people/:id/edit" element={<EmployeeEditPage />} />
          <Route path="/people/:id/password" element={<EmployeePasswordPage />} />
          <Route path="/people/:id/assign-leader" element={<AssignLeaderPage />} />
          <Route path="/certificates" element={<CertificatesPage />} />
          <Route path="/requests" element={<RequestsPage />} />

          {/* Payroll: comprobantes de pago y de seguridad social */}
          <Route path="/payroll" element={<Navigate to="/payroll/pay-stubs" replace />} />
          <Route path="/payroll/pay-stubs" element={<PayStubsPage />} />
          <Route path="/payroll/social-security" element={<SocialSecurityPage />} />

          {/* Pantallas del menú que todavía no existen */}
          <Route path="/absence-calendar" element={<AbsenceCalendarPage />} />
          <Route path="/org-chart" element={<Navigate to="/my-org-chart" replace />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/audit" element={<AuditPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}