import React, { useState } from 'react';
import {
  Smartphone,
  Laptop,
  Apple,
  X,
  Download,
  CheckCircle2,
  Sparkles,
  Zap,
  PlusSquare,
  ShieldCheck,
  WifiOff,
  BellRing,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: string;
}

export const InstructionsModal: React.FC<InstructionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { settings } = useStore();
  const { isInstallable, isInstalled, platform, browserName, install } = usePWAInstall();

  const [pwaPlatformTab, setPwaPlatformTab] = useState<'desktop' | 'android' | 'ios'>(
    platform === 'ios' ? 'ios' : platform === 'android' ? 'android' : 'desktop'
  );
  const [installing, setInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    setInstalling(true);
    const success = await install();
    setInstalling(false);
    if (success) {
      setInstallSuccess(true);
      setTimeout(() => setInstallSuccess(false), 3000);
    }
  };

  const boutiqueTitle = settings.boutiqueName || 'Neydhal';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 text-neutral-900 my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-neutral-950 via-neutral-900 to-[#52126e] text-white flex items-center justify-between border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#7e1ba8] via-[#52126e] to-[#2d053f] flex items-center justify-center text-[#faebd7] font-serif font-bold text-lg shadow-lg ring-2 ring-amber-300/40 shrink-0">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={boutiqueTitle}
                  className="w-8 h-8 object-contain rounded-xl"
                />
              ) : (
                <span>N</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-serif text-lg sm:text-xl font-bold tracking-wide">
                  {boutiqueTitle} App Installation Guide
                </h3>
                <span className="text-[10px] font-sans px-2.5 py-0.5 rounded-full bg-amber-400 text-neutral-950 font-bold uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                  <Download className="w-3 h-3" />
                  <span>PWA App</span>
                </span>
              </div>
              <p className="text-xs text-amber-200/90 font-light mt-0.5">
                Official step-by-step instructions to install the app on PC, Android, and iPhone
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {/* Banner Intro */}
          <div className="bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-amber-50/60 p-4 sm:p-5 rounded-3xl border border-amber-300 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-neutral-950 font-bold text-sm sm:text-base">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <h4>Install {boutiqueTitle} Directly to Your Device</h4>
            </div>
            <p className="text-neutral-700 leading-relaxed text-xs">
              {boutiqueTitle} is engineered as a modern Progressive Web App (PWA). You can install it directly onto your <strong>Windows PC / Mac Laptop</strong>, <strong>Android phone</strong>, or <strong>Apple iPhone / iPad</strong> with zero app store downloads and minimal storage footprint.
            </p>
          </div>

          {/* 1-Click Install Banner if browser supports beforeinstallprompt */}
          {isInstallable && !isInstalled && (
            <div className="p-4 rounded-2xl bg-neutral-950 text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md border border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-400 text-neutral-950 shrink-0 font-bold">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-white">
                    One-Click Install Ready!
                  </p>
                  <p className="text-neutral-400 text-xs mt-0.5">
                    Detected browser: {browserName}. Tap below to add {boutiqueTitle} directly to your home screen or desktop.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={installing}
                onClick={handleInstallClick}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>{installing ? 'Installing...' : 'Install App Now'}</span>
              </button>
            </div>
          )}

          {isInstalled && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>App is currently installed and running in standalone mode on this device!</span>
            </div>
          )}

          {installSuccess && (
            <div className="p-3.5 bg-emerald-600 text-white text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-xs animate-in zoom-in-95">
              <CheckCircle2 className="w-4 h-4" />
              <span>Success! {boutiqueTitle} has been installed to your device launcher.</span>
            </div>
          )}

          {/* Platform Guide Tabs */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-2.5 flex-wrap">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mr-1">Select Device:</span>
              <button
                type="button"
                onClick={() => setPwaPlatformTab('android')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  pwaPlatformTab === 'android'
                    ? 'bg-neutral-950 text-white shadow-xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                <span>Android Phones & Tablets</span>
              </button>

              <button
                type="button"
                onClick={() => setPwaPlatformTab('ios')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  pwaPlatformTab === 'ios'
                    ? 'bg-neutral-950 text-white shadow-xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                <Apple className="w-3.5 h-3.5 text-rose-500" />
                <span>iPhone & iPad (iOS Safari)</span>
              </button>

              <button
                type="button"
                onClick={() => setPwaPlatformTab('desktop')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  pwaPlatformTab === 'desktop'
                    ? 'bg-neutral-950 text-white shadow-xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                <Laptop className="w-3.5 h-3.5 text-blue-500" />
                <span>PC & Laptops (Windows / Mac)</span>
              </button>
            </div>

            {/* Android Instructions */}
            {pwaPlatformTab === 'android' && (
              <div className="space-y-3 animate-in fade-in">
                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</span>
                  <div>
                    <p className="font-bold text-neutral-900 text-xs">Open in Chrome or Samsung Internet</p>
                    <p className="text-neutral-600 text-xs mt-0.5">
                      Open this boutique website on your Android mobile device using Google Chrome or Samsung Internet.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</span>
                  <div>
                    <p className="font-bold text-neutral-900 text-xs">Tap Browser Menu (three dots ⋮)</p>
                    <p className="text-neutral-600 text-xs mt-0.5">
                      Tap the three vertical dots (⋮) located in the upper-right corner of the browser screen.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</span>
                  <div>
                    <p className="font-bold text-neutral-900 text-xs flex items-center gap-1">
                      <span>Select "Install app" or "Add to Home screen"</span>
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                    </p>
                    <p className="text-neutral-600 text-xs mt-0.5">
                      Confirm by tapping <strong>Install</strong>. The official {boutiqueTitle} icon will appear directly on your home screen and app drawer for instant 1-tap shopping!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* iOS Instructions */}
            {pwaPlatformTab === 'ios' && (
              <div className="space-y-3 animate-in fade-in">
                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</span>
                  <div>
                    <p className="font-bold text-neutral-900 text-xs">Open in Safari Browser</p>
                    <p className="text-neutral-600 text-xs mt-0.5">
                      On your iPhone or iPad, open this boutique URL in the native Apple <strong>Safari</strong> browser.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</span>
                  <div>
                    <p className="font-bold text-neutral-900 text-xs flex items-center gap-1.5">
                      <span>Tap the Share Button (square with arrow ↑)</span>
                    </p>
                    <p className="text-neutral-600 text-xs mt-0.5">
                      Tap the <strong>Share</strong> icon located at the bottom toolbar of Safari.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</span>
                  <div>
                    <p className="font-bold text-neutral-900 text-xs flex items-center gap-1.5">
                      <span>Choose "Add to Home Screen"</span>
                      <PlusSquare className="w-3.5 h-3.5 text-rose-600" />
                    </p>
                    <p className="text-neutral-600 text-xs mt-0.5">
                      Scroll down in the share sheet and tap <strong>"Add to Home Screen"</strong>, then tap <strong>Add</strong> at the top right. {boutiqueTitle} will install cleanly on your home screen.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Desktop PC Instructions */}
            {pwaPlatformTab === 'desktop' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-neutral-900 text-xs">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                    <span>Via Browser Address Bar (Chrome & Edge)</span>
                  </div>
                  <p className="text-neutral-600 text-xs leading-relaxed">
                    Look at the right side of the browser URL bar. Click the <strong>"Install app"</strong> icon (computer with down arrow ⤓).
                  </p>
                  <div className="p-2.5 bg-white rounded-xl border border-neutral-200 text-neutral-800 text-[11px] font-medium flex items-center gap-2">
                    <Download className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Click the icon and select <strong>"Install"</strong>.</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-neutral-900 text-xs">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                    <span>Via Browser Menu Options</span>
                  </div>
                  <p className="text-neutral-600 text-xs leading-relaxed">
                    Click the <strong>three dots (⋮)</strong> at top right &rarr; Click <strong>"Save and Share"</strong> &rarr; Select <strong>"Install Neydhal"</strong>.
                  </p>
                  <div className="p-2.5 bg-white rounded-xl border border-neutral-200 text-neutral-800 text-[11px] font-medium flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Launches in its own standalone, distraction-free desktop window!</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Benefits Grid */}
          <div className="pt-2 border-t border-neutral-200">
            <h5 className="font-bold text-neutral-900 text-xs uppercase tracking-wider mb-3">
              Why Install the {boutiqueTitle} PWA?
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-neutral-900 text-xs">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span>Instant Launch</span>
                </div>
                <p className="text-neutral-500 text-[11px]">
                  Opens instantly from your home screen without browser bars or URL inputs.
                </p>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-neutral-900 text-xs">
                  <WifiOff className="w-4 h-4 text-blue-600" />
                  <span>Offline Browsing</span>
                </div>
                <p className="text-neutral-500 text-[11px]">
                  Cached product catalog works even with patchy network or offline connectivity.
                </p>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-neutral-900 text-xs">
                  <BellRing className="w-4 h-4 text-rose-600" />
                  <span>Restock Chimes</span>
                </div>
                <p className="text-neutral-500 text-[11px]">
                  Receive real-time sound notifications whenever sold-out sarees are restocked.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between shrink-0">
          <p className="text-neutral-500 text-xs">
            Questions? Contact boutique concierge via WhatsApp anytime.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
