/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Citizen Rapid Report Form
   Under-30-second submission form with offline IndexedDB queue,
   GPS geolocation, drag-and-drop media upload & validation
   ═══════════════════════════════════════════════════════ */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Send,
  MapPin,
  Camera,
  CloudRain,
  CloudLightning,
  Waves,
  Thermometer,
  Cloud,
  Wind,
  CheckCircle2,
  AlertTriangle,
  X,
  WifiOff,
  LocateFixed,
  Check,
} from 'lucide-react';
import { queueOfflineReport, getOrCreateDeviceId, type QueuedReport } from '../../lib/offlineQueue';
import { submitReport } from '../../services/apiClient';
import { CATEGORY_CONFIG, SEVERITY_CONFIG } from '../../data/mock';
import type { WeatherCategory, Severity } from '../../types/weather';

interface ReportFormProps {
  onReportSubmitted?: (report: QueuedReport) => void;
}

// Major Indian Cities Coordinate Fallback (for instant offline & high-accuracy matching)
const INDIAN_CITIES_REF = [
  { city: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lon: 72.8777 },
  { city: 'Delhi', state: 'Delhi', lat: 28.6139, lon: 77.2090 },
  { city: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lon: 77.5946 },
  { city: 'Kolkata', state: 'West Bengal', lat: 22.5726, lon: 88.3639 },
  { city: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lon: 80.2707 },
  { city: 'Hyderabad', state: 'Telangana', lat: 17.3850, lon: 78.4867 },
  { city: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lon: 72.5714 },
  { city: 'Pune', state: 'Maharashtra', lat: 18.5204, lon: 73.8567 },
  { city: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lon: 75.7873 },
  { city: 'Surat', state: 'Gujarat', lat: 21.1702, lon: 72.8311 },
  { city: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lon: 80.9462 },
  { city: 'Kanpur', state: 'Uttar Pradesh', lat: 26.4499, lon: 80.3319 },
  { city: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lon: 79.0882 },
  { city: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lon: 75.8577 },
  { city: 'Thane', state: 'Maharashtra', lat: 19.2183, lon: 72.9781 },
  { city: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2599, lon: 77.4126 },
  { city: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6868, lon: 83.2185 },
  { city: 'Patna', state: 'Bihar', lat: 25.5941, lon: 85.1376 },
  { city: 'Vadodara', state: 'Gujarat', lat: 22.3072, lon: 73.1812 },
  { city: 'Ghaziabad', state: 'Uttar Pradesh', lat: 28.6692, lon: 77.4538 },
  { city: 'Ludhiana', state: 'Punjab', lat: 30.9010, lon: 75.8573 },
  { city: 'Agra', state: 'Uttar Pradesh', lat: 27.1767, lon: 78.0081 },
  { city: 'Nashik', state: 'Maharashtra', lat: 19.9975, lon: 73.7898 },
  { city: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3176, lon: 82.9739 },
  { city: 'Srinagar', state: 'Jammu and Kashmir', lat: 34.0837, lon: 74.7973 },
  { city: 'Amritsar', state: 'Punjab', lat: 31.6340, lon: 74.8723 },
  { city: 'Ranchi', state: 'Jharkhand', lat: 23.3441, lon: 85.3096 },
  { city: 'Coimbatore', state: 'Tamil Nadu', lat: 11.0168, lon: 76.9558 },
  { city: 'Guwahati', state: 'Assam', lat: 26.1445, lon: 91.7362 },
  { city: 'Chandigarh', state: 'Chandigarh', lat: 30.7333, lon: 76.7794 },
  { city: 'Thiruvananthapuram', state: 'Kerala', lat: 8.5241, lon: 76.9366 },
  { city: 'Kochi', state: 'Kerala', lat: 9.9312, lon: 76.2673 },
  { city: 'Dehradun', state: 'Uttarakhand', lat: 30.3165, lon: 78.0322 },
  { city: 'Bhubaneswar', state: 'Odisha', lat: 20.2961, lon: 85.8245 },
  { city: 'Panaji', state: 'Goa', lat: 15.4909, lon: 73.8278 },
];

const CATEGORIES: { id: WeatherCategory; labelEn: string; labelHi: string; icon: any }[] = [
  { id: 'rainfall', labelEn: 'Rainfall', labelHi: 'भारी बारिश', icon: CloudRain },
  { id: 'thunderstorm', labelEn: 'Thunderstorm', labelHi: 'गरज-तूफान', icon: CloudLightning },
  { id: 'flooding', labelEn: 'Flooding', labelHi: 'जलभराव / बाढ़', icon: Waves },
  { id: 'heatwave', labelEn: 'Heatwave', labelHi: 'भीषण गर्मी / लू', icon: Thermometer },
  { id: 'fog', labelEn: 'Fog', labelHi: 'घना कोहरा', icon: Cloud },
  { id: 'dust storm', labelEn: 'Dust Storm', labelHi: 'धूल भरी आंधी', icon: Wind },
  { id: 'strong wind', labelEn: 'Strong Wind', labelHi: 'तेज चक्रवाती हवा', icon: Wind },
];

const MAX_CHARS = 2000;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

export default function ReportForm({ onReportSubmitted }: ReportFormProps) {
  const { i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';

  // Form State
  const [category, setCategory] = useState<WeatherCategory>('rainfall');
  const [severity, setSeverity] = useState<Severity>('moderate');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [lat, setLat] = useState<number>(19.076);
  const [lon, setLon] = useState<number>(72.8777);
  const [description, setDescription] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; isOffline?: boolean } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Instant GPS Geolocation with Real Reverse Geocoding
  const handleGetLocation = () => {
    setIsLocating(true);
    setLocationStatus(isHindi ? 'जीपीएस स्थान और शहर का पता लगाया जा रहा है...' : 'Detecting your live GPS coordinates & locality...');

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus(isHindi ? 'जीपीएस समर्थित नहीं है' : 'GPS hardware unavailable on this device');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = Number(pos.coords.latitude.toFixed(4));
        const longitude = Number(pos.coords.longitude.toFixed(4));
        setLat(latitude);
        setLon(longitude);

        let detectedCity = '';
        let detectedState = '';

        // Attempt reverse geocoding via OpenStreetMap Nominatim with timeout
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            { signal: controller.signal, headers: { 'Accept': 'application/json' } }
          );
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const localArea = addr.suburb || addr.neighbourhood || addr.residential || '';
            const cityName = addr.city || addr.town || addr.municipality || addr.district || addr.county || '';
            detectedCity = localArea && cityName ? `${localArea}, ${cityName}` : cityName || localArea;
            detectedState = addr.state || addr.state_district || '';
          }
        } catch (e) {
          console.warn('Online reverse geocoding failed or timed out:', e);
        }

        // If online lookup failed or returned empty, use nearest city fallback
        if (!detectedCity || !detectedState) {
          let nearestCity = INDIAN_CITIES_REF[0];
          let minDistance = Infinity;
          for (const c of INDIAN_CITIES_REF) {
            const d = Math.hypot(c.lat - latitude, c.lon - longitude);
            if (d < minDistance) {
              minDistance = d;
              nearestCity = c;
            }
          }
          detectedCity = detectedCity || nearestCity.city;
          detectedState = detectedState || nearestCity.state;
        }

        // Directly populate the form fields
        setCity(detectedCity);
        setState(detectedState);
        setLocationStatus(
          isHindi
            ? `✓ लाइव स्थान दर्ज: ${detectedCity}, ${detectedState} (${latitude}°N, ${longitude}°E)`
            : `✓ Live location detected: ${detectedCity}, ${detectedState} (${latitude}°N, ${longitude}°E)`
        );
        setIsLocating(false);
      },
      (_err) => {
        // Fallback default coordinates to Mumbai
        setCity('Mumbai');
        setState('Maharashtra');
        setLat(19.076);
        setLon(72.8777);
        setLocationStatus(
          isHindi
            ? 'जीपीएस अनुमति अस्वीकृत। डिफ़ॉल्ट स्थान मुंबई, महाराष्ट्र चुना गया।'
            : 'GPS access denied. Default fallback set to Mumbai, Maharashtra.'
        );
        setIsLocating(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Media File Handling (with 10MB check & FileReader)
  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setValidationError(null);

    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setValidationError(
          isHindi
            ? `फ़ाइल "${file.name}" 10MB की सीमा से बड़ी है!`
            : `File "${file.name}" exceeds the 10MB upload limit!`
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setMediaUrls((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    processFiles(e.dataTransfer.files);
  };

  // Form Validation & Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Rule: Requires category + location + (either description OR media)
    if (!category) {
      setValidationError(isHindi ? 'कृपया आपदा श्रेणी चुनें।' : 'Please select a hazard category.');
      return;
    }
    if (!city.trim() && !state.trim()) {
      setValidationError(isHindi ? 'कृपया स्थान दर्ज करें या जीपीएस का उपयोग करें।' : 'Please provide location details or use GPS.');
      return;
    }
    if (!description.trim() && mediaUrls.length === 0) {
      setValidationError(
        isHindi
          ? 'कृपया घटना का विवरण लिखें या प्रमाण के रूप में फोटो/वीडियो संलग्न करें।'
          : 'Please enter a description or upload photo/video proof.'
      );
      return;
    }

    setIsSubmitting(true);
    const deviceId = getOrCreateDeviceId();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    try {
      if (!isOnline) {
        // Offline: Persist directly into IndexedDB
        const queued = await queueOfflineReport({
          event_category: category,
          severity,
          lat,
          lon,
          city: city.trim() || 'Offline Location',
          state: state.trim() || 'Offline State',
          raw_text: description.trim(),
          media_urls: mediaUrls,
          device_id: deviceId,
        });

        setFeedbackToast({
          message: isHindi
            ? 'ऑफ़लाइन सहेजा गया: रिपोर्ट डिवाइस में सुरक्षित है। इंटरनेट आने पर स्वचालित रूप से भेजी जाएगी।'
            : 'Stored offline: Report queued safely on device. Will auto-sync when internet reconnects.',
          isOffline: true,
        });

        onReportSubmitted?.(queued);
      } else {
        // Online: Submit to real backend via multipart/form-data
        const apiReport = await submitReport({
          event_category: category,
          location_method: lat && lon ? 'gps' : 'manual',
          description: description.trim(),
          lat,
          lon,
        });

        // Also save to indexedDB as synced
        const queued = await queueOfflineReport({
          event_category: category,
          severity,
          lat,
          lon,
          city: city.trim() || 'Mumbai',
          state: state.trim() || 'Maharashtra',
          raw_text: description.trim(),
          media_urls: mediaUrls,
          device_id: deviceId,
        });

        setFeedbackToast({
          message: isHindi
            ? 'धन्यवाद! आपकी रिपोर्ट आईएमडी वेदर इंटेलिजेंस सेंटर को प्राप्त हो गई है।'
            : `Success! Observation transmitted to IMD Command Center (Report ID: ${apiReport.id}).`,
          isOffline: false,
        });

        onReportSubmitted?.({
          ...queued,
          synced: true,
          status: 'verified',
        });
      }

      // Reset Form for next fast report
      setDescription('');
      setMediaUrls([]);
      setTimeout(() => setFeedbackToast(null), 6000);
    } catch (err) {
      console.error('Submission failed:', err);
      setValidationError('Failed to transmit report. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-card p-5 sm:p-7 rounded-3xl border border-slate-200/90 shadow-xl space-y-6"
    >
      {/* Toast Feedback */}
      {feedbackToast && (
        <div
          className={`p-4 rounded-2xl border text-[13px] font-bold flex items-center justify-between shadow-sm animate-fade-in ${
            feedbackToast.isOffline
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackToast.isOffline ? (
              <WifiOff size={18} className="text-amber-600 shrink-0" />
            ) : (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            )}
            <span>{feedbackToast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackToast(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Validation Error Banner */}
      {validationError && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-[12px] font-bold flex items-center gap-2 animate-fade-in">
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* ── 1. Hazard Category Grid (7 Interactive Icon Tiles) ── */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-[13px] font-black text-stone-900 flex items-center gap-2">
            <span>1. {isHindi ? 'मौसम आपदा का प्रकार' : 'Hazard Category'}</span>
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = category === cat.id;
            const meta = CATEGORY_CONFIG[cat.id];

            return (
              <button
                type="button"
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`
                  p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-1.5
                  transition-all duration-200 cursor-pointer select-none
                  ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 shadow-md ring-2 ring-amber-500/30 font-extrabold scale-102'
                      : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/80 text-stone-700 font-semibold'
                  }
                `}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: meta?.color || '#d97706' }}
                >
                  <Icon size={18} />
                </div>
                <span className="text-[11px] leading-tight">
                  {isHindi ? cat.labelHi : cat.labelEn}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2. Severity Level (Strict 3-Tier) ── */}
      <div>
        <label className="block text-[13px] font-black text-stone-900 mb-2">
          2. {isHindi ? 'तीव्रता का स्तर' : 'Estimated Impact Severity'}
        </label>
        <div className="grid grid-cols-3 gap-3">
          {([
            { id: 'minor' as Severity, en: 'Minor', hi: 'हल्का' },
            { id: 'moderate' as Severity, en: 'Moderate', hi: 'मध्यम' },
            { id: 'severe' as Severity, en: 'Severe', hi: 'गंभीर' },
          ]).map((item) => {
            const config = SEVERITY_CONFIG[item.id];
            const isSelected = severity === item.id;

            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setSeverity(item.id)}
                className={`
                  py-2.5 px-3 rounded-2xl border text-center transition-all cursor-pointer font-bold text-[12px] flex items-center justify-center gap-2
                  ${
                    isSelected
                      ? item.id === 'severe'
                        ? 'border-red-500 bg-red-50 text-red-700 shadow-md ring-2 ring-red-400/40'
                        : item.id === 'moderate'
                        ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-md ring-2 ring-amber-400/40'
                        : 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md ring-2 ring-emerald-400/40'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                  }
                `}
              >
                <span>{config.icon}</span>
                <span>{item.en} • {item.hi}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. Instant GPS Location & Manual Inputs (Prominent & Auto-Fills City + State) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-black text-stone-900 flex items-center gap-1.5">
            <span>3. {isHindi ? 'घटना का स्थान' : 'Incident Location'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
              GPS Verified
            </span>
          </label>
          <span className="text-[11px] text-stone-400">{isHindi ? 'शहर व राज्य आवश्यक' : 'City & State Required'}</span>
        </div>

        {/* Dedicated Live Location Detection Action Card */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-stone-50 border border-amber-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <LocateFixed size={18} className={isLocating ? 'animate-spin' : 'animate-pulse'} />
            </div>
            <div>
              <div className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
                <span>{isHindi ? 'लाइव जीपीएस स्थान का पता लगाएं' : 'Auto-Detect My Live Location'}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {isHindi
                  ? 'एक क्लिक में अपना सटीक शहर, राज्य और निर्देशांक स्वतः भरें।'
                  : 'Click to automatically fill your City, State & GPS coordinates.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGetLocation}
            disabled={isLocating}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white text-[12px] font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap self-start sm:self-center"
          >
            <LocateFixed size={15} className={isLocating ? 'animate-spin' : ''} />
            <span>
              {isLocating
                ? (isHindi ? 'स्थान खोज रहे हैं...' : 'Detecting GPS...')
                : (isHindi ? '📍 मेरा लाइव स्थान दर्ज करें' : '📍 Detect Live Location')}
            </span>
          </button>
        </div>

        {/* Explicit Form Fields: City / Locality and State */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-stone-600 mb-1">
              {isHindi ? 'शहर / इलाका' : 'City / Locality'} *
            </label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-600" />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={isHindi ? 'उदा. बांद्रा, मुंबई' : 'e.g. Bandra, Mumbai'}
                className="w-full pl-10 pr-3.5 py-2.5 text-[12px] bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-900 font-medium shadow-2xs"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-600 mb-1">
              {isHindi ? 'राज्य / केंद्र शासित प्रदेश' : 'State / Union Territory'} *
            </label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder={isHindi ? 'उदा. महाराष्ट्र' : 'e.g. Maharashtra'}
              className="w-full px-3.5 py-2.5 text-[12px] bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-900 font-medium shadow-2xs"
              required
            />
          </div>
        </div>

        {locationStatus && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold flex items-center gap-2 animate-fade-in">
            <Check size={14} className="text-emerald-600 shrink-0" />
            <span>{locationStatus}</span>
          </div>
        )}
      </div>

      {/* ── 4. Media Upload Zone (Drag-and-Drop + 10MB limit) ── */}
      <div className="space-y-2">
        <label className="block text-[13px] font-black text-stone-900">
          4. {isHindi ? 'प्रमाण फोटो / वीडियो (अधिकतम 10MB)' : 'Photo / Video Evidence (Max 10MB)'}
        </label>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`
            relative p-6 rounded-2xl border-2 border-dashed text-center transition-all duration-200 flex flex-col items-center justify-center gap-2 cursor-pointer
            ${
              isDragOver
                ? 'border-amber-500 bg-amber-50/70 scale-101'
                : 'border-stone-300 hover:border-amber-400 bg-stone-50/50 hover:bg-stone-50'
            }
          `}
        >
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            capture="environment"
            onChange={handleFileInputChange}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            aria-label="Upload weather photo or video"
          />
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
            <Camera size={20} />
          </div>
          <div>
            <span className="text-[12px] font-bold text-stone-800">
              {isHindi ? 'फोटो खींचें या यहाँ खींचकर छोड़ें' : 'Take a photo or drag files here'}
            </span>
            <p className="text-xs text-stone-400 mt-0.5">
              Supports JPG, PNG, MP4 up to 10MB per file
            </p>
          </div>
        </div>

        {/* Thumbnail Previews */}
        {mediaUrls.length > 0 && (
          <div className="flex items-center gap-2.5 flex-wrap pt-1">
            {mediaUrls.map((url, idx) => (
              <div
                key={idx}
                className="relative w-16 h-16 rounded-xl overflow-hidden border border-stone-200 shadow-xs group"
              >
                <img src={url} alt="Attached evidence" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setMediaUrls((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-black transition-colors"
                  aria-label="Remove image"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 5. Description Textarea with Character Counter (Max 2,000) ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-black text-stone-900">
            5. {isHindi ? 'घटना का विवरण' : 'Ground Observation Narrative'}
          </label>
          <span
            className={`text-[11px] font-mono font-bold ${
              description.length > 1800 ? 'text-amber-600' : 'text-stone-400'
            }`}
          >
            {description.length}/{MAX_CHARS}
          </span>
        </div>

        <textarea
          rows={3}
          maxLength={MAX_CHARS}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            isHindi
              ? 'पानी का स्तर (घुटने तक/कमर तक), गिरे हुए पेड़, रुकी हुई सड़कें या बिजली पोल की स्थिति लिखें...'
              : 'Details: water depth (knee-high, vehicle stall), blocked thoroughfares, fallen trees, zero visibility...'
          }
          className="w-full p-3.5 text-[12px] bg-white border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-900 leading-relaxed font-medium shadow-2xs"
        />
      </div>

      {/* ── Submit Button ── */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="
          w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 active:scale-99
          text-white rounded-xl text-[13px] font-bold shadow-md
          transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer
        "
      >
        {isSubmitting ? (
          <span>{isHindi ? 'रिपोर्ट भेजी जा रही है...' : 'Submitting...'}</span>
        ) : (
          <>
            <Send size={16} />
            <span>
              {isHindi ? 'सबमिट' : 'Submit'}
            </span>
          </>
        )}
      </button>
    </form>
  );
}
