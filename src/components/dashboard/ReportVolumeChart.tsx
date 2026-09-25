/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Report Volume Chart
   24-hour area chart with gradient fills using Recharts
   ═══════════════════════════════════════════════════════ */

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { ChartDataPoint } from '../../types';

interface ReportVolumeChartProps {
  data: ChartDataPoint[];
}

export default function ReportVolumeChart({ data }: ReportVolumeChartProps) {
  return (
    <div className="glass-card animate-fade-in" style={{ animationDelay: '500ms' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-[var(--color-primary-500)]" />
          <h2 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
            24-Hour Report Volume
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-cyan-accent)]" />
            <span className="text-[10px] font-medium text-[var(--color-text-tertiary)]">All Reports</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary-500)]" />
            <span className="text-[10px] font-medium text-[var(--color-text-tertiary)]">Verified</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4 pt-2">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradientReports" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradientVerified" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1c7293" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#1c7293" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border-subtle)"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }}
              tickLine={false}
              axisLine={false}
              interval={3}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }}
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-glass)',
                fontSize: 11,
                padding: '8px 12px',
              }}
              labelStyle={{
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                marginBottom: 4,
              }}
            />
            <Area
              type="monotone"
              dataKey="reports"
              stroke="#06b6d4"
              strokeWidth={2}
              fill="url(#gradientReports)"
              name="Total Reports"
            />
            <Area
              type="monotone"
              dataKey="verified"
              stroke="#1c7293"
              strokeWidth={2}
              fill="url(#gradientVerified)"
              name="Verified"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
