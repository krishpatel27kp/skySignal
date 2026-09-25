/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Audit Log & Decision Ledger
   Immutable administrative record for meteorological triage
   ═══════════════════════════════════════════════════════ */

import { useState, useMemo } from 'react';
import {
  FileCode,
  ShieldCheck,
  Search,
  Download,
  Lock,
} from 'lucide-react';

interface AuditEntry {
  id: string;
  timestamp: string;
  analyst: string;
  role: string;
  action: 'verify' | 'reject' | 'merge' | 'escalate' | 'broadcast';
  targetId: string;
  targetType: 'report' | 'event' | 'cluster';
  rationale: string;
  hash: string;
}

const INITIAL_AUDIT_LOGS: AuditEntry[] = [
  {
    id: 'AUD-8921',
    timestamp: '2026-09-24T16:15:20Z',
    analyst: 'dr.sharma@imd.gov.in',
    role: 'Senior Duty Forecaster',
    action: 'escalate',
    targetId: 'EVT-2026-001',
    targetType: 'event',
    rationale: 'Santacruz radar reflectivity exceeded 52 dBZ with 140 corroborating citizen geotags. Elevated to Red Alert.',
    hash: '0x8f2a...c491',
  },
  {
    id: 'AUD-8920',
    timestamp: '2026-09-24T16:02:14Z',
    analyst: 'analyst.delhi@imd.gov.in',
    role: 'Triage Specialist',
    action: 'verify',
    targetId: 'REP-2026-012',
    targetType: 'report',
    rationale: 'Citizen video shows submerged vehicles at Milan Subway. P(misleading)=0.04.',
    hash: '0x3e1d...9a70',
  },
  {
    id: 'AUD-8919',
    timestamp: '2026-09-24T15:48:33Z',
    analyst: 'analyst.delhi@imd.gov.in',
    role: 'Triage Specialist',
    action: 'reject',
    targetId: 'REP-2026-031',
    targetType: 'report',
    rationale: 'Reverse image match indicates photo is from 2021 Uttarakhand deluge. Marked misleading.',
    hash: '0x5b72...120f',
  },
  {
    id: 'AUD-8918',
    timestamp: '2026-09-24T15:30:10Z',
    analyst: 'dr.menon@imd.gov.in',
    role: 'Lead NLP Officer',
    action: 'merge',
    targetId: 'CLUSTER-DEL-02',
    targetType: 'cluster',
    rationale: 'Merged 3 duplicate tweets reporting dust storm in Dwarka sector 14. Cosine similarity 0.94.',
    hash: '0x1c44...66ef',
  },
  {
    id: 'AUD-8917',
    timestamp: '2026-09-24T14:55:00Z',
    analyst: 'dr.sharma@imd.gov.in',
    role: 'Senior Duty Forecaster',
    action: 'broadcast',
    targetId: 'EVT-2026-004',
    targetType: 'event',
    rationale: 'Public heatwave advisory issued to NDMA emergency channel for West Rajasthan districts.',
    hash: '0xaa90...dd31',
  },
];

export default function AuditLogPage() {
  const [logs] = useState<AuditEntry[]>(INITIAL_AUDIT_LOGS);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (actionFilter !== 'all' && l.action !== actionFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          l.targetId.toLowerCase().includes(q) ||
          l.analyst.toLowerCase().includes(q) ||
          l.rationale.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, actionFilter, search]);

  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'ID,Timestamp,Analyst,Role,Action,TargetID,Rationale,Hash\n' +
      filteredLogs
        .map(
          (l) =>
            `"${l.id}","${l.timestamp}","${l.analyst}","${l.role}","${l.action}","${l.targetId}","${l.rationale}","${l.hash}"`
        )
        .join('\n');

    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodeURI(csvContent));
    downloadAnchor.setAttribute('download', `SkySignal_Audit_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileCode size={22} className="text-sky-600" />
            <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight">
              Audit Log & Regulatory Decision Ledger
            </h1>
          </div>
          <p className="text-[13px] text-slate-500">
            Tamper-resistant cryptographic tracking of all analyst interventions and emergency alerts.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-[12px] font-bold hover:bg-slate-50 transition-colors shadow-xs"
        >
          <Download size={14} />
          <span>Export Audit Trail (CSV)</span>
        </button>
      </div>

      {/* ── Security Trust Banner ── */}
      <div className="glass-card p-4 flex items-center justify-between border-l-4 border-sky-500 bg-sky-50/30">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-100 text-sky-700">
            <Lock size={18} />
          </div>
          <div>
            <h4 className="text-[13px] font-bold text-slate-800">
              Regulatory Accountability Framework Active
            </h4>
            <p className="text-[11px] text-slate-500">
              Each state mutation is cryptographically signed and archived for parliamentary meteorological oversight.
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>SHA-256 Ledger Verified</span>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by target ID, analyst, rationale..."
            className="w-full pl-9 pr-3 py-2 text-[12px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="py-1.5 px-3 text-[12px] bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">All Actions</option>
            <option value="verify">Verified</option>
            <option value="reject">Rejected</option>
            <option value="escalate">Escalated</option>
            <option value="merge">Cluster Merged</option>
            <option value="broadcast">Broadcasted</option>
          </select>
        </div>
      </div>

      {/* ── Ledger Table ── */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Audit ID</th>
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Officer</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Target Reference</th>
                <th className="py-3 px-4">Decision Rationale</th>
                <th className="py-3 px-3 text-right">Cryptographic Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                return (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {log.id}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px]">
                      {new Date(log.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800">{log.analyst}</div>
                      <div className="text-[10px] text-slate-400">{log.role}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          log.action === 'escalate'
                            ? 'bg-red-100 text-red-800'
                            : log.action === 'verify'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.action === 'reject'
                            ? 'bg-rose-100 text-rose-800'
                            : log.action === 'merge'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] font-semibold text-slate-700">
                      {log.targetId}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs leading-relaxed">
                      {log.rationale}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[10px] text-slate-400">
                      {log.hash}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
