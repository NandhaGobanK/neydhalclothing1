import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Lock, KeyRound, AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';

interface AdminAuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ onClose, onSuccess }) => {
  const { adminLogin } = useStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminLogin(pin)) {
      onSuccess();
    } else {
      setError(true);
      setPin('');
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
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
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-rose-700 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-rose-950/50">
            <Lock className="w-6 h-6 text-amber-100" />
          </div>
          <h2 className="font-serif text-xl font-bold text-white">Owner Portal</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Restricted boutique management dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex justify-center gap-2 mb-2">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border transition-all ${
                    idx < pin.length
                      ? 'bg-amber-400 border-amber-400 scale-110'
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
                  setPin(e.target.value);
                  setError(false);
                }}
                placeholder="Enter 4-digit Security PIN"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-800/90 border border-neutral-700 text-center font-mono text-lg tracking-widest text-amber-200 focus:outline-hidden focus:border-amber-400"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-400 text-xs justify-center bg-rose-950/40 p-2 rounded-lg border border-rose-900/60">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Incorrect PIN. Try default: 8899</span>
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2 pt-2">
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
              className="py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition active:scale-95"
            >
              Unlock
            </button>
          </div>

          <div className="pt-2 text-center">
            <span className="text-[11px] text-neutral-500">
              Default boutique demo PIN: <strong className="text-amber-300 font-mono">8899</strong>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};
