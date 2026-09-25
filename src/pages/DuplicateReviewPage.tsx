/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Duplicate Review Page
   NLP Spatiotemporal Clustering & Report Fusion Review
   94% similarity detection with side-by-side merge triage
   ═══════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react';
import {
  Copy,
  GitMerge,
  Sparkles,
  CheckCircle2,
  MapPin,
  Clock,
  Layers,
  Split,
  X,
} from 'lucide-react';
import { getDuplicateClusters } from '../services/mockApi';
import type { DuplicateCluster } from '../types/weather';

export default function DuplicateReviewPage() {
  const [clusters, setClusters] = useState<DuplicateCluster[]>([]);
  const [resolvedClusterIds, setResolvedClusterIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const data = await getDuplicateClusters();
      setClusters(data);
    }
    load();
  }, []);

  const handleMergeCluster = (clusterId: string, locationName: string) => {
    setResolvedClusterIds((prev) => new Set(prev).add(clusterId));
    setToastMessage(`Cluster ${clusterId} in ${locationName} merged into single canonical meteorological event.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleKeepSeparate = (clusterId: string) => {
    setResolvedClusterIds((prev) => new Set(prev).add(clusterId));
    setToastMessage(`Reports in ${clusterId} kept as independent observations.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const activeClusters = clusters.filter((c) => !resolvedClusterIds.has(c.id));

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Copy size={22} className="text-sky-600" />
            <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight">
              NLP Duplicate Clustering Review
            </h1>
          </div>
          <p className="text-[13px] text-slate-500">
            Semantic transformer embeddings group corroborated reports within 15-minute / 2km spatiotemporal windows.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-[12px] font-bold flex items-center gap-1.5">
            <Sparkles size={14} />
            <span>MiniLM-L6-v2 Embeddings Active</span>
          </div>
        </div>
      </div>

      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-semibold flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Clusters Summary Bar ── */}
      <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Pending Review</span>
            <div className="text-[20px] font-black text-slate-800">{activeClusters.length} Clusters</div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Resolved Today</span>
            <div className="text-[20px] font-black text-emerald-600">{resolvedClusterIds.size} Merged</div>
          </div>
        </div>

        <div className="text-[12px] text-slate-500">
          Threshold: <strong className="text-slate-800">&gt; 0.85 Cosine Similarity</strong>
        </div>
      </div>

      {/* ── Clusters List ── */}
      <div className="space-y-6">
        {activeClusters.length === 0 ? (
          <div className="glass-card py-16 text-center text-slate-500 space-y-2">
            <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
            <h3 className="text-[16px] font-bold text-slate-800">All Duplicate Clusters Reviewed</h3>
            <p className="text-[12px] text-slate-400 max-w-md mx-auto">
              The NLP clustering engine has no outstanding near-duplicate report groups pending analyst confirmation.
            </p>
          </div>
        ) : (
          activeClusters.map((cluster) => {
            const similarityPercent = Math.round(cluster.similarity_score * 100);

            return (
              <div
                key={cluster.id}
                className="glass-card p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 animate-fade-in"
              >
                {/* Cluster Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="p-2.5 rounded-xl bg-purple-100 text-purple-700">
                      <Layers size={18} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[16px] font-bold text-slate-900">
                          {cluster.location_name} Cluster
                        </h3>
                        <span className="font-mono text-[10px] text-slate-400 font-bold">
                          {cluster.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-slate-500 mt-0.5">
                        <MapPin size={13} className="text-slate-400" />
                        <span>{cluster.location_name}</span>
                        <span>•</span>
                        <span>{cluster.reports.length} Reports Clustered</span>
                      </div>
                    </div>
                  </div>

                  {/* Similarity Badge */}
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <div className="text-right">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase">Semantic Overlap</div>
                      <div className="text-[16px] font-black text-purple-700">{similarityPercent}% Match</div>
                    </div>
                    <div className="w-12 h-12 rounded-full border-4 border-purple-200 flex items-center justify-center font-bold text-[11px] text-purple-700 bg-purple-50">
                      {similarityPercent}%
                    </div>
                  </div>
                </div>

                {/* Side-by-side or Stacked Reports */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cluster.reports.map((report, idx) => (
                    <div
                      key={report.id}
                      className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-3"
                    >
                      <div>
                        {/* Submitter & Tag */}
                        <div className="flex items-center justify-between text-[11px] mb-2">
                          <span className="px-2 py-0.5 rounded-md font-bold bg-white text-slate-700 border border-slate-200">
                            {idx === 0 ? 'Primary Canonical' : 'Corroborating Duplicate'}
                          </span>
                          <span className="font-semibold text-sky-600 capitalize">
                            {report.source_platform.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Raw Text */}
                        <p className="text-[13px] font-medium text-slate-800 bg-white p-3 rounded-lg border border-slate-100 leading-relaxed">
                          "{report.raw_text}"
                        </p>
                      </div>

                      {/* Metadata Footer */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60">
                        <div className="flex items-center gap-1 font-mono text-[10px]">
                          <span>{report.source_handle}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={12} />
                          <span>{new Date(report.reported_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Fusion Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="text-[11px] text-slate-400">
                    Spatiotemporal delta: &lt; 0.6 km distance · 7 minutes timestamp gap
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <button
                      onClick={() => handleKeepSeparate(cluster.id)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Split size={14} />
                      Keep Independent
                    </button>
                    <button
                      onClick={() => handleMergeCluster(cluster.id, cluster.location_name)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[12px] font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <GitMerge size={14} />
                      Merge & Corroborate (94% Match)
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
