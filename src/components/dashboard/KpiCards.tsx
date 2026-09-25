/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — KPI Stat Cards
   Animated stat cards with trend indicators and stagger
   ═══════════════════════════════════════════════════════ */

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  FileText,
  Minus,
  ShieldCheck,
} from 'lucide-react';
import type { KpiStat } from '../../types';

const iconMap: Record<string, React.ReactNode> = {
  Activity:      <Activity size={22} />,
  FileText:      <FileText size={22} />,
  ShieldCheck:   <ShieldCheck size={22} />,
  AlertTriangle: <AlertTriangle size={22} />,
};

const trendConfig = {
  up:     { icon: <ArrowUp size={12} />,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
  down:   { icon: <ArrowDown size={12} />, color: 'text-red-600',     bg: 'bg-red-50' },
  stable: { icon: <Minus size={12} />,     color: 'text-slate-500',   bg: 'bg-slate-50' },
};

interface KpiCardsProps {
  stats: KpiStat[];
}

export default function KpiCards({ stats }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 stagger-children">
      {stats.map((stat) => {
        const trend = trendConfig[stat.trend];
        // For severe alerts, down is good
        const isGoodTrend = stat.id === 'kpi-alerts'
          ? stat.trend === 'down'
          : stat.trend === 'up';

        return (
          <div
            key={stat.id}
            className="glass-card p-5 group cursor-default"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`
                p-2.5 rounded-xl
                bg-gradient-to-br from-[var(--color-primary-50)] to-[var(--color-primary-100)]
                text-[var(--color-primary-600)]
                group-hover:shadow-[var(--shadow-glow-primary)]
                transition-shadow duration-300
              `}>
                {iconMap[stat.icon]}
              </div>
              <div className={`
                flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold
                ${isGoodTrend ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}
              `}>
                {trend.icon}
                <span>{Math.abs(stat.change)}%</span>
              </div>
            </div>
            <div className="animate-count-up">
              <p className="text-[28px] font-extrabold text-[var(--color-text-primary)] tracking-tight leading-none">
                {stat.value}
              </p>
            </div>
            <p className="text-[12px] font-medium text-[var(--color-text-secondary)] mt-1.5">
              {stat.label}
            </p>
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
              {stat.changeLabel}
            </p>
          </div>
        );
      })}
    </div>
  );
}
