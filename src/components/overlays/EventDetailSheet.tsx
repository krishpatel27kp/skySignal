/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Event Intelligence Detail Sheet
   Slide-over drawer opening smoothly from the right edge.
   Header: Hazard icon, title, unique UUID chip, last updated time.
   Status & Severity Badges + Lifecycle Stage Meter
   (Detected -> Emerging -> Confirmed -> Active -> Declining -> Resolved).
   Confidence Card with ShieldCheck and corroborating source count.
   Evidence Summary Tab: Photos/Videos, Sensor Readings, Citizen Reports.
   Contradiction Banner: Alert when sensor data diverges from reports.
   Admin Actions: "Promote Lifecycle", "Merge with Event", "Invalidate".
   ═══════════════════════════════════════════════════════ */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ShieldCheck,
  MapPin,
  Radio,
  AlertTriangle,
  CheckCircle2,
  GitMerge,
  Ban,
  TrendingUp,
  Sparkles,
  Eye,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CATEGORY_CONFIG, SEVERITY_CONFIG } from '../../data/mock';
import type { WeatherCategory, Severity, LifecycleStatus, WeatherEvent } from '../../types/weather';

interface EventDetailSheetProps {
  event: WeatherEvent | any | null;
  onClose: () => void;
  onStatusChange?: (eventId: string, newStatus: LifecycleStatus) => void;
}

const LIFECYCLE_STAGES: LifecycleStatus[] = [
  'detected',
  'emerging',
  'confirmed',
  'active',
  'declining',
  'resolved',
];

type EvidenceTab = 'media' | 'sensors' | 'citizen';

export default function EventDetailSheet({
  event,
  onClose,
  onStatusChange,
}: EventDetailSheetProps) {
  const { isAdmin, user, openLoginModal } = useAuth();
  const [activeTab, setActiveTab] = useState<EvidenceTab>('media');
  const [previewMedia, setPreviewMedia] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<LifecycleStatus>(
    event?.lifecycle_status || event?.status || 'active'
  );
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Guard: Cannot be invoked or mounted without Analyst privileges
  if (!event || !isAdmin) return null;

  const catMeta = CATEGORY_CONFIG[event.category as WeatherCategory] || {
    icon: '🌧️',
    color: '#0284c7',
    bgColor: '#e0f2fe',
  };

  const sevMeta = SEVERITY_CONFIG[event.severity as Severity] || {
    label: 'Moderate',
    icon: '▲',
    className: 'badge-severity-moderate',
  };

  const city = event.city ?? event.location?.name ?? 'National Capital';
  const state = event.state ?? event.location?.state ?? 'India';
  const lat = event.lat ?? event.location?.lat ?? 20.5937;
  const lon = event.lon ?? event.lng ?? event.location?.lng ?? 78.9629;
  const confidence = event.confidence ?? 88;
  const sourceCount = event.independent_source_count ?? event.sources ?? 3;
  const hasContradiction = event.has_contradiction ?? false;

  const currentStageIndex = LIFECYCLE_STAGES.indexOf(currentStatus);

  const triggerToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 4000);
  };

  // Admin Action Handlers
  const handlePromoteLifecycle = () => {
    const nextIndex = Math.min(LIFECYCLE_STAGES.length - 1, currentStageIndex + 1);
    const nextStage = LIFECYCLE_STAGES[nextIndex];
    setCurrentStatus(nextStage);
    onStatusChange?.(event.id, nextStage);
    triggerToast(`Event ${event.id} lifecycle advanced to "${nextStage.toUpperCase()}".`);
  };

  const handleMergeEvent = () => {
    triggerToast(`Event ${event.id} marked for canonical fusion review in /duplicates.`);
  };

  const handleInvalidateEvent = () => {
    setCurrentStatus('resolved');
    onStatusChange?.(event.id, 'resolved');
    triggerToast(`Event ${event.id} invalidated and marked as Resolved / False Alarm.`);
  };

  const sheetContent = (
    <>
      {/* Backdrop — screen-covering dimming background strictly behind drawer at z-[90] */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer — z-[100] covers full viewport height above Topbar and canvas elements */}
      <aside
        className="fixed inset-y-0 right-0 z-[100] w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-slide-in-right overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={`Event details for ${event.title}`}
      >
        {/* ── Top Header ── */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg shadow-xs shrink-0"
              style={{ backgroundColor: catMeta?.bgColor, color: catMeta?.color }}
            >
              {catMeta?.icon === 'CloudRain' ? '🌧️' : catMeta?.icon === 'Waves' ? '🌊' : catMeta?.icon === 'Thermometer' ? '🌡️' : '⚡'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-black tracking-wide text-sky-700 bg-sky-100/90 px-2 py-0.5 rounded-md">
                  {event.id}
                </span>
                <span className="text-[11px] text-slate-600 font-medium">
                  Updated: {new Date(event.last_updated_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST
                </span>
              </div>
              <h2 className="text-[16px] font-black text-slate-900 tracking-tight font-['Outfit'] mt-0.5 line-clamp-1">
                {event.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close drawer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── Action Notification Toast ── */}
        {actionToast && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-bold flex items-center justify-between shadow-xs animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{actionToast}</span>
            </div>
            <button onClick={() => setActionToast(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-[13px]">
          {/* Location Bar */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-sky-600 shrink-0" />
              <span className="font-bold text-slate-900">
                {city}, {state}
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-600">
              {Number(lat).toFixed(4)}°N, {Number(lon).toFixed(4)}°E
            </span>
          </div>

          {/* ── Status & Severity Badges + Lifecycle Stage Meter ── */}
          <div className="glass-card p-4 rounded-2xl border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Severity Tier:
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase flex items-center gap-1 ${
                    event.severity === 'severe'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : event.severity === 'moderate'
                      ? 'bg-sky-100 text-sky-800 border border-sky-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  <span>{sevMeta?.icon}</span>
                  <span>{event.severity}</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Status:
                </span>
                <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-black uppercase bg-slate-900 text-white">
                  {currentStatus}
                </span>
              </div>
            </div>

            {/* Lifecycle Stage Meter */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                <span>Lifecycle Evolution Stage</span>
                <span className="text-sky-600 font-mono">Stage {currentStageIndex + 1} of 6</span>
              </div>

              {/* 6 Stage Track */}
              <div className="grid grid-cols-6 gap-1.5">
                {LIFECYCLE_STAGES.map((stg, idx) => {
                  const isPastOrCurrent = idx <= currentStageIndex;
                  const isCurrent = idx === currentStageIndex;

                  return (
                    <div key={stg} className="space-y-1">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          isCurrent
                            ? 'bg-sky-600 ring-2 ring-sky-300'
                            : isPastOrCurrent
                            ? 'bg-sky-400'
                            : 'bg-slate-200'
                        }`}
                      />
                      <span
                        className={`text-[9px] block text-center truncate font-bold uppercase ${
                          isCurrent ? 'text-sky-700 font-black' : isPastOrCurrent ? 'text-slate-600' : 'text-slate-300'
                        }`}
                        title={stg}
                      >
                        {stg.slice(0, 4)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Contradiction Banner (if sensor disagrees with reports) ── */}
          {hasContradiction && (
            <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300/80 text-amber-900 space-y-1.5 animate-fade-in shadow-xs">
              <div className="flex items-center gap-2 font-black text-[12px] text-amber-800">
                <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                <span>Sensor & Crowd Contradiction Warning</span>
              </div>
              <p className="text-[11px] text-amber-800/90 leading-relaxed font-medium">
                Official automated sensor network diverges from incoming crowd reports: Citizen telemetry reports localized inundation (&gt;2 ft), while local Doppler automated rain gauge reads moderate accumulation. Analyst verification required before public escalation.
              </p>
            </div>
          )}

          {/* ── Confidence Card ── */}
          <div className="glass-card p-4.5 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-sky-50/40 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-2xs">
                <ShieldCheck size={28} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  AI Fusion Confidence
                </span>
                <div className="text-[26px] font-black text-slate-900 font-['Outfit'] leading-none mt-0.5">
                  {confidence}%
                </div>
                <span className="text-[11px] text-emerald-700 font-bold mt-1 inline-block">
                  Corroborated by {sourceCount} independent source streams
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-400 block">Bayesian Prior</span>
              <span className="font-mono font-black text-[13px] text-slate-700">0.962</span>
            </div>
          </div>

          {/* ── Evidence Summary Tabs ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-4 text-[12px] font-bold">
                <button
                  onClick={() => setActiveTab('media')}
                  className={`pb-2.5 transition-colors cursor-pointer border-b-2 ${
                    activeTab === 'media'
                      ? 'border-sky-600 text-sky-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Photos & Media
                </button>
                <button
                  onClick={() => setActiveTab('sensors')}
                  className={`pb-2.5 transition-colors cursor-pointer border-b-2 ${
                    activeTab === 'sensors'
                      ? 'border-sky-600 text-sky-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Doppler & AWS Sensors
                </button>
                <button
                  onClick={() => setActiveTab('citizen')}
                  className={`pb-2.5 transition-colors cursor-pointer border-b-2 ${
                    activeTab === 'citizen'
                      ? 'border-sky-600 text-sky-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Citizen Reports
                </button>
              </div>
            </div>

            {/* Tab 1: Photos & Media */}
            {activeTab === 'media' && (
              <div className="space-y-3 animate-fade-in">
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() =>
                      setPreviewMedia(
                        'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=800&auto=format&fit=crop&q=80'
                      )
                    }
                    className="relative group h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer"
                  >
                    <img
                      src="https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=400&auto=format&fit=crop&q=80"
                      alt="Waterlogging observation"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-bold gap-1 transition-opacity">
                      <Eye size={14} />
                      <span>Zoom</span>
                    </div>
                    <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-black/60 text-white text-[9px] font-semibold">
                      Citizen Geotag
                    </span>
                  </div>

                  <div
                    onClick={() =>
                      setPreviewMedia(
                        'https://images.unsplash.com/photo-1514632595-4944383f2737?w=800&auto=format&fit=crop&q=80'
                      )
                    }
                    className="relative group h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer"
                  >
                    <img
                      src="https://images.unsplash.com/photo-1514632595-4944383f2737?w=400&auto=format&fit=crop&q=80"
                      alt="Storm overcast"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-bold gap-1 transition-opacity">
                      <Eye size={14} />
                      <span>Zoom</span>
                    </div>
                    <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-black/60 text-white text-[9px] font-semibold">
                      Social Upload
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Click any thumbnail to inspect high-resolution ground truth evidence.
                </p>
              </div>
            )}

            {/* Tab 2: Doppler & AWS Sensors */}
            {activeTab === 'sensors' && (
              <div className="space-y-3 animate-fade-in text-[12px]">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 text-slate-800">
                      <Radio size={14} className="text-emerald-600" />
                      Doppler Radar Reflectivity
                    </span>
                    <span className="font-mono text-emerald-700 font-black">52.4 dBZ</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '85%' }} />
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Santacruz Doppler Station (DWR-MUM-01) · Beam elevation 0.5°
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Rain Gauge Rate
                    </span>
                    <div className="font-mono text-[14px] font-black text-slate-900 mt-0.5">
                      68.2 mm/hr
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Peak Wind Gust
                    </span>
                    <div className="font-mono text-[14px] font-black text-slate-900 mt-0.5">
                      54 km/h
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Citizen Reports */}
            {activeTab === 'citizen' && (
              <div className="space-y-2.5 animate-fade-in text-[12px]">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono font-bold text-slate-400">dev-abc123</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold uppercase">
                      Verified
                    </span>
                  </div>
                  <p className="text-slate-800 font-medium italic text-[11px]">
                    "Water level has risen to knee height on main road near Dadar station. Vehicles stranded."
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono font-bold text-slate-400">dev-lmn456</span>
                    <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-bold uppercase">
                      Corroborated
                    </span>
                  </div>
                  <p className="text-slate-800 font-medium italic text-[11px]">
                    "Heavy rain in Andheri East. Metro station underpass waterlogged. Trains running 15 min late."
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Admin Actions Section (Visible when authenticated) ── */}
        <div className="p-5 border-t border-slate-200 bg-slate-50/90 space-y-3">
          {isAdmin ? (
            <div>
              <div className="flex items-center justify-between text-[11px] mb-2 font-bold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-sky-600" />
                  Authenticated Analyst Actions ({user?.name || 'Duty Forecaster'})
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Role: {user?.role || 'Admin'}</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handlePromoteLifecycle}
                  className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-[11px] font-bold shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  title="Advance event lifecycle stage"
                >
                  <TrendingUp size={13} />
                  <span>Promote</span>
                </button>

                <button
                  onClick={handleMergeEvent}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[11px] font-bold shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  title="Merge into duplicate cluster"
                >
                  <GitMerge size={13} />
                  <span>Merge</span>
                </button>

                <button
                  onClick={handleInvalidateEvent}
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-bold shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  title="Invalidate as false positive"
                >
                  <Ban size={13} />
                  <span>Invalidate</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200 text-[12px]">
              <span className="text-slate-500 font-medium">
                Admin controls require meteorological analyst sign-in.
              </span>
              <button
                onClick={openLoginModal}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors cursor-pointer text-[11px]"
              >
                Analyst Login
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Media Lightbox Modal (Above drawer at z-[110]) ── */}
      {previewMedia && (
        <div
          className="fixed inset-0 z-[110] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90">
              <span className="text-[13px] font-bold text-white flex items-center gap-2">
                <Sparkles size={15} className="text-sky-400" />
                Event Ground Observation Lightbox
              </span>
              <button
                onClick={() => setPreviewMedia(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/50">
              <img
                src={previewMedia}
                alt="Enlarged observation"
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );

  return typeof document !== 'undefined'
    ? createPortal(sheetContent, document.body)
    : sheetContent;
}
