/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Citizen Observation Portal
   Fast mobile reporting, bilingual, GPS location & offline sync
   ═══════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Send,
  MapPin,
  Camera,
  CheckCircle2,
  CloudRain,
  CloudLightning,
  Waves,
  Thermometer,
  Cloud,
  Wind,
  Smartphone,
  X,
  History,
  Languages,
  Check,
} from 'lucide-react';
import { submitReport } from '../services/mockApi';
import { CATEGORY_CONFIG, SEVERITY_CONFIG } from '../data/mock';
import type { WeatherCategory, Severity, ReportSubmission } from '../types/weather';

interface LocalHistoryItem {
  id: string;
  category: WeatherCategory;
  severity: Severity;
  city: string;
  state: string;
  raw_text: string;
  timestamp: string;
  status: 'pending' | 'verified' | 'rejected';
}

const CATEGORIES: { id: WeatherCategory; labelEn: string; labelHi: string; icon: any }[] = [
  { id: 'rainfall', labelEn: 'Heavy Rain', labelHi: 'भारी बारिश', icon: CloudRain },
  { id: 'thunderstorm', labelEn: 'Thunderstorm', labelHi: 'गरज-तूफान', icon: CloudLightning },
  { id: 'flooding', labelEn: 'Flash Flooding', labelHi: 'जलभराव / बाढ़', icon: Waves },
  { id: 'heatwave', labelEn: 'Heatwave', labelHi: 'लू / भीषण गर्मी', icon: Thermometer },
  { id: 'fog', labelEn: 'Dense Fog', labelHi: 'घना कोहरा', icon: Cloud },
  { id: 'dust storm', labelEn: 'Dust Storm', labelHi: 'धूल भरी आंधी', icon: Wind },
  { id: 'strong wind', labelEn: 'Gale Wind', labelHi: 'तेज आंधी', icon: Wind },
];

export default function CitizenReportPage() {
  const { i18n } = useTranslation();
  const [lang, setLang] = useState<'en' | 'hi'>((i18n.language as 'en' | 'hi') || 'en');

  // Form states
  const [category, setCategory] = useState<WeatherCategory>('rainfall');
  const [severity, setSeverity] = useState<Severity>('moderate');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [lat, setLat] = useState(28.6139);
  const [lon, setLon] = useState(77.209);
  const [description, setDescription] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null);

  // Local storage history
  const [history, setHistory] = useState<LocalHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('skysignal_citizen_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // fallback
    }
    return [
      {
        id: 'REP-CITIZEN-091',
        category: 'rainfall',
        severity: 'severe',
        city: 'Mumbai',
        state: 'Maharashtra',
        raw_text: 'Waterlogged above knee height near Hindmata cinema. Traffic completely halted.',
        timestamp: new Date(Date.now() - 42 * 60_000).toISOString(),
        status: 'verified',
      },
    ];
  });

  // Sync history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('skysignal_citizen_history', JSON.stringify(history));
    } catch (e) {
      // ignore
    }
  }, [history]);

  // Geolocation handler
  const handleDetectLocation = () => {
    setIsDetectingLocation(true);
    setLocationStatus(lang === 'hi' ? 'जीपीएस खोज रहा है...' : 'Acquiring GPS fix...');

    if (!navigator.geolocation) {
      setLocationStatus(lang === 'hi' ? 'जीपीएस समर्थित नहीं है' : 'GPS not supported by browser');
      setIsDetectingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLon(pos.coords.longitude);
        setCity('Current Location');
        setState('Auto-detected');
        setLocationStatus(
          lang === 'hi'
            ? `स्थान दर्ज: ${pos.coords.latitude.toFixed(3)}°N, ${pos.coords.longitude.toFixed(3)}°E`
            : `Coordinates locked: ${pos.coords.latitude.toFixed(3)}°N, ${pos.coords.longitude.toFixed(3)}°E`
        );
        setIsDetectingLocation(false);
      },
      (_err) => {
        // Fallback to New Delhi demo coordinate
        setCity('New Delhi');
        setState('Delhi NCR');
        setLat(28.6139);
        setLon(77.209);
        setLocationStatus(
          lang === 'hi'
            ? 'जीपीएस अनुमति नहीं मिली, डिफ़ॉल्ट नई दिल्ली चुना गया'
            : 'GPS permission denied, defaulted to Delhi NCR'
        );
        setIsDetectingLocation(false);
      },
      { timeout: 8000 }
    );
  };

  // Mock photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sampleImages = [
      'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1514632595-4944383f2737?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=600&q=80',
    ];
    const picked = sampleImages[mediaUrls.length % sampleImages.length];
    setMediaUrls((prev) => [...prev, picked]);
  };

  // Submit report
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    const submission: ReportSubmission = {
      event_category: category,
      severity,
      lat,
      lon,
      city: city || 'New Delhi',
      state: state || 'Delhi NCR',
      raw_text: description,
      media_urls: mediaUrls,
      device_id: 'citizen-mobile-client-' + Math.floor(Math.random() * 10000),
      language: lang,
    };

    const newReport = await submitReport(submission);

    // Save to history
    const historyItem: LocalHistoryItem = {
      id: newReport.id,
      category,
      severity,
      city: city || 'New Delhi',
      state: state || 'Delhi NCR',
      raw_text: description,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };
    setHistory((prev) => [historyItem, ...prev]);

    // Reset Form
    setDescription('');
    setMediaUrls([]);
    setIsSubmitting(false);
    setSubmissionSuccess(
      lang === 'hi'
        ? 'आपकी मौसम रिपोर्ट आईएमडी कमांड सेंटर को सफलतापूर्वक भेज दी गई है!'
        : 'Your observation was transmitted to the IMD National Command Center!'
    );
    setTimeout(() => setSubmissionSuccess(null), 5000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Smartphone size={22} className="text-sky-600" />
            <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight">
              {lang === 'hi' ? 'नागरिक मौसम रिपोर्टिंग पोर्टल' : 'Citizen Weather Observation Portal'}
            </h1>
          </div>
          <p className="text-[13px] text-slate-500">
            {lang === 'hi'
              ? 'राष्ट्रीय मौसम रडार और आपातकालीन राहत तंत्र को वास्तविक समय में ज़मीनी जानकारी भेजें।'
              : 'Direct crowdsource ingestion channel providing ground-truth intelligence to IMD forecasters.'}
          </p>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
          <Languages size={15} className="text-slate-400 ml-1.5" />
          <button
            onClick={() => {
              setLang('en');
              i18n.changeLanguage('en');
            }}
            className={`px-3 py-1 rounded-lg text-[12px] font-bold transition-colors ${
              lang === 'en' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            English
          </button>
          <button
            onClick={() => {
              setLang('hi');
              i18n.changeLanguage('hi');
            }}
            className={`px-3 py-1 rounded-lg text-[12px] font-bold transition-colors ${
              lang === 'hi' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            हिन्दी
          </button>
        </div>
      </div>

      {/* ── Success Banner ── */}
      {submissionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            <span>{submissionSuccess}</span>
          </div>
          <button onClick={() => setSubmissionSuccess(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Main Submission Form ── */}
      <form onSubmit={handleSubmit} className="glass-card p-6 rounded-2xl border border-slate-200 shadow-md space-y-6">
        {/* Step 1: Category Picker */}
        <div>
          <label className="block text-[13px] font-bold text-slate-800 mb-2">
            1. {lang === 'hi' ? 'मौसम आपदा का प्रकार चुनें' : 'Select Observed Weather Hazard'}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = category === cat.id;
              const meta = CATEGORY_CONFIG[cat.id];

              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50/70 shadow-sm ring-2 ring-sky-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                    style={{ backgroundColor: meta?.bgColor, color: meta?.color }}
                  >
                    <Icon size={18} />
                  </div>
                  <span className="text-[12px] font-bold text-slate-800">
                    {lang === 'hi' ? cat.labelHi : cat.labelEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Severity Level (Strict 3-Tier) */}
        <div>
          <label className="block text-[13px] font-bold text-slate-800 mb-2">
            2. {lang === 'hi' ? 'तीव्रता का स्तर' : 'Estimated Severity (3-Tier Protocol)'}
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['minor', 'moderate', 'severe'] as Severity[]).map((sev) => {
              const config = SEVERITY_CONFIG[sev];
              const isSelected = severity === sev;

              return (
                <button
                  type="button"
                  key={sev}
                  onClick={() => setSeverity(sev)}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                    isSelected
                      ? sev === 'severe'
                        ? 'border-red-500 bg-red-50 text-red-700 font-bold ring-2 ring-red-500/20'
                        : sev === 'moderate'
                        ? 'border-sky-500 bg-sky-50 text-sky-700 font-bold ring-2 ring-sky-500/20'
                        : 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-[12px] font-bold">{config.icon} {config.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: Location */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[13px] font-bold text-slate-800">
              3. {lang === 'hi' ? 'स्थान विवरण' : 'Geographic Location'}
            </label>
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={isDetectingLocation}
              className="text-[11px] font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1 cursor-pointer"
            >
              <MapPin size={13} />
              <span>{isDetectingLocation ? 'Detecting...' : lang === 'hi' ? 'जीपीएस स्थान पहचानें' : 'Detect GPS Coordinates'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={lang === 'hi' ? 'शहर / इलाका (उदा. अंधेरी वेस्ट)' : 'City / Neighborhood (e.g. Bandra West)'}
              className="w-full px-3.5 py-2.5 text-[12px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800"
              required
            />
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder={lang === 'hi' ? 'राज्य (उदा. महाराष्ट्र)' : 'State (e.g. Maharashtra)'}
              className="w-full px-3.5 py-2.5 text-[12px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800"
              required
            />
          </div>

          {locationStatus && (
            <p className="text-[11px] text-sky-700 font-medium mt-1.5 flex items-center gap-1">
              <Check size={12} />
              <span>{locationStatus}</span>
            </p>
          )}
        </div>

        {/* Step 4: Description */}
        <div>
          <label className="block text-[13px] font-bold text-slate-800 mb-2">
            4. {lang === 'hi' ? 'क्या हो रहा है? (विवरण लिखें)' : 'Ground Observation Details'}
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              lang === 'hi'
                ? 'पानी का स्तर, पेड़ टूटना, दृश्यता या बिजली आपूर्ति बाधित होने का विवरण दें...'
                : 'Describe current water levels, tree falls, road blockage, visibility, wind gusts, or structural damage...'
            }
            className="w-full px-3.5 py-2.5 text-[12px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 leading-relaxed"
            required
          />
        </div>

        {/* Step 5: Media Attachment */}
        <div>
          <label className="block text-[13px] font-bold text-slate-800 mb-2">
            5. {lang === 'hi' ? 'तस्वीर / वीडियो जोड़ें (वैकल्पिक)' : 'Upload Photographic Evidence (Optional)'}
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="px-4 py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-sky-500 hover:bg-sky-50/50 cursor-pointer flex items-center gap-2 text-[12px] font-semibold text-slate-600 transition-colors">
              <Camera size={16} className="text-slate-400" />
              <span>{lang === 'hi' ? 'फोटो अपलोड करें' : 'Attach Photo'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>

            {mediaUrls.map((url, idx) => (
              <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shadow-xs">
                <img src={url} alt="Attached" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setMediaUrls((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-[14px] font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Send size={16} />
          <span>
            {isSubmitting
              ? lang === 'hi'
                ? 'भेजा जा रहा है...'
                : 'Transmitting to IMD...'
              : lang === 'hi'
              ? 'आईएमडी को रिपोर्ट सबमिट करें'
              : 'Submit Observation to IMD Radar'}
          </span>
        </button>
      </form>

      {/* ── Local Submission History ── */}
      <div className="glass-card p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <History size={18} className="text-slate-500" />
          <h3 className="text-[14px] font-bold text-slate-800">
            {lang === 'hi' ? 'आपकी पिछली रिपोर्टें' : 'My Device Submission History'}
          </h3>
        </div>

        <div className="space-y-2.5">
          {history.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12px]"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] text-slate-400 font-bold">{item.id}</span>
                  <span className="font-bold text-slate-800 capitalize">{item.category}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600">{item.city}, {item.state}</span>
                </div>
                <p className="text-[12px] text-slate-600 font-medium">"{item.raw_text}"</p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    item.status === 'verified'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {item.status}
                </span>
                <span className="text-[11px] text-slate-400">
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
