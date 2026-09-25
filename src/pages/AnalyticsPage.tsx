/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Analytics & Intelligence Page
   Macro-level meteorological distribution, source accuracy,
   and regional hazard vulnerability matrices
   ═══════════════════════════════════════════════════════ */

import { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  MapPin,
  Activity,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const TEMPORAL_INGESTION_DATA = [
  { time: '00:00', citizen: 18, twitter: 45, sensor: 30 },
  { time: '04:00', citizen: 12, twitter: 22, sensor: 32 },
  { time: '08:00', citizen: 48, twitter: 85, sensor: 40 },
  { time: '12:00', citizen: 92, twitter: 160, sensor: 45 },
  { time: '16:00', citizen: 140, twitter: 240, sensor: 50 },
  { time: '20:00', citizen: 85, twitter: 190, sensor: 48 },
  { time: '24:00', citizen: 40, twitter: 110, sensor: 35 },
];

const HAZARD_DISTRIBUTION_DATA = [
  { name: 'Rainfall', value: 38, color: '#3b82f6' },
  { name: 'Thunderstorm', value: 24, color: '#8b5cf6' },
  { name: 'Flooding', value: 16, color: '#0891b2' },
  { name: 'Heatwave', value: 10, color: '#f97316' },
  { name: 'Fog', value: 5, color: '#6b7280' },
  { name: 'Dust Storm', value: 4, color: '#d97706' },
  { name: 'Strong Wind', value: 3, color: '#0d9488' },
];

const SOURCE_ACCURACY_DATA = [
  { source: 'Citizen App', verified: 94, misleading: 6 },
  { source: 'IMD Sensor', verified: 99, misleading: 1 },
  { source: 'Twitter / X', verified: 72, misleading: 28 },
  { source: 'News RSS', verified: 88, misleading: 12 },
];

const REGIONAL_HOTSPOTS = [
  { state: 'Maharashtra', severeEvents: 4, totalReports: 342, vulnerability: 'Critical' },
  { state: 'Delhi NCR', severeEvents: 3, totalReports: 280, vulnerability: 'High' },
  { state: 'Tamil Nadu', severeEvents: 2, totalReports: 195, vulnerability: 'High' },
  { state: 'Gujarat', severeEvents: 2, totalReports: 160, vulnerability: 'Moderate' },
  { state: 'Kerala', severeEvents: 1, totalReports: 140, vulnerability: 'Moderate' },
  { state: 'West Bengal', severeEvents: 1, totalReports: 115, vulnerability: 'Moderate' },
];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={22} className="text-sky-600" />
            <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight">
              Meteorological Analytics & Macro Intelligence
            </h1>
          </div>
          <p className="text-[13px] text-slate-500">
            Multisource temporal trends, hazard classification breakdown, and source veracity analytics.
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
          {(['24h', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${
                timeRange === range
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {range === '24h' ? 'Last 24 Hours' : range === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Top Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
        <div className="glass-card p-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Total Ingested Signals</span>
          <div className="text-[24px] font-black text-slate-900 mt-1">2,840</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <TrendingUp size={13} /> +18.4% vs yesterday
          </div>
        </div>

        <div className="glass-card p-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Cross-Corroboration Rate</span>
          <div className="text-[24px] font-black text-sky-600 mt-1">91.8%</div>
          <div className="text-[11px] text-slate-500 mt-1">&gt; 2 independent platforms</div>
        </div>

        <div className="glass-card p-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase">ML Misleading Detection</span>
          <div className="text-[24px] font-black text-purple-600 mt-1">428 Flagged</div>
          <div className="text-[11px] text-slate-500 mt-1">P(Misleading) &gt; 0.60</div>
        </div>

        <div className="glass-card p-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Doppler Corroborated</span>
          <div className="text-[24px] font-black text-emerald-600 mt-1">96.2%</div>
          <div className="text-[11px] text-slate-500 mt-1">Direct IMD radar match</div>
        </div>
      </div>

      {/* ── Main Charts Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Layered Temporal Chart */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">
                Multi-Source Ingestion Velocity
              </h3>
              <p className="text-[11px] text-slate-500">
                Stacked report volumes across Citizen app, Twitter, and sensor feeds.
              </p>
            </div>
            <Activity size={16} className="text-sky-600" />
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TEMPORAL_INGESTION_DATA}>
                <defs>
                  <linearGradient id="colorCitizen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorTwitter" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="twitter" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorTwitter)" name="Social (Twitter/X)" />
                <Area type="monotone" dataKey="citizen" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCitizen)" name="Citizen App" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hazard Distribution Donut */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">
                Hazard Taxonomy Distribution
              </h3>
              <p className="text-[11px] text-slate-500">
                Proportion of active events across the strict 7 categories.
              </p>
            </div>
            <PieIcon size={16} className="text-purple-600" />
          </div>

          <div className="h-[280px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={HAZARD_DISTRIBUTION_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {HAZARD_DISTRIBUTION_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Bottom Section: Source Veracity & Regional Hotspots ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Accuracy Bar Chart */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-[14px] font-bold text-slate-900">
            Source Veracity vs Misleading Signal Rate
          </h3>
          <p className="text-[11px] text-slate-500">
            Automated NLP ground-truth verification rate per platform.
          </p>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SOURCE_ACCURACY_DATA} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <YAxis dataKey="source" type="category" tick={{ fontSize: 11 }} width={90} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="verified" fill="#10b981" name="Verified Truth %" radius={[0, 6, 6, 0]} />
                <Bar dataKey="misleading" fill="#ef4444" name="Misleading %" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Regional Hotspots Table */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-[14px] font-bold text-slate-900">
            Regional Meteorological Vulnerability
          </h3>
          <p className="text-[11px] text-slate-500">
            Real-time concentration of high-impact events by state.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-3">State</th>
                  <th className="py-2.5 px-2">Severe Alerts</th>
                  <th className="py-2.5 px-2">Reports</th>
                  <th className="py-2.5 px-3 text-right">Risk Index</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {REGIONAL_HOTSPOTS.map((region) => (
                  <tr key={region.state} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-800 flex items-center gap-1.5">
                      <MapPin size={12} className="text-slate-400" />
                      <span>{region.state}</span>
                    </td>
                    <td className="py-2.5 px-2 font-bold text-red-600">
                      {region.severeEvents} Severe
                    </td>
                    <td className="py-2.5 px-2 text-slate-600">
                      {region.totalReports}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          region.vulnerability === 'Critical'
                            ? 'bg-red-100 text-red-700'
                            : region.vulnerability === 'High'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {region.vulnerability}
                      </span>
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
