import React, { useState } from 'react';
import { Download, Smartphone, X, Check } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useStore } from '../../context/StoreContext';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header',
}) => {
  const { settings } = useStore();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) {
        setJustInstalled(true);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  // If neither installable nor iOS in standard browser, we can still show a helpful prompt on mobile
  if (!isInstallable && !isIOS) {
    // Optionally return null or fallback
    return null;
  }

  const boutiqueTitle = settings.boutiqueName || 'Boutique';

  return (
    <>
      {variant === 'header' ? (
        <button
          onClick={handleInstallClick}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 transition-colors whitespace-nowrap shrink-0 ${className}`}
          title={`Install ${boutiqueTitle} App`}
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-300" />
          <span>{isIOS ? 'Install on Phone' : 'Install App'}</span>
        </button>
      ) : (
        <div className="bg-amber-950/80 border border-amber-600/30 rounded-xl p-3 flex items-center justify-between gap-3 text-amber-100 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-300">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-white">Install {boutiqueTitle} App</p>
              <p className="text-amber-200/80 text-[11px]">Instant 1-tap catalog access & offline shopping</p>
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-medium text-xs whitespace-nowrap transition-colors"
          >
            {isIOS ? 'Instructions' : 'Install Now'}
          </button>
        </div>
      )}

      {/* iOS Safari Instructions Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-neutral-100 text-neutral-900 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-900 font-bold text-sm">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="w-6 h-6 object-contain rounded-full" />
                  ) : (
                    <span>{boutiqueTitle.slice(0, 2)}</span>
                  )}
                </div>
                <h3 className="font-serif text-lg font-bold text-neutral-900">Install {boutiqueTitle}</h3>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 mb-4 leading-relaxed">
              Add <strong>{boutiqueTitle}</strong> directly to your home screen for instant shopping without opening a browser:
            </p>

            <ol className="space-y-3 text-xs text-neutral-700 bg-neutral-50 p-3 rounded-xl border border-neutral-200/70">
              <li className="flex items-start gap-2">
                <span className="font-bold text-rose-800 bg-rose-50 w-5 h-5 rounded-full flex items-center justify-center text-[11px] shrink-0">1</span>
                <span>Tap the <strong className="text-neutral-900">Share</strong> icon (square with arrow) at the bottom bar of Safari.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-rose-800 bg-rose-50 w-5 h-5 rounded-full flex items-center justify-center text-[11px] shrink-0">2</span>
                <span>Scroll down and tap <strong className="text-neutral-900">"Add to Home Screen"</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-rose-800 bg-rose-50 w-5 h-5 rounded-full flex items-center justify-center text-[11px] shrink-0">3</span>
                <span>Tap <strong className="text-neutral-900">Add</strong> in the top right corner. Enjoy instant boutique access!</span>
              </li>
            </ol>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-xl bg-neutral-900 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 transition"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
