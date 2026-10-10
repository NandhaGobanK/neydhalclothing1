import React from 'react';
import { useStore } from '../../context/StoreContext';
import { ShoppingBag, Lock, ShieldCheck } from 'lucide-react';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface HeaderProps {
  onOpenAdmin: () => void;
  onSelectCategory?: (category: string) => void;
  selectedCategory?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAdmin,
  onSelectCategory,
  selectedCategory = 'all',
}) => {
  const { settings, cartCount, setIsCartOpen, isAdminLoggedIn } = useStore();

  const categories = [
    { id: 'all', label: 'All Sarees' },
    { id: 'Kanjivaram Silk', label: 'Kanjivaram' },
    { id: 'Banarasi Brocade', label: 'Banarasi' },
    { id: 'Chanderi Tissue', label: 'Chanderi' },
    { id: 'Pure Georgette', label: 'Georgette' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-neutral-900/95 backdrop-blur-md border-b border-neutral-800 text-white">
      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#"
          className="text-xl sm:text-2xl font-serif font-bold tracking-wider text-amber-100 hover:text-white transition whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-rose-700 flex items-center justify-center text-amber-100 font-serif font-bold text-sm shadow-inner">
            आ
          </span>
          <span>{settings.boutiqueName}</span>
        </a>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-neutral-300">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory?.(cat.id)}
              className={`hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 pb-1 ${
                selectedCategory === cat.id
                  ? 'text-amber-400 border-b-2 border-amber-400 font-semibold'
                  : 'text-neutral-300'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Actions (PWA install, Cart bag, Discreet Admin) */}
        <div className="flex items-center gap-3 shrink-0">
          <PWAInstallButton variant="header" />

          {/* Cart Bag Button */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-amber-200 transition-colors flex items-center justify-center"
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

          {/* Discreet Admin Portal Button */}
          <button
            onClick={onOpenAdmin}
            className={`p-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              isAdminLoggedIn
                ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/80'
                : 'bg-neutral-800/80 border border-neutral-700/60 text-neutral-400 hover:text-amber-200 hover:border-amber-500/40'
            }`}
            title={isAdminLoggedIn ? 'Open Admin Dashboard' : 'Owner Login'}
          >
            {isAdminLoggedIn ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Admin Mode</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Owner</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Category Scrollable Tab Strip */}
      <div className="lg:hidden flex items-center gap-2 px-4 py-2 overflow-x-auto no-scrollbar border-t border-neutral-800 bg-neutral-950/80">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelectCategory?.(cat.id)}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-medium'
                : 'text-neutral-400 hover:text-neutral-200 bg-neutral-900 border border-neutral-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </header>
  );
};
