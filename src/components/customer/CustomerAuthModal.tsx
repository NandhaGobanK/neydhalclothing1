import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { CustomerUser } from '../../types/store';
import {
  X,
  User,
  Mail,
  Lock,
  Phone,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  CheckCircle,
  AlertCircle,
  LogIn,
  UserCheck,
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
  const { customerLogin, customerLoginWithGoogle, customerRegister, settings } = useStore();
  const themeColors = getThemeColors(settings.theme, settings.themeMode);

  const [mode, setMode] = useState<'signin' | 'register'>(initialMode);
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');

  // Registration fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleCustomerSignIn = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const res = await customerLoginWithGoogle();
      if (res.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(res.error || 'Google sign-in could not be completed.');
      }
    } catch (err: any) {
      setError(err?.message || 'Google sign-in error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!emailOrPhone.trim()) {
      setError('Please enter your mobile phone number or email.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await customerLogin(emailOrPhone.trim(), password);
      if (res.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(res.error || 'Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Please provide your full name.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length < 10) {
      setError('Please provide a valid 10-digit mobile number.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await customerRegister({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: cleanPhone,
        password: regPassword.trim() || undefined,
        authMethod: 'password',
      });
      if (res.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(res.error || 'Registration failed. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoCustomer = async (demoName: string, demoPhone: string, demoEmail: string) => {
    setIsSubmitting(true);
    setError('');
    try {
      const res = await customerLogin(demoPhone);
      if (res.success) {
        onSuccess?.();
        onClose();
      } else {
        // Register demo customer if not existing
        const regRes = await customerRegister({
          name: demoName,
          phone: demoPhone,
          email: demoEmail,
          authMethod: 'password',
        });
        if (regRes.success) {
          onSuccess?.();
          onClose();
        } else {
          setError(regRes.error || 'Demo sign in failed.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Demo login failed');
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
            {mode === 'signin' ? 'Customer Sign In' : 'Create Customer Account'}
          </h2>
          <p className="text-xs text-neutral-300 mt-1">
            {mode === 'signin'
              ? 'Access your private orders, saved addresses & concierge chat.'
              : 'Join to track orders privately, save addresses & enjoy bespoke perks.'}
          </p>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-black/30 p-1 rounded-xl mt-4 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                mode === 'signin'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                mode === 'register'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}
          {/* Primary Action: Google Authentication */}
          <div className="mb-4 space-y-2">
            <button
              type="button"
              onClick={handleGoogleCustomerSignIn}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 font-bold text-xs flex items-center justify-center gap-2.5 shadow-xs hover:shadow transition cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
            <div className="flex items-center gap-2 text-[10px] text-neutral-400 uppercase tracking-wider font-semibold justify-center">
              <span className="w-12 h-px bg-neutral-200" />
              <span>Or with phone / email</span>
              <span className="w-12 h-px bg-neutral-200" />
            </div>
          </div>

          {mode === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Mobile Number or Email
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={emailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    placeholder="e.g. 9876543210 or yourname@gmail.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-rose-900/30 focus:border-rose-900 transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                    Password (Optional)
                  </label>
                  <span className="text-[10px] text-neutral-500">Fast OTP / Direct Login</span>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password (optional)"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-rose-900/30 focus:border-rose-900 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-900 to-rose-950 hover:from-rose-800 hover:to-rose-900 text-white font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In to My Account</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Full Customer Name *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Priya Ramanathan"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-rose-900/30 focus:border-rose-900 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Mobile Number (10 Digits) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-rose-900/30 focus:border-rose-900 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Email Address (Optional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. priya@example.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-rose-900/30 focus:border-rose-900 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Create Password (Optional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Set account password"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-rose-900/30 focus:border-rose-900 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-neutral-950 font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {isSubmitting ? (
                  <span>Creating Account...</span>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Create Customer Account</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Instant 1-Click Demo Customer Access for Rapid Testing */}
          <div className="mt-5 pt-4 border-t border-neutral-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2 text-center">
              Instant 1-Click Demo Accounts (Fast Testing)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  handleQuickDemoCustomer(
                    'Priya Ramanathan',
                    '9876543210',
                    'priya.saree@example.com'
                  )
                }
                className="px-2.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-left transition text-neutral-800 border border-neutral-200/80 cursor-pointer"
              >
                <div className="text-[11px] font-bold text-rose-950 truncate">Priya R.</div>
                <div className="text-[9px] text-neutral-500 font-mono">9876543210</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleQuickDemoCustomer(
                    'Ananya Sharma',
                    '9123456780',
                    'ananya.client@example.com'
                  )
                }
                className="px-2.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-left transition text-neutral-800 border border-neutral-200/80 cursor-pointer"
              >
                <div className="text-[11px] font-bold text-rose-950 truncate">Ananya S.</div>
                <div className="text-[9px] text-neutral-500 font-mono">9123456780</div>
              </button>
            </div>
          </div>

          {/* Privacy Guarantee Pill */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-neutral-500 text-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Complete Customer Privacy · Data Strictly Isolated to You</span>
          </div>
        </div>
      </div>
    </div>
  );
};
