/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Mock Data Generator
   Realistic Indian weather events, reports, and clusters
   for development without a live backend
   ═══════════════════════════════════════════════════════ */

import type {
  WeatherEvent,
  Report,
  DuplicateCluster,
  WeatherCategory,
  Severity,
  LifecycleStatus,
  SourcePlatform,
} from '../types/weather';

// ═══════════════════════════════════════════════════════
// Helper — ISO timestamps relative to "now"
// ═══════════════════════════════════════════════════════

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

// ═══════════════════════════════════════════════════════
// Indian City Coordinates
// ═══════════════════════════════════════════════════════

interface CityCoord {
  city: string;
  state: string;
  lat: number;
  lon: number;
}

const CITIES: Record<string, CityCoord> = {
  mumbai:      { city: 'Mumbai',       state: 'Maharashtra',      lat: 19.0760, lon: 72.8777 },
  delhi:       { city: 'Delhi',        state: 'Delhi NCR',        lat: 28.6139, lon: 77.2090 },
  dehradun:    { city: 'Dehradun',     state: 'Uttarakhand',      lat: 30.3165, lon: 78.0322 },
  ahmedabad:   { city: 'Ahmedabad',    state: 'Gujarat',          lat: 23.0225, lon: 72.5714 },
  chennai:     { city: 'Chennai',      state: 'Tamil Nadu',       lat: 13.0827, lon: 80.2707 },
  kolkata:     { city: 'Kolkata',      state: 'West Bengal',      lat: 22.5726, lon: 88.3639 },
  jaipur:      { city: 'Jaipur',       state: 'Rajasthan',        lat: 26.9124, lon: 75.7873 },
  nagpur:      { city: 'Nagpur',       state: 'Maharashtra',      lat: 21.1458, lon: 79.0882 },
  kochi:       { city: 'Kochi',        state: 'Kerala',           lat: 9.9312,  lon: 76.2673 },
  vizag:       { city: 'Visakhapatnam', state: 'Andhra Pradesh',  lat: 17.6868, lon: 83.2185 },
  bhopal:      { city: 'Bhopal',       state: 'Madhya Pradesh',   lat: 23.2599, lon: 77.4126 },
  lucknow:     { city: 'Lucknow',      state: 'Uttar Pradesh',    lat: 26.8467, lon: 80.9462 },
  jodhpur:     { city: 'Jodhpur',      state: 'Rajasthan',        lat: 26.2389, lon: 73.0243 },
  panaji:      { city: 'Panaji',       state: 'Goa',              lat: 15.4909, lon: 73.8278 },
  patna:       { city: 'Patna',        state: 'Bihar',            lat: 25.6093, lon: 85.1376 },
};

// ═══════════════════════════════════════════════════════
// Mock Weather Events (12 events)
// ═══════════════════════════════════════════════════════

export const mockWeatherEvents: WeatherEvent[] = [
  {
    id: 'EVT-2026-001',
    title: 'Extremely Heavy Monsoon Rainfall — Red Alert',
    category: 'rainfall',
    ...CITIES.mumbai,
    severity: 'severe',
    confidence: 94,
    lifecycle_status: 'active',
    has_contradiction: false,
    independent_source_count: 4,
    detected_at: hoursAgo(14),
    last_updated_at: minutesAgo(12),
    evidence_summary: { citizen_reports: 87, social_posts: 214, sensor_corroborated: true, news_articles: 9 },
  },
  {
    id: 'EVT-2026-002',
    title: 'Severe Thunderstorm — Hail Risk',
    category: 'thunderstorm',
    ...CITIES.jaipur,
    severity: 'severe',
    confidence: 87,
    lifecycle_status: 'emerging',
    has_contradiction: false,
    independent_source_count: 3,
    detected_at: hoursAgo(6),
    last_updated_at: minutesAgo(45),
    evidence_summary: { citizen_reports: 32, social_posts: 78, sensor_corroborated: true, news_articles: 4 },
  },
  {
    id: 'EVT-2026-003',
    title: 'Urban Flooding — T. Nagar & Adyar Waterlogged',
    category: 'flooding',
    ...CITIES.chennai,
    severity: 'severe',
    confidence: 91,
    lifecycle_status: 'confirmed',
    has_contradiction: false,
    independent_source_count: 5,
    detected_at: hoursAgo(18),
    last_updated_at: minutesAgo(28),
    evidence_summary: { citizen_reports: 64, social_posts: 189, sensor_corroborated: true, news_articles: 12 },
  },
  {
    id: 'EVT-2026-004',
    title: 'Heatwave Advisory — Vidarbha Region',
    category: 'heatwave',
    ...CITIES.nagpur,
    severity: 'moderate',
    confidence: 82,
    lifecycle_status: 'active',
    has_contradiction: true,     // Sensor reads 42°C but reports say 46°C
    independent_source_count: 2,
    detected_at: hoursAgo(30),
    last_updated_at: hoursAgo(2),
    evidence_summary: { citizen_reports: 23, social_posts: 45, sensor_corroborated: false, news_articles: 3 },
  },
  {
    id: 'EVT-2026-005',
    title: 'Dense Fog — Flights Diverted at IGI',
    category: 'fog',
    ...CITIES.delhi,
    severity: 'moderate',
    confidence: 76,
    lifecycle_status: 'declining',
    has_contradiction: false,
    independent_source_count: 3,
    detected_at: hoursAgo(10),
    last_updated_at: hoursAgo(1),
    evidence_summary: { citizen_reports: 41, social_posts: 112, sensor_corroborated: true, news_articles: 7 },
  },
  {
    id: 'EVT-2026-006',
    title: 'Dust Storm Warning — Thar Desert',
    category: 'dust storm',
    ...CITIES.jodhpur,
    severity: 'moderate',
    confidence: 68,
    lifecycle_status: 'detected',
    has_contradiction: true,     // Satellite shows clear, ground reports dust
    independent_source_count: 2,
    detected_at: hoursAgo(3),
    last_updated_at: minutesAgo(55),
    evidence_summary: { citizen_reports: 12, social_posts: 34, sensor_corroborated: false, news_articles: 1 },
  },
  {
    id: 'EVT-2026-007',
    title: 'Coastal Squall — Fishermen Advisory',
    category: 'strong wind',
    ...CITIES.vizag,
    severity: 'minor',
    confidence: 73,
    lifecycle_status: 'confirmed',
    has_contradiction: false,
    independent_source_count: 2,
    detected_at: hoursAgo(8),
    last_updated_at: hoursAgo(3),
    evidence_summary: { citizen_reports: 15, social_posts: 28, sensor_corroborated: true, news_articles: 2 },
  },
  {
    id: 'EVT-2026-008',
    title: 'Moderate Rainfall — Kerala Ghats',
    category: 'rainfall',
    ...CITIES.kochi,
    severity: 'minor',
    confidence: 85,
    lifecycle_status: 'active',
    has_contradiction: false,
    independent_source_count: 3,
    detected_at: hoursAgo(20),
    last_updated_at: minutesAgo(35),
    evidence_summary: { citizen_reports: 29, social_posts: 56, sensor_corroborated: true, news_articles: 3 },
  },
  {
    id: 'EVT-2026-009',
    title: 'Flash Flood Risk — Doon Valley',
    category: 'flooding',
    ...CITIES.dehradun,
    severity: 'severe',
    confidence: 88,
    lifecycle_status: 'emerging',
    has_contradiction: false,
    independent_source_count: 4,
    detected_at: hoursAgo(4),
    last_updated_at: minutesAgo(18),
    evidence_summary: { citizen_reports: 38, social_posts: 92, sensor_corroborated: true, news_articles: 5 },
  },
  {
    id: 'EVT-2026-010',
    title: 'Heatwave — Ahmedabad Urban Heat Island',
    category: 'heatwave',
    ...CITIES.ahmedabad,
    severity: 'moderate',
    confidence: 79,
    lifecycle_status: 'confirmed',
    has_contradiction: false,
    independent_source_count: 3,
    detected_at: hoursAgo(26),
    last_updated_at: hoursAgo(4),
    evidence_summary: { citizen_reports: 18, social_posts: 67, sensor_corroborated: true, news_articles: 4 },
  },
  {
    id: 'EVT-2026-011',
    title: 'Thunderstorm with Lightning — Kolkata',
    category: 'thunderstorm',
    ...CITIES.kolkata,
    severity: 'moderate',
    confidence: 81,
    lifecycle_status: 'active',
    has_contradiction: false,
    independent_source_count: 3,
    detected_at: hoursAgo(5),
    last_updated_at: minutesAgo(40),
    evidence_summary: { citizen_reports: 27, social_posts: 83, sensor_corroborated: true, news_articles: 3 },
  },
  {
    id: 'EVT-2026-012',
    title: 'Heavy Rainfall — Goa Coastal Belt Resolved',
    category: 'rainfall',
    ...CITIES.panaji,
    severity: 'minor',
    confidence: 92,
    lifecycle_status: 'resolved',
    has_contradiction: false,
    independent_source_count: 4,
    detected_at: hoursAgo(48),
    last_updated_at: hoursAgo(6),
    evidence_summary: { citizen_reports: 45, social_posts: 120, sensor_corroborated: true, news_articles: 6 },
  },
  {
    id: 'EVT-2026-013',
    title: 'Strong Winds — Bhopal Region',
    category: 'strong wind',
    ...CITIES.bhopal,
    severity: 'minor',
    confidence: 64,
    lifecycle_status: 'detected',
    has_contradiction: true,    // Anemometer offline, relying on citizen only
    independent_source_count: 1,
    detected_at: hoursAgo(1),
    last_updated_at: minutesAgo(25),
    evidence_summary: { citizen_reports: 8, social_posts: 14, sensor_corroborated: false, news_articles: 0 },
  },
  {
    id: 'EVT-2026-014',
    title: 'Waterlogging — Patna Low-Lying Areas',
    category: 'flooding',
    ...CITIES.patna,
    severity: 'moderate',
    confidence: 74,
    lifecycle_status: 'emerging',
    has_contradiction: false,
    independent_source_count: 2,
    detected_at: hoursAgo(7),
    last_updated_at: minutesAgo(50),
    evidence_summary: { citizen_reports: 21, social_posts: 47, sensor_corroborated: true, news_articles: 2 },
  },
];

// ═══════════════════════════════════════════════════════
// Mock Reports (35 reports with varied scores)
// ═══════════════════════════════════════════════════════

export const mockReports: Report[] = [
  // ── Mumbai Rainfall Cluster (EVT-001) ──
  { id: 'RPT-001', source_platform: 'citizen_app', source_handle: 'dev-abc123', raw_text: 'Water level has risen to knee height on main road near Dadar station. Vehicles stranded.', media_urls: ['https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=600&auto=format&fit=crop&q=80'], ...CITIES.mumbai, event_category: 'rainfall', category_confidence: 0.96, p_misleading: 0.05, duplicate_cluster_id: 'DUP-001', status: 'verified', reported_at: minutesAgo(45), ingested_at: minutesAgo(44), synced_late: false },
  { id: 'RPT-002', source_platform: 'twitter', source_handle: '@MumbaiRains', raw_text: 'Massive waterlogging near Dadar TT. Roads completely submerged. Stay home everyone! #MumbaiRains #Flooding', media_urls: ['https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600&auto=format&fit=crop&q=80'], ...CITIES.mumbai, event_category: 'rainfall', category_confidence: 0.93, p_misleading: 0.08, duplicate_cluster_id: 'DUP-001', status: 'verified', reported_at: minutesAgo(42), ingested_at: minutesAgo(40), synced_late: false },
  { id: 'RPT-003', source_platform: 'news', source_handle: 'NDTV Mumbai Bureau', raw_text: 'IMD issues red alert for Mumbai as heavy rainfall continues. BMC deploys NDRF teams in low-lying areas of Dadar and Sion.', media_urls: ['https://images.unsplash.com/photo-1514632595-4944383f2737?w=600&auto=format&fit=crop&q=80'], ...CITIES.mumbai, event_category: 'rainfall', category_confidence: 0.98, p_misleading: 0.03, duplicate_cluster_id: 'DUP-001', status: 'verified', reported_at: minutesAgo(38), ingested_at: minutesAgo(36), synced_late: false },
  { id: 'RPT-004', source_platform: 'citizen_app', source_handle: 'dev-lmn456', raw_text: 'Heavy rain in Andheri East. Metro station flooded. Trains running 30 min late.', media_urls: ['https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=600&auto=format&fit=crop&q=80'], ...CITIES.mumbai, event_category: 'rainfall', category_confidence: 0.91, p_misleading: 0.07, duplicate_cluster_id: null, status: 'pending', reported_at: minutesAgo(30), ingested_at: minutesAgo(28), synced_late: false },
  { id: 'RPT-005', source_platform: 'youtube', source_handle: 'MumbaiUpdatesLive', raw_text: 'LIVE: Mumbai streets turn into rivers! Shocking visuals from Hindmata junction showing complete submergence.', media_urls: ['https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600&auto=format&fit=crop&q=80'], ...CITIES.mumbai, event_category: 'flooding', category_confidence: 0.88, p_misleading: 0.12, duplicate_cluster_id: null, status: 'pending', reported_at: minutesAgo(25), ingested_at: minutesAgo(22), synced_late: false },

  // ── Chennai Flooding Cluster (EVT-003) ──
  { id: 'RPT-006', source_platform: 'citizen_app', source_handle: 'dev-qrs789', raw_text: 'T. Nagar main road completely flooded. Water entering ground floor shops. Need rescue boats.', media_urls: ['https://images.unsplash.com/photo-1514632595-4944383f2737?w=600&auto=format&fit=crop&q=80'], ...CITIES.chennai, event_category: 'flooding', category_confidence: 0.95, p_misleading: 0.04, duplicate_cluster_id: 'DUP-002', status: 'verified', reported_at: minutesAgo(55), ingested_at: minutesAgo(53), synced_late: false },
  { id: 'RPT-007', source_platform: 'twitter', source_handle: '@ChennaiWeather', raw_text: 'Adyar river overflowing near Kotturpuram bridge. Residents evacuating. #ChennaiFloods #StaySafe', media_urls: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80'], ...CITIES.chennai, event_category: 'flooding', category_confidence: 0.92, p_misleading: 0.06, duplicate_cluster_id: 'DUP-002', status: 'verified', reported_at: minutesAgo(50), ingested_at: minutesAgo(48), synced_late: false },
  { id: 'RPT-008', source_platform: 'news', source_handle: 'The Hindu Chennai', raw_text: 'Storm water drains overwhelmed in Velachery and T. Nagar as Chennai receives 120mm rainfall in 6 hours. NDRF on standby.', media_urls: ['https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=600&auto=format&fit=crop&q=80'], ...CITIES.chennai, event_category: 'flooding', category_confidence: 0.97, p_misleading: 0.02, duplicate_cluster_id: 'DUP-002', status: 'verified', reported_at: minutesAgo(47), ingested_at: minutesAgo(45), synced_late: false },
  { id: 'RPT-009', source_platform: 'citizen_app', source_handle: 'dev-tuv101', raw_text: 'Velachery area flooded again. Ambulance cannot reach our colony. Senior citizens stranded on first floor.', media_urls: ['https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600&auto=format&fit=crop&q=80'], ...CITIES.chennai, event_category: 'flooding', category_confidence: 0.94, p_misleading: 0.05, duplicate_cluster_id: null, status: 'pending', reported_at: minutesAgo(35), ingested_at: minutesAgo(33), synced_late: false },

  // ── Jaipur Thunderstorm (EVT-002) ──
  { id: 'RPT-010', source_platform: 'citizen_app', source_handle: 'dev-wxy202', raw_text: 'Lightning struck a tree near Central Park, Jaipur. Hailstones the size of marbles falling. Power cut.', media_urls: ['https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=600&auto=format&fit=crop&q=80'], ...CITIES.jaipur, event_category: 'thunderstorm', category_confidence: 0.90, p_misleading: 0.09, duplicate_cluster_id: 'DUP-003', status: 'verified', reported_at: minutesAgo(60), ingested_at: minutesAgo(58), synced_late: false },
  { id: 'RPT-011', source_platform: 'twitter', source_handle: '@JaipurAlert', raw_text: 'Massive hailstorm in Jaipur right now! Cars damaged, windows shattered near MI Road. Take shelter! ⛈️ #JaipurHailstorm', media_urls: ['https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=600&auto=format&fit=crop&q=80'], ...CITIES.jaipur, event_category: 'thunderstorm', category_confidence: 0.89, p_misleading: 0.11, duplicate_cluster_id: 'DUP-003', status: 'verified', reported_at: minutesAgo(57), ingested_at: minutesAgo(55), synced_late: false },
  { id: 'RPT-012', source_platform: 'imd_official', source_handle: 'IMD Jaipur AWS', raw_text: 'AWS Station JP-042: Convective activity detected. Wind gust 68 kmph. Hail size 15mm. CB tops at 14km.', media_urls: ['https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=600&auto=format&fit=crop&q=80'], ...CITIES.jaipur, event_category: 'thunderstorm', category_confidence: 0.99, p_misleading: 0.01, duplicate_cluster_id: 'DUP-003', status: 'verified', reported_at: minutesAgo(62), ingested_at: minutesAgo(61), synced_late: false },

  // ── Nagpur Heatwave with contradiction (EVT-004) ──
  { id: 'RPT-013', source_platform: 'citizen_app', source_handle: 'dev-zab303', raw_text: 'Unbearable heat in Sadar area Nagpur. Thermometer showing 46°C. Several people fainted near bus stop.', media_urls: [], ...CITIES.nagpur, event_category: 'heatwave', category_confidence: 0.87, p_misleading: 0.15, duplicate_cluster_id: null, status: 'pending', reported_at: hoursAgo(3), ingested_at: hoursAgo(3), synced_late: false },
  { id: 'RPT-014', source_platform: 'imd_official', source_handle: 'IMD Nagpur AWS', raw_text: 'AWS Station NG-018: Max temperature recorded 42.3°C at 14:30 IST. RH 22%. Heat index 44°C.', media_urls: [], ...CITIES.nagpur, event_category: 'heatwave', category_confidence: 0.99, p_misleading: 0.01, duplicate_cluster_id: null, status: 'verified', reported_at: hoursAgo(4), ingested_at: hoursAgo(4), synced_late: false },
  { id: 'RPT-015', source_platform: 'news', source_handle: 'Loksatta Nagpur', raw_text: 'विदर्भात उष्णतेची लाट. नागपुरात तापमान ४६ अंशांवर. नागरिकांना घराबाहेर न पडण्याचे आवाहन.', media_urls: [], ...CITIES.nagpur, event_category: 'heatwave', category_confidence: 0.85, p_misleading: 0.10, duplicate_cluster_id: null, status: 'pending', reported_at: hoursAgo(2), ingested_at: hoursAgo(2), synced_late: false },

  // ── Delhi Fog (EVT-005) ──
  { id: 'RPT-016', source_platform: 'citizen_app', source_handle: 'dev-cde404', raw_text: 'Very dense fog on NH-44 near Panipat. Visibility below 20 meters. Multiple vehicles slowing down. Accident risk high.', media_urls: [], lat: 29.39, lon: 76.97, city: 'Panipat', state: 'Haryana', event_category: 'fog', category_confidence: 0.93, p_misleading: 0.06, duplicate_cluster_id: null, status: 'verified', reported_at: hoursAgo(8), ingested_at: hoursAgo(8), synced_late: false },
  { id: 'RPT-017', source_platform: 'twitter', source_handle: '@DelhiAirport', raw_text: 'Due to low visibility at IGI Airport, 14 flights diverted, 28 delayed. Passengers advised to check with airlines. #DelhiFog', media_urls: [], ...CITIES.delhi, event_category: 'fog', category_confidence: 0.95, p_misleading: 0.03, duplicate_cluster_id: null, status: 'verified', reported_at: hoursAgo(7), ingested_at: hoursAgo(7), synced_late: false },

  // ── Dehradun Flash Flood Risk (EVT-009) ──
  { id: 'RPT-018', source_platform: 'citizen_app', source_handle: 'dev-efg505', raw_text: 'Rispana river rising fast in Dehradun. Water touching the bridge near Clock Tower. Very dangerous situation.', media_urls: ['blob:video_002.mp4'], ...CITIES.dehradun, event_category: 'flooding', category_confidence: 0.92, p_misleading: 0.07, duplicate_cluster_id: null, status: 'pending', reported_at: minutesAgo(90), ingested_at: minutesAgo(88), synced_late: false },
  { id: 'RPT-019', source_platform: 'news', source_handle: 'Dainik Jagran Dehradun', raw_text: 'देहरादून में मूसलाधार बारिश से नदियां उफान पर. रिस्पना नदी खतरे के निशान के करीब. प्रशासन अलर्ट पर.', media_urls: [], ...CITIES.dehradun, event_category: 'flooding', category_confidence: 0.90, p_misleading: 0.08, duplicate_cluster_id: null, status: 'pending', reported_at: minutesAgo(85), ingested_at: minutesAgo(83), synced_late: false },
  { id: 'RPT-020', source_platform: 'imd_official', source_handle: 'IMD Dehradun AWS', raw_text: 'AWS Station DD-007: 96mm rainfall recorded in last 6 hours. River gauge showing rising trend. Flash flood warning issued.', media_urls: [], ...CITIES.dehradun, event_category: 'rainfall', category_confidence: 0.97, p_misleading: 0.02, duplicate_cluster_id: null, status: 'verified', reported_at: minutesAgo(80), ingested_at: minutesAgo(79), synced_late: false },

  // ── Ahmedabad Heatwave (EVT-010) ──
  { id: 'RPT-021', source_platform: 'citizen_app', source_handle: 'dev-hij606', raw_text: 'Construction workers collapsing due to heat in Ahmedabad. No shade available at Sarkhej site. Need urgent water supply.', media_urls: [], ...CITIES.ahmedabad, event_category: 'heatwave', category_confidence: 0.88, p_misleading: 0.14, duplicate_cluster_id: null, status: 'pending', reported_at: hoursAgo(5), ingested_at: hoursAgo(5), synced_late: false },
  { id: 'RPT-022', source_platform: 'twitter', source_handle: '@AhmedabadMC', raw_text: 'AMC opens 50 water stations across the city. Citizens advised to avoid outdoor activity 12-4 PM. #AhmedabadHeat #BeatTheHeat', media_urls: [], ...CITIES.ahmedabad, event_category: 'heatwave', category_confidence: 0.86, p_misleading: 0.09, duplicate_cluster_id: null, status: 'verified', reported_at: hoursAgo(6), ingested_at: hoursAgo(6), synced_late: false },

  // ── Kolkata Thunderstorm (EVT-011) ──
  { id: 'RPT-023', source_platform: 'citizen_app', source_handle: 'dev-klm707', raw_text: 'Nor\'wester hitting Kolkata now! Trees uprooted in Salt Lake. Lightning very frequent. Power gone in our area.', media_urls: ['blob:photo_004.jpg'], ...CITIES.kolkata, event_category: 'thunderstorm', category_confidence: 0.91, p_misleading: 0.08, duplicate_cluster_id: null, status: 'pending', reported_at: minutesAgo(70), ingested_at: minutesAgo(68), synced_late: false },
  { id: 'RPT-024', source_platform: 'news', source_handle: 'ABP Ananda', raw_text: 'কলকাতায় কালবৈশাখী ঝড়. সল্টলেকে গাছ পড়ে রাস্তা বন্ধ. বিদ্যুৎ বিভ্রাট. NDRF মোতায়েন.', media_urls: [], ...CITIES.kolkata, event_category: 'thunderstorm', category_confidence: 0.87, p_misleading: 0.10, duplicate_cluster_id: null, status: 'pending', reported_at: minutesAgo(65), ingested_at: minutesAgo(63), synced_late: false },

  // ── Suspicious / High p_misleading Reports ──
  { id: 'RPT-025', source_platform: 'twitter', source_handle: '@FakeWeatherBot', raw_text: 'BREAKING: Category 5 cyclone to hit Mumbai in 2 hours! Evacuate immediately!! Share this to save lives!! 🌀🌀🌀', media_urls: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80'], ...CITIES.mumbai, event_category: 'strong wind', category_confidence: 0.45, p_misleading: 0.92, duplicate_cluster_id: null, status: 'rejected', reported_at: minutesAgo(20), ingested_at: minutesAgo(18), synced_late: false },
  { id: 'RPT-026', source_platform: 'twitter', source_handle: '@panic_poster99', raw_text: 'Delhi completely under water!! Worst flood in history!! Government hiding truth!! #DelhiFloods #WakeUp', media_urls: ['https://images.unsplash.com/photo-1514632595-4944383f2737?w=600&auto=format&fit=crop&q=80'], ...CITIES.delhi, event_category: 'flooding', category_confidence: 0.52, p_misleading: 0.88, duplicate_cluster_id: null, status: 'rejected', reported_at: minutesAgo(15), ingested_at: minutesAgo(13), synced_late: false },
  { id: 'RPT-027', source_platform: 'youtube', source_handle: 'ViralWeatherIndia', raw_text: 'You WON\'T BELIEVE this tornado in Chennai! Never seen before in India! Like and subscribe!', media_urls: ['https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=600&auto=format&fit=crop&q=80'], ...CITIES.chennai, event_category: 'strong wind', category_confidence: 0.38, p_misleading: 0.85, duplicate_cluster_id: null, status: 'rejected', reported_at: minutesAgo(10), ingested_at: minutesAgo(8), synced_late: false },
  { id: 'RPT-036', source_platform: 'twitter', source_handle: '@DelhiStormAlert', raw_text: 'EMERGENCY: Cloudburst reported at Connaught Place! 8 feet water accumulated in inner circle in 15 mins! Fake viral video circulating.', media_urls: ['https://images.unsplash.com/photo-1514632595-4944383f2737?w=600&auto=format&fit=crop&q=80'], ...CITIES.delhi, event_category: 'flooding', category_confidence: 0.39, p_misleading: 0.86, duplicate_cluster_id: null, status: 'pending', reported_at: minutesAgo(12), ingested_at: minutesAgo(10), synced_late: false },
  { id: 'RPT-037', source_platform: 'twitter', source_handle: '@ViralMumbaiFeed', raw_text: 'Massive 30ft sea surge swallowing Bandra Worli Sea Link! Cars floating into Arabian Sea! Retweet to warn commuters!', media_urls: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80'], ...CITIES.mumbai, event_category: 'strong wind', category_confidence: 0.32, p_misleading: 0.93, duplicate_cluster_id: null, status: 'pending', reported_at: minutesAgo(16), ingested_at: minutesAgo(14), synced_late: false },

  // ── Late-synced reports ──
  { id: 'RPT-028', source_platform: 'citizen_app', source_handle: 'dev-nop808', raw_text: 'Jodhpur dust storm started 30 minutes ago. Visibility zero. We are inside car on highway unable to move.', media_urls: ['https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=600&auto=format&fit=crop&q=80'], ...CITIES.jodhpur, event_category: 'dust storm', category_confidence: 0.89, p_misleading: 0.11, duplicate_cluster_id: null, status: 'pending', reported_at: hoursAgo(2), ingested_at: minutesAgo(105), synced_late: true },
  { id: 'RPT-029', source_platform: 'citizen_app', source_handle: 'dev-qrs909', raw_text: 'Strong wind uprooting tin roofs in fishing village near Vizag port. Coast guard notified.', media_urls: ['https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=600&auto=format&fit=crop&q=80'], ...CITIES.vizag, event_category: 'strong wind', category_confidence: 0.84, p_misleading: 0.13, duplicate_cluster_id: null, status: 'pending', reported_at: hoursAgo(5), ingested_at: hoursAgo(4), synced_late: true },
  { id: 'RPT-038', source_platform: 'citizen_app', source_handle: 'dev-shi707', raw_text: 'Severe waterlogging at Shimla Cart Road bus stand after localized cloudburst. Synced after cellular network recovered.', media_urls: ['https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=600&auto=format&fit=crop&q=80'], lat: 31.1048, lon: 77.1734, city: 'Shimla', state: 'Himachal Pradesh', event_category: 'rainfall', category_confidence: 0.91, p_misleading: 0.08, duplicate_cluster_id: null, status: 'pending', reported_at: hoursAgo(3), ingested_at: minutesAgo(35), synced_late: true },

  // ── Patna Waterlogging (EVT-014) ──
  { id: 'RPT-030', source_platform: 'citizen_app', source_handle: 'dev-stu010', raw_text: 'Boring Road, Patna completely waterlogged. Sewage mixing with rainwater. Health hazard for children.', media_urls: ['https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600&auto=format&fit=crop&q=80'], ...CITIES.patna, event_category: 'flooding', category_confidence: 0.90, p_misleading: 0.10, duplicate_cluster_id: null, status: 'pending', reported_at: minutesAgo(75), ingested_at: minutesAgo(73), synced_late: false },
  { id: 'RPT-031', source_platform: 'twitter', source_handle: '@PatnaUpdates', raw_text: 'Patna ko har saal same story. Boring Road doob gaya fir se. Municipal Corp kya kar raha hai? #PatnaFloods', media_urls: ['https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=600&auto=format&fit=crop&q=80'], ...CITIES.patna, event_category: 'flooding', category_confidence: 0.86, p_misleading: 0.12, duplicate_cluster_id: null, status: 'pending', reported_at: minutesAgo(70), ingested_at: minutesAgo(68), synced_late: false },

  // ── Bhopal winds (EVT-013) ──
  { id: 'RPT-032', source_platform: 'citizen_app', source_handle: 'dev-vwx111', raw_text: 'Sudden gusty winds in Bhopal MP Nagar area. Signboards flying. One billboard fell on road.', media_urls: ['https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=600&auto=format&fit=crop&q=80'], ...CITIES.bhopal, event_category: 'strong wind', category_confidence: 0.82, p_misleading: 0.16, duplicate_cluster_id: null, status: 'pending', reported_at: minutesAgo(40), ingested_at: minutesAgo(38), synced_late: false },

  // ── Lucknow moderate rainfall ──
  { id: 'RPT-033', source_platform: 'citizen_app', source_handle: 'dev-yza212', raw_text: 'Light to moderate rain in Gomti Nagar, Lucknow. Pleasant weather. Roads slightly waterlogged in low areas.', media_urls: ['https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=600&auto=format&fit=crop&q=80'], ...CITIES.lucknow, event_category: 'rainfall', category_confidence: 0.94, p_misleading: 0.05, duplicate_cluster_id: null, status: 'verified', reported_at: hoursAgo(1), ingested_at: hoursAgo(1), synced_late: false },

  // ── Kerala Kochi rainfall (EVT-008) ──
  { id: 'RPT-034', source_platform: 'citizen_app', source_handle: 'dev-bcd313', raw_text: 'Continuous rain in Kochi since morning. Marine Drive area has ankle-deep water. Umbrellas useless due to wind.', media_urls: ['https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=600&auto=format&fit=crop&q=80'], ...CITIES.kochi, event_category: 'rainfall', category_confidence: 0.91, p_misleading: 0.07, duplicate_cluster_id: null, status: 'verified', reported_at: minutesAgo(100), ingested_at: minutesAgo(98), synced_late: false },
  { id: 'RPT-035', source_platform: 'news', source_handle: 'Mathrubhumi', raw_text: 'കൊച്ചിയിൽ തുടർച്ചയായ മഴ. മറൈൻ ഡ്രൈവിൽ വെള്ളക്കെട്ട്. ജില്ലാ ഭരണകൂടം ജാഗ്രത നിർദ്ദേശം പുറപ്പെടുവിച്ചു.', media_urls: ['https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600&auto=format&fit=crop&q=80'], ...CITIES.kochi, event_category: 'rainfall', category_confidence: 0.89, p_misleading: 0.06, duplicate_cluster_id: null, status: 'pending', reported_at: minutesAgo(95), ingested_at: minutesAgo(93), synced_late: false },
];

// ═══════════════════════════════════════════════════════
// Duplicate Clusters (NLP similarity matches)
// ═══════════════════════════════════════════════════════

export const mockDuplicateClusters: DuplicateCluster[] = [
  {
    id: 'DUP-001',
    location_name: 'Dadar, Mumbai',
    similarity_score: 0.94,
    reports: mockReports.filter((r) => r.duplicate_cluster_id === 'DUP-001'),
  },
  {
    id: 'DUP-002',
    location_name: 'T. Nagar / Adyar, Chennai',
    similarity_score: 0.91,
    reports: mockReports.filter((r) => r.duplicate_cluster_id === 'DUP-002'),
  },
  {
    id: 'DUP-003',
    location_name: 'Central Jaipur',
    similarity_score: 0.88,
    reports: mockReports.filter((r) => r.duplicate_cluster_id === 'DUP-003'),
  },
];

// ═══════════════════════════════════════════════════════
// Category & Severity Display Metadata
// (Reusable config for UI rendering)
// ═══════════════════════════════════════════════════════

export const CATEGORY_META: Record<WeatherCategory, { icon: string; color: string; bgColor: string; label_en: string; label_hi: string }> = {
  rainfall:       { icon: 'CloudRain',       color: '#3b82f6', bgColor: '#eff6ff',  label_en: 'Rainfall',      label_hi: 'वर्षा' },
  thunderstorm:   { icon: 'CloudLightning',  color: '#8b5cf6', bgColor: '#f5f3ff',  label_en: 'Thunderstorm',  label_hi: 'तड़ित झंझा' },
  flooding:       { icon: 'Waves',           color: '#0891b2', bgColor: '#ecfeff',  label_en: 'Flooding',      label_hi: 'बाढ़' },
  heatwave:       { icon: 'Thermometer',     color: '#f97316', bgColor: '#fff7ed',  label_en: 'Heatwave',      label_hi: 'लू' },
  fog:            { icon: 'CloudFog',        color: '#6b7280', bgColor: '#f9fafb',  label_en: 'Fog',           label_hi: 'कोहरा' },
  'dust storm':   { icon: 'Wind',            color: '#d97706', bgColor: '#fffbeb',  label_en: 'Dust Storm',    label_hi: 'धूल भरी आंधी' },
  'strong wind':  { icon: 'Wind',            color: '#0d9488', bgColor: '#f0fdfa',  label_en: 'Strong Wind',   label_hi: 'तेज़ हवा' },
};

export const SEVERITY_META: Record<Severity, { label: string; className: string; icon: string; color: string }> = {
  minor:    { label: 'Minor',    className: 'badge-severity-minor',    icon: '●', color: '#10b981' },
  moderate: { label: 'Moderate', className: 'badge-severity-moderate', icon: '▲', color: '#0284c7' },
  severe:   { label: 'Severe',   className: 'badge-severity-severe',   icon: '◆', color: '#ef4444' },
};

export const LIFECYCLE_META: Record<LifecycleStatus, { color: string; bgColor: string }> = {
  detected:  { color: '#8b5cf6', bgColor: '#f5f3ff' },
  emerging:  { color: '#f59e0b', bgColor: '#fffbeb' },
  confirmed: { color: '#3b82f6', bgColor: '#eff6ff' },
  active:    { color: '#ef4444', bgColor: '#fef2f2' },
  declining: { color: '#f97316', bgColor: '#fff7ed' },
  resolved:  { color: '#10b981', bgColor: '#ecfdf5' },
};

export const SOURCE_META: Record<SourcePlatform, { label: string; reliability: number; color: string }> = {
  imd_official: { label: 'IMD Sensor Network', reliability: 99, color: '#10b981' },
  citizen_app:  { label: 'Citizen Reports',    reliability: 92, color: '#3b82f6' },
  news:         { label: 'News RSS Feeds',     reliability: 88, color: '#f59e0b' },
  twitter:      { label: 'Social Media (X)',   reliability: 74, color: '#8b5cf6' },
  youtube:      { label: 'YouTube',            reliability: 62, color: '#ef4444' },
};
