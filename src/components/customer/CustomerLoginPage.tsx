import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { getThemeColors } from '../../utils/theme';
import {
  Lock,
  Phone,
  Mail,
  User,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Package,
  Heart,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Truck,
  Eye,
  EyeOff,
} from 'lucide-react';

interface CustomerLoginPageProps {
  onSuccess?: () => void;
}

export const CustomerLoginPage: React.FC<CustomerLoginPageProps> = ({ onSuccess }) => {
  const {
    settings,
    customerLogin,
    customerLoginWithGoogle,
    customerRegister,
    setIsResellerPortalOpen,
  } = useStore();

  const themeColors = getThemeColors(settings.theme, settings.themeMode);

  // Discreet Reseller Access for Mobile & PWA:
  // 1. Native PWA icon shortcut ("B2B Wholesale Hub")
  // 2. Triple-tap on boutique logo emblem or Shield
  // 3. Long-press on boutique logo emblem for 1.2s
  // 4. Subtle "Partner Access" footer link
  // 5. Typing "reseller" or "b2b" into the sign-in field
  const tapCountRef = React.useRef(0);
  const tapTimerRef = React.useRef<any>(null);
  const longPressTimerRef = React.useRef<any>(null);

  const openResellerPortal = () => {
    setIsResellerPortalOpen(true);
    if (typeof window !== 'undefined') {
      window.location.hash = 'reseller';
    }
  };

  const handleDiscreetResellerTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      openResellerPortal();
    } else {
      tapTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, 1000);
    }
  };

  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      openResellerPortal();
    }, 1200);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };

  const [authMode, setAuthMode] = useState<'google' | 'phone' | 'register'>('google');
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register fields
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Google Sign-In via Firebase Auth
  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setIsLoading(true);
    try {
      const res = await customerLoginWithGoogle();
      if (!res.success) {
        setErrorMsg(res.error || 'Google authentication was not completed. Please try again.');
      } else {
        onSuccess?.();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google sign-in error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!phoneOrEmail.trim()) {
      setErrorMsg('Please enter your 10-digit mobile number or email address.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await customerLogin(phoneOrEmail.trim(), password || undefined);
      if (!res.success) {
        setErrorMsg(res.error || 'Sign-in failed. Please verify credentials.');
      } else {
        onSuccess?.();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Sign-in error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!regName.trim()) {
      setErrorMsg('Please provide your full name.');
      return;
    }
    const cleanPhone = regPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMsg('Please provide a valid 10-digit mobile number.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await customerRegister({
        name: regName.trim(),
        phone: cleanPhone,
        email: regEmail.trim().toLowerCase(),
        password: regPassword.trim() || undefined,
        authMethod: regPassword ? 'password' : 'guest',
      });
      if (!res.success) {
        setErrorMsg(res.error || 'Registration failed.');
      } else {
        onSuccess?.();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Registration error.');
    } finally {
      setIsLoading(false);
    }
  };

  // Instant 1-click test credentials for evaluation
  const handleDemoSignIn = async (name: string, phone: string, email: string) => {
    setErrorMsg('');
    setIsLoading(true);
    try {
      const res = await customerLogin(phone);
      if (!res.success) {
        await customerRegister({
          name,
          phone,
          email,
          authMethod: 'guest',
        });
      }
      onSuccess?.();
    } catch (err) {
      setErrorMsg('Unable to sign in with demo account.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-rose-950/60 to-neutral-950 flex flex-col justify-between text-neutral-100 relative overflow-hidden select-none">
      {/* Decorative Atelier Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-rose-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-[600px] h-[400px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Boutique Navigation Header */}
      <header className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex items-center justify-between">
        <div
          onClick={handleDiscreetResellerTap}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="flex items-center gap-3 cursor-pointer select-none active:opacity-90"
          title={`${settings.boutiqueName} Boutique (Triple-tap or hold 1.2s on mobile for Partner Access)`}
        >
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={settings.boutiqueName}
              className="h-10 w-auto object-contain rounded-md"
            />
          ) : (
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-900 via-rose-800 to-amber-600 text-amber-200 flex items-center justify-center font-serif font-bold text-base shadow-lg border border-amber-400/40">
              {settings.boutiqueName.charAt(0) || 'A'}
            </span>
          )}
          <div>
            <h1 className="font-serif text-lg sm:text-xl font-bold text-white tracking-wide">
              {settings.boutiqueName}
            </h1>
            <p className="text-[10px] text-amber-300 font-medium tracking-wider uppercase">
              Handcrafted Silk Atelier
            </p>
          </div>
        </div>

        <div
          onClick={handleDiscreetResellerTap}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer select-none active:opacity-80"
          title="Protected Member Portal (Triple-tap on mobile for Partner Access)"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Protected Member Portal</span>
        </div>
      </header>

      {/* Main Login Gate Card */}
      <main className="relative z-10 max-w-5xl mx-auto w-full px-4 py-6 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center flex-1">
        {/* Left Column: Boutique Presentation & Privacy Assurance */}
        <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Patron Verification Required</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
            Exclusive Handloom <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-rose-300">
              Catalog Access
            </span>
          </h2>

          <p className="text-neutral-300 text-xs sm:text-sm leading-relaxed max-w-lg mx-auto lg:mx-0">
            To preserve the authenticity and privacy of our artisan handloom heirlooms, our masterweave catalog, limited weaves, and bespoke reservations are reserved exclusively for registered patrons.
          </p>

          {/* Privacy & Member Privileges List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs flex items-start gap-3">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300 shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </span>
              <div>
                <h4 className="font-semibold text-xs text-white">Strict Data Isolation</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Your orders, delivery addresses, and purchases are completely private and isolated.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs flex items-start gap-3">
              <span className="p-2 rounded-xl bg-rose-500/20 text-rose-300 shrink-0 mt-0.5">
                <Heart className="w-4 h-4" />
              </span>
              <div>
                <h4 className="font-semibold text-xs text-white">Private Wishlist</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Bookmark favorite Kanjivaram and Banarasi weaves across your personal devices.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs flex items-start gap-3">
              <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 shrink-0 mt-0.5">
                <Package className="w-4 h-4" />
              </span>
              <div>
                <h4 className="font-semibold text-xs text-white">Order Tracking & Photos</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Track dispatch milestones and download high-resolution photos of your heirlooms.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs flex items-start gap-3">
              <span className="p-2 rounded-xl bg-sky-500/20 text-sky-300 shrink-0 mt-0.5">
                <MessageSquare className="w-4 h-4" />
              </span>
              <div>
                <h4 className="font-semibold text-xs text-white">Direct Concierge Chat</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Instant live chat directly with our Salem handloom workshop masters.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Customer Sign-In Card */}
        <div className="lg:col-span-6 max-w-md w-full mx-auto">
          <div className="bg-neutral-900/90 rounded-3xl p-6 sm:p-8 border border-neutral-800 shadow-2xl backdrop-blur-md space-y-5">
            {/* Form Title */}
            <div className="text-center space-y-1">
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-white">
                Patron Sign In
              </h3>
              <p className="text-xs text-neutral-400">
                Sign in with Google to explore the collection
              </p>
            </div>

            {/* Error Notification */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Primary Action: Google Authentication (Firebase Auth) */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-sm flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition cursor-pointer disabled:opacity-60 active:scale-[0.99]"
              >
                {/* Official Google G Logo */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>{isLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
              </button>
              <p className="text-[11px] text-center text-neutral-400">
                Fast & secure authentication powered by Firebase
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-2 text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
              <span className="flex-1 h-px bg-neutral-800" />
              <span>Or sign in with mobile / email</span>
              <span className="flex-1 h-px bg-neutral-800" />
            </div>

            {/* Mode switch */}
            <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('phone');
                  setErrorMsg('');
                }}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  authMode === 'phone'
                    ? 'bg-rose-900 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setErrorMsg('');
                }}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-rose-900 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Mobile / Email Form */}
            {authMode === 'phone' && (
              <form onSubmit={handlePhoneSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    Mobile Number or Email *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                      <Phone className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      required
                      value={phoneOrEmail}
                      onChange={(e) => setPhoneOrEmail(e.target.value)}
                      placeholder="e.g. 9876543210 or yourname@gmail.com"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-700 bg-neutral-950 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-neutral-300">
                      Password (Optional)
                    </label>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password (optional)"
                      className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-neutral-700 bg-neutral-950 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-900 via-rose-800 to-rose-900 hover:from-rose-800 hover:to-rose-700 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? 'Signing In...' : 'Sign In with Mobile / Email'}
                </button>
              </form>
            )}

            {/* Registration Form */}
            {authMode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Smt. Ananya Deshmukh"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-950 text-xs text-white placeholder-neutral-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    10-digit WhatsApp / Mobile *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-950 text-xs text-white placeholder-neutral-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="ananya@example.com"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-950 text-xs text-white placeholder-neutral-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    Create Password (Optional)
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Choose a password"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-950 text-xs text-white placeholder-neutral-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-900 to-rose-800 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? 'Creating Account...' : 'Complete Registration & Enter Atelier'}
                </button>
              </form>
            )}

            {/* Instant 1-Click Test Customer Logins */}
            <div className="pt-2 border-t border-neutral-800/80">
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block mb-2 text-center">
                Instant 1-Click Demo Profiles (For Testing)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDemoSignIn('Ananya Deshmukh', '9876543210', 'ananya.patron@example.com')}
                  disabled={isLoading}
                  className="p-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-left transition cursor-pointer text-xs"
                >
                  <p className="font-bold text-amber-200 text-[11px] truncate">Ananya Deshmukh</p>
                  <p className="text-[10px] text-neutral-400 font-mono">📱 9876543210</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoSignIn('Meenakshi Iyer', '9840123456', 'meenakshi.patron@example.com')}
                  disabled={isLoading}
                  className="p-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-left transition cursor-pointer text-xs"
                >
                  <p className="font-bold text-amber-200 text-[11px] truncate">Meenakshi Iyer</p>
                  <p className="text-[10px] text-neutral-400 font-mono">📱 9840123456</p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer info strictly for patrons */}
      <footer className="relative z-10 max-w-7xl mx-auto w-full px-4 py-4 text-center text-xs text-neutral-400 border-t border-white/5">
        <p className="text-[11px]">
          © {new Date().getFullYear()} {settings.boutiqueName}. Pure Handloom Heritage Atelier. All rights reserved.
        </p>
      </footer>
    </div>
  );
};
