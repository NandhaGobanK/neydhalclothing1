import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus } from '../../types/store';
import { formatPrice } from '../../utils/upi';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import {
  getActiveDisputeRedressals,
  getOrderEligibleRedressals,
  isCustomerReportIssueVisibleForOrder,
  DISPUTE_REDRESSALS,
  isDisputeActiveForType,
  isDisputeResolvedForType,
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
  Loader2,
  ExternalLink,
  ChevronDown,
  Lock,
  Bell,
  Volume2,
  Eye,
  EyeOff,
} from 'lucide-react';

interface TrackOrderModalProps {
  onClose: () => void;
}

export const TrackOrderModal: React.FC<TrackOrderModalProps> = ({ onClose }) => {
  const {
    orders,
    requestOrderCancellation,
    reportCustomerDeliveryIssue,
    settings,
    lastPlacedOrder,
    recordCustomerOrder,
    activeCustomerChatOrderId,
    setActiveCustomerChatOrderId,
    hideCustomerOrder,
    unhideCustomerOrder,
    hiddenCustomerOrders,
    hiddenCustomerOrderIds,
  } = useStore();
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showHiddenOrders, setShowHiddenOrders] = useState(false);
  const [softClearNotice, setSoftClearNotice] = useState<string | null>(null);

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

  // Deep-link live chat auto-expansion
  useEffect(() => {
    if (activeCustomerChatOrderId) {
      const match = orders.find(
        (o) =>
          o.id === activeCustomerChatOrderId ||
          o.orderNumber.toUpperCase() === activeCustomerChatOrderId.toUpperCase()
      );
      if (match) {
        setQuery(match.orderNumber);
        setSearchedQuery(match.orderNumber);
        setExpandedChatOrderId(match.id);
      }
      setActiveCustomerChatOrderId(null);
    }
  }, [activeCustomerChatOrderId, orders, setActiveCustomerChatOrderId]);

  // Direct Firestore fallback state in case real-time snapshot is still in-flight
  const [firestoreOrders, setFirestoreOrders] = useState<Order[]>([]);
  const [isSearchingFirestore, setIsSearchingFirestore] = useState(false);

  // Customer placed orders list (stored on device) for instant 1-tap "My Orders" access
  const customerSavedOrders = useMemo(() => {
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

  const hiddenKeysSet = useMemo(() => {
    return new Set(hiddenCustomerOrderIds.map((k) => k.trim().toUpperCase()));
  }, [hiddenCustomerOrderIds]);

  const activeCustomerSavedOrders = useMemo(() => {
    return customerSavedOrders.filter((ordNum) => !hiddenKeysSet.has(ordNum.trim().toUpperCase()));
  }, [customerSavedOrders, hiddenKeysSet]);

  const hiddenCustomerSavedOrders = useMemo(() => {
    return customerSavedOrders.filter((ordNum) => hiddenKeysSet.has(ordNum.trim().toUpperCase()));
  }, [customerSavedOrders, hiddenKeysSet]);

  // Cancellation Request Form State
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('Change of wedding / event schedule');
  const [customReasonText, setCustomReasonText] = useState('');
  const [cancelStatusMsg, setCancelStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Issue Report Modal State (User Request 2: Generalized Report Issue with conditional dropdown)
  const [reportingIssueOrder, setReportingIssueOrder] = useState<Order | null>(null);
  const [reportingIssueType, setReportingIssueType] = useState<'delivery' | 'refund'>('delivery');
  const [openIssueDropdownOrderId, setOpenIssueDropdownOrderId] = useState<string | null>(null);
  const [issueDescription, setIssueDescription] = useState(
    'Courier tracking and system shows Delivered, but parcel was not received at delivery address/door.'
  );
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [issueFeedback, setIssueFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [expandedChatOrderId, setExpandedChatOrderId] = useState<string | null>(null);

  // Dynamic dispute redressal options based on admin configuration (Conditional Visibility & Extensibility)
  const activeRedressals = useMemo(() => getActiveDisputeRedressals(settings), [settings]);
  const canReportAnyIssue = activeRedressals.length > 0;

  // Check URL params if present (e.g. ?order=AARA-1082, #track?order=AARA-1082, ?track=AARA-1082)
  useEffect(() => {
    const syncFromUrl = () => {
      if (typeof window === 'undefined') return;
      const fullUrl = window.location.href;

      // 1. Try standard URLSearchParams first
      let targetOrder = '';
      let targetPhone = '';
      try {
        const searchParams = new URLSearchParams(window.location.search);
        targetOrder = searchParams.get('order') || searchParams.get('track') || searchParams.get('trackOrder') || '';
        targetPhone = searchParams.get('phone') || '';
      } catch (e) {}

      // 2. Fallback regex to capture parameters if inside hash (e.g. #track?order=...)
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
      } else {
        // If opened without URL parameter (e.g. from My Orders bottom nav), automatically load customer's order
        const fallback = lastPlacedOrder?.orderNumber || localStorage.getItem('aara_last_order') || '';
        if (fallback) {
          setQuery(fallback);
          setSearchedQuery(fallback);
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
  }, [lastPlacedOrder]);

  // Compute matched orders from local state
  const localMatchedOrders = useMemo(() => {
    if (!searchedQuery.trim()) return [];
    const clean = searchedQuery.trim().toLowerCase();
    const cleanOrder = clean.replace(/^[#\s]+/, '').trim();
    const cleanDigits = searchedQuery.replace(/[^0-9]/g, '');

    // 1. Strict exact Order Number match first
    const exactOrderMatch = orders.find((o) => {
      const oNum = o.orderNumber.trim().toLowerCase();
      const oNumClean = oNum.replace(/^[#\s]+/, '').trim();
      return oNum === clean || oNumClean === cleanOrder;
    });
    if (exactOrderMatch) {
      return [exactOrderMatch];
    }

    // 2. Strict exact Payment UTR match
    const exactUtrMatch = orders.find(
      (o) => o.upiTransactionId.trim().toLowerCase() === clean
    );
    if (exactUtrMatch) {
      return [exactUtrMatch];
    }

    // 3. Fallback matching
    return orders
      .filter((o) => {
        const oNum = o.orderNumber.toLowerCase().replace(/^[#\s]+/, '');
        const matchOrderNum = oNum.includes(cleanOrder);
        const matchName = o.customer.name.toLowerCase().includes(clean);
        const matchUtr = o.upiTransactionId.toLowerCase().includes(clean);

        // Match phone number
        const matchPhone =
          cleanDigits.length >= 6 &&
          o.customer.phone.replace(/[^0-9]/g, '').includes(cleanDigits);

        return matchOrderNum || matchName || matchUtr || matchPhone;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, searchedQuery]);

  // If order was not found in local memory, directly query Firestore
  useEffect(() => {
    if (!searchedQuery.trim() || localMatchedOrders.length > 0) {
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
  }, [searchedQuery, localMatchedOrders.length]);

  // Combined matched orders
  const matchedOrders = useMemo(() => {
    if (localMatchedOrders.length > 0) return localMatchedOrders;
    return firestoreOrders;
  }, [localMatchedOrders, firestoreOrders]);

  // Synchronize found orders with customer live orders counter
  useEffect(() => {
    if (matchedOrders.length > 0) {
      matchedOrders.forEach((ord) => {
        if (ord.orderNumber) {
          recordCustomerOrder(ord.orderNumber, ord.customer?.phone);
        }
      });
    }
  }, [matchedOrders, recordCustomerOrder]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearchedQuery(query.trim());
    setCancelStatusMsg(null);
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

  // Customer Issue Submit Handler (Delivery Dispute or Refund Dispute)
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
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-neutral-900 text-white flex items-center justify-between border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-bold">Track Your Saree Order</h2>
              <p className="text-xs text-neutral-400">
                Live dispatch status, courier consignment ID & cancellation request
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

        {/* Search Bar */}
        <div className="p-4 sm:p-6 bg-neutral-50/70 border-b border-neutral-200 shrink-0">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter 10-digit Phone Number OR Order # (e.g. AARA-1082)"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 bg-white text-xs sm:text-sm text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs sm:text-sm transition whitespace-nowrap"
            >
              Track Order
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

          <p className="text-[11px] text-neutral-500 mt-2">
            Enter the exact order number or contact phone used during checkout.
          </p>

          {/* Customer Soft-Clear Feedback Notice */}
          {softClearNotice && (
            <div className="mt-2.5 p-3 rounded-xl bg-neutral-900 text-white text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="leading-tight">{softClearNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setSoftClearNotice(null)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Active Placed Orders Chips + Hidden Orders Toggle */}
          {(activeCustomerSavedOrders.length > 0 || hiddenCustomerSavedOrders.length > 0 || hiddenCustomerOrders.length > 0) && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-2 border-t border-neutral-100">
              <span className="text-[11px] font-semibold text-neutral-600">Your Placed Orders:</span>
              {activeCustomerSavedOrders.map((ordNum) => (
                <button
                  key={ordNum}
                  type="button"
                  onClick={() => {
                    setQuery(ordNum);
                    setSearchedQuery(ordNum);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                    searchedQuery.trim().toLowerCase() === ordNum.toLowerCase()
                      ? 'bg-rose-900 text-white shadow-2xs'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300'
                  }`}
                >
                  #{ordNum}
                </button>
              ))}

              {/* Toggle Hidden Orders View */}
              {(hiddenCustomerSavedOrders.length > 0 || hiddenCustomerOrders.length > 0) && (
                <button
                  type="button"
                  onClick={() => setShowHiddenOrders((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ml-auto sm:ml-0 ${
                    showHiddenOrders
                      ? 'bg-neutral-900 text-white shadow-2xs'
                      : 'bg-neutral-200/80 hover:bg-neutral-300 text-neutral-700'
                  }`}
                  title="View completed or cancelled orders you cleared from your personal active dashboard"
                >
                  {showHiddenOrders ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-neutral-500" />}
                  <span>
                    Hidden Orders ({hiddenCustomerSavedOrders.length || hiddenCustomerOrders.length})
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Hidden Orders Collapsible Dashboard (Non-Permanent Soft Removal) */}
          {showHiddenOrders && (
            <div className="mt-3 p-3.5 rounded-2xl bg-neutral-100/90 border border-neutral-200 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200">
                <div className="flex items-center gap-1.5">
                  <EyeOff className="w-4 h-4 text-neutral-600" />
                  <span className="font-serif font-bold text-xs text-neutral-900">
                    Personal Hidden Orders Dashboard
                  </span>
                </div>
                <span className="text-[10px] text-neutral-500 font-medium">
                  {hiddenCustomerSavedOrders.length || hiddenCustomerOrders.length} order(s) hidden
                </span>
              </div>

              <p className="text-[11px] text-neutral-600 leading-relaxed">
                These completed, cancelled, or closed orders are hidden from your active "My Orders" list to keep your personal dashboard clutter-free. <em>Workshop ledger records and warranties remain permanently intact with our boutique.</em>
              </p>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {(hiddenCustomerOrders.length > 0
                  ? hiddenCustomerOrders
                  : orders.filter((o) => hiddenCustomerSavedOrders.includes(o.orderNumber))
                ).map((hiddenOrd) => (
                  <div
                    key={hiddenOrd.id}
                    className="p-2.5 rounded-xl bg-white border border-neutral-200 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-neutral-900">
                          #{hiddenOrd.orderNumber}
                        </span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700">
                          {hiddenOrd.status}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {new Date(hiddenOrd.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                      <span className="text-[11px] text-neutral-600 font-serif font-bold">
                        {formatPrice(hiddenOrd.totalAmount)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setQuery(hiddenOrd.orderNumber);
                          setSearchedQuery(hiddenOrd.orderNumber);
                          setShowHiddenOrders(false);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[11px] font-semibold transition cursor-pointer"
                        title="View order details"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          unhideCustomerOrder(hiddenOrd.id);
                          unhideCustomerOrder(hiddenOrd.orderNumber);
                          setSoftClearNotice(`Order #${hiddenOrd.orderNumber} restored to your active My Orders view.`);
                          setTimeout(() => setSoftClearNotice(null), 4000);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                        title="Restore this order back to your active list"
                      >
                        <Eye className="w-3 h-3 text-emerald-600" />
                        <span>Restore</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Storefront Cancellation Policy Notice */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex items-center gap-2 text-xs mt-3">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <p className="leading-tight">
              <strong>Boutique Policy Notice:</strong> No cancellation once the order is confirmed.
            </p>
          </div>
        </div>

        {/* Results Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {!searchedQuery ? (
            <div className="py-12 text-center text-neutral-500">
              <Truck className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
              <p className="font-serif text-base font-bold text-neutral-800">
                Track Live Order Progress
              </p>
              <p className="text-xs max-w-sm mx-auto mt-1">
                Enter your order reference (e.g. AARA-1082) or mobile number above to see live stage status, courier consignment, and cancellation options.
              </p>
            </div>
          ) : isSearchingFirestore ? (
            <div className="py-12 text-center text-neutral-500">
              <Loader2 className="w-8 h-8 text-amber-600 animate-spin mx-auto mb-2" />
              <p className="font-serif text-base font-bold text-neutral-800">Searching Boutique Database...</p>
              <p className="text-xs max-w-sm mx-auto mt-1">
                Checking order reference "{searchedQuery}" with live workshop ledger.
              </p>
            </div>
          ) : matchedOrders.length === 0 ? (
            <div className="py-12 text-center text-neutral-500">
              <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-2" />
              <p className="font-serif text-base font-bold text-neutral-800">No Orders Found</p>
              <p className="text-xs max-w-sm mx-auto mt-1">
                We couldn't find an order matching "{searchedQuery}". Please check your order reference number or mobile number.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {matchedOrders.map((order) => {
                const currentStep = getStatusStepIndex(order.status);
                const isCancelled = order.status === 'Cancelled' || order.status === 'Rejected' || order.status === 'Refunded';
                const isPendingOrConfirmed = order.status === 'Pending' || order.status === 'Confirmed';
                const isPublicCancellationEnabled = settings.storefrontDisplay?.allowPublicCancellation !== false;
                const canRequestCancel =
                  isPublicCancellationEnabled &&
                  isPendingOrConfirmed &&
                  !order.cancellationRequest?.requested;

                const isThisOrderHidden =
                  hiddenKeysSet.has(order.id.toUpperCase()) ||
                  hiddenKeysSet.has(order.orderNumber.trim().toUpperCase());

                return (
                  <div
                    key={order.id}
                    className="p-5 rounded-2xl border border-neutral-200 bg-white shadow-xs space-y-4"
                  >
                    {/* Top Order Badge & Date */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm text-rose-950 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200">
                            #{order.orderNumber}
                          </span>
                          <span className="text-neutral-500 text-[11px]">
                            {new Date(order.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          {/* Live Status Pill */}
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              order.status === 'Refunded'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : order.status === 'Shipped'
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : order.status === 'Delivered'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : order.status === 'Confirmed'
                                ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                : order.status === 'Cancelled' || order.status === 'Rejected'
                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            Status: {order.status}
                          </span>

                          {/* Customer Soft Clear / Hide Option */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isThisOrderHidden) {
                                unhideCustomerOrder(order.id);
                                unhideCustomerOrder(order.orderNumber);
                                setSoftClearNotice(`Order #${order.orderNumber} restored to your active My Orders view.`);
                              } else {
                                hideCustomerOrder(order.id);
                                hideCustomerOrder(order.orderNumber);
                                setSoftClearNotice(`Order #${order.orderNumber} cleared from your view. Boutique records remain preserved.`);
                              }
                              setTimeout(() => setSoftClearNotice(null), 4000);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                              isThisOrderHidden
                                ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                                : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 border border-neutral-200'
                            }`}
                            title={
                              isThisOrderHidden
                                ? 'Order is hidden from your active list. Click to restore.'
                                : 'Clear order from your active view to keep order history clean (preserves store records)'
                            }
                          >
                            {isThisOrderHidden ? (
                              <>
                                <Eye className="w-3 h-3 text-amber-700" />
                                <span>Restore to Active</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3 text-neutral-500" />
                                <span>Clear from My View</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-neutral-600 text-[11px] mt-1 font-medium">
                          Customer: <strong className="text-neutral-900">{order.customer.name}</strong> ({order.customer.phone})
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-[11px] text-neutral-500">Total Value:</span>
                        <p className="font-serif font-bold text-base text-neutral-900 tabular-nums">
                          {formatPrice(order.totalAmount)}
                        </p>
                      </div>
                    </div>

                    {/* Notice if order is currently soft-cleared */}
                    {isThisOrderHidden && (
                      <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <EyeOff className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span className="text-[11px]">
                            This order is currently <strong>hidden</strong> from your active personal view.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            unhideCustomerOrder(order.id);
                            unhideCustomerOrder(order.orderNumber);
                            setSoftClearNotice(`Order #${order.orderNumber} restored to your active My Orders view.`);
                            setTimeout(() => setSoftClearNotice(null), 4000);
                          }}
                          className="text-rose-900 font-bold hover:underline text-[11px] cursor-pointer"
                        >
                          Restore to Active
                        </button>
                      </div>
                    )}

                    {/* Payment & Customer Refund UPI Section */}
                    <div className={`grid gap-2.5 pt-1 text-xs ${
                      settings.storefrontDisplay?.allowPublicRefunds !== false &&
                      Boolean(order.refundDetails?.refundUpiId || order.refundDetails?.refundUpiPhone)
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-1'
                    }`}>
                      <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200">
                        <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">
                          Payment Transaction ID (UTR)
                        </span>
                        <div className="flex items-center justify-between mt-0.5">
                          <code className="font-mono font-bold text-neutral-900 text-xs">
                            {order.upiTransactionId}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyText(order.upiTransactionId, `utr-${order.id}`)}
                            className="p-1 text-neutral-500 hover:text-neutral-900 rounded cursor-pointer"
                            title="Copy Payment UTR"
                          >
                            {copiedKey === `utr-${order.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Customer Refund UPI: COMPLETELY HIDDEN if admin disabled refund option in settings */}
                      {settings.storefrontDisplay?.allowPublicRefunds !== false && (
                        <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                          <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider block">
                            Customer Refund UPI
                          </span>
                          {order.refundDetails?.refundUpiId ? (
                            <div className="flex items-center justify-between mt-0.5">
                              <code className="font-mono font-bold text-emerald-950 text-xs truncate">
                                {order.refundDetails.refundUpiId}
                              </code>
                              {order.refundDetails.refundUpiPhone && (
                                <span className="text-[10px] text-emerald-700 ml-1.5 shrink-0">
                                  ({order.refundDetails.refundUpiPhone})
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-neutral-500 italic mt-0.5">
                              {order.refundDetails?.refundUpiPhone
                                ? `UPI Phone: ${order.refundDetails.refundUpiPhone}`
                                : 'Not provided at checkout'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Customer Cancellation Request Pending Notice (Only if not already Shipped/Delivered/Cancelled) */}
                    {!isCancelled && order.status !== 'Shipped' && order.status !== 'Delivered' && order.cancellationRequest?.requested && order.cancellationRequest.status === 'pending' && (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span>Cancellation Request Submitted (Under Review)</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Your request to cancel this order has been submitted to the boutique on{' '}
                          {new Date(order.cancellationRequest.requestedAt).toLocaleDateString('en-IN')}. Our concierge team is processing the refund.
                        </p>
                        <p className="text-[11px] text-amber-800 italic">
                          Reason: "{order.cancellationRequest.reason}"
                        </p>
                      </div>
                    )}

                    {/* Stage Timeline (When Not Cancelled) */}
                    {!isCancelled ? (
                      <div className="space-y-3">
                        {/* Assigned Concierge Status Card (User Request) */}
                        {order.assignedStaffName ? (
                          <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-3">
                              <span className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-600 to-rose-700 text-amber-100 font-serif font-bold text-sm flex items-center justify-center shadow-xs shrink-0">
                                {order.assignedStaffName.charAt(0)}
                              </span>
                              <div>
                                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                                  Dedicated Concierge Assigned
                                </span>
                                <h4 className="font-serif font-bold text-sm text-neutral-900">
                                  {order.assignedStaffName}
                                </h4>
                                <p className="text-[11px] text-neutral-600">
                                  Actively coordinating your saree reservation and loom verification.
                                </p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold shrink-0">
                              Concierge Assigned ✓
                            </span>
                          </div>
                        ) : (
                          <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-3">
                              <span className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                                <Clock className="w-4 h-4 text-blue-600" />
                              </span>
                              <div>
                                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
                                  Order in Intake Queue
                                </span>
                                <h4 className="font-serif font-bold text-sm text-neutral-900">
                                  Awaiting Staff Concierge Claim
                                </h4>
                                <p className="text-[11px] text-neutral-600">
                                  Your order has been placed into our queue. A staff concierge will claim and close the deal shortly.
                                </p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-300 text-[10px] font-bold shrink-0">
                              In Queue
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                            Order Progress
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 mt-2 pt-2">
                          {[
                            { name: 'Pending', icon: Clock },
                            { name: 'Confirmed', icon: CheckCircle },
                            { name: 'Shipped', icon: Truck },
                            { name: 'Delivered', icon: Package },
                          ].map((step, idx) => {
                            const isDone = currentStep >= idx;
                            const isCurrent = currentStep === idx;
                            const Icon = step.icon;
                            return (
                              <div key={step.name} className="flex flex-col items-center text-center">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                                    isDone
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-neutral-100 text-neutral-400'
                                  } ${isCurrent ? 'ring-4 ring-emerald-100' : ''}`}
                                >
                                  <Icon className="w-4 h-4" />
                                </div>
                                <span
                                  className={`text-[11px] mt-1.5 font-semibold ${
                                    isCurrent
                                      ? 'text-emerald-800'
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
                    ) : (
                      /* Cancellation & Refund Progression (Requirement 1) */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                            Cancellation & Refund Progression
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            order.status === 'Refunded'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-rose-100 text-rose-900 border border-rose-300'
                          }`}>
                            {order.status === 'Refunded' ? 'Stage: Refund Completed ✓' : 'Stage: Order Cancelled'}
                          </span>
                        </div>

                        {/* Progression Stepper: Placed -> Confirmed -> Cancelled -> Refunded */}
                        <div className="grid grid-cols-4 gap-2 pt-1">
                          {[
                            { name: 'Placed', isDone: true, isCurrent: false, icon: Clock },
                            { name: 'Confirmed', isDone: true, isCurrent: false, icon: CheckCircle },
                            {
                              name: 'Cancelled',
                              isDone: true,
                              isCurrent: order.status === 'Cancelled' || order.status === 'Rejected',
                              icon: XCircle,
                            },
                            {
                              name: 'Refunded',
                              isDone: order.status === 'Refunded' || order.refundDetails?.refundStatus === 'processed',
                              isCurrent: order.status === 'Refunded',
                              icon: RotateCcw,
                            },
                          ].map((step) => {
                            const Icon = step.icon;
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
                                  <Icon className="w-4 h-4" />
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

                        {order.status === 'Refunded' ? (
                          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-300 text-emerald-950 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                                <h4 className="font-bold text-sm">Refund Completed</h4>
                              </div>
                              <span className="px-2 py-0.5 rounded-md bg-emerald-200 text-emerald-900 font-bold text-[10px] uppercase">
                                Settled ✓
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white p-2.5 rounded-lg border border-emerald-200">
                              <div>
                                <span className="text-neutral-500 text-[10px] font-semibold uppercase">Bank Refund UTR:</span>
                                <p className="font-mono font-bold text-neutral-950 text-xs mt-0.5">{order.refundDetails?.refundUtr || 'N/A'}</p>
                              </div>
                              <div>
                                <span className="text-neutral-500 text-[10px] font-semibold uppercase">Transaction Tool:</span>
                                <p className="font-bold text-neutral-950 text-xs mt-0.5">{order.refundDetails?.refundTool || 'UPI Banking'}</p>
                              </div>
                              <div>
                                <span className="text-neutral-500 text-[10px] font-semibold uppercase">Refund Amount:</span>
                                <p className="font-bold text-emerald-700 text-xs mt-0.5">{formatPrice(order.refundDetails?.refundAmount || order.totalAmount)}</p>
                              </div>
                              <div>
                                <span className="text-neutral-500 text-[10px] font-semibold uppercase">Processed At:</span>
                                <p className="font-medium text-neutral-800 text-xs mt-0.5">
                                  {order.refundDetails?.processedAt ? new Date(order.refundDetails.processedAt).toLocaleString('en-IN') : 'Completed'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                              <h4 className="font-bold text-sm">Order {order.status}</h4>
                            </div>
                            {order.cancellationReason && (
                              <p className="text-xs text-rose-950 font-medium">
                                <strong>Reason:</strong> {order.cancellationReason}
                              </p>
                            )}
                            <p className="text-[11px] text-rose-800 leading-relaxed">
                              This order has been officially marked as <strong>Cancelled</strong>. Refund processing is underway. The status will immediately transition to <strong>Refunded</strong> once verified with our bank UTR.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Courier & Tracking Details Box (When Shipped) */}
                    {order.status === 'Shipped' && order.shippingDetails && (
                      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 space-y-2">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-blue-700" />
                          <h4 className="font-bold text-xs">Courier Consignment Dispatch Information</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-lg border border-blue-100">
                          <div>
                            <span className="text-neutral-500 text-[11px] font-semibold">Courier Partner:</span>
                            <p className="font-bold text-neutral-900 mt-0.5">
                              {order.shippingDetails.courierName}
                            </p>
                          </div>
                          <div>
                            <span className="text-neutral-500 text-[11px] font-semibold">
                              Consignment Tracking Number:
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <code className="font-mono font-bold text-xs text-neutral-900">
                                {order.shippingDetails.trackingNumber}
                              </code>
                              <button
                                onClick={() => copyText(order.shippingDetails!.trackingNumber, `track-${order.id}`)}
                                className="p-1 hover:bg-neutral-100 rounded text-neutral-600"
                                title="Copy Consignment ID"
                              >
                                {copiedKey === `track-${order.id}` ? (
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
                            (c) => c.name.toLowerCase().trim() === order.shippingDetails?.courierName?.toLowerCase().trim()
                          );
                          const trackingPortalUrl =
                            matchedCourier?.trackingUrl ||
                            (matchedCourier?.trackingUrlTemplate && order.shippingDetails.trackingNumber
                              ? matchedCourier.trackingUrlTemplate + order.shippingDetails.trackingNumber
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
                                <span>Track on {order.shippingDetails.courierName} Website</span>
                                <ExternalLink className="w-3 h-3 text-white/90" />
                              </a>
                            </div>
                          ) : (
                            <p className="text-[11px] text-blue-800 leading-relaxed">
                              Note: You can monitor your order status directly on this page or copy your Consignment ID above to track on {order.shippingDetails.courierName}'s official portal.
                            </p>
                          );
                        })()}
                      </div>
                    )}

                    {/* Refund Information (If Cancelled/Rejected) */}
                    {isCancelled && (
                      <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                            <RotateCcw className="w-4 h-4 text-amber-700" />
                            <span>Refund Settlement Details</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            order.refundDetails?.refundStatus === 'processed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {order.refundDetails?.refundStatus === 'processed' ? 'Refund Processed' : 'Refund In Queue'}
                          </span>
                        </div>

                        {order.refundDetails?.refundUtr ? (
                          <div className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-amber-200">
                            <span className="font-semibold text-neutral-600">Bank Refund UTR ID:</span>
                            <div className="flex items-center gap-1">
                              <code className="font-mono font-bold text-neutral-900">
                                {order.refundDetails.refundUtr}
                              </code>
                              <button
                                onClick={() => copyText(order.refundDetails.refundUtr!, `utr-${order.id}`)}
                                className="p-0.5 text-neutral-500 hover:text-neutral-900"
                                title="Copy Refund UTR"
                              >
                                {copiedKey === `utr-${order.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        ) : settings.storefrontDisplay?.allowPublicRefunds !== false ? (
                          <p className="text-[11px] text-neutral-600">
                            Our team is transferring the amount to your UPI ID ({order.refundDetails?.refundUpiId || 'your provided account'}). The Bank UTR will appear here once processed.
                          </p>
                        ) : (
                          <p className="text-[11px] text-neutral-600">
                            Our boutique concierge is handling your request. The settlement update will appear here once reviewed.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Items List with Product SKU Code */}
                    <div>
                      <span className="text-[11px] font-semibold text-neutral-500 uppercase">
                        Items in this Order:
                      </span>
                      <div className="mt-1 space-y-1">
                        {order.items.map((item) => (
                          <div
                            key={item.product.id}
                            className="flex justify-between items-center py-1.5 border-b border-neutral-100 last:border-0"
                          >
                            <div>
                              <p className="font-medium text-neutral-900">{item.product.title}</p>
                              <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                                <span className="font-mono font-semibold text-rose-950 bg-rose-50 px-1 rounded">
                                  SKU: {item.product.productCode}
                                </span>
                                <span>{item.product.fabric} - {item.product.color} (Qty: {item.quantity})</span>
                              </div>
                            </div>
                            <span className="font-bold tabular-nums text-neutral-900">
                              {formatPrice(item.product.price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Customer Dispute Notice if already reported and active */}
                    {order.deliveryIssue?.reported && order.deliveryIssue.issueType !== 'cancellation' && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5 text-rose-900">
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                            <span>
                              {order.deliveryIssue.issueType === 'refund'
                                ? `Refund Dispute Ticket (${order.deliveryIssue.status.toUpperCase()})`
                                : `Delivery Issue Reported (${order.deliveryIssue.status.toUpperCase()})`}
                            </span>
                          </span>
                          <span className="text-[10px] text-neutral-500 font-medium">
                            {new Date(order.deliveryIssue.reportedAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                        <p className="text-neutral-800 italic bg-white/70 p-2 rounded-lg border border-rose-100">
                          "{order.deliveryIssue.issueDescription}"
                        </p>
                        <p className="text-[11px] text-rose-800 font-medium">
                          {order.deliveryIssue.issueType === 'refund'
                            ? 'Our concierge finance team is actively verifying your refund settlement inquiry with our bank accounts desk.'
                            : `Assigned concierge is actively investigating with ${order.shippingDetails?.courierName || 'the courier partner'} local hub. This case is prioritized in our administrative portal.`}
                        </p>
                      </div>
                    )}

                    {/* Bottom Actions: Cancel Request, Delivery Dispute, or Live Concierge Chat */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isPublicCancellationEnabled ? (
                          canRequestCancel ? (
                            <button
                              onClick={() => setCancellingOrder(order)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 font-medium text-xs transition cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Request Order Cancellation</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-neutral-400">
                              {isCancelled
                                ? 'Order already cancelled'
                                : order.status === 'Shipped'
                                ? 'Dispatched (Cancellations not permitted after shipping)'
                                : order.status === 'Delivered'
                                ? 'Delivered'
                                : order.cancellationRequest?.requested
                                ? 'Cancellation requested (Under Review)'
                                : `Cannot cancel in ${order.status} state`}
                            </span>
                          )
                        ) : null}

                        {/* Conditional Customer Issue Reporting Dropdown (Rule: Delivery only if Delivered; Refund only if Cancelled + Refunded; Strict duplicate prevention once resolved) */}
                        {(() => {
                          const eligibleRedressals = getOrderEligibleRedressals(order, settings);
                          if (eligibleRedressals.length === 0) return null;

                          // Only dispute types that are not active and not already resolved
                          const availableRedressals = getAvailableRedressalsForOrder(order, settings);

                          const hasActiveDispute =
                            Boolean(order.deliveryIssue?.reported && order.deliveryIssue.status !== 'resolved') ||
                            Boolean(order.cancellationRequest?.requested && order.cancellationRequest.status === 'pending');

                          const allEligibleResolved = areAllEligibleDisputesResolved(order, settings);

                          // If all eligible disputes for this order are officially resolved and closed, lock repeated disputes
                          if (allEligibleResolved && availableRedressals.length === 0) {
                            return (
                              <button
                                type="button"
                                disabled
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-neutral-100 text-neutral-500 font-semibold text-xs cursor-not-allowed opacity-80 shadow-2xs"
                                title="This issue has been officially resolved and closed by boutique concierge. Repeated disputes for the same category are disabled."
                              >
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Report Issue (Resolved)</span>
                                <Lock className="w-3 h-3 text-neutral-400" />
                              </button>
                            );
                          }

                          // If order is closed and no available redressals remain (e.g. delivered and completed)
                          if (order.isClosed && availableRedressals.length === 0) {
                            return (
                              <button
                                type="button"
                                disabled
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-neutral-100 text-neutral-400 font-semibold text-xs cursor-not-allowed opacity-75 shadow-2xs"
                                title="Order is archived/closed. New dispute requests are disabled."
                              >
                                <Lock className="w-3.5 h-3.5 text-neutral-400" />
                                <span>Report Issue (Closed)</span>
                              </button>
                            );
                          }

                          // If an active dispute is already in progress and no other distinct category is available
                          if (hasActiveDispute && availableRedressals.length === 0) {
                            return (
                              <div
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 font-semibold text-xs shadow-2xs"
                                title="Your issue report is actively being investigated by concierge."
                              >
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
                                onClick={() => {
                                  setOpenIssueDropdownOrderId(
                                    openIssueDropdownOrderId === order.id ? null : order.id
                                  );
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900 font-semibold text-xs transition cursor-pointer shadow-2xs"
                                title="Report an issue for this order"
                              >
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Report Issue</span>
                                <ChevronDown
                                  className={`w-3 h-3 text-rose-700 transition-transform ${
                                    openIssueDropdownOrderId === order.id ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>

                              {/* Click-away backdrop */}
                              {openIssueDropdownOrderId === order.id && (
                                <div
                                  className="fixed inset-0 z-20"
                                  onClick={() => setOpenIssueDropdownOrderId(null)}
                                />
                              )}

                              {/* Conditional Dropdown Menu containing ONLY eligible options for this order's state */}
                              {openIssueDropdownOrderId === order.id && (
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
                                        setReportingIssueOrder(order);
                                        setReportingIssueType(redressal.type as any);
                                        setIssueDescription(
                                          redressal.defaultNote(order.orderNumber, order.status)
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
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Order-Specific Customer-to-Staff Live Chat Integration */}
                      {(() => {
                        const hasActiveDispute = Boolean(
                          order.deliveryIssue &&
                            (order.deliveryIssue.status === 'open' || order.deliveryIssue.status === 'investigating')
                        );
                        const allDisputesResolved = areAllEligibleDisputesResolved(order, settings);
                        const isLiveChatGloballyEnabled = settings.storefrontDisplay?.allowLiveChat !== false;
                        const isChatAvailable =
                          isLiveChatGloballyEnabled && (!order.isClosed || hasActiveDispute || !allDisputesResolved);

                        return (
                          <div className="flex items-center gap-2 ml-auto">
                            {isChatAvailable ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedChatOrderId(
                                    expandedChatOrderId === order.id ? null : order.id
                                  )
                                }
                                className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs ${
                                  expandedChatOrderId === order.id
                                    ? 'bg-amber-700 text-white'
                                    : hasActiveDispute
                                    ? 'bg-rose-700 hover:bg-rose-600 text-white'
                                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                                }`}
                                title="Open direct real-time chat with boutique staff"
                              >
                                <MessageSquare className="w-3.5 h-3.5 fill-white" />
                                <span>
                                  {expandedChatOrderId === order.id
                                    ? 'Close Live Chat'
                                    : hasActiveDispute
                                    ? 'Dispute Live Chat'
                                    : 'Live Concierge Chat'}
                                  {order.chatMessages && order.chatMessages.length > 0
                                    ? ` (${order.chatMessages.length})`
                                    : ''}
                                </span>
                                {order.chatMessages?.some((m) => !m.readByCustomer && m.sender !== 'customer') && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500 text-white font-bold animate-pulse ml-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                    <span>New Reply</span>
                                  </span>
                                )}
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                {order.chatMessages && order.chatMessages.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedChatOrderId(
                                        expandedChatOrderId === order.id ? null : order.id
                                      )
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 transition cursor-pointer"
                                    title="View previous messages (read-only)"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5 text-neutral-500" />
                                    <span>
                                      {expandedChatOrderId === order.id ? 'Hide Chat' : `Chat History (${order.chatMessages.length})`}
                                    </span>
                                  </button>
                                )}
                                <span className="text-[11px] font-semibold text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200 flex items-center gap-1">
                                  <Lock className="w-3 h-3 text-neutral-400" />
                                  <span>
                                    {allDisputesResolved
                                      ? 'Dispute Resolved (Chat Closed)'
                                      : order.isClosed
                                      ? 'Order Closed'
                                      : 'Chat Unavailable'}
                                  </span>
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                    </div>

                    {/* Live Customer Chat Stream Box (User Request 3) */}
                    {expandedChatOrderId === order.id && (
                      <div className="mt-3 pt-3 border-t border-neutral-200 animate-in fade-in duration-200">
                        <OrderLiveChat
                          order={order}
                          mode="customer"
                          title={`Concierge Chat · Order #${order.orderNumber}`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* Customer Cancellation Request Drawer/Modal */}
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

              {/* Dynamic Dispute Category Dropdown in Form (Filtered to Order Eligible Categories) */}
              {(() => {
                const modalEligible = reportingIssueOrder ? getOrderEligibleRedressals(reportingIssueOrder, settings) : [];
                if (modalEligible.length > 1) {
                  return (
                    <div>
                      <label className="block font-bold text-neutral-800 mb-1">
                        Dispute Redressal Category *
                      </label>
                      <select
                        value={reportingIssueType}
                        onChange={(e) => {
                          const newType = e.target.value as 'delivery' | 'refund';
                          setReportingIssueType(newType);
                          const matched = modalEligible.find((r) => r.type === newType);
                          if (matched && reportingIssueOrder) {
                            setIssueDescription(
                              matched.defaultNote(reportingIssueOrder.orderNumber, reportingIssueOrder.status)
                            );
                          }
                        }}
                        className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 font-semibold focus:outline-hidden focus:border-rose-500 cursor-pointer text-xs"
                      >
                        {modalEligible.map((r) => (
                          <option key={r.id} value={r.type}>
                            {r.title} ({r.badgeLabel})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return null;
              })()}

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
                <p className="text-[10px] text-neutral-500 mt-1">
                  {reportingIssueType === 'refund'
                    ? 'This inquiry routes immediately to our administrative "Customers Issue" section for concierge finance investigation.'
                    : 'This report immediately notifies our boutique concierge and opens a dispute in our administrative portal with the courier hub.'}
                </p>
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
