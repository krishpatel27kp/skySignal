/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Real Axios API Client & Interceptors
   Connects React frontend to FastAPI backend at /v1
   Bearer token auth · X-Device-Id · SSE telemetry hook
   ═══════════════════════════════════════════════════════ */

import axios from 'axios';
import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  WeatherEvent,
  Report,
  DuplicateCluster,
  EventFilters,
  ReportFilters,
  BulkActionPayload,
  TelemetryMessage,
  TelemetryEventType,
} from '../types/weather';

// ═══════════════════════════════════════════════════════
// Axios Instance & Interceptors
// ═══════════════════════════════════════════════════════

const API_BASE_URL = 'http://127.0.0.1:8000/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request Interceptor ──
// Automatically inject Authorization Bearer token and X-Device-Id
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const deviceId = localStorage.getItem('X-Device-Id');
    if (deviceId) {
      config.headers['X-Device-Id'] = deviceId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor ──
// Handle 401 Unauthorized by clearing stale tokens
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear stale credentials — downstream auth context will handle UI
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
    }
    return Promise.reject(error);
  }
);

export default apiClient;

// ═══════════════════════════════════════════════════════
// Paginated Response Envelope (matches backend PaginatedResponse)
// ═══════════════════════════════════════════════════════

export interface PaginatedResponse<T> {
  results: T[];
  total: number;
  limit: number;
  offset: number;
}

// ═══════════════════════════════════════════════════════
// Dashboard Stats (matches GET /v1/analytics/overview)
// ═══════════════════════════════════════════════════════

export interface DashboardStats {
  active_events: number;
  critical_high_events: number;
  total_reports: number;
  pending_reports: number;
}

// ═══════════════════════════════════════════════════════
// Auth Endpoints
// ═══════════════════════════════════════════════════════

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expires_at: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

/** POST /v1/auth/login — Admin JWT authentication */
export async function loginAdmin(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', payload);
  return data;
}

/** GET /v1/auth/me — Get authenticated admin profile */
export async function getMe(): Promise<LoginResponse['user']> {
  const { data } = await apiClient.get<LoginResponse['user']>('/auth/me');
  return data;
}

// ═══════════════════════════════════════════════════════
// Events Endpoints
// ═══════════════════════════════════════════════════════

/** GET /v1/events — Fetch paginated weather events with filters */
export async function getEvents(
  filters?: EventFilters,
  pagination?: { limit?: number; offset?: number }
): Promise<PaginatedResponse<WeatherEvent>> {
  const params: Record<string, string | number> = {};

  if (filters) {
    if (filters.category) params.category = filters.category;
    if (filters.severity) params.severity = filters.severity;
    if (filters.lifecycle_status) params.status = filters.lifecycle_status;
    if (filters.state) params.state = filters.state;
    if (filters.search) params.q = filters.search;
    if (filters.time_range) {
      // Convert frontend time_range to date_from ISO
      const cutoffs: Record<string, number> = {
        last_1h: 3600_000,
        last_6h: 21600_000,
        last_24h: 86400_000,
        last_7d: 604800_000,
      };
      const ms = cutoffs[filters.time_range];
      if (ms) {
        params.date_from = new Date(Date.now() - ms).toISOString();
      }
    }
  }

  if (pagination?.limit) params.limit = pagination.limit;
  if (pagination?.offset !== undefined) params.offset = pagination.offset;

  const { data } = await apiClient.get<PaginatedResponse<WeatherEvent>>('/events', { params });
  return data;
}

/** GET /v1/events/:id — Get single event by ID */
export async function getEventById(id: string): Promise<WeatherEvent | null> {
  try {
    const { data } = await apiClient.get<WeatherEvent>(`/events/${id}`);
    return data;
  } catch (err: any) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

/** POST /v1/events/:id/verify — Admin: confirm an event */
export async function verifyEvent(eventId: string): Promise<{ id: string; status: string }> {
  const { data } = await apiClient.post(`/events/${eventId}/verify`);
  return data;
}

/** POST /v1/events/:id/reject — Admin: reject an event */
export async function rejectEvent(eventId: string): Promise<{ id: string; status: string }> {
  const { data } = await apiClient.post(`/events/${eventId}/reject`);
  return data;
}

/** POST /v1/events/:id/escalate — Admin: escalate an event */
export async function escalateEvent(eventId: string, note?: string): Promise<{ id: string; escalated: boolean }> {
  const { data } = await apiClient.post(`/events/${eventId}/escalate`, { note });
  return data;
}

/** POST /v1/events/:id/merge — Admin: merge event into another */
export async function mergeEvent(eventId: string, withEventId: string): Promise<{ merged_into: string; reports_moved: number }> {
  const { data } = await apiClient.post(`/events/${eventId}/merge`, { with_event_id: withEventId });
  return data;
}

// ═══════════════════════════════════════════════════════
// Reports Endpoints
// ═══════════════════════════════════════════════════════

/** GET /v1/reports — Fetch paginated reports (admin) */
export async function getReports(
  filters?: ReportFilters,
  pagination?: { limit?: number; offset?: number }
): Promise<PaginatedResponse<Report>> {
  const params: Record<string, string | number> = {};

  if (filters) {
    if (filters.source_platform) params.source_platform = filters.source_platform;
    if (filters.status) params.status = filters.status;
    if (filters.event_category) params.event_category = filters.event_category;
    if (filters.state) params.state = filters.state;
    if (filters.search) params.q = filters.search;
  }

  if (pagination?.limit) params.limit = pagination.limit;
  if (pagination?.offset !== undefined) params.offset = pagination.offset;

  const { data } = await apiClient.get<PaginatedResponse<Report>>('/reports', { params });
  return data;
}

/** GET /v1/reports/mine — Citizen report history by device */
export async function getMyReports(
  pagination?: { limit?: number; offset?: number }
): Promise<PaginatedResponse<Report>> {
  const params: Record<string, number> = {};
  if (pagination?.limit) params.limit = pagination.limit;
  if (pagination?.offset !== undefined) params.offset = pagination.offset;

  const { data } = await apiClient.get<PaginatedResponse<Report>>('/reports/mine', { params });
  return data;
}

/**
 * POST /v1/reports — Submit a citizen report (multipart/form-data)
 * Accepts optional File objects for media attachments.
 */
export async function submitReport(payload: {
  event_category: string;
  location_method: string;
  description?: string;
  lat?: number;
  lon?: number;
  reported_at?: string;
  media?: File[];
}): Promise<{ id: string; status: string; message: string }> {
  const formData = new FormData();
  formData.append('event_category', payload.event_category);
  formData.append('location_method', payload.location_method);

  if (payload.description) formData.append('description', payload.description);
  if (payload.lat !== undefined) formData.append('lat', String(payload.lat));
  if (payload.lon !== undefined) formData.append('lon', String(payload.lon));
  if (payload.reported_at) formData.append('reported_at', payload.reported_at);

  if (payload.media) {
    for (const file of payload.media) {
      formData.append('media', file);
    }
  }

  const { data } = await apiClient.post('/reports', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * POST /v1/reports/batch-sync — Sync offline queued reports
 */
export async function batchSyncReports(reports: Array<{
  client_report_id: string;
  event_category: string;
  description?: string;
  lat?: number;
  lon?: number;
  location_method?: string;
  reported_at?: string;
  media_urls?: string[];
}>): Promise<{ synced_count: number; skipped_count: number; synced_ids: string[]; skipped_ids: string[] }> {
  const { data } = await apiClient.post('/reports/batch-sync', { reports });
  return data;
}

/** POST /v1/reports/:id/verify — Admin: verify a single report */
export async function verifyReport(reportId: string): Promise<{ id: string; status: string }> {
  const { data } = await apiClient.post(`/reports/${reportId}/verify`);
  return data;
}

/** POST /v1/reports/:id/reject — Admin: reject a single report */
export async function rejectReport(reportId: string, reason?: string): Promise<{ id: string; status: string }> {
  const { data } = await apiClient.post(`/reports/${reportId}/reject`, { reason });
  return data;
}

/** POST /v1/reports/bulk-action — Admin: bulk verify/reject reports */
export async function bulkActionReports(
  payload: BulkActionPayload
): Promise<{ updated: number }> {
  const { data } = await apiClient.post('/reports/bulk-action', {
    report_ids: payload.report_ids,
    action: payload.action,
  });
  return data;
}

// ═══════════════════════════════════════════════════════
// Duplicate Clusters Endpoints
// ═══════════════════════════════════════════════════════

/** GET /v1/duplicate-clusters/:id — Get cluster details (admin) */
export async function getDuplicateCluster(clusterId: string): Promise<DuplicateCluster> {
  const { data } = await apiClient.get(`/duplicate-clusters/${clusterId}`);
  return data;
}

/** POST /v1/duplicate-clusters/:id/merge — Confirm & merge cluster (admin) */
export async function mergeDuplicateCluster(
  clusterId: string,
  withClusterId: string
): Promise<{ id: string; merged: boolean; member_count: number }> {
  const { data } = await apiClient.post(`/duplicate-clusters/${clusterId}/merge`, {
    with_cluster_id: withClusterId,
  });
  return data;
}

/**
 * Aggregate helper: Fetch all reports that belong to duplicate clusters,
 * then fetch each unique cluster's details. Returns DuplicateCluster[].
 * This bridges the frontend's "list all clusters" view with the backend's
 * individual cluster GET endpoints.
 */
export async function getDuplicateClusters(): Promise<DuplicateCluster[]> {
  // Fetch reports that have a duplicate_cluster_id
  const reportsResp = await getReports(undefined, { limit: 100 });
  const clusterIds = new Set<string>();

  for (const report of reportsResp.results) {
    if (report.duplicate_cluster_id) {
      clusterIds.add(report.duplicate_cluster_id);
    }
  }

  if (clusterIds.size === 0) return [];

  // Fetch each cluster's details in parallel
  const clusterPromises = Array.from(clusterIds).map((id) =>
    getDuplicateCluster(id).catch(() => null)
  );
  const clusters = await Promise.all(clusterPromises);
  return clusters.filter((c): c is DuplicateCluster => c !== null);
}

// ═══════════════════════════════════════════════════════
// Analytics Endpoints
// ═══════════════════════════════════════════════════════

/** GET /v1/analytics/overview — Dashboard KPI aggregates (admin) */
export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await apiClient.get<DashboardStats>('/analytics/overview');
  return data;
}

/** GET /v1/analytics/timeseries — Report/event time series (admin) */
export async function getTimeseries(granularity: 'hour' | 'day' | 'week' = 'day'): Promise<{
  series: Array<{ date: string; reports: number; events: number }>;
}> {
  const { data } = await apiClient.get('/analytics/timeseries', { params: { granularity } });
  return data;
}

/** GET /v1/analytics/by-category — Event distribution by category (admin) */
export async function getByCategory(): Promise<{
  categories: Array<{ category: string; count: number }>;
}> {
  const { data } = await apiClient.get('/analytics/by-category');
  return data;
}

/** GET /v1/analytics/source-reliability — Source trust scores (admin) */
export async function getSourceReliability(): Promise<{
  sources: Array<{
    handle: string;
    platform: string;
    total_reports: number;
    verified_reports: number;
    verified_rate: number;
    trust_tier: string;
  }>;
}> {
  const { data } = await apiClient.get('/analytics/source-reliability');
  return data;
}

/** GET /v1/analytics/status-breakdown — Event status breakdown (admin) */
export async function getStatusBreakdown(): Promise<{
  statuses: Array<{ status: string; count: number }>;
}> {
  const { data } = await apiClient.get('/analytics/status-breakdown');
  return data;
}

// ═══════════════════════════════════════════════════════
// Audit Log Endpoints
// ═══════════════════════════════════════════════════════

export interface AuditLogEntry {
  id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, any> | null;
  created_at: string;
}

/** GET /v1/audit-log — Paginated audit log (admin) */
export async function getAuditLog(
  pagination?: { limit?: number; offset?: number }
): Promise<PaginatedResponse<AuditLogEntry>> {
  const params: Record<string, number> = {};
  if (pagination?.limit) params.limit = pagination.limit;
  if (pagination?.offset !== undefined) params.offset = pagination.offset;

  const { data } = await apiClient.get<PaginatedResponse<AuditLogEntry>>('/audit-log', { params });
  return data;
}

// ═══════════════════════════════════════════════════════
// Sources Endpoints
// ═══════════════════════════════════════════════════════

export interface SourceInfo {
  id: string;
  platform: string;
  handle: string | null;
  trust_score: number;
  total_reports: number;
  verified_reports: number;
  created_at: string;
}

/** GET /v1/sources — List all data sources (admin) */
export async function getSources(): Promise<SourceInfo[]> {
  const { data } = await apiClient.get<SourceInfo[]>('/sources');
  return data;
}

// ═══════════════════════════════════════════════════════
// Citizen Session Endpoints
// ═══════════════════════════════════════════════════════

/** GET /v1/citizen/session — Resolve or initialize citizen session */
export async function getCitizenSession(): Promise<{
  id: string;
  device_id: string;
  preferred_language: string;
  first_seen_at: string;
}> {
  const { data } = await apiClient.get('/citizen/session');
  return data;
}

