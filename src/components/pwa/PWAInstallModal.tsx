import React, { useState } from 'react';
import {
  Laptop,
  Smartphone,
  Apple,
  Download,
  X,
  CheckCircle2,
  Share2,
  PlusSquare,
  Sparkles,
  Zap,
  WifiOff,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react';
import { usePWAInstall, PWAUserPlatform } from '../../hooks/usePWAInstall';
import { useStore } from '../../context/StoreContext';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlatform?: PWAUserPlatform;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  initialPlatform,
}) => {
  const { settings } = useStore();
  const {
    isInstallable,
    isInstalled,
    platform: detectedPlatform,
    browserName,
    install,
  } = usePWAInstall();

  const [selectedTab, setSelectedTab] = useState<PWAUserPlatform>(
    initialPlatform || detectedPlatform || 'desktop'
  );
  const [installing, setInstalling] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  if (!isOpen) return null;

  const handleTriggerInstall = async () => {
    setInstalling(true);
    const success = await install();
    setInstalling(false);
    if (success) {
      setInstalledSuccess(true);
      setTimeout(() => {
        setInstalledSuccess(false);
        onClose();
      }, 2500);
    }
  };

  const boutiqueTitle = settings.boutiqueName || 'Neydhal';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 text-neutral-900 my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-neutral-950 via-neutral-900 to-[#52126e] text-white flex items-center justify-between border-b border-neutral-800">
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
                  Install {boutiqueTitle} App
                </h3>
                <span className="text-[10px] font-sans px-2.5 py-0.5 rounded-full bg-amber-400 text-neutral-950 font-bold uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                  <Sparkles className="w-3 h-3" />
                  <span>Progressive Web App</span>
                </span>
              </div>
              <p className="text-xs text-amber-200/90 font-light mt-0.5">
                Versatile cross-platform installation for PC, Laptops, Android & iOS
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

        {/* 1-Click Native Install Callout if device supports it */}
        {isInstallable && !isInstalled && (
          <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 p-4 text-neutral-950 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-neutral-950 text-amber-300 rounded-xl shadow-xs shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm">
                  Instant 1-Click Install Available on Your Device!
                </p>
                <p className="text-xs text-neutral-800 font-medium">
                  {browserName} detected. Tap below to add {boutiqueTitle} directly to your home screen or desktop.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={installing}
              onClick={handleTriggerInstall}
              className="px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs transition shadow-md flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>{installing ? 'Installing...' : 'Install Neydhal Now'}</span>
            </button>
          </div>
        )}

        {/* Success Alert if just installed */}
        {installedSuccess && (
          <div className="bg-emerald-600 text-white p-3 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Success! {boutiqueTitle} has been installed to your device.</span>
          </div>
        )}

        {/* If already running in standalone app mode */}
        {isInstalled && (
          <div className="bg-emerald-50 border-b border-emerald-200 p-3.5 text-xs text-emerald-900 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>You are running {boutiqueTitle} as an installed App!</strong> Enjoy instant 1-tap access and offline shopping.
            </span>
          </div>
        )}

        {/* Platform Selection Tabs */}
        <div className="p-4 sm:p-6 space-y-6">
          <div className="flex items-center justify-between gap-2 border-b border-neutral-200 pb-3 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedTab('desktop')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  selectedTab === 'desktop'
                    ? 'bg-neutral-950 text-white shadow-xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                <Laptop className="w-4 h-4 text-blue-400" />
                <span>PC & Laptops</span>
                {detectedPlatform === 'desktop' && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-white/20 text-white">Your Device</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedTab('android')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  selectedTab === 'android'
                    ? 'bg-neutral-950 text-white shadow-xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Android</span>
                {detectedPlatform === 'android' && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-white/20 text-white">Your Device</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedTab('ios')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  selectedTab === 'ios'
                    ? 'bg-neutral-950 text-white shadow-xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                <Apple className="w-4 h-4 text-rose-400" />
                <span>iPhone & iPad (iOS)</span>
                {detectedPlatform === 'ios' && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-white/20 text-white">Your Device</span>
                )}
              </button>
            </div>
          </div>

          {/* TAB 1: PC & LAPTOPS */}
          {selectedTab === 'desktop' && (
            <div className="space-y-4 text-xs animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 text-blue-950 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-blue-950 mb-0.5">
                    Install on Windows, Mac, Linux & Chromebooks
                  </h4>
                  <p className="text-blue-900 leading-relaxed">
                    Install {boutiqueTitle} directly onto your desktop taskbar or dock. It opens in a clean, dedicated window without browser address bars for a smooth shopping experience.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* Method 1: Address Bar Icon */}
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                  <div className="flex items-center gap-2 text-neutral-900 font-bold text-xs uppercase tracking-wider">
                    <span className="w-5 h-5 rounded-full bg-neutral-950 text-white flex items-center justify-center text-[10px]">1</span>
                    <span>Address Bar Install (Fastest)</span>
                  </div>
                  <p className="text-neutral-600 leading-relaxed">
                    Look at the right side of your browser URL address bar in <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>.
                  </p>
                  <div className="p-3 bg-white rounded-xl border border-neutral-200/80 flex items-center gap-2 text-[11px] text-neutral-800 font-medium">
                    <Download className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Click the <strong>"Install Neydhal"</strong> or computer monitor icon ⤓ next to the bookmark star.</span>
                  </div>
                </div>

                {/* Method 2: Browser 3-Dot Menu */}
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                  <div className="flex items-center gap-2 text-neutral-900 font-bold text-xs uppercase tracking-wider">
                    <span className="w-5 h-5 rounded-full bg-neutral-950 text-white flex items-center justify-center text-[10px]">2</span>
                    <span>Browser Menu Option</span>
                  </div>
                  <p className="text-neutral-600 leading-relaxed">
                    Click the <strong>three dots (⋮)</strong> or settings menu at the top-right of your browser.
                  </p>
                  <div className="p-3 bg-white rounded-xl border border-neutral-200/80 flex items-center gap-2 text-[11px] text-neutral-800 font-medium">
                    <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Select <strong>"Save and Share"</strong> &rarr; <strong>"Install Neydhal"</strong> (or "Apps" &rarr; "Install this site as an app").</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ANDROID */}
          {selectedTab === 'android' && (
            <div className="space-y-4 text-xs animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-950 flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-emerald-950 mb-0.5">
                    Install on Android Phones & Tablets
                  </h4>
                  <p className="text-emerald-900 leading-relaxed">
                    {boutiqueTitle} installs like a native Android APK directly from your browser—no Google Play Store account or large storage space required (takes less than 1MB!).
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-neutral-900">Tap "Install App" or Browser Menu (⋮)</p>
                    <p className="text-neutral-600">
                      In Chrome, Samsung Internet, or Brave, tap the <strong>three dots (⋮)</strong> in the upper right or bottom corner.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-neutral-900">Select "Install App" or "Add to Home Screen"</p>
                    <p className="text-neutral-600">
                      Tap <strong>"Install app"</strong> (or <strong>"Add to Home screen"</strong>) from the dropdown list.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-neutral-900">Confirm & Launch from App Drawer</p>
                    <p className="text-neutral-600">
                      Tap <strong>Install</strong> on the confirmation banner. Neydhal will appear on your phone home screen with its authentic boutique icon!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: APPLE IOS */}
          {selectedTab === 'ios' && (
            <div className="space-y-4 text-xs animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-rose-950 flex items-start gap-3">
                <Apple className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-rose-950 mb-0.5">
                    Install on iPhone & iPad (iOS Safari)
                  </h4>
                  <p className="text-rose-900 leading-relaxed">
                    Apple iOS supports Progressive Web Apps via Safari's native "Add to Home Screen" feature. Follow these 3 simple steps:
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-rose-700 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-neutral-900 flex items-center gap-1.5">
                      <span>Tap the Share Button</span>
                      <Share2 className="w-3.5 h-3.5 text-blue-600" />
                    </p>
                    <p className="text-neutral-600">
                      Open this store in <strong>Safari</strong> on your iPhone or iPad. Tap the <strong>Share</strong> icon (the square with an arrow pointing up) at the bottom toolbar.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-rose-700 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-neutral-900 flex items-center gap-1.5">
                      <span>Choose "Add to Home Screen"</span>
                      <PlusSquare className="w-3.5 h-3.5 text-neutral-700" />
                    </p>
                    <p className="text-neutral-600">
                      Scroll down through the share options sheet and tap <strong>"Add to Home Screen"</strong>.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-rose-700 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-neutral-900">Tap "Add" in the Top Right</p>
                    <p className="text-neutral-600">
                      Tap <strong>Add</strong> in the top-right corner. The Neydhal app icon will now appear right on your iPhone home screen!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Key Advantages Matrix */}
          <div className="pt-2 border-t border-neutral-100">
            <h4 className="font-bold text-xs text-neutral-900 uppercase tracking-wider mb-2.5">
              Why Install as a Progressive Web App?
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
              <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                <span><strong>Instant Launch</strong> directly from your home screen</span>
              </div>
              <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-blue-600 shrink-0" />
                <span><strong>Offline Cache</strong> for seamless saree catalog browsing</span>
              </div>
              <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span><strong>Zero Storage Bloat</strong> & auto-updated weaver stock</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-neutral-500">
            Need help? Reach out on boutique WhatsApp anytime.
          </p>

          <div className="flex items-center gap-2">
            {isInstallable && (
              <button
                type="button"
                onClick={handleTriggerInstall}
                className="px-4 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Install Now</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold text-xs hover:bg-neutral-100 transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
