/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Analytics Dashboard
   Macro-level meteorological intelligence built with Recharts
   Chart 1: 24-Hour Temporal Ingestion Volume (monotone area chart)
   Chart 2: Hazard Distribution (horizontal proportional progress bars)
   Chart 3: Source Reliability Index (IMD Sensor 99%, Citizen 92%, News 88%, Social 74%)
   Chart 4: Regional Incident Heatmap matrix
   ═══════════════════════════════════════════════════════ */

import { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Activity,
  Layers,
  ShieldCheck,
  Smartphone,
  Radio,
  FileText,
  MessageCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ── 1. 24-Hour Temporal Ingestion Volume Data ──
const HOURLY_INGESTION_DATA = [
  { time: '00:00', verified: 14, unverified: 28 },
  { time: '02:00', verified: 8, unverified: 16 },
  { time: '04:00', verified: 12, unverified: 20 },
  { time: '06:00', verified: 35, unverified: 62 },
  { time: '08:00', verified: 78, unverified: 145 },
  { time: '10:00', verified: 112, unverified: 210 },
  { time: '12:00', verified: 145, unverified: 280 },
  { time: '14:00', verified: 168, unverified: 315 },
  { time: '16:00', verified: 195, unverified: 380 },
  { time: '18:00', verified: 172, unverified: 320 },
  { time: '20:00', verified: 130, unverified: 240 },
  { time: '22:00', verified: 65, unverified: 120 },
  { time: '24:00', verified: 30, unverified: 55 },
];

// ── 2. Hazard Distribution (7 Strict Categories) ──
const HAZARD_DISTRIBUTION = [
  { category: 'Rainfall', icon: '🌧️', count: 1022, pct: 36, color: '#0284c7', bg: 'bg-sky-500' },
  { category: 'Thunderstorm', icon: '⚡', count: 682, pct: 24, color: '#7c3aed', bg: 'bg-purple-600' },
  { category: 'Flooding', icon: '🌊', count: 511, pct: 18, color: '#0891b2', bg: 'bg-cyan-600' },
  { category: 'Heatwave', icon: '🌡️', count: 312, pct: 11, color: '#ea580c', bg: 'bg-orange-500' },
  { category: 'Fog', icon: '🌫️', count: 142, pct: 5, color: '#64748b', bg: 'bg-slate-500' },
  { category: 'Dust Storm', icon: '🌪️', count: 114, pct: 4, color: '#d97706', bg: 'bg-amber-600' },
  { category: 'Strong Wind', icon: '💨', count: 57, pct: 2, color: '#059669', bg: 'bg-emerald-600' },
];

// ── 3. Source Reliability Index ──
const SOURCE_RELIABILITY = [
  {
    source: 'IMD Sensor Network',
    type: 'Doppler Radar & AWS Gauges',
    reliability: 99,
    icon: Radio,
    color: 'emerald',
    barColor: '#10b981',
    volume: '14,280 daily readings',
    fpRate: '< 0.5% False Positive',
  },
  {
    source: 'Citizen Telemetry App',
    type: 'Geotagged Crowd Reports',
    reliability: 92,
    icon: Smartphone,
    color: 'sky',
    barColor: '#0284c7',
    volume: '2,840 reports ingested',
    fpRate: '3.2% Misleading Ratio',
  },
  {
    source: 'Regional News RSS',
    type: 'Accredited Media Bureaus',
    reliability: 88,
    icon: FileText,
    color: 'amber',
    barColor: '#f59e0b',
    volume: '412 regional bulletins',
    fpRate: '4.8% Retraction Ratio',
  },
  {
    source: 'Social Media (Twitter/X)',
    type: 'NLP Spatiotemporal Stream',
    reliability: 74,
    icon: MessageCircle,
    color: 'purple',
    barColor: '#8b5cf6',
    volume: '18,920 raw keywords',
    fpRate: '26.0% Filtered Noise',
  },
];

// ── 4. Regional Incident Heatmap Matrix ──
interface HeatmapRow {
  region: string;
  state: string;
  minor: number;
  moderate: number;
  severe: number;
  total: number;
}

const HEATMAP_DATA: HeatmapRow[] = [
  { region: 'West', state: 'Maharashtra', minor: 14, moderate: 28, severe: 9, total: 51 },
  { region: 'North', state: 'Delhi NCR', minor: 8, moderate: 19, severe: 6, total: 33 },
  { region: 'South', state: 'Tamil Nadu', minor: 12, moderate: 16, severe: 5, total: 33 },
  { region: 'West', state: 'Gujarat', minor: 9, moderate: 14, severe: 4, total: 27 },
  { region: 'North', state: 'Rajasthan', minor: 7, moderate: 11, severe: 3, total: 21 },
  { region: 'East', state: 'West Bengal', minor: 11, moderate: 15, severe: 4, total: 30 },
  { region: 'South', state: 'Kerala', minor: 16, moderate: 12, severe: 3, total: 31 },
  { region: 'North', state: 'Uttarakhand', minor: 5, moderate: 8, severe: 5, total: 18 },
  { region: 'East', state: 'Bihar', minor: 6, moderate: 9, severe: 2, total: 17 },
  { region: 'Central', state: 'Madhya Pradesh', minor: 10, moderate: 7, severe: 1, total: 18 },
];

export default function Analytics() {
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | '30d'>('24h');

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-3 bg-slate-900/95 backdrop-blur-md text-white rounded-xl border border-slate-700 shadow-xl text-[12px] space-y-1">
          <div className="font-mono text-slate-400 font-bold border-b border-slate-800 pb-1">
            Time: {label} IST
          </div>
          {payload.map((item: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5" style={{ color: item.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.name}:</span>
              </span>
              <span className="font-mono font-black">{item.value} signals</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={22} className="text-sky-600" />
            <h1 className="text-[22px] font-black text-slate-900 tracking-tight font-['Outfit']">
              Meteorological Macro Intelligence & Telemetry Analytics
            </h1>
          </div>
          <p className="text-[13px] text-slate-500">
            Ingestion curves, 7-hazard taxonomy distribution, multi-source veracity metrics, and spatial vulnerability heatmap.
          </p>
        </div>

        {/* Global Time Selector */}
        <div className="flex items-center gap-1 bg-white border border-slate-200/90 rounded-2xl p-1 shadow-2xs text-[11px] font-bold">
          {(['24h', '7d', '30d'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTimeFilter(t)}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                timeFilter === t
                  ? 'bg-sky-600 text-white shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t === '24h' ? 'Last 24 Hours' : t === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Top Metric Highlights ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
        <div className="glass-card p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
            Total Multi-Source Ingestion
          </span>
          <div className="text-[26px] font-black text-slate-900 font-['Outfit'] mt-1">
            21,760
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold mt-1">
            <TrendingUp size={13} />
            <span>+14.2% vs previous period</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
            AI Automated Corroboration
          </span>
          <div className="text-[26px] font-black text-sky-600 font-['Outfit'] mt-1">
            91.4%
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Cosine similarity &gt; 0.85
          </span>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
            Severe Hazard Warnings
          </span>
          <div className="text-[26px] font-black text-rose-600 font-['Outfit'] mt-1">
            39 Incidents
          </div>
          <span className="text-[11px] text-rose-500 font-bold">
            Red alerts dispatched to NDMA
          </span>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
            Mean Pipeline Latency
          </span>
          <div className="text-[26px] font-black text-purple-600 font-['Outfit'] mt-1">
            1.24s
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Edge Kafka to Analyst Terminal
          </span>
        </div>
      </div>

      {/* ── Main Charts Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
        {/* ── Chart 1: 24-Hour Temporal Ingestion Volume (lg:col-span-8) ── */}
        <div className="lg:col-span-8 glass-card p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Activity size={17} className="text-sky-600" />
                <h3 className="text-[15px] font-black text-slate-900 font-['Outfit']">
                  24-Hour Temporal Ingestion Volume
                </h3>
              </div>
              <p className="text-[11px] text-slate-500">
                Monotone gradient comparison: Verified Reports vs. Unverified Raw Signals
              </p>
            </div>

            <div className="flex items-center gap-4 text-[11px] font-bold">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Verified Reports</span>
              </span>
              <span className="flex items-center gap-1.5 text-purple-600">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span>Unverified Signals</span>
              </span>
            </div>
          </div>

          {/* Recharts Area Chart Container */}
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={HOURLY_INGESTION_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  {/* Verified gradient */}
                  <linearGradient id="verifiedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>

                  {/* Unverified gradient */}
                  <linearGradient id="unverifiedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Unverified Area */}
                <Area
                  type="monotone"
                  dataKey="unverified"
                  name="Unverified Signals"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#unverifiedGradient)"
                />

                {/* Verified Area */}
                <Area
                  type="monotone"
                  dataKey="verified"
                  name="Verified Reports"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#verifiedGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Chart 2: Hazard Distribution (lg:col-span-4) ── */}
        <div className="lg:col-span-4 glass-card p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Layers size={17} className="text-purple-600" />
              <div>
                <h3 className="text-[15px] font-black text-slate-900 font-['Outfit']">
                  Hazard Category Breakdown
                </h3>
                <p className="text-[11px] text-slate-500">
                  Proportional representation across 7 official categories
                </p>
              </div>
            </div>

            {/* Horizontal Proportional Progress Bars */}
            <div className="space-y-3.5 pt-3">
              {HAZARD_DISTRIBUTION.map((item) => (
                <div key={item.category} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <span>{item.icon}</span>
                      <span>{item.category}</span>
                    </span>
                    <span className="font-mono text-slate-500">
                      <strong className="text-slate-900">{item.pct}%</strong> ({item.count})
                    </span>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.bg} transition-all duration-500`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Primary Active Hazard:</span>
            <span className="font-bold text-sky-700">🌧️ Rainfall (36% National Share)</span>
          </div>
        </div>

        {/* ── Chart 3: Source Reliability Index (lg:col-span-6) ── */}
        <div className="lg:col-span-6 glass-card p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} className="text-emerald-600" />
              <div>
                <h3 className="text-[15px] font-black text-slate-900 font-['Outfit']">
                  Source Reliability Index
                </h3>
                <p className="text-[11px] text-slate-500">
                  Bayesian veracity scoring calibrated against Doppler ground truth
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {SOURCE_RELIABILITY.map((src) => {
              const Icon = src.icon;
              return (
                <div
                  key={src.source}
                  className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                        <Icon size={16} />
                      </div>
                      <div>
                        <h4 className="text-[12px] font-black text-slate-900 leading-tight">
                          {src.source}
                        </h4>
                        <span className="text-[10px] text-slate-400 block">{src.type}</span>
                      </div>
                    </div>

                    <div className="text-[18px] font-black font-mono text-slate-900 font-['Outfit']">
                      {src.reliability}%
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${src.reliability}%`, backgroundColor: src.barColor }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>{src.volume}</span>
                      <span className="font-semibold text-slate-600">{src.fpRate}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Chart 4: Regional Incident Heatmap Matrix (lg:col-span-6) ── */}
        <div className="lg:col-span-6 glass-card p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={17} className="text-rose-600" />
              <div>
                <h3 className="text-[15px] font-black text-slate-900 font-['Outfit']">
                  Regional Incident Heatmap Matrix
                </h3>
                <p className="text-[11px] text-slate-500">
                  State-by-state active cluster density indexed by 3-tier severity
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-slate-400">10 High-Activity States</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/60 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">State / Jurisdiction</th>
                  <th className="py-2.5 px-2 text-center">Minor (1-tier)</th>
                  <th className="py-2.5 px-2 text-center">Moderate (2-tier)</th>
                  <th className="py-2.5 px-2 text-center">Severe (3-tier)</th>
                  <th className="py-2.5 px-3 text-right">Total Density</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {HEATMAP_DATA.map((row) => (
                  <tr key={row.state} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 font-bold text-slate-800 flex items-center justify-between">
                      <span>{row.state}</span>
                      <span className="text-[9px] font-mono text-slate-400 uppercase">{row.region}</span>
                    </td>

                    {/* Minor Cell */}
                    <td className="py-2 px-2 text-center">
                      <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 inline-block w-8">
                        {row.minor}
                      </span>
                    </td>

                    {/* Moderate Cell */}
                    <td className="py-2 px-2 text-center">
                      <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-sky-50 text-sky-700 border border-sky-100 inline-block w-8">
                        {row.moderate}
                      </span>
                    </td>

                    {/* Severe Cell (Heat Intensity) */}
                    <td className="py-2 px-2 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-md font-mono font-black inline-block w-8 ${
                          row.severe >= 6
                            ? 'bg-rose-600 text-white shadow-2xs animate-pulse'
                            : row.severe >= 3
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {row.severe}
                      </span>
                    </td>

                    {/* Total Density */}
                    <td className="py-2 px-3 text-right font-mono font-black text-slate-900">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
