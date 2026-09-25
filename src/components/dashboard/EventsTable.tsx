/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Active Events Table
   Sortable events table with severity badges and status pills
   ═══════════════════════════════════════════════════════ */

import { ChevronRight, ExternalLink, MapPin, ShieldCheck } from 'lucide-react';
import type { WeatherEvent } from '../../types';
import { CATEGORY_CONFIG, SEVERITY_CONFIG, formatTimeAgo } from '../../data/mock';
import { useAuth } from '../../context/AuthContext';

interface EventsTableProps {
  events: WeatherEvent[];
  onSelectEvent?: (event: WeatherEvent) => void;
}

const statusConfig: Record<string, { color: string; bgColor: string }> = {
  detected:  { color: '#8b5cf6', bgColor: '#f5f3ff' },
  emerging:  { color: '#f59e0b', bgColor: '#fffbeb' },
  confirmed: { color: '#3b82f6', bgColor: '#eff6ff' },
  active:    { color: '#ef4444', bgColor: '#fef2f2' },
  declining: { color: '#f97316', bgColor: '#fff7ed' },
  resolved:  { color: '#10b981', bgColor: '#ecfdf5' },
};

export default function EventsTable({ events, onSelectEvent }: EventsTableProps) {
  const { isAdmin } = useAuth();
  return (
    <div className="glass-card overflow-hidden animate-fade-in" style={{ animationDelay: '400ms' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
        <h2 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
          Active Events
        </h2>
        <button className="text-[12px] font-medium text-[var(--color-primary-500)] hover:text-[var(--color-primary-600)] flex items-center gap-1 transition-colors">
          View all <ExternalLink size={12} />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full" role="table">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="px-5 py-2.5 text-left text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Event
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Category
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Severity
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider hidden md:table-cell">
                Status
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider hidden lg:table-cell">
                Confidence
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider hidden lg:table-cell">
                Updated
              </th>
              <th className="px-3 py-2.5" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {events.map((event) => {
              const catConfig = CATEGORY_CONFIG[event.category];
              const sevConfig = SEVERITY_CONFIG[event.severity];
              const statConfig = statusConfig[event.status];

              return (
                <tr
                  key={event.id}
                  className={`group transition-colors ${
                    isAdmin
                      ? 'hover:bg-[var(--color-surface-hover)] cursor-pointer'
                      : 'hover:bg-[var(--color-surface-hover)]/40 cursor-default'
                  }`}
                  onClick={isAdmin ? () => onSelectEvent?.(event) : undefined}
                  tabIndex={isAdmin ? 0 : undefined}
                  onKeyDown={
                    isAdmin
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectEvent?.(event);
                          }
                        }
                      : undefined
                  }
                  role="row"
                >
                  {/* Event */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: catConfig.bgColor, color: catConfig.color }}
                        aria-hidden="true"
                      >
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: catConfig.color, opacity: 0.8 }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-[var(--color-text-primary)] truncate max-w-[200px]">
                          {event.title}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin size={10} className="text-[var(--color-text-tertiary)]" />
                          <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            {event.location.name}, {event.location.state}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-3 py-3">
                    <span
                      className="px-2 py-1 rounded-md text-[10px] font-semibold capitalize"
                      style={{ backgroundColor: catConfig.bgColor, color: catConfig.color }}
                    >
                      {event.category}
                    </span>
                  </td>

                  {/* Severity */}
                  <td className="px-3 py-3">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${sevConfig.className}`}>
                      {sevConfig.icon} {sevConfig.label}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3 hidden md:table-cell">
                    <span
                      className="px-2 py-1 rounded-full text-[10px] font-semibold capitalize"
                      style={{ backgroundColor: statConfig.bgColor, color: statConfig.color }}
                    >
                      {event.status}
                    </span>
                  </td>

                  {/* Confidence */}
                  <td className="px-3 py-3 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={13} className="text-[var(--color-primary-500)]" />
                      <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                        {event.confidence}%
                      </span>
                      <div className="w-12 h-1.5 rounded-full bg-[var(--color-surface-active)] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${event.confidence}%`,
                            backgroundColor: event.confidence >= 85 ? '#10b981' : event.confidence >= 70 ? '#f59e0b' : '#ef4444',
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Updated */}
                  <td className="px-3 py-3 hidden lg:table-cell">
                    <span className="text-[11px] text-[var(--color-text-tertiary)]">
                      {formatTimeAgo(event.updatedAt)}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-3 py-3">
                    {isAdmin ? (
                      <ChevronRight
                        size={16}
                        className="text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">Read-Only</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
