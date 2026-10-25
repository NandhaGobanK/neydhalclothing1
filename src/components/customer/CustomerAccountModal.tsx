import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { CustomerAddress, Order } from '../../types/store';
import { formatPrice } from '../../utils/upi';
import { downloadSingleImage } from '../../utils/imageDownload';
import {
  X,
  User,
  Package,
  MapPin,
  Heart,
  LogOut,
  Plus,
  Trash2,
  CheckCircle,
  Truck,
  MessageSquare,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Download,
  Clock,
  Sparkles,
  Bell,
  CheckCheck,
  ArrowRight,
} from 'lucide-react';
import { getThemeColors } from '../../utils/theme';
import { AppNotification } from '../../types/store';
import { formatDeviceDateTime } from '../../utils/deviceTime';

interface CustomerAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenOrderChat?: (orderId: string) => void;
  onOpenProductDetails?: (productId: string) => void;
}

export const CustomerAccountModal: React.FC<CustomerAccountModalProps> = ({
  isOpen,
  onClose,
  onOpenOrderChat,
  onOpenProductDetails,
}) => {
  const {
    currentCustomer,
    customerLogout,
    customerOrders,
    settings,
    products,
    wishlist,
    addCustomerAddress,
    deleteCustomerAddress,
    setDefaultAddress,
    setIsTrackOrderOpen,
    customerNotifications,
    markCustomerNotificationRead,
    markAllCustomerNotificationsRead,
    clearCustomerNotifications,
    setActiveProductModal,
  } = useStore();

  const themeColors = getThemeColors(settings.theme, settings.themeMode);
  const [activeTab, setActiveTab] = useState<'orders' | 'notifications' | 'addresses' | 'wishlist' | 'profile'>('orders');
  const [notifFilter, setNotifFilter] = useState<'all' | 'restock' | 'order' | 'chat'>('all');

  const unreadNotifCount = customerNotifications.filter((n) => !n.read).length;

  const handleNotificationClick = (notif: AppNotification) => {
    markCustomerNotificationRead(notif.id);

    if (notif.targetType === 'product' && notif.targetId) {
      const prod = products.find((p) => p.id === notif.targetId);
      if (prod) {
        setActiveProductModal(prod);
        onClose();
      } else if (onOpenProductDetails) {
        onOpenProductDetails(notif.targetId);
        onClose();
      }
    } else if (notif.targetType === 'order') {
      onClose();
      setIsTrackOrderOpen(true);
    } else if (notif.targetType === 'chat' && notif.targetId) {
      if (onOpenOrderChat) {
        onOpenOrderChat(notif.targetId);
      } else {
        onClose();
        setIsTrackOrderOpen(true);
      }
    } else {
      onClose();
    }
  };

  // Address form modal state
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addrName, setAddrName] = useState(currentCustomer?.name || '');
  const [addrPhone, setAddrPhone] = useState(currentCustomer?.phone || '');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrPincode, setAddrPincode] = useState('');
  const [addrIsDefault, setAddrIsDefault] = useState(true);

  if (!isOpen || !currentCustomer) return null;

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrStreet.trim() || !addrCity.trim() || !addrPincode.trim()) return;
    await addCustomerAddress({
      name: addrName.trim() || currentCustomer.name,
      phone: addrPhone.trim() || currentCustomer.phone,
      address: addrStreet.trim(),
      city: addrCity.trim(),
      state: addrState.trim() || 'Tamil Nadu',
      pincode: addrPincode.trim(),
      isDefault: addrIsDefault,
    });
    setShowAddressForm(false);
    setAddrStreet('');
    setAddrCity('');
    setAddrPincode('');
  };

  const wishlistProducts = products.filter((p) => wishlist.includes(p.id));

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-rose-950 via-neutral-900 to-rose-900 text-white p-5 sm:p-6 shrink-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-amber-500/20 border-2 border-amber-400 text-amber-300 flex items-center justify-center text-xl font-serif font-bold shadow-md">
                {currentCustomer.name ? currentCustomer.name.charAt(0).toUpperCase() : 'C'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-white leading-tight">
                    {currentCustomer.name}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Verified Customer</span>
                  </span>
                </div>
                <p className="text-xs text-neutral-300 flex items-center gap-2 mt-0.5">
                  <span>📱 +91 {currentCustomer.phone}</span>
                  {currentCustomer.email && (
                    <>
                      <span>·</span>
                      <span>✉️ {currentCustomer.email}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={() => {
                  customerLogout();
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-white/15 active:scale-95 whitespace-nowrap"
                title="Log out of your customer account"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Log Out</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer border border-white/15 active:scale-95"
                aria-label="Close"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation Tab Bar */}
          <div className="flex items-center gap-2 mt-5 overflow-x-auto no-scrollbar border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-300 hover:text-white bg-white/5'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>My Orders ({customerOrders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-300 hover:text-white bg-white/5'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Notifications</span>
              {unreadNotifCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-600 text-white font-mono font-bold">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('addresses')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'addresses'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-300 hover:text-white bg-white/5'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Saved Addresses ({currentCustomer.savedAddresses?.length || 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('wishlist')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'wishlist'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-300 hover:text-white bg-white/5'
              }`}
            >
              <Heart className="w-4 h-4" />
              <span>Wishlist ({wishlistProducts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-300 hover:text-white bg-white/5'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Profile Privacy</span>
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-neutral-50/50">
          {/* TAB 1: ORDERS (STRICTLY ISOLATED TO THIS CUSTOMER) */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-neutral-900 font-serif">
                    Order History & Deliveries
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Strictly isolated: Only orders placed with your phone/email are displayed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setIsTrackOrderOpen(true);
                  }}
                  className="text-xs font-bold text-rose-900 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Public Courier Tracker &rarr;</span>
                </button>
              </div>

              {customerOrders.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200/80 p-8 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
                    <Package className="w-6 h-6" />
                  </div>
                  <h4 className="font-serif font-bold text-neutral-800 text-base">No orders placed yet</h4>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    When you purchase Kanjivaram silk sarees or designer wear, your orders will appear here with live tracking.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-neutral-900 text-white font-bold text-xs uppercase tracking-wider hover:bg-neutral-800 transition cursor-pointer"
                  >
                    Explore Boutique Collections
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {customerOrders.map((ord) => {
                    const statusColors = {
                      Pending: 'bg-amber-100 text-amber-900 border-amber-300',
                      Confirmed: 'bg-blue-100 text-blue-900 border-blue-300',
                      Shipped: 'bg-purple-100 text-purple-900 border-purple-300',
                      Delivered: 'bg-emerald-100 text-emerald-900 border-emerald-300',
                      Cancelled: 'bg-rose-100 text-rose-900 border-rose-300',
                      Refunded: 'bg-orange-100 text-orange-900 border-orange-300',
                      Rejected: 'bg-neutral-100 text-neutral-700 border-neutral-300',
                    }[ord.status] || 'bg-neutral-100 text-neutral-800';

                    return (
                      <div
                        key={ord.id}
                        className="bg-white rounded-2xl border border-neutral-200/80 p-4 sm:p-5 shadow-2xs hover:shadow-md transition space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded">
                                #{ord.orderNumber}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors}`}
                              >
                                {ord.status}
                              </span>
                              {ord.orderType === 'reseller' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300">
                                  Reseller Order
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-400 mt-0.5">
                              Ordered on {new Date(ord.createdAt).toLocaleDateString()} at{' '}
                              {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>

                          <div className="text-right flex items-center sm:flex-col sm:items-end justify-between sm:justify-center">
                            <span className="text-xs text-neutral-500">Order Amount</span>
                            <span className="font-bold text-neutral-900 text-sm">
                              {formatPrice(ord.totalAmount)}
                            </span>
                          </div>
                        </div>

                        {/* Order Items Preview */}
                        <div className="space-y-2">
                          {ord.items.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {it.product.images?.[0] ? (
                                  <img
                                    src={it.product.images[0]}
                                    alt={it.product.title}
                                    className="w-10 h-12 object-cover rounded-md border border-neutral-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-12 rounded-md bg-neutral-100 flex items-center justify-center shrink-0">
                                    <Package className="w-4 h-4 text-neutral-400" />
                                  </div>
                                )}
                                <div className="truncate">
                                  <p className="font-medium text-neutral-900 truncate">
                                    {it.product.title}
                                  </p>
                                  <p className="text-[11px] text-neutral-500">
                                    Qty: {it.quantity} · {formatPrice(it.product.price)} each
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {it.product.images?.[0] && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      downloadSingleImage(
                                        it.product.images[0],
                                        `${it.product.title}_${it.product.productCode || 'sku'}.jpg`
                                      )
                                    }
                                    className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition cursor-pointer"
                                    title="Download product photo"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Tracking / Shipping Info if Shipped */}
                        {ord.shippingDetails?.trackingNumber && (
                          <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-100 text-xs flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-purple-950 font-medium">
                              <Truck className="w-4 h-4 text-purple-700 shrink-0" />
                              <span>
                                {ord.shippingDetails.courierName || 'Courier'}:{' '}
                                <strong className="font-mono">{ord.shippingDetails.trackingNumber}</strong>
                              </span>
                            </div>
                            <span className="text-[10px] text-purple-700 font-bold bg-white px-2 py-0.5 rounded-md border border-purple-200">
                              Dispatched
                            </span>
                          </div>
                        )}

                        {/* Order Actions */}
                        <div className="pt-1 flex items-center justify-between gap-2 flex-wrap">
                          <div className="text-[11px] text-neutral-500">
                            Deliver to: <strong className="text-neutral-700">{ord.customer.city}, {ord.customer.pincode}</strong>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                setIsTrackOrderOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Live Tracker</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: NOTIFICATIONS & RESTOCK ALERTS */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-neutral-900 font-serif flex items-center gap-2">
                    <span>Notifications & Updates</span>
                    {unreadNotifCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white">
                        {unreadNotifCount} New
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Click any notification to navigate directly to the relevant product, tracker, or chat.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {customerNotifications.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={markAllCustomerNotificationsRead}
                        className="text-xs font-semibold text-neutral-700 hover:text-neutral-900 bg-white border border-neutral-200 px-3 py-1.5 rounded-xl shadow-2xs hover:bg-neutral-50 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Mark all read</span>
                      </button>
                      <button
                        type="button"
                        onClick={clearCustomerNotifications}
                        className="text-xs font-semibold text-rose-700 hover:text-rose-900 bg-white border border-rose-200 px-3 py-1.5 rounded-xl shadow-2xs hover:bg-rose-50 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setNotifFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    notifFilter === 'all'
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  All ({customerNotifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setNotifFilter('restock')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    notifFilter === 'restock'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
                  <span>Restocks ({customerNotifications.filter((n) => n.type === 'restock').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNotifFilter('order')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    notifFilter === 'order'
                      ? 'bg-sky-700 text-white shadow-xs'
                      : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <Package className="w-3 h-3 text-sky-500" />
                  <span>Orders ({customerNotifications.filter((n) => n.type === 'order').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNotifFilter('chat')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    notifFilter === 'chat'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <MessageSquare className="w-3 h-3 text-purple-500" />
                  <span>Chat ({customerNotifications.filter((n) => n.type === 'chat').length})</span>
                </button>
              </div>

              {/* Notifications List */}
              {(() => {
                const filtered = customerNotifications.filter((n) =>
                  notifFilter === 'all' ? true : n.type === notifFilter
                );

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200/80 p-8 space-y-3">
                      <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
                        <Bell className="w-6 h-6" />
                      </div>
                      <h4 className="font-serif font-bold text-neutral-800 text-base">No notifications found</h4>
                      <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                        {notifFilter === 'all'
                          ? 'You are all caught up! Updates regarding restocked handloom sarees and parcel tracking will appear here.'
                          : `No ${notifFilter} updates at this moment.`}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5">
                    {filtered.map((notif) => {
                      const isUnread = !notif.read;
                      return (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 group ${
                            isUnread
                              ? 'bg-amber-50/40 border-amber-300 shadow-sm hover:border-amber-400 hover:shadow-md'
                              : 'bg-white border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300'
                          }`}
                        >
                          {/* Thumbnail / Icon */}
                          {notif.imageUrl ? (
                            <img
                              src={notif.imageUrl}
                              alt={notif.title}
                              referrerPolicy="no-referrer"
                              className="w-12 h-15 rounded-xl object-cover shrink-0 border border-neutral-200 shadow-2xs group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div
                              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${
                                notif.type === 'restock'
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  : notif.type === 'order'
                                  ? 'bg-sky-100 text-sky-700 border border-sky-200'
                                  : notif.type === 'chat'
                                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                  : 'bg-amber-100 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {notif.type === 'restock' && <Sparkles className="w-5 h-5 text-amber-600 fill-amber-500" />}
                              {notif.type === 'order' && <Truck className="w-5 h-5" />}
                              {notif.type === 'chat' && <MessageSquare className="w-5 h-5" />}
                              {notif.type === 'announcement' && <Bell className="w-5 h-5" />}
                            </div>
                          )}

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider uppercase ${
                                  notif.type === 'restock'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : notif.type === 'order'
                                    ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                    : notif.type === 'chat'
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {notif.type}
                              </span>
                              <span className="text-[10px] text-neutral-400">
                                {formatDeviceDateTime(notif.createdAt)}
                              </span>
                              {isUnread && (
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Unread" />
                              )}
                            </div>

                            <h4 className="text-xs sm:text-sm font-bold text-neutral-900 group-hover:text-rose-950 transition">
                              {notif.title}
                            </h4>
                            <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
                              {notif.message}
                            </p>

                            <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-rose-900 group-hover:underline">
                              <span>
                                {notif.targetType === 'product'
                                  ? 'View Restocked Saree'
                                  : notif.targetType === 'order'
                                  ? 'Track Order & Courier'
                                  : notif.targetType === 'chat'
                                  ? 'Open Concierge Chat'
                                  : 'View Details'}
                              </span>
                              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>

                          <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-700 shrink-0 self-center" />
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 2: SAVED ADDRESSES */}
          {activeTab === 'addresses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-neutral-900 font-serif">
                    Saved Delivery Addresses
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Save your delivery locations for fast 1-click checkout.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddressForm(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-900 hover:bg-rose-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Address</span>
                </button>
              </div>

              {showAddressForm && (
                <form
                  onSubmit={handleSaveAddress}
                  className="p-4 bg-white rounded-2xl border-2 border-rose-900/30 shadow-md space-y-3 animate-in fade-in"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                      New Shipping Address
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddressForm(false)}
                      className="p-1 rounded-full text-neutral-400 hover:text-neutral-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                        Contact Name
                      </label>
                      <input
                        type="text"
                        required
                        value={addrName}
                        onChange={(e) => setAddrName(e.target.value)}
                        placeholder="Recipient full name"
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                        Contact Phone
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={addrPhone}
                        onChange={(e) => setAddrPhone(e.target.value)}
                        placeholder="10-digit mobile"
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                      Street Address, Building, House No.
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={addrStreet}
                      onChange={(e) => setAddrStreet(e.target.value)}
                      placeholder="Flat 302, Royal Residency, 4th Cross Road"
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        required
                        value={addrCity}
                        onChange={(e) => setAddrCity(e.target.value)}
                        placeholder="e.g. Chennai"
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        required
                        value={addrState}
                        onChange={(e) => setAddrState(e.target.value)}
                        placeholder="Tamil Nadu"
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                        Pincode
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={addrPincode}
                        onChange={(e) => setAddrPincode(e.target.value.replace(/\D/g, ''))}
                        placeholder="600017"
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addrIsDefault}
                        onChange={(e) => setAddrIsDefault(e.target.checked)}
                        className="rounded text-rose-900"
                      />
                      <span>Set as default delivery address</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddressForm(false)}
                        className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-neutral-900 text-white font-bold text-xs"
                      >
                        Save Address
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {(!currentCustomer.savedAddresses || currentCustomer.savedAddresses.length === 0) && !showAddressForm ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-neutral-200/80 p-6 space-y-2">
                  <MapPin className="w-8 h-8 text-neutral-400 mx-auto" />
                  <p className="text-xs text-neutral-500">No saved delivery addresses.</p>
                  <button
                    type="button"
                    onClick={() => setShowAddressForm(true)}
                    className="text-xs font-bold text-rose-900 hover:underline"
                  >
                    + Add your primary shipping address
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentCustomer.savedAddresses?.map((addr) => (
                    <div
                      key={addr.id}
                      className={`p-4 rounded-2xl bg-white border transition relative ${
                        addr.isDefault
                          ? 'border-rose-900 ring-2 ring-rose-900/10 shadow-xs'
                          : 'border-neutral-200/80'
                      }`}
                    >
                      {addr.isDefault && (
                        <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-900">
                          Default
                        </span>
                      )}
                      <p className="font-bold text-xs text-neutral-900">{addr.name}</p>
                      <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                        {addr.address}, {addr.city}, {addr.state} - <strong>{addr.pincode}</strong>
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-1">📱 +91 {addr.phone}</p>

                      <div className="mt-3 pt-2 border-t border-neutral-100 flex items-center justify-between">
                        {!addr.isDefault && (
                          <button
                            type="button"
                            onClick={() => setDefaultAddress(addr.id)}
                            className="text-[11px] font-bold text-rose-900 hover:text-rose-700 cursor-pointer"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteCustomerAddress(addr.id)}
                          className="text-[11px] text-neutral-400 hover:text-rose-600 flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WISHLIST */}
          {activeTab === 'wishlist' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-neutral-900 font-serif">
                  My Private Wishlist
                </h3>
                <p className="text-xs text-neutral-500">
                  Your bookmarked sarees & boutique creations saved in your private profile.
                </p>
              </div>

              {wishlistProducts.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-neutral-200/80 p-6 space-y-2">
                  <Heart className="w-8 h-8 text-neutral-400 mx-auto" />
                  <p className="text-xs text-neutral-500">Your wishlist is currently empty.</p>
                  <p className="text-[11px] text-neutral-400">
                    Tap the heart icon on any product in the store to save it here!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {wishlistProducts.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-2xs group flex flex-col justify-between"
                    >
                      <div className="relative aspect-4/5 bg-neutral-100 overflow-hidden">
                        <img
                          src={p.images[0]}
                          alt={p.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            downloadSingleImage(p.images[0], `${p.title}_${p.productCode || 'sku'}.jpg`)
                          }
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black text-white text-xs transition cursor-pointer"
                          title="Download photo"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="p-3 space-y-1">
                        <p className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                          {p.fabric}
                        </p>
                        <h4 className="font-serif font-bold text-xs text-neutral-900 truncate">
                          {p.title}
                        </h4>
                        <p className="font-bold text-xs text-neutral-900">
                          {formatPrice(p.price)}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenProductDetails?.(p.id);
                          }}
                          className="w-full mt-2 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-[11px] transition cursor-pointer"
                        >
                          View & Order
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PROFILE PRIVACY */}
          {activeTab === 'profile' && (
            <div className="space-y-4 max-w-lg">
              <div>
                <h3 className="text-base font-bold text-neutral-900 font-serif">
                  Customer Privacy & Data Protection
                </h3>
                <p className="text-xs text-neutral-500">
                  Detailed assurance of your account isolation & security.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900">Complete Data Isolation</h4>
                    <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
                      Your customer records, order receipts, shipping addresses, and transaction UTRs
                      are linked strictly to your customer ID (<code>{currentCustomer.id}</code>).
                      No other customer or visitor can access or view your order details.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-700 shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900">Encrypted Courier Dispatch</h4>
                    <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
                      Your contact number and delivery addresses are utilized exclusively for parcel
                      dispatch with registered courier partners (DTDC, Blue Dart, Speed Post).
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-neutral-800">Account Status</p>
                    <p className="text-[11px] text-emerald-600 font-semibold">Active & Secured</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      customerLogout();
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold transition cursor-pointer"
                  >
                    Log Out of Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
