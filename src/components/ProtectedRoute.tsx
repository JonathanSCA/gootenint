import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import type { AppRole } from '../lib/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: AppRole[];
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <p className="text-slate-600">Checking access...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && (!role || !roles.includes(role))) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
          You do not have access to this area.
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
