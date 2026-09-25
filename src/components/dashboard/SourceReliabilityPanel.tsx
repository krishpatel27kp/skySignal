/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Source Reliability Meters
   Progress bar meters showing data source trust scores
   ═══════════════════════════════════════════════════════ */

import { Database, ShieldCheck } from 'lucide-react';
import type { SourceReliability } from '../../types';

interface SourceReliabilityPanelProps {
  sources: SourceReliability[];
}

export default function SourceReliabilityPanel({ sources }: SourceReliabilityPanelProps) {
  return (
    <div className="glass-card animate-fade-in" style={{ animationDelay: '600ms' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-[var(--color-primary-500)]" />
          <h2 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
            Source Reliability
          </h2>
        </div>
        <ShieldCheck size={16} className="text-[var(--color-text-tertiary)]" />
      </div>

      {/* Meters */}
      <div className="p-5 space-y-4">
        {sources.map((source) => (
          <div key={source.source}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">
                {source.label}
              </span>
              <span className="text-[13px] font-bold text-[var(--color-text-primary)]">
                {source.reliability}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--color-surface-active)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-[var(--ease-spring)]"
                style={{
                  width: `${source.reliability}%`,
                  backgroundColor: source.color,
                }}
                role="progressbar"
                aria-valuenow={source.reliability}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${source.label} reliability: ${source.reliability}%`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
