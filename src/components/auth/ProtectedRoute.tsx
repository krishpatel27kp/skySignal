/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — ProtectedRoute (RBAC Wrapper)
   Restricts Admin Command pages (Verification Queue, Duplicate
   Review, Audit Log) to authenticated Analysts.
   If a Guest attempts to navigate to a protected route directly
   via URL, redirects them to / (Overview).
   ═══════════════════════════════════════════════════════ */

import { type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children?: ReactNode;
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  redirectTo = '/',
}: ProtectedRouteProps) {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    // If a Guest attempts to navigate to a protected route directly via URL, redirect to / (Overview)
    return <Navigate to={redirectTo} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
