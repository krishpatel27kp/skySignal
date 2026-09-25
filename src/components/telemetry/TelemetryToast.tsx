/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Real-Time Telemetry Toast System
   Subscribes to mock SSE event stream & renders live alerts
   Floating glassmorphic toast with hazard icon, title,
   and "View on Map" action. Broadcasts skysignal:telemetry
   events to dynamically update map markers and counters.
   ═══════════════════════════════════════════════════════ */

import { useState } from 'react';
import { useMockTelemetry } from '../../services/mockApi';
import { X, MapPin, ExternalLink, Radio } from 'lucide-react';
import type { TelemetryMessage, WeatherEvent } from '../../types/weather';
import { CATEGORY_CONFIG, SEVERITY_CONFIG } from '../../data/mock';

interface TelemetryToastProps {
  onSelectEvent?: (event: WeatherEvent) => void;
}

export default function TelemetryToast({ onSelectEvent }: TelemetryToastProps) {
  const [activeToast, setActiveToast] = useState<TelemetryMessage | null>(null);

  // Subscribe to real-time mock telemetry stream
  useMockTelemetry({
    enabled: true,
    intervalMs: 14_000,
    onMessage: (message: TelemetryMessage) => {
      setActiveToast(message);

      // Broadcast event to entire window for live map & counter auto-updates
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('skysignal:telemetry', { detail: message })
        );
      }

      // Auto-dismiss after 6 seconds
      const timer = setTimeout(() => {
        setActiveToast((curr) => (curr?.timestamp === message.timestamp ? null : curr));
      }, 6000);
      return () => clearTimeout(timer);
    },
  });

  if (!activeToast) return null;

  const event = activeToast.payload;
  const sevConfig = SEVERITY_CONFIG[event.severity];
  const catConfig = CATEGORY_CONFIG[event.category];

  return (
    <aside
      aria-label="Real-time telemetry alert"
      className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-slide-in-right"
    >
      <div
        className="glass-card p-4 rounded-3xl border border-sky-300/90 shadow-2xl bg-white/95 backdrop-blur-2xl ring-1 ring-sky-500/30 space-y-3"
      >
        {/* Toast Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-black text-sky-700 uppercase tracking-wider flex items-center gap-1 font-mono">
              <Radio size={11} className="text-sky-600 animate-pulse" />
              {activeToast.type === 'event_created' ? 'New Live Incident' : 'Doppler Radar Update'}
            </span>
          </div>

          <button
            onClick={() => setActiveToast(null)}
            className="p-1 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Dismiss toast"
          >
            <X size={14} />
          </button>
        </div>

        {/* Hazard & Title */}
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs mt-0.5"
            style={{ backgroundColor: catConfig?.bgColor, color: catConfig?.color }}
          >
            {catConfig?.icon === 'CloudRain' ? '🌧️' : catConfig?.icon === 'Waves' ? '🌊' : catConfig?.icon === 'Thermometer' ? '🌡️' : '⚡'}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-[13px] font-black text-slate-900 font-['Outfit'] truncate leading-tight">
              {event.title}
            </h4>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
              <div className="flex items-center gap-0.5">
                <MapPin size={11} className="text-sky-600" />
                <span>{event.city}, {event.state}</span>
              </div>
              <span>•</span>
              <span
                className={`font-black uppercase text-[10px] ${
                  event.severity === 'severe'
                    ? 'text-rose-600'
                    : event.severity === 'moderate'
                    ? 'text-sky-600'
                    : 'text-emerald-600'
                }`}
              >
                {sevConfig?.icon} {event.severity}
              </span>
            </div>
          </div>
        </div>

        {/* Toast Actions */}
        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
          <span className="text-[10px] text-slate-400 font-mono">
            {new Date(activeToast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} IST
          </span>

          <button
            onClick={() => {
              onSelectEvent?.(event);
              setActiveToast(null);
            }}
            className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>View on Map</span>
            <ExternalLink size={12} />
          </button>
        </div>
      </div>
    </aside>
  );
}
