import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  X,
  User,
  Phone,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  LogIn,
  UserPlus,
  ArrowRight,
} from 'lucide-react';
import { getThemeColors } from '../../utils/theme';

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'signin' | 'register';
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'signin',
}) => {
  const { customerLoginWithGoogle, settings } = useStore();
  const themeColors = getThemeColors(settings.theme, settings.themeMode);

  const [mode, setMode] = useState<'signin' | 'register'>(initialMode);
  const [unregisteredNotice, setUnregisteredNotice] = useState<{ email: string; displayName?: string } | null>(null);

  // Registration fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setError('');
    setUnregisteredNotice(null);
    setIsSubmitting(true);
    try {
      const res = await customerLoginWithGoogle({ mode: 'signin' });
      if (res.success) {
        onSuccess?.();
        onClose();
      } else {
        if (res.isNotRegistered) {
          setUnregisteredNotice({ email: res.email || '', displayName: res.displayName });
          if (res.displayName) setName(res.displayName);
        }
        setError(res.error || 'Google sign-in could not be completed.');
      }
    } catch (err: any) {
      setError(err?.message || 'Google sign-in error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUnregisteredNotice(null);
    setIsSubmitting(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      const res = await customerLoginWithGoogle({
        mode: 'register',
        phone: cleanPhone,
        name: name.trim(),
      });
      if (res.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(res.error || 'Registration failed with Google. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in zoom-in-95 duration-200">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-rose-950 via-neutral-900 to-rose-900 text-white p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-2 text-amber-300">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs uppercase tracking-widest font-bold">
              {settings.boutiqueName} Privé
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-white">
            {mode === 'signin' ? 'Patron Sign In' : 'Register Patron Account'}
          </h2>
          <p className="text-xs text-neutral-300 mt-1">
            {mode === 'signin'
              ? 'Access your private orders, saved addresses & concierge chat.'
              : 'Join with Google to track orders privately & enjoy bespoke atelier privileges.'}
          </p>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-black/30 p-1 rounded-xl mt-4 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
                setUnregisteredNotice(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'signin'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
                setUnregisteredNotice(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'register'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register with Google</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {unregisteredNotice && (
            <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Registration Required</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    No patron profile found for <strong>{unregisteredNotice.email}</strong>. Please register with Google first.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
              >
                <span>Register with this Google Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {error && !unregisteredNotice && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'signin' ? (
            <div className="space-y-4 pt-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-2xl border-2 border-neutral-300 hover:border-neutral-400 bg-white hover:bg-neutral-50 text-neutral-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-xs hover:shadow transition cursor-pointer disabled:opacity-50 active:scale-98"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>{isSubmitting ? 'Authenticating...' : 'Sign In with Google'}</span>
              </button>

              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-center space-y-1">
                <p className="text-[11px] text-amber-900 font-bold">
                  Verified Patron Authentication
                </p>
                <p className="text-[10px] text-neutral-500">
                  Verifies against registered patrons in our private database before logging in.
                </p>
              </div>

              <div className="text-center pt-2">
                <p className="text-xs text-neutral-500">
                  New patron to our boutique?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError('');
                      setUnregisteredNotice(null);
                    }}
                    className="text-rose-900 hover:text-rose-950 font-bold underline cursor-pointer"
                  >
                    Register with Google
                  </button>
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleGoogleRegister} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Full Name (Optional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Will use Google profile name if blank"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-rose-900/30 focus:border-rose-900 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Mobile Number (Optional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit number for order SMS/WhatsApp"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-rose-900/30 focus:border-rose-900 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-900 to-rose-950 hover:from-rose-800 hover:to-rose-900 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50 active:scale-98 mt-2"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>{isSubmitting ? 'Creating Account...' : 'Register Patron with Google'}</span>
              </button>

              <div className="text-center pt-2">
                <p className="text-xs text-neutral-500">
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setError('');
                      setUnregisteredNotice(null);
                    }}
                    className="text-rose-900 hover:text-rose-950 font-bold underline cursor-pointer"
                  >
                    Sign In with Google
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* Privacy Guarantee Pill */}
          <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center justify-center gap-1.5 text-[10px] text-neutral-500 text-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Customer Data Isolated in Private Database</span>
          </div>
        </div>
      </div>
    </div>
  );
};
