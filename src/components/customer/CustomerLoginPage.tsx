import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  Lock,
  ShieldCheck,
  Sparkles,
  Package,
  Heart,
  MessageSquare,
  AlertCircle,
  Store,
  User,
  Phone,
  ArrowRight,
  UserPlus,
  LogIn,
} from 'lucide-react';

interface CustomerLoginPageProps {
  onSuccess?: () => void;
  onOpenAdmin?: () => void;
}

export const CustomerLoginPage: React.FC<CustomerLoginPageProps> = ({ onSuccess, onOpenAdmin }) => {
  const {
    settings,
    customerLoginWithGoogle,
    setIsResellerPortalOpen,
  } = useStore();

  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [errorMsg, setErrorMsg] = useState('');
  const [unregisteredNotice, setUnregisteredNotice] = useState<{ email: string; displayName?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Optional registration inputs
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');

  // Secret B2B Reseller Portal Trigger
  const openResellerPortal = () => {
    setIsResellerPortalOpen(true);
    if (typeof window !== 'undefined') {
      window.location.hash = 'reseller';
    }
  };

  // Secret Admin / Staff Login Trigger on Customer Login Page (Shifted from Storefront)
  const adminClickCountRef = useRef(0);
  const adminClickTimerRef = useRef<any>(null);

  const triggerSecretAdminLogin = () => {
    adminClickCountRef.current += 1;
    if (adminClickTimerRef.current) clearTimeout(adminClickTimerRef.current);

    if (adminClickCountRef.current >= 3) {
      adminClickCountRef.current = 0;
      if (onOpenAdmin) {
        onOpenAdmin();
      }
    } else {
      adminClickTimerRef.current = setTimeout(() => {
        adminClickCountRef.current = 0;
      }, 1200);
    }
  };

  // Keyboard shortcut listener on Customer Login Page (Ctrl+Shift+A or Cmd+Shift+A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        onOpenAdmin?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenAdmin]);

  // Google Sign-In: checks existing registration in Firestore customers collection
  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setUnregisteredNotice(null);
    setIsLoading(true);
    try {
      const res = await customerLoginWithGoogle({ mode: 'signin' });
      if (!res.success) {
        if (res.isNotRegistered) {
          setUnregisteredNotice({
            email: res.email || '',
            displayName: res.displayName,
          });
          if (res.displayName) setRegName(res.displayName);
        }
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

  // Google Registration: authenticates with Google and creates customer record in Firestore customers collection
  const handleGoogleRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setUnregisteredNotice(null);
    setIsLoading(true);
    try {
      const cleanPhone = regPhone.replace(/\D/g, '').slice(-10);
      const res = await customerLoginWithGoogle({
        mode: 'register',
        phone: cleanPhone,
        name: regName.trim(),
      });
      if (!res.success) {
        setErrorMsg(res.error || 'Registration could not be completed with Google. Please try again.');
      } else {
        onSuccess?.();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google registration error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#4a0e68] flex flex-col justify-between text-neutral-100 relative overflow-hidden select-none">
      {/* Authentic Neydhal Royal Purple & Texture Background based on attached logo image */}
      <div
        className="absolute inset-0 bg-[#4a0e68] bg-cover bg-center bg-no-repeat pointer-events-none transition-all duration-1000"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 18%, rgba(110, 20, 148, 0.72) 0%, rgba(74, 14, 104, 0.92) 55%, rgba(42, 6, 61, 0.98) 100%),
            url('${settings.logoUrl || '/assets/aistudio/Neydhal_logo_a18d5bd8.jpeg'}')
          `,
          backgroundSize: 'cover, 480px',
          backgroundPosition: 'center, center',
          backgroundRepeat: 'no-repeat, repeat',
          backgroundBlendMode: 'normal, soft-light',
        }}
      />
      {/* Royal Purple & Neydhal Gold Atmosphere Overlays */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[450px] bg-[#891bb8]/25 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-[600px] h-[400px] bg-[#f6db9e]/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 -left-20 w-[500px] h-[400px] bg-[#610d85]/35 rounded-full blur-[130px] pointer-events-none" />

      {/* Top Boutique Navigation Header */}
      <header className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex items-center justify-between">
        <div
          onClick={triggerSecretAdminLogin}
          className="flex items-center gap-3 cursor-pointer select-none active:opacity-90"
          title={`${settings.boutiqueName} Boutique (Triple-click for Staff / Admin Login)`}
        >
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={settings.boutiqueName}
              className="h-11 w-11 object-contain rounded-2xl shadow-lg border border-amber-300/40 bg-white/10 p-0.5"
            />
          ) : (
            <img
              src="/assets/aistudio/Neydhal_logo_a18d5bd8.jpeg"
              alt={settings.boutiqueName || 'Neydhal'}
              className="h-11 w-11 object-cover rounded-2xl shadow-lg border border-amber-300/40"
            />
          )}
          <div>
            <h1 className="font-serif text-lg sm:text-xl font-bold text-white tracking-wide">
              {settings.boutiqueName}
            </h1>
            <p className="text-[10px] text-amber-300 font-medium tracking-wider uppercase">
              {settings.customerLoginDisplay?.headerSubtitle || 'Handcrafted Silk Atelier'}
            </p>
          </div>
        </div>

        <div
          onClick={triggerSecretAdminLogin}
          className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none active:opacity-80 bg-black/20 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-xs"
          title="Protected Member Portal (Triple-click for Staff / Admin Login)"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{settings.customerLoginDisplay?.headerBadgeText || 'Protected Member Portal'}</span>
        </div>
      </header>

      {/* Main Login Gate Card */}
      <main className="relative z-10 max-w-5xl mx-auto w-full px-4 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center flex-1">
        {/* Left Column: Boutique Presentation & Privacy Assurance */}
        <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{settings.customerLoginDisplay?.badgeText || 'Patron Verification Required'}</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
            {settings.customerLoginDisplay?.headline || 'Exclusive Handloom Catalog Access'}
          </h2>

          <p className="text-purple-100/90 text-xs sm:text-sm leading-relaxed max-w-lg mx-auto lg:mx-0">
            {settings.customerLoginDisplay?.description ||
              'To preserve the authenticity and privacy of our artisan handloom heirlooms, our masterweave catalog, limited weaves, and bespoke reservations are reserved exclusively for verified patrons registered with Google.'}
          </p>

          {/* Privacy & Member Privileges List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
            {(settings.customerLoginDisplay?.benefitCards && settings.customerLoginDisplay.benefitCards.length > 0
              ? settings.customerLoginDisplay.benefitCards
              : [
                  {
                    id: 'benefit-data',
                    title: 'Strict Data Isolation',
                    description:
                      'Your orders, delivery addresses, and purchases are completely private and isolated in dedicated patron storage.',
                    iconName: 'lock',
                  },
                  {
                    id: 'benefit-wishlist',
                    title: 'Private Wishlist',
                    description:
                      'Bookmark favorite Kanjivaram and Banarasi weaves across your personal devices.',
                    iconName: 'heart',
                  },
                  {
                    id: 'benefit-tracking',
                    title: 'Order Tracking & Photos',
                    description:
                      'Track dispatch milestones and view high-resolution packaging photos of your sarees.',
                    iconName: 'package',
                  },
                  {
                    id: 'benefit-chat',
                    title: 'Direct Concierge Chat',
                    description:
                      'Instant live chat directly with our Salem handloom workshop masters.',
                    iconName: 'message',
                  },
                ]
            ).map((card, idx) => {
              const renderCardIcon = (iconName?: string) => {
                switch (iconName) {
                  case 'heart':
                    return (
                      <span className="p-2 rounded-xl bg-rose-500/20 text-rose-300 shrink-0 mt-0.5">
                        <Heart className="w-4 h-4" />
                      </span>
                    );
                  case 'package':
                    return (
                      <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 shrink-0 mt-0.5">
                        <Package className="w-4 h-4" />
                      </span>
                    );
                  case 'message':
                    return (
                      <span className="p-2 rounded-xl bg-sky-500/20 text-sky-300 shrink-0 mt-0.5">
                        <MessageSquare className="w-4 h-4" />
                      </span>
                    );
                  case 'lock':
                  default:
                    return (
                      <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300 shrink-0 mt-0.5">
                        <Lock className="w-4 h-4" />
                      </span>
                    );
                }
              };

              return (
                <div
                  key={card.id || idx}
                  className="p-3.5 rounded-2xl bg-[#320645]/60 border border-purple-300/20 backdrop-blur-md flex items-start gap-3 shadow-sm"
                >
                  {renderCardIcon(card.iconName)}
                  <div>
                    <h4 className="font-semibold text-xs text-white">{card.title}</h4>
                    <p className="text-[11px] text-purple-200/80 mt-0.5">{card.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Customer Google Sign-In & Register Gate */}
        <div className="lg:col-span-6 max-w-md w-full mx-auto">
          <div className="bg-[#20042d]/92 rounded-3xl p-6 sm:p-8 border border-purple-400/25 shadow-2xl backdrop-blur-xl space-y-6">
            {/* Mode Switcher Tabs: Sign In vs Register */}
            <div className="flex items-center bg-[#15021f]/90 p-1.5 rounded-2xl border border-purple-500/20">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setErrorMsg('');
                  setUnregisteredNotice(null);
                }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
                  authMode === 'signin'
                    ? 'bg-amber-500 text-neutral-950 shadow-md font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Patron Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setErrorMsg('');
                  setUnregisteredNotice(null);
                }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
                  authMode === 'register'
                    ? 'bg-amber-500 text-neutral-950 shadow-md font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register with Google</span>
              </button>
            </div>

            {/* Form Title & Subtitle */}
            <div className="text-center space-y-1.5">
              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white">
                {authMode === 'signin' ? 'Welcome Back' : 'Join Our Atelier'}
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed max-w-xs mx-auto">
                {authMode === 'signin'
                  ? 'Sign in with your registered Google account to access your private orders and boutique catalog.'
                  : 'Register your patron account with Google. Your verified profile will be securely stored in our private database.'}
              </p>
            </div>

            {/* Unregistered Prompt Alert */}
            {unregisteredNotice && (
              <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-500/50 text-amber-200 text-xs space-y-2.5 animate-in fade-in">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-100">Patron Registration Required</p>
                    <p className="text-[11px] text-amber-300/90 mt-0.5">
                      No account is currently registered for <strong>{unregisteredNotice.email}</strong>. Please register to unlock boutique catalog access.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setErrorMsg('');
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm active:scale-98"
                >
                  <span>Register with this Google Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Error Notification */}
            {errorMsg && !unregisteredNotice && (
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Mode 1: Patron Sign In */}
            {authMode === 'signin' ? (
              <div className="space-y-4 pt-1">
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
                  <span>{isLoading ? 'Authenticating with Google...' : 'Sign In with Google'}</span>
                </button>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center space-y-1">
                  <p className="text-[11px] text-amber-200/90 font-medium">
                    Verified Google Patron Authentication
                  </p>
                  <p className="text-[10px] text-neutral-400">
                    Verifies against our registered patrons database before granting catalog access.
                  </p>
                </div>

                <div className="text-center pt-2">
                  <p className="text-xs text-neutral-400">
                    New patron to our boutique?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setErrorMsg('');
                        setUnregisteredNotice(null);
                      }}
                      className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                    >
                      Register with Google
                    </button>
                  </p>
                </div>
              </div>
            ) : (
              /* Mode 2: Patron Register with Google */
              <form onSubmit={handleGoogleRegister} className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1.5">
                    Your Name (Optional)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Will use Google profile name if blank"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#14021d]/90 border border-purple-400/30 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-200/90 mb-1.5">
                    Mobile Phone Number (Optional)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-400">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit number for order SMS/WhatsApp"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#14021d]/90 border border-purple-400/30 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
                    />
                  </div>
                  <p className="text-[10px] text-purple-300/70 mt-1">
                    Used to automatically associate your dispatch and courier updates.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-sm flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition cursor-pointer disabled:opacity-60 active:scale-[0.99] mt-2"
                >
                  {/* Google Icon */}
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                  <span>{isLoading ? 'Creating Patron Account...' : 'Register Patron with Google'}</span>
                </button>

                <div className="text-center pt-2">
                  <p className="text-xs text-neutral-400">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setErrorMsg('');
                        setUnregisteredNotice(null);
                      }}
                      className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                    >
                      Sign In with Google
                    </button>
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer info strictly for patrons with secret discreet B2B and Admin access */}
      <footer className="relative z-10 max-w-7xl mx-auto w-full px-4 py-4 text-xs text-neutral-400 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-[11px]">
          <span
            onClick={triggerSecretAdminLogin}
            className="cursor-default select-none hover:text-neutral-300"
            title="Atelier Protected System"
          >
            ©
          </span>{' '}
          {new Date().getFullYear()} {settings.boutiqueName}. Pure Handloom Heritage Atelier. All rights reserved.
        </p>
        <button
          type="button"
          onClick={openResellerPortal}
          className="text-[11px] text-neutral-400 hover:text-neutral-200 inline-flex items-center gap-1.5 cursor-pointer transition select-none active:opacity-75"
          title="B2B"
        >
          <Store className="w-3.5 h-3.5 text-neutral-400" />
          <span>B2B</span>
        </button>
      </footer>
    </div>
  );
};
