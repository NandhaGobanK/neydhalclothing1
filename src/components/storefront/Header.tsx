import React from 'react';
import { useStore } from '../../context/StoreContext';
import { ShoppingBag, Lock, ShieldCheck, Truck, BookOpen, Heart, Sparkles, User, Store } from 'lucide-react';
import { getThemeColors } from '../../utils/theme';

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
    cartCount,
    wishlist,
    setIsCartOpen,
    isAdminLoggedIn,
    setIsTrackOrderOpen,
    publicProducts,
    categories: boutiqueCategories,
    customerUnreadChatCount,
    currentCustomer,
    setIsCustomerAuthModalOpen,
    setIsCustomerAccountModalOpen,
    currentReseller,
    setIsResellerPortalOpen,
  } = useStore();
  const themeColors = getThemeColors(settings.theme, settings.themeMode);
  const [logoError, setLogoError] = React.useState(false);

  React.useEffect(() => {
    setLogoError(false);
  }, [settings.logoUrl]);

  // Check if any product in a category has been restocked
  const isCatRestocked = React.useCallback(
    (catId: string) => {
      if (catId === 'all') {
        return publicProducts.some(
          (p) => p.isRestocked && p.stockStatus !== 'out_of_stock' && (p.stockCount ?? 1) > 0
        );
      }
      return publicProducts.some(
        (p) =>
          ((p.category && p.category.toLowerCase() === catId.toLowerCase()) ||
            (p.fabric && p.fabric.toLowerCase() === catId.toLowerCase())) &&
          p.isRestocked &&
          p.stockStatus !== 'out_of_stock' &&
          (p.stockCount ?? 1) > 0
      );
    },
    [publicProducts]
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
    <header className={`sticky top-0 z-40 ${themeColors.headerBg} backdrop-blur-md border-b ${themeColors.headerBorder} ${themeColors.headerText} transition-colors duration-200`}>
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

        {/* Zone 2: Actions & Utilities (Track Order, Instructions, Customer Account, Wishlist, Cart) */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {showTrackOrder && (
            <button
              onClick={() => setIsTrackOrderOpen(true)}
              className="relative px-2.5 py-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Track Order Status"
            >
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Track Order</span>
              {customerUnreadChatCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-600 text-white font-bold animate-pulse shadow-xs">
                  <span>{customerUnreadChatCount}</span>
                </span>
              )}
            </button>
          )}

          <button
            onClick={onOpenInstructions}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="View store shopping & app installation instructions"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Instructions</span>
          </button>

          {/* Customer Account / Sign In Button */}
          {currentCustomer ? (
            <button
              onClick={() => setIsCustomerAccountModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title={`My Account (${currentCustomer.name})`}
            >
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline max-w-[90px] truncate">{currentCustomer.name.split(' ')[0]}</span>
            </button>
          ) : (
            <button
              onClick={() => setIsCustomerAuthModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Customer Sign In / Register"
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}

          {/* Customer Wishlist Button */}
          {onSelectWishlist && (
            <button
              onClick={onSelectWishlist}
              className="relative p-2.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-amber-200 transition-colors flex items-center justify-center cursor-pointer"
              aria-label="View Saved Wishlist"
              title="Saved Wishlist"
            >
              <Heart className="w-4 h-4 sm:w-5 sm:h-5" />
              {wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center shadow-md animate-in zoom-in-75 duration-150">
                  {wishlist.length}
                </span>
              )}
            </button>
          )}

          {/* Cart Bag Button */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-amber-200 transition-colors flex items-center justify-center cursor-pointer"
            aria-label="View Shopping Bag"
            title="Shopping Bag"
          >
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-neutral-950 text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md animate-in zoom-in-75 duration-150">
                {cartCount}
              </span>
            )}
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
      <nav aria-label="Saree Collections & Categories" className="border-t border-white/10 bg-black/25 backdrop-blur-xs">
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
