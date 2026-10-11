import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Lock, Phone, Mail, MapPin, Instagram, Heart } from 'lucide-react';

interface FooterProps {
  onOpenAdmin: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenAdmin }) => {
  const { settings, isAdminLoggedIn, setIsTrackOrderOpen } = useStore();
  const [logoErr, setLogoErr] = React.useState(false);

  React.useEffect(() => {
    setLogoErr(false);
  }, [settings.logoUrl]);

  return (
    <footer className="bg-neutral-950 text-neutral-400 border-t border-neutral-800 text-xs mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              {settings.logoUrl && !logoErr && (
                <img
                  src={settings.logoUrl}
                  alt={settings.boutiqueName}
                  onError={() => setLogoErr(true)}
                  className="h-9 w-auto max-w-[140px] object-contain rounded-md"
                />
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
                  <span className="text-neutral-300">{settings.instagramHandle}</span>
                </li>
              )}
              {settings.storeAddress && (
                <li className="flex items-start gap-2 pt-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-[11px] text-neutral-400">{settings.storeAddress}</span>
                </li>
              )}
            </ul>
          </div>

          {/* Boutique Policies if configured by admin & Admin portal link */}
          <div className="space-y-3">
            {settings.storefrontDisplay?.footerPolicies && settings.storefrontDisplay.footerPolicies.length > 0 && (
              <>
                <h4 className="font-serif text-sm font-semibold text-white uppercase tracking-wider">
                  Boutique Policy
                </h4>
                <ul className="space-y-2 text-xs text-neutral-400">
                  {settings.storefrontDisplay.footerPolicies.map((pol, idx) => (
                    <li key={idx}>{pol}</li>
                  ))}
                </ul>
              </>
            )}

            <div className="pt-3">
              <button
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-amber-300 border border-neutral-800 transition text-[11px]"
              >
                <Lock className="w-3 h-3 text-amber-400" />
                <span>{isAdminLoggedIn ? 'Return to Admin Dashboard' : 'Store Owner Portal'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-neutral-400">
          <p>© {new Date().getFullYear()} {settings.boutiqueName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};
