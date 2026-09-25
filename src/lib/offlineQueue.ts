/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Offline-First IndexedDB Queue
   IndexedDB persistence for resilient crowd observations
   Auto-flush on connection recovery + device tracking
   ═══════════════════════════════════════════════════════ */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { submitReport } from '../services/mockApi';
import type { WeatherCategory, Severity, ReportSubmission } from '../types/weather';

export interface QueuedReport {
  client_report_id: string; // UUID
  event_category: WeatherCategory;
  severity: Severity;
  lat: number;
  lon: number;
  city: string;
  state: string;
  raw_text: string;
  media_urls: string[];
  device_id: string;
  created_at: string; // ISO timestamp
  synced: boolean;
  synced_late: boolean;
  status: 'pending' | 'verified' | 'rejected' | 'merged';
}

interface SkySignalDBSchema extends DBSchema {
  pending_reports: {
    key: string;
    value: QueuedReport;
    indexes: {
      'by-synced': number;
      'by-created': string;
    };
  };
}

const DB_NAME = 'skysignal_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_reports';
const DEVICE_ID_KEY = 'X-Device-Id';

let dbPromise: Promise<IDBPDatabase<SkySignalDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<SkySignalDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<SkySignalDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'client_report_id',
          });
          store.createIndex('by-synced', 'synced');
          store.createIndex('by-created', 'created_at');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Returns anonymous unique device identifier persisted in localStorage
 */
export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'DEV-' + (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 12));
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch (e) {
    return 'DEV-FALLBACK-' + Math.floor(Math.random() * 100000);
  }
}

/**
 * Enqueue a report locally in IndexedDB
 */
export async function queueOfflineReport(
  data: Omit<QueuedReport, 'client_report_id' | 'created_at' | 'synced' | 'synced_late' | 'status'>
): Promise<QueuedReport> {
  const db = await getDB();
  const client_report_id = crypto?.randomUUID ? crypto.randomUUID() : 'RPT-' + Date.now();
  const created_at = new Date().toISOString();

  const queuedItem: QueuedReport = {
    ...data,
    client_report_id,
    created_at,
    synced: false,
    synced_late: false,
    status: 'pending',
  };

  await db.put(STORE_NAME, queuedItem);
  return queuedItem;
}

/**
 * Get all reports from local IndexedDB
 */
export async function getAllStoredReports(): Promise<QueuedReport[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  return all.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Get all unsynced pending reports
 */
export async function getUnsyncedReports(): Promise<QueuedReport[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  return all.filter((r) => !r.synced);
}

/**
 * Sync flush all stored unsynced reports to mockApi
 */
export async function flushOfflineQueue(
  onSyncComplete?: (count: number, reports: QueuedReport[]) => void
): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 0;
  }

  const db = await getDB();
  const pending = await getUnsyncedReports();
  if (pending.length === 0) return 0;

  let syncedCount = 0;
  const syncedReports: QueuedReport[] = [];

  for (const item of pending) {
    try {
      const delayMs = Date.now() - new Date(item.created_at).getTime();
      const isLate = delayMs > 5 * 60_000; // >5 minutes delayed sync

      const payload: ReportSubmission = {
        event_category: item.event_category,
        severity: item.severity,
        lat: item.lat,
        lon: item.lon,
        city: item.city,
        state: item.state,
        raw_text: item.raw_text,
        media_urls: item.media_urls,
        device_id: item.device_id,
        language: 'en',
      };

      await submitReport(payload);

      const updated: QueuedReport = {
        ...item,
        synced: true,
        synced_late: isLate,
        status: isLate ? 'pending' : 'verified',
      };

      await db.put(STORE_NAME, updated);
      syncedReports.push(updated);
      syncedCount++;
    } catch (err) {
      console.warn('Failed to sync report:', item.client_report_id, err);
    }
  }

  if (syncedCount > 0 && onSyncComplete) {
    onSyncComplete(syncedCount, syncedReports);
  }

  // Dispatch custom window event for UI listeners
  if (typeof window !== 'undefined' && syncedCount > 0) {
    window.dispatchEvent(
      new CustomEvent('skysignal:offline-synced', {
        detail: { count: syncedCount, reports: syncedReports },
      })
    );
  }

  return syncedCount;
}

// Automatically bind window 'online' event listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.info('🌐 Connection restored. Flushing offline report queue...');
    flushOfflineQueue();
  });
}
