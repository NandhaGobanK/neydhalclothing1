import React from 'react';
import { useStore } from '../../context/StoreContext';
import { ShoppingBag, Lock, ShieldCheck, Truck, BookOpen, Heart, Sparkles, User, Store, Bell } from 'lucide-react';
import { getThemeColors } from '../../utils/theme';
import { isProductRestocked } from '../../utils/productValidation';

interface HeaderProps {
  onOpenAdmin: () => void;
  onOpenInstructions?: () => void;
  onSelectCategory?: (category: string) => void;
  onSelectWishlist?: () => void;
  selectedCategory?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAdmin,
  onOpenInstructions,
  onSelectCategory,
  onSelectWishlist,
  selectedCategory = 'all',
}) => {
  const {
    settings,
    isAdminLoggedIn,
    publicProducts,
    categories: boutiqueCategories,
    currentCustomer,
    setIsCustomerAuthModalOpen,
    setCustomerActiveTab,
  } = useStore();
  const themeColors = getThemeColors(settings.theme, settings.themeMode);
  const [logoError, setLogoError] = React.useState(false);

  React.useEffect(() => {
    setLogoError(false);
  }, [settings.logoUrl]);

  // Check if any product in a category has been restocked (with duration check)
  const isCatRestocked = React.useCallback(
    (catId: string) => {
      if (catId === 'all') {
        return publicProducts.some(
          (p) => isProductRestocked(p, settings?.restockTagDurationHours) && p.stockStatus !== 'out_of_stock' && (p.stockCount ?? 1) > 0
        );
      }
      return publicProducts.some(
        (p) =>
          ((p.category && p.category.toLowerCase() === catId.toLowerCase()) ||
            (p.fabric && p.fabric.toLowerCase() === catId.toLowerCase())) &&
          isProductRestocked(p, settings?.restockTagDurationHours) &&
          p.stockStatus !== 'out_of_stock' &&
          (p.stockCount ?? 1) > 0
      );
    },
    [publicProducts, settings?.restockTagDurationHours]
  );

  // Only display fabric keywords that are published from the admin page
  const publishedFabrics = React.useMemo(() => {
    const set = new Set<string>();
    publicProducts.forEach((p) => {
      if (p.fabric && p.fabric.trim()) {
        set.add(p.fabric.trim());
      }
    });
    return Array.from(set).sort();
  }, [publicProducts]);

  const categories = React.useMemo(() => {
    if (boutiqueCategories && boutiqueCategories.length > 0) {
      return [
        { id: 'all', label: 'All Categories' },
        ...boutiqueCategories.map((c) => ({ id: c.name, label: c.name })),
      ];
    }
    return [
      { id: 'all', label: 'All Products' },
      ...publishedFabrics.map((fab) => ({ id: fab, label: fab })),
    ];
  }, [boutiqueCategories, publishedFabrics]);

  const showTrackOrder = settings.storefrontDisplay?.showTrackOrder !== false;

  const handleLogoEmblemClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <header className={`sticky top-0 z-50 ${themeColors.headerBg.replace(/\/95$/, '')} shadow-md border-b ${themeColors.headerBorder} ${themeColors.headerText} transition-colors duration-200`}>
      {/* Main Bar: Brand Logo & Wordmark on Left, Clean Utility Icons on Right */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Logo & Wordmark */}
        <a
          href="#"
          onClick={handleLogoEmblemClick}
          className="text-xl sm:text-2xl font-serif font-bold tracking-wider text-amber-100 hover:text-white transition whitespace-nowrap shrink-0 flex items-center gap-3 select-none"
          title={`${settings.boutiqueName} Boutique`}
        >
          {settings.logoUrl && !logoError ? (
            <img
              src={settings.logoUrl}
              alt={settings.boutiqueName}
              onError={() => setLogoError(true)}
              className="h-9 sm:h-11 w-auto max-w-[140px] sm:max-w-[180px] object-contain rounded-md"
            />
          ) : (
            /* Shiny Neydhal Royal Purple App Logo */
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7e1ba8] via-[#52126e] to-[#2d053f] flex items-center justify-center text-[#faebd7] font-serif font-bold text-sm shadow-[0_4px_16px_rgba(82,18,110,0.65),inset_0_1.5px_2px_rgba(255,255,255,0.7)] ring-1 ring-amber-300/40 relative overflow-hidden group shrink-0">
              <span className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/5 to-transparent h-1/2 pointer-events-none rounded-t-full"></span>
              <span className="absolute -inset-full group-hover:inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent transition-all duration-700 pointer-events-none"></span>
              <span className="relative z-10 drop-shadow-sm tracking-normal">N</span>
            </span>
          )}
          <span className="truncate max-w-[180px] sm:max-w-none">{settings.boutiqueName}</span>
        </a>

        {/* Zone 2: Actions & Utilities (Instructions, My Account Pill, Admin indicator) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={onOpenInstructions}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="View store shopping & app installation instructions"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Instructions</span>
          </button>

          {/* My Account Pill Button (Matches screenshot image_3af3307a.png) */}
          <button
            onClick={() => {
              if (currentCustomer) {
                setCustomerActiveTab('account');
              } else {
                setIsCustomerAuthModalOpen(true);
              }
            }}
            className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#591b07] hover:bg-[#6c2109] border border-[#a83a15]/90 text-amber-100 text-xs font-bold tracking-wide transition shadow-sm cursor-pointer select-none"
            title={currentCustomer ? `My Account (${currentCustomer.name}) - View details & saved addresses` : 'Sign In / My Account'}
          >
            <User className="w-3.5 h-3.5 text-[#fbbf24] stroke-[2.3]" />
            <span className="uppercase font-bold tracking-wider text-[11px] sm:text-xs text-[#fef08a]">
              {currentCustomer ? currentCustomer.name.split(' ')[0].toUpperCase() : 'MY ACCOUNT'}
            </span>
            <span
              className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#3b1103] shrink-0"
              title="Online & Verified"
            />
          </button>

          {/* Invisible Admin Portal indicator when logged in */}
          {isAdminLoggedIn && (
            <button
              onClick={onOpenAdmin}
              className="p-2 rounded-lg text-xs font-semibold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/80 flex items-center gap-1.5 transition cursor-pointer"
              title="Return to Admin Dashboard"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Dedicated Saree Categories Navigation Strip (Separated from utility icons!) */}
      <nav aria-label="Saree Collections & Categories" className="border-t border-white/10 bg-[#2d053f] sm:bg-[#280437] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 text-xs">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const restocked = isCatRestocked(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => onSelectCategory?.(cat.id)}
                  className={`px-3 py-1 rounded-full whitespace-nowrap transition shrink-0 flex items-center gap-1.5 cursor-pointer font-medium text-xs ${
                    isSelected
                      ? 'bg-amber-400 text-neutral-950 font-bold shadow-xs'
                      : 'text-neutral-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>{cat.label}</span>
                  {restocked && (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5 ${
                        isSelected ? 'bg-neutral-950 text-amber-300' : 'bg-emerald-600 text-white'
                      }`}
                    >
                      <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                      <span>Restocked</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </header>
  );
};
