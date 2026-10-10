import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Lock, KeyRound, AlertCircle, ArrowLeft, ShieldCheck, User, Users } from 'lucide-react';

interface AdminAuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ onClose, onSuccess }) => {
  const { adminLogin, staffLogin } = useStore();
  const [authMode, setAuthMode] = useState<'owner' | 'staff'>('owner');

  // Owner 6-digit PIN
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  // Staff Credentials
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffError, setStaffError] = useState('');

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
    if (!staffUsername.trim() || !staffPassword.trim()) {
      setStaffError('Please enter username and password.');
      return;
    }

    const res = staffLogin(staffUsername, staffPassword);
    if (res.success) {
      onSuccess();
    } else {
      setStaffError(res.error || 'Authentication failed. Please verify credentials.');
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setPinError(false);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setPinError(false);
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

        <div className="text-center mt-2 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-rose-700 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-rose-950/50">
            <Lock className="w-6 h-6 text-amber-100" />
          </div>
          <h2 className="font-serif text-xl font-bold text-white">Boutique Management</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Secure admin portal & concierge fulfillment console
          </p>
        </div>

        {/* Tab switcher: Owner 6-digit PIN vs Staff Login */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-800/80 rounded-xl mb-5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setAuthMode('owner')}
            className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
              authMode === 'owner'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Owner PIN</span>
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('staff')}
            className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
              authMode === 'staff'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staff Sign-in</span>
          </button>
        </div>

        {authMode === 'owner' ? (
          /* Owner 6-digit PIN mode */
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              {/* 6 Dots Indicator */}
              <div className="flex justify-center gap-2.5 mb-3">
                {[0, 1, 2, 3, 4, 5].map((idx) => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full border transition-all ${
                      idx < pin.length
                        ? 'bg-amber-400 border-amber-400 scale-110 shadow-sm shadow-amber-400/50'
                        : 'border-neutral-700 bg-neutral-800'
                    }`}
                  />
                ))}
              </div>

              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/[^0-9]/g, ''));
                    setPinError(false);
                  }}
                  placeholder="Enter 6-digit Security PIN"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-800/90 border border-neutral-700 text-center font-mono text-lg tracking-widest text-amber-200 focus:outline-hidden focus:border-amber-400"
                  autoFocus
                />
              </div>
            </div>

            {pinError && (
              <div className="flex items-center gap-2 text-rose-400 text-xs justify-center bg-rose-950/40 p-2 rounded-lg border border-rose-900/60">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Incorrect security PIN. Please try again.</span>
              </div>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className="py-3 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 text-base font-semibold text-white transition active:scale-95"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleBackspace}
                className="py-3 rounded-xl bg-neutral-800/30 hover:bg-neutral-800 border border-neutral-700/30 text-xs font-medium text-neutral-400 transition"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="py-3 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 text-base font-semibold text-white transition active:scale-95"
              >
                0
              </button>
              <button
                type="submit"
                disabled={pin.length !== 6}
                className={`py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition active:scale-95 ${
                  pin.length === 6
                    ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-md'
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                }`}
              >
                Unlock
              </button>
            </div>
          </form>
        ) : (
          /* Staff Username & Password mode */
          <form onSubmit={handleStaffSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Staff Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  required
                  value={staffUsername}
                  onChange={(e) => {
                    setStaffUsername(e.target.value);
                    setStaffError('');
                  }}
                  placeholder="e.g. priya_concierge"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-neutral-800/90 border border-neutral-700 text-xs text-white focus:outline-hidden focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Staff Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="password"
                  required
                  value={staffPassword}
                  onChange={(e) => {
                    setStaffPassword(e.target.value);
                    setStaffError('');
                  }}
                  placeholder="Enter staff password"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-neutral-800/90 border border-neutral-700 text-xs text-white focus:outline-hidden focus:border-amber-400"
                />
              </div>
            </div>

            {staffError && (
              <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-950/40 p-2.5 rounded-lg border border-rose-900/60">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{staffError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition active:scale-95 shadow-md mt-2"
            >
              Sign In as Staff
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
