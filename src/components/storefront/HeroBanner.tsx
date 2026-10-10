import React from 'react';
import { useStore } from '../../context/StoreContext';
import { ArrowRight, ShieldCheck, Truck, RefreshCw, Sparkles } from 'lucide-react';

interface HeroBannerProps {
  onExploreCatalog: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ onExploreCatalog }) => {
  const { settings, setIsTrackOrderOpen } = useStore();
  const display = settings.storefrontDisplay || {
    heroHeadline: 'Timeless Drapes, Woven for Generations.',
    heroSubheadline: 'Discover authentic handcrafted Kanjivaram bridal silks, Varanasi Kadwa brocades, and feather-light Chanderi tissue sarees. Direct from the master weavers of India to your doorstep.',
    showHeroBanner: true,
    showTrustBadges: true,
    showCraftsmanshipStory: true,
    storyTitle: 'The Heritage Loom Legacy',
    storyContent: 'Every saree in our collection is an heirloom woven with mulberry silk and authentic zari by master weavers across Kanchipuram and Varanasi.',
    showTrackOrder: true,
    freeShippingText: 'Free Insured Express Delivery across India (Tamper-Proof Box)',
  };

  if (display.showHeroBanner === false) {
    return null;
  }

  return (
    <>
      <div className="relative overflow-hidden bg-neutral-950 text-white">
        {/* Background Hero Image with measured contrast scrim */}
        <div className="absolute inset-0 z-0">
          <img
            src="/src/assets/images/hero_saree_atelier_1791651761357.jpg"
            alt="Luxury Saree Boutique Showroom"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-40 scale-105 transform hover:scale-100 transition-transform duration-1000 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/85 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-neutral-950/60" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28">
          <div className="max-w-2xl">
            {/* Subtle text kicker */}
            <div className="flex items-center gap-2 text-amber-400 text-xs tracking-widest font-semibold uppercase mb-4">
              <span>Direct Artisan Looms</span>
              <span aria-hidden="true">·</span>
              <span>Pure Mulberry Silk</span>
              <span aria-hidden="true">·</span>
              <span>Prepaid UPI Verification</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif font-bold text-white tracking-tight leading-[1.1] mb-6">
              {display.heroHeadline || 'Timeless Drapes, Woven for Generations.'}
            </h1>

            <p className="text-neutral-300 text-base sm:text-lg mb-8 leading-relaxed font-light">
              {display.heroSubheadline ||
                'Discover authentic handcrafted Kanjivaram bridal silks, Varanasi Kadwa brocades, and feather-light Chanderi tissue sarees. Direct from the master weavers of India to your doorstep.'}
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={onExploreCatalog}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm transition-all shadow-lg shadow-amber-500/20 whitespace-nowrap"
              >
                <span>Explore Boutique Catalog</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsTrackOrderOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 font-medium text-sm transition-colors whitespace-nowrap"
              >
                <Truck className="w-4 h-4 text-amber-400" />
                <span>Track My Order</span>
              </button>
            </div>
          </div>

          {/* Trust Strip below hero if enabled */}
          {display.showTrustBadges !== false && (
            <div className="mt-12 sm:mt-16 pt-8 border-t border-neutral-800/80 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Silk Mark Certified</h4>
                  <p className="text-xs text-neutral-400 mt-0.5">100% natural pure silk fibers tested for authenticity.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    {display.freeShippingText ? 'Insured Express Shipping' : 'Insured Delivery'}
                  </h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {display.freeShippingText || 'Free doorstep delivery across India in tamper-proof boxes.'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Guaranteed UPI Refund</h4>
                  <p className="text-xs text-neutral-400 mt-0.5">Instant refund capture during checkout in case of cancellation.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Craftsmanship Story Section (Editable from Admin) */}
      {display.showCraftsmanshipStory && display.storyContent && (
        <section className="bg-amber-50/60 border-b border-amber-200/60 py-10 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-800 uppercase tracking-widest mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Artisan Loom Lineage</span>
            </div>
            <h3 className="font-serif text-2xl font-bold text-neutral-900 mb-3">
              {display.storyTitle || 'The Heritage Loom Legacy'}
            </h3>
            <p className="text-neutral-700 text-xs sm:text-sm leading-relaxed font-light">
              {display.storyContent}
            </p>
          </div>
        </section>
      )}
    </>
  );
};
