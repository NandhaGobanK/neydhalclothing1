import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Lock, Phone, Mail, MapPin, Instagram, Heart } from 'lucide-react';

interface FooterProps {
  onOpenAdmin: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenAdmin }) => {
  const { settings, isAdminLoggedIn, setIsTrackOrderOpen } = useStore();

  return (
    <footer className="bg-neutral-950 text-neutral-400 border-t border-neutral-800 text-xs mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand info */}
          <div className="md:col-span-2 space-y-3">
            <h3 className="font-serif text-xl font-bold text-amber-100 flex items-center gap-2">
              <span>{settings.boutiqueName}</span>
            </h3>
            <p className="text-neutral-400 text-xs leading-relaxed max-w-md font-light">
              Dedicated to preserving India's royal loom traditions. Every saree in our boutique is individually handcrafted by master weavers in Kanchipuram, Varanasi, Chanderi, and Bengal. We support certified handloom weaver cooperatives.
            </p>
            <div className="flex items-center gap-3 text-neutral-300 pt-2">
              <span className="text-[11px] font-semibold text-amber-400">Silk Mark No: SM-892410-IN</span>
              <span aria-hidden="true">·</span>
              <span className="text-[11px] text-neutral-400">Craft Mark Certified</span>
            </div>
          </div>

          {/* Quick Contact & Concierge */}
          <div className="space-y-3">
            <h4 className="font-serif text-sm font-semibold text-white uppercase tracking-wider">
              Atelier Concierge
            </h4>
            <ul className="space-y-2 text-xs text-neutral-400">
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <a href={`tel:${settings.contactPhone}`} className="hover:text-amber-200 transition">
                  {settings.contactPhone}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <a href={`mailto:${settings.contactEmail}`} className="hover:text-amber-200 transition">
                  {settings.contactEmail}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Instagram className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-neutral-300">{settings.instagramHandle}</span>
              </li>
              <li className="flex items-start gap-2 pt-1">
                <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-[11px] text-neutral-400">{settings.storeAddress}</span>
              </li>
            </ul>
          </div>

          {/* Order Assurances & Admin portal link */}
          <div className="space-y-3">
            <h4 className="font-serif text-sm font-semibold text-white uppercase tracking-wider">
              Boutique Policy
            </h4>
            <ul className="space-y-2 text-xs text-neutral-400">
              <li>100% Genuine Handloom Guarantee</li>
              <li>Free Express Insured Dispatch</li>
              <li>Prepaid UPI Order Protection</li>
              <li>Instant UPI Refund on Cancellation</li>
              <li className="pt-1">
                <button
                  onClick={() => setIsTrackOrderOpen(true)}
                  className="text-amber-300 hover:text-white underline font-medium"
                >
                  Track Your Order Status →
                </button>
              </li>
            </ul>

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
          <p>© {new Date().getFullYear()} {settings.boutiqueName}. Handcrafted in India with pure natural silk.</p>
          <div className="flex items-center gap-4">
            <span>Free Local Storage Simulation</span>
            <span>·</span>
            <span>No Recurring Database Cost</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
