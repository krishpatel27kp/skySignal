/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Core Type Definitions
   Strict taxonomy for weather intelligence platform
   ═══════════════════════════════════════════════════════ */

// ── Strict 3-Tier Severity ──
export type Severity = 'minor' | 'moderate' | 'severe';

// ── Strict 7-Category Weather Taxonomy ──
export type WeatherCategory =
  | 'rainfall'
  | 'thunderstorm'
  | 'flooding'
  | 'heatwave'
  | 'fog'
  | 'dust storm'
  | 'strong wind';

// ── Event Lifecycle States ──
export type EventStatus =
  | 'detected'
  | 'emerging'
  | 'confirmed'
  | 'active'
  | 'declining'
  | 'resolved';

// ── Data Source Types ──
export type DataSource =
  | 'citizen'
  | 'imd_sensor'
  | 'news_rss'
  | 'social_media';

// ── Report Verification Status ──
export type VerificationStatus =
  | 'pending'
  | 'verified'
  | 'rejected';

// ── Weather Event ──
export interface WeatherEvent {
  id: string;
  title: string;
  category: WeatherCategory;
  severity: Severity;
  status: EventStatus;
  location: {
    name: string;
    state: string;
    lat: number;
    lng: number;
  };
  confidence: number; // 0-100
  sources: number;
  reportCount: number;
  description: string;
  createdAt: string;   // ISO datetime
  updatedAt: string;   // ISO datetime
}

// ── Citizen Report ──
export interface CitizenReport {
  id: string;
  category: WeatherCategory;
  severity: Severity;
  location: {
    name: string;
    state: string;
    lat: number;
    lng: number;
  };
  description: string;
  mediaUrl?: string;
  deviceId: string;
  verificationStatus: VerificationStatus;
  confidence: number;
  submittedAt: string;
}

// ── KPI Stat Card ──
export interface KpiStat {
  id: string;
  label: string;
  value: number | string;
  change: number;       // percentage change
  changeLabel: string;
  icon: string;
  trend: 'up' | 'down' | 'stable';
}

// ── Sidebar Navigation Item ──
export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  badge?: number;
}

// ── Priority Watch Item ──
export interface PriorityWatch {
  id: string;
  title: string;
  category: WeatherCategory;
  severity: Severity;
  location: string;
  timeAgo: string;
  confidence: number;
}

// ── Audit Log Entry ──
export interface AuditEntry {
  id: string;
  analyst: string;
  email: string;
  action: string;
  target: string;
  timestamp: string;
}

// ── Chart Data Point ──
export interface ChartDataPoint {
  time: string;
  reports: number;
  verified: number;
}

// ── Source Reliability ──
export interface SourceReliability {
  source: DataSource;
  label: string;
  reliability: number;  // 0-100
  color: string;
}
