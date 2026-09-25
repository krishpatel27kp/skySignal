/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Data Sources & Ingestion Connectors
   Multi-stream status, latency telemetry & connector control
   ═══════════════════════════════════════════════════════ */

import { useState } from 'react';
import {
  Radio,
  Smartphone,
  MessageCircle,
  FileText,
  Video,
  CheckCircle2,
  RefreshCw,
  Power,
} from 'lucide-react';

interface Connector {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'degraded' | 'syncing';
  latencyMs: number;
  uptimePercent: number;
  throughput: string;
  quotaUsed: number; // 0-100
  lastSync: string;
  icon: any;
  color: string;
  enabled: boolean;
}

const INITIAL_CONNECTORS: Connector[] = [
  {
    id: 'conn-imd-sensors',
    name: 'IMD Doppler Radar & AWS Network',
    type: 'Binary Telemetry Stream (Doppler Radar)',
    status: 'online',
    latencyMs: 58,
    uptimePercent: 99.98,
    throughput: '3,200 telemetry pkts/min',
    quotaUsed: 42,
    lastSync: '3s ago',
    icon: Radio,
    color: '#10b981',
    enabled: true,
  },
  {
    id: 'conn-citizen-app',
    name: 'Citizen Mobile PWA Ingestion',
    type: 'WebSocket / REST Direct Payload',
    status: 'online',
    latencyMs: 142,
    uptimePercent: 99.95,
    throughput: '180 observations/min',
    quotaUsed: 28,
    lastSync: '12s ago',
    icon: Smartphone,
    color: '#0284c7',
    enabled: true,
  },
  {
    id: 'conn-twitter-firehose',
    name: 'Twitter / X Meteorological Firehose',
    type: 'Filtered Streaming API v2 (Hindi/English)',
    status: 'online',
    latencyMs: 412,
    uptimePercent: 99.4,
    throughput: '640 tweets/min',
    quotaUsed: 78,
    lastSync: '5s ago',
    icon: MessageCircle,
    color: '#8b5cf6',
    enabled: true,
  },
  {
    id: 'conn-news-rss',
    name: 'National News & Disaster RSS Aggregator',
    type: 'Automated Crawl & NLP Entity Extraction',
    status: 'online',
    latencyMs: 1200,
    uptimePercent: 99.8,
    throughput: '45 bulletins/hr',
    quotaUsed: 35,
    lastSync: '1m ago',
    icon: FileText,
    color: '#0891b2',
    enabled: true,
  },
  {
    id: 'conn-youtube-livestream',
    name: 'YouTube Emergency Live Feed Scraper',
    type: 'Automated Speech-to-Text & Vision Stream',
    status: 'degraded',
    latencyMs: 3100,
    uptimePercent: 98.2,
    throughput: '12 video channels monitored',
    quotaUsed: 89,
    lastSync: '4m ago',
    icon: Video,
    color: '#ef4444',
    enabled: true,
  },
];

export default function DataSourcesPage() {
  const [connectors, setConnectors] = useState<Connector[]>(INITIAL_CONNECTORS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toggleConnector = (id: string) => {
    setConnectors((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
    const target = connectors.find((c) => c.id === id);
    setToastMessage(
      `Connector "${target?.name}" ${target?.enabled ? 'paused' : 'activated'}.`
    );
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRefreshAll = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setToastMessage('All data ingestion pipelines synchronized with zero loss.');
      setTimeout(() => setToastMessage(null), 3500);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio size={22} className="text-sky-600" />
            <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight">
              Ingestion Connectors & Telemetry Feeds
            </h1>
          </div>
          <p className="text-[13px] text-slate-500">
            Real-time pipeline monitoring for 5 heterogeneous data streams feeding into the fusion engine.
          </p>
        </div>

        <button
          onClick={handleRefreshAll}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-bold shadow-xs transition-colors cursor-pointer"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span>Synchronize Feeds</span>
        </button>
      </div>

      {/* ── Toast Alert ── */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Connectors Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {connectors.map((conn) => {
          const Icon = conn.icon;

          return (
            <div
              key={conn.id}
              className={`glass-card p-5 rounded-2xl border transition-all duration-200 space-y-4 ${
                conn.enabled
                  ? 'border-slate-200 shadow-sm'
                  : 'border-slate-200/50 opacity-60 bg-slate-100/50'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="p-3 rounded-xl shadow-xs text-white"
                    style={{ backgroundColor: conn.color }}
                  >
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900">
                      {conn.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {conn.type}
                    </p>
                  </div>
                </div>

                {/* Enable / Disable Switch */}
                <button
                  onClick={() => toggleConnector(conn.id)}
                  className={`p-2 rounded-xl border transition-colors ${
                    conn.enabled
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border-slate-300 bg-slate-200 text-slate-600'
                  }`}
                  title={conn.enabled ? 'Pause Ingestion Stream' : 'Enable Ingestion Stream'}
                >
                  <Power size={16} />
                </button>
              </div>

              {/* Status and Latency Indicators */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-[11px]">
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px]">Status</span>
                  <div className="font-bold flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        conn.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    <span className="capitalize text-slate-800">{conn.status}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px]">Latency</span>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {conn.latencyMs} ms
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px]">Uptime</span>
                  <div className="font-bold text-emerald-600 mt-0.5">
                    {conn.uptimePercent}%
                  </div>
                </div>
              </div>

              {/* Quota / Rate Limit Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-500 font-medium">API Throughput / Quota Utilization</span>
                  <span className="font-bold text-slate-700">{conn.quotaUsed}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      conn.quotaUsed > 80 ? 'bg-red-500' : 'bg-sky-500'
                    }`}
                    style={{ width: `${conn.quotaUsed}%` }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                <span>Rate: <strong className="text-slate-700">{conn.throughput}</strong></span>
                <span>Last heartbeat: {conn.lastSync}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
