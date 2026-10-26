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
  Lock,
  Eye,
  EyeOff,
  Key,
} from 'lucide-react';
import { getThemeColors } from '../../utils/theme';
import { PAYTM_TEST_CREDENTIALS } from '../../types/store';

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
  const { customerLogin, customerLoginWithGoogle, settings } = useStore();
  const themeColors = getThemeColors(settings.theme, settings.themeMode);

  const [mode, setMode] = useState<'signin' | 'register'>(initialMode);
  const [unregisteredNotice, setUnregisteredNotice] = useState<{ email: string; displayName?: string } | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState<{ name: string; phone: string; email: string } | null>(null);

  // Credentials sign in state
  const [loginUsername, setLoginUsername] = useState(PAYTM_TEST_CREDENTIALS.username);
  const [loginPassword, setLoginPassword] = useState(PAYTM_TEST_CREDENTIALS.password);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedTest, setCopiedTest] = useState<string | null>(null);

  // Mandatory registration fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const copyTestField = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTest(field);
    setTimeout(() => setCopiedTest(null), 2000);
  };

  const handleCredentialsSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setUnregisteredNotice(null);
    if (!loginUsername.trim()) {
      setError('Please enter your username or email address.');
      return;
    }
    if (!loginPassword) {
      setError('Please enter your password.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await customerLogin(loginUsername.trim(), loginPassword);
      if (res.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(res.error || 'Invalid credentials.');
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickPaytmTestLogin = async () => {
    setLoginUsername(PAYTM_TEST_CREDENTIALS.username);
    setLoginPassword(PAYTM_TEST_CREDENTIALS.password);
    setError('');
    setIsSubmitting(true);
    try {
      const res = await customerLogin(PAYTM_TEST_CREDENTIALS.username, PAYTM_TEST_CREDENTIALS.password);
      if (res.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(res.error || 'Test login failed.');
      }
    } catch (err: any) {
      setError(err?.message || 'Test login error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setUnregisteredNotice(null);
    setRegistrationSuccess(null);
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
          // Redirect immediately to registration view
          setMode('register');
        } else {
          setError(res.error || 'Google sign-in could not be completed.');
        }
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

    // Mandatory field validations
    if (!name.trim()) {
      setError('Full Name is required for patron registration.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setError('A valid 10-digit mobile number is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await customerLoginWithGoogle({
        mode: 'register',
        phone: cleanPhone,
        name: name.trim(),
        autoSignIn: false, // Per requirements: display confirmation first, user then proceeds to sign in
      });
      if (res.success) {
        // Confirmation state
        setRegistrationSuccess({
          name: res.customer?.name || name.trim(),
          phone: res.customer?.phone || cleanPhone,
          email: res.customer?.email || '',
        });
        setError('');
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
            <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-2 animate-in fade-in shadow-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-sm text-amber-950">Patron Registration Required</p>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    No patron profile found for <strong className="text-neutral-900 underline">{unregisteredNotice.email}</strong>.
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Please enter your 10-digit mobile number below and click <strong>Register with Google</strong>. Once registered, you will be able to sign in directly.
                  </p>
                </div>
              </div>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                >
                  <span>Go to Registration</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {error && !unregisteredNotice && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {registrationSuccess ? (
            <div className="space-y-4 pt-2 animate-in fade-in zoom-in-95 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-neutral-900">
                  Account Created Successfully!
                </h3>
                <p className="text-xs text-neutral-600 mt-1 max-w-sm mx-auto">
                  Your verified patron profile has been created for <strong>{registrationSuccess.name}</strong>. Please proceed to the sign-in page to log in.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-left text-xs space-y-1.5 shadow-2xs">
                <div className="flex justify-between text-neutral-600">
                  <span>Full Name:</span>
                  <span className="font-bold text-neutral-900">{registrationSuccess.name}</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Mobile Number:</span>
                  <span className="font-bold font-mono text-neutral-900">+91 {registrationSuccess.phone}</span>
                </div>
                {registrationSuccess.email && (
                  <div className="flex justify-between text-neutral-600">
                    <span>Google Account:</span>
                    <span className="font-mono text-neutral-900 text-[11px]">{registrationSuccess.email}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setRegistrationSuccess(null);
                  setMode('signin');
                  setError('');
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer active:scale-98"
              >
                <LogIn className="w-4 h-4" />
                <span>Proceed to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : mode === 'signin' ? (
            <div className="space-y-4 pt-2">
              {/* Paytm Website Verification Test Credentials Card */}
              <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-[#00BAF2]/40 text-left space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00BAF2]/20 text-[#002970] text-[10px] font-bold uppercase tracking-wider">
                    <Sparkles className="w-3 h-3 text-[#00BAF2]" />
                    <span>Paytm Channel Verification</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">Test Credentials</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                    <div className="min-w-0 pr-2">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">
                        Username *
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-900 truncate block">
                        {PAYTM_TEST_CREDENTIALS.username}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyTestField(PAYTM_TEST_CREDENTIALS.username, 'modal_user')}
                      className="px-2 py-1 text-[10px] font-bold rounded-lg bg-sky-50 hover:bg-sky-100 text-[#002970] transition shrink-0 cursor-pointer"
                    >
                      {copiedTest === 'modal_user' ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                    <div className="min-w-0 pr-2">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">
                        Password *
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-900 truncate block">
                        {PAYTM_TEST_CREDENTIALS.password}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyTestField(PAYTM_TEST_CREDENTIALS.password, 'modal_pass')}
                      className="px-2 py-1 text-[10px] font-bold rounded-lg bg-sky-50 hover:bg-sky-100 text-[#002970] transition shrink-0 cursor-pointer"
                    >
                      {copiedTest === 'modal_pass' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleQuickPaytmTestLogin}
                  disabled={isSubmitting}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-sky-600 to-[#002970] hover:from-sky-500 hover:to-[#001d52] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer active:scale-98"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Signing In...' : '1-Click Sign In as Paytm Tester'}</span>
                </button>
              </div>

              {/* Username & Password Form */}
              <form onSubmit={handleCredentialsSignIn} className="space-y-3 pt-1 text-left">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1 flex items-center justify-between">
                    <span>Username or Email</span>
                    <span className="text-[10px] text-neutral-400 font-normal">Patron or test user</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="paytm_tester@neydhalclothing.in or Phone"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1 flex items-center justify-between">
                    <span>Password</span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[10px] text-amber-700 hover:text-amber-800 font-medium lowercase"
                    >
                      {showPassword ? 'hide' : 'show'}
                    </button>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-60 active:scale-98"
                >
                  <Key className="w-4 h-4" />
                  <span>{isSubmitting ? 'Signing In...' : 'Sign In with Password'}</span>
                </button>
              </form>

              {/* Divider */}
              <div className="relative flex py-1 items-center">
                <div className="grow border-t border-neutral-200"></div>
                <span className="shrink mx-3 text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  Or Continue With
                </span>
                <div className="grow border-t border-neutral-200"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-2xl border-2 border-neutral-200 hover:border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-2xs hover:shadow-xs transition cursor-pointer disabled:opacity-50 active:scale-98"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>{isSubmitting ? 'Authenticating...' : 'Sign In with Google'}</span>
              </button>

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
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1 flex items-center justify-between">
                  <span>Full Name</span>
                  <span className="text-[10px] text-rose-600 font-bold tracking-normal uppercase">Required</span>
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
                    placeholder="Enter your full name"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-rose-900/30 focus:border-rose-900 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1 flex items-center justify-between">
                  <span>Mobile Number (10 digits)</span>
                  <span className="text-[10px] text-rose-600 font-bold tracking-normal uppercase">Required</span>
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
                    placeholder="10-digit number for order SMS/WhatsApp"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 font-mono focus:outline-none focus:ring-2 focus:ring-rose-900/30 focus:border-rose-900 transition"
                  />
                </div>
                <p className="text-[10px] text-neutral-500 mt-1">
                  Mandatory field for order notifications, dispatch updates, and private tracking.
                </p>
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
