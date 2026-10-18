import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Home, Grid, Search, Heart, ShoppingBag, User } from 'lucide-react';

interface BottomNavBarProps {
  activeTab: 'categories' | 'search' | 'wishlist' | 'home';
  onTabChange: (tab: 'categories' | 'search' | 'wishlist') => void;
  onOpenCart: () => void;
  onOpenAccount?: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  onOpenCart,
}) => {
  const { cartCount, wishlist } = useStore();

  const navItems = [
    {
      id: 'categories' as const,
      label: 'Categories',
      icon: Grid,
      action: () => onTabChange('categories'),
    },
    {
      id: 'search' as const,
      label: 'Search',
      icon: Search,
      action: () => onTabChange('search'),
    },
    {
      id: 'wishlist' as const,
      label: 'Wishlist',
      icon: Heart,
      badge: wishlist.length > 0 ? wishlist.length : undefined,
      action: () => onTabChange('wishlist'),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 sm:px-4 py-2 transition-transform duration-200"
      aria-label="Storefront Bottom Navigation"
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition cursor-pointer ${
                isActive
                  ? 'text-rose-900 font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 font-medium'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110 text-rose-900 stroke-[2.4]' : 'stroke-[1.8]'
                  }`}
                  fill={isActive && item.id === 'wishlist' ? 'currentColor' : 'none'}
                />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 bg-rose-700 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-xs">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-rose-900 mt-0.5" />
              )}
            </button>
          );
        })}

        {/* Bag / Cart Item with Badge */}
        <button
          type="button"
          onClick={onOpenCart}
          className="relative flex flex-col items-center justify-center py-1 px-3 rounded-xl text-neutral-700 hover:text-neutral-950 font-medium transition cursor-pointer"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 stroke-[1.8]" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-amber-600 text-white text-[9px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center shadow-xs">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Cart</span>
        </button>
      </div>
    </nav>
  );
};
