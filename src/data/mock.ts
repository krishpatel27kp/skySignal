/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Mock Data & Utilities
   Realistic demo data for the weather intelligence platform
   ═══════════════════════════════════════════════════════ */

import type {
  WeatherEvent,
  CitizenReport,
  KpiStat,
  PriorityWatch,
  ChartDataPoint,
  SourceReliability,
  WeatherCategory,
  Severity,
} from '../types';

// ── Weather Category Metadata ──
export const CATEGORY_CONFIG: Record<
  WeatherCategory,
  { icon: string; color: string; bgColor: string }
> = {
  rainfall:     { icon: 'CloudRain',    color: '#3b82f6', bgColor: '#eff6ff' },
  thunderstorm: { icon: 'CloudLightning', color: '#8b5cf6', bgColor: '#f5f3ff' },
  flooding:     { icon: 'Waves',        color: '#0891b2', bgColor: '#ecfeff' },
  heatwave:     { icon: 'Thermometer',  color: '#f97316', bgColor: '#fff7ed' },
  fog:          { icon: 'Cloud',        color: '#6b7280', bgColor: '#f9fafb' },
  'dust storm': { icon: 'Wind',         color: '#d97706', bgColor: '#fffbeb' },
  'strong wind':{ icon: 'Wind',         color: '#0d9488', bgColor: '#f0fdfa' },
};

// ── Severity Metadata ──
export const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; className: string; icon: string }
> = {
  minor:    { label: 'Minor',    className: 'badge-severity-minor',    icon: '●' },
  moderate: { label: 'Moderate', className: 'badge-severity-moderate', icon: '▲' },
  severe:   { label: 'Severe',   className: 'badge-severity-severe',   icon: '◆' },
};

// ── Mock Weather Events ──
export const mockEvents: WeatherEvent[] = [
  {
    id: 'EVT-2026-001',
    title: 'Heavy Monsoon Rainfall Warning',
    category: 'rainfall',
    severity: 'severe',
    status: 'active',
    location: { name: 'Mumbai', state: 'Maharashtra', lat: 19.076, lng: 72.8777 },
    confidence: 94,
    sources: 4,
    reportCount: 127,
    description: 'Extremely heavy rainfall (>204mm/24hr) expected across Mumbai metropolitan region with waterlogging in low-lying areas.',
    createdAt: '2026-09-24T08:30:00Z',
    updatedAt: '2026-09-24T16:15:00Z',
  },
  {
    id: 'EVT-2026-002',
    title: 'Severe Thunderstorm Alert',
    category: 'thunderstorm',
    severity: 'severe',
    status: 'emerging',
    location: { name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873 },
    confidence: 87,
    sources: 3,
    reportCount: 43,
    description: 'Intense convective activity detected with hail risk and gusty winds exceeding 60 kmph.',
    createdAt: '2026-09-24T10:00:00Z',
    updatedAt: '2026-09-24T15:45:00Z',
  },
  {
    id: 'EVT-2026-003',
    title: 'Urban Flooding — Chennai',
    category: 'flooding',
    severity: 'severe',
    status: 'confirmed',
    location: { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
    confidence: 91,
    sources: 5,
    reportCount: 89,
    description: 'Major waterlogging reported in T. Nagar, Adyar, and Velachery areas. Storm drains overwhelmed.',
    createdAt: '2026-09-24T06:00:00Z',
    updatedAt: '2026-09-24T14:30:00Z',
  },
  {
    id: 'EVT-2026-004',
    title: 'Heatwave Advisory — Vidarbha',
    category: 'heatwave',
    severity: 'moderate',
    status: 'active',
    location: { name: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lng: 79.0882 },
    confidence: 82,
    sources: 2,
    reportCount: 34,
    description: 'Maximum temperatures exceeding 44°C in parts of Vidarbha region. Heat index dangerously high.',
    createdAt: '2026-09-23T18:00:00Z',
    updatedAt: '2026-09-24T12:00:00Z',
  },
  {
    id: 'EVT-2026-005',
    title: 'Dense Fog — Northern Plains',
    category: 'fog',
    severity: 'moderate',
    status: 'declining',
    location: { name: 'Delhi', state: 'Delhi NCR', lat: 28.6139, lng: 77.209 },
    confidence: 76,
    sources: 3,
    reportCount: 56,
    description: 'Very dense fog with visibility below 50m affecting highway and airport operations.',
    createdAt: '2026-09-24T02:00:00Z',
    updatedAt: '2026-09-24T09:30:00Z',
  },
  {
    id: 'EVT-2026-006',
    title: 'Dust Storm Warning — Thar',
    category: 'dust storm',
    severity: 'moderate',
    status: 'detected',
    location: { name: 'Jodhpur', state: 'Rajasthan', lat: 26.2389, lng: 73.0243 },
    confidence: 68,
    sources: 2,
    reportCount: 18,
    description: 'Dust storm activity detected in western Rajasthan with wind speeds of 50-60 kmph. Visibility reducing.',
    createdAt: '2026-09-24T11:30:00Z',
    updatedAt: '2026-09-24T13:00:00Z',
  },
  {
    id: 'EVT-2026-007',
    title: 'Strong Wind Advisory — Coastal AP',
    category: 'strong wind',
    severity: 'minor',
    status: 'confirmed',
    location: { name: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6868, lng: 83.2185 },
    confidence: 73,
    sources: 2,
    reportCount: 22,
    description: 'Squally winds 45-55 kmph along the coast. Fishermen advised not to venture into deep sea.',
    createdAt: '2026-09-24T07:00:00Z',
    updatedAt: '2026-09-24T11:00:00Z',
  },
  {
    id: 'EVT-2026-008',
    title: 'Moderate Rainfall — Kerala',
    category: 'rainfall',
    severity: 'minor',
    status: 'active',
    location: { name: 'Kochi', state: 'Kerala', lat: 9.9312, lng: 76.2673 },
    confidence: 85,
    sources: 3,
    reportCount: 41,
    description: 'Widespread moderate rainfall across central Kerala. Isolated heavy spells in ghats.',
    createdAt: '2026-09-24T05:00:00Z',
    updatedAt: '2026-09-24T15:00:00Z',
  },
];

// ── Mock Citizen Reports ──
export const mockCitizenReports: CitizenReport[] = [
  {
    id: 'RPT-001',
    category: 'flooding',
    severity: 'severe',
    location: { name: 'T. Nagar, Chennai', state: 'Tamil Nadu', lat: 13.04, lng: 80.24 },
    description: 'Water level has risen to knee height on main road. Vehicles stranded near Anna Flyover.',
    deviceId: 'dev-abc123',
    verificationStatus: 'pending',
    confidence: 78,
    submittedAt: '2026-09-24T14:12:00Z',
  },
  {
    id: 'RPT-002',
    category: 'rainfall',
    severity: 'moderate',
    location: { name: 'Andheri East, Mumbai', state: 'Maharashtra', lat: 19.12, lng: 72.85 },
    description: 'Continuous heavy rain since morning. Drains overflowing near metro station.',
    deviceId: 'dev-xyz789',
    verificationStatus: 'pending',
    confidence: 82,
    submittedAt: '2026-09-24T13:45:00Z',
  },
  {
    id: 'RPT-003',
    category: 'thunderstorm',
    severity: 'severe',
    location: { name: 'Civil Lines, Jaipur', state: 'Rajasthan', lat: 26.92, lng: 75.78 },
    description: 'Lightning struck a tree near park. Hailstones reported. Power outage in area.',
    deviceId: 'dev-qrs456',
    verificationStatus: 'verified',
    confidence: 91,
    submittedAt: '2026-09-24T12:30:00Z',
  },
  {
    id: 'RPT-004',
    category: 'heatwave',
    severity: 'moderate',
    location: { name: 'Sadar, Nagpur', state: 'Maharashtra', lat: 21.15, lng: 79.09 },
    description: 'Temperature feels unbearable. Several people seen seeking shade near bus stop. No water available.',
    deviceId: 'dev-mno321',
    verificationStatus: 'pending',
    confidence: 65,
    submittedAt: '2026-09-24T11:00:00Z',
  },
  {
    id: 'RPT-005',
    category: 'fog',
    severity: 'minor',
    location: { name: 'NH-44, Panipat', state: 'Haryana', lat: 29.39, lng: 76.97 },
    description: 'Very dense fog on highway. Cannot see more than 20 meters ahead. Multiple vehicles slowing down.',
    deviceId: 'dev-hij654',
    verificationStatus: 'verified',
    confidence: 88,
    submittedAt: '2026-09-24T05:30:00Z',
  },
];

// ── KPI Stats ──
export const mockKpiStats: KpiStat[] = [
  {
    id: 'kpi-events',
    label: 'Active Events',
    value: 24,
    change: 12.5,
    changeLabel: 'vs yesterday',
    icon: 'Activity',
    trend: 'up',
  },
  {
    id: 'kpi-reports',
    label: 'Reports Today',
    value: 430,
    change: 8.3,
    changeLabel: 'vs yesterday',
    icon: 'FileText',
    trend: 'up',
  },
  {
    id: 'kpi-verified',
    label: 'Verified',
    value: '87%',
    change: 2.1,
    changeLabel: 'accuracy',
    icon: 'ShieldCheck',
    trend: 'up',
  },
  {
    id: 'kpi-alerts',
    label: 'Severe Alerts',
    value: 3,
    change: -33.3,
    changeLabel: 'vs yesterday',
    icon: 'AlertTriangle',
    trend: 'down',
  },
];

// ── Priority Watch Events ──
export const mockPriorityWatch: PriorityWatch[] = [
  {
    id: 'pw-1',
    title: 'Mumbai Heavy Rainfall — Red Alert',
    category: 'rainfall',
    severity: 'severe',
    location: 'Mumbai, Maharashtra',
    timeAgo: '12m ago',
    confidence: 94,
  },
  {
    id: 'pw-2',
    title: 'Chennai Urban Flooding — Critical',
    category: 'flooding',
    severity: 'severe',
    location: 'Chennai, Tamil Nadu',
    timeAgo: '28m ago',
    confidence: 91,
  },
  {
    id: 'pw-3',
    title: 'Jaipur Thunderstorm — Hail Risk',
    category: 'thunderstorm',
    severity: 'severe',
    location: 'Jaipur, Rajasthan',
    timeAgo: '45m ago',
    confidence: 87,
  },
  {
    id: 'pw-4',
    title: 'Nagpur Heatwave — Orange Alert',
    category: 'heatwave',
    severity: 'moderate',
    location: 'Nagpur, Maharashtra',
    timeAgo: '1h ago',
    confidence: 82,
  },
  {
    id: 'pw-5',
    title: 'Delhi Dense Fog — Flight Delays',
    category: 'fog',
    severity: 'moderate',
    location: 'Delhi NCR',
    timeAgo: '2h ago',
    confidence: 76,
  },
];

// ── 24-Hour Report Volume Chart Data ──
export const mockChartData: ChartDataPoint[] = [
  { time: '00:00', reports: 12, verified: 10 },
  { time: '01:00', reports: 8,  verified: 7 },
  { time: '02:00', reports: 5,  verified: 4 },
  { time: '03:00', reports: 3,  verified: 3 },
  { time: '04:00', reports: 4,  verified: 3 },
  { time: '05:00', reports: 15, verified: 12 },
  { time: '06:00', reports: 28, verified: 24 },
  { time: '07:00', reports: 42, verified: 35 },
  { time: '08:00', reports: 56, verified: 48 },
  { time: '09:00', reports: 67, verified: 58 },
  { time: '10:00', reports: 73, verified: 64 },
  { time: '11:00', reports: 61, verified: 55 },
  { time: '12:00', reports: 52, verified: 45 },
  { time: '13:00', reports: 48, verified: 42 },
  { time: '14:00', reports: 55, verified: 49 },
  { time: '15:00', reports: 68, verified: 60 },
  { time: '16:00', reports: 74, verified: 65 },
  { time: '17:00', reports: 45, verified: 38 },
  { time: '18:00', reports: 38, verified: 33 },
  { time: '19:00', reports: 30, verified: 26 },
  { time: '20:00', reports: 25, verified: 22 },
  { time: '21:00', reports: 20, verified: 18 },
  { time: '22:00', reports: 16, verified: 14 },
  { time: '23:00', reports: 13, verified: 11 },
];

// ── Source Reliability ──
export const mockSourceReliability: SourceReliability[] = [
  { source: 'imd_sensor',   label: 'IMD Sensor Network', reliability: 99, color: '#10b981' },
  { source: 'citizen',      label: 'Citizen Reports',    reliability: 92, color: '#3b82f6' },
  { source: 'news_rss',     label: 'News RSS Feeds',     reliability: 88, color: '#f59e0b' },
  { source: 'social_media', label: 'Social Media (X)',    reliability: 74, color: '#8b5cf6' },
];

// ── Utility: Format relative time ──
export function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// ── Utility: Category icon name to Lucide component name ──
export function getCategoryIcon(category: WeatherCategory): string {
  return CATEGORY_CONFIG[category].icon;
}
