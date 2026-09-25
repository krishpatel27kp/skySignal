/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Verification Queue Page
   Analyst Triage Center for incoming crowd & sensor reports
   Bulk verification, ML Misleading score filters & lightbox
   ═══════════════════════════════════════════════════════ */

import { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { getReports, bulkActionReports } from '../services/mockApi';
import { CATEGORY_CONFIG } from '../data/mock';
import type { Report } from '../types/weather';

export default function VerificationQueuePage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [misleadingThreshold, setMisleadingThreshold] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewMedia, setPreviewMedia] = useState<string | null>(null);
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

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (platformFilter !== 'all' && r.source_platform !== platformFilter) return false;
      if (categoryFilter !== 'all' && r.event_category !== categoryFilter) return false;
      if (misleadingThreshold > 0 && r.p_misleading < misleadingThreshold) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchText = r.raw_text.toLowerCase().includes(q);
        const matchCity = r.city.toLowerCase().includes(q);
        const matchHandle = r.source_handle.toLowerCase().includes(q);
        if (!matchText && !matchCity && !matchHandle) return false;
      }
      return true;
    });
  }, [reports, statusFilter, platformFilter, categoryFilter, misleadingThreshold, searchQuery]);

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
    if (selectedIds.size === filteredReports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReports.map((r) => r.id)));
    }
  };

  // Bulk action execution
  const executeBulkAction = async (action: 'verify' | 'reject') => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await bulkActionReports({
      report_ids: ids,
      action,
      analyst_email: 'analyst.delhi@imd.gov.in',
    });

    // Update local state
    setReports((prev) =>
      prev.map((r) => (selectedIds.has(r.id) ? { ...r, status: action === 'verify' ? 'verified' : 'rejected' } : r))
    );
    setSelectedIds(new Set());

    setActionSuccessMessage(
      `Successfully marked ${ids.length} report(s) as ${action === 'verify' ? 'Verified' : 'Rejected'}.`
    );
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  const pendingCount = reports.filter((r) => r.status === 'pending').length;
  const highRiskCount = reports.filter((r) => r.p_misleading > 0.6 && r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={22} className="text-sky-600" />
            <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight">
              Report Verification & Triage Queue
            </h1>
          </div>
          <p className="text-[13px] text-slate-500">
            Analyst gatekeeping pipeline with automated ML misleading score classification ($P_{'{misleading}'}$).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchReports}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Triage Metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in">
        <div className="glass-card p-4 flex items-center justify-between border-l-4 border-amber-500">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Pending Triage</div>
            <div className="text-[22px] font-black text-slate-800">{pendingCount} Reports</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
            <Clock size={20} />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between border-l-4 border-red-500">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">High Misleading Risk (P &gt; 0.60)</div>
            <div className="text-[22px] font-black text-red-600">{highRiskCount} Flagged</div>
          </div>
          <div className="p-2.5 rounded-xl bg-red-50 text-red-600">
            <ShieldAlert size={20} />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between border-l-4 border-emerald-500">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Auto-ML Ingestion Delay</div>
            <div className="text-[22px] font-black text-emerald-600">&lt; 1.4s (Real-Time)</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <Sparkles size={20} />
          </div>
        </div>
      </div>

      {/* ── Success Banner ── */}
      {actionSuccessMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-semibold flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="glass-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search text, location, or handle..."
              className="w-full pl-9 pr-3 py-2 text-[12px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2 px-3 text-[12px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 font-medium"
              aria-label="Filter status"
            >
              <option value="all">All Statuses</option>
              <option value="pending">⏳ Pending Review</option>
              <option value="verified">✅ Verified</option>
              <option value="rejected">❌ Rejected</option>
            </select>
          </div>

          <div>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="w-full py-2 px-3 text-[12px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 font-medium"
              aria-label="Filter source platform"
            >
              <option value="all">All Sources</option>
              <option value="citizen_app">📱 Citizen App</option>
              <option value="twitter">🐦 Twitter / X</option>
              <option value="news">📰 News RSS</option>
              <option value="imd_official">📡 IMD Sensor</option>
            </select>
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full py-2 px-3 text-[12px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 font-medium"
              aria-label="Filter category"
            >
              <option value="all">All Categories</option>
              <option value="rainfall">🌧️ Rainfall</option>
              <option value="thunderstorm">⚡ Thunderstorm</option>
              <option value="flooding">🌊 Flooding</option>
              <option value="heatwave">🌡️ Heatwave</option>
              <option value="fog">🌫️ Fog</option>
              <option value="dust storm">🌪️ Dust Storm</option>
              <option value="strong wind">💨 Strong Wind</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Pill for High Risk Misleading */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Misleading Risk:</span>
            <button
              onClick={() => setMisleadingThreshold(0)}
              className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                misleadingThreshold === 0 ? 'bg-sky-600 text-white font-semibold' : 'bg-slate-100 text-slate-600'
              }`}
            >
              All Probabilities
            </button>
            <button
              onClick={() => setMisleadingThreshold(0.6)}
              className={`px-2.5 py-1 rounded-full font-medium transition-colors flex items-center gap-1 ${
                misleadingThreshold === 0.6 ? 'bg-red-600 text-white font-semibold' : 'bg-red-50 text-red-600'
              }`}
            >
              <AlertTriangle size={12} />
              High Risk (&gt;60%)
            </button>
          </div>

          <div className="text-slate-400 font-medium">
            Showing {filteredReports.length} of {reports.length} reports
          </div>
        </div>
      </div>

      {/* ── Bulk Actions Floating Toolbar ── */}
      {selectedIds.size > 0 && (
        <div className="sticky top-20 z-30 p-3.5 rounded-2xl bg-slate-900 text-white shadow-xl flex items-center justify-between gap-4 animate-slide-in-right">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 text-[11px] font-bold">
              {selectedIds.size} Selected
            </span>
            <span className="text-[13px] font-semibold text-slate-200">
              Bulk Triage Actions:
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => executeBulkAction('verify')}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 size={15} />
              Verify Selected
            </button>
            <button
              onClick={() => executeBulkAction('reject')}
              className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[12px] font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <XCircle size={15} />
              Reject as Misleading
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-[12px] transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Reports List ── */}
      <div className="space-y-3">
        {/* Table Head Select All Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-100 rounded-xl text-[12px] font-bold text-slate-600">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-2 text-slate-700 hover:text-slate-900"
          >
            {selectedIds.size === filteredReports.length && filteredReports.length > 0 ? (
              <CheckSquare size={16} className="text-sky-600" />
            ) : (
              <Square size={16} className="text-slate-400" />
            )}
            <span>Select All on Page ({filteredReports.length})</span>
          </button>
          <span className="text-[11px] text-slate-400">Click card or checkbox to select</span>
        </div>

        {filteredReports.length === 0 ? (
          <div className="glass-card py-16 text-center text-slate-400">
            No incoming reports match the active triage criteria.
          </div>
        ) : (
          filteredReports.map((report) => {
            const isSelected = selectedIds.has(report.id);
            const isHighMisleading = report.p_misleading > 0.6;
            const catConfig = CATEGORY_CONFIG[report.event_category];

            return (
              <div
                key={report.id}
                onClick={() => handleToggleSelect(report.id)}
                className={`glass-card p-4.5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isSelected
                    ? 'border-sky-500 bg-sky-50/40 shadow-md ring-2 ring-sky-500/20'
                    : isHighMisleading
                    ? 'border-red-200/90 hover:border-red-300'
                    : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {/* Left: Checkbox + Meta + Content */}
                <div className="flex items-start gap-3.5 flex-1">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSelect(report.id);
                    }}
                    className="mt-1"
                  >
                    {isSelected ? (
                      <CheckSquare size={18} className="text-sky-600" />
                    ) : (
                      <Square size={18} className="text-slate-300 hover:text-slate-500" />
                    )}
                  </div>

                  <div className="space-y-1.5 flex-1">
                    {/* Badge Row */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="font-mono text-[10px] text-slate-400 font-bold">
                        {report.id}
                      </span>
                      <span className="px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 capitalize">
                        {report.source_platform.replace('_', ' ')}: {report.source_handle}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full font-semibold capitalize"
                        style={{ backgroundColor: catConfig?.bgColor, color: catConfig?.color }}
                      >
                        {report.event_category}
                      </span>

                      {/* Misleading Risk Badge */}
                      {isHighMisleading ? (
                        <span className="px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700 flex items-center gap-1">
                          <AlertTriangle size={11} />
                          P(Misleading): {(report.p_misleading * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700">
                          Credibility: {((1 - report.p_misleading) * 100).toFixed(0)}%
                        </span>
                      )}

                      {/* Status */}
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                          report.status === 'verified'
                            ? 'bg-emerald-100 text-emerald-800'
                            : report.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {report.status}
                      </span>
                    </div>

                    {/* Report Text */}
                    <p className="text-[13px] text-slate-800 font-medium leading-relaxed">
                      "{report.raw_text}"
                    </p>

                    {/* Location & Time */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1">
                        <MapPin size={12} />
                        <span>{report.city}, {report.state}</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        <span>{new Date(report.reported_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {report.synced_late && (
                        <span className="text-amber-600 font-semibold">(Synced delayed)</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Media thumbnail + Direct action */}
                <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                  {report.media_urls.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewMedia(report.media_urls[0]);
                      }}
                      className="relative group/media overflow-hidden rounded-xl border border-slate-200 w-14 h-14 bg-slate-100 flex items-center justify-center cursor-pointer shadow-xs"
                      title="Inspect attached media"
                    >
                      <img
                        src={report.media_urls[0]}
                        alt="Citizen attachment"
                        className="w-full h-full object-cover group-hover/media:scale-110 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/media:opacity-100 transition-opacity">
                        <Eye size={16} className="text-white" />
                      </div>
                    </button>
                  )}

                  {/* Quick Individual Action */}
                  <div className="flex items-center gap-1.5">
                    {report.status !== 'verified' && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await bulkActionReports({ report_ids: [report.id], action: 'verify' });
                          setReports((prev) =>
                            prev.map((r) => (r.id === report.id ? { ...r, status: 'verified' } : r))
                          );
                        }}
                        className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition-colors"
                        title="Verify Report"
                        aria-label="Verify report"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                    )}
                    {report.status !== 'rejected' && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await bulkActionReports({ report_ids: [report.id], action: 'reject' });
                          setReports((prev) =>
                            prev.map((r) => (r.id === report.id ? { ...r, status: 'rejected' } : r))
                          );
                        }}
                        className="p-2 rounded-xl text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
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
          })
        )}
      </div>

      {/* ── Media Lightbox Modal ── */}
      {previewMedia && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2 border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewMedia(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black transition-colors"
            >
              <X size={20} />
            </button>
            <img
              src={previewMedia}
              alt="High-resolution attachment inspection"
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />
            <div className="p-3 text-center text-slate-300 text-[12px]">
              Uploaded media evidence from ground citizen report.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
