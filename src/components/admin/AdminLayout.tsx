import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { OrderManager } from './OrderManager';
import { ProductManager } from './ProductManager';
import { AnalyticsManager } from './AnalyticsManager';
import { StaffManager } from './StaffManager';
import { SettingsManager } from './SettingsManager';
import {
  ShoppingBag,
  Package,
  Settings,
  LogOut,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
  TrendingUp,
  Users,
} from 'lucide-react';

interface AdminLayoutProps {
  onReturnToStore: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onReturnToStore }) => {
  const { settings, adminLogout, orders, currentUser, currentPermissions } = useStore();
  const isAdmin = currentUser?.type === 'admin';

  // Determine allowed tabs based on permissions
  const canSeeOrders = isAdmin || currentPermissions?.orders?.canView !== false;
  const canSeeProducts = isAdmin || currentPermissions?.products?.canView !== false;
  const canSeeAnalytics = isAdmin || currentPermissions?.analytics?.canView !== false;
  const canSeeStaff = isAdmin || currentPermissions?.staff?.canView !== false;
  const canSeeSettings =
    isAdmin ||
    currentPermissions?.settingsStorefront?.canView !== false ||
    currentPermissions?.settingsAnnouncement?.canView !== false ||
    currentPermissions?.settingsPayment?.canView !== false ||
    currentPermissions?.settingsProfile?.canView !== false ||
    currentPermissions?.settingsChatTemplates?.canView !== false;

  const defaultTab = canSeeOrders
    ? 'orders'
    : canSeeProducts
    ? 'products'
    : canSeeAnalytics
    ? 'analytics'
    : canSeeStaff
    ? 'staff'
    : 'settings';

  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'analytics' | 'staff' | 'settings'>(defaultTab);

  const pendingRefundsCount = orders.filter(
    (o) =>
      (o.status === 'Cancelled' || o.status === 'Rejected') &&
      o.refundDetails?.refundStatus === 'pending'
  ).length;

  const handleLogout = () => {
    adminLogout();
    onReturnToStore();
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-30 bg-neutral-950 text-white border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand & Portal Badge */}
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-rose-700 flex items-center justify-center text-amber-100 font-serif font-bold text-sm shadow-inner">
              Aa
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-base sm:text-lg font-bold text-white">
                  {settings.boutiqueName}
                </h1>
                <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${
                  isAdmin
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                }`}>
                  {isAdmin ? 'Admin Console' : `Staff: @${currentUser?.username}`}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
            {canSeeOrders && (
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'orders'
                    ? 'bg-white text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Orders ({orders.length})</span>
                {pendingRefundsCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {pendingRefundsCount}
                  </span>
                )}
              </button>
            )}

            {canSeeProducts && (
              <button
                onClick={() => setActiveTab('products')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'products'
                    ? 'bg-white text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Sarees</span>
              </button>
            )}

            {canSeeAnalytics && (
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'analytics'
                    ? 'bg-white text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Sales Analytics</span>
              </button>
            )}

            {canSeeStaff && (
              <button
                onClick={() => setActiveTab('staff')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'staff'
                    ? 'bg-white text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Staff & Ledger</span>
              </button>
            )}

            {canSeeSettings && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'settings'
                    ? 'bg-white text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
            )}
          </nav>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onReturnToStore}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium border border-neutral-800 transition whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View Public Store</span>
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-xs font-medium border border-rose-900 transition"
              title="Lock Admin Portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock / Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Strip */}
        <div className="md:hidden flex items-center justify-around border-t border-neutral-800 bg-neutral-900/90 px-2 py-2 overflow-x-auto">
          {canSeeOrders && (
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                activeTab === 'orders' ? 'bg-white text-neutral-950' : 'text-neutral-400'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Orders</span>
              {pendingRefundsCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {pendingRefundsCount}
                </span>
              )}
            </button>
          )}

          {canSeeProducts && (
            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                activeTab === 'products' ? 'bg-white text-neutral-950' : 'text-neutral-400'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Sarees</span>
            </button>
          )}

          {canSeeAnalytics && (
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                activeTab === 'analytics' ? 'bg-white text-neutral-950' : 'text-neutral-400'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span>Analytics</span>
            </button>
          )}

          {canSeeStaff && (
            <button
              onClick={() => setActiveTab('staff')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                activeTab === 'staff' ? 'bg-white text-neutral-950' : 'text-neutral-400'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Staff</span>
            </button>
          )}

          {canSeeSettings && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                activeTab === 'settings' ? 'bg-white text-neutral-950' : 'text-neutral-400'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Admin View Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'orders' && <OrderManager />}
        {activeTab === 'products' && <ProductManager />}
        {activeTab === 'analytics' && <AnalyticsManager />}
        {activeTab === 'staff' && <StaffManager />}
        {activeTab === 'settings' && <SettingsManager />}
      </main>
    </div>
  );
};
