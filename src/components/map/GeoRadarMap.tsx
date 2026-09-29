/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — GeoRadarMap Component
   Centered on India [20.5937, 78.9629], zoom 5
   Atmospheric dark/light tiles, leaflet.markercluster,
   Custom SVG marker pins colored by severity, keyboard accessible,
   Live User Geolocation & Proximity Hazard Warning Engine
   ═══════════════════════════════════════════════════════ */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  RotateCcw,
  ShieldAlert,
  Crosshair,
  Navigation,
} from 'lucide-react';
import type { WeatherEvent } from '../../types/weather';
import { SEVERITY_CONFIG, formatConfidence, formatEventId } from '../../data/mock';
import { useAuth } from '../../context/AuthContext';

interface GeoRadarMapProps {
  events: WeatherEvent[];
  onSelectEvent?: (event: WeatherEvent) => void;
  className?: string;
  height?: string;
}

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

// 100% Free Public OpenStreetMap Standard Tiles — Zero API Key Required
const OPENSTREETMAP_LAYER = {
  name: 'OpenStreetMap Standard',
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  subdomains: 'abc',
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
  const mapCardRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);

  const [filterSeverity, setFilterSeverity] = useState<'all' | 'severe'>('all');

  // User Geolocation State (only activated when user explicitly clicks the Locate button)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Filter events
  const displayEvents = useMemo(() => {
    if (filterSeverity === 'severe') {
      return events.filter((e) => e.severity === 'severe' || e.severity === 'critical' || e.severity === 'high');
    }
    return events;
  }, [events, filterSeverity]);

  // Request User Location on demand or initial load
  const locateUser = useCallback((zoomLevel = 10) => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude, accuracy } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude, accuracy });

        // Center map smoothly on user's location
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], zoomLevel, { duration: 1.5 });
        }
      },
      () => {
        setIsLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  // Ask for location on mount to pin user by default
  useEffect(() => {
    locateUser(10);
  }, [locateUser]);

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
      maxZoom: 16,
    });

    const tile = L.tileLayer(OPENSTREETMAP_LAYER.url, {
      maxZoom: 19,
      subdomains: OPENSTREETMAP_LAYER.subdomains,
      attribution: OPENSTREETMAP_LAYER.attribution,
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
          : 'rgba(2, 132, 199, 0.95)';

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

    // Invalidate size on load to avoid grey/white tiles
    const sizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(sizeTimer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Render User Live Location Marker on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }
    if (userAccuracyCircleRef.current) {
      userAccuracyCircleRef.current.remove();
    }

    const userHtml = `
      <div class="relative flex items-center justify-center cursor-pointer">
        <span class="absolute w-8 h-8 rounded-full bg-sky-500/40 animate-ping"></span>
        <div class="w-5 h-5 rounded-full bg-sky-500 border-2.5 border-white shadow-xl flex items-center justify-center">
          <div class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
        </div>
      </div>
    `;

    const userIcon = L.divIcon({
      html: userHtml,
      className: 'custom-user-gps-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([userLocation.lat, userLocation.lng], {
      icon: userIcon,
      zIndexOffset: 1000,
    }).addTo(map);

    marker.bindPopup(`
      <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; padding: 4px; min-width: 170px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 9999px; background: #0284c7;"></span>
          <strong style="font-size: 12px; color: #0f172a;">Your Live Location</strong>
        </div>
        <div style="font-size: 11px; color: #64748b;">
          Lat: ${userLocation.lat.toFixed(4)}°, Lon: ${userLocation.lng.toFixed(4)}°
        </div>
        <div style="font-size: 10px; color: #059669; font-weight: 700; margin-top: 4px;">
          ● GPS Telemetry Active
        </div>
      </div>
    `);

    userMarkerRef.current = marker;

    if (userLocation.accuracy && userLocation.accuracy > 50) {
      userAccuracyCircleRef.current = L.circle([userLocation.lat, userLocation.lng], {
        radius: Math.min(userLocation.accuracy, 2000),
        color: '#0284c7',
        fillColor: '#38bdf8',
        fillOpacity: 0.1,
        weight: 1,
      }).addTo(map);
    }
  }, [userLocation]);

  // Populate Event Markers
  useEffect(() => {
    const cluster = clusterGroupRef.current;
    if (!cluster) return;

    cluster.clearLayers();

    displayEvents.forEach((evt) => {
      const isCritical = evt.severity === 'critical' || evt.severity === 'severe';
      const isHigh = evt.severity === 'high';
      const isModerate = evt.severity === 'moderate';

      // Standard palette
      const pinColor = isCritical ? '#ef4444' : isHigh ? '#f97316' : isModerate ? '#0284c7' : '#10b981';
      const sevConfig = SEVERITY_CONFIG[evt.severity] || { label: 'Moderate', icon: '▲' };
      const svgIcon = SVG_ICONS[evt.category] || SVG_ICONS.rainfall;

      const markerHtml = `
        <div
          class="relative group cursor-pointer hover:scale-125 flex items-center justify-center focus:outline-none"
          tabindex="0"
          role="button"
          aria-label="${evt.title} in ${evt.city}, ${evt.state}. Severity: ${evt.severity}"
          id="marker-${evt.id}"
        >
          ${
            isCritical
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
              isCritical ? 'bg-red-700' : isHigh ? 'bg-orange-600' : isModerate ? 'bg-sky-600' : 'bg-emerald-600'
            }"
          >
            ${sevConfig.icon || '●'}
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
      (marker.options as any).isSevere = isCritical || isHigh;

      const confPct = formatConfidence(evt.confidence);
      const friendlyId = formatEventId(evt.id);

      // Interactive Popup
      const popupContent = `
        <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; min-width: 230px; padding: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 2px 8px; border-radius: 9999px; ${
              isCritical
                ? 'background: #fee2e2; color: #b91c1c;'
                : isHigh
                ? 'background: #ffedd5; color: #c2410c;'
                : isModerate
                ? 'background: #e0f2fe; color: #0369a1;'
                : 'background: #d1fae5; color: #047857;'
            }">
              ${sevConfig.icon} ${sevConfig.label}
            </span>
            <span style="font-size: 11px; font-weight: 700; color: #0284c7;">
              ${confPct}% AI Conf.
            </span>
          </div>
          ${
            isAdmin
              ? `<div style="font-size: 10px; font-family: monospace; font-weight: 800; color: #64748b; margin-bottom: 2px;">
                  ${friendlyId}
                </div>`
              : ''
          }
          <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 3px 0; line-height: 1.3;">
            ${evt.title}
          </h4>
          <p style="font-size: 11px; color: #475569; margin: 0 0 6px 0;">
            📍 ${evt.city}, ${evt.state}
          </p>
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; padding-top: 6px; border-top: 1px solid #e2e8f0; margin-bottom: 8px;">
            <span>Sources: <strong>${evt.independent_source_count || 1} platforms</strong></span>
            <span>Reports: <strong>${evt.evidence_summary?.citizen_reports ?? 12} reports</strong></span>
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

      // Click & Popup actions: Zoom into clicked location & select event
      marker.on('click', () => {
        mapInstanceRef.current?.flyTo([evt.lat, evt.lon], 13, { duration: 1.2 });
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

      cluster.addLayer(marker);
    });
  }, [displayEvents, onSelectEvent, isAdmin]);

  // Controls
  const handleResetView = () => {
    mapInstanceRef.current?.flyTo(INDIA_CENTER, DEFAULT_ZOOM, { duration: 1.2 });
  };

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  return (
    <div
      ref={mapCardRef}
      className={`glass-card overflow-hidden flex flex-col relative rounded-2xl border border-slate-200/90 shadow-sm ${className}`}
    >
      {/* ── Topbar / Map Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-200/90 bg-white/95 text-slate-900 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
            <h2 className="text-[13px] font-bold text-slate-900">
              Live Geo-Radar Monitoring
            </h2>
          </div>

          {/* User Location Chip */}
          {userLocation && (
            <button
              onClick={() => mapInstanceRef.current?.flyTo([userLocation.lat, userLocation.lng], 9)}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-bold hover:bg-sky-100 transition-colors cursor-pointer"
              title="Click to center on your location"
            >
              <Navigation size={10} className="text-sky-600" />
              <span>You are located in India</span>
            </button>
          )}
        </div>

        {/* Controls & Quick Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Severity Filter Toggle */}
          <div className="flex items-center rounded-xl p-0.5 border border-slate-200 bg-slate-100 text-[11px] font-semibold">
            <button
              onClick={() => setFilterSeverity('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                filterSeverity === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All Events ({events.length})
            </button>
            <button
              onClick={() => setFilterSeverity('severe')}
              className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                filterSeverity === 'severe'
                  ? 'bg-red-600 text-white shadow-xs font-bold'
                  : 'text-red-600 hover:bg-red-50'
              }`}
            >
              <ShieldAlert size={12} />
              <span>Severe Hazards ({events.filter((e) => e.severity === 'severe' || e.severity === 'critical' || e.severity === 'high').length})</span>
            </button>
          </div>

          {/* Reset View and Locate Me */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <button
              onClick={() => locateUser(10)}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                isLocating ? 'animate-spin text-sky-600' : 'text-slate-500 hover:text-sky-600 hover:bg-slate-100'
              }`}
              title="Center on My Live Location"
              aria-label="Locate me"
            >
              <Crosshair size={18} />
            </button>
            <button
              onClick={handleResetView}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Reset India Center View"
              aria-label="Reset India View"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Leaflet Map Container ── */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden bg-slate-100">
        <div
          ref={mapContainerRef}
          className={`w-full ${height} z-0 bg-slate-100`}
        />

        {/* Custom Zoom Buttons */}
        <div className="absolute top-4 right-4 z-[400] flex flex-col gap-1 shadow-md rounded-xl overflow-hidden border border-slate-200 bg-white/95 text-slate-800 backdrop-blur-md">
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 flex items-center justify-center font-bold hover:bg-slate-100 transition-colors border-b border-slate-100 cursor-pointer"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 flex items-center justify-center font-bold hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Zoom out"
          >
            −
          </button>
        </div>

        {/* Severity Legend */}
        <div className="absolute bottom-4 left-4 z-[400] bg-slate-900/95 text-white backdrop-blur-md rounded-2xl border border-slate-700/80 p-3 shadow-2xl max-w-xs hidden sm:block">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Severity Taxonomy & Radar Pins
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <span className="font-bold text-red-400">◆ Critical / Severe Hazard</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="font-bold text-orange-400">▲ High Severity Warning</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-sky-500" />
              <span className="font-bold text-sky-400">▲ Moderate Hazard</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="font-bold text-emerald-400">● Minor / Low Observation</span>
            </div>
            {userLocation && (
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800 text-sky-400">
                <span className="w-3 h-3 rounded-full bg-sky-400 border border-white" />
                <span className="font-bold">📍 Your Live GPS Location</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
