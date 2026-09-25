/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Priority Watch Panel
   Right-side drawer showing high-priority events
   ═══════════════════════════════════════════════════════ */

import { AlertTriangle, ChevronRight, MapPin, ShieldCheck } from 'lucide-react';
import type { PriorityWatch } from '../../types';
import { CATEGORY_CONFIG, SEVERITY_CONFIG } from '../../data/mock';

interface PriorityWatchPanelProps {
  items: PriorityWatch[];
}

export default function PriorityWatchPanel({ items }: PriorityWatchPanelProps) {
  return (
    <div className="glass-card animate-fade-in" style={{ animationDelay: '300ms' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-[var(--color-severity-severe)]" />
          <h2 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
            Priority Watch
          </h2>
        </div>
        <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
          {items.length} alerts
        </span>
      </div>

      {/* Items */}
      <div className="divide-y divide-[var(--color-border-subtle)]">
        {items.map((item, idx) => {
          const catConfig = CATEGORY_CONFIG[item.category];
          const sevConfig = SEVERITY_CONFIG[item.severity];

          return (
            <button
              key={item.id}
              className="
                w-full px-5 py-3.5 text-left
                hover:bg-[var(--color-surface-hover)] transition-colors duration-150
                group flex items-start gap-3
              "
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              {/* Category Icon */}
              <div
                className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: catConfig.bgColor }}
              >
                <div style={{ color: catConfig.color }}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {/* Simple weather icon paths */}
                    {item.category === 'rainfall' && (
                      <>
                        <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
                        <line x1="8" y1="19" x2="8" y2="21" /><line x1="12" y1="19" x2="12" y2="21" />
                        <line x1="16" y1="19" x2="16" y2="21" />
                      </>
                    )}
                    {item.category === 'thunderstorm' && (
                      <>
                        <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" />
                        <polyline points="13 11 9 17 15 17 11 23" />
                      </>
                    )}
                    {item.category === 'flooding' && (
                      <>
                        <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                        <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                        <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                      </>
                    )}
                    {item.category === 'heatwave' && (
                      <>
                        <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
                      </>
                    )}
                    {item.category === 'fog' && (
                      <>
                        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                      </>
                    )}
                    {(item.category === 'dust storm' || item.category === 'strong wind') && (
                      <>
                        <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
                        <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
                        <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
                      </>
                    )}
                  </svg>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-[var(--color-text-primary)] truncate leading-tight">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${sevConfig.className}`}>
                    {sevConfig.icon} {sevConfig.label}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-tertiary)]">
                    {item.timeAgo}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary)]">
                    <MapPin size={10} />
                    <span>{item.location}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary)]">
                    <ShieldCheck size={10} />
                    <span>{item.confidence}%</span>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <ChevronRight
                size={16}
                className="mt-1 text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              />
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-[var(--color-border)]">
        <button className="text-[12px] font-semibold text-[var(--color-primary-500)] hover:text-[var(--color-primary-600)] transition-colors">
          View all alerts →
        </button>
      </div>
    </div>
  );
}
