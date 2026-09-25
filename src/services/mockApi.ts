/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Mock API Service Layer
   Simulates backend REST API + SSE telemetry stream
   300ms latency · filters · bulk actions · real-time hook
   ═══════════════════════════════════════════════════════ */

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  WeatherEvent,
  Report,
  DuplicateCluster,
  EventFilters,
  ReportFilters,
  ReportSubmission,
  BulkActionPayload,
  TelemetryMessage,
  TelemetryEventType,
} from '../types/weather';
import {
  mockWeatherEvents,
  mockReports,
  mockDuplicateClusters,
  CATEGORY_META,
} from '../lib/mockData';

// ═══════════════════════════════════════════════════════
// Simulated Network Delay
// ═══════════════════════════════════════════════════════

const SIMULATED_LATENCY_MS = 300;

function delay(ms: number = SIMULATED_LATENCY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════
// In-Memory State (mutable copies for mutations)
// ═══════════════════════════════════════════════════════

let eventsStore: WeatherEvent[] = structuredClone(mockWeatherEvents);
let reportsStore: Report[] = structuredClone(mockReports);
let clustersStore: DuplicateCluster[] = structuredClone(mockDuplicateClusters);
let nextReportId = 36;
let nextEventId = 15;

/** Reset stores to initial state (useful for testing) */
export function resetStores(): void {
  eventsStore = structuredClone(mockWeatherEvents);
  reportsStore = structuredClone(mockReports);
  clustersStore = structuredClone(mockDuplicateClusters);
  nextReportId = 36;
  nextEventId = 15;
}

// ═══════════════════════════════════════════════════════
// GET /v1/events — Fetch weather events with filters
// ═══════════════════════════════════════════════════════

export async function getEvents(filters?: EventFilters): Promise<WeatherEvent[]> {
  await delay();

  let results = [...eventsStore];

  if (filters) {
    if (filters.category) {
      results = results.filter((e) => e.category === filters.category);
    }

    if (filters.severity) {
      results = results.filter((e) => e.severity === filters.severity);
    }

    if (filters.lifecycle_status) {
      results = results.filter((e) => e.lifecycle_status === filters.lifecycle_status);
    }

    if (filters.state) {
      results = results.filter((e) =>
        e.state.toLowerCase().includes(filters.state!.toLowerCase())
      );
    }

    if (filters.time_range) {
      const now = Date.now();
      const cutoffs: Record<string, number> = {
        last_1h: 3600_000,
        last_6h: 21600_000,
        last_24h: 86400_000,
        last_7d: 604800_000,
      };
      const cutoff = now - (cutoffs[filters.time_range] ?? 86400_000);
      results = results.filter(
        (e) => new Date(e.last_updated_at).getTime() >= cutoff
      );
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.city.toLowerCase().includes(q) ||
          e.state.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
      );
    }
  }

  // Sort: active/severe first, then by last_updated_at desc
  results.sort((a, b) => {
    const severityOrder = { severe: 0, moderate: 1, minor: 2 };
    const diff = severityOrder[a.severity] - severityOrder[b.severity];
    if (diff !== 0) return diff;
    return new Date(b.last_updated_at).getTime() - new Date(a.last_updated_at).getTime();
  });

  return results;
}

// ═══════════════════════════════════════════════════════
// GET /v1/reports — Fetch reports with filters
// ═══════════════════════════════════════════════════════

export async function getReports(filters?: ReportFilters): Promise<Report[]> {
  await delay();

  let results = [...reportsStore];

  if (filters) {
    if (filters.source_platform) {
      results = results.filter((r) => r.source_platform === filters.source_platform);
    }

    if (filters.status) {
      results = results.filter((r) => r.status === filters.status);
    }

    if (filters.event_category) {
      results = results.filter((r) => r.event_category === filters.event_category);
    }

    if (filters.state) {
      results = results.filter((r) =>
        r.state.toLowerCase().includes(filters.state!.toLowerCase())
      );
    }

    if (filters.min_confidence !== undefined) {
      results = results.filter((r) => r.category_confidence >= filters.min_confidence!);
    }

    if (filters.max_p_misleading !== undefined) {
      results = results.filter((r) => r.p_misleading <= filters.max_p_misleading!);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (r) =>
          r.raw_text.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.source_handle.toLowerCase().includes(q)
      );
    }
  }

  // Sort by ingested_at descending (newest first)
  results.sort(
    (a, b) => new Date(b.ingested_at).getTime() - new Date(a.ingested_at).getTime()
  );

  return results;
}

// ═══════════════════════════════════════════════════════
// GET /v1/reports/clusters — Fetch duplicate clusters
// ═══════════════════════════════════════════════════════

export async function getDuplicateClusters(): Promise<DuplicateCluster[]> {
  await delay();
  return structuredClone(clustersStore);
}

// ═══════════════════════════════════════════════════════
// POST /v1/reports — Submit a citizen report
// ═══════════════════════════════════════════════════════

export async function submitReport(data: ReportSubmission): Promise<Report> {
  await delay(500); // Simulate upload latency

  const newReport: Report = {
    id: `RPT-${String(nextReportId++).padStart(3, '0')}`,
    source_platform: 'citizen_app',
    source_handle: data.device_id,
    raw_text: data.raw_text,
    media_urls: data.media_urls,
    lat: data.lat,
    lon: data.lon,
    city: data.city,
    state: data.state,
    event_category: data.event_category,
    category_confidence: 0.80 + Math.random() * 0.15,  // Simulate ML confidence
    p_misleading: Math.random() * 0.15,                 // Low p_misleading for citizen app
    duplicate_cluster_id: null,
    status: 'pending',
    reported_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    synced_late: false,
  };

  reportsStore.unshift(newReport);
  return structuredClone(newReport);
}

// ═══════════════════════════════════════════════════════
// POST /v1/reports/bulk-action — Approve/reject reports
// ═══════════════════════════════════════════════════════

export async function bulkActionReports(
  payload: BulkActionPayload
): Promise<{ updated: number; report_ids: string[] }> {
  await delay();

  const newStatus = payload.action === 'verify' ? 'verified' : 'rejected';
  let updated = 0;

  for (const report of reportsStore) {
    if (payload.report_ids.includes(report.id)) {
      report.status = newStatus as Report['status'];
      updated++;
    }
  }

  return { updated, report_ids: payload.report_ids };
}

// ═══════════════════════════════════════════════════════
// GET /v1/events/:id — Get single event by ID
// ═══════════════════════════════════════════════════════

export async function getEventById(id: string): Promise<WeatherEvent | null> {
  await delay();
  const event = eventsStore.find((e) => e.id === id);
  return event ? structuredClone(event) : null;
}

// ═══════════════════════════════════════════════════════
// GET /v1/stats — Dashboard KPI aggregates
// ═══════════════════════════════════════════════════════

export interface DashboardStats {
  active_events: number;
  reports_today: number;
  verified_pct: number;
  severe_alerts: number;
  pending_verification: number;
  duplicate_clusters: number;
  contradiction_events: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await delay();

  const activeEvents = eventsStore.filter(
    (e) => e.lifecycle_status !== 'resolved'
  ).length;

  const pendingReports = reportsStore.filter((r) => r.status === 'pending');
  const verifiedReports = reportsStore.filter((r) => r.status === 'verified');
  const totalProcessed = verifiedReports.length + reportsStore.filter((r) => r.status === 'rejected').length;
  const verifiedPct = totalProcessed > 0
    ? Math.round((verifiedReports.length / totalProcessed) * 100)
    : 0;

  return {
    active_events: activeEvents,
    reports_today: reportsStore.length,
    verified_pct: verifiedPct,
    severe_alerts: eventsStore.filter((e) => e.severity === 'severe').length,
    pending_verification: pendingReports.length,
    duplicate_clusters: clustersStore.length,
    contradiction_events: eventsStore.filter((e) => e.has_contradiction).length,
  };
}

// ═══════════════════════════════════════════════════════
// SSE Simulation — useMockTelemetry() Hook
// Emits event_created / event_updated every ~20 seconds
// ═══════════════════════════════════════════════════════

/** Generates a random telemetry event */
function generateTelemetryEvent(): TelemetryMessage {
  const types: TelemetryEventType[] = ['event_created', 'event_updated'];
  const type = types[Math.floor(Math.random() * types.length)];

  if (type === 'event_updated') {
    // Pick a random existing event and simulate an update
    const source = eventsStore[Math.floor(Math.random() * eventsStore.length)];
    const updated: WeatherEvent = {
      ...structuredClone(source),
      last_updated_at: new Date().toISOString(),
      confidence: Math.min(100, source.confidence + Math.floor(Math.random() * 5 - 2)),
      evidence_summary: {
        ...source.evidence_summary,
        citizen_reports: source.evidence_summary.citizen_reports + Math.floor(Math.random() * 3),
        social_posts: source.evidence_summary.social_posts + Math.floor(Math.random() * 8),
      },
    };

    // Apply update to store
    const idx = eventsStore.findIndex((e) => e.id === updated.id);
    if (idx !== -1) eventsStore[idx] = updated;

    return {
      type: 'event_updated',
      payload: updated,
      timestamp: new Date().toISOString(),
    };
  }

  // event_created — synthesize a new minor event
  const cities = Object.values({
    mumbai:   { city: 'Mumbai',    state: 'Maharashtra',  lat: 19.076, lon: 72.877 },
    delhi:    { city: 'Delhi',     state: 'Delhi NCR',    lat: 28.614, lon: 77.209 },
    chennai:  { city: 'Chennai',   state: 'Tamil Nadu',   lat: 13.083, lon: 80.271 },
    kolkata:  { city: 'Kolkata',   state: 'West Bengal',  lat: 22.573, lon: 88.364 },
    dehradun: { city: 'Dehradun',  state: 'Uttarakhand',  lat: 30.317, lon: 78.032 },
  });
  const loc = cities[Math.floor(Math.random() * cities.length)];

  const categories: (keyof typeof CATEGORY_META)[] = [
    'rainfall', 'thunderstorm', 'flooding', 'heatwave', 'fog', 'dust storm', 'strong wind',
  ];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const severities: ('minor' | 'moderate' | 'severe')[] = ['minor', 'moderate', 'severe'];
  const severity = severities[Math.floor(Math.random() * 3)];

  const newEvent: WeatherEvent = {
    id: `EVT-2026-${String(nextEventId++).padStart(3, '0')}`,
    title: `New ${CATEGORY_META[category].label_en} Alert — ${loc.city}`,
    category,
    ...loc,
    severity,
    confidence: 55 + Math.floor(Math.random() * 30),
    lifecycle_status: 'detected',
    has_contradiction: false,
    independent_source_count: 1,
    detected_at: new Date().toISOString(),
    last_updated_at: new Date().toISOString(),
    evidence_summary: {
      citizen_reports: Math.floor(Math.random() * 5) + 1,
      social_posts: Math.floor(Math.random() * 15),
      sensor_corroborated: Math.random() > 0.5,
      news_articles: Math.floor(Math.random() * 3),
    },
  };

  eventsStore.push(newEvent);

  return {
    type: 'event_created',
    payload: newEvent,
    timestamp: new Date().toISOString(),
  };
}

/** Hook that simulates SSE /v1/events/stream with ~20s interval */
export function useMockTelemetry(options?: {
  enabled?: boolean;
  intervalMs?: number;
  onMessage?: (msg: TelemetryMessage) => void;
}) {
  const { enabled = true, intervalMs = 20_000, onMessage } = options ?? {};
  const [lastMessage, setLastMessage] = useState<TelemetryMessage | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const callbackRef = useRef(onMessage);
  callbackRef.current = onMessage;

  const connect = useCallback(() => {
    setIsConnected(true);
  }, []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return;
    }

    // Simulate initial connection delay
    const connectTimer = setTimeout(() => {
      setIsConnected(true);
    }, 800);

    const interval = setInterval(() => {
      if (!enabled) return;

      const msg = generateTelemetryEvent();
      setLastMessage(msg);
      setMessageCount((c) => c + 1);
      callbackRef.current?.(msg);
    }, intervalMs);

    return () => {
      clearTimeout(connectTimer);
      clearInterval(interval);
      setIsConnected(false);
    };
  }, [enabled, intervalMs]);

  return {
    lastMessage,
    messageCount,
    isConnected,
    connect,
    disconnect,
  };
}

/** Convenience hook for real-time telemetry stream listener */
export function useRealTimeTelemetry(onMessage?: (msg: TelemetryMessage) => void) {
  return useMockTelemetry({ onMessage, intervalMs: 15_000 });
}

