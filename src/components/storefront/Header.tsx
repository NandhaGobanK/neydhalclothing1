import React from 'react';
import { useStore } from '../../context/StoreContext';
import { ShoppingBag, Lock, ShieldCheck, Truck, BookOpen, Heart, Sparkles } from 'lucide-react';
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
      { id: 'all', label: 'All Sarees' },
      ...publishedFabrics.map((fab) => ({ id: fab, label: fab })),
    ];
  }, [boutiqueCategories, publishedFabrics]);

  const showTrackOrder = settings.storefrontDisplay?.showTrackOrder !== false;

  // Secret owner access: Triple-click logo opens admin portal discreetly
  const clickCountRef = React.useRef(0);
  const clickTimerRef = React.useRef<any>(null);

  const handleLogoEmblemClick = (e: React.MouseEvent) => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    if (clickCountRef.current >= 3) {
      e.preventDefault();
      clickCountRef.current = 0;
      onOpenAdmin();
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 1200);
    }
  };

  return (
    <header className={`sticky top-0 z-40 ${themeColors.headerBg} backdrop-blur-md border-b ${themeColors.headerBorder} ${themeColors.headerText} transition-colors duration-200`}>
      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Logo & Wordmark */}
        <a
          href="#"
          onClick={handleLogoEmblemClick}
          className="text-xl sm:text-2xl font-serif font-bold tracking-wider text-amber-100 hover:text-white transition whitespace-nowrap shrink-0 flex items-center gap-3 select-none"
          title="Neydhal Handloom Sarees"
        >
          {settings.logoUrl && !logoError ? (
            <img
              src={settings.logoUrl}
              alt={settings.boutiqueName}
              onError={() => setLogoError(true)}
              className="h-10 sm:h-12 w-auto max-w-[140px] sm:max-w-[180px] object-contain rounded-md"
            />
          ) : (
            /* Shiny Neydhal Royal Purple App Logo */
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7e1ba8] via-[#52126e] to-[#2d053f] flex items-center justify-center text-[#faebd7] font-serif font-bold text-sm shadow-[0_4px_16px_rgba(82,18,110,0.65),inset_0_1.5px_2px_rgba(255,255,255,0.7)] ring-1 ring-amber-300/40 relative overflow-hidden group shrink-0">
              {/* Shiny Gloss Reflex Overlays */}
              <span className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/5 to-transparent h-1/2 pointer-events-none rounded-t-full"></span>
              <span className="absolute -inset-full group-hover:inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent transition-all duration-700 pointer-events-none"></span>
              <span className="relative z-10 drop-shadow-sm tracking-normal">N</span>
            </span>
          )}
          <span className="truncate max-w-[200px] sm:max-w-none">{settings.boutiqueName}</span>
        </a>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-neutral-300">
          {categories.map((cat) => {
            const restocked = isCatRestocked(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory?.(cat.id)}
                className={`hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 pb-1 flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'text-amber-400 border-b-2 border-amber-400 font-semibold'
                    : 'text-neutral-300'
                }`}
              >
                <span>{cat.label}</span>
                {restocked && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-0.5 shadow-2xs">
                    <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                    <span>Restocked</span>
                  </span>
                )}
              </button>
            );
          })}

          {showTrackOrder && (
            <button
              onClick={() => setIsTrackOrderOpen(true)}
              className="relative hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 pb-1 text-neutral-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Truck className="w-4 h-4 text-amber-400" />
              <span>Track Order</span>
              {customerUnreadChatCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-600 text-white font-bold animate-pulse shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  <span>{customerUnreadChatCount} msg</span>
                </span>
              )}
            </button>
          )}

          <button
            onClick={onOpenInstructions}
            className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 pb-1 text-neutral-300 flex items-center gap-1.5 cursor-pointer"
            title="View store shopping & app installation instructions"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>Instructions</span>
          </button>
        </nav>

        {/* Zone 3: Actions (Track Order on mobile/desktop, Wishlist, Cart bag, Discreet Admin) */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {showTrackOrder && (
            <button
              onClick={() => setIsTrackOrderOpen(true)}
              className="relative lg:hidden p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-200 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
              title="Track Order Status"
            >
              <Truck className="w-4 h-4" />
              {customerUnreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>
          )}

          {/* Customer Wishlist Button */}
          {onSelectWishlist && (
            <button
              onClick={onSelectWishlist}
              className="relative p-2.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-amber-200 transition-colors flex items-center justify-center cursor-pointer"
              aria-label="View Saved Wishlist"
              title="Saved Sarees Wishlist"
            >
              <Heart className="w-5 h-5" />
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
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-neutral-950 text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md animate-in zoom-in-75 duration-150">
                {cartCount}
              </span>
            )}
          </button>

          {/* Invisible Admin Portal: Hidden from customers to prevent accidental access.
              Accessible via URL (#admin / /admin), keyboard shortcut (Ctrl+Shift+A), or triple-clicking the logo emblem */}
          {isAdminLoggedIn && (
            <button
              onClick={onOpenAdmin}
              className="p-2 rounded-lg text-xs font-semibold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/80 flex items-center gap-1.5 transition"
              title="Return to Admin Dashboard"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Admin Mode</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Category Scrollable Tab Strip */}
      <div className="lg:hidden flex items-center gap-2 px-4 py-2 overflow-x-auto no-scrollbar border-t border-neutral-800 bg-neutral-950/80">
        {categories.map((cat) => {
          const restocked = isCatRestocked(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory?.(cat.id)}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors flex items-center gap-1 ${
                selectedCategory === cat.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-medium'
                  : 'text-neutral-400 hover:text-neutral-200 bg-neutral-900 border border-neutral-800'
              }`}
            >
              <span>{cat.label}</span>
              {restocked && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-600 text-white">
                  Restocked
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
