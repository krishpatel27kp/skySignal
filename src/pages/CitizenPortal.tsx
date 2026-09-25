/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Citizen Reporting Portal
   Public-facing observation portal designed for rapid under-30-second
   submissions, offline resilience, and verified community mapping.
   ═══════════════════════════════════════════════════════ */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Send,
  History,
  Shield,
  WifiOff,
  Compass,
  CheckCircle2,
  Clock,
  Radio,
} from 'lucide-react';
import ReportForm from '../components/citizen/ReportForm';
import MyReportsList from '../components/citizen/MyReportsList';
import GeoRadarMap from '../components/dashboard/GeoRadarMap';
import EventDetailDrawer from '../components/events/EventDetailDrawer';
import { mockWeatherEvents } from '../lib/mockData';
import type { QueuedReport } from '../lib/offlineQueue';

type ActiveTab = 'submit' | 'history' | 'map';

export default function CitizenPortal() {
  const { i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';

  const [activeTab, setActiveTab] = useState<ActiveTab>('submit');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedMapEvent, setSelectedMapEvent] = useState<any | null>(null);

  const handleReportSubmitted = (_report: QueuedReport) => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── 1. Hero & Portal Overview Banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sky-900 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 shadow-2xl border border-sky-500/20 animate-fade-in">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 rounded-full bg-sky-500/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 rounded-full bg-cyan-400/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 font-extrabold text-[11px] border border-sky-400/30 flex items-center gap-1.5">
              <Radio size={13} className="animate-pulse" />
              <span>{isHindi ? 'राष्ट्रीय मौसम रडार सहयोग' : 'National Weather Radar Ingestion'}</span>
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px] flex items-center gap-1">
              <CheckCircle2 size={12} />
              <span>{isHindi ? 'ऑफ़लाइन सक्रिय' : 'Offline-Ready'}</span>
            </span>
          </div>

          <h1 className="text-[24px] sm:text-[30px] font-black tracking-tight leading-tight font-['Outfit']">
            {isHindi
              ? 'आपकी जानकारी से फर्क पड़ता है — स्थानीय मौसम की रिपोर्ट आईएमडी को भेजें।'
              : 'Your observation makes a difference — Report local weather incidents to IMD.'}
          </h1>

          <p className="text-[13px] sm:text-[14px] text-slate-300 leading-relaxed font-normal">
            {isHindi
              ? 'अत्यधिक बारिश, बाढ़, आंधी और लू की सटीक ज़मीनी तस्वीरें व विवरण 30 सेकंड से भी कम समय में दर्ज करें। यह डेटा सीधे आईएमडी के राष्ट्रीय पूर्वानुमान मॉडल में उपयोग होता है।'
              : 'Submit high-impact observations (flash flooding, treefalls, severe rain, hail, heatwaves) in under 30 seconds. Your ground-truth report feeds directly into IMD’s predictive models.'}
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 mt-6 border-t border-slate-700/60 text-[12px]">
          <div className="flex items-center gap-2.5 text-slate-200">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400">
              <Clock size={15} />
            </div>
            <span>{isHindi ? '30 सेकंड त्वरित रिपोर्टिंग' : 'Under 30s Rapid Submission'}</span>
          </div>
          <div className="flex items-center gap-2.5 text-slate-200">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <WifiOff size={15} />
            </div>
            <span>{isHindi ? 'ऑफ़लाइन कतार व स्वतः सिंक' : 'Offline Queue & Auto-Sync'}</span>
          </div>
          <div className="flex items-center gap-2.5 text-slate-200">
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
              <Shield size={15} />
            </div>
            <span>{isHindi ? 'प्रत्यक्ष आईएमडी सत्यापन' : 'Direct IMD Corroboration'}</span>
          </div>
        </div>
      </div>

      {/* ── 2. Tab Toggles ── */}
      <div className="flex items-center justify-center sm:justify-start">
        <div className="inline-flex p-1.5 rounded-2xl bg-white border border-slate-200/90 shadow-sm gap-1">
          <button
            onClick={() => setActiveTab('submit')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all cursor-pointer
              ${
                activeTab === 'submit'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
            events={mockWeatherEvents}
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
