/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Dashboard Overview Page
   Composes KPI cards, map, priority watch, events table,
   report volume chart, and source reliability meters
   ═══════════════════════════════════════════════════════ */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, RefreshCw } from 'lucide-react';
import KpiCards from '../components/dashboard/KpiCards';
import GeoRadarMap from '../components/dashboard/GeoRadarMap';
import PriorityWatchPanel from '../components/dashboard/PriorityWatchPanel';
import EventsTable from '../components/dashboard/EventsTable';
import ReportVolumeChart from '../components/dashboard/ReportVolumeChart';
import SourceReliabilityPanel from '../components/dashboard/SourceReliabilityPanel';
import EventDetailDrawer from '../components/events/EventDetailDrawer';
import {
  mockKpiStats,
  mockEvents,
  mockPriorityWatch,
  mockChartData,
  mockSourceReliability,
} from '../data/mock';

export default function DashboardPage() {
  const { t } = useTranslation();
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [eventsList, setEventsList] = useState(mockEvents);

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cloud size={20} className="text-[var(--color-primary-500)]" />
            <h1 className="text-[22px] font-extrabold text-[var(--color-text-primary)] tracking-tight">
              {t('dashboard.situationOverview')}
            </h1>
          </div>
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--color-text-tertiary)]">
            {t('dashboard.lastUpdated')}: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </span>
          <button
            className="
              flex items-center gap-2 px-3 py-2 rounded-lg
              bg-[var(--color-primary-500)] text-white text-[12px] font-semibold
              hover:bg-[var(--color-primary-600)] active:bg-[var(--color-primary-700)]
              transition-colors duration-200 shadow-sm
              hover:shadow-[var(--shadow-glow-primary)]
            "
            aria-label={t('dashboard.refresh')}
          >
            <RefreshCw size={14} />
            <span className="hidden sm:inline">{t('dashboard.refresh')}</span>
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards ── */}
      <KpiCards stats={mockKpiStats} />

      {/* ── Main Content Grid: Map + Priority Watch ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        <GeoRadarMap events={eventsList} onSelectEvent={setSelectedEvent} />
        <PriorityWatchPanel items={mockPriorityWatch} />
      </div>

      {/* ── Events Table ── */}
      <EventsTable events={eventsList} onSelectEvent={setSelectedEvent} />

      {/* ── Bottom Grid: Chart + Source Reliability ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <ReportVolumeChart data={mockChartData} />
        <SourceReliabilityPanel sources={mockSourceReliability} />
      </div>

      {/* ── Event Detail Drawer Overlay ── */}
      {selectedEvent && (
        <EventDetailDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onStatusChange={(id, newStatus) => {
            setEventsList((prev) =>
              prev.map((e) => (e.id === id ? { ...e, status: newStatus as any } : e))
            );
          }}
        />
      )}
    </div>
  );
}
