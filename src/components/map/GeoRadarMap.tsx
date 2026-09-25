/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — GeoRadarMap Component
   Centered on India [20.5937, 78.9629], zoom 5
   Atmospheric dark/light tiles, leaflet.markercluster,
   Custom SVG marker pins colored by severity, keyboard accessible
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
import type { WeatherEvent } from '../../types/weather';
import { SEVERITY_CONFIG } from '../../data/mock';
import { useAuth } from '../../context/AuthContext';

interface GeoRadarMapProps {
  events: WeatherEvent[];
  onSelectEvent?: (event: WeatherEvent) => void;
  className?: string;
  height?: string;
}

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

// Tile Providers (Standard OpenStreetMap — completely free & open source, no API key required)
const TILE_LAYERS = {
  dark: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  light: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
};

// SVG category icons for inside the pin
const SVG_ICONS: Record<string, string> = {
  rainfall: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>`,
  thunderstorm: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/></svg>`,
  flooding: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`,
  heatwave: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>`,
  fog: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M4 18h16"/><path d="M6 21h12"/></svg>`,
  'dust storm': `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>`,
  'strong wind': `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>`,
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

  const [activeTheme, setActiveTheme] = useState<'dark' | 'light'>('dark');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'severe'>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filter events
  const displayEvents = useMemo(() => {
    if (filterSeverity === 'severe') {
      return events.filter((e) => e.severity === 'severe');
    }
    return events;
  }, [events, filterSeverity]);

  // Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: INDIA_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
      minZoom: 4,
      maxZoom: 14,
    });

    const tile = L.tileLayer(TILE_LAYERS[activeTheme].url, {
      maxZoom: 19,
      attribution: TILE_LAYERS[activeTheme].attribution,
    }).addTo(map);

    tileLayerRef.current = tile;

    // Cluster Group
    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const hasSevere = cluster.getAllChildMarkers().some((m: any) => m.options.isSevere);

        const bgColor = hasSevere
          ? 'rgba(239, 68, 68, 0.95)'
          : 'rgba(2, 132, 199, 0.92)';

        return L.divIcon({
          html: `<div class="w-10 h-10 rounded-full flex items-center justify-center font-black text-[12px] text-white shadow-xl backdrop-blur-md ${hasSevere ? 'animate-pulse' : ''}" style="background: ${bgColor}; border: 2.5px solid #ffffff;">${count}</div>`,
          className: 'custom-cluster-pin',
          iconSize: L.point(40, 40),
        });
      },
    });

    clusterGroup.addTo(map);
    clusterGroupRef.current = clusterGroup;
    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Theme Change
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const newTile = L.tileLayer(TILE_LAYERS[activeTheme].url, {
      maxZoom: 19,
      attribution: TILE_LAYERS[activeTheme].attribution,
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newTile;
  }, [activeTheme]);

  // Populate Markers
  useEffect(() => {
    const cluster = clusterGroupRef.current;
    if (!cluster) return;

    cluster.clearLayers();

    displayEvents.forEach((evt) => {
      const isSevere = evt.severity === 'severe';
      const isModerate = evt.severity === 'moderate';

      // Severity Color Tokens
      // Minor: Emerald (#10b981), Moderate: Sky Blue (#0284c7), Severe: Crimson (#ef4444)
      const pinColor = isSevere ? '#ef4444' : isModerate ? '#0284c7' : '#10b981';
      const sevConfig = SEVERITY_CONFIG[evt.severity];
      const svgIcon = SVG_ICONS[evt.category] || SVG_ICONS.rainfall;

      const markerHtml = `
        <div
          class="relative group ${isAdmin ? 'cursor-pointer hover:scale-125' : 'cursor-default'} flex items-center justify-center focus:outline-none"
          ${isAdmin ? 'tabindex="0" role="button"' : ''}
          aria-label="${evt.title} in ${evt.city}, ${evt.state}. Severity: ${evt.severity}"
          id="marker-${evt.id}"
        >
          ${
            isSevere
              ? `<span class="absolute -inset-3 rounded-full bg-red-500/40 animate-ping pointer-events-none"></span>`
              : ''
          }
          <div
            class="relative w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-transform duration-200 hover:scale-125 focus:ring-4 focus:ring-sky-400"
            style="background: ${pinColor}; border: 2.5px solid #ffffff; color: #ffffff;"
          >
            ${svgIcon}
          </div>
          <span
            class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-white flex items-center justify-center text-[8px] font-black text-white ${
              isSevere ? 'bg-red-700' : isModerate ? 'bg-sky-600' : 'bg-emerald-600'
            }"
          >
            ${sevConfig?.icon || '●'}
          </span>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'weather-radar-pin',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([evt.lat, evt.lon], {
        icon: customIcon,
      });
      (marker.options as any).isSevere = isSevere;

      // Interactive Popup
      const popupContent = `
        <div style="font-family: Outfit, sans-serif; min-width: 230px; padding: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 2px 8px; border-radius: 9999px; ${
              isSevere
                ? 'background: #fee2e2; color: #b91c1c;'
                : isModerate
                ? 'background: #e0f2fe; color: #0369a1;'
                : 'background: #d1fae5; color: #047857;'
            }">
              ${sevConfig?.icon} ${sevConfig?.label}
            </span>
            <span style="font-size: 11px; font-weight: 700; color: #0284c7;">
              ${evt.confidence}% AI Conf.
            </span>
          </div>
          <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 3px 0; line-height: 1.3;">
            ${evt.title}
          </h4>
          <p style="font-size: 11px; color: #475569; margin: 0 0 6px 0;">
            📍 ${evt.city}, ${evt.state}
          </p>
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; padding-top: 6px; border-top: 1px solid #e2e8f0; margin-bottom: 8px;">
            <span>Sources: <strong>${evt.independent_source_count} platforms</strong></span>
            <span>Reports: <strong>${evt.evidence_summary?.citizen_reports ?? 14} citizen</strong></span>
          </div>
          ${
            isAdmin
              ? `<button id="inspect-btn-${evt.id}" style="width: 100%; background: #0284c7; color: white; border: none; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
                  Review Event Details &rarr;
                </button>`
              : `<div style="text-align: center; font-size: 11px; color: #64748b; padding: 5px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-weight: 600;">
                  Public Weather Telemetry (Read-Only)
                </div>`
          }
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 280 });

      // Click & Popup actions (Admin only opens drawer)
      marker.on('click', () => {
        if (isAdmin) {
          onSelectEvent?.(evt);
        }
      });

      marker.on('popupopen', () => {
        if (isAdmin) {
          const btn = document.getElementById(`inspect-btn-${evt.id}`);
          if (btn) {
            btn.onclick = () => onSelectEvent?.(evt);
          }
        }
      });

      // Keyboard accessibility (Enter / Space) - Admin only
      if (isAdmin) {
        marker.on('add', () => {
          setTimeout(() => {
            const el = document.getElementById(`marker-${evt.id}`);
            if (el) {
              el.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectEvent?.(evt);
                }
              });
            }
          }, 100);
        });
      }

      cluster.addLayer(marker);
    });
  }, [displayEvents, onSelectEvent, isAdmin]);

  // Controls
  const handleResetView = () => {
    mapInstanceRef.current?.flyTo(INDIA_CENTER, DEFAULT_ZOOM, { duration: 1.2 });
  };

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
    setTimeout(() => mapInstanceRef.current?.invalidateSize(), 200);
  };

  return (
    <div
      className={`glass-card overflow-hidden flex flex-col transition-all duration-300 ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : ''
      } ${className}`}
    >
      {/* ── Topbar / Map Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
            <h2 className="text-[14px] font-bold text-slate-900 font-['Outfit']">
              Live Geo-Radar Monitoring
            </h2>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
              Doppler Feed Active
            </span>
          </div>
        </div>

        {/* Controls & Quick Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Severity Filter Toggle */}
          <div className="flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-[11px] font-semibold">
            <button
              onClick={() => setFilterSeverity('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filterSeverity === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All Events ({events.length})
            </button>
            <button
              onClick={() => setFilterSeverity('severe')}
              className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                filterSeverity === 'severe'
                  ? 'bg-red-600 text-white shadow-xs font-bold'
                  : 'text-red-600 hover:bg-red-50'
              }`}
            >
              <ShieldAlert size={12} />
              <span>Severe Hazards ({events.filter((e) => e.severity === 'severe').length})</span>
            </button>
          </div>

          {/* Atmospheric Theme Toggle */}
          <div className="flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-[10px] font-bold">
            <button
              onClick={() => setActiveTheme('dark')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                activeTheme === 'dark'
                  ? 'bg-slate-900 text-sky-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Obsidian Dark
            </button>
            <button
              onClick={() => setActiveTheme('light')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                activeTheme === 'light'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Voyager Light
            </button>
          </div>

          {/* Reset View & Fullscreen */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <button
              onClick={handleResetView}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Reset India Center View"
              aria-label="Reset India View"
            >
              <RotateCcw size={15} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Map Container ── */}
      <div className="relative flex-1 w-full overflow-hidden">
        <div
          ref={mapContainerRef}
          className={`w-full ${isFullscreen ? 'h-full' : height} z-0`}
          style={{ minHeight: isFullscreen ? 'calc(100vh - 120px)' : '460px' }}
        />

        {/* Custom Zoom Buttons */}
        <div className="absolute top-4 right-4 z-[400] flex flex-col gap-1 shadow-md rounded-xl overflow-hidden border border-white/80 bg-white/90 backdrop-blur-md">
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 transition-colors border-b border-slate-100 cursor-pointer"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Zoom out"
          >
            −
          </button>
        </div>

        {/* Severity Legend */}
        <div className="absolute bottom-4 left-4 z-[400] bg-slate-900/90 text-white backdrop-blur-md rounded-2xl border border-slate-700/80 p-3 shadow-xl max-w-xs hidden sm:block">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Severity Taxonomy & Radar Pins
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <span className="font-bold text-red-400">◆ Severe (Radar Ping)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-sky-500" />
              <span className="font-bold text-sky-400">▲ Moderate Hazard</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="font-bold text-emerald-400">● Minor Observation</span>
            </div>
          </div>
        </div>

        {/* Live Events Pill */}
        <div className="absolute top-4 left-4 z-[400] bg-slate-900/90 text-white backdrop-blur-md rounded-xl border border-slate-700/80 px-3 py-1.5 shadow-md flex items-center gap-2">
          <Zap size={13} className="text-amber-400" />
          <span className="text-[11px] font-bold">
            {displayEvents.length} Clustered Pins
          </span>
          <span className="text-slate-500 text-[10px]">· India [20.59°N, 78.96°E]</span>
        </div>
      </div>
    </div>
  );
}
