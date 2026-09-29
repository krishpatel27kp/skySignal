/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Executive Meteorological Navigation Sidebar
   Supports both full expanded width (228px) and minimized
   icon-only rail mode (68px) with hover tooltips and instant navigation.
   ═══════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getDashboardStats, getDuplicateClusters } from '../../services/apiClient';
import {
  LayoutDashboard,
  CheckCircle2,
  Copy,
  BarChart3,
  FileCode,
  Smartphone,
  X,
  Shield,
  PanelLeftClose,
} from 'lucide-react';

interface ObsidianSidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  name: string;
  nameHi: string;
  path: string;
  icon: any;
  badge?: number;
}

const BASE_NAV_ITEMS: NavItem[] = [
  {
    name: 'Weather Status',
    nameHi: 'मौसम की स्थिति',
    path: '/',
    icon: LayoutDashboard,
  },
  {
    name: 'Verification Queue',
    nameHi: 'सत्यापन कतार',
    path: '/verification',
    icon: CheckCircle2,
  },
  {
    name: 'Duplicate Review',
    nameHi: 'डुप्लिकेट समीक्षा',
    path: '/duplicates',
    icon: Copy,
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
  collapsed = false,
  onToggleCollapse,
}: ObsidianSidebarProps) {
  const { i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const isHindi = i18n.language === 'hi';

  const [counts, setCounts] = useState<{ verification: number; duplicates: number }>({
    verification: 0,
    duplicates: 0,
  });

  useEffect(() => {
    let isMounted = true;
    const fetchCounts = async () => {
      try {
        const [statsRes, clustersRes] = await Promise.allSettled([
          getDashboardStats(),
          getDuplicateClusters(),
        ]);
        if (!isMounted) return;
        setCounts({
          verification:
            statsRes.status === 'fulfilled' && statsRes.value?.pending_reports !== undefined
              ? statsRes.value.pending_reports
              : 0,
          duplicates:
            clustersRes.status === 'fulfilled' && Array.isArray(clustersRes.value)
              ? clustersRes.value.length
              : 0,
        });
      } catch (e) {
        console.warn('Failed to fetch dynamic sidebar badge counts:', e);
      }
    };

    fetchCounts();
    const handleUpdate = () => fetchCounts();
    window.addEventListener('skysignal:telemetry', handleUpdate);
    window.addEventListener('skysignal:counts_updated', handleUpdate);
    const interval = setInterval(fetchCounts, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('skysignal:telemetry', handleUpdate);
      window.removeEventListener('skysignal:counts_updated', handleUpdate);
    };
  }, []);

  // Guests can only see Weather Status and Citizen Portal
  const GUEST_ALLOWED_PATHS = ['/', '/report'];
  const visibleNavItems = (isAdmin
    ? BASE_NAV_ITEMS
    : BASE_NAV_ITEMS.filter((item) => GUEST_ALLOWED_PATHS.includes(item.path))
  ).map((item) => {
    if (item.path === '/verification') {
      return { ...item, badge: counts.verification };
    }
    if (item.path === '/duplicates') {
      return { ...item, badge: counts.duplicates };
    }
    return item;
  });

  const sidebarContent = (
    <aside
      className={`
        h-full flex flex-col justify-between
        bg-[#181716] text-stone-300
        border-r border-[#2d2a27]
        shadow-2xl select-none
        transition-all duration-300 ease-in-out
      `}
      style={{ width: collapsed ? '68px' : '228px' }}
      aria-label="Main Navigation"
    >
      {/* ── Brand Header ── */}
      <div className={`p-3.5 border-b border-[#2d2a27] flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Precision Meteorological Doppler Insignia (Bronze Amber) */}
              <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-[0_0_12px_rgba(217,119,6,0.35)] shrink-0">
                <svg
                  viewBox="0 0 24 24"
                  width="17"
                  height="17"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a10 10 0 0 1 10 10" />
                  <path d="M12 6a6 6 0 0 1 6 6" />
                  <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                  <path d="M12 12l5-5" strokeWidth="1.75" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[14px] tracking-tight text-white truncate">
                    SkySignal
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-[#2d2a27] text-amber-300 font-bold text-[9px] border border-[#44403c] font-mono">
                    2.0
                  </span>
                </div>
                <div className="text-[10px] text-stone-400 tracking-wider uppercase font-semibold truncate font-mono">
                  IMD Radar
                </div>
              </div>
            </div>

            {/* Desktop Minimize Button + Mobile Close */}
            <div className="flex items-center gap-1">
              {onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  className="hidden md:flex p-1 rounded-md text-stone-400 hover:text-white hover:bg-[#2d2a27] transition-colors cursor-pointer"
                  title="Minimize Sidebar"
                  aria-label="Minimize Sidebar"
                >
                  <PanelLeftClose size={16} />
                </button>
              )}
              <button
                onClick={onCloseMobile}
                className="md:hidden p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-[#2d2a27] transition-colors"
                aria-label="Close sidebar"
              >
                <X size={18} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center">
            <button
              onClick={onToggleCollapse}
              className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-[0_0_12px_rgba(217,119,6,0.35)] shrink-0 hover:bg-amber-500 transition-colors cursor-pointer"
              title="Expand Sidebar"
              aria-label="Expand Sidebar"
            >
              <svg
                viewBox="0 0 24 24"
                width="17"
                height="17"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a10 10 0 0 1 10 10" />
                <path d="M12 6a6 6 0 0 1 6 6" />
                <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                <path d="M12 12l5-5" strokeWidth="1.75" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ── Nav Links ── */}
      <nav className={`flex-1 ${collapsed ? 'px-2 py-3' : 'px-3 py-4'} space-y-1.5 overflow-y-auto`}>
        {!collapsed && (
          <div className="px-3 pb-2 text-[10px] font-bold text-stone-500 uppercase tracking-widest font-mono">
            {isHindi ? 'नेविगेशन' : 'Intelligence Radar'}
          </div>
        )}

        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const label = isHindi ? item.nameHi : item.name;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onCloseMobile}
              title={collapsed ? label : undefined}
              className={({ isActive }) => `
                relative flex items-center rounded-lg text-[13px] font-medium transition-all duration-150 group
                ${collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'}
                ${isActive
                  ? 'text-white bg-amber-600 font-semibold shadow-[0_2px_12px_rgba(217,119,6,0.35)] ' + (collapsed ? 'ring-2 ring-amber-400/50' : 'border-l-3 border-amber-300')
                  : 'text-stone-300 hover:text-white hover:bg-[#262422]'
                }
              `}
            >
              {({ isActive }) => (
                <>
                  <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
                    <Icon
                      size={18}
                      className={`transition-colors shrink-0 ${isActive
                          ? 'text-white'
                          : 'text-stone-400 group-hover:text-amber-300'
                        }`}
                    />
                    {!collapsed && (
                      <span className="truncate">
                        {label}
                      </span>
                    )}
                  </div>

                  {/* Badge */}
                  {item.badge !== undefined && item.badge > 0 && (
                    collapsed ? (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#181716]" />
                    ) : (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${isActive
                            ? 'bg-white text-stone-900 shadow-2xs'
                            : 'bg-[#2d2a27] text-amber-300 border border-[#44403c] group-hover:bg-[#383430]'
                          }`}
                      >
                        {item.badge}
                      </span>
                    )
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Bottom Section: Status Card or Mini Icon ── */}
      <div className={collapsed ? 'p-2 flex justify-center' : 'p-3 m-3 rounded-xl bg-[#22201e] border border-[#36322e] text-[11px] space-y-1.5'}>
        {!collapsed ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-white font-semibold">
                <Shield size={13} className="text-emerald-400" />
                <span>Doppler Grid</span>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </div>
            <p className="text-xs text-stone-400 leading-tight">
              Pan-India multi-sensor fusion with automated ML verification.
            </p>
          </>
        ) : (
          <div
            className="w-9 h-9 rounded-lg bg-[#22201e] border border-[#36322e] flex items-center justify-center text-emerald-400 cursor-pointer hover:bg-[#2d2a27] transition-colors"
            title="Doppler Grid: 28/28 Stations ONLINE"
            onClick={onToggleCollapse}
          >
            <Shield size={16} />
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* ── Desktop Fixed Sidebar ── */}
      <div
        className="hidden md:block fixed inset-y-0 left-0 z-40 transition-all duration-300 ease-in-out"
        style={{ width: collapsed ? '68px' : '228px' }}
      >
        {sidebarContent}
      </div>

      {/* ── Mobile Off-Canvas Drawer (<768px always full width) ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer container */}
          <div className="relative z-10 w-[228px] h-full shadow-xl animate-slide-in-left">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
