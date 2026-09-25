/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — App Entry & Router
   Client-side SPA routing with React.lazy code splitting
   AuthProvider wrapper + responsive layout shell
   ═══════════════════════════════════════════════════════ */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Dynamic code splitting for all route pages
const Overview = lazy(() => import('./pages/Overview'));
const EventExplorer = lazy(() => import('./pages/EventExplorer'));
const VerificationQueue = lazy(() => import('./pages/VerificationQueue'));
const DuplicateReview = lazy(() => import('./pages/DuplicateReview'));
const Analytics = lazy(() => import('./pages/Analytics'));
const DataSourcesPage = lazy(() => import('./pages/DataSourcesPage'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const CitizenPortal = lazy(() => import('./pages/CitizenPortal'));
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage'));

// Sleek atmospheric loading spinner fallback
function RouteLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 animate-fade-in">
      <div className="relative flex h-10 w-10">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-10 w-10 bg-sky-600 items-center justify-center text-white text-[12px] font-bold">
          SS
        </span>
      </div>
      <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">
        Loading Telemetry Stream...
      </p>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            {/* ── Public Routes (Accessible by Guests & Admins in Read-Only Mode) ── */}
            {/* Situational Overview */}
            <Route
              index
              element={
                <Suspense fallback={<RouteLoadingFallback />}>
                  <Overview />
                </Suspense>
              }
            />
            <Route path="/overview" element={<Navigate to="/" replace />} />

            {/* Event Explorer (/explorer and alias /events) */}
            <Route
              path="/explorer"
              element={
                <Suspense fallback={<RouteLoadingFallback />}>
                  <EventExplorer />
                </Suspense>
              }
            />
            <Route path="/events" element={<Navigate to="/explorer" replace />} />

            {/* Analytics Dashboard */}
            <Route
              path="/analytics"
              element={
                <Suspense fallback={<RouteLoadingFallback />}>
                  <Analytics />
                </Suspense>
              }
            />

            {/* Citizen Portal (/report and alias /citizen) */}
            <Route
              path="/report"
              element={
                <Suspense fallback={<RouteLoadingFallback />}>
                  <CitizenPortal />
                </Suspense>
              }
            />
            <Route path="/citizen" element={<Navigate to="/report" replace />} />

            {/* ── Protected Admin Routes (Admins Only — Verification, Duplicates, Audit) ── */}
            <Route element={<ProtectedRoute />}>
              {/* Verification Queue */}
              <Route
                path="/verification"
                element={
                  <Suspense fallback={<RouteLoadingFallback />}>
                    <VerificationQueue />
                  </Suspense>
                }
              />

              {/* Duplicate Review */}
              <Route
                path="/duplicates"
                element={
                  <Suspense fallback={<RouteLoadingFallback />}>
                    <DuplicateReview />
                  </Suspense>
                }
              />

              {/* Ingestion Sources */}
              <Route
                path="/sources"
                element={
                  <Suspense fallback={<RouteLoadingFallback />}>
                    <DataSourcesPage />
                  </Suspense>
                }
              />

              {/* Audit Log */}
              <Route
                path="/audit"
                element={
                  <Suspense fallback={<RouteLoadingFallback />}>
                    <AuditLog />
                  </Suspense>
                }
              />
            </Route>

            {/* 404 Catch-All */}
            <Route
              path="*"
              element={
                <Suspense fallback={<RouteLoadingFallback />}>
                  <PlaceholderPage
                    title="Page Not Found"
                    description="The requested page could not be found. Please check the URL or navigate using the sidebar."
                  />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
