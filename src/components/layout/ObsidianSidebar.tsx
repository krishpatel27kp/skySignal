/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Obsidian Sidebar Navigation
   Desktop: 228px fixed dark gradient #090e17 -> #0d1527
   Mobile (<768px): Hidden off-canvas drawer with backdrop
   Cyan glow bar (#38bdf8) active state styling
   ═══════════════════════════════════════════════════════ */

import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Compass,
  CheckCircle2,
  Copy,
  BarChart3,
  FileCode,
  Smartphone,
  X,
  Radio,
  Shield,
} from 'lucide-react';

interface ObsidianSidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  name: string;
  nameHi: string;
  path: string;
  icon: any;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: 'Situational Overview',
    nameHi: 'स्थिति अवलोकन',
    path: '/',
    icon: LayoutDashboard,
  },
  {
    name: 'Event Explorer',
    nameHi: 'घटना एक्सप्लोरर',
    path: '/explorer',
    icon: Compass,
  },
  {
    name: 'Verification Queue',
    nameHi: 'सत्यापन कतार',
    path: '/verification',
    icon: CheckCircle2,
    badge: 12,
  },
  {
    name: 'Duplicate Review',
    nameHi: 'डुप्लिकेट समीक्षा',
    path: '/duplicates',
    icon: Copy,
    badge: 3,
  },
  {
    name: 'Analytics Dashboard',
    nameHi: 'एनालिटिक्स डैशबोर्ड',
    path: '/analytics',
    icon: BarChart3,
  },
  {
    name: 'Audit Log',
    nameHi: 'ऑडिट लॉग',
    path: '/audit',
    icon: FileCode,
  },
  {
    name: 'Citizen Portal',
    nameHi: 'नागरिक पोर्टल',
    path: '/report',
    icon: Smartphone,
  },
];

export default function ObsidianSidebar({
  mobileOpen,
  onCloseMobile,
}: ObsidianSidebarProps) {
  const { i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const isHindi = i18n.language === 'hi';

  // Guests can only see Overview, Explorer, Analytics, and Citizen Portal
  const GUEST_ALLOWED_PATHS = ['/', '/explorer', '/analytics', '/report'];
  const visibleNavItems = isAdmin
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => GUEST_ALLOWED_PATHS.includes(item.path));

  const sidebarContent = (
    <aside
      className="
        h-full flex flex-col justify-between
        bg-gradient-to-b from-[#090e17] via-[#0d1527] to-[#080c16]
        text-slate-300 border-r border-[#1e293b]/70
        shadow-2xl select-none
      "
      style={{ width: '228px' }}
      aria-label="Main Navigation"
    >
      {/* ── Brand Header ── */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white flex items-center justify-center shadow-lg shadow-sky-500/25">
            <Radio size={18} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-[15px] tracking-tight text-white font-['Outfit']">
                SkySignal
              </span>
              <span className="px-1.5 py-0.2 rounded-md bg-sky-500/20 text-sky-400 font-bold text-[9px] border border-sky-400/30">
                2.0
              </span>
            </div>
            <div className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold">
              IMD Radar Command
            </div>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Nav Links ── */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {isHindi ? 'नेविगेशन' : 'Intelligence Radar'}
        </div>

        {visibleNavItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onCloseMobile}
              className={({ isActive }) => `
                relative flex items-center justify-between px-3 py-2.5 rounded-xl
                text-[13px] font-medium transition-all duration-200 group
                ${
                  isActive
                    ? 'text-white bg-sky-500/15 shadow-[0_0_20px_rgba(56,189,248,0.18)] font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }
              `}
            >
              {({ isActive }) => (
                <>
                  {/* Cyan Active Indicator Bar (#38bdf8) */}
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full bg-[#38bdf8] shadow-[0_0_12px_#38bdf8]"
                      aria-hidden="true"
                    />
                  )}

                  <div className="flex items-center gap-3">
                    <Icon
                      size={18}
                      className={`transition-colors ${
                        isActive
                          ? 'text-[#38bdf8]'
                          : 'text-slate-400 group-hover:text-slate-300'
                      }`}
                    />
                    <span className="truncate">
                      {isHindi ? item.nameHi : item.name}
                    </span>
                  </div>

                  {/* Badge */}
                  {item.badge && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive
                          ? 'bg-[#38bdf8] text-slate-950 font-black'
                          : 'bg-slate-800 text-slate-300 group-hover:bg-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Bottom Radar Telemetry Status ── */}
      <div className="p-3.5 m-3 rounded-2xl bg-slate-900/80 border border-slate-800/90 text-[11px] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <Shield size={13} className="text-emerald-400" />
            <span>Doppler Grid</span>
          </div>
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            ONLINE
          </span>
        </div>
        <p className="text-[10px] text-slate-400 leading-tight">
          Pan-India multi-sensor fusion with automated ML verification.
        </p>
      </div>
    </aside>
  );

  return (
    <>
      {/* ── Desktop Fixed Sidebar (width 228px) ── */}
      <div className="hidden md:block fixed inset-y-0 left-0 z-40 w-[228px]">
        {sidebarContent}
      </div>

      {/* ── Mobile Off-Canvas Drawer (<768px) ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer container */}
          <div className="relative z-10 w-[228px] h-full shadow-2xl animate-slide-in-left">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
