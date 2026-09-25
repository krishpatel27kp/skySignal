/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Event Explorer Page
   National Weather Intelligence Platform (IMD / SIH26069)
   High-density filterable radar & multi-dimensional queries
   ═══════════════════════════════════════════════════════ */

import { useState, useMemo } from 'react';
import {
  Search,
  Download,
  SlidersHorizontal,
  Table as TableIcon,
  Map as MapIcon,
  Grid as GridIcon,
  ShieldAlert,
  Compass,
  CheckCircle2,
  Layers,
  MapPin,
} from 'lucide-react';
import GeoRadarMap from '../components/dashboard/GeoRadarMap';
import EventDetailDrawer from '../components/events/EventDetailDrawer';
import { mockWeatherEvents } from '../lib/mockData';
import { CATEGORY_CONFIG, SEVERITY_CONFIG } from '../data/mock';

export default function EventExplorerPage() {

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'time' | 'severity' | 'confidence' | 'sources'>('time');
  const [viewMode, setViewMode] = useState<'table' | 'map' | 'cards'>('table');
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [events, setEvents] = useState(mockWeatherEvents);
  const [isExporting, setIsExporting] = useState(false);

  // Filter options
  const statesList = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.state))).sort();
  }, [events]);

  // Filtered & Sorted Events
  const filteredEvents = useMemo(() => {
    return events
      .filter((evt) => {
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchTitle = evt.title.toLowerCase().includes(q);
          const matchCity = evt.city.toLowerCase().includes(q);
          const matchState = evt.state.toLowerCase().includes(q);
          if (!matchTitle && !matchCity && !matchState) return false;
        }
        if (selectedCategory !== 'all' && evt.category !== selectedCategory) return false;
        if (selectedSeverity !== 'all' && evt.severity !== selectedSeverity) return false;
        if (selectedStatus !== 'all' && evt.lifecycle_status !== selectedStatus) return false;
        if (selectedState !== 'all' && evt.state !== selectedState) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'severity') {
          const rank = { severe: 3, moderate: 2, minor: 1 };
          return rank[b.severity] - rank[a.severity];
        }
        if (sortBy === 'confidence') {
          return b.confidence - a.confidence;
        }
        if (sortBy === 'sources') {
          return b.independent_source_count - a.independent_source_count;
        }
        return new Date(b.last_updated_at).getTime() - new Date(a.last_updated_at).getTime();
      });
  }, [events, search, selectedCategory, selectedSeverity, selectedStatus, selectedState, sortBy]);

  // Export handlers
  const handleExportJSON = () => {
    setIsExporting(true);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredEvents, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `SkySignal_Events_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setTimeout(() => setIsExporting(false), 800);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedCategory('all');
    setSelectedSeverity('all');
    setSelectedStatus('all');
    setSelectedState('all');
    setSortBy('time');
  };

  const severeCount = filteredEvents.filter((e) => e.severity === 'severe').length;
  const avgConfidence = filteredEvents.length
    ? Math.round(filteredEvents.reduce((acc, e) => acc + e.confidence, 0) / filteredEvents.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Compass size={22} className="text-[var(--color-primary-500)]" />
            <h1 className="text-[22px] font-extrabold text-[var(--color-text-primary)] tracking-tight">
              Event Explorer & Intelligence Radar
            </h1>
          </div>
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            High-density meteorological query engine with multi-dimensional spatiotemporal filters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'table'
                  ? 'bg-[var(--color-primary-500)] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table Grid View"
            >
              <TableIcon size={14} />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`p-1.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'map'
                  ? 'bg-[var(--color-primary-500)] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Interactive Map View"
            >
              <MapIcon size={14} />
              <span className="hidden sm:inline">Map</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'cards'
                  ? 'bg-[var(--color-primary-500)] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Visual Cards View"
            >
              <GridIcon size={14} />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>

          <button
            onClick={handleExportJSON}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-[12px] font-semibold hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Download size={14} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* ── Metric Snapshot Pills ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in">
        <div className="glass-card p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Filtered Events</div>
            <div className="text-[20px] font-extrabold text-slate-900">{filteredEvents.length}</div>
          </div>
          <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
            <Layers size={18} />
          </div>
        </div>

        <div className="glass-card p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Severe Alerts</div>
            <div className="text-[20px] font-extrabold text-red-600">{severeCount}</div>
          </div>
          <div className="p-2 rounded-lg bg-red-50 text-red-600">
            <ShieldAlert size={18} />
          </div>
        </div>

        <div className="glass-card p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Mean AI Confidence</div>
            <div className="text-[20px] font-extrabold text-emerald-600">{avgConfidence}%</div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="glass-card p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Active Regions</div>
            <div className="text-[20px] font-extrabold text-slate-900">{statesList.length}</div>
          </div>
          <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
            <MapPin size={18} />
          </div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="glass-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Keyword Search */}
          <div className="relative lg:col-span-2">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, city, or state..."
              className="w-full pl-9 pr-3 py-2 text-[12px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 text-[12px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 font-medium"
              aria-label="Filter category"
            >
              <option value="all">All Categories (7)</option>
              <option value="rainfall">🌧️ Rainfall</option>
              <option value="thunderstorm">⚡ Thunderstorm</option>
              <option value="flooding">🌊 Flooding</option>
              <option value="heatwave">🌡️ Heatwave</option>
              <option value="fog">🌫️ Fog</option>
              <option value="dust storm">🌪️ Dust Storm</option>
              <option value="strong wind">💨 Strong Wind</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full py-2 px-3 text-[12px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 font-medium"
              aria-label="Filter severity"
            >
              <option value="all">All Severities (3)</option>
              <option value="severe">◆ Severe Only</option>
              <option value="moderate">▲ Moderate</option>
              <option value="minor">● Minor</option>
            </select>
          </div>

          {/* State / Region Filter */}
          <div>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full py-2 px-3 text-[12px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 font-medium"
              aria-label="Filter state"
            >
              <option value="all">All States (Pan-India)</option>
              {statesList.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Secondary Filter Row: Status + Sorting + Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-[11px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-500 flex items-center gap-1">
              <SlidersHorizontal size={12} />
              Status:
            </span>
            {['all', 'active', 'emerging', 'confirmed', 'declining'].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2 py-0.5 rounded-full capitalize font-medium transition-colors ${
                  selectedStatus === st
                    ? 'bg-sky-600 text-white font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-none text-slate-700 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="time">Latest Telemetry</option>
                <option value="severity">Highest Severity</option>
                <option value="confidence">AI Confidence</option>
                <option value="sources">Sources Count</option>
              </select>
            </div>

            <button
              onClick={handleResetFilters}
              className="text-slate-400 hover:text-slate-700 underline font-medium cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* ── Main View Content ── */}
      {viewMode === 'map' && (
        <div className="animate-fade-in">
          <GeoRadarMap
            events={filteredEvents}
            onSelectEvent={setSelectedEvent}
            height="h-[560px]"
          />
        </div>
      )}

      {viewMode === 'table' && (
        <div className="glass-card overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left" role="table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Event ID / Title</th>
                  <th className="py-3 px-3">Hazard Category</th>
                  <th className="py-3 px-3">Severity</th>
                  <th className="py-3 px-3">Location</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">AI Confidence</th>
                  <th className="py-3 px-3">Evidence Sources</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[12px]">
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No events match your selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((evt) => {
                    const catMeta = CATEGORY_CONFIG[evt.category];
                    const sevMeta = SEVERITY_CONFIG[evt.severity];

                    return (
                      <tr
                        key={evt.id}
                        onClick={() => setSelectedEvent(evt)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{evt.title}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{evt.id}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize"
                            style={{ backgroundColor: catMeta?.bgColor, color: catMeta?.color }}
                          >
                            {evt.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sevMeta?.className}`}>
                            {sevMeta?.icon} {sevMeta?.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="text-slate-800 font-semibold">{evt.city}</div>
                          <div className="text-[10px] text-slate-400">{evt.state}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                            {evt.lifecycle_status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-sky-500 rounded-full"
                                style={{ width: `${evt.confidence}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700">
                              {evt.confidence}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="text-[11px] font-semibold text-slate-700">
                            {evt.independent_source_count} platforms
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {evt.evidence_summary?.citizen_reports ?? 12} citizen · {evt.evidence_summary?.social_posts ?? 25} social
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(evt);
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition-colors"
                          >
                            Inspect &rarr;
                          </button>
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

      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
          {filteredEvents.map((evt) => {
            const catMeta = CATEGORY_CONFIG[evt.category];
            const sevMeta = SEVERITY_CONFIG[evt.severity];

            return (
              <div
                key={evt.id}
                onClick={() => setSelectedEvent(evt)}
                className="glass-card p-4 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between border border-slate-200/80"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sevMeta?.className}`}>
                      {sevMeta?.icon} {sevMeta?.label}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                      style={{ backgroundColor: catMeta?.bgColor, color: catMeta?.color }}
                    >
                      {evt.category}
                    </span>
                  </div>

                  <h3 className="text-[14px] font-bold text-slate-800 mb-1 leading-snug">
                    {evt.title}
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-3">
                    <MapPin size={12} className="text-slate-400" />
                    <span>{evt.city}, {evt.state}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 mb-3 text-[11px] text-slate-600">
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-slate-500">Corroboration:</span>
                      <span className="font-bold text-slate-800">{evt.independent_source_count} Sources</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-500">AI Confidence:</span>
                      <span className="font-bold text-sky-600">{evt.confidence}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                  <span className="font-bold uppercase text-[9px] text-slate-400">
                    {evt.lifecycle_status}
                  </span>
                  <span className="font-semibold text-sky-600 hover:text-sky-800">
                    Inspect Telemetry &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Event Detail Drawer ── */}
      {selectedEvent && (
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
