/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Domain Model Types
   Strict taxonomy for weather intelligence platform
   Aligned with backend FastAPI schema (SIH26069)
   ═══════════════════════════════════════════════════════ */

// ── Strict 7-Category Weather Taxonomy ──
export type WeatherCategory =
  | 'rainfall'
  | 'thunderstorm'
  | 'flooding'
  | 'heatwave'
  | 'fog'
  | 'dust storm'
  | 'strong wind';

// ── Strict 3-Tier Severity ──
export type Severity = 'minor' | 'moderate' | 'severe';

// ── Event Lifecycle States ──
export type LifecycleStatus =
  | 'detected'
  | 'emerging'
  | 'confirmed'
  | 'active'
  | 'declining'
  | 'resolved';

// ── Ingestion Source Platforms ──
export type SourcePlatform =
  | 'citizen_app'
  | 'twitter'
  | 'news'
  | 'youtube'
  | 'imd_official';

// ── Report Verification Status ──
export type ReportStatus = 'pending' | 'verified' | 'rejected';

// ═══════════════════════════════════════════════════════
// Core Entities
// ═══════════════════════════════════════════════════════

/** Raw ingested report from any source platform */
export interface Report {
  id: string;
  source_platform: SourcePlatform;
  source_handle: string;
  raw_text: string;
  media_urls: string[];
  lat: number;
  lon: number;
  city: string;
  state: string;
  event_category: WeatherCategory;
  category_confidence: number;       // ML classifier confidence 0.0–1.0
  p_misleading: number;              // Misleading probability 0.0–1.0
  duplicate_cluster_id: string | null;
  status: ReportStatus;
  reported_at: string;               // ISO 8601
  ingested_at: string;               // ISO 8601
  synced_late: boolean;              // True if >5min delay from reported_at to ingested_at
}

/** Fused weather event aggregated from corroborated reports */
export interface WeatherEvent {
  id: string;
  title: string;
  category: WeatherCategory;
  lat: number;
  lon: number;
  city: string;
  state: string;
  severity: Severity;
  confidence: number;                // Aggregate confidence 0–100
  lifecycle_status: LifecycleStatus;
  has_contradiction: boolean;        // True if sensor readings conflict with reports
  independent_source_count: number;  // Count of distinct corroborating platforms
  detected_at: string;               // ISO 8601
  last_updated_at: string;           // ISO 8601
  evidence_summary: EvidenceSummary;
}

/** Breakdown of evidence sources backing an event */
export interface EvidenceSummary {
  citizen_reports: number;
  social_posts: number;
  sensor_corroborated: boolean;
  news_articles: number;
}

/** Cluster of reports identified as duplicates by NLP similarity */
export interface DuplicateCluster {
  id: string;
  location_name: string;
  similarity_score: number;          // 0.0–1.0 (e.g. 0.94 = 94% similarity)
  reports: Report[];
}

// ═══════════════════════════════════════════════════════
// API Filter & Response Types
// ═══════════════════════════════════════════════════════

/** Filter parameters for event queries */
export interface EventFilters {
  category?: WeatherCategory;
  severity?: Severity;
  lifecycle_status?: LifecycleStatus;
  state?: string;
  time_range?: 'last_1h' | 'last_6h' | 'last_24h' | 'last_7d';
  search?: string;
}

/** Filter parameters for report queries */
export interface ReportFilters {
  source_platform?: SourcePlatform;
  status?: ReportStatus;
  event_category?: WeatherCategory;
  state?: string;
  min_confidence?: number;
  max_p_misleading?: number;
  search?: string;
}

/** Payload for citizen report submission */
export interface ReportSubmission {
  event_category: WeatherCategory;
  severity: Severity;
  lat: number;
  lon: number;
  city: string;
  state: string;
  raw_text: string;
  media_urls: string[];
  device_id: string;
  language: 'en' | 'hi';
}

/** Bulk action on report IDs */
export interface BulkActionPayload {
  report_ids: string[];
  action: 'verify' | 'reject';
  analyst_email?: string;
}

/** SSE telemetry event types */
export type TelemetryEventType = 'event_created' | 'event_updated';

export interface TelemetryMessage {
  type: TelemetryEventType;
  payload: WeatherEvent;
  timestamp: string;
}
