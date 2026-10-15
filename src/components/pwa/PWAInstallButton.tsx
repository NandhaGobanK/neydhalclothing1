import React, { useState } from 'react';
import { Download, Smartphone, Laptop, Apple, Check } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useStore } from '../../context/StoreContext';
import { PWAInstallModal } from './PWAInstallModal';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'banner' | 'link';
  onClickGuide?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header',
  onClickGuide,
}) => {
  const { settings } = useStore();
  const { isInstallable, isInstalled, isIOS, isAndroid, platform, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already running inside installed standalone PWA, hide header button
  if (isInstalled && variant === 'header') {
    return null;
  }

  const handleAction = async () => {
    if (onClickGuide) {
      onClickGuide();
      return;
    }

    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setJustInstalled(true);
        setTimeout(() => setJustInstalled(false), 3000);
        return;
      }
    }
    // Open full cross-platform install modal
    setShowModal(true);
  };

  const boutiqueTitle = settings.boutiqueName || 'Neydhal';

  const getPlatformIcon = () => {
    if (isIOS) return <Apple className="w-3.5 h-3.5 text-amber-300" />;
    if (isAndroid) return <Smartphone className="w-3.5 h-3.5 text-emerald-400" />;
    return <Laptop className="w-3.5 h-3.5 text-blue-400" />;
  };

  const getLabel = () => {
    if (justInstalled) return 'App Installed ✓';
    if (isInstalled) return 'App Installed';
    if (isIOS) return 'Install on iOS';
    if (isAndroid) return 'Install App';
    return 'Install App';
  };

  return (
    <>
      {variant === 'header' ? (
        <button
          type="button"
          onClick={handleAction}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-amber-400/50 bg-amber-400/10 hover:bg-amber-400/20 text-amber-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-2xs ${className}`}
          title={`Install ${boutiqueTitle} Progressive Web App across PC, Android & iOS`}
        >
          {justInstalled ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            getPlatformIcon()
          )}
          <span>{getLabel()}</span>
        </button>
      ) : variant === 'banner' ? (
        <div className="bg-gradient-to-r from-[#2d053f] via-[#52126e] to-neutral-950 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-white text-xs shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-400 text-neutral-950 rounded-xl shadow-xs shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-white">
                Install {boutiqueTitle} on PC, Android or iPhone
              </p>
              <p className="text-amber-200/80 text-[11px]">
                Instant 1-tap launcher access, full-screen view & offline saree catalog browsing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAction}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs whitespace-nowrap transition shadow-xs cursor-pointer"
          >
            {isInstallable ? 'Install Now' : 'View Installation Steps'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleAction}
          className={`inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition text-xs font-medium cursor-pointer ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install Store App</span>
        </button>
      )}

      {/* Cross-Platform PWA Installation Guide Modal */}
      <PWAInstallModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        initialPlatform={platform}
      />
    </>
  );
};
