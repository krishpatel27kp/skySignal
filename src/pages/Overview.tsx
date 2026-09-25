/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — IMD Situational Overview Command Screen
   Top KPI Grid with sparklines, Interactive Leaflet GeoRadarMap,
   Priority Watch Panel with contradiction flags,
   "One Event. Multiple Perspectives" Fusion Widget,
   and Active Events Table with Event Detail Drawer.
   ═══════════════════════════════════════════════════════ */

import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ShieldAlert,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  MapPin,
  ExternalLink,
  Sparkles,
  Radio,
  FileText,
  MessageCircle,
} from 'lucide-react';
import GeoRadarMap from '../components/map/GeoRadarMap';
import EventDetailDrawer from '../components/events/EventDetailDrawer';
import { mockWeatherEvents } from '../lib/mockData';
import { CATEGORY_CONFIG, SEVERITY_CONFIG } from '../data/mock';
import { useAuth } from '../context/AuthContext';
import type { WeatherEvent } from '../types/weather';

export default function Overview() {
  const { i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const isHindi = i18n.language === 'hi';

  const [events, setEvents] = useState<WeatherEvent[]>(mockWeatherEvents);
  const [selectedEvent, setSelectedEvent] = useState<WeatherEvent | null>(null);

  // Auto-update active map markers and counters from live telemetry stream
  useEffect(() => {
    const handleTelemetry = (e: Event) => {
      const customEvent = e as CustomEvent<{ type: string; payload: WeatherEvent }>;
      const msg = customEvent.detail;
      if (!msg || !msg.payload) return;

      if (msg.type === 'event_created') {
        setEvents((prev) => {
          if (prev.some((item) => item.id === msg.payload.id)) return prev;
          return [msg.payload, ...prev];
        });
      } else if (msg.type === 'event_updated') {
        setEvents((prev) =>
          prev.map((item) => (item.id === msg.payload.id ? msg.payload : item))
        );
      }
    };

    window.addEventListener('skysignal:telemetry', handleTelemetry);
    return () => window.removeEventListener('skysignal:telemetry', handleTelemetry);
  }, []);

  // Severe active events for Priority Watch (top 3)
  const priorityWatchEvents = useMemo(() => {
    return events
      .filter((e) => e.severity === 'severe' || e.has_contradiction)
      .slice(0, 3);
  }, [events]);

  const activeCount = events.length;
  const severeCount = events.filter((e) => e.severity === 'severe').length;
  const totalReportsCount = 2840;
  const pendingQueueCount = 12;

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio size={22} className="text-sky-600 animate-pulse" />
            <h1 className="text-[22px] font-black text-slate-900 tracking-tight font-['Outfit']">
              {isHindi ? 'आईएमडी स्थिति अवलोकन एवं कमांड सेंटर' : 'IMD Situational Overview Command Center'}
            </h1>
          </div>
          <p className="text-[13px] text-slate-500">
            {isHindi
              ? 'राष्ट्रीय बहु-स्रोत मौसम आसूचना, डॉप्लर रडार और ज़मीनी नागरिक अवलोकन का एकीकृत दृश्य।'
              : 'Real-time national meteorological fusion combining Doppler radar, citizen telemetry, and NLP social stream.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-mono text-slate-400">
            Telemetry Refresh: <strong className="text-slate-700">Real-Time</strong>
          </span>
          <Link
            to="/explorer"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-[12px] font-bold shadow-xs transition-colors"
          >
            <span>Full Radar Explorer</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* ── 1. Top KPI Grid (4 Glassmorphic Metric Cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
        {/* Card 1: Active Weather Events */}
        <div className="glass-card p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isHindi ? 'सक्रिय मौसम घटनाएं' : 'Active Weather Events'}
              </span>
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <Activity size={18} />
              </div>
            </div>
            <div className="text-[28px] font-black text-slate-900 tracking-tight mt-1">
              {activeCount}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
              <TrendingUp size={13} /> +3 detected 1h
            </span>
            {/* Sparkline SVG */}
            <svg viewBox="0 0 60 20" className="w-16 h-5 stroke-sky-500 fill-none stroke-2" aria-hidden="true">
              <path d="M 2,16 L 12,12 L 22,14 L 32,8 L 42,11 L 52,4 L 58,5" />
            </svg>
          </div>
        </div>

        {/* Card 2: Severe Hazards (Crimson Glowing Counter) */}
        <div className="glass-card p-5 rounded-2xl border border-red-200/90 bg-gradient-to-br from-red-50/40 to-white shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                {isHindi ? 'गंभीर मौसम आपदाएं' : 'Severe Hazards'}
              </span>
              <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                <ShieldAlert size={18} />
              </div>
            </div>
            <div className="text-[28px] font-black text-red-600 tracking-tight mt-1">
              {severeCount}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-red-100 text-[11px]">
            <span className="text-red-700 font-bold">Priority Red Alert</span>
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-extrabold text-[10px]">
              CRITICAL
            </span>
          </div>
        </div>

        {/* Card 3: Corroborated Reports Received */}
        <div className="glass-card p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isHindi ? 'सत्यापित रिपोर्ट प्राप्त' : 'Corroborated Reports'}
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Users size={18} />
              </div>
            </div>
            <div className="text-[28px] font-black text-slate-900 tracking-tight mt-1">
              {totalReportsCount.toLocaleString()}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
            <span>4 Independent Sources</span>
            <span className="font-bold text-sky-600">91.8% fused</span>
          </div>
        </div>

        {/* Card 4: Awaiting Verification Queue */}
        <Link
          to="/verification"
          className="glass-card p-5 rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/40 to-white shadow-sm hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                {isHindi ? 'सत्यापन कतार लंबित' : 'Awaiting Verification'}
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div className="text-[28px] font-black text-amber-700 tracking-tight mt-1">
              {pendingQueueCount}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-amber-100 text-[11px]">
            <span className="text-amber-800 font-semibold group-hover:underline flex items-center gap-1">
              <span>Open Triage Queue</span>
              <ArrowRight size={12} />
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
              ACTION REQ.
            </span>
          </div>
        </Link>
      </div>

      {/* ── 2. Interactive Leaflet Map + Priority Watch Panel ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        {/* Pan-India Leaflet Map */}
        <GeoRadarMap
          events={events}
          onSelectEvent={isAdmin ? setSelectedEvent : undefined}
          height="h-[520px]"
        />

        {/* Priority Watch Panel */}
        <div className="glass-card p-5 rounded-2xl border border-slate-200/90 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldAlert size={17} className="text-red-600" />
                <h3 className="text-[14px] font-black text-slate-900 font-['Outfit']">
                  Priority Watch Triage
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-black">
                HIGH RISK
              </span>
            </div>

            <div className="space-y-3 mt-3">
              {priorityWatchEvents.map((evt) => {
                const catMeta = CATEGORY_CONFIG[evt.category];
                const sevMeta = SEVERITY_CONFIG[evt.severity];

                return (
                  <div
                    key={evt.id}
                    onClick={isAdmin ? () => setSelectedEvent(evt) : undefined}
                    className={`p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70 transition-all space-y-2 group ${
                      isAdmin ? 'hover:bg-white hover:shadow-md hover:border-slate-300 cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${sevMeta?.className}`}>
                        {sevMeta?.icon} {sevMeta?.label}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full font-semibold capitalize"
                        style={{ backgroundColor: catMeta?.bgColor, color: catMeta?.color }}
                      >
                        {evt.category}
                      </span>
                    </div>

                    <h4 className="text-[13px] font-bold text-slate-900 leading-snug group-hover:text-sky-700 transition-colors">
                      {evt.title}
                    </h4>

                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <MapPin size={12} className="text-slate-400" />
                      <span>{evt.city}, {evt.state}</span>
                    </div>

                    {/* Contradiction Flag Banner */}
                    {evt.has_contradiction && (
                      <div className="p-2 rounded-lg bg-amber-100/70 border border-amber-200 text-amber-900 text-[10px] font-semibold flex items-center gap-1.5">
                        <AlertTriangle size={13} className="text-amber-700 shrink-0" />
                        <span>Sensor Telemetry Contradiction Detected</span>
                      </div>
                    )}

                    {/* Confidence Bar */}
                    <div>
                      <div className="flex justify-between text-[10px] font-bold mb-1">
                        <span className="text-slate-500">AI Confidence:</span>
                        <span className="text-sky-700">{evt.confidence}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full"
                          style={{ width: `${evt.confidence}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Link
            to="/explorer"
            className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[12px] font-bold transition-colors text-center block"
          >
            Explore All Hazards &rarr;
          </Link>
        </div>
      </div>

      {/* ── 3. "One Event. Multiple Perspectives" Fusion Widget ── */}
      <div className="glass-card p-6 rounded-3xl border border-sky-200/70 bg-gradient-to-r from-sky-50/40 via-white to-indigo-50/30 shadow-md space-y-4 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-sky-100">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-sky-600" />
              <h3 className="text-[16px] font-black text-slate-900 font-['Outfit']">
                One Event. Multiple Perspectives.
              </h3>
            </div>
            <p className="text-[12px] text-slate-500 mt-0.5">
              How SkySignal 2.0 fuses disparate data channels into verified ground-truth meteorological intelligence.
            </p>
          </div>

          <span className="self-start sm:self-center px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-[11px] font-extrabold">
            Cross-Corroboration Architecture
          </span>
        </div>

        {/* 4 Multi-Source Streams Pipeline */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[12px]">
          {/* Stream 1: Citizen Reports */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-sky-600 font-bold">
              <Users size={16} />
              <span>1. Ground Citizen</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Geotagged photos, video proof, and real-time localized water depth reports submitted within 30 seconds.
            </p>
            <div className="text-[10px] font-mono text-slate-400">Weight: 35%</div>
          </div>

          {/* Stream 2: Social Media Stream */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-purple-600 font-bold">
              <MessageCircle size={16} />
              <span>2. Social NLP Stream</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Filtered Twitter/X firehose with automated keyword extraction, semantic clustering, and $P_{'{misleading}'}$ scoring.
            </p>
            <div className="text-[10px] font-mono text-slate-400">Weight: 25%</div>
          </div>

          {/* Stream 3: IMD Doppler Radar */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 font-bold">
              <Radio size={16} />
              <span>3. IMD Doppler Radar</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Reflectivity returns (&gt;50 dBZ) and automated rain gauge readings from 28 national radar stations.
            </p>
            <div className="text-[10px] font-mono text-slate-400">Weight: 30%</div>
          </div>

          {/* Stream 4: Official News / Bulletins */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 font-bold">
              <FileText size={16} />
              <span>4. Agency Bulletins</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              NDMA regional disaster warnings and state emergency operations centre bulletins.
            </p>
            <div className="text-[10px] font-mono text-slate-400">Weight: 10%</div>
          </div>
        </div>
      </div>

      {/* ── 4. Active Events Table ── */}
      <div className="glass-card overflow-hidden rounded-3xl border border-slate-200/90 shadow-sm animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/60">
          <div>
            <h3 className="text-[15px] font-black text-slate-900 font-['Outfit']">
              Active Weather Events Ledger
            </h3>
            <p className="text-[11px] text-slate-500">
              Corroborated incidents across India with strict 3-tier severity and AI confidence rating.
            </p>
          </div>

          <Link
            to="/explorer"
            className="text-[12px] font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1"
          >
            <span>View All ({events.length})</span>
            <ExternalLink size={13} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5">Hazard / Event</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-3">Severity</th>
                <th className="py-3 px-3">Lifecycle</th>
                <th className="py-3 px-4">AI Confidence</th>
                <th className="py-3 px-3">Evidence Sources</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((evt) => {
                const catMeta = CATEGORY_CONFIG[evt.category];
                const sevMeta = SEVERITY_CONFIG[evt.severity];

                return (
                  <tr
                    key={evt.id}
                    onClick={isAdmin ? () => setSelectedEvent(evt) : undefined}
                    className={`transition-colors ${
                      isAdmin ? 'hover:bg-slate-50/80 cursor-pointer' : 'cursor-default hover:bg-slate-50/40'
                    }`}
                  >
                    {/* Hazard Icon & Title */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                          style={{ backgroundColor: catMeta?.color || '#0284c7' }}
                        >
                          <Radio size={14} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 leading-snug">
                            {evt.title}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">
                            {evt.id} · <span className="capitalize">{evt.category}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-800">{evt.city}</div>
                      <div className="text-[10px] text-slate-400">{evt.state}</div>
                    </td>

                    {/* Severity Pill */}
                    <td className="py-3.5 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${sevMeta?.className}`}>
                        {sevMeta?.icon} {sevMeta?.label}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-md font-bold text-[10px] uppercase bg-slate-100 text-slate-700">
                        {evt.lifecycle_status}
                      </span>
                    </td>

                    {/* Animated Confidence Bar (0–100%) */}
                    <td className="py-3.5 px-4">
                      <div className="w-36 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-slate-500">Confidence</span>
                          <span className="text-sky-700">{evt.confidence}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${evt.confidence}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Sources count */}
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-800">
                        {evt.independent_source_count} platforms
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {evt.evidence_summary?.citizen_reports ?? 12} citizen reports
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-5 text-right">
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(evt);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          Review Details
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">
                          Public View
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Event Detail Drawer (Admin Only) ── */}
      {isAdmin && selectedEvent && (
        <EventDetailDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onStatusChange={(id, newStatus) => {
            setEvents((prev) =>
              prev.map((e) => (e.id === id ? { ...e, lifecycle_status: newStatus as any } : e))
            );
          }}
        />
      )}
    </div>
  );
}
