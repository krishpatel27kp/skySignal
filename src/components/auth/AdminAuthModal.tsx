/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Admin & Analyst Auth Modal
   Glassmorphic authentication modal with 1-click demo autofills
   ═══════════════════════════════════════════════════════ */

import { useState } from 'react';
import {
  Lock,
  Mail,
  Key,
  ShieldCheck,
  X,
  CheckCircle2,
} from 'lucide-react';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: { email: string; name: string; role: string } | null;
  onLoginSuccess: (user: { email: string; name: string; role: string }) => void;
}

const DEMO_ACCOUNTS = [
  {
    name: 'Dr. Rajesh Sharma',
    email: 'dr.sharma@imd.gov.in',
    role: 'Senior Duty Forecaster',
    badge: 'National Command Center',
    password: 'password123',
  },
  {
    name: 'Priya Narang',
    email: 'analyst.delhi@imd.gov.in',
    role: 'Triage Specialist',
    badge: 'Doppler Radar Unit',
    password: 'password123',
  },
  {
    name: 'Vikram Joshi',
    email: 'v.joshi@ndma.gov.in',
    role: 'Disaster Coordinator',
    badge: 'NDMA Emergency Liaison',
    password: 'password123',
  },
];

export default function AdminAuthModal({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
}: AdminAuthModalProps) {
  const [email, setEmail] = useState(currentUser?.email || 'dr.sharma@imd.gov.in');
  const [password, setPassword] = useState('password123');
  const [role, setRole] = useState(currentUser?.role || 'Senior Duty Forecaster');
  const [name, setName] = useState(currentUser?.name || 'Dr. Rajesh Sharma');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleAutofill = (acc: (typeof DEMO_ACCOUNTS)[0]) => {
    setEmail(acc.email);
    setName(acc.name);
    setRole(acc.role);
    setPassword(acc.password);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess(true);
      setTimeout(() => {
        onLoginSuccess({ email, name, role });
        setSuccess(false);
        onClose();
      }, 700);
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-8 space-y-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="IMD Secure Analyst Login"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-sky-600 text-white shadow-md">
            <Lock size={20} />
          </div>
          <div>
            <h3 className="text-[17px] font-extrabold text-slate-900">
              IMD Analyst Authentication
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              National Weather Intelligence Command (SIH26069)
            </p>
          </div>
        </div>

        {/* Demo 1-Click Autofill Profiles */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            Instant Demo Profiles
          </label>
          <div className="space-y-1.5">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                type="button"
                key={acc.email}
                onClick={() => handleAutofill(acc)}
                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-[11px] transition-all cursor-pointer ${
                  email === acc.email
                    ? 'border-sky-500 bg-sky-50 text-sky-900 font-semibold ring-1 ring-sky-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-slate-800">{acc.name}</div>
                  <div className="text-[10px] text-slate-400">{acc.role} · {acc.badge}</div>
                </div>
                <span className="text-[10px] font-bold text-sky-600">Autofill &rarr;</span>
              </button>
            ))}
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Official Gov Email Address
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-[12px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Security Token / Password
            </label>
            <div className="relative">
              <Key size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-[12px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800"
                required
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-[13px] font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {success ? (
              <>
                <CheckCircle2 size={16} className="text-emerald-300" />
                <span>Authenticated! Entering Command Center...</span>
              </>
            ) : isSubmitting ? (
              <span>Verifying PKI Credentials...</span>
            ) : (
              <>
                <ShieldCheck size={16} />
                <span>Enter Analyst Command Center</span>
              </>
            )}
          </button>
        </form>

        {/* Security Notice */}
        <div className="text-center text-[10px] text-slate-400">
          Protected under IMD National Weather Intelligence Protocol. Session activity logged to immutable audit ledger.
        </div>
      </div>
    </div>
  );
}
