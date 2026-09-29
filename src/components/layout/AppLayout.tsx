/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Responsive Master-Detail App Layout
   ObsidianSidebar (228px fixed desktop / off-canvas mobile)
   + Sticky Topbar with breadcrumbs & IST clock
   + Ambient glassmorphic canvas
   ═══════════════════════════════════════════════════════ */

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ObsidianSidebar from './ObsidianSidebar';
import Topbar from './Topbar';
import AdminLoginModal from '../auth/AdminLoginModal';
import TelemetryToast from '../telemetry/TelemetryToast';
import EventDetailDrawer from '../events/EventDetailDrawer';
import Background3D from './Background3D';

export default function AppLayout() {
  const { isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [inspectedTelemetryEvent, setInspectedTelemetryEvent] = useState<any | null>(null);

  // Collapsible sidebar state with local storage persistence
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('skysignal_sidebar_collapsed') === 'true';
  });

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('skysignal_sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-stone-800 flex flex-col relative overflow-x-hidden">
      {/* ── 3D Particle Background ── */}
      <Background3D />

      {/* ── Fixed / Off-canvas Navigation Sidebar ── */}
      <ObsidianSidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      {/* ── Main App Shell Area (Dynamic offset based on collapsed/expanded mode) ── */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'md:pl-[68px]' : 'md:pl-[228px]'
        }`}
      >
        {/* Sticky Topbar */}
        <Topbar
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebarCollapse={toggleSidebarCollapse}
        />

        {/* Routed Page Content */}
        <main className="relative flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* ── Real-Time SSE Telemetry Toast (Analyst only) ── */}
      {isAdmin && <TelemetryToast onSelectEvent={setInspectedTelemetryEvent} />}

      {/* ── Event Detail Drawer from Telemetry Toast (Admin Only) ── */}
      {isAdmin && inspectedTelemetryEvent && (
        <EventDetailDrawer
          event={inspectedTelemetryEvent}
          onClose={() => setInspectedTelemetryEvent(null)}
        />
      )}

      {/* ── Admin Login Modal ── */}
      <AdminLoginModal />
    </div>
  );
}
