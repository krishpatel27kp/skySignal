/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Citizen Reporting Portal
   Public-facing observation portal designed for rapid under-30-second
   submissions, offline resilience, and verified community mapping.
   ═══════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Send,
  History,
  Compass,
} from 'lucide-react';
import ReportForm from '../components/citizen/ReportForm';
import MyReportsList from '../components/citizen/MyReportsList';
import GeoRadarMap from '../components/map/GeoRadarMap';
import EventDetailDrawer from '../components/events/EventDetailDrawer';
import { getEvents } from '../services/apiClient';
import type { QueuedReport } from '../lib/offlineQueue';
import type { WeatherEvent } from '../types/weather';

type ActiveTab = 'submit' | 'history' | 'map';

export default function CitizenPortal() {
  const { i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';

  const [activeTab, setActiveTab] = useState<ActiveTab>('submit');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedMapEvent, setSelectedMapEvent] = useState<any | null>(null);
  const [mapEvents, setMapEvents] = useState<WeatherEvent[]>([]);

  // Fetch events from live backend for the map
  useEffect(() => {
    getEvents(undefined, { limit: 50 })
      .then((res) => setMapEvents(res.results))
      .catch((err) => console.error('Failed to load events:', err));
  }, []);

  const handleReportSubmitted = (_report: QueuedReport) => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── 1. Hero & Portal Overview Banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1c1917] via-[#24211e] to-[#161413] text-white p-4 sm:p-6 shadow-2xl border border-[#36322e] animate-fade-in">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 rounded-full bg-orange-400/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-3 max-w-2xl">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
            {isHindi
              ? 'आपकी जानकारी से फर्क पड़ता है — स्थानीय मौसम की रिपोर्ट हमें भेजें।'
              : 'Your observation makes a difference — Report local weather incidents to us.'}
          </h1>
        </div>
      </div>

      {/* ── 2. Tab Toggles ── */}
      <div className="flex items-center justify-center sm:justify-start">
        <div className="inline-flex p-1.5 rounded-2xl bg-white border border-stone-200 shadow-sm gap-1">
          <button
            onClick={() => setActiveTab('submit')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all cursor-pointer
              ${
                activeTab === 'submit'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }
            `}
          >
            <Send size={15} />
            <span>{isHindi ? 'रिपोर्ट सबमिट करें' : 'Submit Report'}</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all cursor-pointer
              ${
                activeTab === 'history'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }
            `}
          >
            <History size={15} />
            <span>{isHindi ? 'मेरी रिपोर्टें' : 'My Submissions'}</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all cursor-pointer
              ${
                activeTab === 'map'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }
            `}
          >
            <Compass size={15} />
            <span>{isHindi ? 'नज़दीकी सत्यापित मैप' : 'Nearby Verified Map'}</span>
          </button>
        </div>
      </div>

      {/* ── 3. Tab Content ── */}
      {activeTab === 'submit' && (
        <div className="animate-fade-in">
          <ReportForm onReportSubmitted={handleReportSubmitted} />
        </div>
      )}

      {activeTab === 'history' && (
        <div className="animate-fade-in">
          <MyReportsList refreshTrigger={refreshTrigger} />
        </div>
      )}

      {activeTab === 'map' && (
        <div className="space-y-3 animate-fade-in">
          <div className="glass-card p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-bold text-slate-800">
                {isHindi ? 'सत्यापित जन-मौसम रिपोर्ट मैप' : 'Verified Community Ground-Truth Map'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isHindi
                  ? 'नागरिकों द्वारा सबमिट की गई और आईएमडी डॉप्लर रडार द्वारा सत्यापित घटनाएं।'
                  : 'Showing real-time events corroborated by ground citizen reports and satellite feeds.'}
              </p>
            </div>
          </div>

          <GeoRadarMap
            events={mapEvents}
            onSelectEvent={setSelectedMapEvent}
            height="h-[560px]"
          />
        </div>
      )}

      {/* Detail drawer when clicking map event */}
      {selectedMapEvent && (
        <EventDetailDrawer
          event={selectedMapEvent}
          onClose={() => setSelectedMapEvent(null)}
        />
      )}
    </div>
  );
}
