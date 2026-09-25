/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Internationalization (i18n)
   Bilingual support: English (en) + Hindi (hi)
   ═══════════════════════════════════════════════════════ */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // ── App ──
      app: {
        name: 'SkySignal',
        version: 'v2.0 — SIH26069',
        tagline: 'Weather Intelligence Platform',
      },

      // ── Navigation ──
      nav: {
        overview: 'Overview',
        eventExplorer: 'Event Explorer',
        verificationQueue: 'Verification Queue',
        duplicateReview: 'Duplicate Review',
        analytics: 'Analytics',
        dataSources: 'Data Sources',
        auditLog: 'Audit Log',
        citizenReports: 'Citizen Reports',
        notifications: 'Notifications',
        settings: 'Settings',
        commandCenter: 'Command Center',
      },

      // ── Weather Categories ──
      category: {
        rainfall: 'Rainfall',
        thunderstorm: 'Thunderstorm',
        flooding: 'Flooding',
        heatwave: 'Heatwave',
        fog: 'Fog',
        'dust storm': 'Dust Storm',
        'strong wind': 'Strong Wind',
      },

      // ── Severity Levels ──
      severity: {
        minor: 'Minor',
        moderate: 'Moderate',
        severe: 'Severe',
      },

      // ── Event Status ──
      status: {
        detected: 'Detected',
        emerging: 'Emerging',
        confirmed: 'Confirmed',
        active: 'Active',
        declining: 'Declining',
        resolved: 'Resolved',
      },

      // ── Dashboard ──
      dashboard: {
        situationOverview: 'Situation Overview',
        subtitle: 'National weather intelligence dashboard — Real-time monitoring across all data sources',
        lastUpdated: 'Last updated',
        refresh: 'Refresh',
        activeEvents: 'Active Events',
        reportsToday: 'Reports Today',
        verified: 'Verified',
        severeAlerts: 'Severe Alerts',
        vsYesterday: 'vs yesterday',
        accuracy: 'accuracy',
        liveGeoRadar: 'Live Geo-Radar',
        live: 'Live',
        priorityWatch: 'Priority Watch',
        alerts: 'alerts',
        viewAllAlerts: 'View all alerts',
        activeEventsTable: 'Active Events',
        viewAll: 'View all',
        reportVolume: '24-Hour Report Volume',
        allReports: 'All Reports',
        sourceReliability: 'Source Reliability',
        eventTypes: 'Event Types',
        activeEventsCount: 'active events',
        confidence: 'conf.',
      },

      // ── Citizen Report Form ──
      citizenForm: {
        title: 'Report Weather Observation',
        heroTitle: 'Your observation makes a difference',
        heroSubtitle: 'Help IMD monitor real-time weather across India',
        category: 'Weather Category',
        selectCategory: 'Select a category...',
        severity: 'Severity Level',
        selectSeverity: 'How severe is this?',
        location: 'Location',
        locationPlaceholder: 'Enter location or use GPS',
        useMyLocation: 'Use my location',
        description: 'Description',
        descriptionPlaceholder: 'Describe what you are observing (max 2,000 characters)...',
        mediaUpload: 'Attach Photo or Video',
        mediaHint: 'Drag & drop or click — up to 10 MB',
        submit: 'Submit Report',
        submitting: 'Submitting...',
        submitSuccess: 'Report submitted successfully!',
        submitError: 'Failed to submit. Please try again.',
        myReports: 'My Reports',
        language: 'Language',
      },

      // ── Verification ──
      verification: {
        approveSelected: 'Approve selected',
        rejectSelected: 'Reject selected',
        evidence: 'Evidence',
        approve: 'Approve',
        reject: 'Reject',
        allCaughtUp: "You're all caught up!",
        confidence: 'Confidence',
      },

      // ── Common ──
      common: {
        search: 'Search events, locations, reports...',
        sseLive: 'SSE Live',
        comingSoon: 'Coming Soon',
        underDevelopment: 'This section is under development and will be available in the next build.',
        zoomIn: 'Zoom in',
        zoomOut: 'Zoom out',
        resetView: 'Reset view',
        fullScreen: 'Full screen',
      },
    },
  },

  hi: {
    translation: {
      // ── App ──
      app: {
        name: 'स्काईसिग्नल',
        version: 'v2.0 — SIH26069',
        tagline: 'मौसम खुफिया मंच',
      },

      // ── Navigation ──
      nav: {
        overview: 'अवलोकन',
        eventExplorer: 'घटना एक्सप्लोरर',
        verificationQueue: 'सत्यापन कतार',
        duplicateReview: 'डुप्लिकेट समीक्षा',
        analytics: 'विश्लेषण',
        dataSources: 'डेटा स्रोत',
        auditLog: 'ऑडिट लॉग',
        citizenReports: 'नागरिक रिपोर्ट',
        notifications: 'सूचनाएं',
        settings: 'सेटिंग्स',
        commandCenter: 'कमांड सेंटर',
      },

      // ── Weather Categories ──
      category: {
        rainfall: 'वर्षा',
        thunderstorm: 'तड़ित झंझा',
        flooding: 'बाढ़',
        heatwave: 'लू',
        fog: 'कोहरा',
        'dust storm': 'धूल भरी आंधी',
        'strong wind': 'तेज़ हवा',
      },

      // ── Severity Levels ──
      severity: {
        minor: 'सामान्य',
        moderate: 'मध्यम',
        severe: 'गंभीर',
      },

      // ── Event Status ──
      status: {
        detected: 'पहचाना गया',
        emerging: 'उभर रहा है',
        confirmed: 'पुष्टि हुई',
        active: 'सक्रिय',
        declining: 'कम हो रहा है',
        resolved: 'समाप्त',
      },

      // ── Dashboard ──
      dashboard: {
        situationOverview: 'स्थिति अवलोकन',
        subtitle: 'राष्ट्रीय मौसम खुफिया डैशबोर्ड — सभी डेटा स्रोतों में वास्तविक समय निगरानी',
        lastUpdated: 'अंतिम अपडेट',
        refresh: 'रिफ्रेश',
        activeEvents: 'सक्रिय घटनाएं',
        reportsToday: 'आज की रिपोर्ट',
        verified: 'सत्यापित',
        severeAlerts: 'गंभीर अलर्ट',
        vsYesterday: 'कल से',
        accuracy: 'सटीकता',
        liveGeoRadar: 'लाइव जियो-रडार',
        live: 'लाइव',
        priorityWatch: 'प्राथमिकता निगरानी',
        alerts: 'अलर्ट',
        viewAllAlerts: 'सभी अलर्ट देखें',
        activeEventsTable: 'सक्रिय घटनाएं',
        viewAll: 'सभी देखें',
        reportVolume: '24 घंटे की रिपोर्ट मात्रा',
        allReports: 'सभी रिपोर्ट',
        sourceReliability: 'स्रोत विश्वसनीयता',
        eventTypes: 'घटना प्रकार',
        activeEventsCount: 'सक्रिय घटनाएं',
        confidence: 'विश्वास',
      },

      // ── Citizen Report Form ──
      citizenForm: {
        title: 'मौसम अवलोकन रिपोर्ट करें',
        heroTitle: 'आपका अवलोकन महत्वपूर्ण है',
        heroSubtitle: 'भारत भर में वास्तविक समय मौसम निगरानी में IMD की मदद करें',
        category: 'मौसम श्रेणी',
        selectCategory: 'श्रेणी चुनें...',
        severity: 'गंभीरता स्तर',
        selectSeverity: 'यह कितना गंभीर है?',
        location: 'स्थान',
        locationPlaceholder: 'स्थान दर्ज करें या GPS उपयोग करें',
        useMyLocation: 'मेरा स्थान',
        description: 'विवरण',
        descriptionPlaceholder: 'आप क्या देख रहे हैं उसका वर्णन करें (अधिकतम 2,000 अक्षर)...',
        mediaUpload: 'फोटो या वीडियो संलग्न करें',
        mediaHint: 'खींचें और छोड़ें या क्लिक करें — 10 MB तक',
        submit: 'रिपोर्ट जमा करें',
        submitting: 'जमा हो रहा है...',
        submitSuccess: 'रिपोर्ट सफलतापूर्वक जमा!',
        submitError: 'जमा करने में विफल। कृपया पुनः प्रयास करें।',
        myReports: 'मेरी रिपोर्ट',
        language: 'भाषा',
      },

      // ── Verification ──
      verification: {
        approveSelected: 'चयनित को स्वीकार करें',
        rejectSelected: 'चयनित को अस्वीकार करें',
        evidence: 'साक्ष्य',
        approve: 'स्वीकार करें',
        reject: 'अस्वीकार करें',
        allCaughtUp: 'सब अपडेट हो गया!',
        confidence: 'विश्वसनीयता',
      },

      // ── Common ──
      common: {
        search: 'घटनाएं, स्थान, रिपोर्ट खोजें...',
        sseLive: 'SSE लाइव',
        comingSoon: 'जल्द आ रहा है',
        underDevelopment: 'यह अनुभाग विकास में है और अगले निर्माण में उपलब्ध होगा।',
        zoomIn: 'ज़ूम इन',
        zoomOut: 'ज़ूम आउट',
        resetView: 'दृश्य रीसेट',
        fullScreen: 'पूर्ण स्क्रीन',
      },
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
