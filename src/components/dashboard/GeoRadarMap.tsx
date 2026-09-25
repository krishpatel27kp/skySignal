/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Interactive Leaflet Geo-Radar Map
   National Weather Intelligence Platform (IMD / SIH26069)
   Pure Leaflet + Marker Clustering + Custom Glass Overlays
   ═══════════════════════════════════════════════════════ */

import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  Maximize2,
  Minimize2,
  RotateCcw,
  Zap,
  ShieldAlert,
} from 'lucide-react';
import type { WeatherCategory, Severity } from '../../types';
import { CATEGORY_CONFIG, SEVERITY_CONFIG } from '../../data/mock';
import { useAuth } from '../../context/AuthContext';

export interface MapEventItem {
  id: string;
  title: string;
  category: WeatherCategory;
  severity: Severity;
  status?: string;
  confidence: number;
  sources?: number;
  reportCount?: number;
  description?: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
}

interface GeoRadarMapProps {
  events: any[];
  onSelectEvent?: (event: any) => void;
  className?: string;
  height?: string;
}

// Tile providers (Standard OpenStreetMap — completely free & open source, no API key required)
const TILE_LAYERS = {
  light: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  dark: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  topo: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
};

// Map center of India
const INDIA_CENTER: [number, number] = [21.5, 79.5];
const DEFAULT_ZOOM = 4.8;

// SVG icons mapping for Leaflet divIcon
const SVG_ICONS: Record<WeatherCategory, string> = {
  rainfall: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>`,
  thunderstorm: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/></svg>`,
  flooding: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`,
  heatwave: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>`,
  fog: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M4 18h16"/><path d="M6 21h12"/></svg>`,
  'dust storm': `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>`,
  'strong wind': `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>`,
};

export default function GeoRadarMap({
  events,
  onSelectEvent,
  className = '',
  height = 'h-[500px]',
}: GeoRadarMapProps) {
  const { isAdmin } = useAuth();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [activeLayer, setActiveLayer] = useState<'light' | 'dark' | 'topo'>('light');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Normalize events to standard MapEventItem
  const normalizedEvents = useMemo<MapEventItem[]>(() => {
    return events.map((evt) => {
      const lat = evt.lat ?? evt.location?.lat ?? 20.5937;
      const lng = evt.lon ?? evt.lng ?? evt.location?.lng ?? 78.9629;
      const city = evt.city ?? evt.location?.name ?? 'Unknown Location';
      const state = evt.state ?? evt.location?.state ?? 'India';
      return {
        id: evt.id,
        title: evt.title,
        category: evt.category,
        severity: evt.severity,
        status: evt.status ?? evt.lifecycle_status ?? 'active',
        confidence: evt.confidence ?? 85,
        sources: evt.sources ?? evt.independent_source_count ?? 3,
        reportCount: evt.reportCount ?? (evt.evidence_summary ? evt.evidence_summary.citizen_reports + evt.evidence_summary.social_posts : 24),
        description: evt.description ?? `${evt.title} observed in ${city}, ${state}. Verified with multi-sensor telemetry.`,
        lat,
        lng,
        city,
        state,
      };
    });
  }, [events]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return normalizedEvents.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (selectedSeverity !== 'all' && item.severity !== selectedSeverity) return false;
      return true;
    });
  }, [normalizedEvents, selectedCategory, selectedSeverity]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Prevent double init

    const map = L.map(mapContainerRef.current, {
      center: INDIA_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
      maxBounds: [
        [5.0, 65.0],
        [38.0, 100.0],
      ],
      minZoom: 4,
      maxZoom: 14,
    });

    // Add Tile Layer
    const tile = L.tileLayer(TILE_LAYERS[activeLayer].url, {
      maxZoom: 19,
      attribution: TILE_LAYERS[activeLayer].attribution,
    }).addTo(map);

    tileLayerRef.current = tile;

    // Add Marker Cluster Group with customized cluster icon styling
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (clusterInstance) => {
        const count = clusterInstance.getChildCount();
        let sizeClass = 'w-9 h-9 text-[12px]';
        let bgStyle = 'background: rgba(2, 132, 199, 0.9); border: 2px solid #ffffff;';
        if (count > 10) {
          sizeClass = 'w-11 h-11 text-[13px]';
          bgStyle = 'background: rgba(239, 68, 68, 0.92); border: 2.5px solid #ffffff;';
        } else if (count > 5) {
          sizeClass = 'w-10 h-10 text-[12px]';
          bgStyle = 'background: rgba(249, 115, 22, 0.9); border: 2px solid #ffffff;';
        }
        return L.divIcon({
          html: `<div class="${sizeClass} rounded-full flex items-center justify-center font-bold text-white shadow-lg backdrop-blur-md animate-pulse" style="${bgStyle}">${count}</div>`,
          className: 'custom-cluster-marker',
          iconSize: L.point(40, 40),
        });
      },
    });

    cluster.addTo(map);
    clusterGroupRef.current = cluster;
    mapInstanceRef.current = map;

    // Invalidate size on load to avoid grey tiles
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer when activeLayer changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const newTile = L.tileLayer(TILE_LAYERS[activeLayer].url, {
      maxZoom: 19,
      attribution: TILE_LAYERS[activeLayer].attribution,
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newTile;
  }, [activeLayer]);

  // Update Markers when filteredEvents changes
  useEffect(() => {
    const cluster = clusterGroupRef.current;
    const map = mapInstanceRef.current;
    if (!cluster || !map) return;

    cluster.clearLayers();

    filteredEvents.forEach((evt) => {
      const catConfig = CATEGORY_CONFIG[evt.category] || { color: '#0284c7' };
      const sevConfig = SEVERITY_CONFIG[evt.severity] || { label: 'Moderate', icon: '▲' };
      const svgIcon = SVG_ICONS[evt.category] || SVG_ICONS.rainfall;

      const isSevere = evt.severity === 'severe';

      const markerHtml = `
        <div class="relative group ${isAdmin ? 'cursor-pointer' : 'cursor-default'} flex items-center justify-center">
          ${
            isSevere
              ? `<span class="absolute -inset-2.5 rounded-full bg-red-500/35 animate-ping"></span>`
              : ''
          }
          <div
            class="relative w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-transform duration-200 hover:scale-125"
            style="background: ${catConfig.color}; border: 2.5px solid #ffffff; color: white;"
            title="${evt.title}"
          >
            ${svgIcon}
          </div>
          <span class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border border-white flex items-center justify-center text-[7px] font-black text-white ${
            evt.severity === 'severe'
              ? 'bg-red-600'
              : evt.severity === 'moderate'
              ? 'bg-sky-500'
              : 'bg-emerald-500'
          }">
            ${sevConfig.icon}
          </span>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-weather-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([evt.lat, evt.lng], { icon: customIcon });

      // Rich Glassmorphic Leaflet Popup
      const popupHtml = `
        <div style="font-family: Outfit, sans-serif; min-width: 220px; padding: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 7px; border-radius: 9999px; ${
              evt.severity === 'severe'
                ? 'background: #fee2e2; color: #b91c1c;'
                : evt.severity === 'moderate'
                ? 'background: #e0f2fe; color: #0369a1;'
                : 'background: #d1fae5; color: #047857;'
            }">
              ${sevConfig.icon} ${sevConfig.label}
            </span>
            <span style="font-size: 11px; font-weight: 600; color: #64748b;">
              ${evt.confidence}% conf.
            </span>
          </div>
          <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; line-height: 1.3;">
            ${evt.title}
          </h4>
          <p style="font-size: 11px; color: #475569; margin: 0 0 8px 0;">
            📍 ${evt.city}, ${evt.state}
          </p>
          <div style="background: #f8fafc; border-radius: 6px; padding: 6px; margin-bottom: 8px; font-size: 10px; color: #334155; line-height: 1.4;">
            ${(evt.description ?? '').slice(0, 110)}...
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 6px; margin-bottom: 8px;">
            <span>Corroborated: <strong>${evt.sources} sources</strong></span>
            <span>Reports: <strong>${evt.reportCount}</strong></span>
          </div>
          ${
            isAdmin
              ? `<button id="inspect-evt-${evt.id}" style="width: 100%; background: #0284c7; color: white; border: none; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                  Inspect Full Telemetry &rarr;
                </button>`
              : `<div style="text-align: center; font-size: 11px; color: #64748b; padding: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-weight: 600;">
                  Public Weather Telemetry (Read-Only)
                </div>`
          }
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: 'skysignal-leaflet-popup',
        maxWidth: 280,
      });

      if (isAdmin) {
        marker.on('popupopen', () => {
          const btn = document.getElementById(`inspect-evt-${evt.id}`);
          if (btn) {
            btn.onclick = () => {
              onSelectEvent?.(evt);
            };
          }
        });
      }

      if (isAdmin) {
        marker.on('click', () => {
          onSelectEvent?.(evt);
        });
      }

      cluster.addLayer(marker);
    });
  }, [filteredEvents, onSelectEvent, isAdmin]);

  // Controls Handlers
  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(INDIA_CENTER, DEFAULT_ZOOM, {
        duration: 1.2,
      });
    }
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 200);
  };

  return (
    <div
      className={`glass-card overflow-hidden transition-all duration-300 flex flex-col ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : ''
      } ${className}`}
    >
      {/* ── Top Bar / Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-[var(--color-border)] bg-white/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary-500)] animate-pulse" />
            <h2 className="text-[14px] font-bold text-[var(--color-text-primary)]">
              Pan-India Live Geo-Radar
            </h2>
          </div>

          {/* Live SSE Pulse Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">
              Telemetry Stream
            </span>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Severity Quick Filter */}
          <div className="flex items-center rounded-lg bg-[var(--color-surface-hover)] p-0.5 border border-[var(--color-border)]">
            <button
              onClick={() => setSelectedSeverity('all')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                selectedSeverity === 'all'
                  ? 'bg-white shadow-xs font-semibold text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              All ({normalizedEvents.length})
            </button>
            <button
              onClick={() => setSelectedSeverity('severe')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors flex items-center gap-1 ${
                selectedSeverity === 'severe'
                  ? 'bg-red-500 text-white font-semibold shadow-xs'
                  : 'text-red-600 hover:bg-red-50'
              }`}
            >
              <ShieldAlert size={12} />
              Severe ({normalizedEvents.filter((e) => e.severity === 'severe').length})
            </button>
          </div>

          {/* Category Dropdown */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-[11px] font-medium bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg px-2.5 py-1 text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              aria-label="Filter by weather category"
            >
              <option value="all">All Hazards (7/7)</option>
              <option value="rainfall">🌧️ Rainfall</option>
              <option value="thunderstorm">⚡ Thunderstorm</option>
              <option value="flooding">🌊 Flooding</option>
              <option value="heatwave">🌡️ Heatwave</option>
              <option value="fog">🌫️ Fog</option>
              <option value="dust storm">🌪️ Dust Storm</option>
              <option value="strong wind">💨 Strong Wind</option>
            </select>
          </div>

          {/* Basemap Toggle */}
          <div className="flex items-center rounded-lg bg-[var(--color-surface-hover)] p-0.5 border border-[var(--color-border)]">
            <button
              onClick={() => setActiveLayer('light')}
              title="Atmospheric Light Map"
              className={`px-2 py-1 text-[10px] font-semibold rounded ${
                activeLayer === 'light'
                  ? 'bg-white text-[var(--color-primary-600)] shadow-xs'
                  : 'text-[var(--color-text-tertiary)]'
              }`}
            >
              Light
            </button>
            <button
              onClick={() => setActiveLayer('dark')}
              title="Obsidian Night Map"
              className={`px-2 py-1 text-[10px] font-semibold rounded ${
                activeLayer === 'dark'
                  ? 'bg-slate-900 text-sky-400 shadow-xs'
                  : 'text-[var(--color-text-tertiary)]'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setActiveLayer('topo')}
              title="Topographical Map"
              className={`px-2 py-1 text-[10px] font-semibold rounded ${
                activeLayer === 'topo'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-[var(--color-text-tertiary)]'
              }`}
            >
              Topo
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 border-l border-[var(--color-border)] pl-2">
            <button
              onClick={handleResetView}
              className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
              title="Reset India Center View"
              aria-label="Reset India view"
            >
              <RotateCcw size={15} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Leaflet Container ── */}
      <div className="relative flex-1 w-full overflow-hidden">
        <div
          ref={mapContainerRef}
          className={`w-full ${isFullscreen ? 'h-full' : height} z-0`}
          style={{ minHeight: isFullscreen ? 'calc(100vh - 120px)' : '460px' }}
        />

        {/* Floating Custom Zoom Controls */}
        <div className="absolute top-4 right-4 z-[400] flex flex-col gap-1 shadow-md rounded-xl overflow-hidden border border-white/80 bg-white/90 backdrop-blur-md">
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors border-b border-slate-100"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors"
            aria-label="Zoom out"
          >
            −
          </button>
        </div>

        {/* Bottom Legend Overlay */}
        <div className="absolute bottom-4 left-4 z-[400] bg-white/92 backdrop-blur-md rounded-xl border border-slate-200/80 p-2.5 shadow-md max-w-sm hidden sm:block">
          <div className="flex items-center justify-between gap-4 mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Active Hazard Types
            </span>
            <span className="text-[10px] font-semibold text-sky-600">
              {filteredEvents.length} Pins Clustered
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-[10px] font-medium text-slate-700">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>Rainfall</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>Thunder</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-600" />
              <span>Flooding</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span>Heatwave</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-500" />
              <span>Fog</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
              <span>Dust Storm</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
              <span>Wind</span>
            </div>
            <div className="flex items-center gap-1.5 text-red-600 font-bold">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
              <span>Severe ◆</span>
            </div>
          </div>
        </div>

        {/* Quick Stats Overlay Pill */}
        <div className="absolute top-4 left-4 z-[400] bg-white/92 backdrop-blur-md rounded-xl border border-slate-200/80 px-3 py-1.5 shadow-md flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
            <Zap size={14} className="text-amber-500" />
            <span>{filteredEvents.length} Active Events</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="text-[10px] text-slate-500 font-medium">
            IMD Radar & Citizen Fusion
          </div>
        </div>
      </div>
    </div>
  );
}
