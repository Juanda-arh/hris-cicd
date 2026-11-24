import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// roles (optional): list of roles allowed in this zone, e.g. ['admin', 'lider']
export default function ProtectedRoute({ roles }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user.debeCambiarClave) return <Navigate to="/change-password" replace />;
  if (roles && !roles.includes(user.rol)) return <Navigate to="/" replace />;

  return <Outlet />;
}