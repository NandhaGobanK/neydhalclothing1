import React, { useState, useEffect } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Header } from './components/storefront/Header';
import { AnnouncementBar } from './components/storefront/AnnouncementBar';
import { HeroBanner } from './components/storefront/HeroBanner';
import { ProductGrid } from './components/storefront/ProductGrid';
import { ProductDetailModal } from './components/storefront/ProductDetailModal';
import { CartDrawer } from './components/storefront/CartDrawer';
import { CheckoutModal } from './components/storefront/CheckoutModal';
import { OrderSuccessModal } from './components/storefront/OrderSuccessModal';
import { TrackOrderModal } from './components/storefront/TrackOrderModal';
import { OrderCancellationModal } from './components/storefront/OrderCancellationModal';
import { InstructionsModal } from './components/storefront/InstructionsModal';
import { Footer } from './components/storefront/Footer';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminAuthModal } from './components/admin/AdminAuthModal';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { getThemeColors } from './utils/theme';
import { LogOut, Grid, Sparkles, ArrowRight } from 'lucide-react';
import { useStaffIdleTracker } from './hooks/useStaffIdleTracker';
import { CategoryBrowser } from './components/storefront/CategoryBrowser';
import { WishlistBrowser } from './components/storefront/WishlistBrowser';
import { BottomNavBar } from './components/storefront/BottomNavBar';

function MainAppContent() {
  const {
    products,
    publicProducts,
    categories,
    settings,
    currentView,
    setCurrentView,
    isAdminLoggedIn,
    activeProductModal,
    setActiveProductModal,
    isCheckoutOpen,
    setIsCheckoutOpen,
    isTrackOrderOpen,
    setIsTrackOrderOpen,
    setIsCartOpen,
    lastPlacedOrder,
    setLastPlacedOrder,
    remoteLogoutNotice,
    clearRemoteLogoutNotice,
    customerActiveTab,
    setCustomerActiveTab,
  } = useStore();

  // Keep device activity & 15-minute idle detection active across the app
  useStaffIdleTracker();

  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);

  // Handle URL deep links & redirects (#track, ?order=, /track, #admin, /admin, ?product=, #instructions)
  useEffect(() => {
    const handleUrlRouting = () => {
      if (typeof window === 'undefined') return;
      const hash = window.location.hash;
      const search = window.location.search;
      const pathname = window.location.pathname;

      // 1. Admin link handling (#admin or /admin or ?view=admin)
      if (
        hash === '#admin' ||
        hash.startsWith('#admin') ||
        pathname === '/admin' ||
        search.includes('view=admin')
      ) {
        if (isAdminLoggedIn) {
          setCurrentView('admin');
        } else {
          setShowAdminAuthModal(true);
        }
      }

      // 2. Track Order link handling (#track, ?track=..., ?order=..., /track)
      if (
        hash.includes('track') ||
        pathname === '/track' ||
        search.includes('order=') ||
        search.includes('track=') ||
        search.includes('phone=')
      ) {
        setIsTrackOrderOpen(true);
      }

      // 3. Instructions link handling (#instructions, ?instructions, /instructions)
      if (
        hash.includes('instructions') ||
        pathname === '/instructions' ||
        search.includes('instructions')
      ) {
        setIsInstructionsOpen(true);
      }

      // 3. Direct product link handling (?product=...)
      const matchProduct = search.match(/[?&]product=([^&]+)/i) || hash.match(/[?&#]product=([^&#]+)/i);
      if (matchProduct && matchProduct[1]) {
        const prodCode = decodeURIComponent(matchProduct[1]).trim().toLowerCase();
        const cleanSearchCode = prodCode.replace(/^[#\s]+/, '');
        const found = products.find((p) => {
          const pCode = (p.productCode || '').toLowerCase().replace(/^[#\s]+/, '');
          const pId = p.id.toLowerCase();
          return pId === prodCode || pCode === cleanSearchCode || pCode === prodCode;
        });
        if (found) {
          setActiveProductModal(found);
        }
      }
    };

    handleUrlRouting();
    window.addEventListener('hashchange', handleUrlRouting);
    const handleKeyDown = (e: KeyboardEvent) => {
      // Secret key combination: Ctrl+Shift+A or Cmd+Shift+A for discreet owner portal access
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        if (isAdminLoggedIn) {
          setCurrentView('admin');
        } else {
          setShowAdminAuthModal(true);
        }
      }
    };

    window.addEventListener('popstate', handleUrlRouting);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('hashchange', handleUrlRouting);
      window.removeEventListener('popstate', handleUrlRouting);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAdminLoggedIn, products]);

  const handleOpenAdmin = () => {
    if (isAdminLoggedIn) {
      setCurrentView('admin');
      window.location.hash = 'admin';
    } else {
      setShowAdminAuthModal(true);
    }
  };

  const handleAdminAuthSuccess = () => {
    setShowAdminAuthModal(false);
    setCurrentView('admin');
    window.location.hash = 'admin';
  };

  const handleReturnToStore = () => {
    setCurrentView('store');
    window.location.hash = '';
  };

  const handleScrollToCatalog = () => {
    setSelectedCategory('all');
    setCustomerActiveTab('categories');
  };

  const themeColors = getThemeColors(settings.theme, settings.themeMode);

  return (
    <div
      className={`min-h-screen flex flex-col ${themeColors.pageBg} ${themeColors.pageText} selection:bg-amber-100 selection:text-amber-900 transition-colors duration-200 ${
        settings.themeMode === 'dark' ? 'dark bg-neutral-950 text-neutral-100' : ''
      }`}
    >
      {/* Offline Connectivity Status Pill */}
      <OfflineIndicator />

      {/* Admin Portal vs Public Storefront Routing */}
      {currentView === 'admin' ? (
        isAdminLoggedIn ? (
          <AdminLayout onReturnToStore={handleReturnToStore} />
        ) : (
          <AdminAuthModal
            onClose={handleReturnToStore}
            onSuccess={handleAdminAuthSuccess}
          />
        )
      ) : (
        <>
          {/* Public Storefront Announcement Bar */}
          <AnnouncementBar />

          {/* Public Storefront Header */}
          <Header
            onOpenAdmin={handleOpenAdmin}
            onOpenInstructions={() => setIsInstructionsOpen(true)}
            selectedCategory={selectedCategory}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setCustomerActiveTab('categories');
            }}
            onSelectWishlist={() => setCustomerActiveTab('wishlist')}
          />

          {/* Tabbed Storefront Views */}
          <div className="flex-1 pb-20 sm:pb-24">
            {customerActiveTab === 'categories' ? (
              <CategoryBrowser
                onOpenDetails={(product) => setActiveProductModal(product)}
                selectedCategoryName={selectedCategory}
                onSelectCategory={(cat) => setSelectedCategory(cat)}
                onBackToHome={() => setCustomerActiveTab('home')}
              />
            ) : customerActiveTab === 'wishlist' ? (
              <WishlistBrowser
                onOpenDetails={(product) => setActiveProductModal(product)}
                onExploreCatalog={() => setCustomerActiveTab('home')}
              />
            ) : customerActiveTab === 'search' ? (
              <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
                <ProductGrid
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  onOpenDetails={(product) => setActiveProductModal(product)}
                />
              </main>
            ) : (
              /* Home View */
              <main>
                <HeroBanner onExploreCatalog={handleScrollToCatalog} />

                {/* Prominent Saree Categories Showcase (User Request 7 - First Image) */}
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 border-b border-neutral-200/80">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
                    <div>
                      <span className="text-[10px] sm:text-xs uppercase tracking-widest text-amber-700 font-bold flex items-center gap-1.5 mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Handloom Weaves</span>
                      </span>
                      <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 tracking-tight">
                        Explore Saree Categories
                      </h2>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Discover heirloom weaves grouped by regional artisan craft and occasion
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('all');
                        setCustomerActiveTab('categories');
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-rose-900 hover:text-rose-700 transition self-start sm:self-auto cursor-pointer"
                    >
                      <span>All Categories ({categories.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Category Cards Carousel / Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                    {categories.map((cat) => {
                      const count = publicProducts.filter(
                        (p) =>
                          p.category === cat.name ||
                          p.category?.toLowerCase() === cat.name.toLowerCase() ||
                          p.fabric?.toLowerCase() === cat.name.toLowerCase()
                      ).length;

                      return (
                        <div
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategory(cat.name);
                            setCustomerActiveTab('categories');
                          }}
                          className="group relative rounded-2xl overflow-hidden bg-neutral-900 aspect-3/4 border border-neutral-200/80 shadow-2xs hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-end p-3 active:scale-98"
                          title={`View ${cat.name} Collection`}
                        >
                          <img
                            src={cat.imageUrl || '/src/assets/images/hero_saree_atelier_1791651761357.jpg'}
                            alt={cat.name}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 opacity-80 group-hover:opacity-90"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                          <div className="relative z-10 space-y-1">
                            <span className="inline-block text-[9px] font-bold bg-white/90 text-neutral-900 px-1.5 py-0.5 rounded-full backdrop-blur-xs">
                              {count} {count === 1 ? 'Design' : 'Designs'}
                            </span>
                            <h3 className="font-serif font-bold text-xs sm:text-sm text-white leading-tight group-hover:text-amber-200 transition">
                              {cat.name}
                            </h3>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </main>
            )}

            {/* Storefront Footer */}
            <Footer
              onOpenAdmin={handleOpenAdmin}
              onOpenInstructions={() => setIsInstructionsOpen(true)}
            />
          </div>

          {/* Sticky Bottom Navigation Bar (Categories, Search, Wishlist, My Orders, Cart) */}
          <BottomNavBar
            activeTab={customerActiveTab}
            onTabChange={(tab) => setCustomerActiveTab(tab)}
            onOpenCart={() => setIsCartOpen(true)}
            onOpenAccount={() => setIsTrackOrderOpen(true)}
            onOpenOrders={() => setIsTrackOrderOpen(true)}
          />

          {/* Dedicated Instructions & Cross-Platform PWA Installation Modal (User Request) */}
          <InstructionsModal
            isOpen={isInstructionsOpen}
            onClose={() => {
              setIsInstructionsOpen(false);
              if (typeof window !== 'undefined' && window.location.hash.includes('instructions')) {
                const cleanHash = window.location.hash.replace(/[#&?]instructions(=[^&]*)?/g, '');
                window.history.replaceState(null, '', `${window.location.pathname}${cleanHash}`);
              }
            }}
          />

          {/* Product Detail Modal */}
          {activeProductModal && (
            <ProductDetailModal
              product={activeProductModal}
              onClose={() => setActiveProductModal(null)}
            />
          )}

          {/* Shopping Bag Drawer */}
          <CartDrawer />

          {/* Prepaid Checkout Flow Modal */}
          {isCheckoutOpen && (
            <CheckoutModal
              onClose={() => setIsCheckoutOpen(false)}
              onSuccess={() => {
                setIsCheckoutOpen(false);
              }}
            />
          )}

          {/* Track Order Modal (Public lookup with Phone or Order Number) */}
          {isTrackOrderOpen && (
            <TrackOrderModal
              onClose={() => {
                setIsTrackOrderOpen(false);
                if (typeof window !== 'undefined') {
                  const searchParams = new URLSearchParams(window.location.search);
                  searchParams.delete('order');
                  searchParams.delete('track');
                  searchParams.delete('trackOrder');
                  searchParams.delete('phone');
                  const newSearch = searchParams.toString() ? `?${searchParams.toString()}` : '';
                  const cleanHash = window.location.hash.startsWith('#track') ? '' : window.location.hash;
                  window.history.replaceState(null, '', `${window.location.pathname}${newSearch}${cleanHash}`);
                }
              }}
            />
          )}

          {/* Order Placement Success & Receipt Modal */}
          {lastPlacedOrder && (
            <OrderSuccessModal onClose={() => setLastPlacedOrder(null)} />
          )}

          {/* Admin Auth Modal if requested from storefront */}
          {showAdminAuthModal && (
            <AdminAuthModal
              onClose={() => setShowAdminAuthModal(false)}
              onSuccess={handleAdminAuthSuccess}
            />
          )}
        </>
      )}

      {/* Remote Staff Session Revocation Notice Modal (User Request) */}
      {remoteLogoutNotice && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <span className="p-2.5 rounded-xl bg-rose-100">
                <LogOut className="w-5 h-5 text-rose-600" />
              </span>
              <h3 className="font-serif text-lg font-bold text-neutral-900">Session Ended</h3>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">{remoteLogoutNotice}</p>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={clearRemoteLogoutNotice}
                className="px-4 py-2 rounded-xl bg-neutral-900 text-white font-semibold text-xs hover:bg-neutral-800 transition cursor-pointer"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <MainAppContent />
    </StoreProvider>
  );
}
