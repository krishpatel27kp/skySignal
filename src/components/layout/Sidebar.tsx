/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Obsidian Sidebar Navigation
   Dark gradient command-center sidebar with glow effects
   Integrated with react-i18next for bilingual support
   ═══════════════════════════════════════════════════════ */

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  BarChart3,
  Bell,
  Cloud,
  ClipboardCheck,
  Copy,
  Database,
  FileText,
  LayoutDashboard,
  Menu,
  Settings,
  Shield,
  Users,
  X,
  Zap,
} from 'lucide-react';

interface SidebarNavItem {
  id: string;
  i18nKey: string;
  icon: string;
  path: string;
  badge?: number;
}

const navItems: SidebarNavItem[] = [
  { id: 'overview',       i18nKey: 'nav.overview',           icon: 'LayoutDashboard', path: '/' },
  { id: 'events',         i18nKey: 'nav.eventExplorer',      icon: 'Activity',        path: '/events' },
  { id: 'verification',   i18nKey: 'nav.verificationQueue',  icon: 'ClipboardCheck',  path: '/verification', badge: 12 },
  { id: 'duplicates',     i18nKey: 'nav.duplicateReview',    icon: 'Copy',            path: '/duplicates', badge: 3 },
  { id: 'analytics',      i18nKey: 'nav.analytics',          icon: 'BarChart3',       path: '/analytics' },
  { id: 'sources',        i18nKey: 'nav.dataSources',        icon: 'Database',        path: '/sources' },
  { id: 'audit',          i18nKey: 'nav.auditLog',           icon: 'FileText',        path: '/audit' },
  { id: 'citizen',        i18nKey: 'nav.citizenReports',     icon: 'Users',           path: '/citizen' },
];

const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={20} />,
  Activity:        <Activity size={20} />,
  ClipboardCheck:  <ClipboardCheck size={20} />,
  Copy:            <Copy size={20} />,
  BarChart3:       <BarChart3 size={20} />,
  Database:        <Database size={20} />,
  FileText:        <FileText size={20} />,
  Users:           <Users size={20} />,
};

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-[var(--color-sidebar-from)] text-white md:hidden"
        aria-label="Open navigation menu"
      >
        <Menu size={22} />
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          sidebar-gradient fixed top-0 left-0 h-full z-50
          w-[var(--spacing-sidebar)] flex flex-col
          border-r border-[var(--color-sidebar-border)]
          transition-transform duration-300 ease-[var(--ease-smooth)]
          md:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* ── Brand Header ── */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-[var(--color-sidebar-border)]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--color-cyan-accent)] to-[var(--color-blue-accent)] flex items-center justify-center shadow-[var(--shadow-glow-cyan)]">
                <Cloud size={20} className="text-white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[var(--color-sidebar-from)] animate-pulse-glow" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-white tracking-tight leading-none">
                {t('app.name')}
              </h1>
              <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-[var(--color-sidebar-text)] leading-none mt-0.5 block">
                {t('app.version')}
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded-md text-[var(--color-sidebar-text)] hover:text-white md:hidden"
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Live Status Indicator ── */}
        <div className="mx-4 mt-4 mb-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-[var(--color-sidebar-border)]">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center">
              <Zap size={14} className="text-emerald-400" />
              <div className="absolute inset-0 w-full h-full rounded-full animate-pulse-glow" />
            </div>
            <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">
              Live — Connected
            </span>
          </div>
        </div>

        {/* ── Nav Items ── */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          <p className="px-3 pt-3 pb-2 text-[10px] font-semibold text-[var(--color-sidebar-text)] uppercase tracking-[0.15em]">
            {t('nav.commandCenter')}
          </p>
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.path)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium
                  transition-all duration-200 ease-[var(--ease-smooth)] group relative
                  ${active
                    ? 'bg-white/[0.1] text-white shadow-[0_0_16px_rgba(56,189,248,0.1)]'
                    : 'text-[var(--color-sidebar-text)] hover:bg-white/[0.05] hover:text-white'
                  }
                `}
                aria-current={active ? 'page' : undefined}
              >
                {/* Active indicator bar */}
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[var(--color-sidebar-glow)]" />
                )}
                <span className={`transition-colors duration-200 ${active ? 'text-[var(--color-sidebar-glow)]' : 'group-hover:text-[var(--color-sidebar-glow)]'}`}>
                  {iconMap[item.icon]}
                </span>
                <span className="flex-1 text-left">{t(item.i18nKey)}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full text-[10px] font-bold bg-[var(--color-severity-severe)] text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Bottom Section ── */}
        <div className="p-3 border-t border-[var(--color-sidebar-border)]">
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium
              text-[var(--color-sidebar-text)] hover:bg-white/[0.05] hover:text-white
              transition-all duration-200"
            aria-label={t('nav.notifications')}
          >
            <Bell size={20} />
            <span>{t('nav.notifications')}</span>
            <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full text-[10px] font-bold bg-[var(--color-sky-accent)] text-white">
              5
            </span>
          </button>
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium
              text-[var(--color-sidebar-text)] hover:bg-white/[0.05] hover:text-white
              transition-all duration-200"
            aria-label={t('nav.settings')}
          >
            <Settings size={20} />
            <span>{t('nav.settings')}</span>
          </button>

          {/* ── Analyst Badge ── */}
          <div className="mt-2 px-3 py-3 rounded-lg bg-white/[0.04] border border-[var(--color-sidebar-border)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-cyan-accent)] to-[var(--color-primary-500)] flex items-center justify-center">
                <Shield size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white truncate">IMD Analyst</p>
                <p className="text-[10px] text-[var(--color-sidebar-text)] truncate">analyst@imd.gov.in</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
