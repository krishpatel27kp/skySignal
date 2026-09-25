/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Admin Login Modal
   Glassmorphic authentication modal with 1-click demo autofill
   Persists JWT to localStorage & syncs with AuthContext
   ═══════════════════════════════════════════════════════ */

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Lock,
  Mail,
  Key,
  ShieldCheck,
  X,
  CheckCircle2,
  Sparkles,
  Eye,
  EyeOff,
  LogOut,
} from 'lucide-react';

interface AdminLoginModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function AdminLoginModal({ isOpen, onClose }: AdminLoginModalProps) {
  const { isAdmin, user, login, logout, isLoginModalOpen, closeLoginModal } = useAuth();

  // Use props if provided, otherwise fallback to AuthContext state
  const showModal = isOpen !== undefined ? isOpen : isLoginModalOpen;
  const handleClose = onClose || closeLoginModal;

  const [email, setEmail] = useState('analyst@imd.gov.in');
  const [password, setPassword] = useState('Analyst@123');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationToast, setConfirmationToast] = useState<string | null>(null);

  if (!showModal) return null;

  const handleAutofillDemo = () => {
    setEmail('analyst@imd.gov.in');
    setPassword('Analyst@123');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setIsSubmitting(true);
    try {
      await login(email, password);
      setConfirmationToast('Analyst authenticated! Session token stored. Command Center active.');
      setTimeout(() => {
        setConfirmationToast(null);
        handleClose();
      }, 1200);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    setConfirmationToast('Session terminated. Switched to public observer mode.');
    setTimeout(() => {
      setConfirmationToast(null);
      handleClose();
    }, 1000);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Analyst Authentication"
    >
      <div
        className="
          relative w-full max-w-md
          bg-white/95 backdrop-blur-2xl rounded-3xl
          border border-slate-200/90 shadow-2xl p-6 sm:p-8 space-y-6
          animate-fade-in-scale
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 text-white flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Lock size={22} />
          </div>
          <div>
            <h3 className="text-[18px] font-extrabold text-slate-900 tracking-tight">
              IMD Analyst Command Auth
            </h3>
            <p className="text-[12px] text-slate-500 font-medium">
              National Weather Intelligence Platform (SIH26069)
            </p>
          </div>
        </div>

        {/* Confirmation Toast Banner */}
        {confirmationToast && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{confirmationToast}</span>
          </div>
        )}

        {/* Already Logged In State */}
        {isAdmin && user ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider">
                  Active Session
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700">
                  AUTHENTICATED
                </span>
              </div>
              <div className="text-[15px] font-bold text-slate-900">{user.name}</div>
              <div className="text-[12px] text-slate-600">{user.email}</div>
              <div className="text-[11px] font-medium text-slate-400">
                {user.role} • {user.badge}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-[13px] font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut size={16} />
              <span>Terminate Session (Logout)</span>
            </button>
          </div>
        ) : (
          <>
            {/* 1-Click Autofill Button */}
            <div className="p-3 rounded-2xl bg-sky-50/60 border border-sky-200/60 flex items-center justify-between gap-3">
              <div>
                <div className="text-[12px] font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-sky-600" />
                  <span>Evaluation Demo Credentials</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  analyst@imd.gov.in / Analyst@123
                </div>
              </div>
              <button
                type="button"
                onClick={handleAutofillDemo}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-[11px] font-bold transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                Autofill Demo Analyst
              </button>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">
                  Official IMD Email
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="analyst@imd.gov.in"
                    className="w-full pl-10 pr-3.5 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">
                  Analyst Password
                </label>
                <div className="relative">
                  <Key
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-[13px] font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isSubmitting ? (
                  <span>Signing In...</span>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Authorize Analyst Access</span>
                  </>
                )}
              </button>
            </form>

            {/* Regulatory Footer Notice */}
            <div className="text-center text-[10px] text-slate-400 leading-relaxed border-t border-slate-100 pt-3">
              Protected meteorological command center. All authorization events are cryptographically recorded in the audit log.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
