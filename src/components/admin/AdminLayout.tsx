import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { OrderManager } from './OrderManager';
import { ProductManager } from './ProductManager';
import { AnalyticsManager } from './AnalyticsManager';
import { StaffManager } from './StaffManager';
import { StaffBucketManager } from './StaffBucketManager';
import { SettingsManager } from './SettingsManager';
import { playOrderNotificationSound } from '../../utils/audio';
import { formatPrice } from '../../utils/upi';
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
  Bell,
  Volume2,
  X,
  Layers,
} from 'lucide-react';

interface AdminLayoutProps {
  onReturnToStore: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onReturnToStore }) => {
  const { settings, adminLogout, orders, currentUser, currentPermissions, adminOnlineStatus } = useStore();
  const isAdmin = currentUser?.type === 'admin';

  const myBucketOrdersCount = orders.filter(
    (o) => o.assignedStaffId === currentUser?.staffId
  ).length;

  // Determine allowed tabs based on permissions
  const canSeeOrders = isAdmin || currentPermissions?.orders?.canView !== false;
  const canSeeStaffBuckets = canSeeOrders;
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

  const [activeTab, setActiveTab] = useState<
    'orders' | 'staff_buckets' | 'products' | 'analytics' | 'staff' | 'settings'
  >(defaultTab);
  const [selectedStaffBucketId, setSelectedStaffBucketId] = useState<string | undefined>(undefined);

  // Sound notification when admins or staff receive orders (User Request)
  const prevOrdersCountRef = useRef(orders.length);
  const isFirstRender = useRef(true);
  const [incomingOrderAlert, setIncomingOrderAlert] = useState<any | null>(null);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevOrdersCountRef.current = orders.length;
      return;
    }

    if (orders.length > prevOrdersCountRef.current) {
      const newestOrder = orders[0];
      if (newestOrder) {
        setIncomingOrderAlert(newestOrder);
        playOrderNotificationSound();
      }
    }
    prevOrdersCountRef.current = orders.length;
  }, [orders.length]);

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
      <header className="sticky top-0 z-30 bg-neutral-950 text-white border-b border-neutral-800 shadow-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Top Row: Brand, User Identity Badge, and Quick Action Buttons */}
          <div className="py-2 sm:py-2.5 flex items-center justify-between flex-wrap gap-2 sm:gap-3 border-b border-neutral-800/80">
            {/* Brand & Portal Badge */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-wrap">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-[#7e1ba8] via-[#52126e] to-[#2d053f] flex items-center justify-center text-[#faebd7] font-serif font-bold text-xs sm:text-sm shadow-[0_2px_10px_rgba(82,18,110,0.65),inset_0_1px_1.5px_rgba(255,255,255,0.7)] ring-1 ring-amber-300/40 relative overflow-hidden shrink-0">
                <span className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/5 to-transparent h-1/2 pointer-events-none rounded-t-lg"></span>
                <span className="relative z-10 drop-shadow-sm">N</span>
              </span>
              <div className="min-w-0 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h1 className="font-serif text-sm sm:text-base font-bold text-white truncate max-w-[120px] sm:max-w-[200px] md:max-w-xs">
                  {settings.boutiqueName}
                </h1>
                <span
                  title={isAdmin ? (currentUser?.email ? `Admin: ${currentUser.email}` : 'Owner') : `@${currentUser?.username}`}
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider shrink-0 truncate max-w-[130px] sm:max-w-[220px] ${
                    isAdmin
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  }`}
                >
                  {isAdmin
                    ? (currentUser?.email ? `Admin: ${currentUser.email}` : 'Admin: Owner')
                    : `Staff: @${currentUser?.username || 'Staff'}`}
                </span>

                {/* Live Admin Online/Offline Status for Staff Members (User Request) */}
                {!isAdmin && (
                  <span
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5 ${
                      adminOnlineStatus?.isLoggedIn
                        ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-xs'
                        : 'bg-neutral-900 border-neutral-700 text-neutral-400'
                    }`}
                    title={
                      adminOnlineStatus?.isLoggedIn
                        ? `Store Owner is currently active and logged in (since ${new Date(adminOnlineStatus.lastLoginAt || '').toLocaleTimeString('en-IN')})`
                        : `Store Owner is currently locked/logged out (last active ${adminOnlineStatus?.lastLogoutAt ? new Date(adminOnlineStatus.lastLogoutAt).toLocaleTimeString('en-IN') : 'recently'})`
                    }
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        adminOnlineStatus?.isLoggedIn
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-neutral-500'
                      }`}
                    />
                    <span>
                      {adminOnlineStatus?.isLoggedIn
                        ? 'Admin Logged In'
                        : 'Admin Logged Out'}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Top Right Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap ml-auto">
              <button
                onClick={onReturnToStore}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium border border-neutral-800 transition whitespace-nowrap cursor-pointer"
                title="View Public Storefront"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">View Public Store</span>
              </button>

              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-xs font-medium border border-rose-900/60 transition whitespace-nowrap cursor-pointer"
                title="Lock Admin Portal"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lock / Logout</span>
              </button>
            </div>
          </div>

          {/* Navigation Bar Row: Single Unified Scrollable Tab Strip */}
          <div className="py-1.5 sm:py-2 flex items-center gap-1 overflow-x-auto scrollbar-thin">
            {canSeeOrders && (
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                  activeTab === 'orders'
                    ? 'bg-white text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
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

            {canSeeStaffBuckets && (
              <button
                onClick={() => setActiveTab('staff_buckets')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                  activeTab === 'staff_buckets'
                    ? 'bg-amber-400 text-neutral-950 font-bold shadow-xs'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                }`}
                title="Dedicated staff bucket column for managing orders separately"
              >
                <Layers className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  {currentUser?.staffId
                    ? `My Bucket (${myBucketOrdersCount})`
                    : 'Staff Buckets'}
                </span>
              </button>
            )}

            {canSeeProducts && (
              <button
                onClick={() => setActiveTab('products')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                  activeTab === 'products'
                    ? 'bg-white text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Sarees</span>
              </button>
            )}

            {canSeeAnalytics && (
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                  activeTab === 'analytics'
                    ? 'bg-white text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Sales Analytics</span>
              </button>
            )}

            {canSeeStaff && (
              <button
                onClick={() => setActiveTab('staff')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                  activeTab === 'staff'
                    ? 'bg-white text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Staff & Ledger</span>
              </button>
            )}

            {canSeeSettings && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                  activeTab === 'settings'
                    ? 'bg-white text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Instant New Order Arrival Banner with Sound Trigger (User Request) */}
      {incomingOrderAlert && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-rose-600 text-neutral-950 px-4 py-3 shadow-md animate-in slide-in-from-top duration-300">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-white text-amber-700 flex items-center justify-center font-bold shadow-xs shrink-0 animate-bounce">
                <Bell className="w-4 h-4" />
              </span>
              <div>
                <p className="font-bold text-xs sm:text-sm text-white">
                  🔔 New Order Received: <span className="underline">#{incomingOrderAlert.orderNumber}</span> by {incomingOrderAlert.customer?.name} ({formatPrice(incomingOrderAlert.totalAmount)})
                </p>
                <p className="text-[11px] text-amber-100 font-medium">
                  {incomingOrderAlert.items?.length || 1} saree item(s) • Payment UTR: {incomingOrderAlert.upiTransactionId || 'Prepaid verification'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => playOrderNotificationSound()}
                className="px-2.5 py-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-white text-xs font-semibold flex items-center gap-1 transition"
                title="Replay chime sound"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Replay Sound</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('orders');
                  setIncomingOrderAlert(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-900 text-amber-300 font-bold text-xs transition shadow-sm"
              >
                Open & Assign Order &rarr;
              </button>
              <button
                onClick={() => setIncomingOrderAlert(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Admin View Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'orders' && <OrderManager />}
        {activeTab === 'staff_buckets' && (
          <StaffBucketManager
            initialStaffId={selectedStaffBucketId}
            onNavigateToTab={(t) => setActiveTab(t)}
          />
        )}
        {activeTab === 'products' && <ProductManager />}
        {activeTab === 'analytics' && <AnalyticsManager />}
        {activeTab === 'staff' && (
          <StaffManager
            onNavigateToBucket={(staffId) => {
              setSelectedStaffBucketId(staffId);
              setActiveTab('staff_buckets');
            }}
          />
        )}
        {activeTab === 'settings' && <SettingsManager />}
      </main>
    </div>
  );
};
