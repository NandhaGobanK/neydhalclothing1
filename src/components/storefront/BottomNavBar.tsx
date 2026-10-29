import React from 'react';
import { useStore, CustomerActiveTab } from '../../context/StoreContext';
import { Grid, Search, Heart, ShoppingBag, Package } from 'lucide-react';
import { THEME_TEMPLATES, getThemeColors } from '../../utils/theme';

interface BottomNavBarProps {
  activeTab: CustomerActiveTab;
  onTabChange: (tab: CustomerActiveTab) => void;
  onOpenCart?: () => void;
  onOpenAccount?: () => void;
  onOpenOrders?: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
}) => {
  const {
    cartCount,
    wishlist,
    customerOrdersCount,
    customerUnreadChatCount,
    settings,
    currentCustomer,
    customerNotifications,
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

  const unreadNotifsCount = (customerNotifications || []).filter(
    (n) => !n.read && (n.isRead === undefined || !n.isRead)
  ).length;
  const totalAccountAlerts = (customerUnreadChatCount || 0) + unreadNotifsCount;

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
      badge: wishlist.length > 0 ? (wishlist.length > 99 ? '99+' : wishlist.length) : undefined,
      action: () => onTabChange('wishlist'),
    },
    {
      id: 'orders' as const,
      label: 'My Orders',
      icon: Package,
      badge: totalAccountAlerts > 0 ? (totalAccountAlerts > 9 ? '9+' : totalAccountAlerts) : (customerOrdersCount > 0 ? customerOrdersCount : undefined),
      action: () => onTabChange('orders'),
    },
    {
      id: 'cart' as const,
      label: 'Cart',
      icon: ShoppingBag,
      badge: cartCount > 0 ? (cartCount > 99 ? '99+' : cartCount) : undefined,
      action: () => onTabChange('cart'),
    },
  ];

  const handleNavClick = (action: () => void) => {
    // Reset window scroll to top
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    action();
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md border-t transition-all duration-300 px-2 sm:px-4 py-2"
      style={navBackgroundStyle}
      aria-label="Storefront Bottom Navigation"
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.id === 'orders'
              ? activeTab === 'orders' || activeTab === 'order-detail'
              : activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.action)}
              className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition cursor-pointer ${
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
                    className="absolute -top-1.5 -right-2.5 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow-xs bg-rose-600 leading-none pointer-events-none ring-2 ring-white dark:ring-neutral-900 z-10"
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
      </div>
    </nav>
  );
};
