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

function MainAppContent() {
  const {
    products,
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
    lastPlacedOrder,
    setLastPlacedOrder,
  } = useStore();

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
    const el = document.getElementById('catalog');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
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
              handleScrollToCatalog();
            }}
          />

          {/* Hero Showcase */}
          <main className="flex-1">
            <HeroBanner onExploreCatalog={handleScrollToCatalog} />

            {/* Saree Catalog with Fabric & Color Filters */}
            <ProductGrid
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onOpenDetails={(product) => setActiveProductModal(product)}
            />
          </main>

          {/* Storefront Footer */}
          <Footer
            onOpenAdmin={handleOpenAdmin}
            onOpenInstructions={() => setIsInstructionsOpen(true)}
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
