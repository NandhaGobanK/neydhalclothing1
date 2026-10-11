import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { googleSignIn } from '../../utils/firebaseAuth';
import {
  Lock,
  ArrowLeft,
  AlertCircle,
  ShieldCheck,
  Users,
  CheckCircle2,
  KeyRound,
  Sparkles,
} from 'lucide-react';

interface AdminAuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ onClose, onSuccess }) => {
  const { googleLogin, adminLogin, staffLogin, settings } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authSuccessInfo, setAuthSuccessInfo] = useState<string | null>(null);
  const [activeFallback, setActiveFallback] = useState<'none' | 'pin' | 'staff'>('none');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  // Staff login states
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffError, setStaffError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setAuthSuccessInfo(null);

    try {
      const result = await googleSignIn();
      if (!result) {
        setIsLoading(false);
        return;
      }

      const { user, accessToken } = result;
      const loginRes = googleLogin(
        {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          uid: user.uid,
        },
        accessToken
      );

      if (loginRes.success) {
        setAuthSuccessInfo(
          loginRes.role === 'admin'
            ? `Welcome, Administrator (${user.email})`
            : `Welcome back, Staff Member (${user.email})`
        );
        setTimeout(() => {
          onSuccess();
        }, 600);
      } else {
        setErrorMessage(loginRes.error || 'Access denied for this Google account.');
      }
    } catch (err: any) {
      console.error('Google Auth Failed:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMessage('Sign-in cancelled. Please complete Google sign-in to access the portal.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setErrorMessage(
          'Google Auth Error: This domain is not authorized in Firebase Console -> Authentication -> Settings -> Authorized domains.'
        );
      } else {
        setErrorMessage(err.message || 'Unable to complete Google Sign-in. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminLogin(pin)) {
      onSuccess();
    } else {
      setPinError(true);
      setPin('');
    }
  };

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);
    if (!staffUsername.trim() || !staffPassword.trim()) {
      setStaffError('Please enter both username and password.');
      return;
    }

    const res = staffLogin(staffUsername, staffPassword);
    if (res.success) {
      onSuccess();
    } else {
      setStaffError(res.error || 'Invalid staff credentials or account locked.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-white my-auto animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 left-5 p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          title="Back to Storefront"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="text-center mt-2 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-700 via-amber-600 to-amber-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-rose-950/50">
            <Lock className="w-6 h-6 text-amber-100" />
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-white">
            {settings.boutiqueName || 'Boutique Atelier'}
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Staff & Administrator Management Portal
          </p>
        </div>

        {/* Primary Google Login Section */}
        <div className="space-y-4">
          <p className="text-xs text-neutral-300 text-center leading-relaxed">
            Sign in with your Google account. Both store owner admins and authorized staff members access via Google.
          </p>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {authSuccessInfo && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 text-xs flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{authSuccessInfo}</span>
            </div>
          )}

          {/* Official Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-xs sm:text-sm shadow-lg hover:shadow-xl transition-all active:scale-98 disabled:opacity-60 cursor-pointer border border-neutral-300"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{isLoading ? 'Signing in with Google...' : 'Sign in with Google'}</span>
          </button>

          <div className="pt-2 text-center">
            <span className="text-[11px] text-neutral-400">
              Synced with Google Workspace (Sheets & Drive)
            </span>
          </div>
        </div>

        {/* Fallback Access Toggles (Staff Password & Master PIN) */}
        <div className="mt-6 pt-5 border-t border-neutral-800 text-center space-y-2">
          <div className="flex items-center justify-center gap-3 text-[11px] text-neutral-400">
            <button
              type="button"
              onClick={() => setActiveFallback(activeFallback === 'staff' ? 'none' : 'staff')}
              className={`hover:text-amber-300 transition flex items-center gap-1 ${
                activeFallback === 'staff' ? 'text-amber-300 font-bold' : ''
              }`}
            >
              <Users className="w-3 h-3 text-amber-500" />
              <span>Staff Login</span>
            </button>
            <span className="text-neutral-700">•</span>
            <button
              type="button"
              onClick={() => setActiveFallback(activeFallback === 'pin' ? 'none' : 'pin')}
              className={`hover:text-amber-300 transition flex items-center gap-1 ${
                activeFallback === 'pin' ? 'text-amber-300 font-bold' : ''
              }`}
            >
              <KeyRound className="w-3 h-3 text-amber-500" />
              <span>Owner PIN</span>
            </button>
          </div>

          {/* Staff Username & Password Fallback Form */}
          {activeFallback === 'staff' && (
            <form onSubmit={handleStaffSubmit} className="mt-4 space-y-2.5 animate-in fade-in slide-in-from-top-1 text-left">
              {staffError && (
                <p className="text-[11px] text-rose-400 text-center">{staffError}</p>
              )}
              <input
                type="text"
                value={staffUsername}
                onChange={(e) => setStaffUsername(e.target.value)}
                placeholder="Staff Username (@username)"
                className="w-full py-2 px-3 rounded-xl bg-neutral-800 border border-neutral-700 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-400 font-mono"
              />
              <input
                type="password"
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                placeholder="Staff Password"
                className="w-full py-2 px-3 rounded-xl bg-neutral-800 border border-neutral-700 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-400"
              />
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase tracking-wider transition border border-neutral-700"
              >
                Sign in with Staff Password
              </button>
            </form>
          )}

          {/* Master PIN Fallback Form */}
          {activeFallback === 'pin' && (
            <form onSubmit={handlePinSubmit} className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-1">
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/[^0-9]/g, ''));
                  setPinError(false);
                }}
                placeholder="6-digit Master PIN"
                className="w-full py-2 px-3 rounded-xl bg-neutral-800 border border-neutral-700 text-center font-mono text-sm tracking-widest text-amber-200 focus:outline-hidden focus:border-amber-400"
              />
              {pinError && (
                <p className="text-[11px] text-rose-400">Incorrect PIN. Try again.</p>
              )}
              <button
                type="submit"
                disabled={pin.length !== 6}
                className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition disabled:opacity-40"
              >
                Unlock with PIN
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
