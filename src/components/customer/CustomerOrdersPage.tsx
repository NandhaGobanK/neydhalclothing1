import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus } from '../../types/store';
import { formatPrice } from '../../utils/upi';
import { formatDeviceDateTime } from '../../utils/deviceTime';
import {
  Package,
  Search,
  ChevronRight,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  RotateCcw,
  ShieldCheck,
  ArrowRight,
  MessageSquare,
  AlertCircle,
  User,
} from 'lucide-react';

export const getOrderStatusColorTheme = (status: OrderStatus | string) => {
  const norm = (status || '').toLowerCase().trim();
  switch (norm) {
    case 'pending':
    case 'pending_verification':
    case 'pending_payment':
      return {
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
        pillBg: 'bg-amber-500 text-white',
        border: 'border-amber-200',
        accent: 'text-amber-700',
        lightBg: 'bg-amber-50/70',
        icon: Clock,
        label: 'Pending Verification',
      };
    case 'confirmed':
      return {
        badgeBg: 'bg-blue-100 text-blue-800 border-blue-300',
        pillBg: 'bg-blue-600 text-white',
        border: 'border-blue-200',
        accent: 'text-blue-700',
        lightBg: 'bg-blue-50/70',
        icon: CheckCircle2,
        label: 'Order Confirmed',
      };
    case 'shipped':
      return {
        badgeBg: 'bg-purple-100 text-purple-800 border-purple-300',
        pillBg: 'bg-purple-600 text-white',
        border: 'border-purple-200',
        accent: 'text-purple-700',
        lightBg: 'bg-purple-50/70',
        icon: Truck,
        label: 'Shipped / In Transit',
      };
    case 'delivered':
      return {
        badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        pillBg: 'bg-emerald-600 text-white',
        border: 'border-emerald-200',
        accent: 'text-emerald-700',
        lightBg: 'bg-emerald-50/70',
        icon: CheckCircle2,
        label: 'Delivered',
      };
    case 'cancelled':
      return {
        badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
        pillBg: 'bg-rose-600 text-white',
        border: 'border-rose-200',
        accent: 'text-rose-700',
        lightBg: 'bg-rose-50/70',
        icon: XCircle,
        label: 'Cancelled',
      };
    case 'refunded':
      return {
        badgeBg: 'bg-cyan-100 text-cyan-800 border-cyan-300',
        pillBg: 'bg-cyan-600 text-white',
        border: 'border-cyan-200',
        accent: 'text-cyan-700',
        lightBg: 'bg-cyan-50/70',
        icon: RotateCcw,
        label: 'Refunded',
      };
    case 'rejected':
      return {
        badgeBg: 'bg-red-100 text-red-800 border-red-300',
        pillBg: 'bg-red-600 text-white',
        border: 'border-red-200',
        accent: 'text-red-700',
        lightBg: 'bg-red-50/70',
        icon: XCircle,
        label: 'Verification Rejected',
      };
    default:
      return {
        badgeBg: 'bg-neutral-100 text-neutral-800 border-neutral-300',
        pillBg: 'bg-neutral-600 text-white',
        border: 'border-neutral-200',
        accent: 'text-neutral-700',
        lightBg: 'bg-neutral-50',
        icon: Package,
        label: status,
      };
  }
};

interface CustomerOrdersPageProps {
  onSelectOrder?: (orderId: string) => void;
  onExploreCatalog?: () => void;
}

export const CustomerOrdersPage: React.FC<CustomerOrdersPageProps> = ({
  onSelectOrder,
  onExploreCatalog,
}) => {
  const {
    customerOrders,
    currentCustomer,
    setIsCustomerAuthModalOpen,
    setSelectedCustomerOrderId,
    setCustomerActiveTab,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | OrderStatus>('all');

  const pendingCount = useMemo(() => {
    return customerOrders.filter((o) => {
      const s = (o.status || '').toLowerCase().trim();
      return s === 'pending' || s === 'pending_verification' || s === 'pending_payment';
    }).length;
  }, [customerOrders]);

  const filteredOrders = useMemo(() => {
    return customerOrders.filter((order) => {
      // Stage filter
      if (stageFilter !== 'all') {
        const orderStatusLower = (order.status || '').toLowerCase().trim();
        const stageFilterLower = stageFilter.toLowerCase().trim();

        if (stageFilterLower === 'pending') {
          if (
            orderStatusLower !== 'pending' &&
            orderStatusLower !== 'pending_verification' &&
            orderStatusLower !== 'pending_payment'
          ) {
            return false;
          }
        } else if (orderStatusLower !== stageFilterLower) {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesOrderNumber = (order.orderNumber || '').toLowerCase().includes(q);
        const matchesUtr = (order.upiTransactionId || '').toLowerCase().includes(q);
        const matchesProduct = (order.items || []).some((item) =>
          (item.product.title || '').toLowerCase().includes(q) ||
          (item.product.productCode || '').toLowerCase().includes(q)
        );
        const matchesCity = (order.customer.city || '').toLowerCase().includes(q);
        if (!matchesOrderNumber && !matchesUtr && !matchesProduct && !matchesCity) {
          return false;
        }
      }

      return true;
    });
  }, [customerOrders, stageFilter, searchQuery]);

  const handleOrderClick = (orderId: string) => {
    setSelectedCustomerOrderId(orderId);
    if (onSelectOrder) {
      onSelectOrder(orderId);
    } else {
      setCustomerActiveTab('order-detail');
    }
  };

  const handleExplore = () => {
    if (onExploreCatalog) {
      onExploreCatalog();
    } else {
      setCustomerActiveTab('categories');
    }
  };

  return (
    <div className="min-h-screen pb-28 bg-neutral-50/60">
      {/* Top Header */}
      <div className="sticky top-18 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200 px-4 py-4 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 flex items-center justify-center font-bold">
              <Package className="w-5 h-5 text-amber-700" />
            </span>
            <div>
              <h1 className="font-serif font-bold text-base sm:text-lg text-neutral-900 flex items-center gap-2">
                <span>My Orders</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 font-sans font-semibold">
                  {customerOrders.length}
                </span>
              </h1>
              <p className="text-[11px] text-neutral-500">
                Track status, delivery courier stages, and review order receipts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExplore}
              className="text-xs font-semibold text-white px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 transition cursor-pointer"
            >
              Browse Collections
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Not Logged In Notice Banner */}
        {!currentCustomer && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/90 flex items-center justify-between gap-3 flex-wrap shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
                <User className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-amber-950">Viewing Local Device Orders</h4>
                <p className="text-[11px] text-amber-800">
                  Sign in to your patron account to permanently synchronize your purchase history across all devices.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCustomerAuthModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-rose-900 hover:bg-rose-800 text-white font-bold text-xs transition cursor-pointer"
            >
              Sign In / Register
            </button>
          </div>
        )}

        {/* Filter Bar & Search */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-neutral-200 shadow-2xs space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order #, UTR, Saree name, or SKU..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-neutral-200 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
            />
          </div>

          {/* Color-Coded Stage Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
            <button
              type="button"
              onClick={() => setStageFilter('all')}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer font-semibold ${
                stageFilter === 'all'
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              All Orders ({customerOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setStageFilter('Pending')}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer font-semibold flex items-center gap-1.5 ${
                stageFilter === 'Pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Pending</span>
              {pendingCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    stageFilter === 'Pending'
                      ? 'bg-amber-800 text-amber-100'
                      : 'bg-amber-200 text-amber-900'
                  }`}
                >
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStageFilter('Confirmed')}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer font-semibold flex items-center gap-1.5 ${
                stageFilter === 'Confirmed'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Confirmed</span>
            </button>
            <button
              type="button"
              onClick={() => setStageFilter('Shipped')}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer font-semibold flex items-center gap-1.5 ${
                stageFilter === 'Shipped'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Shipped</span>
            </button>
            <button
              type="button"
              onClick={() => setStageFilter('Delivered')}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer font-semibold flex items-center gap-1.5 ${
                stageFilter === 'Delivered'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Delivered</span>
            </button>
            <button
              type="button"
              onClick={() => setStageFilter('Cancelled')}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer font-semibold flex items-center gap-1.5 ${
                stageFilter === 'Cancelled'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Cancelled</span>
            </button>
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-neutral-200 p-12 text-center max-w-md mx-auto space-y-4 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center">
              <Package className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-neutral-900">No Orders Found</h3>
              <p className="text-xs text-neutral-500 mt-1">
                {customerOrders.length === 0
                  ? "You haven't placed any orders yet. Discover our latest collections today!"
                  : 'No orders match your current filter or search criteria.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleExplore}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition cursor-pointer"
            >
              <span>Explore Products</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const theme = getOrderStatusColorTheme(order.status);
              const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);

              return (
                <div
                  key={order.id}
                  onClick={() => handleOrderClick(order.id)}
                  className={`bg-white rounded-2xl border ${theme.border} p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between gap-4 group relative`}
                >
                  {/* Top line: Order #, Date, and Color-coded stage badge */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-neutral-100">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono font-bold text-xs sm:text-sm text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200">
                        #{order.orderNumber}
                      </span>
                      <span className="text-neutral-400 text-xs">•</span>
                      <span className="text-xs text-neutral-500">
                        {formatDeviceDateTime(order.createdAt)}
                      </span>
                    </div>

                    {/* Color-Coded Stage Badge */}
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${theme.badgeBg}`}
                    >
                      <theme.icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{theme.label}</span>
                    </div>
                  </div>

                  {/* Middle: Items preview & thumbnails */}
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Thumbnails row */}
                      <div className="flex -space-x-3 overflow-hidden shrink-0">
                        {order.items.slice(0, 3).map((item, idx) => (
                          <img
                            key={idx}
                            src={item.product.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                            alt={item.product.title}
                            className="inline-block h-14 w-12 rounded-lg object-cover ring-2 ring-white shadow-xs"
                          />
                        ))}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <h4 className="font-serif font-bold text-xs sm:text-sm text-neutral-900 truncate">
                          {order.items[0]?.product.title}
                          {order.items.length > 1 && ` + ${order.items.length - 1} more`}
                        </h4>
                        <p className="text-[11px] text-neutral-500">
                          {totalItems} {totalItems === 1 ? 'item' : 'items'} • Ship to: {order.customer.city || order.customer.state} ({order.customer.pincode})
                        </p>
                        {order.upiTransactionId && (
                          <p className="text-[11px] font-mono text-neutral-400">
                            UTR: {order.upiTransactionId}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-semibold text-neutral-400 block">Total</span>
                        <span className="text-base sm:text-lg font-serif font-bold text-neutral-950">
                          {formatPrice(order.totalAmount)}
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white text-neutral-700 transition">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Courier / Dispatch note if present */}
                  {order.shippingDetails?.trackingNumber && (
                    <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-900 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Truck className="w-3.5 h-3.5 text-purple-700" />
                        <span>Courier: <strong>{order.shippingDetails.courierName}</strong> (AWB: {order.shippingDetails.trackingNumber})</span>
                      </span>
                      <span className="font-bold text-purple-700 text-[11px]">Track Details &rarr;</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
