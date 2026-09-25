/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — My Citizen Reports List
   Displays submissions tagged with anonymous X-Device-Id
   Badges: "Pending Verification", "Verified", "Merged into Cluster", "Synced Late"
   ═══════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  GitMerge,
  WifiOff,
  RefreshCw,
  Smartphone,
} from 'lucide-react';
import {
  getAllStoredReports,
  flushOfflineQueue,
  getOrCreateDeviceId,
  type QueuedReport,
} from '../../lib/offlineQueue';
import { CATEGORY_CONFIG, SEVERITY_CONFIG } from '../../data/mock';

interface MyReportsListProps {
  refreshTrigger?: number;
}

const DEFAULT_DEMO_REPORTS: QueuedReport[] = [
  {
    client_report_id: 'RPT-DEMO-001',
    event_category: 'rainfall',
    severity: 'severe',
    lat: 19.076,
    lon: 72.8777,
    city: 'Bandra West, Mumbai',
    state: 'Maharashtra',
    raw_text: 'Waterlogged above knee height near SV road junction. Vehicles stalling.',
    media_urls: ['https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?auto=format&fit=crop&w=600&q=80'],
    device_id: 'DEV-INITIAL',
    created_at: new Date(Date.now() - 45 * 60_000).toISOString(),
    synced: true,
    synced_late: false,
    status: 'verified',
  },
  {
    client_report_id: 'RPT-DEMO-002',
    event_category: 'thunderstorm',
    severity: 'moderate',
    lat: 28.6139,
    lon: 77.209,
    city: 'Connaught Place, Delhi',
    state: 'Delhi NCR',
    raw_text: 'Intense cloud-to-ground lightning bolts and hail gusts observed.',
    media_urls: [],
    device_id: 'DEV-INITIAL',
    created_at: new Date(Date.now() - 120 * 60_000).toISOString(),
    synced: true,
    synced_late: true, // Synced Late
    status: 'merged', // Merged into Cluster
  },
];

export default function MyReportsList({ refreshTrigger }: MyReportsListProps) {
  const { i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';

  const [reports, setReports] = useState<QueuedReport[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const loadReports = async () => {
    const devId = getOrCreateDeviceId();
    setDeviceId(devId);
    const stored = await getAllStoredReports();
    if (stored.length > 0) {
      setReports(stored);
    } else {
      setReports(DEFAULT_DEMO_REPORTS);
    }
  };

  useEffect(() => {
    loadReports();
  }, [refreshTrigger]);

  // Listen to background sync events
  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ count: number; reports: QueuedReport[] }>;
      if (customEvent.detail?.count) {
        setSyncToast(
          isHindi
            ? `सिंक पूर्ण: ${customEvent.detail.count} ऑफ़लाइन रिपोर्ट सफलतापूर्वक सबमिट की गईं!`
            : `Sync completed: ${customEvent.detail.count} offline reports submitted to IMD!`
        );
        loadReports();
        setTimeout(() => setSyncToast(null), 5000);
      }
    };

    window.addEventListener('skysignal:offline-synced', handleSync);
    return () => window.removeEventListener('skysignal:offline-synced', handleSync);
  }, [isHindi]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    const count = await flushOfflineQueue();
    await loadReports();
    setIsSyncing(false);
    setSyncToast(
      count > 0
        ? `Sync completed: ${count} offline reports submitted.`
        : 'All reports are currently up-to-date with IMD radar.'
    );
    setTimeout(() => setSyncToast(null), 4000);
  };

  const pendingSyncCount = reports.filter((r) => !r.synced).length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Device Info & Sync Bar */}
      <div className="glass-card p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
            <Smartphone size={16} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {isHindi ? 'अनाम डिवाइस आईडी' : 'Anonymous Device Identifier'}
            </div>
            <div className="text-[12px] font-mono font-bold text-slate-800">
              {deviceId || 'DEV-TRACKER-ACTIVE'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {pendingSyncCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold flex items-center gap-1">
              <WifiOff size={12} />
              <span>{pendingSyncCount} {isHindi ? 'ऑफ़लाइन कतार में' : 'Queued Offline'}</span>
            </span>
          )}

          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing...' : isHindi ? 'सिंक रीफ़्रेश' : 'Sync Queue'}</span>
          </button>
        </div>
      </div>

      {/* Sync Toast Notification */}
      {syncToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-3">
        {reports.length === 0 ? (
          <div className="glass-card py-16 text-center text-slate-400 rounded-3xl">
            {isHindi
              ? 'इस डिवाइस से अभी तक कोई रिपोर्ट दर्ज नहीं की गई है।'
              : 'No weather observations recorded from this device yet.'}
          </div>
        ) : (
          reports.map((report) => {
            const catConfig = CATEGORY_CONFIG[report.event_category];
            const sevConfig = SEVERITY_CONFIG[report.severity];

            return (
              <div
                key={report.client_report_id}
                className="glass-card p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all space-y-3"
              >
                {/* Header: ID, Badges & Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] font-black text-slate-400">
                      {report.client_report_id}
                    </span>

                    {/* Hazard Pill */}
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize"
                      style={{ backgroundColor: catConfig?.bgColor, color: catConfig?.color }}
                    >
                      {report.event_category}
                    </span>

                    {/* Severity Badge */}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sevConfig?.className}`}>
                      {sevConfig?.icon} {sevConfig?.label}
                    </span>

                    {/* Status Badge */}
                    {report.status === 'verified' ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1">
                        <CheckCircle2 size={11} />
                        <span>Verified</span>
                      </span>
                    ) : report.status === 'merged' ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px] flex items-center gap-1">
                        <GitMerge size={11} />
                        <span>Merged into Cluster</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center gap-1">
                        <Clock size={11} />
                        <span>Pending Verification</span>
                      </span>
                    )}

                    {/* Synced Late Flag */}
                    {report.synced_late && (
                      <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-bold text-[10px] flex items-center gap-1 border border-orange-200">
                        <AlertCircle size={10} />
                        <span>Synced Late</span>
                      </span>
                    )}

                    {/* Offline Unsynced Badge */}
                    {!report.synced && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center gap-1">
                        <WifiOff size={10} />
                        <span>Offline Queued</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock size={12} />
                    <span>
                      {new Date(report.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Narrative */}
                <p className="text-[13px] text-slate-800 font-medium leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  "{report.raw_text}"
                </p>

                {/* Location & Media Thumbnails */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[11px] text-slate-500 pt-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <MapPin size={13} className="text-slate-400" />
                    <span>{report.city}, {report.state}</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      ({report.lat.toFixed(3)}°N, {report.lon.toFixed(3)}°E)
                    </span>
                  </div>

                  {report.media_urls.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Evidence:</span>
                      {report.media_urls.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt="Thumbnail"
                          className="w-8 h-8 rounded-lg object-cover border border-slate-200 shadow-2xs"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
