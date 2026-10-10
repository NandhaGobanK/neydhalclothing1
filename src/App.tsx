import React, { useState } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Header } from './components/storefront/Header';
import { AnnouncementBar } from './components/storefront/AnnouncementBar';
import { HeroBanner } from './components/storefront/HeroBanner';
import { ProductGrid } from './components/storefront/ProductGrid';
import { ProductDetailModal } from './components/storefront/ProductDetailModal';
import { CartDrawer } from './components/storefront/CartDrawer';
import { CheckoutModal } from './components/storefront/CheckoutModal';
import { OrderSuccessModal } from './components/storefront/OrderSuccessModal';
import { Footer } from './components/storefront/Footer';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminAuthModal } from './components/admin/AdminAuthModal';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';

function MainAppContent() {
  const {
    currentView,
    setCurrentView,
    isAdminLoggedIn,
    activeProductModal,
    setActiveProductModal,
    isCheckoutOpen,
    setIsCheckoutOpen,
    lastPlacedOrder,
    setLastPlacedOrder,
  } = useStore();

  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

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

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900 selection:bg-amber-100 selection:text-amber-900">
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
          <Footer onOpenAdmin={handleOpenAdmin} />

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
