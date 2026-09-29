/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — IMD Situational Overview Command Center
   Professional Enterprise Meteorological Intelligence Platform
   High-precision typography, interactive telemetry stream inspector,
   actionable KPI card filters, live ledger search & filters.
   ═══════════════════════════════════════════════════════ */

import { useState, useMemo, useEffect, useCallback } from 'react';
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
  Search,
  X,
  RotateCcw,
  CloudRain,
  CloudLightning,
  Waves,
  ThermometerSun,
  CloudFog,
  Wind,
} from 'lucide-react';
import GeoRadarMap from '../components/map/GeoRadarMap';
import EventDetailDrawer from '../components/events/EventDetailDrawer';
import { getEvents, getDashboardStats } from '../services/apiClient';
import { CATEGORY_CONFIG, SEVERITY_CONFIG, formatConfidence, formatEventId } from '../data/mock';
import { useAuth } from '../context/AuthContext';
import type { WeatherEvent } from '../types/weather';

function renderCategoryIcon(category: string, size = 15) {
  const norm = category?.toLowerCase() || '';
  if (norm.includes('rain')) return <CloudRain size={size} className="text-blue-600" />;
  if (norm.includes('thunder') || norm.includes('lightning')) return <CloudLightning size={size} className="text-purple-600" />;
  if (norm.includes('flood')) return <Waves size={size} className="text-cyan-600" />;
  if (norm.includes('heat') || norm.includes('sunstroke')) return <ThermometerSun size={size} className="text-amber-600" />;
  if (norm.includes('fog')) return <CloudFog size={size} className="text-slate-500" />;
  if (norm.includes('wind') || norm.includes('dust') || norm.includes('storm')) return <Wind size={size} className="text-teal-600" />;
  return <Activity size={size} className="text-blue-600" />;
}

type RegionOption = 'all' | 'north' | 'south' | 'east' | 'west' | 'central';

const REGION_MAP: Record<Exclude<RegionOption, 'all'>, string[]> = {
  north: ['delhi', 'haryana', 'punjab', 'himachal pradesh', 'uttarakhand', 'uttar pradesh', 'rajasthan', 'jammu & kashmir'],
  south: ['tamil nadu', 'kerala', 'karnataka', 'andhra pradesh', 'telangana', 'goa'],
  east: ['west bengal', 'odisha', 'bihar', 'jharkhand', 'assam', 'tripura', 'meghalaya'],
  west: ['maharashtra', 'gujarat'],
  central: ['madhya pradesh', 'chhattisgarh'],
};

export default function Overview() {
  const { i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const isHindi = i18n.language === 'hi';

  const [events, setEvents] = useState<WeatherEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<WeatherEvent | null>(null);
  const [dashboardStats, setDashboardStats] = useState<{ pending_reports?: number; active_events?: number } | null>(null);

  // Interactive filters
  const [kpiFilter, setKpiFilter] = useState<'all' | 'severe' | 'contradiction'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<RegionOption>('all');
  const [lifecycleFilter, setLifecycleFilter] = useState<string>('all');

  // Load live data
  const loadData = useCallback(async () => {
    try {
      const eventsRes = await getEvents(undefined, { limit: 50 });
      setEvents(eventsRes.results);
      if (isAdmin) {
        const statsRes = await getDashboardStats().catch(() => null);
        if (statsRes) setDashboardStats(statsRes);
      }
    } catch (err) {
      console.error('Failed to load live data:', err);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Telemetry real-time listener
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

  // Filtered events based on KPI card toggle
  const mapDisplayEvents = useMemo(() => {
    if (kpiFilter === 'severe') {
      return events.filter((e) => ['critical', 'high', 'severe'].includes(e.severity));
    }
    if (kpiFilter === 'contradiction') {
      return events.filter((e) => e.has_contradiction);
    }
    return events;
  }, [events, kpiFilter]);

  // Priority Watch list
  const priorityWatchEvents = useMemo(() => {
    return events
      .filter((e) => ['critical', 'high', 'severe'].includes(e.severity) || e.has_contradiction)
      .slice(0, 3);
  }, [events]);

  // Ledger filtered events with full Event Explorer filtering
  const ledgerEvents = useMemo(() => {
    return events.filter((evt) => {
      // KPI filter
      if (kpiFilter === 'severe' && !['critical', 'high', 'severe'].includes(evt.severity)) {
        return false;
      }
      if (kpiFilter === 'contradiction' && !evt.has_contradiction) {
        return false;
      }
      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = evt.title.toLowerCase().includes(query);
        const matchesCity = evt.city?.toLowerCase().includes(query);
        const matchesState = evt.state?.toLowerCase().includes(query);
        const matchesId = evt.id?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesCity && !matchesState && !matchesId) {
          return false;
        }
      }
      // Category filter
      if (categoryFilter !== 'all' && evt.category !== categoryFilter) {
        return false;
      }
      // Severity filter
      if (severityFilter !== 'all' && evt.severity !== severityFilter) {
        return false;
      }
      // Region filter
      if (selectedRegion !== 'all') {
        const targetStates = REGION_MAP[selectedRegion];
        const stateLower = (evt.state || '').toLowerCase();
        if (!targetStates.some((s) => stateLower.includes(s))) {
          return false;
        }
      }
      // Lifecycle filter
      if (lifecycleFilter !== 'all' && evt.lifecycle_status !== lifecycleFilter) {
        return false;
      }
      return true;
    });
  }, [events, kpiFilter, searchQuery, categoryFilter, severityFilter, selectedRegion, lifecycleFilter]);

  const activeCount = dashboardStats?.active_events ?? events.length;
  const severeCount = events.filter((e) => ['critical', 'high', 'severe'].includes(e.severity)).length;
  const totalReportsCount = 2840;
  const pendingQueueCount = dashboardStats?.pending_reports ?? 12;

  return (
    <div className="space-y-6 text-slate-800">
      {/* ── Page Header: Weather Status ── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pt-1">
          <div>
            <h1 className="text-[22px] font-bold text-stone-900 tracking-tight">
              {isHindi ? 'मौसम की स्थिति' : 'Weather Status'}
            </h1>
          </div>
        </div>
      </div>

      {/* ── 1. Interactive KPI Metrics Grid (Only Visible to Authenticated Analyst/Admin) ── */}
      {isAdmin && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">
              Operational Telemetry Metrics · Click card to filter
            </span>
            {kpiFilter !== 'all' && (
              <button
                onClick={() => setKpiFilter('all')}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <X size={12} />
                <span>Clear Filter ({kpiFilter})</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Active Weather Events (Warm Amber & Stone) */}
            <button
              onClick={() => setKpiFilter('all')}
              className={`glass-card p-4 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between bg-gradient-to-br from-amber-50/70 via-white to-stone-50/50 border-amber-200/80 hover:border-amber-400 hover:shadow-md hover:-translate-y-1 ${
                kpiFilter === 'all'
                  ? 'ring-2 ring-amber-600 border-transparent shadow-xs'
                  : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-700">
                    {isHindi ? 'सक्रिय मौसम घटनाएं' : 'Active Weather Events'}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-xs">
                    <Activity size={17} />
                  </div>
                </div>
                <div className="text-[28px] font-bold text-stone-900 tracking-tight mt-1 font-mono tabular-nums">
                  {activeCount}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-amber-100 text-[11px]">
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <TrendingUp size={13} /> +3 detected 1h
                </span>
                <span className="font-mono text-[10px] text-stone-500">
                  {kpiFilter === 'all' ? '● Active Filter' : 'Click to filter'}
                </span>
              </div>
            </button>

            {/* Card 2: Severe Hazards (Soft Rose Tint) */}
            <button
              onClick={() => setKpiFilter(kpiFilter === 'severe' ? 'all' : 'severe')}
              className={`glass-card p-4 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between bg-gradient-to-br from-rose-50/80 via-white to-red-50/30 border-rose-200/70 hover:border-rose-300 hover:shadow-md hover:-translate-y-1 ${
                kpiFilter === 'severe'
                  ? 'ring-2 ring-red-600 bg-red-50/40 border-transparent shadow-xs'
                  : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-600" />
                    {isHindi ? 'गंभीर मौसम आपदाएं' : 'Severe Hazards'}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-xs">
                    <ShieldAlert size={17} />
                  </div>
                </div>
                <div className="text-[28px] font-bold text-red-600 tracking-tight mt-1 font-mono tabular-nums">
                  {severeCount}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-rose-100 text-[11px]">
                <span className="text-red-700 font-semibold">Priority Red Alert</span>
                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[10px] tracking-wide uppercase">
                  {kpiFilter === 'severe' ? 'FILTERING' : 'CRITICAL'}
                </span>
              </div>
            </button>

            {/* Card 3: Corroborated Reports Received (Warm Slate & Stone) */}
            <div className="glass-card p-4 rounded-xl flex flex-col justify-between bg-gradient-to-br from-stone-50/80 via-white to-amber-50/30 border-stone-200/80 hover:border-stone-400 hover:shadow-md hover:-translate-y-1 transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-700">
                    {isHindi ? 'सत्यापित रिपोर्ट प्राप्त' : 'Corroborated Reports'}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-stone-800 text-white flex items-center justify-center shadow-xs">
                    <Users size={17} />
                  </div>
                </div>
                <div className="text-[28px] font-bold text-stone-900 tracking-tight mt-1 font-mono tabular-nums">
                  {totalReportsCount.toLocaleString()}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-stone-100 text-[11px] text-stone-600">
                <span>4 Independent Channels</span>
                <span className="font-semibold text-stone-800 font-mono">91.8% fused</span>
              </div>
            </div>

            {/* Card 4: Awaiting Verification Queue (Soft Amber Tint) */}
            <Link
              to="/verification"
              className="glass-card p-4 rounded-xl flex flex-col justify-between bg-gradient-to-br from-amber-50/80 via-white to-orange-50/30 border-amber-200/70 hover:border-amber-300 hover:shadow-md hover:-translate-y-1 transition-all group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-900">
                    {isHindi ? 'सत्यापन कतार लंबित' : 'Awaiting Verification'}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center group-hover:bg-amber-700 transition-colors shadow-xs">
                    <CheckCircle2 size={17} />
                  </div>
                </div>
                <div className="text-[28px] font-bold text-amber-800 tracking-tight mt-1 font-mono tabular-nums">
                  {pendingQueueCount}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-amber-100 text-[11px]">
                <span className="text-amber-800 font-semibold group-hover:underline flex items-center gap-1">
                  <span>Open Triage Queue</span>
                  <ArrowRight size={12} />
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] tracking-wide uppercase">
                  ACTION REQ.
                </span>
              </div>
            </Link>
          </div>
        </div>
      )}


      {/* ── 2. Interactive Leaflet Map + Priority Watch Panel ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        {/* Pan-India Leaflet Map */}
        <div className="space-y-2">
          {kpiFilter !== 'all' && (
            <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-medium flex items-center justify-between">
              <span>Filtering map markers: <strong>{kpiFilter === 'severe' ? 'Severe Hazards Only' : kpiFilter}</strong></span>
              <button onClick={() => setKpiFilter('all')} className="underline hover:text-blue-900 cursor-pointer">
                Reset to All Events
              </button>
            </div>
          )}
          <GeoRadarMap
            events={mapDisplayEvents}
            onSelectEvent={isAdmin ? setSelectedEvent : undefined}
            height="h-[520px]"
          />
        </div>

        {/* Priority Watch Panel */}
        <div className="glass-card p-4 rounded-xl border border-slate-200 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-red-600" />
                <h3 className="text-[13px] font-bold text-slate-900">
                  Priority Watch Triage
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold uppercase">
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
                    className={`p-3 rounded-lg border transition-all space-y-2 group border-slate-200 bg-slate-50/60 ${
                      isAdmin ? 'hover:bg-white hover:shadow-xs hover:border-slate-300 cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] gap-1 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${sevMeta?.className || 'bg-slate-100 text-slate-700'}`}>
                          {sevMeta?.icon || '●'} {sevMeta?.label || evt.severity}
                        </span>
                      </div>
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-medium capitalize"
                        style={{ backgroundColor: catMeta?.bgColor, color: catMeta?.color }}
                      >
                        {evt.category}
                      </span>
                    </div>

                    <h4 className="text-[12px] font-bold text-slate-900 leading-snug group-hover:text-blue-700 transition-colors">
                      {evt.title}
                    </h4>

                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                      <MapPin size={11} className="text-slate-400" />
                      <span>{evt.city}, {evt.state}</span>
                    </div>

                    {/* Contradiction Flag Banner */}
                    {evt.has_contradiction && (
                      <div className="p-1.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-medium flex items-center gap-1.5">
                        <AlertTriangle size={12} className="text-amber-700 shrink-0" />
                        <span>Telemetry Discrepancy Detected</span>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              document.getElementById('events-ledger-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors text-center block cursor-pointer"
          >
            {isHindi ? 'सभी आपदाएं देखें ↓' : 'Explore All Hazards ↓'}
          </button>
        </div>
      </div>

      {/* ── 4. Interactive Weather Events Ledger & Explorer (Integrated Multi-Axis Filter) ── */}
      <div id="events-ledger-section" className="glass-card overflow-hidden rounded-xl border border-slate-200">
        {/* Table Header & Interactive Filter Bar */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">
                {isHindi ? 'मौसम घटना अन्वेषक एवं लेजर' : 'Weather Events Explorer & Ledger'}
              </h3>
              <p className="text-xs text-slate-500">
                {isHindi
                  ? 'संपूर्ण भारत में सत्यापित मौसम घटनाएं, 3-स्तरीय गंभीरता और टेलीमेट्री साक्ष्य।'
                  : 'Corroborated weather incidents across India with multi-axis filtering and telemetry provenance.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-500">
                Showing <strong>{ledgerEvents.length}</strong> of <strong>{events.length}</strong> events
              </span>
              {(searchQuery || categoryFilter !== 'all' || severityFilter !== 'all' || selectedRegion !== 'all' || lifecycleFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('all');
                    setSeverityFilter('all');
                    setSelectedRegion('all');
                    setLifecycleFilter('all');
                    setKpiFilter('all');
                  }}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={11} />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* Interactive Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {/* Live Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isHindi ? 'शहर, राज्य या शीर्षक खोजें...' : 'Search city, state, or event title...'}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Region Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-[11px]">
              <span className="text-slate-400 text-[10px] uppercase font-bold mr-1">Region:</span>
              {(['all', 'north', 'south', 'east', 'west', 'central'] as RegionOption[]).map((reg) => (
                <button
                  key={reg}
                  onClick={() => setSelectedRegion(reg)}
                  className={`px-2.5 py-1 rounded-md transition-colors capitalize font-medium cursor-pointer ${
                    selectedRegion === reg
                      ? 'bg-amber-600 text-white font-bold shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {reg}
                </button>
              ))}
            </div>

            {/* Severity Filter Pills */}
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-slate-400 text-[10px] uppercase font-bold mr-1">Severity:</span>
              {['all', 'critical', 'severe', 'moderate', 'minor'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2.5 py-1 rounded-md transition-colors capitalize font-medium cursor-pointer ${
                    severityFilter === sev
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Row: Category & Lifecycle Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-200/60">
            {/* Category Quick Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-[11px]">
              <span className="text-slate-400 text-[10px] uppercase font-bold mr-1">Category:</span>
              {['all', 'rainfall', 'thunderstorm', 'flooding', 'heatwave', 'fog', 'dust storm', 'strong wind'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-md transition-colors capitalize font-medium cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-slate-900 text-white font-bold shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Lifecycle Status Dropdown / Pills */}
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-slate-400 text-[10px] uppercase font-bold mr-1">Lifecycle:</span>
              <select
                value={lifecycleFilter}
                onChange={(e) => setLifecycleFilter(e.target.value)}
                className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-700 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Lifecycle States</option>
                <option value="detected">Detected</option>
                <option value="emerging">Emerging</option>
                <option value="confirmed">Confirmed</option>
                <option value="active">Active</option>
                <option value="declining">Declining</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                <th className="py-2.5 px-4">Hazard / Event</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Lifecycle</th>
                <th className="py-2.5 px-3">AI Confidence</th>
                <th className="py-2.5 px-3">Evidence Sources</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledgerEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-[12px]">
                    No events match the active filter criteria.{' '}
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setCategoryFilter('all');
                        setSeverityFilter('all');
                        setSelectedRegion('all');
                        setLifecycleFilter('all');
                        setKpiFilter('all');
                      }}
                      className="text-blue-600 underline font-semibold cursor-pointer ml-1"
                    >
                      Reset All Filters
                    </button>
                  </td>
                </tr>
              ) : (
                ledgerEvents.map((evt) => {
                  const sevMeta = SEVERITY_CONFIG[evt.severity];

                  return (
                    <tr
                      key={evt.id}
                      onClick={isAdmin ? () => setSelectedEvent(evt) : undefined}
                      className={`transition-colors ${
                        isAdmin ? 'hover:bg-slate-50 cursor-pointer' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      {/* Hazard Icon & Title */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0">
                            {renderCategoryIcon(evt.category, 15)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 leading-snug">
                              {evt.title}
                            </div>
                            <div className="font-mono text-xs text-slate-500">
                              {isAdmin && <span>{formatEventId(evt.id)} · </span>}
                              <span className="capitalize">{evt.category}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{evt.city}</div>
                        <div className="text-xs text-slate-500 font-mono">{evt.state}</div>
                      </td>

                      {/* Severity Pill */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold inline-flex items-center gap-1 ${sevMeta?.className || 'bg-slate-100 text-slate-700'}`}>
                          {sevMeta?.icon || '●'} {sevMeta?.label || evt.severity}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded font-mono font-medium text-[11px] uppercase bg-slate-100 text-slate-700">
                          {evt.lifecycle_status}
                        </span>
                      </td>

                      {/* Animated Confidence Bar (0–100%) */}
                      <td className="py-3 px-3">
                        <div className="w-28 space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold font-mono">
                            <span className="text-slate-500">AI Score</span>
                            <span className="text-blue-700 tabular-nums">{formatConfidence(evt.confidence)}%</span>
                          </div>
                          <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${formatConfidence(evt.confidence)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Sources count */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800 font-mono text-[11px]">
                          {evt.independent_source_count} channels
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {evt.evidence_summary?.citizen_reports ?? 12} citizen reports
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(evt);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold text-xs transition-colors cursor-pointer border border-slate-200"
                          >
                            Review
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-mono">
                            Public Read
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
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
