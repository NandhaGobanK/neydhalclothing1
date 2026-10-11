import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  X,
  Check,
  ExternalLink,
  Laptop,
  Apple,
  Chrome,
  Sparkles,
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useStore } from '../../context/StoreContext';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'banner' | 'admin-header';
  label?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header',
  label,
}) => {
  const { settings } = useStore();
  const { isInstalled, hasPromptReady, isIOS, isAndroid, isInIframe, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'desktop'>(
    isIOS ? 'ios' : isAndroid ? 'android' : 'desktop'
  );

  const boutiqueTitle = settings.boutiqueName || 'Aara Sarees';

  // If already running in standalone mode
  if (isInstalled || justInstalled) {
    if (variant === 'banner') {
      return (
        <div className="bg-emerald-950/70 border border-emerald-600/30 rounded-xl p-3 flex items-center gap-3 text-emerald-200 text-xs">
          <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
            <Check className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-white">{boutiqueTitle} is Installed</p>
            <p className="text-emerald-300/80 text-[11px]">Running in native standalone app mode with offline access.</p>
          </div>
        </div>
      );
    }
    return null;
  }

  const handleButtonClick = async () => {
    // If the browser prompt is ready, trigger native installation directly
    if (hasPromptReady) {
      const res = await install();
      if (res.success) {
        setJustInstalled(true);
        return;
      }
    }
    // Otherwise open the guided installation modal
    setShowGuideModal(true);
  };

  const handleDirectInstallInsideModal = async () => {
    if (hasPromptReady) {
      const res = await install();
      if (res.success) {
        setJustInstalled(true);
        setShowGuideModal(false);
      }
    }
  };

  const handleOpenInNewWindow = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      {variant === 'header' && (
        <button
          onClick={handleButtonClick}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 hover:text-white transition-all whitespace-nowrap shrink-0 shadow-xs cursor-pointer ${className}`}
          title={`Install ${boutiqueTitle} on your device`}
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-300" />
          <span>{label || 'Install App'}</span>
        </button>
      )}

      {variant === 'admin-header' && (
        <button
          onClick={handleButtonClick}
          className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold border border-amber-500/40 transition whitespace-nowrap cursor-pointer shadow-xs ${className}`}
          title="Install Staff/Admin App on Phone or Desktop"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" />
          <span>{label || 'Install Staff App'}</span>
        </button>
      )}

      {variant === 'banner' && (
        <div className={`bg-gradient-to-r from-neutral-900 via-neutral-950 to-amber-950/80 border border-amber-600/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-100 shadow-md ${className}`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-300 border border-amber-500/30 shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-white text-sm">Install {boutiqueTitle} App</p>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  PWA Ready
                </span>
              </div>
              <p className="text-amber-200/80 text-xs mt-0.5">
                Install on your Android, iPhone, or Desktop for 1-tap instant catalog access & offline shopping.
              </p>
            </div>
          </div>
          <button
            onClick={handleButtonClick}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs whitespace-nowrap transition-colors shadow-sm cursor-pointer shrink-0 text-center"
          >
            {hasPromptReady ? 'Install Now (1-Tap)' : 'Install Instructions'}
          </button>
        </div>
      )}

      {/* Interactive Installation Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-neutral-200 text-neutral-900 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between mb-4 border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-700 to-amber-600 flex items-center justify-center text-white font-serif font-bold text-base shadow-sm">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="w-7 h-7 object-contain rounded-lg" />
                  ) : (
                    <span>आ</span>
                  )}
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-neutral-900">
                    Install {boutiqueTitle}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Native app experience without app store downloads
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* If 1-click prompt is ready */}
            {hasPromptReady && (
              <div className="mb-4 p-3.5 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Direct 1-Tap Installation Available!</span>
                </div>
                <button
                  onClick={handleDirectInstallInsideModal}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Click Here to Install Now</span>
                </button>
              </div>
            )}

            {/* Notice if in iframe preview */}
            {isInIframe && (
              <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-900 text-xs space-y-2">
                <p className="font-medium">
                  <strong>Preview Notice:</strong> If you are inside an embedded window, browsers restrict native install popups inside iframes.
                </p>
                <button
                  onClick={handleOpenInNewWindow}
                  className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Full Browser Tab to Install</span>
                </button>
              </div>
            )}

            {/* Device tabs */}
            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl mb-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('android')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'android'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <Chrome className="w-3.5 h-3.5 text-emerald-600" />
                <span>Android</span>
              </button>
              <button
                onClick={() => setActiveTab('ios')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'ios'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <Apple className="w-3.5 h-3.5 text-neutral-800" />
                <span>iPhone / iPad</span>
              </button>
              <button
                onClick={() => setActiveTab('desktop')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'desktop'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <Laptop className="w-3.5 h-3.5 text-blue-600" />
                <span>PC / Mac</span>
              </button>
            </div>

            {/* Tab content */}
            <div className="space-y-3 text-xs text-neutral-700 bg-neutral-50 p-4 rounded-2xl border border-neutral-200">
              {activeTab === 'android' && (
                <ol className="space-y-3">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[11px] shrink-0">
                      1
                    </span>
                    <span>
                      Open this store in <strong>Google Chrome</strong> or <strong>Samsung Internet</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[11px] shrink-0">
                      2
                    </span>
                    <span>
                      Tap the <strong>three dots (⋮)</strong> menu in the top right corner.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[11px] shrink-0">
                      3
                    </span>
                    <span>
                      Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[11px] shrink-0">
                      4
                    </span>
                    <span>
                      Confirm <strong>"Install"</strong>. The app icon will appear on your phone's home screen!
                    </span>
                  </li>
                </ol>
              )}

              {activeTab === 'ios' && (
                <ol className="space-y-3">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-800 font-bold flex items-center justify-center text-[11px] shrink-0">
                      1
                    </span>
                    <span>
                      Open this store in <strong>Apple Safari</strong> on your iPhone or iPad.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-800 font-bold flex items-center justify-center text-[11px] shrink-0">
                      2
                    </span>
                    <span>
                      Tap the <strong>Share</strong> button (box with upward arrow) in the bottom toolbar.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-800 font-bold flex items-center justify-center text-[11px] shrink-0">
                      3
                    </span>
                    <span>
                      Scroll down and tap <strong>"Add to Home Screen"</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-800 font-bold flex items-center justify-center text-[11px] shrink-0">
                      4
                    </span>
                    <span>
                      Tap <strong>"Add"</strong> in the top right corner. The app will launch like a native iOS app!
                    </span>
                  </li>
                </ol>
              )}

              {activeTab === 'desktop' && (
                <ol className="space-y-3">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-[11px] shrink-0">
                      1
                    </span>
                    <span>
                      Open in <strong>Chrome, Edge, or Brave</strong> on your computer.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-[11px] shrink-0">
                      2
                    </span>
                    <span>
                      Look for the <strong>Install App icon (⊕ or screen with down arrow)</strong> inside the URL address bar on the right side.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-[11px] shrink-0">
                      3
                    </span>
                    <span>
                      Click <strong>"Install"</strong> to place a standalone app on your desktop and dock.
                    </span>
                  </li>
                </ol>
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-5 flex items-center gap-2">
              <button
                onClick={() => setShowGuideModal(false)}
                className="w-full rounded-xl bg-neutral-900 py-2.5 text-xs font-bold text-white hover:bg-neutral-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
