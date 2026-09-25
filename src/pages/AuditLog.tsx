/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Administrative Audit Log
   Immutable forensic record for IMD meteorological triage
   Searchable table logging administrative actions:
   Analyst Email, Action (verify_report, reject_report, merge_cluster),
   Target Type & ID, Timestamp (UTC + IST), and cryptographic hash.
   ═══════════════════════════════════════════════════════ */

import { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Search,
  Download,
  Lock,
  Filter,
  CheckCircle2,
  XCircle,
  GitMerge,
  AlertTriangle,
  Radio,
  Clock,
  User,
  Key,
} from 'lucide-react';

export type AuditActionType =
  | 'verify_report'
  | 'reject_report'
  | 'merge_cluster'
  | 'escalate_alert'
  | 'broadcast_advisory';

export type TargetType = 'report' | 'cluster' | 'event';

export interface AuditRecord {
  id: string;
  analystEmail: string;
  analystRole: string;
  action: AuditActionType;
  targetType: TargetType;
  targetId: string;
  utcTimestamp: string;
  istTimestamp: string;
  rationale: string;
  cryptoHash: string;
}

const INITIAL_AUDIT_DATA: AuditRecord[] = [
  {
    id: 'AUD-9014',
    analystEmail: 'analyst@imd.gov.in',
    analystRole: 'Triage Specialist',
    action: 'verify_report',
    targetType: 'report',
    targetId: 'RPT-001',
    utcTimestamp: '2026-09-24 16:45:12 UTC',
    istTimestamp: '2026-09-24 22:15:12 IST',
    rationale: 'Citizen geotagged photo verified: knee-deep water on Dadar TT road with stalled bus. Consistent with 68mm/h radar return.',
    cryptoHash: '0x9a4f...31bc',
  },
  {
    id: 'AUD-9013',
    analystEmail: 'analyst.delhi@imd.gov.in',
    analystRole: 'Lead Forecaster',
    action: 'reject_report',
    targetType: 'report',
    targetId: 'RPT-036',
    utcTimestamp: '2026-09-24 16:32:05 UTC',
    istTimestamp: '2026-09-24 22:02:05 IST',
    rationale: 'Flagged misleading panic report: viral claim of 10ft water at Connaught Place matched archived video from July 2023.',
    cryptoHash: '0x4e2b...87da',
  },
  {
    id: 'AUD-9012',
    analystEmail: 'dr.menon@imd.gov.in',
    analystRole: 'NLP Intelligence Officer',
    action: 'merge_cluster',
    targetType: 'cluster',
    targetId: 'DUP-001',
    utcTimestamp: '2026-09-24 16:18:44 UTC',
    istTimestamp: '2026-09-24 21:48:44 IST',
    rationale: 'Fused 3 multi-source signals (Citizen RPT-001, Twitter @MumbaiRains, NDTV RSS) into Canonical Event #EVT-CANON-001. Cosine similarity 0.94.',
    cryptoHash: '0x1c88...66ef',
  },
  {
    id: 'AUD-9011',
    analystEmail: 'dr.sharma@imd.gov.in',
    analystRole: 'Director of Nowcasting',
    action: 'escalate_alert',
    targetType: 'event',
    targetId: 'EVT-2026-001',
    utcTimestamp: '2026-09-24 15:55:10 UTC',
    istTimestamp: '2026-09-24 21:25:10 IST',
    rationale: 'Santacruz doppler station reflectivity crossed 54 dBZ. Escalated Mumbai metropolitan region warning to Red Alert.',
    cryptoHash: '0x8f2a...c491',
  },
  {
    id: 'AUD-9010',
    analystEmail: 'analyst@imd.gov.in',
    analystRole: 'Triage Specialist',
    action: 'verify_report',
    targetType: 'report',
    targetId: 'RPT-006',
    utcTimestamp: '2026-09-24 15:30:20 UTC',
    istTimestamp: '2026-09-24 21:00:20 IST',
    rationale: 'Ground citizen report corroborated by Chennai Municipal rain gauge (120mm/6hr) and Adyar river telemetry.',
    cryptoHash: '0x3e1d...9a70',
  },
  {
    id: 'AUD-9009',
    analystEmail: 'dr.menon@imd.gov.in',
    analystRole: 'NLP Intelligence Officer',
    action: 'merge_cluster',
    targetType: 'cluster',
    targetId: 'DUP-002',
    utcTimestamp: '2026-09-24 15:10:35 UTC',
    istTimestamp: '2026-09-24 20:40:35 IST',
    rationale: 'Collapsed T. Nagar flooding signals into Canonical Event #EVT-CANON-002 with 91% spatiotemporal similarity score.',
    cryptoHash: '0x7b33...2110',
  },
  {
    id: 'AUD-9008',
    analystEmail: 'analyst.delhi@imd.gov.in',
    analystRole: 'Lead Forecaster',
    action: 'reject_report',
    targetType: 'report',
    targetId: 'RPT-037',
    utcTimestamp: '2026-09-24 14:45:00 UTC',
    istTimestamp: '2026-09-24 20:15:00 IST',
    rationale: 'Fabricated tsunami warning at Bandra-Worli Sea Link rejected. P(misleading) = 0.93. Account flagged in ingestor blocklist.',
    cryptoHash: '0x5b72...120f',
  },
  {
    id: 'AUD-9007',
    analystEmail: 'dr.sharma@imd.gov.in',
    analystRole: 'Director of Nowcasting',
    action: 'broadcast_advisory',
    targetType: 'event',
    targetId: 'EVT-2026-003',
    utcTimestamp: '2026-09-24 14:00:15 UTC',
    istTimestamp: '2026-09-24 19:30:15 IST',
    rationale: 'Public flash flood emergency broadcast dispatched via NDMA CAP gateway to 4.2 million mobile subscribers in coastal Tamil Nadu.',
    cryptoHash: '0xaa90...dd31',
  },
];

const ACTION_CONFIG: Record<
  AuditActionType,
  { label: string; icon: any; color: string; bg: string }
> = {
  verify_report: {
    label: 'verify_report',
    icon: CheckCircle2,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
  },
  reject_report: {
    label: 'reject_report',
    icon: XCircle,
    color: 'text-rose-700',
    bg: 'bg-rose-50 border-rose-200',
  },
  merge_cluster: {
    label: 'merge_cluster',
    icon: GitMerge,
    color: 'text-purple-700',
    bg: 'bg-purple-50 border-purple-200',
  },
  escalate_alert: {
    label: 'escalate_alert',
    icon: AlertTriangle,
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
  },
  broadcast_advisory: {
    label: 'broadcast_advisory',
    icon: Radio,
    color: 'text-sky-700',
    bg: 'bg-sky-50 border-sky-200',
  },
};

export default function AuditLog() {
  const [logs] = useState<AuditRecord[]>(INITIAL_AUDIT_DATA);
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState<AuditActionType | 'all'>('all');

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedAction !== 'all' && log.action !== selectedAction) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchEmail = log.analystEmail.toLowerCase().includes(q);
        const matchAction = log.action.toLowerCase().includes(q);
        const matchTarget = log.targetId.toLowerCase().includes(q);
        const matchTargetType = log.targetType.toLowerCase().includes(q);
        const matchRationale = log.rationale.toLowerCase().includes(q);
        const matchHash = log.cryptoHash.toLowerCase().includes(q);
        if (!matchEmail && !matchAction && !matchTarget && !matchTargetType && !matchRationale && !matchHash) {
          return false;
        }
      }
      return true;
    });
  }, [logs, selectedAction, search]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = 'ID,Analyst Email,Role,Action,Target Type,Target ID,UTC Timestamp,IST Timestamp,Rationale,Hash\n';
    const rows = filteredLogs
      .map((l) =>
        `"${l.id}","${l.analystEmail}","${l.analystRole}","${l.action}","${l.targetType}","${l.targetId}","${l.utcTimestamp}","${l.istTimestamp}","${l.rationale.replace(/"/g, '""')}","${l.cryptoHash}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SkySignal_AuditLog_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lock size={22} className="text-sky-600" />
            <h1 className="text-[22px] font-black text-slate-900 tracking-tight font-['Outfit']">
              Administrative Audit Log & Decision Ledger
            </h1>
          </div>
          <p className="text-[13px] text-slate-500">
            Immutable forensic accountability record capturing all analyst triage actions, cluster fusions, and emergency escalations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-bold flex items-center gap-1.5 shadow-2xs">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>SHA-256 Ledger Sealed</span>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200/90 hover:bg-slate-50 rounded-xl text-[12px] font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer"
            title="Download CSV audit log"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="glass-card p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by analyst email, action, target ID (e.g. RPT-001), or rationale..."
              className="w-full pl-9 pr-3.5 py-2 text-[12px] bg-slate-50 border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800"
            />
          </div>

          {/* Action Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-bold">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
              <Filter size={12} />
              Action:
            </span>
            <button
              onClick={() => setSelectedAction('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                selectedAction === 'all'
                  ? 'bg-slate-900 text-white font-extrabold shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Actions
            </button>
            {(['verify_report', 'reject_report', 'merge_cluster', 'escalate_alert', 'broadcast_advisory'] as AuditActionType[]).map((act) => {
              const cfg = ACTION_CONFIG[act];
              return (
                <button
                  key={act}
                  onClick={() => setSelectedAction(act)}
                  className={`px-2.5 py-1 rounded-lg transition-colors font-mono cursor-pointer ${
                    selectedAction === act
                      ? 'bg-sky-600 text-white font-bold shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 font-medium">
          <span>
            Displaying <strong className="text-slate-800">{filteredLogs.length}</strong> authenticated audit records
          </span>
          <span className="font-mono text-[10px]">
            Compliant with IMD Digital Forensic Standard DFS-2026
          </span>
        </div>
      </div>

      {/* ── Searchable Audit Table ── */}
      <div className="glass-card overflow-hidden rounded-3xl border border-slate-200/90 shadow-sm animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Audit ID</th>
                <th className="py-3 px-4">Analyst Email & Role</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Target Type & ID</th>
                <th className="py-3 px-4">Timestamp (UTC + IST)</th>
                <th className="py-3 px-5">Operational Rationale & Provenance</th>
                <th className="py-3 px-4 text-right">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-400">
                    No audit records match the active search or action filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const actionMeta = ACTION_CONFIG[log.action];
                  const ActionIcon = actionMeta.icon;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Audit Record ID */}
                      <td className="py-3.5 px-4 font-mono text-[11px] font-black text-slate-500">
                        {log.id}
                      </td>

                      {/* Analyst Email & Role */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900">
                            <User size={13} className="text-slate-400" />
                            <span>{log.analystEmail}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block pl-5">
                            {log.analystRole}
                          </span>
                        </div>
                      </td>

                      {/* Action Pill */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold flex items-center gap-1.5 border w-fit ${actionMeta.bg} ${actionMeta.color}`}
                        >
                          <ActionIcon size={13} />
                          <span>{actionMeta.label}</span>
                        </span>
                      </td>

                      {/* Target Type & ID */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-0.5">
                          <span className="font-mono font-black text-slate-900 text-[12px] block">
                            {log.targetId}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1.5 py-0.2 bg-slate-100 rounded">
                            {log.targetType}
                          </span>
                        </div>
                      </td>

                      {/* Timestamp (UTC + IST) */}
                      <td className="py-3.5 px-4 min-w-[200px]">
                        <div className="space-y-1">
                          {/* IST Timestamp */}
                          <div className="flex items-center gap-1.5 text-slate-900 font-bold font-mono text-[11px]">
                            <Clock size={12} className="text-sky-600 shrink-0" />
                            <span>{log.istTimestamp}</span>
                          </div>
                          {/* UTC Timestamp */}
                          <div className="text-[10px] font-mono text-slate-400 pl-4.5">
                            {log.utcTimestamp}
                          </div>
                        </div>
                      </td>

                      {/* Rationale Statement */}
                      <td className="py-3.5 px-5 max-w-md">
                        <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                          {log.rationale}
                        </p>
                      </td>

                      {/* Crypto Hash */}
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className="font-mono text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded-md border border-slate-200/80 inline-flex items-center gap-1 cursor-help"
                          title={`Verification Hash: ${log.cryptoHash}`}
                        >
                          <Key size={10} className="text-slate-400" />
                          <span>{log.cryptoHash}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
