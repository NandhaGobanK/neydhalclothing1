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
  Eye,
  EyeOff,
  Copy,
  Check,
  Key,
  Globe,
  FileText,
  RotateCcw,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Mail,
  ExternalLink,
  X,
  HelpCircle,
} from 'lucide-react';
import { LEGAL_POLICIES, STORE_CONTACT_DETAILS, PolicySection } from '../../data/legalPolicies';

interface CustomerLoginPageProps {
  onSuccess?: () => void;
  onOpenAdmin?: () => void;
}

export const CustomerLoginPage: React.FC<CustomerLoginPageProps> = ({ onSuccess, onOpenAdmin }) => {
  const {
    settings,
    customerLogin,
    customerLoginWithGoogle,
    setIsResellerPortalOpen,
  } = useStore();

  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [errorMsg, setErrorMsg] = useState('');
  const [unregisteredNotice, setUnregisteredNotice] = useState<{ email: string; displayName?: string } | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState<{ name: string; phone: string; email?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Inline Collapsible Legal Policy State
  const [activePolicyTab, setActivePolicyTab] = useState<'terms' | 'refund' | 'privacy' | null>(null);
  const [copiedPolicyText, setCopiedPolicyText] = useState(false);

  const togglePolicy = (tab: 'terms' | 'refund' | 'privacy') => {
    setActivePolicyTab((prev) => (prev === tab ? null : tab));
  };

  const handleCopyPolicy = (policy: PolicySection) => {
    const fullText = `${policy.title} - ${STORE_CONTACT_DETAILS.businessName}\nLast Updated: ${policy.lastUpdated}\n\n${policy.highlightNote || ''}\n\n` +
      policy.clauses.map((c) => `${c.heading}\n${c.content}\n${c.bullets ? c.bullets.map((b) => ` • ${b}`).join('\n') + '\n' : ''}`).join('\n') +
      `\n\nContact Store Staff: Phone/WhatsApp: ${STORE_CONTACT_DETAILS.formattedPhone} | Email: ${STORE_CONTACT_DETAILS.email}`;
    navigator.clipboard.writeText(fullText);
    setCopiedPolicyText(true);
    setTimeout(() => setCopiedPolicyText(false), 2500);
  };

  // Customer Login State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedTestField, setCopiedTestField] = useState<string | null>(null);

  const copyTestField = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTestField(fieldName);
    setTimeout(() => setCopiedTestField(null), 2000);
  };

  const handleCredentialsSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setUnregisteredNotice(null);
    if (!loginUsername.trim()) {
      setErrorMsg('Please enter your username or email address.');
      return;
    }
    if (!loginPassword) {
      setErrorMsg('Please enter your password.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await customerLogin(loginUsername.trim(), loginPassword);
      if (res.success) {
        onSuccess?.();
      } else {
        setErrorMsg(res.error || 'Invalid credentials.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Mandatory registration inputs
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
    setRegistrationSuccess(null);
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
          // Redirect immediately to register tab with clear warning banner
          setAuthMode('register');
        } else {
          setErrorMsg(res.error || 'Google authentication was not completed. Please try again.');
        }
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

    // Mandatory fields validation
    if (!regName.trim()) {
      setErrorMsg('Full Name is required for patron registration.');
      return;
    }
    const cleanPhone = regPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setErrorMsg('A valid 10-digit mobile number is required.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await customerLoginWithGoogle({
        mode: 'register',
        phone: cleanPhone,
        name: regName.trim(),
        autoSignIn: false, // Per requirements: display confirmation first, user then proceeds to sign in
      });
      if (!res.success) {
        setErrorMsg(res.error || 'Registration could not be completed with Google. Please try again.');
      } else {
        setRegistrationSuccess({
          name: res.customer?.name || regName.trim(),
          phone: res.customer?.phone || cleanPhone,
          email: res.customer?.email,
        });
        setErrorMsg('');
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
              <div className="p-4 rounded-2xl bg-amber-950/80 border border-amber-500/60 text-amber-200 text-xs space-y-2.5 animate-in fade-in shadow-lg">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-amber-100 text-sm">Patron Registration Required</p>
                    <p className="text-xs text-amber-200/90 leading-relaxed">
                      No patron account is registered for <strong className="text-white underline">{unregisteredNotice.email}</strong>.
                    </p>
                    <p className="text-[11px] text-amber-300/80 leading-relaxed">
                      Please enter your 10-digit mobile number below and click <strong>Register Patron with Google</strong>. Once registered, you can sign in directly.
                    </p>
                  </div>
                </div>
                {authMode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setErrorMsg('');
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm active:scale-98"
                  >
                    <span>Proceed to Registration</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
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
            {registrationSuccess ? (
              <div className="space-y-4 pt-1 animate-in fade-in zoom-in-95 text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/40 flex items-center justify-center shadow-lg">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-serif text-2xl font-bold text-white">
                    Account Created Successfully!
                  </h4>
                  <p className="text-xs text-purple-200/90 leading-relaxed max-w-xs mx-auto">
                    Your verified patron account has been created for <strong>{registrationSuccess.name}</strong>. Please proceed to the sign-in page to log in.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#14021d]/90 border border-purple-400/30 text-left text-xs space-y-1.5">
                  <div className="flex justify-between text-purple-300">
                    <span>Full Name:</span>
                    <span className="font-bold text-white">{registrationSuccess.name}</span>
                  </div>
                  <div className="flex justify-between text-purple-300">
                    <span>Mobile Number:</span>
                    <span className="font-bold font-mono text-white">+91 {registrationSuccess.phone}</span>
                  </div>
                  {registrationSuccess.email && (
                    <div className="flex justify-between text-purple-300">
                      <span>Google Account:</span>
                      <span className="font-mono text-white text-[11px]">{registrationSuccess.email}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setRegistrationSuccess(null);
                    setAuthMode('signin');
                    setErrorMsg('');
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition cursor-pointer active:scale-98"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Proceed to Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : authMode === 'signin' ? (
              <div className="space-y-4 pt-1">

                {/* Form 1: Username & Password Sign In */}
                <form onSubmit={handleCredentialsSignIn} className="space-y-3 pt-1 text-left">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1 flex items-center justify-between">
                      <span>Username or Email</span>
                      <span className="text-[10px] text-neutral-400 font-normal">Registered patron account</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        placeholder="e.g. 9876543210 or your email"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#14021d]/90 border border-purple-400/30 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1 flex items-center justify-between">
                      <span>Password</span>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[10px] text-amber-300 hover:text-amber-200 font-medium lowercase"
                      >
                        {showPassword ? 'hide' : 'show'}
                      </button>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#14021d]/90 border border-purple-400/30 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition cursor-pointer disabled:opacity-60 active:scale-98"
                  >
                    <Key className="w-4 h-4" />
                    <span>{isLoading ? 'Signing In...' : 'Sign In with Password'}</span>
                  </button>
                </form>

                {/* Divider */}
                <div className="relative flex py-1 items-center">
                  <div className="grow border-t border-purple-400/20"></div>
                  <span className="shrink mx-3 text-[10px] uppercase font-bold text-purple-300/60 tracking-wider">
                    Or Continue With
                  </span>
                  <div className="grow border-t border-purple-400/20"></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-60 active:scale-[0.99]"
                >
                  {/* Official Google G Logo */}
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                  <span>{isLoading ? 'Authenticating with Google...' : 'Sign In with Google'}</span>
                </button>

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
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1.5 flex items-center justify-between">
                    <span>Full Name</span>
                    <span className="text-[10px] text-rose-400 font-bold tracking-normal uppercase">Required</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#14021d]/90 border border-purple-400/30 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-200/90 mb-1.5 flex items-center justify-between">
                    <span>Mobile Phone Number (10 digits)</span>
                    <span className="text-[10px] text-rose-400 font-bold tracking-normal uppercase">Required</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-400">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit number for order SMS/WhatsApp"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#14021d]/90 border border-purple-400/30 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-purple-300/70 mt-1">
                    Mandatory field for order notifications, dispatch updates, and private tracking.
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

      {/* Footer with inline collapsible Terms & Conditions, Refund Policy, and Privacy Policy */}
      <footer className="relative z-10 max-w-7xl mx-auto w-full px-4 pt-6 pb-8 text-xs text-neutral-300 border-t border-purple-500/20 space-y-4">
        {/* Policy Trigger Navigation Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#170220]/80 p-3 sm:p-4 rounded-2xl border border-purple-400/20 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300/80 mr-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Policies:</span>
            </span>

            {/* 1. Terms of Service Button */}
            <button
              type="button"
              onClick={() => togglePolicy('terms')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border ${
                activePolicyTab === 'terms'
                  ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-md font-bold'
                  : 'bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-purple-400/40'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Terms of Service</span>
              {activePolicyTab === 'terms' ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              )}
            </button>

            {/* 2. Refund Policy Button with Highlight Badge */}
            <button
              type="button"
              onClick={() => togglePolicy('refund')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border ${
                activePolicyTab === 'refund'
                  ? 'bg-rose-500 text-white border-rose-400 shadow-md font-bold'
                  : 'bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-purple-400/40'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-300" />
              <span>Refund & Return Policy</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/30 text-rose-200 border border-rose-400/40 font-bold uppercase tracking-wider">
                No Returns
              </span>
              {activePolicyTab === 'refund' ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              )}
            </button>

            {/* 3. Privacy Policy Button */}
            <button
              type="button"
              onClick={() => togglePolicy('privacy')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border ${
                activePolicyTab === 'privacy'
                  ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-md font-bold'
                  : 'bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-purple-400/40'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Privacy Policy</span>
              {activePolicyTab === 'privacy' ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              )}
            </button>
          </div>

          {/* Quick Staff Concierge Contact Pill */}
          <div className="flex items-center gap-2 text-[11px] text-purple-200">
            <span className="hidden md:inline text-purple-300/70">Store Concierge:</span>
            <a
              href={`https://wa.me/91${STORE_CONTACT_DETAILS.phone}?text=${encodeURIComponent(
                'Namaste! I am reaching out to Neydhal store staff regarding customer policies and order assistance.'
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 font-medium transition"
              title="Message Store Staff on WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>WhatsApp: {STORE_CONTACT_DETAILS.phone}</span>
            </a>
            <a
              href={`mailto:${STORE_CONTACT_DETAILS.email}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600/20 hover:bg-sky-600/40 text-sky-300 border border-sky-500/30 font-medium transition"
              title="Email Store Staff"
            >
              <Mail className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">{STORE_CONTACT_DETAILS.email}</span>
            </a>
          </div>
        </div>

        {/* INLINE EXPANDED COLLAPSIBLE POLICY CARD */}
        {activePolicyTab && (
          <div className="p-5 sm:p-7 rounded-3xl bg-[#1d0328]/95 border-2 border-purple-400/30 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200 space-y-5 text-left">
            {/* Expanded Policy Header with Switcher Tabs and Close Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-purple-500/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                    {LEGAL_POLICIES[activePolicyTab].badge || 'Customer Policy'}
                  </span>
                  <span className="text-[11px] text-purple-300">
                    Last Updated: {LEGAL_POLICIES[activePolicyTab].lastUpdated}
                  </span>
                </div>
                <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white">
                  {LEGAL_POLICIES[activePolicyTab].title}
                </h3>
                <p className="text-xs text-purple-200/80">
                  {LEGAL_POLICIES[activePolicyTab].shortDescription}
                </p>
              </div>

              {/* Policy Switcher Tabs & Close Button */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <div className="inline-flex p-1 bg-black/40 rounded-xl border border-purple-500/20">
                  <button
                    type="button"
                    onClick={() => setActivePolicyTab('terms')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer ${
                      activePolicyTab === 'terms'
                        ? 'bg-amber-500 text-neutral-950 font-bold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Terms
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePolicyTab('refund')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer ${
                      activePolicyTab === 'refund'
                        ? 'bg-rose-500 text-white font-bold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Refunds
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePolicyTab('privacy')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer ${
                      activePolicyTab === 'privacy'
                        ? 'bg-amber-500 text-neutral-950 font-bold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Privacy
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyPolicy(LEGAL_POLICIES[activePolicyTab])}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                  title="Copy full policy text to clipboard"
                >
                  {copiedPolicyText ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-neutral-300" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActivePolicyTab(null)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition cursor-pointer"
                  title="Close policy viewer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* High-Visibility Callout Box */}
            {activePolicyTab === 'refund' ? (
              <div className="p-4 rounded-2xl bg-rose-950/70 border-2 border-rose-500/50 text-rose-100 text-xs space-y-3 shadow-lg">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white uppercase tracking-wider">
                        Clear Declaration: Strict No Returns Policy
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-200 text-[10px] font-bold">
                        Non-Returnable Once Received
                      </span>
                    </div>
                    <p className="text-rose-200/90 leading-relaxed text-[11.5px]">
                      Neydhal Clothing follows a strict <strong>NO RETURNS and NO REFUNDS policy on all products once the customer has received the parcel</strong> (including all sarees, kurtis, blouses, and imitation jewellery).
                    </p>
                    <p className="text-rose-200/90 leading-relaxed text-[11.5px]">
                      <strong>Order Cancellations:</strong> Any order can be cancelled directly by the customer <strong>before shipping</strong> for an immediate 100% refund.
                    </p>
                    <p className="text-amber-200 leading-relaxed text-[11px] pt-1 border-t border-rose-800/60">
                      <strong>Damaged in Transit or Defective:</strong> If an item arrives damaged from courier transit, patrons must contact store staff within 24–48 hours with an uncut <strong>WhatsApp video</strong> of the outer packaging opening.
                    </p>
                  </div>
                </div>

                {/* Direct Store Staff Contact Action Row */}
                <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[11px] text-rose-300 font-semibold">Contact Store Staff:</span>
                  <a
                    href={`https://wa.me/91${STORE_CONTACT_DETAILS.phone}?text=${encodeURIComponent(
                      'Hello Neydhal Clothing staff, I need assistance regarding a delivered order damage / query. Here is my unboxing video:'
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Send WhatsApp Video to {STORE_CONTACT_DETAILS.phone}</span>
                  </a>
                  <a
                    href={`mailto:${STORE_CONTACT_DETAILS.email}?subject=${encodeURIComponent(
                      'Order Assistance / Transit Query'
                    )}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-medium transition"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{STORE_CONTACT_DETAILS.email}</span>
                  </a>
                  <a
                    href={`tel:${STORE_CONTACT_DETAILS.phone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call {STORE_CONTACT_DETAILS.phone}</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-amber-200 text-xs flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11.5px] leading-relaxed">
                  {LEGAL_POLICIES[activePolicyTab].highlightNote}
                </p>
              </div>
            )}

            {/* Structured Clauses List */}
            <div className="space-y-4 pt-1 divide-y divide-purple-500/15">
              {LEGAL_POLICIES[activePolicyTab].clauses.map((clause, idx) => (
                <div key={idx} className={idx > 0 ? 'pt-4 space-y-1.5' : 'space-y-1.5'}>
                  <h4 className="font-serif text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span className="text-amber-400 font-mono text-sm">{idx + 1}.</span>
                    <span>{clause.heading.replace(/^\d+\.\s*/, '')}</span>
                  </h4>
                  <p className="text-xs text-purple-100/85 leading-relaxed">
                    {clause.content}
                  </p>
                  {clause.bullets && clause.bullets.length > 0 && (
                    <ul className="space-y-1 pt-1 pl-4 text-xs text-purple-200/80 list-disc">
                      {clause.bullets.map((bullet, bIdx) => (
                        <li key={bIdx} className="leading-relaxed">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {/* Policy Bottom Bar with Collapse Button */}
            <div className="pt-3 border-t border-purple-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-purple-300">
              <p className="text-[11px]">
                Official policy for <strong>{STORE_CONTACT_DETAILS.businessName}</strong> ({STORE_CONTACT_DETAILS.website}).
              </p>
              <button
                type="button"
                onClick={() => setActivePolicyTab(null)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Collapse Policy View</span>
              </button>
            </div>
          </div>
        )}

        {/* Bottom Copyright and B2B Access Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 text-[11px] text-neutral-400">
          <p>
            <span
              onClick={triggerSecretAdminLogin}
              className="cursor-default select-none hover:text-neutral-300"
              title="Atelier Protected System"
            >
              ©
            </span>{' '}
            {new Date().getFullYear()} {settings.boutiqueName || 'Neydhal'}. Online Retail Boutique for Women's Sarees, Kurtis, Blouses & Imitation Jewellery. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-neutral-500 text-[10px]">
              Support: {STORE_CONTACT_DETAILS.phone} | {STORE_CONTACT_DETAILS.email}
            </span>
            <button
              type="button"
              onClick={openResellerPortal}
              className="text-[11px] text-neutral-400 hover:text-neutral-200 inline-flex items-center gap-1.5 cursor-pointer transition select-none active:opacity-75"
              title="B2B Wholesale Portal"
            >
              <Store className="w-3.5 h-3.5 text-neutral-400" />
              <span>B2B</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
