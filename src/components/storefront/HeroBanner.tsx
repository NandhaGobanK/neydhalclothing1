import React from 'react';
import { useStore } from '../../context/StoreContext';
import { ArrowRight, ShieldCheck, Truck, RefreshCw, Sparkles } from 'lucide-react';

interface HeroBannerProps {
  onExploreCatalog: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ onExploreCatalog }) => {
  const { settings, setIsTrackOrderOpen } = useStore();
  const [bannerError, setBannerError] = React.useState(false);

  React.useEffect(() => {
    setBannerError(false);
  }, [settings.storefrontDisplay?.heroBannerImageUrl]);

  const display = settings.storefrontDisplay || {
    heroHeadline: settings.boutiqueName || 'Handcrafted Heritage Sarees',
    heroSubheadline: '',
    showHeroBanner: true,
    showTrustBadges: false,
    showCraftsmanshipStory: false,
    storyTitle: '',
    storyContent: '',
    showTrackOrder: true,
    freeShippingText: '',
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
            src={(!bannerError && display.heroBannerImageUrl) ? display.heroBannerImageUrl : '/src/assets/images/hero_saree_atelier_1791651761357.jpg'}
            alt="Luxury Saree Boutique Showroom"
            onError={() => setBannerError(true)}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-40 scale-105 transform hover:scale-100 transition-transform duration-1000 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/85 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-neutral-950/60" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28">
          <div className="max-w-2xl">
            {/* Dynamic text kicker configured by admin */}
            {display.heroKickerTags && display.heroKickerTags.length > 0 ? (
              <div className="flex items-center gap-2 text-amber-400 text-xs tracking-widest font-semibold uppercase mb-4 flex-wrap">
                {display.heroKickerTags.map((tag, i) => (
                  <React.Fragment key={i}>
                    <span>{tag}</span>
                    {i < display.heroKickerTags!.length - 1 && <span aria-hidden="true">·</span>}
                  </React.Fragment>
                ))}
              </div>
            ) : settings.tagline ? (
              <div className="text-amber-400 text-xs tracking-widest font-semibold uppercase mb-4">
                <span>{settings.tagline}</span>
              </div>
            ) : null}

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif font-bold text-white tracking-tight leading-[1.1] mb-6">
              {display.heroHeadline || settings.boutiqueName || 'Handcrafted Heritage Sarees'}
            </h1>

            {display.heroSubheadline && (
              <p className="text-neutral-300 text-base sm:text-lg mb-8 leading-relaxed font-light">
                {display.heroSubheadline}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={onExploreCatalog}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm transition-all shadow-lg shadow-amber-500/20 whitespace-nowrap"
              >
                <span>Explore Boutique Catalog</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Delivery & Assurance Strip below hero if enabled */}
          {display.showTrustBadges && display.freeShippingText && (
            <div className="mt-12 sm:mt-16 pt-8 border-t border-neutral-800/80">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 text-sm max-w-xl">
                <Truck className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="font-semibold text-white">Delivery Information: </span>
                  <span className="text-neutral-300">{display.freeShippingText}</span>
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
            {display.storyTitle && (
              <h3 className="font-serif text-2xl font-bold text-neutral-900 mb-3">
                {display.storyTitle}
              </h3>
            )}
            <p className="text-neutral-700 text-xs sm:text-sm leading-relaxed font-light">
              {display.storyContent}
            </p>
          </div>
        </section>
      )}
    </>
  );
};
