import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { CustomerAddress, Order, OrderStatus } from '../../types/store';
import { formatPrice } from '../../utils/upi';
import { downloadSingleImage } from '../../utils/imageDownload';
import { resolveCourierDetails, buildCourierTrackingUrl } from '../../utils/courier';
import { OrderLiveChat } from '../common/OrderLiveChat';
import {
  getNotificationPermission,
  requestNotificationPermission,
  triggerDeviceVibration,
} from '../../utils/deviceNotifications';
import { playChatChimeSound } from '../../utils/audio';
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
  ArrowLeft,
  Copy,
  Check,
  Search,
  Volume2,
  XCircle,
  RotateCcw,
  Phone,
  Printer,
  Maximize2,
  Minimize2,
  Minus,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { getThemeColors } from '../../utils/theme';
import { AppNotification } from '../../types/store';
import { formatDeviceDateTime } from '../../utils/deviceTime';

interface CustomerAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenOrderChat?: (orderId: string) => void;
  onOpenProductDetails?: (productId: string) => void;
  initialOrderId?: string;
}

export const CustomerAccountModal: React.FC<CustomerAccountModalProps> = ({
  isOpen,
  onClose,
  onOpenOrderChat,
  onOpenProductDetails,
  initialOrderId,
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
    requestOrderCancellation,
    reportCustomerDeliveryIssue,
  } = useStore();

  const themeColors = getThemeColors(settings.theme, settings.themeMode);
  const [activeTab, setActiveTab] = useState<'orders' | 'notifications' | 'addresses' | 'wishlist' | 'profile'>('orders');
  const [notifFilter, setNotifFilter] = useState<'all' | 'restock' | 'order' | 'chat'>('all');

  // Customer Orders Tracking State (Matches Reseller Portal Tracking Layout)
  const [selectedCustomerOrderId, setSelectedCustomerOrderId] = useState<string | null>(initialOrderId || null);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'Shipped' | 'Confirmed' | 'Delivered' | 'Pending' | 'Cancelled'>('all');
  const [copiedOrderKey, setCopiedOrderKey] = useState<string | null>(null);

  // Cancellation and Issue Reporting
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('Found another weave / Changed mind');
  const [cancelStatusMsg, setCancelStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Live Master Weaver Support Controls (Maximize / Minimize)
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [isChatMaximized, setIsChatMaximized] = useState(false);

  // Notifications alert system state
  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    return getNotificationPermission();
  });
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [headerNotice, setHeaderNotice] = useState<string | null>(null);

  useEffect(() => {
    if (initialOrderId) {
      setSelectedCustomerOrderId(initialOrderId);
      setActiveTab('orders');
    }
  }, [initialOrderId]);

  useEffect(() => {
    setIsChatMaximized(false);
  }, [selectedCustomerOrderId]);

  const copyOrderText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedOrderKey(key);
    setTimeout(() => setCopiedOrderKey(null), 2000);
  };

  const handleEnableNotifications = async () => {
    setIsRequestingPermission(true);
    const granted = await requestNotificationPermission();
    setNotificationPermission(getNotificationPermission());
    setIsRequestingPermission(false);
    if (granted) {
      playChatChimeSound(true);
      triggerDeviceVibration([150, 75, 150]);
      setHeaderNotice('Device notifications active!');
      setTimeout(() => setHeaderNotice(null), 3000);
    } else {
      setHeaderNotice('Notifications blocked in browser settings.');
      setTimeout(() => setHeaderNotice(null), 3500);
    }
  };

  const handleTestSound = () => {
    playChatChimeSound(true);
    triggerDeviceVibration([180, 80, 180]);
    setHeaderNotice('Sound & haptic vibration tested!');
    setTimeout(() => setHeaderNotice(null), 2500);
  };

  const getStatusStepIndex = (status: OrderStatus) => {
    switch (status) {
      case 'Pending':
        return 0;
      case 'Confirmed':
        return 1;
      case 'Shipped':
        return 2;
      case 'Delivered':
        return 3;
      default:
        return -1;
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Pending':
        return {
          bg: 'bg-amber-100 text-amber-900 border-amber-300',
          icon: Clock,
          label: 'Pending Confirmation',
        };
      case 'Confirmed':
        return {
          bg: 'bg-purple-100 text-purple-900 border-purple-300',
          icon: CheckCircle,
          label: 'Confirmed & In Packing',
        };
      case 'Shipped':
        return {
          bg: 'bg-blue-100 text-blue-900 border-blue-300',
          icon: Truck,
          label: 'Dispatched / In Transit',
        };
      case 'Delivered':
        return {
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          icon: Package,
          label: 'Delivered',
        };
      case 'Cancelled':
      case 'Rejected':
        return {
          bg: 'bg-rose-100 text-rose-900 border-rose-300',
          icon: XCircle,
          label: 'Cancelled',
        };
      case 'Refunded':
        return {
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          icon: RotateCcw,
          label: 'Refund Settled',
        };
      default:
        return {
          bg: 'bg-neutral-100 text-neutral-800 border-neutral-300',
          icon: Clock,
          label: status,
        };
    }
  };

  // Distinctive Color Coding when Orders Shift Stages
  const getOrderStageTheme = (status: OrderStatus) => {
    switch (status) {
      case 'Pending':
        return {
          stageIndex: 0,
          stageName: 'Pending Confirmation',
          badgeBg: 'bg-amber-100 text-amber-950 border-amber-300',
          cardBorder: 'border-l-4 border-l-amber-500 border-amber-200/90',
          cardBg: 'bg-gradient-to-r from-amber-50/50 via-white to-white',
          bannerBg: 'bg-amber-50 border-amber-300 text-amber-950',
          stepBg: 'bg-amber-500 text-white',
          stepRing: 'ring-4 ring-amber-200',
          stepText: 'text-amber-900',
          accentText: 'text-amber-900',
          dotColor: 'bg-amber-500',
          stageLabel: 'Stage 1 of 4: Placed & In Queue',
          stageDesc: 'Awaiting artisan review & master weaver loom allocation',
          legendLabel: 'Pending (Stage 1)',
        };
      case 'Confirmed':
        return {
          stageIndex: 1,
          stageName: 'Confirmed & In Packing',
          badgeBg: 'bg-purple-100 text-purple-950 border-purple-300',
          cardBorder: 'border-l-4 border-l-purple-600 border-purple-200/90',
          cardBg: 'bg-gradient-to-r from-purple-50/50 via-white to-white',
          bannerBg: 'bg-purple-50 border-purple-300 text-purple-950',
          stepBg: 'bg-purple-600 text-white',
          stepRing: 'ring-4 ring-purple-200',
          stepText: 'text-purple-900',
          accentText: 'text-purple-900',
          dotColor: 'bg-purple-600',
          stageLabel: 'Stage 2 of 4: Loom Verification & Packing',
          stageDesc: 'Artisan quality check complete; saree is being packed in royal silk box',
          legendLabel: 'Confirmed (Stage 2)',
        };
      case 'Shipped':
        return {
          stageIndex: 2,
          stageName: 'Dispatched / In Transit',
          badgeBg: 'bg-blue-100 text-blue-950 border-blue-300',
          cardBorder: 'border-l-4 border-l-blue-600 border-blue-200/90',
          cardBg: 'bg-gradient-to-r from-blue-50/50 via-white to-white',
          bannerBg: 'bg-blue-50 border-blue-300 text-blue-950',
          stepBg: 'bg-blue-600 text-white',
          stepRing: 'ring-4 ring-blue-200',
          stepText: 'text-blue-900',
          accentText: 'text-blue-900',
          dotColor: 'bg-blue-600',
          stageLabel: 'Stage 3 of 4: Dispatched / In Transit',
          stageDesc: 'Consignment handed over to courier partner with active tracking waybill',
          legendLabel: 'Dispatched (Stage 3)',
        };
      case 'Delivered':
        return {
          stageIndex: 3,
          stageName: 'Delivered',
          badgeBg: 'bg-emerald-100 text-emerald-950 border-emerald-300',
          cardBorder: 'border-l-4 border-l-emerald-600 border-emerald-200/90',
          cardBg: 'bg-gradient-to-r from-emerald-50/50 via-white to-white',
          bannerBg: 'bg-emerald-50 border-emerald-300 text-emerald-950',
          stepBg: 'bg-emerald-600 text-white',
          stepRing: 'ring-4 ring-emerald-200',
          stepText: 'text-emerald-900',
          accentText: 'text-emerald-900',
          dotColor: 'bg-emerald-600',
          stageLabel: 'Stage 4 of 4: Delivered to Patron ✓',
          stageDesc: 'Handcrafted heirloom delivered safely to your address',
          legendLabel: 'Delivered (Stage 4)',
        };
      case 'Cancelled':
      case 'Rejected':
        return {
          stageIndex: -1,
          stageName: 'Cancelled',
          badgeBg: 'bg-rose-100 text-rose-950 border-rose-300',
          cardBorder: 'border-l-4 border-l-rose-500 border-rose-200/90',
          cardBg: 'bg-gradient-to-r from-rose-50/50 via-white to-white',
          bannerBg: 'bg-rose-50 border-rose-300 text-rose-950',
          stepBg: 'bg-rose-600 text-white',
          stepRing: 'ring-4 ring-rose-200',
          stepText: 'text-rose-900',
          accentText: 'text-rose-900',
          dotColor: 'bg-rose-500',
          stageLabel: 'Order Cancelled',
          stageDesc: 'This order has been cancelled',
          legendLabel: 'Cancelled',
        };
      case 'Refunded':
        return {
          stageIndex: -1,
          stageName: 'Refund Settled',
          badgeBg: 'bg-teal-100 text-teal-950 border-teal-300',
          cardBorder: 'border-l-4 border-l-teal-600 border-teal-200/90',
          cardBg: 'bg-gradient-to-r from-teal-50/50 via-white to-white',
          bannerBg: 'bg-teal-50 border-teal-300 text-teal-950',
          stepBg: 'bg-teal-600 text-white',
          stepRing: 'ring-4 ring-teal-200',
          stepText: 'text-teal-900',
          accentText: 'text-teal-900',
          dotColor: 'bg-teal-600',
          stageLabel: 'Refund Settled ✓',
          stageDesc: 'Payment refund has been processed',
          legendLabel: 'Refunded',
        };
      default:
        return {
          stageIndex: 0,
          stageName: status,
          badgeBg: 'bg-neutral-100 text-neutral-800 border-neutral-300',
          cardBorder: 'border-l-4 border-l-neutral-400 border-neutral-200',
          cardBg: 'bg-white',
          bannerBg: 'bg-neutral-50 border-neutral-200 text-neutral-800',
          stepBg: 'bg-neutral-800 text-white',
          stepRing: 'ring-4 ring-neutral-200',
          stepText: 'text-neutral-700',
          accentText: 'text-neutral-700',
          dotColor: 'bg-neutral-400',
          stageLabel: `Status: ${status}`,
          stageDesc: '',
          legendLabel: status,
        };
    }
  };

  // Filtered customer orders list
  const filteredCustomerOrders = useMemo(() => {
    let list = customerOrders;
    if (orderStatusFilter !== 'all') {
      if (orderStatusFilter === 'Cancelled') {
        list = list.filter((o) => o.status === 'Cancelled' || o.status === 'Rejected' || o.status === 'Refunded');
      } else {
        list = list.filter((o) => o.status === orderStatusFilter);
      }
    }
    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase().trim();
      list = list.filter((o) => {
        if (o.orderNumber?.toLowerCase().includes(q)) return true;
        if (o.customer?.name?.toLowerCase().includes(q)) return true;
        if (o.customer?.city?.toLowerCase().includes(q)) return true;
        if (o.shippingDetails?.trackingNumber?.toLowerCase().includes(q)) return true;
        if (o.shippingDetails?.courierName?.toLowerCase().includes(q)) return true;
        if (o.items.some((i) => i.product.title.toLowerCase().includes(q) || i.product.productCode?.toLowerCase().includes(q))) return true;
        return false;
      });
    }
    return list;
  }, [customerOrders, orderStatusFilter, orderSearchQuery]);

  const orderStatusCounts = useMemo(() => {
    const counts = {
      all: customerOrders.length,
      Shipped: 0,
      Confirmed: 0,
      Delivered: 0,
      Pending: 0,
      Cancelled: 0,
    };
    customerOrders.forEach((o) => {
      if (o.status === 'Shipped') counts.Shipped++;
      else if (o.status === 'Confirmed') counts.Confirmed++;
      else if (o.status === 'Delivered') counts.Delivered++;
      else if (o.status === 'Pending') counts.Pending++;
      else if (o.status === 'Cancelled' || o.status === 'Rejected' || o.status === 'Refunded') counts.Cancelled++;
    });
    return counts;
  }, [customerOrders]);

  const selectedCustomerOrder = useMemo(() => {
    if (!selectedCustomerOrderId) return null;
    return customerOrders.find(
      (o) => o.id === selectedCustomerOrderId || o.orderNumber.toUpperCase() === selectedCustomerOrderId.toUpperCase()
    ) || null;
  }, [selectedCustomerOrderId, customerOrders]);

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
      setActiveTab('orders');
      if (notif.targetId || notif.orderId) {
        setSelectedCustomerOrderId(notif.targetId || notif.orderId || null);
      }
    } else if (notif.targetType === 'chat' && notif.targetId) {
      setActiveTab('orders');
      setSelectedCustomerOrderId(notif.targetId);
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
          {/* TAB 1: ORDERS (RICH RESELLER-STYLE TRACKING LAYOUT) */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-neutral-900 font-serif">
                      My Orders & Consignment Tracking
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                      {customerOrders.length} {customerOrders.length === 1 ? 'Order' : 'Orders'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Live dispatch transit, stage progression & boutique concierge chat for patron: <strong>{currentCustomer.name}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Device Notification Alert Button */}
                  <button
                    type="button"
                    onClick={handleEnableNotifications}
                    disabled={isRequestingPermission}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                      notificationPermission === 'granted'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-white hover:bg-neutral-100 text-neutral-700 border-neutral-300'
                    }`}
                    title="Enable device notifications for real-time dispatch and chat updates"
                  >
                    <Bell className={`w-3.5 h-3.5 ${notificationPermission === 'granted' ? 'text-emerald-600' : 'text-neutral-500'}`} />
                    <span className="hidden sm:inline">
                      {notificationPermission === 'granted' ? 'Alerts Active' : 'Enable Alerts'}
                    </span>
                  </button>

                  {/* Sound Chime Test Button */}
                  <button
                    type="button"
                    onClick={handleTestSound}
                    className="p-2 rounded-xl bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-300 transition cursor-pointer"
                    title="Test chime and haptic alert"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-neutral-700" />
                  </button>

                  {selectedCustomerOrderId && (
                    <button
                      type="button"
                      onClick={() => setSelectedCustomerOrderId(null)}
                      className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to All Orders</span>
                    </button>
                  )}
                </div>
              </div>

              {headerNotice && (
                <div className="p-3 rounded-xl bg-neutral-900 text-white text-xs font-medium animate-in fade-in flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{headerNotice}</span>
                </div>
              )}

              {cancelStatusMsg && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                    cancelStatusMsg.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border border-rose-200 text-rose-900'
                  }`}
                >
                  {cancelStatusMsg.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="font-medium">{cancelStatusMsg.text}</span>
                </div>
              )}

              {/* =========================================================================
                  VIEW 1: LIST VIEW (when selectedCustomerOrderId === null)
                 ========================================================================= */}
              {!selectedCustomerOrder ? (
                <div className="space-y-4">
                  {/* Search & Status Filter Chips */}
                  <div className="bg-white p-4 rounded-2xl border border-neutral-200 space-y-3 shadow-2xs">
                    {/* Search Bar */}
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input
                        type="text"
                        value={orderSearchQuery}
                        onChange={(e) => setOrderSearchQuery(e.target.value)}
                        placeholder="Search Order # (e.g. NYD-1001), saree title, city, or AWB tracking..."
                        className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-neutral-300 bg-white text-xs sm:text-sm text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                      />
                      {orderSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setOrderSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                          title="Clear search"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Results Count Bar */}
                    <div className="flex items-center justify-between pt-1 text-xs text-neutral-600">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-800">
                          {orderSearchQuery ? `Search Results for "${orderSearchQuery}"` : 'Your Placed Orders'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold">
                          {filteredCustomerOrders.length}
                        </span>
                      </div>

                      {orderSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setOrderSearchQuery('')}
                          className="text-amber-800 hover:underline font-semibold text-xs cursor-pointer"
                        >
                          Clear Filter
                        </button>
                      )}
                    </div>

                    {/* Status Filter Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                      {[
                        { id: 'all', label: 'All Orders', count: orderStatusCounts.all },
                        { id: 'Shipped', label: 'Dispatched / In Transit', count: orderStatusCounts.Shipped },
                        { id: 'Confirmed', label: 'Confirmed & In Packing', count: orderStatusCounts.Confirmed },
                        { id: 'Delivered', label: 'Delivered', count: orderStatusCounts.Delivered },
                        { id: 'Pending', label: 'Pending', count: orderStatusCounts.Pending },
                        { id: 'Cancelled', label: 'Cancelled / Refunded', count: orderStatusCounts.Cancelled },
                      ].map((tab) => {
                        const isActive = orderStatusFilter === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setOrderStatusFilter(tab.id as any)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                              isActive
                                ? 'bg-neutral-900 text-white shadow-xs'
                                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                            }`}
                          >
                            <span>{tab.label}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                isActive ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-800'
                              }`}
                            >
                              {tab.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Stage Colour Coding Legend Bar */}
                    <div className="p-2.5 sm:p-3 rounded-xl bg-neutral-50/90 border border-neutral-200/80 flex items-center justify-between gap-2 flex-wrap text-[11px]">
                      <span className="font-bold text-neutral-500 uppercase tracking-wide text-[10px]">
                        Stage Progression Colour Coding:
                      </span>
                      <div className="flex items-center gap-2.5 sm:gap-3.5 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 text-amber-950 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <span>Pending (Stage 1)</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-purple-950 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                          <span>Confirmed & Packing (Stage 2)</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-blue-950 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                          <span>Dispatched (Stage 3)</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-emerald-950 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-600" />
                          <span>Delivered (Stage 4)</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {filteredCustomerOrders.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200 p-8 space-y-3">
                      <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
                        <Package className="w-6 h-6" />
                      </div>
                      <h4 className="font-serif font-bold text-neutral-800 text-base">
                        {orderSearchQuery ? 'No matching orders found' : 'No orders in this status category'}
                      </h4>
                      <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                        {orderSearchQuery
                          ? 'Try searching by a different order number, saree name, or tracking waybill.'
                          : 'Explore our artisan handloom collections to place a bespoke saree reservation.'}
                      </p>
                      {orderSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setOrderSearchQuery('');
                            setOrderStatusFilter('all');
                          }}
                          className="px-4 py-2 rounded-xl bg-neutral-900 text-white font-bold text-xs hover:bg-neutral-800 transition cursor-pointer"
                        >
                          View All Orders
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {filteredCustomerOrders.map((ord) => {
                        const badge = getStatusBadge(ord.status);
                        const stageTheme = getOrderStageTheme(ord.status);
                        const BadgeIcon = badge.icon;
                        const itemCount = ord.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
                        const courier = resolveCourierDetails(ord.shippingDetails?.courierName, settings.courierServices);
                        const trackingUrl = buildCourierTrackingUrl(
                          courier,
                          ord.shippingDetails?.courierName,
                          ord.shippingDetails?.trackingNumber
                        );

                        return (
                          <div
                            key={ord.id}
                            onClick={() => setSelectedCustomerOrderId(ord.id)}
                            className={`rounded-2xl border p-4 sm:p-5 shadow-2xs hover:shadow-md transition cursor-pointer group ${stageTheme.cardBorder} ${stageTheme.cardBg}`}
                          >
                            {/* Top Card Row */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200/60 pb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-neutral-950 bg-white border border-neutral-200 px-2 py-0.5 rounded shadow-2xs">
                                  #{ord.orderNumber}
                                </span>
                                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 shadow-2xs ${stageTheme.badgeBg}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${stageTheme.dotColor} animate-pulse`} />
                                  <BadgeIcon className="w-3 h-3" />
                                  <span>{stageTheme.stageName}</span>
                                </span>
                                {/* Payment Verified Badge */}
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                  <span>Prepaid UPI Verified</span>
                                  <span className="px-1 rounded bg-emerald-600 text-white text-[9px] font-extrabold uppercase">PAID</span>
                                </span>
                                <span className="text-[11px] text-neutral-400">
                                  {new Date(ord.createdAt).toLocaleDateString('en-GB')} at{' '}
                                  {new Date(ord.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                </span>
                              </div>

                              <div className="flex items-center gap-2.5 justify-between sm:justify-end">
                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${stageTheme.bannerBg} hidden sm:inline-block`}>
                                  {stageTheme.stageLabel}
                                </span>
                                <span className="font-serif font-bold text-sm sm:text-base text-neutral-900 tabular-nums">
                                  {formatPrice(ord.totalAmount)}
                                </span>
                              </div>
                            </div>

                            {/* Middle Items Row */}
                            <div className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <img
                                  src={ord.items[0]?.product.images?.[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                                  alt={ord.items[0]?.product.title}
                                  className="w-14 h-14 rounded-xl object-cover border border-neutral-200 shrink-0 bg-neutral-100"
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-neutral-900 truncate">
                                    {ord.items[0]?.product.title}
                                    {ord.items.length === 1 && ord.items[0]?.quantity > 1 ? ` (x${ord.items[0].quantity})` : ''}
                                    {ord.items.length > 1 ? ` and ${ord.items.length - 1} other saree${ord.items.length > 2 ? 's' : ''}` : ''}
                                  </p>
                                  <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5 flex-wrap">
                                    <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
                                    <span>·</span>
                                    <span className="font-medium text-neutral-700">
                                      Deliver To: {ord.customer.name} ({ord.customer.city}, {ord.customer.state})
                                    </span>
                                    {ord.assignedStaffName && (
                                      <>
                                        <span>·</span>
                                        <span className="text-purple-800 font-semibold">Concierge: {ord.assignedStaffName}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Action Callout */}
                              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 group-hover:text-amber-700 transition shrink-0 ml-auto md:ml-0">
                                <span>View Tracking & Live Progression</span>
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                              </div>
                            </div>

                            {/* Payment Settlement Strip */}
                            <div className="mt-1 p-2.5 rounded-xl bg-gradient-to-r from-emerald-50/70 via-slate-50 to-emerald-50/40 border border-emerald-200/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-emerald-900 text-[10px] uppercase">
                                      Prepaid Direct UPI Verified
                                    </span>
                                    <span className="px-1 rounded bg-emerald-600 text-white text-[9px] font-extrabold uppercase">PAID</span>
                                  </div>
                                  <p className="font-mono text-[10px] text-slate-600 truncate mt-0.5">
                                    UPI Reference / UTR: <strong>{ord.upiTransactionId || 'TXN-CONFIRMED'}</strong>
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 sm:self-center">
                                <span className="text-[10px] font-medium text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                                  {ord.paymentMethod || 'Direct Merchant UPI'}
                                </span>
                              </div>
                            </div>

                            {/* Customer Delivery Address Box */}
                            <div className="mt-2.5 p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                                  DELIVERY DESTINATION
                                </span>
                                <p className="text-neutral-900 font-medium text-[11px] truncate">
                                  <strong>{ord.customer.name}</strong> · 📱 +91 {ord.customer.phone} · {ord.customer.address}, {ord.customer.city}, {ord.customer.state} - {ord.customer.pincode}
                                </p>
                              </div>
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md shrink-0">
                                Heirloom Silk Packaging
                              </span>
                            </div>

                            {/* Courier Snippet with direct Tracking link */}
                            {ord.shippingDetails?.trackingNumber && (
                              <div className="mt-2.5 p-2.5 rounded-xl bg-blue-50/90 border border-blue-200 text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-xs min-w-0">
                                  <Truck className="w-4 h-4 text-blue-700 shrink-0" />
                                  <span className="truncate">
                                    <strong>{ord.shippingDetails.courierName || 'Partner Courier'}</strong>:{' '}
                                    <code className="font-mono font-bold">{ord.shippingDetails.trackingNumber}</code>
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                                    In Transit
                                  </span>
                                  {trackingUrl && (
                                    <a
                                      href={trackingUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition shadow-2xs cursor-pointer"
                                    >
                                      <span>Track on Courier Portal</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* =========================================================================
                    VIEW 2: DETAILED ORDER TRACKING VIEW (matches Reseller Tracking)
                   ========================================================================= */
                <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm space-y-5 p-4 sm:p-6">
                  {/* Top Navigation Bar */}
                  <div className="flex items-center justify-between gap-3 pb-4 border-b border-neutral-200 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedCustomerOrderId(null)}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-bold text-xs transition cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4 text-neutral-800" />
                      <span>Back to My Orders</span>
                    </button>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Copyable Order Number */}
                      <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                        <span className="font-mono font-bold text-xs text-amber-950">
                          #{selectedCustomerOrder.orderNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyOrderText(selectedCustomerOrder.orderNumber, `ord-num-${selectedCustomerOrder.id}`)}
                          className="p-0.5 text-amber-800 hover:text-amber-950 rounded cursor-pointer"
                          title="Copy Order Reference"
                        >
                          {copiedOrderKey === `ord-num-${selectedCustomerOrder.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Status Badge with Stage Color */}
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-2xs ${getOrderStageTheme(selectedCustomerOrder.status).badgeBg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getOrderStageTheme(selectedCustomerOrder.status).dotColor} animate-pulse`} />
                        <span>{getOrderStageTheme(selectedCustomerOrder.status).stageName}</span>
                      </span>

                      {/* Payment Verified Badge */}
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Prepaid UPI Verified</span>
                        <span className="px-1 rounded bg-emerald-600 text-white text-[9px] font-extrabold uppercase">PAID</span>
                      </span>

                      {/* Device Alerts Active / Enable Button */}
                      {notificationPermission === 'granted' ? (
                        <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                          <span className="font-bold text-emerald-800 text-[11px]">Alerts Active</span>
                          <button
                            type="button"
                            onClick={handleTestSound}
                            className="ml-1 p-0.5 rounded text-neutral-500 hover:text-neutral-800 transition cursor-pointer"
                            title="Test alert chime & vibration"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleEnableNotifications}
                          disabled={isRequestingPermission}
                          className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-[11px] font-bold transition cursor-pointer"
                          title="Enable notifications for live concierge & courier tracking updates"
                        >
                          <Bell className="w-3.5 h-3.5 animate-bounce shrink-0" />
                          <span>{isRequestingPermission ? 'Enabling...' : 'Enable Alerts'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Stage Color Progression Callout Banner */}
                  <div className={`p-3.5 sm:p-4 rounded-2xl border ${getOrderStageTheme(selectedCustomerOrder.status).bannerBg} flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-3.5 h-3.5 rounded-full ${getOrderStageTheme(selectedCustomerOrder.status).dotColor} animate-ping shrink-0`} />
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest block opacity-75">
                          Order Stage Shift & Tracking
                        </span>
                        <h4 className="font-bold text-xs sm:text-sm">
                          {getOrderStageTheme(selectedCustomerOrder.status).stageLabel}
                        </h4>
                      </div>
                    </div>
                    <p className="text-xs font-medium opacity-90 max-w-md">
                      {getOrderStageTheme(selectedCustomerOrder.status).stageDesc}
                    </p>
                  </div>

                  {/* Customer Delivery Destination Card */}
                  <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">
                        Delivery Destination
                      </span>
                      <h4 className="font-serif font-bold text-base text-neutral-900 mt-0.5">
                        {selectedCustomerOrder.customer.name}
                      </h4>
                      <p className="text-xs text-neutral-600 mt-1">
                        {selectedCustomerOrder.customer.address}, {selectedCustomerOrder.customer.city},{' '}
                        {selectedCustomerOrder.customer.state} - <strong>{selectedCustomerOrder.customer.pincode}</strong>
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <a
                          href={`tel:+91${selectedCustomerOrder.customer.phone}`}
                          className="inline-flex items-center gap-1 text-amber-900 font-semibold hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5 text-amber-800" />
                          <span>+91 {selectedCustomerOrder.customer.phone}</span>
                        </a>
                        <span className="text-neutral-300">|</span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-200">
                          Heirloom Silk Packaging
                        </span>
                      </div>
                    </div>

                    <div className="text-left md:text-right border-t md:border-t-0 pt-3 md:pt-0 border-neutral-200">
                      <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">
                        Order Settlement
                      </span>
                      <p className="font-serif font-bold text-2xl text-neutral-900 tabular-nums">
                        {formatPrice(selectedCustomerOrder.totalAmount)}
                      </p>
                      <span className="text-[11px] text-neutral-500 mt-0.5 block">
                        Placed on {new Date(selectedCustomerOrder.createdAt).toLocaleDateString('en-GB')} at{' '}
                        {new Date(selectedCustomerOrder.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>
                    </div>
                  </div>

                  {/* Cancellation Request Banner if pending */}
                  {selectedCustomerOrder.cancellationRequest?.requested &&
                    selectedCustomerOrder.cancellationRequest.status === 'pending' && (
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 text-amber-950 space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span>Cancellation Request Submitted (Under Review)</span>
                        </div>
                        <p className="leading-relaxed">
                          Your request to cancel this order has been submitted to the boutique on{' '}
                          {new Date(selectedCustomerOrder.cancellationRequest.requestedAt).toLocaleDateString('en-IN')}. Our dispatch team is reviewing before shipment handover.
                        </p>
                        <p className="text-amber-800 italic">
                          Reason: "{selectedCustomerOrder.cancellationRequest.reason}"
                        </p>
                      </div>
                    )}

                  {/* Stage Timeline (4-Step Stepper) */}
                  {selectedCustomerOrder.status !== 'Cancelled' &&
                  selectedCustomerOrder.status !== 'Rejected' &&
                  selectedCustomerOrder.status !== 'Refunded' ? (
                    <div className="p-4 rounded-2xl border border-neutral-200 bg-white space-y-3">
                      {/* Concierge Assigned Banner */}
                      {selectedCustomerOrder.assignedStaffName ? (
                        <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-700 to-indigo-800 text-white font-serif font-bold text-xs flex items-center justify-center shadow-2xs shrink-0">
                              {selectedCustomerOrder.assignedStaffName.charAt(0)}
                            </span>
                            <div>
                              <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
                                Dedicated Concierge Assigned
                              </span>
                              <h4 className="font-serif font-bold text-xs sm:text-sm text-neutral-900">
                                {selectedCustomerOrder.assignedStaffName}
                              </h4>
                            </div>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold shrink-0">
                            Concierge Assigned ✓
                          </span>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                              <Clock className="w-4 h-4 text-amber-700" />
                            </span>
                            <div>
                              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                                Order in Fulfillment Queue
                              </span>
                              <h4 className="font-serif font-bold text-xs text-neutral-900">
                                Awaiting Master Weaver Quality Check & Packing
                              </h4>
                            </div>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold shrink-0">
                            In Queue
                          </span>
                        </div>
                      )}

                      {/* 4-Step Visual Progression Stepper with Stage Colour Coding */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">
                            Live Delivery Progression
                          </span>
                          <span className="text-[10px] font-bold text-neutral-500 hidden sm:inline">
                            Stages: <span className="text-amber-600">Pending</span> → <span className="text-purple-600">Confirmed</span> → <span className="text-blue-600">Dispatched</span> → <span className="text-emerald-600">Delivered</span>
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 pt-1">
                          {[
                            {
                              name: 'Pending',
                              icon: Clock,
                              activeBg: 'bg-amber-500 text-white shadow-md',
                              doneBg: 'bg-amber-600 text-white',
                              ring: 'ring-4 ring-amber-200',
                              activeText: 'text-amber-900 font-bold',
                              doneText: 'text-amber-800 font-semibold',
                            },
                            {
                              name: 'Confirmed',
                              icon: CheckCircle,
                              activeBg: 'bg-purple-600 text-white shadow-md',
                              doneBg: 'bg-purple-700 text-white',
                              ring: 'ring-4 ring-purple-200',
                              activeText: 'text-purple-900 font-bold',
                              doneText: 'text-purple-800 font-semibold',
                            },
                            {
                              name: 'Shipped',
                              icon: Truck,
                              activeBg: 'bg-blue-600 text-white shadow-md',
                              doneBg: 'bg-blue-700 text-white',
                              ring: 'ring-4 ring-blue-200',
                              activeText: 'text-blue-900 font-bold',
                              doneText: 'text-blue-800 font-semibold',
                            },
                            {
                              name: 'Delivered',
                              icon: Package,
                              activeBg: 'bg-emerald-600 text-white shadow-md',
                              doneBg: 'bg-emerald-700 text-white',
                              ring: 'ring-4 ring-emerald-200',
                              activeText: 'text-emerald-900 font-bold',
                              doneText: 'text-emerald-800 font-semibold',
                            },
                          ].map((step, idx) => {
                            const currentStep = getStatusStepIndex(selectedCustomerOrder.status);
                            const isDone = currentStep >= idx;
                            const isCurrent = currentStep === idx;
                            const StepIcon = step.icon;
                            return (
                              <div key={step.name} className="flex flex-col items-center text-center">
                                <div
                                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                                    isCurrent
                                      ? `${step.activeBg} ${step.ring} scale-105`
                                      : isDone
                                      ? step.doneBg
                                      : 'bg-neutral-100 text-neutral-400'
                                  }`}
                                >
                                  <StepIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                                </div>
                                <span
                                  className={`text-[11px] mt-1.5 transition ${
                                    isCurrent
                                      ? step.activeText
                                      : isDone
                                      ? step.doneText
                                      : 'text-neutral-400 font-normal'
                                  }`}
                                >
                                  {step.name}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Cancellation & Refund Progression */
                    <div className="p-4 rounded-2xl border border-neutral-200 bg-white space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                          Cancellation & Refund Progression
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            selectedCustomerOrder.status === 'Refunded'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-rose-100 text-rose-900 border border-rose-300'
                          }`}
                        >
                          {selectedCustomerOrder.status === 'Refunded' ? 'Stage: Refund Completed ✓' : 'Stage: Order Cancelled'}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-2 pt-1">
                        {[
                          { name: 'Placed', isDone: true, isCurrent: false, icon: Clock },
                          { name: 'Confirmed', isDone: true, isCurrent: false, icon: CheckCircle },
                          {
                            name: 'Cancelled',
                            isDone: true,
                            isCurrent:
                              selectedCustomerOrder.status === 'Cancelled' ||
                              selectedCustomerOrder.status === 'Rejected',
                            icon: XCircle,
                          },
                          {
                            name: 'Refunded',
                            isDone:
                              selectedCustomerOrder.status === 'Refunded' ||
                              selectedCustomerOrder.refundDetails?.refundStatus === 'processed',
                            isCurrent: selectedCustomerOrder.status === 'Refunded',
                            icon: RotateCcw,
                          },
                        ].map((step) => {
                          const StepIcon = step.icon;
                          return (
                            <div key={step.name} className="flex flex-col items-center text-center">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                                  step.name === 'Refunded' && step.isDone
                                    ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                                    : step.name === 'Cancelled' && step.isCurrent
                                    ? 'bg-rose-600 text-white ring-4 ring-rose-100'
                                    : step.isDone
                                    ? 'bg-neutral-800 text-white'
                                    : 'bg-neutral-100 text-neutral-400'
                                }`}
                              >
                                <StepIcon className="w-4 h-4" />
                              </div>
                              <span
                                className={`text-[11px] mt-1.5 font-semibold ${
                                  step.isCurrent
                                    ? 'text-neutral-900 font-bold'
                                    : step.isDone
                                    ? 'text-neutral-700'
                                    : 'text-neutral-400'
                                }`}
                              >
                                {step.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {selectedCustomerOrder.status === 'Refunded' ? (
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300 text-emerald-950 space-y-1.5 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                              <span>Refund Settled Successfully</span>
                            </span>
                            <span className="font-mono font-bold text-emerald-800 text-xs">
                              UTR: {selectedCustomerOrder.refundDetails?.refundUtr || 'Processed'}
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-800">
                            Amount of {formatPrice(selectedCustomerOrder.totalAmount)} refunded to customer account.
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-950 text-xs mt-2">
                          <p>
                            <strong>Cancellation Reason:</strong> {selectedCustomerOrder.cancellationReason || 'Customer requested'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Courier Consignment & Official Tracking Box */}
                  {(selectedCustomerOrder.status === 'Shipped' || selectedCustomerOrder.shippingDetails?.trackingNumber) && (
                    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-blue-700" />
                          <h4 className="font-bold text-xs sm:text-sm">Courier Consignment Dispatch Information</h4>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                          In Transit
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3.5 rounded-xl border border-blue-100">
                        <div>
                          <span className="text-neutral-500 text-[11px] font-semibold">Courier Partner:</span>
                          <p className="font-bold text-neutral-900 text-sm mt-0.5">
                            {selectedCustomerOrder.shippingDetails?.courierName || 'Assigned Logistics Partner'}
                          </p>
                        </div>
                        <div>
                          <span className="text-neutral-500 text-[11px] font-semibold">
                            Consignment Tracking / Waybill Number:
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <code className="font-mono font-bold text-xs text-neutral-900 bg-neutral-100 px-2 py-1 rounded">
                              {selectedCustomerOrder.shippingDetails?.trackingNumber || 'Pending Waybill'}
                            </code>
                            {selectedCustomerOrder.shippingDetails?.trackingNumber && (
                              <button
                                type="button"
                                onClick={() =>
                                  copyOrderText(
                                    selectedCustomerOrder.shippingDetails!.trackingNumber,
                                    `track-${selectedCustomerOrder.id}`
                                  )
                                }
                                className="p-1.5 hover:bg-neutral-100 rounded text-neutral-600 cursor-pointer"
                                title="Copy Consignment ID"
                              >
                                {copiedOrderKey === `track-${selectedCustomerOrder.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Official Courier Tracking Button */}
                      {(() => {
                        const courier = resolveCourierDetails(
                          selectedCustomerOrder.shippingDetails?.courierName,
                          settings.courierServices
                        );
                        const trackingPortalUrl = buildCourierTrackingUrl(
                          courier,
                          selectedCustomerOrder.shippingDetails?.courierName,
                          selectedCustomerOrder.shippingDetails?.trackingNumber
                        );

                        return trackingPortalUrl ? (
                          <div className="pt-2 border-t border-blue-200/80 flex items-center justify-between flex-wrap gap-2">
                            <span className="text-[11px] text-blue-900 font-semibold flex items-center gap-1">
                              <Truck className="w-3.5 h-3.5 text-blue-700" />
                              <span>Live Courier Tracking:</span>
                            </span>
                            <a
                              href={trackingPortalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-2xs cursor-pointer"
                            >
                              <span>Track on {selectedCustomerOrder.shippingDetails?.courierName || 'Courier'} Portal</span>
                              <ExternalLink className="w-3.5 h-3.5 text-white/90" />
                            </a>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}

                  {/* Ordered Items Breakdown */}
                  <div className="p-4 rounded-2xl border border-neutral-200 bg-white space-y-3">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block">
                      Ordered Items ({selectedCustomerOrder.items.length})
                    </span>
                    <div className="divide-y divide-neutral-100">
                      {selectedCustomerOrder.items.map((item, idx) => (
                        <div key={idx} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={item.product.images?.[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                              alt={item.product.title}
                              className="w-14 h-14 rounded-xl object-cover border border-neutral-200 shrink-0 bg-neutral-100"
                            />
                            <div className="min-w-0">
                              <h4 className="font-serif font-bold text-xs sm:text-sm text-neutral-900 truncate">
                                {item.product.title}
                              </h4>
                              <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5 flex-wrap">
                                <span className="font-mono font-bold text-amber-950 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                  SKU: {item.product.productCode}
                                </span>
                                <span>{item.product.fabric}</span>
                                <span>·</span>
                                <span>{item.product.color}</span>
                                <span>·</span>
                                <span className="font-semibold text-neutral-700">Qty: {item.quantity}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {item.product.images?.[0] && (
                              <button
                                type="button"
                                onClick={() =>
                                  downloadSingleImage(
                                    item.product.images[0],
                                    `${item.product.title}_${item.product.productCode || 'sku'}.jpg`
                                  )
                                }
                                className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-emerald-700 border border-neutral-200 transition cursor-pointer flex items-center gap-1 text-[10px] font-semibold"
                                title="Download saree photo"
                              >
                                <Download className="w-3 h-3 text-emerald-600" />
                                <span className="hidden sm:inline">Save</span>
                              </button>
                            )}
                            <div className="text-right">
                              <span className="font-serif font-bold text-sm text-neutral-900 tabular-nums block">
                                {formatPrice(item.product.price * item.quantity)}
                              </span>
                              <span className="text-[10px] text-neutral-400">
                                ({formatPrice(item.product.price)} each)
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Verification & Settlement Details */}
                  <div className="p-4 rounded-2xl border border-neutral-200 bg-gradient-to-br from-slate-50 to-emerald-50/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Prepaid Direct UPI Settlement</span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        <span>VERIFIED & PAID [100% SECURE]</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-white border border-neutral-200">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase block">
                          Payment Reference / UTR
                        </span>
                        <div className="flex items-center justify-between mt-1">
                          <code className="font-mono font-bold text-neutral-900 text-xs truncate mr-1">
                            {selectedCustomerOrder.upiTransactionId || 'TXN-CONFIRMED'}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyOrderText(selectedCustomerOrder.upiTransactionId || 'TXN-CONFIRMED', `utr-${selectedCustomerOrder.id}`)}
                            className="p-1 text-neutral-500 hover:text-neutral-900 rounded cursor-pointer shrink-0"
                            title="Copy Payment ID"
                          >
                            {copiedOrderKey === `utr-${selectedCustomerOrder.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white border border-neutral-200">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase block">
                          Payment Channel & Merchant
                        </span>
                        <p className="font-bold text-neutral-900 text-xs mt-1 truncate">
                          {selectedCustomerOrder.paymentMethod || 'Direct Merchant UPI (8807392520@okbizaxis)'}
                        </p>
                        {selectedCustomerOrder.paymentScreenshotUrl && (
                          <p className="text-[10px] text-emerald-600 font-medium mt-0.5 truncate">
                            ✓ Payment Screenshot Verified
                          </p>
                        )}
                      </div>

                      <div className="p-3 rounded-xl bg-white border border-neutral-200">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase block">
                          Settlement Status
                        </span>
                        <p className="font-serif font-bold text-emerald-700 text-sm mt-0.5 tabular-nums">
                          {formatPrice(selectedCustomerOrder.totalAmount)} Paid in Full
                        </p>
                        <span className="text-[10px] text-neutral-500">
                          Settled on {new Date(selectedCustomerOrder.paymentVerifiedAt || selectedCustomerOrder.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-white border border-neutral-200">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase block">
                          Verification Audit
                        </span>
                        <p className="font-bold text-neutral-800 text-xs mt-0.5 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{selectedCustomerOrder.paymentVerifiedBy ? `Verified by ${selectedCustomerOrder.paymentVerifiedBy}` : 'Direct UPI Settlement Verified'}</span>
                        </p>
                        <span className="text-[10px] text-neutral-500">
                          Boutique Order Ledger Recorded
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Live Concierge Chat Desk for This Order (Maximizable & Minimizable) */}
                  {isChatMinimized ? (
                    /* Minimized Chat Bar */
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#2c053d] via-[#3a0852] to-[#250334] text-white flex items-center justify-between gap-3 shadow-md border border-purple-400/40 animate-in fade-in">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                          <MessageSquare className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-serif font-bold text-xs sm:text-sm text-white truncate">
                              Live Master Weaver Support
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Atelier Online</span>
                            </span>
                          </div>
                          <p className="text-[11px] text-purple-200/80 truncate mt-0.5">
                            {selectedCustomerOrder.assignedStaffName
                              ? `Support Concierge: ${selectedCustomerOrder.assignedStaffName} · Chat minimized`
                              : 'Customer Support Desk · Click Expand Chat to message'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsChatMinimized(false)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95"
                          title="Expand Live Chat Desk"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Expand Chat</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsChatMinimized(false);
                            setIsChatMaximized(true);
                          }}
                          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-purple-200 hover:text-white transition cursor-pointer"
                          title="Maximize Chat Window"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Standard Inline Chat View */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-purple-700" />
                          <h4 className="font-bold text-xs sm:text-sm text-neutral-900">
                            Store Concierge & Dispatch Desk
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Live Support Available</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setIsChatMinimized(true)}
                            className="px-2.5 py-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                            title="Minimize Live Support"
                          >
                            <Minus className="w-3.5 h-3.5" />
                            <span>Minimize</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsChatMaximized(true)}
                            className="px-2.5 py-1 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            title="Maximize Live Support to full screen"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>Maximize</span>
                          </button>
                        </div>
                      </div>

                      <OrderLiveChat
                        order={selectedCustomerOrder}
                        mode="customer"
                        className="border border-neutral-200 rounded-2xl shadow-2xs overflow-hidden"
                      />
                    </div>
                  )}

                  {/* Maximized Support Chat Modal Dialog Overlay */}
                  {isChatMaximized && (
                    <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 animate-in fade-in duration-200">
                      <div className="w-full max-w-4xl h-[92vh] sm:h-[88vh] bg-white rounded-3xl shadow-2xl flex flex-col border border-purple-400/40 overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Maximized Header */}
                        <div className="px-5 py-4 bg-gradient-to-r from-purple-950 via-[#3a0852] to-purple-900 text-white flex items-center justify-between border-b border-purple-700/40 shrink-0">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                              <MessageSquare className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-serif font-bold text-sm sm:text-base text-white">
                                  Live Customer Support
                                </h3>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span>Dispatch Desk Active</span>
                                </span>
                                <span className="font-mono text-xs text-amber-300 bg-amber-950/60 border border-amber-400/40 px-2 py-0.5 rounded">
                                  #{selectedCustomerOrder.orderNumber}
                                </span>
                              </div>
                              <p className="text-xs text-purple-200/80 mt-0.5">
                                {selectedCustomerOrder.assignedStaffName
                                  ? `Dedicated Support Concierge: ${selectedCustomerOrder.assignedStaffName}`
                                  : 'Direct concierge channel with customer care & dispatch team'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setIsChatMaximized(false)}
                              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                              title="Restore standard size"
                            >
                              <Minimize2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Restore Window</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsChatMaximized(false)}
                              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition cursor-pointer"
                              title="Close Fullscreen View"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Maximized Chat Body */}
                        <div className="flex-1 overflow-hidden p-3 sm:p-4 bg-neutral-50 flex flex-col min-h-0">
                          <OrderLiveChat
                            order={selectedCustomerOrder}
                            mode="customer"
                            className="flex-1 border border-neutral-200 rounded-2xl shadow-inner overflow-hidden h-full"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Customer Order Actions (Cancellation Request) */}
                  {settings.storefrontDisplay?.allowPublicCancellation &&
                    (selectedCustomerOrder.status === 'Pending' || selectedCustomerOrder.status === 'Confirmed') &&
                    !selectedCustomerOrder.cancellationRequest?.requested && (
                      <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <h5 className="font-bold text-xs text-rose-900">Need to cancel this order?</h5>
                            <p className="text-[11px] text-rose-700">
                              You can request cancellation before your saree is packaged and handed over to the courier partner.
                            </p>
                          </div>
                          {!cancellingOrder ? (
                            <button
                              type="button"
                              onClick={() => setCancellingOrder(selectedCustomerOrder)}
                              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer"
                            >
                              Request Order Cancellation
                            </button>
                          ) : null}
                        </div>

                        {cancellingOrder?.id === selectedCustomerOrder.id && (
                          <div className="p-3 bg-white rounded-xl border border-rose-200 space-y-2.5 animate-in fade-in">
                            <label className="block text-[11px] font-semibold text-neutral-700">
                              Reason for cancellation:
                            </label>
                            <select
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                              className="w-full p-2 rounded-lg border border-neutral-300 text-xs text-neutral-900"
                            >
                              <option value="Found another weave / Changed mind">Found another weave / Changed mind</option>
                              <option value="Ordered duplicate by mistake">Ordered duplicate by mistake</option>
                              <option value="Event postponed / No longer needed">Event postponed / No longer needed</option>
                              <option value="Delivery timeline too slow">Delivery timeline too slow</option>
                              <option value="Other / Personal reason">Other / Personal reason</option>
                            </select>

                            <div className="flex items-center gap-2 justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => setCancellingOrder(null)}
                                className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const res = requestOrderCancellation(
                                    selectedCustomerOrder.orderNumber,
                                    selectedCustomerOrder.customer.phone,
                                    cancelReason
                                  );
                                  if (res?.success) {
                                    setCancelStatusMsg({
                                      type: 'success',
                                      text: 'Cancellation request submitted to boutique team.',
                                    });
                                    setCancellingOrder(null);
                                  } else {
                                    setCancelStatusMsg({
                                      type: 'error',
                                      text: res?.message || 'Could not process cancellation request.',
                                    });
                                  }
                                }}
                                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-2xs"
                              >
                                Confirm Cancellation Request
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
                          ? 'You are all caught up! Updates regarding restocked products and parcel tracking will appear here.'
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
