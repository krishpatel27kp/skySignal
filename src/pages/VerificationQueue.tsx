/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Verification Queue Page
   Analyst Triage Center for incoming crowd & sensor reports
   Bulk Action Toolbar, 3 Triage Filter Tabs, Misleading Probability Meter,
   Media Lightbox, Evidence Inspector Modal, and Zero-State View.
   ═══════════════════════════════════════════════════════ */

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  ShieldCheck,
  ShieldAlert,
  Clock,
  MapPin,
  CheckSquare,
  Square,
  Sparkles,
  RefreshCw,
  Eye,
  X,
  FileText,
  Radio,
  Filter,
} from 'lucide-react';
import { getReports, bulkActionReports } from '../services/mockApi';
import { CATEGORY_CONFIG } from '../data/mock';
import type { Report, WeatherCategory } from '../types/weather';

function getRelativeTime(dateStr: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type TriageTab = 'pending' | 'high_risk' | 'delayed';

export default function VerificationQueue() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Triage filter tabs: 'pending' | 'high_risk' | 'delayed'
  const [activeTab, setActiveTab] = useState<TriageTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Modals
  const [previewMedia, setPreviewMedia] = useState<string | null>(null);
  const [evidenceReport, setEvidenceReport] = useState<Report | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Load reports
  const fetchReports = async () => {
    setLoading(true);
    const data = await getReports();
    setReports(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Filtered reports according to the 3 Triage Filter Tabs
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      // Triage Tabs:
      if (activeTab === 'pending') {
        if (r.status !== 'pending') return false;
      } else if (activeTab === 'high_risk') {
        // High Misleading Risk (p_misleading > 0.7)
        if (r.p_misleading <= 0.7) return false;
      } else if (activeTab === 'delayed') {
        // Delayed / Offline Synced
        if (!r.synced_late) return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && r.event_category !== categoryFilter) return false;

      // Text / Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchText = r.raw_text.toLowerCase().includes(q);
        const matchCity = r.city.toLowerCase().includes(q);
        const matchHandle = r.source_handle.toLowerCase().includes(q);
        const matchId = r.id.toLowerCase().includes(q);
        if (!matchText && !matchCity && !matchHandle && !matchId) return false;
      }

      return true;
    });
  }, [reports, activeTab, categoryFilter, searchQuery]);

  // Tab counts
  const pendingCount = useMemo(() => reports.filter((r) => r.status === 'pending').length, [reports]);
  const highRiskCount = useMemo(() => reports.filter((r) => r.p_misleading > 0.7).length, [reports]);
  const delayedCount = useMemo(() => reports.filter((r) => r.synced_late).length, [reports]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredReports.length && filteredReports.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReports.map((r) => r.id)));
    }
  };

  // Bulk actions
  const executeBulkAction = async (action: 'verify' | 'reject') => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await bulkActionReports({
      report_ids: ids,
      action,
      analyst_email: 'analyst.delhi@imd.gov.in',
    });

    setReports((prev) =>
      prev.map((r) => (selectedIds.has(r.id) ? { ...r, status: action === 'verify' ? 'verified' : 'rejected' } : r))
    );
    setSelectedIds(new Set());

    setActionSuccessMessage(
      `Successfully marked ${ids.length} report(s) as ${action === 'verify' ? 'Approved (Verified)' : 'Rejected'}.`
    );
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  // Single action
  const executeSingleAction = async (id: string, action: 'verify' | 'reject') => {
    await bulkActionReports({ report_ids: [id], action, analyst_email: 'analyst.delhi@imd.gov.in' });
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: action === 'verify' ? 'verified' : 'rejected' } : r))
    );
    setActionSuccessMessage(
      `Report ${id} marked as ${action === 'verify' ? 'Approved' : 'Rejected'}.`
    );
    setTimeout(() => setActionSuccessMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={22} className="text-sky-600 animate-pulse" />
            <h1 className="text-[22px] font-black text-slate-900 tracking-tight font-['Outfit']">
              IMD Operational Verification Queue
            </h1>
          </div>
          <p className="text-[13px] text-slate-500">
            Real-time human-in-the-loop analyst triage gate with automated NLP hallucination and misleading risk filtering.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchReports}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200/90 rounded-xl text-[12px] font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-sky-600' : ''} />
            <span>Sync Feed</span>
          </button>
        </div>
      </div>

      {/* ── Toast Success Notification ── */}
      {actionSuccessMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/90 text-emerald-800 text-[13px] font-semibold flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── 1. Triage Filter Tabs & Search Controls ── */}
      <div className="glass-card p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          {/* 3 Main Triage Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 overflow-x-auto">
            <button
              onClick={() => {
                setActiveTab('pending');
                setSelectedIds(new Set());
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Clock size={14} className={activeTab === 'pending' ? 'text-amber-500' : 'text-slate-400'} />
              <span>All Pending</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200/70 text-slate-600'
              }`}>
                {pendingCount}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('high_risk');
                setSelectedIds(new Set());
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'high_risk'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-rose-700 hover:bg-white/50'
              }`}
            >
              <ShieldAlert size={14} className="text-rose-600" />
              <span>High Misleading Risk (p &gt; 0.7)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'high_risk' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200/70 text-slate-600'
              }`}>
                {highRiskCount}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('delayed');
                setSelectedIds(new Set());
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'delayed'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-indigo-700 hover:bg-white/50'
              }`}
            >
              <Radio size={14} className="text-indigo-600" />
              <span>Delayed / Offline Synced</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'delayed' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200/70 text-slate-600'
              }`}>
                {delayedCount}
              </span>
            </button>
          </div>

          {/* Quick search input */}
          <div className="relative w-full lg:w-72">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search keyword, city, or ID..."
              className="w-full pl-9 pr-3.5 py-2 text-[12px] bg-slate-50 border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800"
            />
          </div>
        </div>

        {/* Hazard Category Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          <span className="font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
            <Filter size={12} />
            Hazard Filter:
          </span>
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Hazards
          </button>
          {(['rainfall', 'thunderstorm', 'flooding', 'heatwave', 'fog', 'dust storm', 'strong wind'] as WeatherCategory[]).map((cat) => {
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
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors capitalize flex items-center gap-1 cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{emojis[cat]}</span>
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2. Bulk Action Toolbar (Floating Sticky) ── */}
      {selectedIds.size > 0 && (
        <div className="sticky top-20 z-30 p-3.5 rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-xl bg-sky-500/20 border border-sky-400/30 text-sky-300 text-[12px] font-black tracking-wide">
              {selectedIds.size} Selected
            </span>
            <span className="text-[12px] font-semibold text-slate-300 hidden sm:inline">
              Batch Decision Actions:
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => executeBulkAction('verify')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <CheckCircle2 size={16} />
              <span>Approve Selected ({selectedIds.size})</span>
            </button>
            <button
              onClick={() => executeBulkAction('reject')}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[12px] font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <XCircle size={16} />
              <span>Reject Selected</span>
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-[12px] font-semibold transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── List / Select All Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 text-[12px] font-bold text-slate-600">
        <button
          onClick={handleSelectAll}
          className="flex items-center gap-2 text-slate-700 hover:text-slate-900 cursor-pointer"
        >
          {selectedIds.size === filteredReports.length && filteredReports.length > 0 ? (
            <CheckSquare size={17} className="text-sky-600" />
          ) : (
            <Square size={17} className="text-slate-400" />
          )}
          <span>Select All on View ({filteredReports.length})</span>
        </button>

        <span className="text-[11px] text-slate-400 font-medium">
          Showing {filteredReports.length} {activeTab.replace('_', ' ')} incident reports
        </span>
      </div>

      {/* ── 3. Zero-State View OR Triage Cards List ── */}
      {filteredReports.length === 0 ? (
        <div className="glass-card py-20 px-6 rounded-3xl border border-slate-200/90 text-center animate-fade-in shadow-xs">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-4 border border-emerald-200">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-[20px] font-black text-slate-900 font-['Outfit'] mb-2">
            You're all caught up! No pending reports require triage.
          </h2>
          <p className="text-[13px] text-slate-500 max-w-md mx-auto mb-6">
            All meteorological observations in this filter category have been verified or resolved. New citizen telemetry and social stream signals will populate automatically.
          </p>
          <button
            onClick={() => {
              setActiveTab('pending');
              setCategoryFilter('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 bg-sky-600 text-white rounded-xl text-[12px] font-bold hover:bg-sky-700 transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <RefreshCw size={14} />
            <span>Reset All Filters</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredReports.map((report) => {
            const isSelected = selectedIds.has(report.id);
            const catConfig = CATEGORY_CONFIG[report.event_category];
            const pMisleading = report.p_misleading;
            const isHighMisleading = pMisleading > 0.7;
            const isLowMisleading = pMisleading < 0.3;
            const meterPct = Math.round(pMisleading * 100);

            return (
              <div
                key={report.id}
                onClick={() => handleToggleSelect(report.id)}
                className={`glass-card p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 ${
                  isSelected
                    ? 'border-sky-500 bg-sky-50/50 shadow-md ring-2 ring-sky-500/30'
                    : isHighMisleading
                    ? 'border-rose-200 bg-rose-50/20 hover:border-rose-300'
                    : 'border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                {/* Checkbox + Body Details */}
                <div className="flex items-start gap-4 flex-1">
                  {/* Select Checkbox */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSelect(report.id);
                    }}
                    className="mt-1 cursor-pointer shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare size={19} className="text-sky-600" />
                    ) : (
                      <Square size={19} className="text-slate-300 hover:text-slate-500" />
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    {/* Top Row: Meta Badges */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="font-mono text-[10px] text-slate-500 font-extrabold px-2 py-0.5 bg-slate-100 rounded-md">
                        {report.id}
                      </span>

                      {/* Source Platform Badge */}
                      <span className="px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 capitalize flex items-center gap-1">
                        <span className="text-[12px]">
                          {report.source_platform === 'citizen_app'
                            ? '📱'
                            : report.source_platform === 'twitter'
                            ? '🐦'
                            : report.source_platform === 'news'
                            ? '📰'
                            : report.source_platform === 'imd_official'
                            ? '📡'
                            : '📺'}
                        </span>
                        <span>{report.source_platform.replace('_', ' ')}:</span>
                        <strong className="text-slate-900">{report.source_handle}</strong>
                      </span>

                      {/* Category Badge */}
                      <span
                        className="px-2.5 py-0.5 rounded-full font-bold capitalize flex items-center gap-1"
                        style={{ backgroundColor: catConfig?.bgColor, color: catConfig?.color }}
                      >
                        <span>{catConfig?.icon}</span>
                        <span>{report.event_category}</span>
                      </span>

                      {/* Delayed Sync Flag */}
                      {report.synced_late && (
                        <span className="px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] flex items-center gap-1">
                          <Radio size={10} className="animate-pulse" />
                          <span>Delayed Offline Sync</span>
                        </span>
                      )}

                      {/* Status Badge */}
                      <span
                        className={`px-2 py-0.5 rounded-full font-black uppercase text-[10px] ${
                          report.status === 'verified'
                            ? 'bg-emerald-100 text-emerald-800'
                            : report.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {report.status}
                      </span>
                    </div>

                    {/* Citizen / Social text quote with Category Icon & relative timestamp */}
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg shrink-0 mt-0.5">{catConfig?.icon}</span>
                      <blockquote className="text-[13px] text-slate-800 font-medium leading-relaxed italic">
                        "{report.raw_text}"
                      </blockquote>
                    </div>

                    {/* Location, Lat/Lon, and Relative Time */}
                    <div className="flex items-center gap-3.5 text-[11px] text-slate-400 font-medium flex-wrap pt-0.5">
                      <div className="flex items-center gap-1 text-slate-600">
                        <MapPin size={12} className="text-sky-600" />
                        <span>{report.city}, {report.state}</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1 text-slate-500">
                        <Clock size={12} />
                        <span>{getRelativeTime(report.reported_at)}</span>
                        <span className="text-slate-400">({new Date(report.reported_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                      </div>
                      <span>•</span>
                      <div className="font-mono text-[10px] text-slate-400">
                        GPS: {report.lat.toFixed(3)}°N, {report.lon.toFixed(3)}°E
                      </div>
                    </div>

                    {/* Misleading Probability Meter (Low: <0.3 green, High: >0.7 red) */}
                    <div className="pt-2 max-w-sm">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-bold flex items-center gap-1 text-slate-500">
                          {isHighMisleading && <AlertTriangle size={12} className="text-rose-600" />}
                          Misleading Probability ($P_{'{misleading}'}$):
                        </span>
                        <span
                          className={`font-black font-mono text-[12px] ${
                            isHighMisleading
                              ? 'text-rose-600'
                              : isLowMisleading
                              ? 'text-emerald-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {meterPct}% {isHighMisleading ? '(High Risk)' : isLowMisleading ? '(Credible)' : '(Moderate)'}
                        </span>
                      </div>

                      {/* Colored Progress Bar Meter */}
                      <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isHighMisleading
                              ? 'bg-rose-500'
                              : isLowMisleading
                              ? 'bg-emerald-500'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.max(5, meterPct)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Media preview thumbnail + Quick Actions */}
                <div className="flex items-center gap-3 self-end lg:self-center shrink-0">
                  {/* Media Thumbnail with Lightbox click */}
                  {report.media_urls.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewMedia(report.media_urls[0]);
                      }}
                      className="relative group/media overflow-hidden rounded-xl border border-slate-200/90 w-16 h-16 bg-slate-100 flex items-center justify-center cursor-pointer shadow-xs"
                      title="Inspect ground media evidence"
                    >
                      <img
                        src={report.media_urls[0]}
                        alt="Incident observation evidence"
                        className="w-full h-full object-cover group-hover/media:scale-110 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover/media:opacity-100 transition-opacity">
                        <Eye size={18} className="text-white" />
                      </div>
                    </button>
                  )}

                  {/* "View Evidence" Inspector button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEvidenceReport(report);
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold border border-slate-200/80 transition-colors flex items-center gap-1 cursor-pointer"
                    title="View Evidence Details"
                  >
                    <FileText size={13} className="text-slate-500" />
                    <span>View Evidence</span>
                  </button>

                  {/* Single-Click Approve (Checkmark) & Reject (X) */}
                  <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
                    {report.status !== 'verified' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          executeSingleAction(report.id, 'verify');
                        }}
                        className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 border border-emerald-200/80 transition-colors cursor-pointer"
                        title="Approve Report"
                        aria-label="Approve report"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                    )}

                    {report.status !== 'rejected' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          executeSingleAction(report.id, 'reject');
                        }}
                        className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200/80 transition-colors cursor-pointer"
                        title="Reject Report"
                        aria-label="Reject report"
                      >
                        <XCircle size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Media Lightbox Modal (Portal to body at z-[110]) ── */}
      {previewMedia &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setPreviewMedia(null)}
          >
            <div
              className="relative max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90">
                <span className="text-[13px] font-bold text-white flex items-center gap-2">
                  <Sparkles size={15} className="text-sky-400" />
                  Attached Observation Lightbox
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
                  alt="High-resolution attachment inspection"
                  className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl"
                />
              </div>

              <div className="p-4 bg-slate-900 text-center text-slate-400 text-[12px] border-t border-slate-800">
                High-resolution geotagged evidence attached to ground observation.
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── View Evidence Inspector Modal (Portal to body at z-[100]) ── */}
      {evidenceReport &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setEvidenceReport(null)}
          >
            <div
              className="relative max-w-2xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-black text-slate-900 font-['Outfit']">
                      Evidence Dossier — {evidenceReport.id}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Source provenance and automated ML NLP classification telemetry
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEvidenceReport(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-[13px]">
                {/* Raw Statement Quote */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Raw Ground Statement
                  </span>
                  <p className="text-slate-900 font-medium italic">
                    "{evidenceReport.raw_text}"
                  </p>
                </div>

                {/* Grid Metadata */}
                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Platform Source</span>
                    <div className="font-bold text-slate-800 capitalize mt-0.5">
                      {evidenceReport.source_platform.replace('_', ' ')} ({evidenceReport.source_handle})
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Hazard Category</span>
                    <div className="font-bold text-slate-800 capitalize mt-0.5">
                      {evidenceReport.event_category} (Confidence: {(evidenceReport.category_confidence * 100).toFixed(0)}%)
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Location & Coordinates</span>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {evidenceReport.city}, {evidenceReport.state}
                    </div>
                    <div className="font-mono text-[10px] text-slate-500">
                      {evidenceReport.lat.toFixed(4)}°N, {evidenceReport.lon.toFixed(4)}°E
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Misleading Probability</span>
                    <div className="font-black text-rose-600 mt-0.5">
                      {(evidenceReport.p_misleading * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Attached Media */}
                {evidenceReport.media_urls.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-slate-600 block mb-2">
                      Attached Evidence Photos ({evidenceReport.media_urls.length})
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      {evidenceReport.media_urls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt="Evidence visual"
                          className="rounded-xl border border-slate-200 h-40 w-full object-cover shadow-2xs"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  onClick={() => setEvidenceReport(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 text-[12px] font-bold transition-colors cursor-pointer"
                >
                  Close Dossier
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      executeSingleAction(evidenceReport.id, 'reject');
                      setEvidenceReport(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[12px] font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <XCircle size={15} />
                    <span>Reject as False</span>
                  </button>
                  <button
                    onClick={() => {
                      executeSingleAction(evidenceReport.id, 'verify');
                      setEvidenceReport(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 size={15} />
                    <span>Approve & Verify</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
