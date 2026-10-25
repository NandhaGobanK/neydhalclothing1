import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus } from '../../types/store';
import { formatPrice } from '../../utils/upi';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import {
  getActiveDisputeRedressals,
  getOrderEligibleRedressals,
  getAvailableRedressalsForOrder,
  areAllEligibleDisputesResolved,
} from '../../utils/disputeRedressals';
import { OrderLiveChat } from '../common/OrderLiveChat';
import {
  getNotificationPermission,
  requestNotificationPermission,
  triggerDeviceVibration,
} from '../../utils/deviceNotifications';
import { playChatChimeSound } from '../../utils/audio';
import {
  Search,
  X,
  Package,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  Copy,
  Check,
  MessageSquare,
  AlertCircle,
  RotateCcw,
  Ban,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Lock,
  Bell,
  Volume2,
  Download,
} from 'lucide-react';
import { downloadSingleImage } from '../../utils/imageDownload';

interface TrackOrderModalProps {
  onClose: () => void;
}

export const TrackOrderModal: React.FC<TrackOrderModalProps> = ({ onClose }) => {
  const {
    orders,
    customerOrders,
    requestOrderCancellation,
    reportCustomerDeliveryIssue,
    settings,
    lastPlacedOrder,
    recordCustomerOrder,
    activeCustomerChatOrderId,
    setActiveCustomerChatOrderId,
  } = useStore();

  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    return getNotificationPermission();
  });
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [headerNotice, setHeaderNotice] = useState<string | null>(null);

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

  // Direct Firestore fallback state in case real-time snapshot is still in-flight
  const [firestoreOrders, setFirestoreOrders] = useState<Order[]>([]);
  const [isSearchingFirestore, setIsSearchingFirestore] = useState(false);

  // Cancellation Request Form State
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('Change of wedding / event schedule');
  const [customReasonText, setCustomReasonText] = useState('');
  const [cancelStatusMsg, setCancelStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Issue Report Modal State
  const [reportingIssueOrder, setReportingIssueOrder] = useState<Order | null>(null);
  const [reportingIssueType, setReportingIssueType] = useState<'delivery' | 'refund'>('delivery');
  const [openIssueDropdownOrderId, setOpenIssueDropdownOrderId] = useState<string | null>(null);
  const [issueDescription, setIssueDescription] = useState(
    'Courier tracking and system shows Delivered, but parcel was not received at delivery address/door.'
  );
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [issueFeedback, setIssueFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [expandedChatOrderId, setExpandedChatOrderId] = useState<string | null>(null);

  // Deep-link live chat auto-expansion
  useEffect(() => {
    if (activeCustomerChatOrderId) {
      const match = orders.find(
        (o) =>
          o.id === activeCustomerChatOrderId ||
          o.orderNumber.toUpperCase() === activeCustomerChatOrderId.toUpperCase()
      );
      if (match) {
        setSelectedOrderId(match.id);
        setExpandedChatOrderId(match.id);
      }
      setActiveCustomerChatOrderId(null);
    }
  }, [activeCustomerChatOrderId, orders, setActiveCustomerChatOrderId]);

  // Customer placed orders list (stored on device) for instant "My Orders" access
  const customerSavedOrderNumbers = useMemo(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored: string[] = JSON.parse(localStorage.getItem('aara_customer_orders') || '[]');
      if (lastPlacedOrder?.orderNumber && !stored.includes(lastPlacedOrder.orderNumber)) {
        return [lastPlacedOrder.orderNumber, ...stored];
      }
      return stored;
    } catch (e) {
      return lastPlacedOrder ? [lastPlacedOrder.orderNumber] : [];
    }
  }, [lastPlacedOrder]);

  // Check URL params if present (e.g. ?order=AARA-1082, #track?order=AARA-1082)
  useEffect(() => {
    const syncFromUrl = () => {
      if (typeof window === 'undefined') return;
      const fullUrl = window.location.href;

      let targetOrder = '';
      let targetPhone = '';
      try {
        const searchParams = new URLSearchParams(window.location.search);
        targetOrder = searchParams.get('order') || searchParams.get('track') || searchParams.get('trackOrder') || '';
        targetPhone = searchParams.get('phone') || '';
      } catch (e) {}

      if (!targetOrder) {
        const matchOrder = fullUrl.match(/[?&#](?:order|track|trackOrder)=([^&#]+)/i);
        if (matchOrder) {
          targetOrder = decodeURIComponent(matchOrder[1]).trim();
        }
      }
      if (!targetPhone) {
        const matchPhone = fullUrl.match(/[?&#]phone=([^&#]+)/i);
        if (matchPhone) {
          targetPhone = decodeURIComponent(matchPhone[1]).trim();
        }
      }

      const paramVal = targetOrder || targetPhone;
      if (paramVal) {
        const cleaned = paramVal.trim();
        setQuery(cleaned);
        setSearchedQuery(cleaned);

        // If specific order number given in URL, directly select it for detail view
        if (targetOrder) {
          const cleanTarget = targetOrder.replace(/^[#\s]+/, '').trim().toUpperCase();
          const match = orders.find(
            (o) => o.id === targetOrder || o.orderNumber.trim().toUpperCase() === cleanTarget
          );
          if (match) {
            setSelectedOrderId(match.id);
          }
        }
      }
    };

    syncFromUrl();
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, [orders]);

  // Fallback search in Firestore if searchedQuery is not in local memory
  useEffect(() => {
    if (!searchedQuery.trim()) {
      setFirestoreOrders([]);
      return;
    }

    let isSubscribed = true;
    setIsSearchingFirestore(true);

    const fetchFromFirestore = async () => {
      try {
        const snap = await getDocs(collection(db, 'orders'));
        if (!isSubscribed) return;
        const clean = searchedQuery.trim().toLowerCase();
        const cleanOrder = clean.replace(/^[#\s]+/, '').trim();
        const cleanDigits = searchedQuery.replace(/[^0-9]/g, '');

        const results: Order[] = [];
        snap.forEach((d) => {
          const ord = { id: d.id, ...d.data() } as Order;
          const oNum = (ord.orderNumber || '').trim().toLowerCase();
          const oNumClean = oNum.replace(/^[#\s]+/, '').trim();
          const oPhone = (ord.customer?.phone || '').replace(/[^0-9]/g, '');

          if (
            oNum === clean ||
            oNumClean === cleanOrder ||
            ord.upiTransactionId?.toLowerCase() === clean ||
            (cleanDigits.length >= 6 && oPhone.includes(cleanDigits))
          ) {
            results.push(ord);
          }
        });

        if (isSubscribed) {
          setFirestoreOrders(results);
        }
      } catch (err) {
        console.warn('Direct Firestore order lookup:', err);
      } finally {
        if (isSubscribed) {
          setIsSearchingFirestore(false);
        }
      }
    };

    fetchFromFirestore();

    return () => {
      isSubscribed = false;
    };
  }, [searchedQuery]);

  // Aggregate all customer orders for the structured list view
  const allCustomerOrdersList = useMemo(() => {
    const savedOrderNumbersSet = new Set(
      customerSavedOrderNumbers.map((num) => num.trim().toUpperCase())
    );
    if (lastPlacedOrder?.orderNumber) {
      savedOrderNumbersSet.add(lastPlacedOrder.orderNumber.trim().toUpperCase());
    }

    const savedPhone = typeof window !== 'undefined' ? (localStorage.getItem('aara_customer_phone') || '').trim() : '';
    const cleanSavedPhone = savedPhone.replace(/\D/g, '').slice(-10);

    const orderMap = new Map<string, Order>();

    // 1. Add orders from context customerOrders
    customerOrders.forEach((o) => {
      orderMap.set(o.id, o);
    });

    // 2. Add orders from global orders matching phone or saved numbers
    orders.forEach((o) => {
      const matchNumber = savedOrderNumbersSet.has(o.orderNumber.trim().toUpperCase());
      const orderPhone = (o.customer?.phone || '').replace(/\D/g, '').slice(-10);
      const matchPhone = cleanSavedPhone && orderPhone && orderPhone === cleanSavedPhone;
      if (matchNumber || matchPhone) {
        orderMap.set(o.id, o);
      }
    });

    // 3. Add any Firestore query results
    firestoreOrders.forEach((o) => {
      orderMap.set(o.id, o);
    });

    const list = Array.from(orderMap.values());
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }, [customerOrders, orders, customerSavedOrderNumbers, lastPlacedOrder, firestoreOrders]);

  // Filtered orders according to search query
  const displayedOrders = useMemo(() => {
    if (!searchedQuery.trim()) {
      return allCustomerOrdersList;
    }

    const clean = searchedQuery.trim().toLowerCase();
    const cleanOrder = clean.replace(/^[#\s]+/, '').trim();
    const cleanDigits = searchedQuery.replace(/[^0-9]/g, '');

    // 1. Exact match check across all orders
    const exactOrder = orders.find((o) => {
      const oNum = o.orderNumber.trim().toLowerCase();
      const oNumClean = oNum.replace(/^[#\s]+/, '').trim();
      return oNum === clean || oNumClean === cleanOrder || o.id === clean;
    });
    if (exactOrder) {
      return [exactOrder];
    }

    // 2. Filter list
    return allCustomerOrdersList.filter((o) => {
      const oNum = o.orderNumber.toLowerCase().replace(/^[#\s]+/, '');
      const matchOrderNum = oNum.includes(cleanOrder);
      const matchName = o.customer.name.toLowerCase().includes(clean);
      const matchUtr = o.upiTransactionId?.toLowerCase().includes(clean);
      const oPhone = (o.customer.phone || '').replace(/[^0-9]/g, '');
      const matchPhone = cleanDigits.length >= 6 && oPhone.includes(cleanDigits);
      const matchItem = o.items.some((item) =>
        item.product.title.toLowerCase().includes(clean) ||
        item.product.productCode?.toLowerCase().includes(clean)
      );

      return matchOrderNum || matchName || matchUtr || matchPhone || matchItem;
    });
  }, [allCustomerOrdersList, orders, searchedQuery]);

  // Synchronize found orders with customer live orders counter
  useEffect(() => {
    if (displayedOrders.length > 0) {
      displayedOrders.forEach((ord) => {
        if (ord.orderNumber) {
          recordCustomerOrder(ord.orderNumber, ord.customer?.phone);
        }
      });
    }
  }, [displayedOrders, recordCustomerOrder]);

  // Find currently selected order for the detailed view page
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null;
    return (
      orders.find((o) => o.id === selectedOrderId || o.orderNumber === selectedOrderId) ||
      allCustomerOrdersList.find((o) => o.id === selectedOrderId || o.orderNumber === selectedOrderId) ||
      firestoreOrders.find((o) => o.id === selectedOrderId || o.orderNumber === selectedOrderId) ||
      null
    );
  }, [selectedOrderId, orders, allCustomerOrdersList, firestoreOrders]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setSearchedQuery('');
      return;
    }
    setSearchedQuery(query.trim());
    setCancelStatusMsg(null);
  };

  const handleClearSearch = () => {
    setQuery('');
    setSearchedQuery('');
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
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
          label: 'Confirmed',
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
          label: 'Refund Completed',
        };
      default:
        return {
          bg: 'bg-neutral-100 text-neutral-800 border-neutral-300',
          icon: Clock,
          label: status,
        };
    }
  };

  const handleSubmitCancellation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingOrder) return;

    const finalReason = cancelReason === 'Other' ? customReasonText.trim() || 'Customer requested' : cancelReason;
    const res = requestOrderCancellation(cancellingOrder.orderNumber, cancellingOrder.customer.phone, finalReason);

    if (res.success) {
      setCancelStatusMsg({ type: 'success', text: res.message });
      setCancellingOrder(null);
    } else {
      setCancelStatusMsg({ type: 'error', text: res.message });
    }
  };

  const handleSubmitDeliveryIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingIssueOrder) return;
    setIsSubmittingIssue(true);
    setIssueFeedback(null);
    try {
      const defaultDesc =
        reportingIssueType === 'refund'
          ? 'Customer submitted a refund inquiry / dispute regarding payment or cancellation settlement.'
          : 'Customer reports non-delivery despite Delivered / Shipped status.';

      const res = await reportCustomerDeliveryIssue(
        reportingIssueOrder.orderNumber,
        reportingIssueOrder.customer.phone,
        issueDescription.trim() || defaultDesc,
        reportingIssueType
      );
      if (res.success) {
        setIssueFeedback({
          type: 'success',
          message:
            reportingIssueType === 'refund'
              ? 'Refund inquiry submitted! Our boutique concierge has logged your ticket and will verify settlement details with our finance team.'
              : 'Delivery dispute successfully submitted! Our boutique concierge and logistics hub will investigate immediately.',
        });
        setTimeout(() => {
          setReportingIssueOrder(null);
          setIssueFeedback(null);
        }, 3000);
      } else {
        setIssueFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setIssueFeedback({
        type: 'error',
        message: err?.message || 'Failed to submit issue report.',
      });
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-neutral-900 text-white flex items-center justify-between border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            {selectedOrder ? (
              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                title="Return to My Orders List"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to List</span>
              </button>
            ) : (
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Package className="w-5 h-5" />
              </div>
            )}
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-bold">
                {selectedOrder
                  ? `Order #${selectedOrder.orderNumber}`
                  : 'My Orders & Tracking'}
              </h2>
              <p className="text-xs text-neutral-400">
                {selectedOrder
                  ? `Placed on ${new Date(selectedOrder.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })} · Total: ${formatPrice(selectedOrder.totalAmount)}`
                  : 'View order history, live dispatch status & consignment tracking'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Device Notification Alert Control for Customer */}
            {notificationPermission === 'granted' ? (
              <div className="hidden sm:flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-2.5 py-1 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="font-semibold text-emerald-300 text-[11px]">Alerts Active</span>
                <button
                  type="button"
                  onClick={handleTestSound}
                  className="ml-1 p-0.5 rounded text-neutral-400 hover:text-white transition cursor-pointer"
                  title="Test notification sound & vibration"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleEnableNotifications}
                disabled={isRequestingPermission}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-bold transition cursor-pointer"
                title="Enable device notifications for live updates from atelier concierge"
              >
                <Bell className="w-3.5 h-3.5 animate-bounce shrink-0" />
                <span>{isRequestingPermission ? 'Enabling...' : 'Enable Alerts'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Header Alert Notification Feedback */}
        {headerNotice && (
          <div className="bg-amber-500 text-neutral-950 px-4 py-1.5 text-center font-bold text-xs transition animate-in fade-in">
            {headerNotice}
          </div>
        )}

        {/* =========================================================================
            VIEW 1: LIST VIEW (when selectedOrderId === null)
           ========================================================================= */}
        {!selectedOrder ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Search Bar & Order Filter */}
            <div className="p-4 sm:p-5 bg-neutral-50/80 border-b border-neutral-200 shrink-0">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by Order # (e.g. NC-4301), phone or saree title..."
                    className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-neutral-300 bg-white text-xs sm:text-sm text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                      title="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs sm:text-sm transition whitespace-nowrap cursor-pointer"
                >
                  Search
                </button>
              </form>

              {cancelStatusMsg && (
                <div
                  className={`mt-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
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
                  <span>{cancelStatusMsg.text}</span>
                </div>
              )}

              {/* Status & Results Summary Bar */}
              <div className="flex items-center justify-between mt-3 text-xs text-neutral-600">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-neutral-800">
                    {searchedQuery
                      ? `Search Results for "${searchedQuery}"`
                      : 'Your Placed Orders'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-800 text-[11px] font-bold">
                    {displayedOrders.length}
                  </span>
                </div>

                {searchedQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="text-rose-900 hover:underline font-semibold text-xs cursor-pointer"
                  >
                    Clear Filter
                  </button>
                )}
              </div>

              {/* Boutique Policy Notice */}
              <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-950 flex items-center gap-2 text-[11px] mt-2.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <p className="leading-tight">
                  <strong>Boutique Policy Notice:</strong> No cancellation once the order is shipped. Click on any order below to view details.
                </p>
              </div>
            </div>

            {/* List View Container: Clean, Structured Order Cards */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3.5">
              {isSearchingFirestore ? (
                <div className="py-16 text-center text-neutral-500">
                  <Loader2 className="w-8 h-8 text-amber-600 animate-spin mx-auto mb-2" />
                  <p className="font-serif text-base font-bold text-neutral-800">
                    Searching Boutique Database...
                  </p>
                  <p className="text-xs max-w-sm mx-auto mt-1">
                    Checking live workshop ledger for your orders.
                  </p>
                </div>
              ) : displayedOrders.length === 0 ? (
                <div className="py-14 text-center text-neutral-500 px-4">
                  <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                    <Truck className="w-7 h-7" />
                  </div>
                  <p className="font-serif text-base font-bold text-neutral-800">
                    {searchedQuery ? 'No Matching Orders Found' : 'No Orders Placed Yet'}
                  </p>
                  <p className="text-xs max-w-sm mx-auto mt-1 text-neutral-600 leading-relaxed">
                    {searchedQuery
                      ? `We couldn't find any orders matching "${searchedQuery}". Please verify your order reference number or contact phone.`
                      : 'You do not have any orders recorded on this device yet. When you place an order, it will appear here in your order history.'}
                  </p>
                  {searchedQuery && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="mt-4 px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition cursor-pointer"
                    >
                      View All Orders
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedOrders.map((order) => {
                    const badge = getStatusBadge(order.status);
                    const StatusIcon = badge.icon;
                    const itemCount = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
                    const hasActiveDispute = Boolean(
                      order.deliveryIssue?.reported && order.deliveryIssue.status !== 'resolved'
                    );
                    const hasUnreadChat = Boolean(
                      order.chatMessages?.some((m) => !m.readByCustomer && m.sender !== 'customer')
                    );

                    return (
                      <div
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelectedOrderId(order.id);
                          }
                        }}
                        className="group w-full text-left p-4 sm:p-5 rounded-2xl border border-neutral-200 bg-white hover:border-amber-400 hover:shadow-md transition-all duration-200 cursor-pointer relative overflow-hidden focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                      >
                        {/* Status Accent Left Strip */}
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                            order.status === 'Delivered' || order.status === 'Refunded'
                              ? 'bg-emerald-500'
                              : order.status === 'Shipped'
                              ? 'bg-blue-500'
                              : order.status === 'Confirmed'
                              ? 'bg-purple-500'
                              : order.status === 'Cancelled' || order.status === 'Rejected'
                              ? 'bg-rose-500'
                              : 'bg-amber-500'
                          }`}
                        />

                        {/* Top Card Row: Order ID, Date, Status Badge, Total Amount */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs sm:text-sm text-rose-950 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                              #{order.orderNumber}
                            </span>
                            <span className="text-neutral-500 text-[11px]">
                              {new Date(order.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>

                            {/* Status Pill */}
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.bg}`}
                            >
                              <StatusIcon className="w-3 h-3" />
                              <span>{badge.label}</span>
                            </span>

                            {/* Dispute Alert Badge */}
                            {hasActiveDispute && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-200">
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                <span>Dispute Active</span>
                              </span>
                            )}

                            {/* Unread Message Badge */}
                            {hasUnreadChat && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                                <span>New Concierge Reply</span>
                              </span>
                            )}
                          </div>

                          <div className="text-left sm:text-right">
                            <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Total</span>
                            <span className="font-serif font-bold text-base text-neutral-900 tabular-nums">
                              {formatPrice(order.totalAmount)}
                            </span>
                          </div>
                        </div>

                        {/* Middle Card Row: Item Preview Thumbnails & Information */}
                        <div className="pt-3 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Product Thumbnails */}
                            <div className="flex items-center -space-x-2 shrink-0">
                              {order.items.slice(0, 3).map((item, idx) => (
                                <img
                                  key={idx}
                                  src={item.product.images?.[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                                  alt={item.product.title}
                                  className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-2xs bg-neutral-100"
                                />
                              ))}
                              {order.items.length > 3 && (
                                <div className="w-12 h-12 rounded-xl bg-neutral-900 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow-2xs">
                                  +{order.items.length - 3}
                                </div>
                              )}
                            </div>

                            {/* Product Titles Preview */}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-neutral-900 truncate">
                                {order.items[0]?.product.title}
                                {order.items.length > 1 ? ` and ${order.items.length - 1} other saree${order.items.length > 2 ? 's' : ''}` : ''}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                                <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
                                <span>·</span>
                                <span>{order.customer.city}, {order.customer.state}</span>
                                {order.assignedStaffName && (
                                  <>
                                    <span>·</span>
                                    <span className="text-amber-800 font-medium">Concierge: {order.assignedStaffName}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Click-to-Open Callout Indicator */}
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-900 group-hover:text-amber-700 transition shrink-0 ml-auto">
                            <span className="hidden sm:inline">View Details & Tracking</span>
                            <span className="sm:hidden">Details</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>

                        {/* Extra Shipping Snippet if dispatched */}
                        {order.status === 'Shipped' && order.shippingDetails && (
                          <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between text-[11px] text-blue-900 bg-blue-50/50 p-2 rounded-xl">
                            <span className="flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5 text-blue-600" />
                              <span>Shipped via <strong>{order.shippingDetails.courierName}</strong> · Waybill #{order.shippingDetails.trackingNumber}</span>
                            </span>
                            <span className="text-[10px] font-bold text-blue-700">Track Consignment →</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-neutral-500">
                {displayedOrders.length} order{displayedOrders.length === 1 ? '' : 's'} recorded
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          /* =========================================================================
              VIEW 2: DETAILED VIEW PAGE (when selectedOrder is open)
             ========================================================================= */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Top Navigation Bar: Back to My Orders */}
            <div className="p-3 sm:p-4 bg-amber-50/90 border-b border-amber-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-xs border border-amber-300 shadow-2xs transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-amber-700" />
                <span>← Back to My Orders</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs text-rose-950 bg-white px-2.5 py-1 rounded-md border border-amber-300">
                  #{selectedOrder.orderNumber}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    getStatusBadge(selectedOrder.status).bg
                  }`}
                >
                  {getStatusBadge(selectedOrder.status).label}
                </span>
              </div>
            </div>

            {/* Detailed Content Scroll Container */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* Order Header Summary Card */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-neutral-400 uppercase font-semibold">
                      {selectedOrder.dropshipRecipient ? 'End-Customer Delivery Destination' : 'Customer & Destination'}
                    </span>
                    {selectedOrder.orderType === 'reseller' && (
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                        Reseller Dropship
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif font-bold text-sm text-neutral-900 mt-0.5">
                    {selectedOrder.dropshipRecipient?.name || selectedOrder.customer.name} ({selectedOrder.dropshipRecipient?.phone || selectedOrder.customer.phone})
                  </h3>
                  <p className="text-[11px] text-neutral-600 mt-0.5">
                    {selectedOrder.dropshipRecipient?.address || selectedOrder.customer.address},{' '}
                    {selectedOrder.dropshipRecipient?.city || selectedOrder.customer.city},{' '}
                    {selectedOrder.dropshipRecipient?.state || selectedOrder.customer.state} -{' '}
                    <strong>{selectedOrder.dropshipRecipient?.pincode || selectedOrder.customer.pincode}</strong>
                  </p>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <span className="text-[10px] text-neutral-400 uppercase font-semibold">Total Order Value</span>
                  <p className="font-serif font-bold text-xl text-neutral-900 tabular-nums">
                    {formatPrice(selectedOrder.totalAmount)}
                  </p>
                  <span className="text-[10px] text-neutral-500">
                    Payment via UPI · Verified
                  </span>
                </div>
              </div>

              {/* Cancellation Notice if requested */}
              {selectedOrder.cancellationRequest?.requested && selectedOrder.cancellationRequest.status === 'pending' && (
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Cancellation Request Submitted (Under Review)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Your request to cancel this order has been submitted to the boutique on{' '}
                    {new Date(selectedOrder.cancellationRequest.requestedAt).toLocaleDateString('en-IN')}. Our concierge team is processing the review and refund.
                  </p>
                  <p className="text-[11px] text-amber-800 italic">
                    Reason: "{selectedOrder.cancellationRequest.reason}"
                  </p>
                </div>
              )}

              {/* Stage Timeline */}
              {selectedOrder.status !== 'Cancelled' && selectedOrder.status !== 'Rejected' && selectedOrder.status !== 'Refunded' ? (
                <div className="p-4 rounded-2xl border border-neutral-200 bg-white space-y-3">
                  {/* Concierge Assigned Banner */}
                  {selectedOrder.assignedStaffName ? (
                    <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-rose-700 text-amber-100 font-serif font-bold text-xs flex items-center justify-center shadow-2xs shrink-0">
                          {selectedOrder.assignedStaffName.charAt(0)}
                        </span>
                        <div>
                          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                            Dedicated Concierge Assigned
                          </span>
                          <h4 className="font-serif font-bold text-sm text-neutral-900">
                            {selectedOrder.assignedStaffName}
                          </h4>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold shrink-0">
                        Concierge Assigned ✓
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                          <Clock className="w-4 h-4 text-blue-600" />
                        </span>
                        <div>
                          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
                            Order in Intake Queue
                          </span>
                          <h4 className="font-serif font-bold text-xs text-neutral-900">
                            Awaiting Staff Concierge Claim
                          </h4>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 text-[10px] font-bold shrink-0">
                        In Queue
                      </span>
                    </div>
                  )}

                  <div className="pt-1">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block mb-2">
                      Live Delivery Progression
                    </span>
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {[
                        { name: 'Pending', icon: Clock },
                        { name: 'Confirmed', icon: CheckCircle },
                        { name: 'Shipped', icon: Truck },
                        { name: 'Delivered', icon: Package },
                      ].map((step, idx) => {
                        const currentStep = getStatusStepIndex(selectedOrder.status);
                        const isDone = currentStep >= idx;
                        const isCurrent = currentStep === idx;
                        const StepIcon = step.icon;
                        return (
                          <div key={step.name} className="flex flex-col items-center text-center">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                                isDone
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-neutral-100 text-neutral-400'
                              } ${isCurrent ? 'ring-4 ring-emerald-100' : ''}`}
                            >
                              <StepIcon className="w-4 h-4" />
                            </div>
                            <span
                              className={`text-[11px] mt-1.5 font-semibold ${
                                isCurrent
                                  ? 'text-emerald-800 font-bold'
                                  : isDone
                                  ? 'text-neutral-800'
                                  : 'text-neutral-400'
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
                        selectedOrder.status === 'Refunded'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-rose-100 text-rose-900 border border-rose-300'
                      }`}
                    >
                      {selectedOrder.status === 'Refunded' ? 'Stage: Refund Completed ✓' : 'Stage: Order Cancelled'}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {[
                      { name: 'Placed', isDone: true, isCurrent: false, icon: Clock },
                      { name: 'Confirmed', isDone: true, isCurrent: false, icon: CheckCircle },
                      {
                        name: 'Cancelled',
                        isDone: true,
                        isCurrent: selectedOrder.status === 'Cancelled' || selectedOrder.status === 'Rejected',
                        icon: XCircle,
                      },
                      {
                        name: 'Refunded',
                        isDone: selectedOrder.status === 'Refunded' || selectedOrder.refundDetails?.refundStatus === 'processed',
                        isCurrent: selectedOrder.status === 'Refunded',
                        icon: RotateCcw,
                      },
                    ].map((step) => {
                      const StepIcon = step.icon;
                      return (
                        <div key={step.name} className="flex flex-col items-center text-center">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
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

                  {selectedOrder.status === 'Refunded' ? (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300 text-emerald-950 space-y-1.5 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <span>Refund Settled Successfully</span>
                        </span>
                        <span className="font-mono font-bold text-emerald-800 text-xs">
                          UTR: {selectedOrder.refundDetails?.refundUtr || 'Processed'}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        Amount of {formatPrice(selectedOrder.totalAmount)} refunded to customer account.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-950 text-xs mt-2">
                      <p>
                        <strong>Cancellation Reason:</strong> {selectedOrder.cancellationReason || 'Customer requested'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Courier Consignment & Tracking Box (When Shipped) */}
              {selectedOrder.status === 'Shipped' && selectedOrder.shippingDetails && (
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-700" />
                    <h4 className="font-bold text-xs">Courier Consignment Dispatch Information</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-xl border border-blue-100">
                    <div>
                      <span className="text-neutral-500 text-[11px] font-semibold">Courier Partner:</span>
                      <p className="font-bold text-neutral-900 mt-0.5">
                        {selectedOrder.shippingDetails.courierName}
                      </p>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[11px] font-semibold">
                        Consignment Tracking Number:
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <code className="font-mono font-bold text-xs text-neutral-900">
                          {selectedOrder.shippingDetails.trackingNumber}
                        </code>
                        <button
                          onClick={() => copyText(selectedOrder.shippingDetails!.trackingNumber, `track-${selectedOrder.id}`)}
                          className="p-1 hover:bg-neutral-100 rounded text-neutral-600 cursor-pointer"
                          title="Copy Consignment ID"
                        >
                          {copiedKey === `track-${selectedOrder.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const matchedCourier = (settings.courierServices || []).find(
                      (c) => c.name.toLowerCase().trim() === selectedOrder.shippingDetails?.courierName?.toLowerCase().trim()
                    );
                    const trackingPortalUrl =
                      matchedCourier?.trackingUrl ||
                      (matchedCourier?.trackingUrlTemplate && selectedOrder.shippingDetails.trackingNumber
                        ? matchedCourier.trackingUrlTemplate + selectedOrder.shippingDetails.trackingNumber
                        : undefined);

                    return trackingPortalUrl ? (
                      <div className="pt-2 border-t border-blue-200/80 flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[11px] text-blue-900 font-semibold flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5 text-blue-700" />
                          <span>Official Tracking Portal:</span>
                        </span>
                        <a
                          href={trackingPortalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-2xs cursor-pointer"
                        >
                          <span>Track on {selectedOrder.shippingDetails.courierName} Website</span>
                          <ExternalLink className="w-3 h-3 text-white/90" />
                        </a>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {/* Items Breakdown List */}
              <div className="p-4 rounded-2xl border border-neutral-200 bg-white space-y-3">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block">
                  Ordered Items ({selectedOrder.items.length})
                </span>
                <div className="divide-y divide-neutral-100">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.product.id}
                      className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0"
                    >
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
                            <span className="font-mono font-bold text-rose-950 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
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
                            title="Download photo"
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

              {/* Payment & Refund Details */}
              <div className="p-4 rounded-2xl border border-neutral-200 bg-neutral-50/80 space-y-3">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block">
                  Payment Verification & Settlement
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-white border border-neutral-200">
                    <span className="text-[10px] font-semibold text-neutral-400 uppercase block">
                      Payment Transaction ID (UTR)
                    </span>
                    <div className="flex items-center justify-between mt-1">
                      <code className="font-mono font-bold text-neutral-900 text-xs">
                        {selectedOrder.upiTransactionId}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyText(selectedOrder.upiTransactionId, `utr-${selectedOrder.id}`)}
                        className="p-1 text-neutral-500 hover:text-neutral-900 rounded cursor-pointer"
                        title="Copy Payment UTR"
                      >
                        {copiedKey === `utr-${selectedOrder.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {settings.storefrontDisplay?.allowPublicRefunds !== false && (
                    <div className="p-3 rounded-xl bg-white border border-neutral-200">
                      <span className="text-[10px] font-semibold text-neutral-400 uppercase block">
                        Customer Refund UPI
                      </span>
                      <div className="mt-1">
                        {selectedOrder.refundDetails?.refundUpiId ? (
                          <code className="font-mono font-bold text-emerald-950 text-xs truncate block">
                            {selectedOrder.refundDetails.refundUpiId}
                          </code>
                        ) : (
                          <span className="text-neutral-500 italic text-[11px]">
                            {selectedOrder.refundDetails?.refundUpiPhone
                              ? `UPI Phone: ${selectedOrder.refundDetails.refundUpiPhone}`
                              : 'Not provided at checkout'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Dispute Notice if already active */}
              {selectedOrder.deliveryIssue?.reported && selectedOrder.deliveryIssue.issueType !== 'cancellation' && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-950 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-rose-900">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>
                        {selectedOrder.deliveryIssue.issueType === 'refund'
                          ? `Refund Dispute Ticket (${selectedOrder.deliveryIssue.status.toUpperCase()})`
                          : `Delivery Issue Reported (${selectedOrder.deliveryIssue.status.toUpperCase()})`}
                      </span>
                    </span>
                    <span className="text-[10px] text-neutral-500 font-medium">
                      {new Date(selectedOrder.deliveryIssue.reportedAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                  <p className="text-neutral-800 italic bg-white/80 p-2.5 rounded-xl border border-rose-100">
                    "{selectedOrder.deliveryIssue.issueDescription}"
                  </p>
                  <p className="text-[11px] text-rose-800 font-medium">
                    {selectedOrder.deliveryIssue.issueType === 'refund'
                      ? 'Our concierge finance team is actively verifying your refund settlement inquiry with our bank accounts desk.'
                      : `Assigned concierge is actively investigating with ${selectedOrder.shippingDetails?.courierName || 'the courier partner'} local hub.`}
                  </p>
                </div>
              )}

              {/* Order Actions: Dispute, Chat, and Cancellation */}
              <div className="p-4 rounded-2xl border border-neutral-200 bg-white space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Cancellation Request Button (if eligible) */}
                    {settings.storefrontDisplay?.allowPublicCancellation !== false &&
                      (selectedOrder.status === 'Pending' || selectedOrder.status === 'Confirmed') &&
                      !selectedOrder.cancellationRequest?.requested && (
                        <button
                          type="button"
                          onClick={() => setCancellingOrder(selectedOrder)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs transition cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Request Cancellation</span>
                        </button>
                      )}

                    {/* Dispute Redressal Dropdown */}
                    {(() => {
                      const eligibleRedressals = getOrderEligibleRedressals(selectedOrder, settings);
                      if (eligibleRedressals.length === 0) return null;

                      const availableRedressals = getAvailableRedressalsForOrder(selectedOrder, settings);
                      const hasActiveDispute =
                        Boolean(selectedOrder.deliveryIssue?.reported && selectedOrder.deliveryIssue.status !== 'resolved') ||
                        Boolean(selectedOrder.cancellationRequest?.requested && selectedOrder.cancellationRequest.status === 'pending');
                      const allEligibleResolved = areAllEligibleDisputesResolved(selectedOrder, settings);

                      if (allEligibleResolved && availableRedressals.length === 0) {
                        return (
                          <button
                            type="button"
                            disabled
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 bg-neutral-100 text-neutral-500 font-semibold text-xs cursor-not-allowed opacity-80"
                          >
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Issue Resolved</span>
                            <Lock className="w-3 h-3 text-neutral-400" />
                          </button>
                        );
                      }

                      if (hasActiveDispute && availableRedressals.length === 0) {
                        return (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 font-semibold text-xs">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                            <span>Dispute In Progress</span>
                          </div>
                        );
                      }

                      if (availableRedressals.length === 0) return null;

                      return (
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenIssueDropdownOrderId(
                                openIssueDropdownOrderId === selectedOrder.id ? null : selectedOrder.id
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900 font-semibold text-xs transition cursor-pointer shadow-2xs"
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Report Issue</span>
                            <ChevronDown
                              className={`w-3 h-3 text-rose-700 transition-transform ${
                                openIssueDropdownOrderId === selectedOrder.id ? 'rotate-180' : ''
                              }`}
                            />
                          </button>

                          {openIssueDropdownOrderId === selectedOrder.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20"
                                onClick={() => setOpenIssueDropdownOrderId(null)}
                              />
                              <div className="absolute left-0 bottom-full mb-1.5 sm:bottom-auto sm:top-full sm:mt-1.5 w-72 rounded-2xl bg-white border border-neutral-200 shadow-xl z-30 p-1.5 animate-in fade-in zoom-in-95 duration-150">
                                <div className="px-2.5 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 mb-1">
                                  Select Issue Category
                                </div>
                                {availableRedressals.map((redressal) => (
                                  <button
                                    key={redressal.id}
                                    type="button"
                                    onClick={() => {
                                      setOpenIssueDropdownOrderId(null);
                                      setReportingIssueOrder(selectedOrder);
                                      setReportingIssueType(redressal.type as any);
                                      setIssueDescription(
                                        redressal.defaultNote(selectedOrder.orderNumber, selectedOrder.status)
                                      );
                                    }}
                                    className="w-full text-left p-2.5 rounded-xl hover:bg-rose-50 text-neutral-800 hover:text-rose-900 transition flex items-start gap-2.5 cursor-pointer group"
                                  >
                                    <div className="p-1.5 rounded-lg bg-neutral-100 group-hover:bg-rose-100 shrink-0 mt-0.5">
                                      {redressal.iconType === 'truck' ? (
                                        <Truck className="w-4 h-4 text-rose-600" />
                                      ) : redressal.iconType === 'refund' ? (
                                        <RotateCcw className="w-4 h-4 text-amber-600" />
                                      ) : (
                                        <AlertCircle className="w-4 h-4 text-rose-600" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-xs text-neutral-900 group-hover:text-rose-900 leading-tight">
                                        {redressal.title}
                                      </p>
                                      <p className="text-[10px] text-neutral-500 group-hover:text-neutral-700 leading-snug mt-0.5">
                                        {redressal.description}
                                      </p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Real-Time Live Chat Toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedChatOrderId(
                        expandedChatOrderId === selectedOrder.id ? null : selectedOrder.id
                      )
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs ${
                      expandedChatOrderId === selectedOrder.id
                        ? 'bg-amber-700 text-white'
                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 fill-white" />
                    <span>
                      {expandedChatOrderId === selectedOrder.id
                        ? 'Close Live Chat'
                        : 'Live Concierge Chat'}
                      {selectedOrder.chatMessages && selectedOrder.chatMessages.length > 0
                        ? ` (${selectedOrder.chatMessages.length})`
                        : ''}
                    </span>
                  </button>
                </div>

                {/* Live Customer Chat Stream Box */}
                {expandedChatOrderId === selectedOrder.id && (
                  <div className="mt-3 pt-3 border-t border-neutral-200 animate-in fade-in duration-200">
                    <OrderLiveChat
                      order={selectedOrder}
                      mode="customer"
                      title={`Concierge Chat · Order #${selectedOrder.orderNumber}`}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Navigation Bar */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 text-xs font-bold transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to My Orders</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Customer Cancellation Request Modal */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-400" />
                <h3 className="font-serif text-base font-bold">
                  Cancel Order #{cancellingOrder.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setCancellingOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-700 space-y-1">
                <p>Order Reference: <strong>#{cancellingOrder.orderNumber}</strong></p>
                <p>Total Paid Amount: <strong className="text-neutral-900 font-serif">{formatPrice(cancellingOrder.totalAmount)}</strong></p>
                {settings.storefrontDisplay?.allowPublicRefunds !== false && (
                  <p className="text-[11px] text-emerald-800 pt-1">
                    100% refund will be deposited to your UPI ID: {cancellingOrder.refundDetails?.refundUpiId || 'account on file'}.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Reason for Cancellation Request *
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900"
                >
                  <option value="Change of wedding / event schedule">Change of wedding / event schedule</option>
                  <option value="Ordered wrong color / fabric shade">Ordered wrong color / fabric shade</option>
                  <option value="Selected another heirloom saree">Selected another heirloom saree</option>
                  <option value="Delivery address change required">Delivery address change required</option>
                  <option value="Other">Other reason (specify below)</option>
                </select>
              </div>

              {cancelReason === 'Other' && (
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Specify Reason</label>
                  <textarea
                    rows={2}
                    value={customReasonText}
                    onChange={(e) => setCustomReasonText(e.target.value)}
                    placeholder="Briefly state reason..."
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                  />
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={(e) => handleSubmitCancellation(e)}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-900 hover:bg-rose-800 text-white font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Submit Cancellation Request</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCancellingOrder(null)}
                  className="w-full py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-semibold"
                >
                  Keep My Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Issue Report Modal (Delivery Dispute or Refund Inquiry) */}
      {reportingIssueOrder && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-xl ${
                    reportingIssueType === 'refund'
                      ? 'bg-amber-600/30 text-amber-400'
                      : 'bg-rose-600/30 text-rose-400'
                  }`}
                >
                  {reportingIssueType === 'refund' ? (
                    <RotateCcw className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold">
                    {reportingIssueType === 'refund'
                      ? 'Report Refund Issue'
                      : 'Report Delivery Issue'}
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Order #{reportingIssueOrder.orderNumber} · {reportingIssueType === 'refund' ? 'Payment Settlement Inquiry' : 'Parcel Non-Receipt Dispute'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setReportingIssueOrder(null);
                  setIssueFeedback(null);
                }}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitDeliveryIssue} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-neutral-800 space-y-1">
                <p>
                  <strong>Customer:</strong> {reportingIssueOrder.customer.name} ({reportingIssueOrder.customer.phone})
                </p>
                <p>
                  <strong>Order Status:</strong> {reportingIssueOrder.status}
                </p>
                {reportingIssueType === 'refund' && (
                  <p className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1">
                    <strong>Refund Status:</strong> {reportingIssueOrder.refundDetails?.refundStatus || 'pending'}{' '}
                    {reportingIssueOrder.refundDetails?.refundUtr && `· UTR: ${reportingIssueOrder.refundDetails.refundUtr}`}
                  </p>
                )}
                {reportingIssueOrder.shippingDetails && (
                  <p className="text-[11px] text-neutral-600">
                    <strong>Courier:</strong> {reportingIssueOrder.shippingDetails.courierName} · Tracking: {reportingIssueOrder.shippingDetails.trackingNumber}
                  </p>
                )}
                <p className="text-[11px] text-neutral-500 pt-1">
                  Destination: {reportingIssueOrder.customer.address}, {reportingIssueOrder.customer.city} - {reportingIssueOrder.customer.pincode}
                </p>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  {reportingIssueType === 'refund'
                    ? 'Refund Issue Explanation *'
                    : 'Delivery Issue Description *'}
                </label>
                <textarea
                  rows={3}
                  required
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder={
                    reportingIssueType === 'refund'
                      ? 'Please specify your inquiry (e.g. UPI account details, delay in bank credit, or payment reconciliation query).'
                      : 'Explain details: e.g. Courier system says delivered, but I have not received the package at my home or security.'
                  }
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-hidden focus:border-rose-500"
                />
              </div>

              {issueFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    issueFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                      : 'bg-rose-50 text-rose-900 border border-rose-300'
                  }`}
                >
                  {issueFeedback.message}
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={isSubmittingIssue}
                  className={`w-full py-2.5 px-4 rounded-xl text-white font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer ${
                    reportingIssueType === 'refund'
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {isSubmittingIssue ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Ticket...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        {reportingIssueType === 'refund'
                          ? 'Submit Refund Inquiry'
                          : 'Submit Delivery Dispute'}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReportingIssueOrder(null);
                    setIssueFeedback(null);
                  }}
                  className="w-full py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
