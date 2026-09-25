/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Event Explorer Page
   National Weather Intelligence Platform (IMD / SIH26069)
   Multi-axis filter bar: Time range, Category multi-select pills,
   Region buttons (North, South, East, West, Central), Severity,
   Lifecycle state, Instant search with '/' shortcut.
   View mode toggle: "Split Map & Dense Grid" vs "Full Directory Table".
   ═══════════════════════════════════════════════════════ */

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  SlidersHorizontal,
  Table as TableIcon,
  LayoutGrid,
  Download,
  Calendar,
  MapPin,
  ExternalLink,
  RotateCcw,
  Check,
} from 'lucide-react';
import GeoRadarMap from '../components/map/GeoRadarMap';
import EventDetailDrawer from '../components/events/EventDetailDrawer';
import { mockWeatherEvents } from '../lib/mockData';
import { CATEGORY_CONFIG, SEVERITY_CONFIG } from '../data/mock';
import { useAuth } from '../context/AuthContext';
import type { WeatherEvent, WeatherCategory, Severity, LifecycleStatus } from '../types/weather';

type TimeRangeOption = '24h' | '7d' | 'custom';
type RegionOption = 'all' | 'north' | 'south' | 'east' | 'west' | 'central';
type ViewModeOption = 'split' | 'table';

const REGION_MAP: Record<Exclude<RegionOption, 'all'>, string[]> = {
  north: ['delhi', 'haryana', 'punjab', 'himachal pradesh', 'uttarakhand', 'uttar pradesh', 'rajasthan', 'jammu & kashmir'],
  south: ['tamil nadu', 'kerala', 'karnataka', 'andhra pradesh', 'telangana', 'goa'],
  east: ['west bengal', 'odisha', 'bihar', 'jharkhand', 'assam', 'tripura', 'meghalaya'],
  west: ['maharashtra', 'gujarat'],
  central: ['madhya pradesh', 'chhattisgarh'],
};

const ALL_CATEGORIES: WeatherCategory[] = [
  'rainfall',
  'thunderstorm',
  'flooding',
  'heatwave',
  'fog',
  'dust storm',
  'strong wind',
];

const LIFECYCLE_OPTIONS: { id: LifecycleStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All Lifecycle' },
  { id: 'detected', label: 'Detected' },
  { id: 'emerging', label: 'Emerging' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'active', label: 'Active' },
  { id: 'declining', label: 'Declining' },
  { id: 'resolved', label: 'Resolved' },
];

export default function EventExplorer() {
  const { isAdmin } = useAuth();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Filter States
  const [search, setSearch] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('7d');
  const [customStartDate, setCustomStartDate] = useState('2026-09-17');
  const [customEndDate, setCustomEndDate] = useState('2026-09-24');
  const [selectedCategories, setSelectedCategories] = useState<Set<WeatherCategory>>(new Set());
  const [selectedRegion, setSelectedRegion] = useState<RegionOption>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | 'all'>('all');
  const [selectedLifecycle, setSelectedLifecycle] = useState<LifecycleStatus | 'all'>('all');

  // View Mode: 'split' (Split Map & Dense Grid) vs 'table' (Full Directory Table)
  const [viewMode, setViewMode] = useState<ViewModeOption>('split');
  const [selectedEvent, setSelectedEvent] = useState<WeatherEvent | null>(null);

  // Keyboard shortcut '/' to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Multi-select category toggle
  const toggleCategory = (cat: WeatherCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const clearCategories = () => setSelectedCategories(new Set());

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return mockWeatherEvents.filter((evt) => {
      // 1. Text Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = evt.title.toLowerCase().includes(q);
        const matchCity = evt.city.toLowerCase().includes(q);
        const matchState = evt.state.toLowerCase().includes(q);
        const matchId = evt.id.toLowerCase().includes(q);
        if (!matchTitle && !matchCity && !matchState && !matchId) return false;
      }

      // 2. Category Multi-select (if empty, matches all)
      if (selectedCategories.size > 0 && !selectedCategories.has(evt.category)) {
        return false;
      }

      // 3. Region Filter
      if (selectedRegion !== 'all') {
        const targetStates = REGION_MAP[selectedRegion];
        const stateLower = evt.state.toLowerCase();
        if (!targetStates.some((s) => stateLower.includes(s))) {
          return false;
        }
      }

      // 4. Severity Filter
      if (selectedSeverity !== 'all' && evt.severity !== selectedSeverity) {
        return false;
      }

      // 5. Lifecycle Filter
      if (selectedLifecycle !== 'all' && evt.lifecycle_status !== selectedLifecycle) {
        return false;
      }

      // 6. Time Range
      if (timeRange === '24h') {
        const hoursAgo = (Date.now() - new Date(evt.last_updated_at).getTime()) / 3600000;
        if (hoursAgo > 24) return false;
      } else if (timeRange === 'custom') {
        const evtTime = new Date(evt.last_updated_at).getTime();
        const start = new Date(customStartDate).getTime();
        const end = new Date(customEndDate).getTime() + 86400000;
        if (evtTime < start || evtTime > end) return false;
      }

      return true;
    });
  }, [
    search,
    selectedCategories,
    selectedRegion,
    selectedSeverity,
    selectedLifecycle,
    timeRange,
    customStartDate,
    customEndDate,
  ]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearch('');
    setTimeRange('7d');
    setSelectedCategories(new Set());
    setSelectedRegion('all');
    setSelectedSeverity('all');
    setSelectedLifecycle('all');
  };

  // Export JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredEvents, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `SkySignal_Events_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const hasActiveFilters =
    search.trim() !== '' ||
    timeRange !== '7d' ||
    selectedCategories.size > 0 ||
    selectedRegion !== 'all' ||
    selectedSeverity !== 'all' ||
    selectedLifecycle !== 'all';

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <SlidersHorizontal size={22} className="text-sky-600" />
            <h1 className="text-[22px] font-black text-slate-900 tracking-tight font-['Outfit']">
              Historical Event Explorer & Spatial Directory
            </h1>
          </div>
          <p className="text-[13px] text-slate-500">
            Query across multi-sensor Doppler radar, ground observations, and NLP social intelligence archives.
          </p>
        </div>

        {/* View Mode Toggle & Export */}
        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-[12px] font-bold">
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid size={14} />
              <span>Split Map & Grid</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon size={14} />
              <span>Full Directory Table</span>
            </button>
          </div>

          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200/90 hover:bg-slate-50 rounded-xl text-[12px] font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer"
            title="Export filtered events as JSON"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* ── Multi-Axis Filter Bar ── */}
      <div className="glass-card p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
        {/* Row 1: Search + Time Range + Reset */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Instant Search with shortcut '/' */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, city, state, or event ID... (Press '/' to focus)"
              className="w-full pl-9 pr-12 py-2.5 text-[12px] bg-slate-50 border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">
              /
            </kbd>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={13} />
              Time:
            </span>
            <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200/70 text-[11px] font-bold">
              <button
                onClick={() => setTimeRange('24h')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  timeRange === '24h'
                    ? 'bg-sky-600 text-white shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last 24h
              </button>
              <button
                onClick={() => setTimeRange('7d')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  timeRange === '7d'
                    ? 'bg-sky-600 text-white shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setTimeRange('custom')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  timeRange === 'custom'
                    ? 'bg-sky-600 text-white shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Custom Range
              </button>
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer ml-1"
                title="Reset all active filters"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Custom Date Pickers (if Custom Range selected) */}
        {timeRange === 'custom' && (
          <div className="flex items-center gap-3 p-3 bg-sky-50/60 rounded-xl border border-sky-100 text-[12px] animate-fade-in">
            <span className="font-bold text-sky-800">Date Bounds:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1 bg-white border border-sky-200 rounded-lg text-slate-700 font-medium"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1 bg-white border border-sky-200 rounded-lg text-slate-700 font-medium"
            />
          </div>
        )}

        {/* Row 2: Category Multi-Select Pills */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold uppercase tracking-wider text-slate-400">
              Hazard Categories (Multi-Select):
            </span>
            {selectedCategories.size > 0 && (
              <button
                onClick={clearCategories}
                className="text-sky-600 hover:text-sky-800 font-bold cursor-pointer"
              >
                Clear Selected ({selectedCategories.size})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {ALL_CATEGORIES.map((cat) => {
              const isSelected = selectedCategories.has(cat);
              const emojis: Record<WeatherCategory, string> = {
                rainfall: '🌧️',
                thunderstorm: '⚡',
                flooding: '🌊',
                heatwave: '🌡️',
                fog: '🌫️',
                'dust storm': '🌪️',
                'strong wind': '💨',
              };

              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold capitalize transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-sky-600 text-white shadow-xs ring-2 ring-sky-300'
                      : 'bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 border border-slate-200/60'
                  }`}
                >
                  <span>{emojis[cat]}</span>
                  <span>{cat}</span>
                  {isSelected && <Check size={12} className="ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Region Buttons + Severity + Lifecycle */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100 text-[12px]">
          {/* Region Buttons */}
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
              Geographic Region
            </span>
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200/70 text-[11px] font-bold flex-wrap">
              {(['all', 'north', 'south', 'east', 'west', 'central'] as RegionOption[]).map((reg) => (
                <button
                  key={reg}
                  onClick={() => setSelectedRegion(reg)}
                  className={`px-2.5 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                    selectedRegion === reg
                      ? 'bg-white text-slate-900 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {reg}
                </button>
              ))}
            </div>
          </div>

          {/* Severity Filter */}
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
              Severity Tier
            </span>
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200/70 text-[11px] font-bold">
              {(['all', 'minor', 'moderate', 'severe'] as const).map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSelectedSeverity(sev)}
                  className={`px-2.5 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                    selectedSeverity === sev
                      ? sev === 'severe'
                        ? 'bg-rose-600 text-white font-black shadow-2xs'
                        : sev === 'moderate'
                        ? 'bg-sky-600 text-white font-black shadow-2xs'
                        : sev === 'minor'
                        ? 'bg-emerald-600 text-white font-black shadow-2xs'
                        : 'bg-white text-slate-900 font-black shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* Lifecycle State */}
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
              Lifecycle State
            </span>
            <select
              value={selectedLifecycle}
              onChange={(e) => setSelectedLifecycle(e.target.value as any)}
              className="w-full py-1.5 px-3 text-[12px] bg-slate-50 border border-slate-200/90 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              aria-label="Filter by lifecycle"
            >
              {LIFECYCLE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Query Matches Counter Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-medium">
          <span>
            Matched <strong className="text-slate-800">{filteredEvents.length}</strong> of{' '}
            {mockWeatherEvents.length} national weather incidents
          </span>
          <span className="font-mono text-[10px]">
            Spatial Engine: PostGIS + Leaflet MarkerCluster
          </span>
        </div>
      </div>

      {/* ── View Mode: "Split Map & Dense Grid" vs "Full Directory Table" ── */}
      {viewMode === 'split' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Left Column: Interactive Radar Map (lg:col-span-7) */}
          <div className="lg:col-span-7 glass-card rounded-3xl overflow-hidden border border-slate-200/90 shadow-sm p-1 min-h-[560px]">
            <GeoRadarMap
              events={filteredEvents}
              onSelectEvent={isAdmin ? (evt) => setSelectedEvent(evt) : undefined}
              height="h-[560px]"
            />
          </div>

          {/* Right Column: Dense Grid List (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-3 max-h-[580px] overflow-y-auto pr-1">
            {filteredEvents.length === 0 ? (
              <div className="glass-card py-16 text-center text-slate-400 rounded-2xl border border-slate-200">
                No events match this query combination.
              </div>
            ) : (
              filteredEvents.map((evt) => {
                const catMeta = CATEGORY_CONFIG[evt.category];
                const sevMeta = SEVERITY_CONFIG[evt.severity];

                return (
                  <div
                    key={evt.id}
                    onClick={isAdmin ? () => setSelectedEvent(evt) : undefined}
                    className={`glass-card p-4 rounded-2xl border border-slate-200/80 transition-all space-y-2.5 ${
                      isAdmin ? 'hover:border-slate-300 hover:shadow-xs cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-black text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded">
                          {evt.id}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-extrabold capitalize"
                          style={{ backgroundColor: catMeta?.bgColor, color: catMeta?.color }}
                        >
                          {evt.category}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          evt.severity === 'severe'
                            ? 'bg-rose-100 text-rose-800'
                            : evt.severity === 'moderate'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {sevMeta?.icon} {evt.severity}
                      </span>
                    </div>

                    <h4 className="text-[13px] font-black text-slate-900 font-['Outfit'] leading-snug">
                      {evt.title}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1 text-slate-600">
                        <MapPin size={12} className="text-sky-600" />
                        <span>{evt.city}, {evt.state}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sky-700">
                          {evt.confidence}% AI Conf
                        </span>
                        <span>•</span>
                        <span className="text-slate-400">
                          {evt.independent_source_count} Sources
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Full Directory Table View */
        <div className="glass-card overflow-hidden rounded-3xl border border-slate-200/90 shadow-sm animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-5">Incident / Hazard</th>
                  <th className="py-3 px-3">Location & Region</th>
                  <th className="py-3 px-3">Severity</th>
                  <th className="py-3 px-3">Lifecycle State</th>
                  <th className="py-3 px-4">AI Confidence</th>
                  <th className="py-3 px-3">Evidence Sources</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No events match the selected multi-axis filters.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((evt) => {
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
                              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 text-sm shadow-2xs"
                              style={{ backgroundColor: catMeta?.bgColor, color: catMeta?.color }}
                            >
                              {catMeta?.icon === 'CloudRain' ? '🌧️' : catMeta?.icon === 'Waves' ? '🌊' : catMeta?.icon === 'Thermometer' ? '🌡️' : '⚡'}
                            </div>
                            <div>
                              <span className="font-mono text-[10px] text-slate-400 font-bold block">
                                {evt.id}
                              </span>
                              <span className="font-extrabold text-slate-900 text-[13px] hover:text-sky-600 transition-colors">
                                {evt.title}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5 font-medium text-slate-700">
                            <MapPin size={13} className="text-sky-600 shrink-0" />
                            <span>{evt.city}, {evt.state}</span>
                          </div>
                        </td>

                        {/* Severity */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase flex items-center gap-1 w-fit ${
                              evt.severity === 'severe'
                                ? 'bg-rose-100 text-rose-800'
                                : evt.severity === 'moderate'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            <span>{sevMeta?.icon}</span>
                            <span>{evt.severity}</span>
                          </span>
                        </td>

                        {/* Lifecycle */}
                        <td className="py-3.5 px-3">
                          <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 capitalize">
                            {evt.lifecycle_status}
                          </span>
                        </td>

                        {/* Confidence Progress Bar */}
                        <td className="py-3.5 px-4 min-w-[140px]">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-mono font-bold">
                              <span className="text-slate-600">{evt.confidence}%</span>
                              <span className="text-[10px] text-slate-400">Model Fusion</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  evt.confidence >= 90
                                    ? 'bg-emerald-500'
                                    : evt.confidence >= 75
                                    ? 'bg-sky-500'
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${evt.confidence}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Evidence Sources */}
                        <td className="py-3.5 px-3">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-extrabold text-[11px]">
                            {evt.independent_source_count} Platforms
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-5 text-right">
                          {isAdmin ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(evt);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>Details</span>
                              <ExternalLink size={12} />
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">Read-Only</span>
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
      )}

      {/* ── Slide-Over Event Detail Drawer (Admin Only) ── */}
      {isAdmin && selectedEvent && (
        <EventDetailDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
