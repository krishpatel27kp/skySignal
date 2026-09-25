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

export default function AppLayout() {
  const { isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [inspectedTelemetryEvent, setInspectedTelemetryEvent] = useState<any | null>(null);

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-slate-800 flex flex-col">
      {/* Ambient Atmospheric Radial Background Glow */}
      <div className="ambient-glow" aria-hidden="true" />

      {/* ── Fixed / Off-canvas Obsidian Sidebar (width 228px) ── */}
      <ObsidianSidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* ── Main App Shell Area (Consistent 228px offset on Desktop to prevent layout shifts) ── */}
      <div className="md:pl-[228px] flex-1 flex flex-col min-w-0 transition-all duration-300">
        {/* Sticky Topbar */}
        <Topbar onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />

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
