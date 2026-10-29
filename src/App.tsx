import React, { useState, useEffect, useRef } from 'react';
import { StoreProvider, useStore, CustomerActiveTab } from './context/StoreContext';
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
import { NotificationsModal } from './components/storefront/NotificationsModal';
import { Footer } from './components/storefront/Footer';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminAuthModal } from './components/admin/AdminAuthModal';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { getThemeColors } from './utils/theme';
import { LogOut, Grid, Sparkles, ArrowRight, MessageSquare, Volume2, X } from 'lucide-react';
import { playChatChimeSound } from './utils/audio';
import { useStaffIdleTracker } from './hooks/useStaffIdleTracker';
import { CategoryBrowser } from './components/storefront/CategoryBrowser';
import { WishlistBrowser } from './components/storefront/WishlistBrowser';
import { BottomNavBar } from './components/storefront/BottomNavBar';
import { getCategorySingularName, getCategoryPluralName } from './utils/productValidation';
import { ResellerPortal } from './components/reseller/ResellerPortal';
import { CustomerAuthModal } from './components/customer/CustomerAuthModal';
import { CustomerAccountModal } from './components/customer/CustomerAccountModal';
import { CustomerLoginPage } from './components/customer/CustomerLoginPage';
import { CartPage } from './components/storefront/CartPage';
import { CustomerOrdersPage } from './components/customer/CustomerOrdersPage';
import { CustomerOrderDetailPage } from './components/customer/CustomerOrderDetailPage';
import { CustomerAccountPage } from './components/customer/CustomerAccountPage';
import { ProductDetailPage } from './components/storefront/ProductDetailPage';
import { PrepaidCheckoutPage } from './components/storefront/PrepaidCheckoutPage';
import { HomePage } from './components/storefront/HomePage';

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
    isCartOpen,
    setIsCartOpen,
    lastPlacedOrder,
    setLastPlacedOrder,
    remoteLogoutNotice,
    clearRemoteLogoutNotice,
    customerActiveTab,
    setCustomerActiveTab,
    selectedCustomerOrderId,
    setSelectedCustomerOrderId,
    incomingChatAlert,
    dismissChatAlert,
    setActiveCustomerChatOrderId,
    isCustomerAuthModalOpen,
    setIsCustomerAuthModalOpen,
    isCustomerAccountModalOpen,
    setIsCustomerAccountModalOpen,
    isResellerPortalOpen,
    setIsResellerPortalOpen,
    currentCustomer,
    selectedProduct,
    setSelectedProduct,
    openProductPage,
    closeCustomerAccount,
  } = useStore();

  // If anything opens the cart state, seamlessly route to the full-page Cart
  useEffect(() => {
    if (isCartOpen) {
      setCustomerActiveTab('cart');
      setIsCartOpen(false);
    }
  }, [isCartOpen, setCustomerActiveTab, setIsCartOpen]);

  // Seamlessly transition any modal-driven product requests to the dedicated Product Detail Page
  useEffect(() => {
    if (activeProductModal) {
      openProductPage(activeProductModal);
      setActiveProductModal(null);
    }
  }, [activeProductModal, openProductPage, setActiveProductModal]);

  // Seamlessly route any checkout requests to the dedicated Prepaid Checkout Page
  useEffect(() => {
    if (isCheckoutOpen) {
      setCustomerActiveTab('checkout');
      setIsCheckoutOpen(false);
    }
  }, [isCheckoutOpen, setCustomerActiveTab, setIsCheckoutOpen]);

  // Keep device activity & 15-minute idle detection active across the app
  useStaffIdleTracker();

  // Reset scroll to top whenever navigating between tabs
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [customerActiveTab]);

  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Track the originating tab so Cart close returns exactly to where the user was
  const previousTabBeforeCartRef = useRef<CustomerActiveTab>('home');
  useEffect(() => {
    if (customerActiveTab !== 'cart' && customerActiveTab !== 'checkout') {
      previousTabBeforeCartRef.current = customerActiveTab;
    }
  }, [customerActiveTab]);

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

      // Notifications link handling (#notifications, ?notifications)
      if (
        hash.includes('notifications') ||
        pathname === '/notifications' ||
        search.includes('notifications')
      ) {
        setIsNotificationsOpen(true);
      }

      // 4. Reseller B2B Portal deep-link (#reseller, ?reseller, /reseller)
      if (
        hash.includes('reseller') ||
        pathname === '/reseller' ||
        search.includes('reseller')
      ) {
        setIsResellerPortalOpen(true);
      }

      // 5. Customer Account & Login deep-link (#account, #login, ?account)
      if (
        hash.includes('account') ||
        hash.includes('login') ||
        pathname === '/account' ||
        search.includes('account')
      ) {
        if (currentCustomer) {
          setCustomerActiveTab('account');
        } else {
          setIsCustomerAuthModalOpen(true);
        }
      }

      // 6. Orders deep-link (#orders, ?orders)
      if (hash.includes('orders') || search.includes('orders')) {
        setCustomerActiveTab('orders');
      }

      // 7. Cart deep-link (#cart, ?cart)
      if (hash.includes('cart') || search.includes('cart')) {
        setCustomerActiveTab('cart');
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
          openProductPage(found);
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
      // Secret key combination: Ctrl+Shift+R or Cmd+Shift+R for discreet reseller portal access
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault();
        setIsResellerPortalOpen(true);
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
    const el = document.getElementById('catalog-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      setCustomerActiveTab('categories');
    }
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

      {/* Admin Portal vs Dedicated Reseller Portal vs Customer Login Gate vs Authenticated Storefront */}
      {currentView === 'admin' ? (
        isAdminLoggedIn ? (
          <AdminLayout onReturnToStore={handleReturnToStore} />
        ) : (
          <AdminAuthModal
            onClose={handleReturnToStore}
            onSuccess={handleAdminAuthSuccess}
          />
        )
      ) : isResellerPortalOpen ? (
        <>
          <ResellerPortal
            isOpen={true}
            onClose={() => {
              setIsResellerPortalOpen(false);
              if (typeof window !== 'undefined' && window.location.hash.includes('reseller')) {
                window.history.replaceState(null, '', window.location.pathname);
              }
            }}
            onOpenProductModal={(p) => setActiveProductModal(p)}
          />
          {activeProductModal && (
            <ProductDetailModal
              product={activeProductModal}
              onClose={() => setActiveProductModal(null)}
              onSelectProduct={(p) => setActiveProductModal(p)}
            />
          )}
        </>
      ) : (!currentCustomer && !isAdminLoggedIn) ? (
        <>
          <CustomerLoginPage
            onSuccess={() => {
              setCustomerActiveTab('home');
              setSelectedCategory('all');
            }}
            onOpenAdmin={handleOpenAdmin}
          />
          {/* Admin Auth Modal if triggered via secret shortcut (Ctrl+Shift+A) or #admin */}
          {showAdminAuthModal && (
            <AdminAuthModal
              onClose={() => setShowAdminAuthModal(false)}
              onSuccess={handleAdminAuthSuccess}
            />
          )}
        </>
      ) : (
        <>
          {/* Public Storefront Announcement Bar */}
          <AnnouncementBar />

          {/* Real-time Customer Live Chat Incoming Alert Banner (User Device Notification) */}
          {incomingChatAlert && incomingChatAlert.recipient === 'customer' && (
            <div className="sticky top-0 z-50 bg-gradient-to-r from-rose-950 via-neutral-900 to-rose-900 text-white px-4 py-3 shadow-xl border-b border-amber-500/40 animate-in slide-in-from-top duration-300">
              <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-bold shrink-0 animate-bounce">
                    <MessageSquare className="w-4 h-4 text-amber-300" />
                  </span>
                  <div>
                    <p className="font-bold text-xs sm:text-sm text-amber-200 flex items-center gap-2">
                      <span>💬 Atelier Concierge Replied</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                        Order #{incomingChatAlert.order.orderNumber}
                      </span>
                    </p>
                    <p className="text-[11px] text-neutral-200 max-w-xl truncate mt-0.5">
                      <strong>{incomingChatAlert.message.senderName || 'Concierge'}:</strong> "{incomingChatAlert.message.message}"
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => playChatChimeSound(true)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    title="Replay concierge notification chime"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Replay Tone</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsTrackOrderOpen(true);
                      setActiveCustomerChatOrderId(incomingChatAlert.order.id);
                      dismissChatAlert();
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs transition shadow-sm cursor-pointer flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>View & Reply &rarr;</span>
                  </button>
                  <button
                    onClick={dismissChatAlert}
                    className="p-1 rounded-lg text-white/70 hover:text-white cursor-pointer"
                    title="Dismiss notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Public Storefront Header */}
          <Header
            onOpenAdmin={handleOpenAdmin}
            onOpenInstructions={() => setIsInstructionsOpen(true)}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            selectedCategory={selectedCategory}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setCustomerActiveTab('categories');
            }}
            onSelectWishlist={() => setCustomerActiveTab('wishlist')}
            hideCategoryNav={customerActiveTab === 'home'}
          />

          {/* Tabbed Storefront Views (Home, Categories, Search, Wishlist, Orders, Cart, etc.) */}
          <div className="flex-1 pb-20 sm:pb-24">
            {customerActiveTab === 'home' ? (
              <HomePage
                onSelectCategory={(cat) => {
                  setSelectedCategory(cat);
                  setCustomerActiveTab('categories');
                }}
                onSelectProduct={(p) => openProductPage(p)}
                onExploreCatalog={() => setCustomerActiveTab('categories')}
              />
            ) : customerActiveTab === 'product-detail' && selectedProduct ? (
              <ProductDetailPage
                product={selectedProduct}
                onBack={() => setCustomerActiveTab('categories')}
                onSelectProduct={(p) => openProductPage(p)}
              />
            ) : customerActiveTab === 'categories' ? (
              <CategoryBrowser
                onOpenDetails={(product) => openProductPage(product)}
                selectedCategoryName={selectedCategory}
                onSelectCategory={(cat) => setSelectedCategory(cat)}
              />
            ) : customerActiveTab === 'wishlist' ? (
              <WishlistBrowser
                onOpenDetails={(product) => openProductPage(product)}
                onExploreCatalog={() => setCustomerActiveTab('categories')}
              />
            ) : customerActiveTab === 'search' ? (
              <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
                <ProductGrid
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  onOpenDetails={(product) => openProductPage(product)}
                />
              </main>
            ) : customerActiveTab === 'orders' ? (
              <CustomerOrdersPage
                onSelectOrder={(orderId) => {
                  setSelectedCustomerOrderId(orderId);
                  setCustomerActiveTab('order-detail');
                }}
                onExploreCatalog={() => setCustomerActiveTab('categories')}
              />
            ) : customerActiveTab === 'order-detail' ? (
              <CustomerOrderDetailPage
                onBack={() => setCustomerActiveTab('orders')}
                onOpenProductDetails={(prodId: string) => {
                  const match = products.find((p) => p.id === prodId);
                  if (match) openProductPage(match);
                }}
              />
            ) : customerActiveTab === 'account' ? (
              <CustomerAccountPage
                onClose={closeCustomerAccount}
                onBack={closeCustomerAccount}
              />
            ) : customerActiveTab === 'cart' ? (
              <CartPage
                onClose={() => setCustomerActiveTab(previousTabBeforeCartRef.current || 'home')}
                onOpenProductDetails={(product) => openProductPage(product)}
              />
            ) : customerActiveTab === 'checkout' ? (
              <PrepaidCheckoutPage
                onBack={() => setCustomerActiveTab('cart')}
                onSuccess={() => {
                  setCustomerActiveTab('orders');
                }}
              />
            ) : (
              /* Fallback to Home */
              <HomePage
                onSelectCategory={(cat) => {
                  setSelectedCategory(cat);
                  setCustomerActiveTab('categories');
                }}
                onSelectProduct={(p) => openProductPage(p)}
                onExploreCatalog={() => setCustomerActiveTab('categories')}
              />
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
          />

          {/* Dedicated Instructions & Cross-Platform PWA Installation Modal */}
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

          {/* Dedicated Notifications & Restock Alerts Modal (Opened via Top Bell Symbol) */}
          <NotificationsModal
            isOpen={isNotificationsOpen}
            onClose={() => {
              setIsNotificationsOpen(false);
              if (typeof window !== 'undefined' && window.location.hash.includes('notifications')) {
                const cleanHash = window.location.hash.replace(/[#&?]notifications(=[^&]*)?/g, '');
                window.history.replaceState(null, '', `${window.location.pathname}${cleanHash}`);
              }
            }}
          />

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

          {/* Customer Authentication Modal (Login / Register) */}
          <CustomerAuthModal
            isOpen={isCustomerAuthModalOpen}
            onClose={() => setIsCustomerAuthModalOpen(false)}
            onSuccess={() => {
              setIsCustomerAuthModalOpen(false);
              setCustomerActiveTab('home');
            }}
          />

          {/* Dedicated Customer Account & Private Data Isolation Portal */}
          <CustomerAccountModal
            isOpen={isCustomerAccountModalOpen}
            onClose={() => setIsCustomerAccountModalOpen(false)}
            onOpenProductDetails={(prodId: string) => {
              const match = products.find((p) => p.id === prodId);
              if (match) setActiveProductModal(match);
            }}
          />
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
