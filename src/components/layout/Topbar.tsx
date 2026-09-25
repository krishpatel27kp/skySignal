/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Topbar Header
   Sticky top bar with breadcrumbs, Live IST clock,
   pulsing telemetry chip, i18n switcher, notifications,
   and Analyst Auth integration.
   ═══════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
  Menu,
  Bell,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  X,
  LogOut,
} from 'lucide-react';
import { mockWeatherEvents } from '../../lib/mockData';

interface TopbarProps {
  onToggleMobileMenu: () => void;
}

const ROUTE_TITLES: Record<string, { en: string; hi: string }> = {
  '/': { en: 'Situational Overview', hi: 'स्थिति अवलोकन' },
  '/explorer': { en: 'Event Explorer', hi: 'घटना एक्सप्लोरर' },
  '/events': { en: 'Event Explorer', hi: 'घटना एक्सप्लोरर' },
  '/verification': { en: 'Verification Queue', hi: 'सत्यापन कतार' },
  '/duplicates': { en: 'Duplicate Review', hi: 'डुप्लिकेट समीक्षा' },
  '/analytics': { en: 'Analytics Dashboard', hi: 'एनालिटिक्स डैशबोर्ड' },
  '/audit': { en: 'Audit Log', hi: 'ऑडिट लॉग' },
  '/report': { en: 'Citizen Portal', hi: 'नागरिक पोर्टल' },
  '/citizen': { en: 'Citizen Portal', hi: 'नागरिक पोर्टल' },
};

export default function Topbar({ onToggleMobileMenu }: TopbarProps) {
  const { i18n } = useTranslation();
  const location = useLocation();
  const { isAdmin, user, openLoginModal, logout } = useAuth();

  const isHindi = i18n.language === 'hi';

  // Live IST Clock
  const [istTime, setIstTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format: "24 Sep 2026 · 14:32 IST"
      const datePart = now.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
      const timePart = now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata',
      });
      setIstTime(`${datePart} · ${timePart} IST`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Notifications dropdown
  const [showNotifications, setShowNotifications] = useState(false);
  const severeAlerts = mockWeatherEvents.filter((e) => e.severity === 'severe');

  // Breadcrumbs determination
  const currentRouteMeta = ROUTE_TITLES[location.pathname] || {
    en: 'Command Dashboard',
    hi: 'कमांड डैशबोर्ड',
  };

  const handleLanguageChange = (lang: 'en' | 'hi') => {
    i18n.changeLanguage(lang);
  };

  return (
    <header
      className="
        sticky top-0 z-20
        h-[64px]
        bg-white/80 backdrop-blur-xl border-b border-slate-200/80
        flex items-center justify-between px-4 sm:px-6
        transition-all duration-200 shadow-xs
      "
    >
      {/* ── Left: Hamburger Menu & Breadcrumbs ── */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Toggle (Available to all users) */}
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Toggle navigation drawer"
        >
          <Menu size={20} />
        </button>

        {/* Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500"
        >
          <Link
            to="/"
            className="hover:text-sky-600 transition-colors text-slate-500"
          >
            {isHindi ? 'होम' : 'Home'}
          </Link>
          <ChevronRight size={13} className="text-slate-300" />
          <span className="text-slate-900 font-bold tracking-tight">
            {isHindi ? currentRouteMeta.hi : currentRouteMeta.en}
          </span>
        </nav>

        {/* Public Guest Mode Badge */}
        {!isAdmin && (
          <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-semibold">
            Public View
          </span>
        )}
      </div>

      {/* ── Right: Clock, Telemetry Status, i18n, Alerts & Auth ── */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Live IST Digital Clock */}
        <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span>{istTime || '24 Sep 2026 · 14:32:00 IST'}</span>
        </div>

        {/* Telemetry Status Chip ("LIVE TELEMETRY") */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider">
            Live Telemetry
          </span>
        </div>

        {/* Language Switch Dropdown (EN / हिन्दी) */}
        <div className="relative flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[11px] font-bold">
          <button
            onClick={() => handleLanguageChange('en')}
            className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
              !isHindi
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => handleLanguageChange('hi')}
            className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
              isHindi
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            हिन्दी
          </button>
        </div>

        {/* Notification Bell (Unread Severe Alerts — Admin Only) */}
        {isAdmin && (
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Severe weather alerts"
            >
              <Bell size={18} />
              {severeAlerts.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-600 text-white font-black text-[9px] flex items-center justify-center border-2 border-white shadow-xs">
                  {severeAlerts.length}
                </span>
              )}
            </button>

            {/* Severe Alerts Popover */}
            {showNotifications && (
              <div
                className="
                  absolute right-0 mt-2 w-80 sm:w-96
                  bg-white/95 backdrop-blur-xl rounded-2xl
                  border border-slate-200/90 shadow-2xl p-4 space-y-3 z-50
                  animate-fade-in
                "
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-[12px] font-bold text-slate-800">
                    <ShieldAlert size={15} className="text-red-600" />
                    <span>Severe Weather Alerts ({severeAlerts.length})</span>
                  </div>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {severeAlerts.slice(0, 4).map((evt) => (
                    <div
                      key={evt.id}
                      className="p-2.5 rounded-xl bg-red-50/70 border border-red-100 text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-red-900 truncate">
                          {evt.title}
                        </span>
                        <span className="text-[10px] font-black text-red-700 uppercase">
                          ◆ Severe
                        </span>
                      </div>
                      <div className="text-slate-600">
                        📍 {evt.city}, {evt.state} · {evt.confidence}% conf.
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-center pt-1 border-t border-slate-100">
                  <Link
                    to="/explorer"
                    onClick={() => setShowNotifications(false)}
                    className="text-[11px] font-bold text-sky-600 hover:text-sky-800"
                  >
                    View All Hazards in Explorer &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Admin Profile & Logout / Analyst Login Trigger ── */}
        {isAdmin && user ? (
          <div className="flex items-center gap-2">
            <button
              onClick={openLoginModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200/80 hover:bg-sky-100/80 transition-all cursor-pointer shadow-xs"
              title="Analyst Profile & Settings"
              aria-label="Analyst Profile Settings"
            >
              <div className="w-6 h-6 rounded-lg bg-sky-600 text-white font-bold text-[10px] flex items-center justify-center shadow-xs">
                {user.name.charAt(0)}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-[11px] font-bold text-slate-800 leading-tight">
                  {user.name.split(' ')[0]}
                </div>
                <div className="text-[9px] text-sky-700 font-semibold uppercase tracking-wider">
                  Analyst Active
                </div>
              </div>
            </button>

            {/* Quick Logout Button */}
            <button
              onClick={logout}
              className="px-2.5 py-1.5 rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer flex items-center gap-1.5 text-[11px] font-bold"
              title="Logout Analyst Session"
              aria-label="Logout Analyst Session"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        ) : (
          <button
            onClick={openLoginModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-bold transition-all shadow-sm cursor-pointer"
          >
            <ShieldCheck size={14} className="text-sky-400" />
            <span className="hidden sm:inline">Analyst Login</span>
            <span className="sm:hidden">Login</span>
          </button>
        )}
      </div>
    </header>
  );
}
