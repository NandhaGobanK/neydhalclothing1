import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Lock, Phone, Mail, MapPin, Instagram, Heart, Navigation, ExternalLink, ShieldCheck, FileText, Youtube, AlertCircle, BookOpen, Download, Smartphone, Truck } from 'lucide-react';
import { getThemeColors } from '../../utils/theme';
import { isCustomerReportIssueVisible } from '../../utils/disputeRedressals';

interface FooterProps {
  onOpenAdmin: () => void;
  onOpenInstructions?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenAdmin, onOpenInstructions }) => {
  const { settings, isAdminLoggedIn, setIsTrackOrderOpen } = useStore();
  const themeColors = getThemeColors(settings.theme, settings.themeMode);
  const [logoErr, setLogoErr] = React.useState(false);

  // Secret admin trigger via copyright symbol
  const footerClickCount = React.useRef(0);
  const handleSecretAdminTrigger = () => {
    footerClickCount.current += 1;
    if (footerClickCount.current >= 3) {
      footerClickCount.current = 0;
      onOpenAdmin();
    }
    setTimeout(() => {
      footerClickCount.current = 0;
    }, 1500);
  };

  React.useEffect(() => {
    setLogoErr(false);
  }, [settings.logoUrl]);

  const getInstagramUrl = (handle: string) => {
    if (!handle) return '#';
    const clean = handle.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
    const username = clean.replace(/^@+/, '').replace(/^instagram\.com\//, '').trim();
    return `https://www.instagram.com/${username}/`;
  };

  const getYoutubeUrl = (handle: string) => {
    if (!handle) return '#';
    const clean = handle.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
    const username = clean.startsWith('@') ? clean : `@${clean}`;
    return `https://www.youtube.com/${username}`;
  };

  return (
    <footer className={`${themeColors.footerBg} ${themeColors.footerText} border-t ${themeColors.footerBorder} text-xs mt-16 transition-colors duration-200`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              {settings.logoUrl && !logoErr ? (
                <img
                  src={settings.logoUrl}
                  alt={settings.boutiqueName}
                  onError={() => setLogoErr(true)}
                  className="h-9 w-auto max-w-[140px] object-contain rounded-md"
                />
              ) : (
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7e1ba8] via-[#52126e] to-[#2d053f] flex items-center justify-center text-[#faebd7] font-serif font-bold text-xs shadow-[0_3px_12px_rgba(82,18,110,0.65),inset_0_1px_1.5px_rgba(255,255,255,0.7)] ring-1 ring-amber-300/40 relative overflow-hidden shrink-0">
                  <span className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/5 to-transparent h-1/2 pointer-events-none rounded-t-full"></span>
                  <span className="relative z-10 drop-shadow-sm">N</span>
                </span>
              )}
              <h3 className="font-serif text-xl font-bold text-amber-100">
                {settings.boutiqueName}
              </h3>
            </div>
            {settings.storefrontDisplay?.footerAboutText ? (
              <p className="text-neutral-400 text-xs leading-relaxed max-w-md font-light">
                {settings.storefrontDisplay.footerAboutText}
              </p>
            ) : settings.tagline ? (
              <p className="text-neutral-400 text-xs leading-relaxed max-w-md font-light">
                {settings.tagline}
              </p>
            ) : null}

            {settings.storefrontDisplay?.footerCertifications && settings.storefrontDisplay.footerCertifications.length > 0 && (
              <div className="flex items-center gap-3 text-neutral-300 pt-2 flex-wrap">
                {settings.storefrontDisplay.footerCertifications.map((cert, idx) => (
                  <React.Fragment key={idx}>
                    <span className="text-[11px] font-semibold text-amber-400">{cert}</span>
                    {idx < settings.storefrontDisplay.footerCertifications!.length - 1 && (
                      <span aria-hidden="true" className="text-neutral-600">·</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          {/* Quick Contact & Concierge */}
          <div className="space-y-3">
            <h4 className="font-serif text-sm font-semibold text-white uppercase tracking-wider">
              Atelier Concierge
            </h4>
            <ul className="space-y-2 text-xs text-neutral-400">
              {settings.contactPhone && (
                <li className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <a href={`tel:${settings.contactPhone}`} className="hover:text-amber-200 transition">
                    {settings.contactPhone}
                  </a>
                </li>
              )}
              {settings.contactEmail && (
                <li className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <a href={`mailto:${settings.contactEmail}`} className="hover:text-amber-200 transition">
                    {settings.contactEmail}
                  </a>
                </li>
              )}
              {settings.instagramHandle && (
                <li className="flex items-center gap-2">
                  <Instagram className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <a
                    href={getInstagramUrl(settings.instagramHandle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-300 hover:text-amber-200 transition inline-flex items-center gap-1 group cursor-pointer"
                    title="Open Boutique Instagram Page"
                  >
                    <span>{settings.instagramHandle.startsWith('@') ? settings.instagramHandle : `@${settings.instagramHandle}`}</span>
                    <ExternalLink className="w-2.5 h-2.5 text-neutral-500 group-hover:text-amber-300" />
                  </a>
                </li>
              )}
              {settings.youtubeHandle && (
                <li className="flex items-center gap-2">
                  <Youtube className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <a
                    href={getYoutubeUrl(settings.youtubeHandle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-300 hover:text-amber-200 transition inline-flex items-center gap-1 group cursor-pointer"
                    title="Open YouTube Channel"
                  >
                    <span>{settings.youtubeHandle.startsWith('@') ? settings.youtubeHandle : `@${settings.youtubeHandle}`}</span>
                    <ExternalLink className="w-2.5 h-2.5 text-neutral-500 group-hover:text-amber-300" />
                  </a>
                </li>
              )}
              {settings.storeAddress && (
                <li className="flex items-start gap-2 pt-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-[11px] text-neutral-400">{settings.storeAddress}</span>
                </li>
              )}
              {settings.googleMaps?.enabled && settings.googleMaps.mapUrl && (
                <li className="pt-1.5">
                  <a
                    href={settings.googleMaps.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/50 text-amber-200 hover:text-white transition text-[11px] font-medium"
                  >
                    <Navigation className="w-3.5 h-3.5 text-amber-400" />
                    <span>View on Google Maps</span>
                    <ExternalLink className="w-3 h-3 text-neutral-500" />
                  </a>
                </li>
              )}
              {settings.gstNumber && (
                <li className="pt-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-[11px] text-amber-300 font-mono">
                    <FileText className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>GSTIN: <strong>{settings.gstNumber}</strong></span>
                  </div>
                </li>
              )}
            </ul>
          </div>

          {/* Help & Store Instructions Column */}
          <div className="space-y-3">
            <h4 className="font-serif text-sm font-semibold text-white uppercase tracking-wider">
              Help & Instructions
            </h4>
            <ul className="space-y-2 text-xs text-neutral-400">
              <li>
                <button
                  type="button"
                  onClick={onOpenInstructions}
                  className="hover:text-white text-neutral-300 transition inline-flex items-center gap-1.5 cursor-pointer text-left"
                  title="Cross-platform PWA app installation"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Install App (PC, Android & iOS)</span>
                </button>
              </li>

              {settings.storefrontDisplay?.footerPolicies && settings.storefrontDisplay.footerPolicies.length > 0 && (
                settings.storefrontDisplay.footerPolicies.map((pol, idx) => (
                  <li key={idx} className="text-neutral-400 pt-1 text-[11px]">{pol}</li>
                ))
              )}
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Boutique Branding */}
        <div className="pt-8 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-neutral-400">
          <p>
            <span
              onClick={handleSecretAdminTrigger}
              className="cursor-default select-none hover:text-neutral-300"
              title="Protected Atelier System"
            >
              ©
            </span>{' '}
            {new Date().getFullYear()} {settings.boutiqueName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
