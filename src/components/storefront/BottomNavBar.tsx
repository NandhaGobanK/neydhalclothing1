import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Grid, Search, Heart, ShoppingBag, Package } from 'lucide-react';
import { THEME_TEMPLATES, getThemeColors } from '../../utils/theme';

interface BottomNavBarProps {
  activeTab: 'categories' | 'search' | 'wishlist' | 'home';
  onTabChange: (tab: 'categories' | 'search' | 'wishlist') => void;
  onOpenCart: () => void;
  onOpenAccount?: () => void;
  onOpenOrders?: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  onOpenCart,
  onOpenAccount,
  onOpenOrders,
}) => {
  const {
    cartCount,
    wishlist,
    customerOrdersCount,
    customerUnreadChatCount,
    settings,
    isTrackOrderOpen,
    currentCustomer,
    customerNotifications,
    setIsCustomerAccountModalOpen,
    setIsCustomerAuthModalOpen,
  } = useStore();

  const isDark = settings.themeMode === 'dark';
  const themeKey = settings.theme || 'royal_crimson';
  const themeTemplate = THEME_TEMPLATES[themeKey] || THEME_TEMPLATES.royal_crimson;
  const themeColors = getThemeColors(themeKey, settings.themeMode);

  // Real-time theme synchronization derived directly from admin's configured theme
  const primaryColor = themeTemplate.swatchPrimary || '#881337';
  const accentColor = themeTemplate.swatchAccent || '#d97706';
  const activeColor = isDark ? accentColor : primaryColor;
  const badgeColor = accentColor;

  // Dynamic theme background, border, and glow directly matching admin settings
  const navBackgroundStyle: React.CSSProperties = {
    backgroundColor: isDark
      ? `${primaryColor === '#171717' ? '#09090b' : primaryColor}f6`
      : '#ffffffee',
    borderColor: isDark ? `${accentColor}40` : `${primaryColor}25`,
    boxShadow: isDark
      ? `0 -4px 28px ${primaryColor === '#171717' ? 'rgba(0,0,0,0.8)' : `${primaryColor}60`}`
      : `0 -4px 24px ${primaryColor}15`,
  };

  const handleOrdersClick = () => {
    if (currentCustomer) {
      setIsCustomerAccountModalOpen(true);
    } else if (onOpenOrders) {
      onOpenOrders();
    } else if (onOpenAccount) {
      onOpenAccount();
    }
  };

  const unreadNotifsCount = (customerNotifications || []).filter((n) => !n.isRead).length;

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
    {
      id: 'orders' as const,
      label: currentCustomer ? 'My Account' : 'My Orders',
      icon: Package,
      badge:
        customerUnreadChatCount > 0
          ? `${customerUnreadChatCount} 💬`
          : unreadNotifsCount > 0
          ? `${unreadNotifsCount} 🔔`
          : customerOrdersCount > 0
          ? customerOrdersCount
          : undefined,
      action: handleOrdersClick,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md border-t transition-all duration-300 px-2 sm:px-4 py-2"
      style={navBackgroundStyle}
      aria-label="Storefront Bottom Navigation"
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === 'orders' ? isTrackOrderOpen : activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition cursor-pointer ${
                isActive
                  ? 'font-bold'
                  : isDark
                  ? 'text-neutral-300 hover:text-white font-medium'
                  : 'text-neutral-600 hover:text-neutral-950 font-medium'
              }`}
              style={{
                color: isActive ? activeColor : undefined,
                backgroundColor: isActive ? (isDark ? `${accentColor}20` : `${primaryColor}10`) : undefined,
              }}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'
                  }`}
                  style={{
                    color: isActive ? activeColor : undefined,
                  }}
                  fill={isActive && item.id === 'wishlist' ? 'currentColor' : 'none'}
                />
                {item.badge !== undefined && (
                  <span
                    className="absolute -top-1 -right-2 text-white text-[9px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center shadow-xs animate-in zoom-in-75 duration-150"
                    style={{
                      backgroundColor: badgeColor,
                    }}
                    title={`${item.label}: ${item.badge}`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
              {isActive && (
                <span
                  className="w-1.5 h-1.5 rounded-full mt-0.5 transition-colors"
                  style={{ backgroundColor: activeColor }}
                />
              )}
            </button>
          );
        })}

        {/* Bag / Cart Item with Badge */}
        <button
          type="button"
          onClick={onOpenCart}
          className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl font-medium transition cursor-pointer ${
            isDark
              ? 'text-neutral-300 hover:text-white'
              : 'text-neutral-700 hover:text-neutral-950'
          }`}
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 stroke-[1.8]" />
            {cartCount > 0 && (
              <span
                className="absolute -top-1.5 -right-2 text-white text-[9px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center shadow-xs animate-in zoom-in-75 duration-150"
                style={{
                  backgroundColor: badgeColor,
                }}
              >
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
