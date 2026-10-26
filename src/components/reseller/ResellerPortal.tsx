import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, Order, OrderStatus, ResellerUser, CartItem, CustomerAddress, AppNotification } from '../../types/store';
import { formatPrice, getUpiQrCodeImageUrl } from '../../utils/upi';
import { downloadSingleImage, downloadAllProductImagesZip } from '../../utils/imageDownload';
import { buildCourierTrackingUrl, resolveCourierDetails } from '../../utils/courier';
import { isProductRestocked, getRestockRemainingTime } from '../../utils/productValidation';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import {
  getNotificationPermission,
  requestNotificationPermission,
  triggerDeviceVibration,
} from '../../utils/deviceNotifications';
import { playChatChimeSound } from '../../utils/audio';
import {
  getOrderEligibleRedressals,
  getAvailableRedressalsForOrder,
  areAllEligibleDisputesResolved,
} from '../../utils/disputeRedressals';
import { OrderLiveChat } from '../common/OrderLiveChat';
import { PaytmCheckoutModal } from '../common/PaytmCheckoutModal';
import { PaytmTransactionDetails } from '../../types/store';
import {
  X,
  Store,
  Package,
  TrendingUp,
  Download,
  Share2,
  Copy,
  Check,
  CheckCircle,
  Truck,
  ShieldCheck,
  Phone,
  Mail,
  Lock,
  Building,
  User,
  MapPin,
  Search,
  Filter,
  DollarSign,
  Send,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Layers,
  LogOut,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShoppingBag,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Clock,
  XCircle,
  RotateCcw,
  Ban,
  Loader2,
  ExternalLink,
  MessageSquare,
  Printer,
  FileText,
  Bell,
  Volume2,
} from 'lucide-react';
import { getThemeColors } from '../../utils/theme';

export interface ResellerCartItem {
  product: Product;
  quantity: number;
  resalePrice: number;
}

interface ResellerPortalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProductModal?: (product: Product) => void;
}

export const ResellerPortal: React.FC<ResellerPortalProps> = ({
  isOpen,
  onClose,
  onOpenProductModal,
}) => {
  const {
    currentReseller,
    resellers,
    resellerRequests,
    resellerLogin,
    resellerLoginWithGoogle,
    resellerRegister,
    requestResellerAccess,
    resellerLogout,
    resellerOrders,
    orders,
    activeCustomerChatOrderId,
    setActiveCustomerChatOrderId,
    placeResellerOrder,
    publicProducts,
    products,
    categories,
    settings,
    requestOrderCancellation,
    reportCustomerDeliveryIssue,
    updateOrderStatus,
    replenishOrderInventory,
    addResellerAddress,
    updateResellerAddress,
    deleteResellerAddress,
    setDefaultResellerAddress,
    resellerNotifications,
    markResellerNotificationRead,
    markAllResellerNotificationsRead,
    clearResellerNotifications,
  } = useStore();

  const themeColors = getThemeColors(settings.theme, settings.themeMode);

  // Authentication states: Google Auth with Firestore separation
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [unregisteredReseller, setUnregisteredReseller] = useState<{ email: string } | null>(null);

  // Reseller registration fields
  const [regBusinessName, setRegBusinessName] = useState('');
  const [regContactName, setRegContactName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regWhatsapp, setRegWhatsapp] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regGst, setRegGst] = useState('');

  const [authError, setAuthError] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [requestStatus, setRequestStatus] = useState<{
    type: 'approved' | 'pending' | 'submitted' | null;
    message?: string;
  }>({ type: null });

  // Check if entered email is already approved in the separate reseller collection
  const existingApprovedReseller = useMemo(() => {
    if (!regEmail.trim()) return null;
    return (resellers || []).find(
      (r) => r.email?.toLowerCase() === regEmail.trim().toLowerCase() && r.status === 'active'
    );
  }, [resellers, regEmail]);

  // Check if an existing request is pending
  const existingPendingRequest = useMemo(() => {
    if (!regEmail.trim()) return null;
    return (resellerRequests || []).find(
      (r) => r.email?.toLowerCase() === regEmail.trim().toLowerCase() && r.status === 'pending'
    );
  }, [resellerRequests, regEmail]);

  // Real-time lock / removal guard: if the active reseller is locked or removed by admin, immediately logout with clear notification
  useEffect(() => {
    if (currentReseller) {
      const match = (resellers || []).find(
        (r) => r.id === currentReseller.id || (r.email && r.email.toLowerCase() === currentReseller.email?.toLowerCase())
      );
      if (!match) {
        resellerLogout();
        setAuthError('Account Removed: Your reseller account has been removed by boutique administration. You no longer have access to the Reseller Portal.');
      } else if (match.isLocked || match.status === 'suspended' || match.status === 'locked') {
        resellerLogout();
        setAuthError('Account Locked: Your reseller portal access has been locked by store administration. Please contact the boutique to unlock your account.');
      }
    }
  }, [currentReseller, resellers, resellerLogout]);

  const handleGoogleResellerSignIn = async () => {
    setAuthError('');
    setUnregisteredReseller(null);
    setIsSubmittingAuth(true);
    try {
      const res = await resellerLoginWithGoogle({ mode: 'signin' });
      if (!res.success) {
        if (res.isNotRegistered) {
          setUnregisteredReseller({ email: res.email || '' });
          if (res.email) {
            setRegEmail(res.email);
          }
        }
        setAuthError(res.error || 'Google Sign-in failed for Reseller Portal.');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Google authentication error occurred.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleRequestResellerAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setRequestStatus({ type: null });

    if (!regContactName.trim()) {
      setAuthError('Contact name is required.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setAuthError('Please provide a valid Email ID to register with.');
      return;
    }
    const cleanPhone = regWhatsapp.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length < 10) {
      setAuthError('Please provide a valid 10-digit WhatsApp number.');
      return;
    }

    setIsSubmittingAuth(true);
    try {
      const res = await requestResellerAccess({
        businessName: regBusinessName.trim() || undefined,
        contactName: regContactName.trim(),
        email: regEmail.trim().toLowerCase(),
        whatsappNumber: cleanPhone,
        city: regCity.trim() || undefined,
        gstOrPan: regGst.trim() || undefined,
      });

      if (res.alreadyApproved) {
        setRequestStatus({
          type: 'approved',
          message: 'User account has been register with Neydhal clothing. proceed to login.',
        });
      } else if (res.alreadyPending) {
        setRequestStatus({
          type: 'pending',
          message: 'An access request for this email is already awaiting administrator review in the Reseller Ledger.',
        });
      } else if (res.success) {
        setRequestStatus({
          type: 'submitted',
          message: 'Your access request has been sent to the store admin. Once approved, you can proceed to login.',
        });
      } else {
        setAuthError(res.error || 'Failed to submit reseller access request.');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Error occurred while submitting request.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Portal view state
  const [activeTab, setActiveTab] = useState<
    'catalog' | 'orders' | 'cart' | 'earnings' | 'new_order' | 'addresses' | 'notifications'
  >('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  // Media download & copy states
  const [downloadingZipId, setDownloadingZipId] = useState<string | null>(null);
  const [copiedPitchId, setCopiedPitchId] = useState<string | null>(null);

  // Reseller Cart & Multi-Item Ordering Flow
  const [resellerCart, setResellerCart] = useState<ResellerCartItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('neydhal_reseller_cart');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  // Local quantity selector per product in catalog before adding (default 1)
  const [catalogCardQuantities, setCatalogCardQuantities] = useState<Record<string, number>>({});
  const [addedCartFeedbackId, setAddedCartFeedbackId] = useState<string | null>(null);

  // Persist reseller cart in local storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('neydhal_reseller_cart', JSON.stringify(resellerCart));
      } catch (e) {
        console.warn('Failed to store reseller cart:', e);
      }
    }
  }, [resellerCart]);

  const [deliveryType, setDeliveryType] = useState<'dropship'>('dropship');

  // End-customer dropship recipient fields
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string>('new');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientCity, setRecipientCity] = useState('');
  const [recipientState, setRecipientState] = useState('Tamil Nadu');
  const [recipientPincode, setRecipientPincode] = useState('');
  const [saveAddressForFuture, setSaveAddressForFuture] = useState(true);
  const [isNewAddressDefault, setIsNewAddressDefault] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [orderUtr, setOrderUtr] = useState('');
  const [isResellerPaytmOpen, setIsResellerPaytmOpen] = useState(false);
  const [pendingResellerOrderNumber, setPendingResellerOrderNumber] = useState('');
  const [orderError, setOrderError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState<Order | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Saved Addresses tab management states
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressModalMode, setAddressModalMode] = useState<'add' | 'edit'>('add');
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addrFormName, setAddrFormName] = useState('');
  const [addrFormPhone, setAddrFormPhone] = useState('');
  const [addrFormStreet, setAddrFormStreet] = useState('');
  const [addrFormCity, setAddrFormCity] = useState('');
  const [addrFormState, setAddrFormState] = useState('Tamil Nadu');
  const [addrFormPincode, setAddrFormPincode] = useState('');
  const [addrFormIsDefault, setAddrFormIsDefault] = useState(false);
  const [addrFormError, setAddrFormError] = useState('');
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressSuccessNotice, setAddressSuccessNotice] = useState<string | null>(null);

  // Reseller notifications states
  const [resellerNotifFilter, setResellerNotifFilter] = useState<'all' | 'restock' | 'order' | 'chat'>('all');

  // Auto-populate default saved address if available on initial load
  useEffect(() => {
    if (currentReseller?.savedAddresses && currentReseller.savedAddresses.length > 0) {
      const defaultAddr = currentReseller.savedAddresses.find((a) => a.isDefault) || currentReseller.savedAddresses[0];
      if (defaultAddr && (!recipientName && !recipientPhone && !recipientAddress)) {
        setSelectedSavedAddressId(defaultAddr.id);
        setRecipientName(defaultAddr.name);
        setRecipientPhone(defaultAddr.phone);
        setRecipientAddress(defaultAddr.address);
        setRecipientCity(defaultAddr.city);
        setRecipientState(defaultAddr.state || 'Tamil Nadu');
        setRecipientPincode(defaultAddr.pincode);
      }
    }
  }, [currentReseller?.savedAddresses]);

  // Order Tracking, Filtering & Management States
  const [selectedResellerOrderId, setSelectedResellerOrderId] = useState<string | null>(null);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<
    'all' | 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered' | 'Cancelled'
  >('all');
  const [copiedOrderKey, setCopiedOrderKey] = useState<string | null>(null);
  const [expandedChatOrderId, setExpandedChatOrderId] = useState<string | null>(null);

  // Notification, Chime Sound & Firestore Fallback States (matches TrackOrderModal)
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

  // Direct Firestore fallback state for reseller orders lookup
  const [firestoreOrders, setFirestoreOrders] = useState<Order[]>([]);
  const [isSearchingFirestore, setIsSearchingFirestore] = useState(false);

  // Live Firestore search fallback (matches TrackOrderModal)
  useEffect(() => {
    if (!orderSearchQuery || orderSearchQuery.trim().length < 2) {
      setFirestoreOrders([]);
      return;
    }

    let isSubscribed = true;
    setIsSearchingFirestore(true);

    const fetchFromFirestore = async () => {
      try {
        const snap = await getDocs(collection(db, 'orders'));
        if (!isSubscribed) return;
        const clean = orderSearchQuery.trim().toLowerCase();
        const cleanOrder = clean.replace(/^[#\s]+/, '').trim();
        const cleanDigits = orderSearchQuery.replace(/[^0-9]/g, '');

        const results: Order[] = [];
        snap.forEach((d) => {
          const ord = { id: d.id, ...d.data() } as Order;
          const oNum = (ord.orderNumber || '').trim().toLowerCase();
          const oNumClean = oNum.replace(/^[#\s]+/, '').trim();
          const oPhone = (ord.customer?.phone || '').replace(/[^0-9]/g, '');
          const oDropshipPhone = (ord.dropshipRecipient?.phone || '').replace(/[^0-9]/g, '');
          const oRecipientName = (ord.dropshipRecipient?.name || ord.customer?.name || '').toLowerCase();
          const oAwb = (ord.shippingDetails?.trackingNumber || '').toLowerCase();

          if (
            oNum === clean ||
            oNumClean === cleanOrder ||
            ord.upiTransactionId?.toLowerCase() === clean ||
            (cleanDigits.length >= 6 && (oPhone.includes(cleanDigits) || oDropshipPhone.includes(cleanDigits))) ||
            oRecipientName.includes(clean) ||
            oAwb.includes(clean)
          ) {
            results.push(ord);
          }
        });

        if (isSubscribed) {
          setFirestoreOrders(results);
        }
      } catch (err) {
        console.warn('Direct Firestore reseller order lookup:', err);
      } finally {
        if (isSubscribed) {
          setIsSearchingFirestore(false);
        }
      }
    };

    const timer = setTimeout(fetchFromFirestore, 350);
    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [orderSearchQuery]);

  // Deep-link live chat & order auto-selection (matches TrackOrderModal)
  useEffect(() => {
    if (activeCustomerChatOrderId) {
      const match =
        resellerOrders.find(
          (o) =>
            o.id === activeCustomerChatOrderId ||
            o.orderNumber.toUpperCase() === activeCustomerChatOrderId.toUpperCase()
        ) ||
        orders.find(
          (o) =>
            o.id === activeCustomerChatOrderId ||
            o.orderNumber.toUpperCase() === activeCustomerChatOrderId.toUpperCase()
        );
      if (match) {
        setActiveTab('orders');
        setSelectedResellerOrderId(match.id);
        setExpandedChatOrderId(match.id);
      }
      setActiveCustomerChatOrderId(null);
    }
  }, [activeCustomerChatOrderId, resellerOrders, orders, setActiveCustomerChatOrderId]);

  // Check URL query / hash for direct order deep-linking (e.g. #reseller?order=RES-9967)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = window.location.search;
    const hash = window.location.hash;
    const matchOrder = search.match(/[?&]order=([^&]+)/i) || hash.match(/[?&#]order=([^&#]+)/i);
    if (matchOrder && matchOrder[1]) {
      const orderRef = decodeURIComponent(matchOrder[1]).trim();
      setSelectedResellerOrderId(orderRef);
      setActiveTab('orders');
    }
  }, []);

  // Cancellation Request Form State
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('Customer cancelled / Event postponed');
  const [customCancelReason, setCustomCancelReason] = useState('');
  const [cancelStatusMsg, setCancelStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Issue Reporting / Dispute State
  const [reportingIssueOrder, setReportingIssueOrder] = useState<Order | null>(null);
  const [reportingIssueType, setReportingIssueType] = useState<'delivery' | 'refund'>('delivery');
  const [openIssueDropdownOrderId, setOpenIssueDropdownOrderId] = useState<string | null>(null);
  const [issueDescription, setIssueDescription] = useState(
    'End-customer reports package not received at destination address.'
  );
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [issueFeedback, setIssueFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Dropship Packaging Slip Modal State
  const [printingSlipOrder, setPrintingSlipOrder] = useState<Order | null>(null);

  const copyOrderText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedOrderKey(key);
    setTimeout(() => setCopiedOrderKey(null), 2000);
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

  // Combined reseller orders from local store, all orders, and Firestore direct lookup
  const combinedResellerOrders = useMemo(() => {
    const map = new Map<string, Order>();
    resellerOrders.forEach((o) => map.set(o.id, o));
    // Also include any RES- prefixed orders from general store orders list
    orders.forEach((o) => {
      if (
        (o.orderType === 'reseller' || o.orderNumber?.startsWith('RES-')) &&
        (!o.resellerId || !currentReseller || o.resellerId === currentReseller.id)
      ) {
        map.set(o.id, o);
      }
    });
    // Add firestore query matches
    firestoreOrders.forEach((o) => {
      map.set(o.id, o);
    });
    return Array.from(map.values());
  }, [resellerOrders, orders, firestoreOrders, currentReseller?.id]);

  // Status counts for quick filter tabs
  const orderStatusCounts = useMemo(() => {
    const counts = {
      all: combinedResellerOrders.length,
      Pending: 0,
      Confirmed: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0,
    };
    combinedResellerOrders.forEach((o) => {
      if (o.status === 'Pending') counts.Pending++;
      else if (o.status === 'Confirmed') counts.Confirmed++;
      else if (o.status === 'Shipped') counts.Shipped++;
      else if (o.status === 'Delivered') counts.Delivered++;
      else if (o.status === 'Cancelled' || o.status === 'Rejected' || o.status === 'Refunded') counts.Cancelled++;
    });
    return counts;
  }, [combinedResellerOrders]);

  // Filtered reseller orders for tracking list
  const displayedResellerOrders = useMemo(() => {
    let list = [...combinedResellerOrders];

    // Filter by status tab
    if (orderStatusFilter !== 'all') {
      if (orderStatusFilter === 'Cancelled') {
        list = list.filter((o) => o.status === 'Cancelled' || o.status === 'Rejected' || o.status === 'Refunded');
      } else {
        list = list.filter((o) => o.status === orderStatusFilter);
      }
    }

    // Filter by search query
    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.trim().toLowerCase();
      const qCleanOrder = q.replace(/^[#\s]+/, '');
      const qDigits = q.replace(/\D/g, '');
      list = list.filter((o) => {
        const oNum = o.orderNumber.toLowerCase();
        const oNumClean = oNum.replace(/^[#\s]+/, '');
        const matchNum = oNum.includes(q) || oNumClean.includes(qCleanOrder);
        const matchRecipient = (o.dropshipRecipient?.name || o.customer?.name || '').toLowerCase().includes(q);
        const matchPhone = (o.dropshipRecipient?.phone || o.customer?.phone || '').includes(
          qDigits && qDigits.length >= 4 ? qDigits : q
        );
        const matchAwb = (o.shippingDetails?.trackingNumber || '').toLowerCase().includes(q);
        const matchCourier = (o.shippingDetails?.courierName || '').toLowerCase().includes(q);
        const matchItems = o.items.some(
          (it) => it.product.title.toLowerCase().includes(q) || it.product.productCode?.toLowerCase().includes(q)
        );
        return matchNum || matchRecipient || matchPhone || matchAwb || matchCourier || matchItems;
      });
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }, [combinedResellerOrders, orderStatusFilter, orderSearchQuery]);

  // Selected order for detailed tracking view
  const selectedResellerOrder = useMemo(() => {
    if (!selectedResellerOrderId) return null;
    const clean = selectedResellerOrderId.trim().toLowerCase();
    const cleanNum = clean.replace(/^[#\s]+/, '');

    return (
      combinedResellerOrders.find(
        (o) =>
          o.id === selectedResellerOrderId ||
          o.orderNumber === selectedResellerOrderId ||
          o.id.toLowerCase() === clean ||
          (o.orderNumber || '').toLowerCase().replace(/^[#\s]+/, '') === cleanNum
      ) ||
      orders.find(
        (o) =>
          o.id === selectedResellerOrderId ||
          o.orderNumber === selectedResellerOrderId ||
          o.id.toLowerCase() === clean ||
          (o.orderNumber || '').toLowerCase().replace(/^[#\s]+/, '') === cleanNum
      ) ||
      null
    );
  }, [selectedResellerOrderId, combinedResellerOrders, orders]);

  const handleSubmitCancellation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingOrder) return;
    const finalReason =
      cancelReason === 'Other' ? customCancelReason.trim() || 'Reseller requested' : cancelReason;

    // Direct dynamic order cancellation & dynamic stock replenishment
    updateOrderStatus(cancellingOrder.id, 'Cancelled', {
      cancellationReason: `Cancelled by Reseller: ${finalReason}`,
    });
    replenishOrderInventory(cancellingOrder);

    const totalRestockedCount = cancellingOrder.items.reduce(
      (sum, it) => sum + (it.quantity || 1),
      0
    );

    setCancelStatusMsg({
      type: 'success',
      text: `Order #${cancellingOrder.orderNumber} has been cancelled successfully. ${totalRestockedCount} unit(s) of reserved saree inventory have been restocked dynamically to inventory!`,
    });
    setCancellingOrder(null);
  };

  const handleSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingIssueOrder) return;
    setIsSubmittingIssue(true);
    setIssueFeedback(null);
    try {
      const defaultDesc =
        reportingIssueType === 'refund'
          ? 'Reseller inquiry regarding margin settlement or payment reconciliation.'
          : 'End customer reports parcel non-receipt despite Shipped/Delivered status.';
      const phoneToUse = reportingIssueOrder.dropshipRecipient?.phone || reportingIssueOrder.customer.phone;
      const res = await reportCustomerDeliveryIssue(
        reportingIssueOrder.orderNumber,
        phoneToUse,
        issueDescription.trim() || defaultDesc,
        reportingIssueType
      );
      if (res.success) {
        setIssueFeedback({
          type: 'success',
          message:
            reportingIssueType === 'refund'
              ? 'Refund / margin inquiry ticket registered! Boutique concierge is reviewing.'
              : 'Delivery dispute ticket logged! Concierge is verifying with logistics carrier.',
        });
        setTimeout(() => {
          setReportingIssueOrder(null);
          setIssueFeedback(null);
        }, 2500);
      } else {
        setIssueFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setIssueFeedback({ type: 'error', message: err?.message || 'Failed to submit issue report.' });
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  if (!isOpen) return null;

  // Wholesale tier: default 20% discount if not customized
  const wholesaleDiscountRate = currentReseller?.wholesaleDiscountPercent
    ? currentReseller.wholesaleDiscountPercent / 100
    : 0.2;

  const getWholesalePrice = (retailPriceOrProduct: number | Product) => {
    if (typeof retailPriceOrProduct === 'object') {
      if (retailPriceOrProduct.wholesalePrice && retailPriceOrProduct.wholesalePrice > 0) {
        return retailPriceOrProduct.wholesalePrice;
      }
      return Math.round(retailPriceOrProduct.price * (1 - wholesaleDiscountRate));
    }
    return Math.round(retailPriceOrProduct * (1 - wholesaleDiscountRate));
  };



  const wholesaleProducts = useMemo(() => {
    return (products || []).filter((p) => p.isVisible !== false && p.isWholesaleAvailable !== false);
  }, [products]);

  // Group products by category to show counts on category catalog cards
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    wholesaleProducts.forEach((p) => {
      const cat = p.category || 'Uncategorized';
      map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  }, [wholesaleProducts]);

  // Filtered catalog for wholesale resellers
  const filteredProducts = useMemo(() => {
    return wholesaleProducts.filter((p) => {
      const matchSearch =
        !searchQuery ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.productCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.fabric?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.color?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCat =
        !selectedCat ||
        selectedCat === 'all' ||
        p.category?.toLowerCase() === selectedCat.toLowerCase() ||
        p.fabric?.toLowerCase() === selectedCat.toLowerCase();

      return matchSearch && matchCat;
    });
  }, [wholesaleProducts, searchQuery, selectedCat]);

  // Handle single / batch media downloads for resellers
  const handleDownloadImagePack = async (prod: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!prod.images || prod.images.length === 0) return;
    setDownloadingZipId(prod.id);
    try {
      await downloadAllProductImagesZip(prod.title, prod.productCode, prod.images);
    } catch (err) {
      console.error('Download pack failed:', err);
    } finally {
      setDownloadingZipId(null);
    }
  };

  // Copy WhatsApp promo pitch for reseller groups
  const handleCopyWhatsAppPitch = (prod: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const wsPrice = getWholesalePrice(prod.price);
    const suggestedRetail = prod.originalPrice || prod.price;
    const pitchText = `🌟 *NEW COLLECTION ALERT* 🌟\n\n*${prod.title}*\nFabric: ${prod.fabric || 'Pure Silk'}\nColor: ${prod.color}\nSKU Code: ${prod.productCode || 'ATELIER-101'}\n\n✨ *Special Customer Price:* ₹${suggestedRetail.toLocaleString('en-IN')}\n(Premium Handcrafted Artisan Quality)\n\n📦 *Direct Doorstep Delivery across India*\n💬 To book this piece, message back with delivery pincode!`;

    navigator.clipboard.writeText(pitchText);
    setCopiedPitchId(prod.id);
    setTimeout(() => setCopiedPitchId(null), 2500);
  };

  // Reseller Cart Actions (Dynamically constrained by product stock value)
  const addToResellerCart = (prod: Product, quantity = 1, targetResalePrice?: number) => {
    // Find current live product in inventory state for freshest stockCount
    const liveProd = products.find((p) => p.id === prod.id) || prod;
    const isOutOfStock =
      liveProd.stockStatus === 'out_of_stock' ||
      (liveProd.stockCount !== undefined && liveProd.stockCount <= 0);

    const maxStock = liveProd.stockCount !== undefined ? Math.max(0, liveProd.stockCount) : 99;

    if (isOutOfStock || maxStock <= 0) {
      return;
    }

    const defaultResale = targetResalePrice !== undefined ? targetResalePrice : liveProd.price;

    setResellerCart((prev) => {
      const idx = prev.findIndex((item) => item.product.id === liveProd.id);
      if (idx > -1) {
        const currentQty = prev[idx].quantity;
        const allowableAdd = Math.max(0, Math.min(quantity, maxStock - currentQty));
        if (allowableAdd <= 0) return prev;
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          product: liveProd,
          quantity: currentQty + allowableAdd,
          resalePrice: targetResalePrice !== undefined ? targetResalePrice : copy[idx].resalePrice,
        };
        return copy;
      }
      const initialQty = Math.min(Math.max(1, quantity), maxStock);
      return [
        ...prev,
        {
          product: liveProd,
          quantity: initialQty,
          resalePrice: defaultResale,
        },
      ];
    });

    setAddedCartFeedbackId(liveProd.id);
    setTimeout(() => {
      setAddedCartFeedbackId(null);
    }, 1800);
  };

  const updateCartQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromResellerCart(productId);
      return;
    }
    const liveProd = products.find((p) => p.id === productId);
    const maxStock = liveProd?.stockCount !== undefined ? Math.max(1, liveProd.stockCount) : 99;
    const cappedQty = Math.min(newQty, maxStock);

    setResellerCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, product: liveProd || item.product, quantity: cappedQty }
          : item
      )
    );
  };

  const updateCartResalePrice = (productId: string, price: number) => {
    const safePrice = Math.max(0, price);
    setResellerCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, resalePrice: safePrice } : item))
    );
  };

  const removeFromResellerCart = (productId: string) => {
    setResellerCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearResellerCart = () => {
    setResellerCart([]);
  };

  // Card quantity helper for catalog stepper constrained by available physical stock
  const getCardSelectedQty = (productId: string) => {
    const liveProd = products.find((p) => p.id === productId);
    const maxStock = liveProd?.stockCount !== undefined ? Math.max(0, liveProd.stockCount) : 99;
    const inCart = resellerCart.find((it) => it.product.id === productId)?.quantity || 0;
    const remainingStock = Math.max(0, maxStock - inCart);
    if (remainingStock <= 0) return 0;
    const current = catalogCardQuantities[productId] || 1;
    return Math.min(current, remainingStock);
  };

  const setCardSelectedQty = (productId: string, qty: number) => {
    const liveProd = products.find((p) => p.id === productId);
    const maxStock = liveProd?.stockCount !== undefined ? Math.max(0, liveProd.stockCount) : 99;
    const inCart = resellerCart.find((it) => it.product.id === productId)?.quantity || 0;
    const remainingStock = Math.max(0, maxStock - inCart);
    const safeQty = Math.max(1, Math.min(qty, remainingStock > 0 ? remainingStock : 1));

    setCatalogCardQuantities((prev) => ({
      ...prev,
      [productId]: safeQty,
    }));
  };

  // Reseller Cart Totals
  const totalCartItems = useMemo(() => {
    return resellerCart.reduce((sum, item) => sum + item.quantity, 0);
  }, [resellerCart]);

  const totalResellerCost = useMemo(() => {
    return resellerCart.reduce((sum, item) => {
      const unitCost = getWholesalePrice(item.product.price);
      return sum + unitCost * item.quantity;
    }, 0);
  }, [resellerCart, wholesaleDiscountRate]);

  const totalCustomerValue = useMemo(() => {
    return resellerCart.reduce((sum, item) => {
      const price = item.resalePrice || item.product.price;
      return sum + price * item.quantity;
    }, 0);
  }, [resellerCart]);

  const totalEstimatedMargin = useMemo(() => {
    return Math.max(0, totalCustomerValue - totalResellerCost);
  }, [totalCustomerValue, totalResellerCost]);

  // Quick action to add product and immediately view cart
  const handleQuickAddAndCheckout = (prod: Product, quantity = 1) => {
    addToResellerCart(prod, quantity);
    setActiveTab('cart');
    setOrderSuccess(null);
    setOrderError('');
  };

  const handlePlaceOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resellerCart.length === 0 || !currentReseller) {
      setOrderError('Your reseller cart is empty. Please add sarees from the catalog before checking out.');
      return;
    }
    setOrderError('');

    if (deliveryType === 'dropship') {
      if (!recipientName.trim()) {
        setOrderError('Please provide end-customer recipient name.');
        return;
      }
      const cleanPhone = recipientPhone.replace(/\D/g, '').slice(-10);
      if (!cleanPhone || cleanPhone.length < 10) {
        setOrderError('Please provide a valid 10-digit customer delivery phone number.');
        return;
      }
      if (!recipientAddress.trim() || !recipientCity.trim() || !recipientPincode.trim()) {
        setOrderError('Complete shipping address, city and 6-digit pincode are required for dropship.');
        return;
      }
    }

    const tempOrderNum = `RES-${Math.floor(1000 + Math.random() * 9000)}`;
    setPendingResellerOrderNumber(tempOrderNum);
    setIsResellerPaytmOpen(true);
  };

  const handleResellerPaytmSuccess = async (details: PaytmTransactionDetails) => {
    if (!currentReseller) return;
    setIsResellerPaytmOpen(false);
    setIsPlacingOrder(true);

    try {
      const cartItems: CartItem[] = resellerCart.map((item) => ({
        product: {
          ...item.product,
          price: getWholesalePrice(item.product.price), // Wholesale unit rate charged to reseller
        },
        quantity: item.quantity,
      }));

      const recipient = {
        name: recipientName.trim() || currentReseller.name,
        phone: recipientPhone.replace(/\D/g, '').slice(-10) || currentReseller.whatsappNumber,
        address: recipientAddress.trim() || currentReseller.businessName,
        city: recipientCity.trim() || currentReseller.city || 'Salem',
        state: recipientState.trim() || currentReseller.state || 'Tamil Nadu',
        pincode: recipientPincode.trim() || '636001',
      };

      // Auto-save new address if entered or saveAddressForFuture is true
      if (currentReseller && recipientName.trim() && recipientAddress.trim()) {
        const cleanPhone = recipientPhone.replace(/\D/g, '').slice(-10);
        const existingMatch = (currentReseller.savedAddresses || []).find(
          (a) =>
            a.name.toLowerCase().trim() === recipientName.toLowerCase().trim() &&
            a.address.toLowerCase().trim() === recipientAddress.toLowerCase().trim()
        );
        if (!existingMatch && saveAddressForFuture) {
          try {
            await addResellerAddress({
              name: recipientName.trim(),
              phone: cleanPhone,
              address: recipientAddress.trim(),
              city: recipientCity.trim(),
              state: recipientState.trim(),
              pincode: recipientPincode.trim(),
              isDefault: isNewAddressDefault || (currentReseller.savedAddresses || []).length === 0,
            });
          } catch (e) {
            console.warn('Could not auto-save address to reseller:', e);
          }
        } else if (existingMatch && isNewAddressDefault && !existingMatch.isDefault) {
          try {
            await setDefaultResellerAddress(existingMatch.id);
          } catch (e) {
            console.warn('Could not set default address:', e);
          }
        }
      }

      const newOrder = await placeResellerOrder({
        items: cartItems,
        dropshipRecipient: recipient,
        resellerMargin: totalEstimatedMargin,
        paymentGateway: 'paytm',
        paytmTxnId: details.txnId,
        paytmDetails: details,
        upiTransactionId: details.txnId,
        notes: `[Reseller: ${currentReseller.businessName}] ${orderNotes ? `Notes: ${orderNotes}` : ''}`,
      });

      setOrderSuccess(newOrder);
      setResellerCart([]); // Clear cart upon successful order
      setOrderUtr('');
      setRecipientName('');
      setRecipientPhone('');
      setRecipientAddress('');
      setRecipientCity('');
      setRecipientPincode('');
      setOrderNotes('');
      setIsNewAddressDefault(false);
    } catch (err: any) {
      setOrderError(err?.message || 'Failed to place reseller order after payment.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Reseller Earnings Ledger Calculation
  const totalResellerVolume = useMemo(() => {
    return resellerOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  }, [resellerOrders]);

  const totalResellerMarginEarned = useMemo(() => {
    return resellerOrders.reduce((sum, o) => sum + (o.resellerMargin || 0), 0);
  }, [resellerOrders]);

  // Address Management Handlers for Saved Addresses Tab
  const handleOpenAddAddressModal = () => {
    setAddressModalMode('add');
    setEditingAddressId(null);
    setAddrFormName('');
    setAddrFormPhone('');
    setAddrFormStreet('');
    setAddrFormCity('');
    setAddrFormState('Tamil Nadu');
    setAddrFormPincode('');
    setAddrFormIsDefault((currentReseller?.savedAddresses || []).length === 0);
    setAddrFormError('');
    setIsAddressModalOpen(true);
  };

  const handleOpenEditAddressModal = (addr: CustomerAddress) => {
    setAddressModalMode('edit');
    setEditingAddressId(addr.id);
    setAddrFormName(addr.name);
    setAddrFormPhone(addr.phone);
    setAddrFormStreet(addr.address);
    setAddrFormCity(addr.city);
    setAddrFormState(addr.state || 'Tamil Nadu');
    setAddrFormPincode(addr.pincode);
    setAddrFormIsDefault(!!addr.isDefault);
    setAddrFormError('');
    setIsAddressModalOpen(true);
  };

  const handleSaveAddressFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddrFormError('');
    if (!addrFormName.trim()) {
      setAddrFormError('Please enter full contact name.');
      return;
    }
    const cleanPhone = addrFormPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      setAddrFormError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!addrFormStreet.trim() || !addrFormCity.trim()) {
      setAddrFormError('Street address and city are required.');
      return;
    }
    const cleanPin = addrFormPincode.replace(/\D/g, '').slice(0, 6);
    if (cleanPin.length !== 6) {
      setAddrFormError('Please enter a valid 6-digit postal pincode.');
      return;
    }
    setIsSavingAddress(true);
    try {
      if (addressModalMode === 'add') {
        await addResellerAddress({
          name: addrFormName.trim(),
          phone: cleanPhone,
          address: addrFormStreet.trim(),
          city: addrFormCity.trim(),
          state: addrFormState.trim(),
          pincode: cleanPin,
          isDefault: addrFormIsDefault,
        });
        setAddressSuccessNotice('Address added to your saved addresses.');
      } else if (editingAddressId) {
        await updateResellerAddress(editingAddressId, {
          name: addrFormName.trim(),
          phone: cleanPhone,
          address: addrFormStreet.trim(),
          city: addrFormCity.trim(),
          state: addrFormState.trim(),
          pincode: cleanPin,
          isDefault: addrFormIsDefault,
        });
        setAddressSuccessNotice('Address updated successfully.');
      }
      setIsAddressModalOpen(false);
      setTimeout(() => setAddressSuccessNotice(null), 3000);
    } catch (err: any) {
      setAddrFormError(err?.message || 'Failed to save address.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (window.confirm('Are you sure you want to remove this saved address?')) {
      try {
        await deleteResellerAddress(id);
        setAddressSuccessNotice('Address removed.');
        setTimeout(() => setAddressSuccessNotice(null), 3000);
      } catch (err: any) {
        console.warn('Failed to delete address:', err);
      }
    }
  };

  const handleSetDefaultAddress = async (id: string) => {
    try {
      await setDefaultResellerAddress(id);
      setAddressSuccessNotice('Default address updated.');
      setTimeout(() => setAddressSuccessNotice(null), 3000);
    } catch (err: any) {
      console.warn('Failed to set default address:', err);
    }
  };

  // Reseller Notification Click Navigation
  const handleResellerNotificationClick = (notif: AppNotification) => {
    markResellerNotificationRead(notif.id);
    if (notif.type === 'restock') {
      setActiveTab('catalog');
      if (notif.productId) {
        const prod = products.find((p) => p.id === notif.productId);
        if (prod && onOpenProductModal) {
          onOpenProductModal(prod);
        }
      }
    } else if (notif.type === 'order') {
      setActiveTab('orders');
      if (notif.orderId) {
        setSelectedResellerOrderId(notif.orderId);
        setOrderSearchQuery(notif.orderNumber || notif.orderId);
      }
    } else if (notif.type === 'chat') {
      setActiveTab('orders');
      if (notif.orderId) {
        setExpandedChatOrderId(notif.orderId);
      }
    }
  };

  if (!isOpen) return null;

  // Dedicated Full-Page View for Unauthenticated Resellers (Sign In & Register)
  if (!currentReseller) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[#4a0e68] flex flex-col justify-between text-neutral-100 selection:bg-purple-900 selection:text-white animate-in fade-in duration-200">
        {/* Authentic Neydhal Royal Purple & Texture Background */}
        <div
          className="absolute inset-0 bg-[#4a0e68] bg-cover bg-center bg-no-repeat pointer-events-none"
          style={{
            backgroundImage: `
              radial-gradient(circle at 50% 15%, rgba(110, 20, 148, 0.72) 0%, rgba(74, 14, 104, 0.94) 55%, rgba(42, 6, 61, 0.98) 100%),
              url('${settings.logoUrl || '/assets/aistudio/Neydhal_logo_a18d5bd8.jpeg'}')
            `,
            backgroundSize: 'cover, 480px',
            backgroundPosition: 'center, center',
            backgroundRepeat: 'no-repeat, repeat',
            backgroundBlendMode: 'normal, soft-light',
          }}
        />
        {/* Ambient atmospheric glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[450px] bg-[#891bb8]/25 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-[600px] h-[400px] bg-[#f6db9e]/15 rounded-full blur-[140px] pointer-events-none" />

        {/* Top Header */}
        <header className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between border-b border-purple-300/20 shrink-0 bg-black/20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <img
              src={settings.logoUrl || '/assets/aistudio/Neydhal_logo_a18d5bd8.jpeg'}
              alt={settings.boutiqueName || 'Neydhal'}
              className="w-11 h-11 rounded-2xl object-contain bg-white/10 p-0.5 shadow-lg border border-amber-300/40"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
                  {settings.boutiqueName || 'Neydhal'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-200 border border-amber-400/30">
                  {settings.resellerLoginDisplay?.headerBadgeText || 'Reseller Portal'}
                </span>
              </div>
              <p className="text-xs text-purple-200/80 hidden sm:block">
                {settings.resellerLoginDisplay?.headerSubtitle ||
                  'Exclusive partner channel for boutiques, WhatsApp resellers & catalog dropshippers'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition cursor-pointer active:scale-95 shadow-sm"
          >
            <span>&larr; Return to Patron Store</span>
          </button>
        </header>

        {/* Main Content: Full-Page Layout with Left Perks and Right Dual Action Card */}
        <main className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 my-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: B2B Value Proposition & Reseller Perks */}
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-400/30">
                  <Sparkles className="w-3.5 h-3.5" />
                  {settings.resellerLoginDisplay?.programBadge || 'Reseller Partner Program'}
                </span>
                <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white leading-tight">
                  {settings.resellerLoginDisplay?.headline || 'Empowering Resellers & Boutiques'}
                </h2>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  {settings.resellerLoginDisplay?.description ||
                    'Join our enterprise network to source pure handcrafted silk sarees at direct weaver reseller prices with guaranteed high margins and zero dead-stock risk.'}
                </p>
              </div>

              {/* B2B Perks List */}
              <div className="space-y-3 pt-2">
                {(settings.resellerLoginDisplay?.perks && settings.resellerLoginDisplay.perks.length > 0
                  ? settings.resellerLoginDisplay.perks
                  : [
                      {
                        id: 'perk-margin',
                        title: '20% Flat Reseller Margin',
                        description: 'Instant discount applied to all Kanjivaram, Banarasi, and Chanderi sarees.',
                        iconName: 'dollar',
                      },
                      {
                        id: 'perk-dropship',
                        title: 'White-Label Blind Dropshipping',
                        description: 'We dispatch directly to your end buyers with unbranded packaging and no invoices.',
                        iconName: 'truck',
                      },
                      {
                        id: 'perk-media',
                        title: '1-Click High-Res Media Packs',
                        description: 'Download unwatermarked ZIP packs and single photos for WhatsApp & Instagram.',
                        iconName: 'download',
                      },
                      {
                        id: 'perk-support',
                        title: 'Dedicated Dispatch & Support',
                        description: 'Express DTDC & Blue Dart courier with real-time tracking links for your customers.',
                        iconName: 'shield',
                      },
                    ]
                ).map((perk, idx) => {
                  const getIcon = (iconName?: string) => {
                    switch (iconName) {
                      case 'truck':
                        return <Truck className="w-4 h-4" />;
                      case 'download':
                        return <Download className="w-4 h-4" />;
                      case 'shield':
                        return <ShieldCheck className="w-4 h-4" />;
                      case 'dollar':
                      default:
                        return <DollarSign className="w-4 h-4" />;
                    }
                  };

                  return (
                    <div
                      key={perk.id || idx}
                      className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs"
                    >
                      <span className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
                        {getIcon(perk.iconName)}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-white">{perk.title}</h4>
                        <p className="text-xs text-neutral-400 mt-0.5">{perk.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: High-Visibility Auth Card */}
            <div className="lg:col-span-7">
              <div className="bg-white text-neutral-900 rounded-3xl shadow-2xl p-6 sm:p-8 border border-white/20 relative">
                {/* Mode Switcher Tabs - Both Reseller Sign In & Register as Reseller are prominent and clearly visible */}
                <div className="flex items-center bg-neutral-100 p-1.5 rounded-2xl border border-neutral-200 mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError('');
                      setUnregisteredReseller(null);
                    }}
                    className={`flex-1 py-3 px-3 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
                      authMode === 'login'
                        ? 'bg-purple-900 text-white shadow-md'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <Store className="w-4 h-4" />
                    <span>Reseller Sign In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setAuthError('');
                      setUnregisteredReseller(null);
                    }}
                    className={`flex-1 py-3 px-3 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
                      authMode === 'register'
                        ? 'bg-purple-900 text-white shadow-md'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <Building className="w-4 h-4" />
                    <span>Register as Reseller</span>
                  </button>
                </div>

                {/* Approved Account Banner - Exact copy as requested */}
                {(requestStatus.type === 'approved' || (existingApprovedReseller && !requestStatus.type)) && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-emerald-950 space-y-3 mb-6 animate-in fade-in">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-sm text-emerald-900">
                          User account has been register with Neydhal clothing. proceed to login.
                        </p>
                        <p className="text-xs text-emerald-800 mt-1">
                          Your reseller account for <strong>{regEmail || existingApprovedReseller?.email}</strong> has been authenticated by the store administrator.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError('');
                        setRequestStatus({ type: null });
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-98"
                    >
                      <span>Proceed to Login</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Pending Request Banner */}
                {(requestStatus.type === 'pending' || (existingPendingRequest && !requestStatus.type && !existingApprovedReseller)) && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2 mb-6 animate-in fade-in">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-xs sm:text-sm text-amber-900">Access Request Pending Admin Approval</p>
                        <p className="text-xs text-amber-800 mt-0.5">
                          Your reseller access request for <strong>{regEmail || existingPendingRequest?.email}</strong> is currently pending review in the administrator's Reseller Ledger. Once approved, you can proceed to login.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Newly Submitted Banner */}
                {requestStatus.type === 'submitted' && (
                  <div className="p-4 rounded-2xl bg-purple-50 border border-purple-300 text-purple-950 space-y-2 mb-6 animate-in fade-in">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-xs sm:text-sm text-purple-900">Access Request Submitted!</p>
                        <p className="text-xs text-purple-800 mt-0.5">
                          Your application for <strong>{regEmail}</strong> has been transmitted to our administrator's Reseller Ledger. You will be able to log in once access has been approved.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Unregistered Alert Notification */}
                {unregisteredReseller && !existingApprovedReseller && (
                  <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs space-y-2.5 mb-6 animate-in fade-in">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-purple-950">Reseller Access Required</p>
                        <p className="text-[11px] text-purple-800 mt-0.5">
                          No approved B2B reseller account was found for <strong>{unregisteredReseller.email}</strong>. Resellers cannot log in without administrator authorization. Please submit a request for reseller access below.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setAuthError('');
                        setRegEmail(unregisteredReseller.email);
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-purple-900 hover:bg-purple-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-98"
                    >
                      <span>Request Access with This Email</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Error Notification */}
                {authError && !unregisteredReseller && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 mb-6 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{authError}</span>
                  </div>
                )}

                {authMode === 'login' ? (
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <h3 className="font-serif text-2xl font-bold text-neutral-900">
                        B2B Partner Sign In
                      </h3>
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        Sign in with your approved Google email to unlock reseller margins, blind dropshipping, and high-res media packs.
                      </p>
                    </div>

                    {/* Primary Action: Google Authentication for Resellers */}
                    <button
                      type="button"
                      onClick={handleGoogleResellerSignIn}
                      disabled={isSubmittingAuth}
                      className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-neutral-50 text-neutral-800 border-2 border-neutral-300 hover:border-neutral-400 font-bold text-sm flex items-center justify-center gap-3 transition shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 active:scale-98"
                    >
                      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                      </svg>
                      <span>{isSubmittingAuth ? 'Verifying Reseller Status...' : 'Sign In with Google (Reseller ID)'}</span>
                    </button>

                    <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1">
                      <p className="text-xs text-purple-900 font-bold flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-purple-800" />
                        <span>Admin Authentication Required</span>
                      </p>
                      <p className="text-[11px] text-neutral-500 leading-relaxed">
                        {settings.resellerLoginDisplay?.adminNote ||
                          'Resellers cannot log in without administrator authorization. Once your access request is approved on the admin Reseller Ledger, your account is saved in the database for instant authentication.'}
                      </p>
                    </div>

                    <div className="text-center pt-2">
                      <p className="text-xs text-neutral-600">
                        Need reseller access?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('register');
                            setAuthError('');
                            setUnregisteredReseller(null);
                          }}
                          className="text-purple-900 hover:text-purple-700 font-bold underline cursor-pointer"
                        >
                          Request reseller access now &rarr;
                        </button>
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleRequestResellerAccessSubmit} className="space-y-4">
                    <div className="space-y-1 pb-1">
                      <h3 className="font-serif text-2xl font-bold text-neutral-900">
                        Request Reseller Access
                      </h3>
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        Fill in your enterprise details below. Once approved on the Reseller Ledger, your account will be activated with Neydhal clothing.
                      </p>
                    </div>

                    {/* Reseller Business Name: optional, no asterisk, no (optional) */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                        Reseller Business Name
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                          <Building className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          value={regBusinessName}
                          onChange={(e) => setRegBusinessName(e.target.value)}
                          placeholder="e.g. Sri Meenakshi Saree Collections"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-900/30 focus:border-purple-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                          Contact Name *
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                            <User className="w-4 h-4" />
                          </span>
                          <input
                            type="text"
                            required
                            value={regContactName}
                            onChange={(e) => setRegContactName(e.target.value)}
                            placeholder="Proprietor / Partner Name"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-900/30 focus:border-purple-900"
                          />
                        </div>
                      </div>

                      {/* Email ID: Added column as requested */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                          Email ID *
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                            <Mail className="w-4 h-4" />
                          </span>
                          <input
                            type="email"
                            required
                            value={regEmail}
                            onChange={(e) => {
                              setRegEmail(e.target.value);
                              if (requestStatus.type) setRequestStatus({ type: null });
                            }}
                            placeholder="partner@example.com"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-900/30 focus:border-purple-900"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                          WhatsApp Number *
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                            <Phone className="w-4 h-4" />
                          </span>
                          <input
                            type="tel"
                            required
                            maxLength={10}
                            value={regWhatsapp}
                            onChange={(e) => setRegWhatsapp(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            placeholder="10-digit mobile number"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-900/30 focus:border-purple-900"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                          City / Location
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                            <MapPin className="w-4 h-4" />
                          </span>
                          <input
                            type="text"
                            value={regCity}
                            onChange={(e) => setRegCity(e.target.value)}
                            placeholder="e.g. Madurai, Salem"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-900/30 focus:border-purple-900"
                          />
                        </div>
                      </div>
                    </div>

                    {/* GST or PAN: removed (optional) */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                        GST or PAN
                      </label>
                      <input
                        type="text"
                        value={regGst}
                        onChange={(e) => setRegGst(e.target.value)}
                        placeholder="33AAAAA0000A1Z5 / PAN"
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-900/30 focus:border-purple-900"
                      />
                    </div>

                    {/* Request Reseller Access Button */}
                    <button
                      type="submit"
                      disabled={isSubmittingAuth}
                      className="w-full py-3.5 px-4 rounded-2xl bg-purple-900 hover:bg-purple-800 text-white font-bold text-sm flex items-center justify-center gap-2.5 transition shadow-md hover:shadow-lg cursor-pointer disabled:opacity-50 active:scale-98 mt-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>{isSubmittingAuth ? 'Submitting Access Request...' : 'Request Reseller Access'}</span>
                    </button>

                    <div className="text-center pt-2">
                      <p className="text-xs text-neutral-600">
                        Already approved as reseller?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('login');
                            setAuthError('');
                            setUnregisteredReseller(null);
                          }}
                          className="text-purple-900 hover:text-purple-700 font-bold underline cursor-pointer"
                        >
                          Sign In with Google &rarr;
                        </button>
                      </p>
                    </div>
                  </form>
                )}

                {/* Return to Customer Login */}
                <div className="pt-4 mt-4 text-center border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-xs text-neutral-500 hover:text-purple-900 transition font-medium cursor-pointer"
                  >
                    Not a reseller? Return to Patron / Retail Storefront &rarr;
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Full-Page Footer */}
        <footer className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-purple-300/70 border-t border-white/10">
          <p>
            &copy; {new Date().getFullYear()} {settings.boutiqueName || 'Aara Heritage'}. Enterprise B2B Reseller Network. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="hover:text-white transition cursor-pointer"
            >
              Patron Retail Store
            </button>
            <span>&bull;</span>
            <span>Direct Concierge Dispatch</span>
          </div>
        </footer>
      </div>
    );
  }

  // Authenticated Reseller Portal: Full-Page Layout
  return (
    <div className="min-h-screen w-full bg-neutral-100 flex flex-col text-neutral-900 animate-in fade-in duration-200">
      {/* Top Reseller Brand Ribbon */}
      <div className="bg-gradient-to-r from-purple-950 via-neutral-900 to-indigo-950 text-white p-5 sm:p-6 shrink-0 relative border-b border-purple-800/40">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 pr-2">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={settings.boutiqueName || 'Reseller Portal'}
                  className="w-12 h-12 rounded-2xl object-contain bg-white/10 p-1 shadow-md border border-purple-400/30 shrink-0"
                />
              ) : (
                <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white flex items-center justify-center shadow-md border border-purple-400/30 shrink-0">
                  <Store className="w-6 h-6" />
                </span>
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-2xl font-serif font-bold text-white tracking-tight">
                    {currentReseller.businessName}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/30 text-purple-200 border border-purple-400/30">
                    Reseller Hub
                  </span>
                </div>
                <p className="text-xs text-neutral-300 mt-0.5">
                  Logged in: {currentReseller.name} &middot; WhatsApp: +91 {currentReseller.whatsappNumber} &middot; Tier: {currentReseller.wholesaleDiscountPercent}% Reseller Margin
                </p>
              </div>
            </div>

            {/* Top Right Action Controls: Logout, Return to Patron Store, Close */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap sm:flex-nowrap justify-end z-10">
              <button
                type="button"
                onClick={resellerLogout}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs whitespace-nowrap active:scale-95"
                title="Sign out of Reseller session"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Reseller Logout</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap active:scale-95"
                title="Return to Customer Store"
              >
                <span>&larr; Patron Store</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition cursor-pointer active:scale-95"
                aria-label="Close portal"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation Bar if Authenticated */}
          <div className="flex items-center gap-2 mt-5 overflow-x-auto no-scrollbar border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={() => {
                setActiveTab('catalog');
                setSelectedCat(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-neutral-300 hover:text-white bg-white/5'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Reseller Catalog ({wholesaleProducts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cart')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer relative ${
                activeTab === 'cart' || activeTab === 'new_order'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-neutral-300 hover:text-white bg-white/5'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Reseller Cart</span>
              {totalCartItems > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-purple-950 shadow-xs">
                  {totalCartItems}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-neutral-300 hover:text-white bg-white/5'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>My Dropships & Orders ({resellerOrders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('earnings')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'earnings'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-neutral-300 hover:text-white bg-white/5'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Margin Earnings</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('addresses')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'addresses'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-neutral-300 hover:text-white bg-white/5'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Saved Addresses ({currentReseller.savedAddresses?.length || 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer relative ${
                activeTab === 'notifications'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-neutral-300 hover:text-white bg-white/5'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Notifications</span>
              {(resellerNotifications || []).filter((n) => !n.isRead).length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-xs animate-pulse">
                  {(resellerNotifications || []).filter((n) => !n.isRead).length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Authenticated Reseller Content Body */}
      <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-neutral-50/50 max-w-7xl mx-auto w-full">
            {/* TAB 1: RESELLER CATALOG & MEDIA PACKS */}
            {activeTab === 'catalog' && (
              <div className="space-y-4">
                {/* 1. Category Catalog Cards Overview (When no category is selected and no search query) */}
                {!selectedCat && !searchQuery.trim() ? (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Header Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-2xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-900 flex items-center justify-center font-bold">
                            <Layers className="w-4 h-4 text-purple-800" />
                          </span>
                          <h3 className="font-serif font-bold text-base sm:text-lg text-neutral-900">
                            Reseller Category Catalog
                          </h3>
                        </div>
                        <p className="text-xs text-neutral-500">
                          Click any category below to open collection, view reseller pricing, download HD photo packs & dropship.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <div className="relative w-full sm:w-64">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                            <Search className="w-4 h-4" />
                          </span>
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search all reseller sarees..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:ring-1 focus:ring-purple-700 bg-neutral-50/50"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedCat('all')}
                          className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold whitespace-nowrap transition cursor-pointer"
                        >
                          View All ({wholesaleProducts.length})
                        </button>
                      </div>
                    </div>

                    {/* Category Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {categories.map((category) => {
                        const count =
                          categoryCounts[category.name] ??
                          wholesaleProducts.filter(
                            (p) =>
                              p.category?.toLowerCase() === category.name.toLowerCase() ||
                              p.fabric?.toLowerCase() === category.name.toLowerCase()
                          ).length;

                        const previewImg =
                          category.imageUrl ||
                          wholesaleProducts.find(
                            (p) =>
                              p.category?.toLowerCase() === category.name.toLowerCase() ||
                              p.fabric?.toLowerCase() === category.name.toLowerCase()
                          )?.images[0] ||
                          '/assets/images/hero_saree_atelier_1791651761357.jpg';

                        return (
                          <div
                            key={category.id}
                            onClick={() => {
                              setSelectedCat(category.name);
                              setSearchQuery('');
                            }}
                            className="group relative bg-white rounded-2xl border border-neutral-200/90 overflow-hidden shadow-2xs hover:shadow-xl hover:border-purple-300 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                          >
                            {/* Visual Category Preview Image */}
                            <div className="relative aspect-16/10 sm:aspect-4/3 w-full overflow-hidden bg-neutral-900 flex items-center justify-center">
                              <img
                                src={previewImg}
                                alt={category.name}
                                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 z-10 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent pointer-events-none" />

                              {/* Reseller Margin Badge */}
                              <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
                                <span className="px-2.5 py-1 rounded-full bg-purple-900/90 text-white text-[10px] font-bold backdrop-blur-xs shadow-md border border-purple-400/30 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
                                  <span>{currentReseller.wholesaleDiscountPercent}% Reseller Margin</span>
                                </span>
                              </div>

                              {/* Saree Count Pill */}
                              <div className="absolute top-3 right-3 z-20 bg-white/95 backdrop-blur-md text-neutral-900 text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                                {count} {count === 1 ? 'Saree' : 'Sarees'}
                              </div>

                              {/* Category Title & Labels Overlay */}
                              <div className="absolute inset-x-0 bottom-0 z-20 p-4 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent text-white pointer-events-none">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300 drop-shadow block">
                                  Reseller Catalog
                                </span>
                                <h4 className="font-serif font-bold text-lg sm:text-xl text-white group-hover:text-amber-200 transition drop-shadow-md">
                                  {category.name}
                                </h4>
                              </div>
                            </div>

                            {/* Category Card Footer */}
                            <div className="p-4 bg-white flex items-center justify-between text-xs border-t border-neutral-100">
                              <p className="text-neutral-500 line-clamp-1 pr-2 text-[11px]">
                                {category.description || 'Authentic pure handloom weave with tested quality.'}
                              </p>
                              <span className="text-purple-900 font-bold inline-flex items-center gap-1 shrink-0 group-hover:translate-x-1 transition-transform">
                                <span>Open Collection</span>
                                <ArrowRight className="w-3.5 h-3.5 text-purple-700" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* 2. Open Category Saree Catalog View */
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Header Bar with Back Button and Quick Switcher */}
                    <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCat(null);
                              setSearchQuery('');
                            }}
                            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-purple-900 hover:text-purple-950 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 transition cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4 text-purple-800" />
                            <span>&larr; Back to Categories</span>
                          </button>

                          <div>
                            <h3 className="font-serif font-bold text-base sm:text-lg text-neutral-900 leading-tight">
                              {selectedCat === 'all'
                                ? 'All Reseller Sarees'
                                : selectedCat
                                ? `${selectedCat} Collection`
                                : 'Search Results'}
                            </h3>
                            <p className="text-[11px] text-neutral-500">
                              Showing {filteredProducts.length} {filteredProducts.length === 1 ? 'saree' : 'sarees'} with {currentReseller.wholesaleDiscountPercent}% reseller margin
                            </p>
                          </div>
                        </div>

                        {/* In-category Search Input */}
                        <div className="relative w-full sm:w-72">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                            <Search className="w-4 h-4" />
                          </span>
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={`Search ${selectedCat && selectedCat !== 'all' ? selectedCat : 'sarees'}...`}
                            className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:ring-1 focus:ring-purple-700 bg-neutral-50/50"
                          />
                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchQuery('')}
                              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-neutral-400 hover:text-neutral-600 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Horizontal Category Switcher */}
                      <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-neutral-100 no-scrollbar">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCat(null);
                            setSearchQuery('');
                          }}
                          className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition bg-neutral-100 text-neutral-700 hover:bg-neutral-200 cursor-pointer"
                        >
                          &larr; Categories Grid
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCat('all')}
                          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                            selectedCat === 'all'
                              ? 'bg-purple-900 text-white'
                              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                          }`}
                        >
                          All Sarees ({wholesaleProducts.length})
                        </button>
                        {categories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedCat(cat.name)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                              selectedCat === cat.name
                                ? 'bg-purple-900 text-white'
                                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                            }`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Empty State if no products match */}
                    {filteredProducts.length === 0 ? (
                      <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200 space-y-3">
                        <Package className="w-10 h-10 text-neutral-300 mx-auto" />
                        <h4 className="font-serif font-bold text-base text-neutral-900">
                          No sarees found
                        </h4>
                        <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                          There are currently no active sarees matching your filters in this category.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCat(null);
                            setSearchQuery('');
                          }}
                          className="px-4 py-2 rounded-xl bg-purple-900 text-white text-xs font-bold cursor-pointer"
                        >
                          Return to Categories
                        </button>
                      </div>
                    ) : (
                      /* Saree Product Cards Grid */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredProducts.map((prod) => {
                          // Look up real-time live product from context to guarantee freshest stock count
                          const liveProd = products.find((p) => p.id === prod.id) || prod;
                          const wholesalePrice = getWholesalePrice(liveProd.price);
                          const retailPrice = liveProd.price;
                          const estimatedMargin = retailPrice - wholesalePrice;

                          // Dynamic stock states
                          const isOutOfStock =
                            liveProd.stockStatus === 'out_of_stock' ||
                            (liveProd.stockCount !== undefined && liveProd.stockCount <= 0);

                          const isRestocked = isProductRestocked(liveProd, settings?.restockTagDurationHours) && !isOutOfStock;
                          const restockTimeLeft = isRestocked ? getRestockRemainingTime(liveProd, settings?.restockTagDurationHours) : null;

                          const maxStock = liveProd.stockCount !== undefined ? Math.max(0, liveProd.stockCount) : 99;
                          const inCartItem = resellerCart.find((it) => it.product.id === liveProd.id);
                          const inCartQty = inCartItem?.quantity || 0;
                          const remainingStock = Math.max(0, maxStock - inCartQty);
                          const cardQty = getCardSelectedQty(liveProd.id);

                          return (
                            <div
                              key={liveProd.id}
                              className={`bg-white rounded-2xl border overflow-hidden shadow-2xs hover:shadow-md transition flex flex-col justify-between ${
                                isOutOfStock ? 'border-neutral-300 opacity-90' : 'border-neutral-200'
                              }`}
                            >
                              <div>
                                {/* Image Thumbnail with Stock Badges, Restocked Indicator & Out of Stock Overlay */}
                                <div className="relative aspect-4/3 bg-neutral-100 overflow-hidden group">
                                  <img
                                    src={liveProd.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                                    alt={liveProd.title}
                                    className={`w-full h-full object-cover transition-transform duration-300 ${
                                      isOutOfStock ? 'grayscale opacity-60' : 'group-hover:scale-105'
                                    }`}
                                  />

                                  {/* Top Left: Reseller Tier Discount Tag & Restocked Badge */}
                                  <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1">
                                    <span className="px-2 py-0.5 rounded-full bg-purple-900/90 text-white text-[10px] font-bold backdrop-blur-xs shadow-xs border border-purple-400/30">
                                      Reseller: {currentReseller.wholesaleDiscountPercent}% OFF
                                    </span>
                                    {isRestocked && (
                                      <span 
                                        title={restockTimeLeft ? `Restocked! Expires in ${restockTimeLeft}` : 'Restocked'}
                                        className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1 border border-emerald-400 animate-in fade-in"
                                      >
                                        <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
                                        <span>Restocked</span>
                                        {restockTimeLeft && (
                                          <span className="text-[9px] bg-emerald-700/80 px-1 py-0.2 rounded-full font-mono normal-case">
                                            {restockTimeLeft}
                                          </span>
                                        )}
                                      </span>
                                    )}
                                  </div>

                                  {/* Top Right: Quantity Available Stock Badge on Product Image */}
                                  <div className="absolute top-2 right-2 z-10">
                                    {isOutOfStock ? (
                                      <span className="px-2.5 py-1 rounded-full bg-rose-900/90 text-rose-100 text-[10px] font-bold border border-rose-500/50 backdrop-blur-xs shadow-sm flex items-center gap-1">
                                        <Ban className="w-3 h-3 text-rose-300" />
                                        <span>0 Available · Sold Out</span>
                                      </span>
                                    ) : liveProd.stockCount !== undefined && liveProd.stockCount <= 3 ? (
                                      <span className="px-2.5 py-1 rounded-full bg-amber-500 text-neutral-950 text-[10px] font-black shadow-sm flex items-center gap-1.5 border border-amber-300">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                                        <span>Only {liveProd.stockCount} Left</span>
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-1 rounded-full bg-white/95 text-neutral-900 text-[10px] font-bold shadow-sm border border-neutral-200 backdrop-blur-xs flex items-center gap-1">
                                        <Package className="w-3 h-3 text-purple-700" />
                                        <span>{liveProd.stockCount !== undefined ? `${liveProd.stockCount} Available` : 'In Stock'}</span>
                                      </span>
                                    )}
                                  </div>

                                  {/* Center Out of Stock Overlay */}
                                  {isOutOfStock && (
                                    <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-[2px] flex flex-col items-center justify-center p-3 text-center z-20">
                                      <span className="px-3.5 py-1.5 rounded-full bg-rose-600 text-white text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5 border border-rose-400">
                                        <Ban className="w-4 h-4" />
                                        <span>Out of Stock</span>
                                      </span>
                                      <span className="text-[11px] text-rose-200 mt-1.5 font-medium">
                                        Sold Out · Dynamic restock on cancellation
                                      </span>
                                    </div>
                                  )}

                                  {/* Download All Images Pack Button */}
                                  <button
                                    type="button"
                                    onClick={(e) => handleDownloadImagePack(liveProd, e)}
                                    disabled={downloadingZipId === liveProd.id}
                                    className="absolute bottom-2 right-2 z-10 px-2.5 py-1.5 rounded-xl bg-black/80 hover:bg-black text-white text-[11px] font-bold backdrop-blur-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    title="Download complete high-res photo pack in ZIP"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>
                                      {downloadingZipId === liveProd.id ? 'Packaging...' : 'Download HD Pack (.ZIP)'}
                                    </span>
                                  </button>
                                </div>

                                <div className="p-4 space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                                      {liveProd.fabric || liveProd.category}
                                    </span>
                                    <span className="font-mono text-[10px] font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                                      {liveProd.productCode}
                                    </span>
                                  </div>

                                  <h3 className="font-serif font-bold text-sm text-neutral-900 leading-tight">
                                    {liveProd.title}
                                  </h3>

                                  {/* Number of Quantity Available Display */}
                                  <div className="flex items-center justify-between text-xs py-1 border-y border-neutral-100">
                                    <span className="text-[11px] text-neutral-500 font-medium">Quantity Available:</span>
                                    {isOutOfStock ? (
                                      <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                                        <Ban className="w-3 h-3" />
                                        <span>0 units (Out of Stock)</span>
                                      </span>
                                    ) : liveProd.stockCount !== undefined && liveProd.stockCount <= 3 ? (
                                      <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                        <span>Only {liveProd.stockCount} units available</span>
                                      </span>
                                    ) : (
                                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                                        <span>{liveProd.stockCount !== undefined ? `${liveProd.stockCount} units in stock` : 'In Stock'}</span>
                                      </span>
                                    )}
                                  </div>

                                  {/* Pricing & Margin Card */}
                                  <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100 flex items-center justify-between">
                                    <div>
                                      <span className="block text-[10px] text-purple-700 font-semibold uppercase">
                                        Your Reseller Cost
                                      </span>
                                      <span className="text-sm font-bold text-purple-950">
                                        {formatPrice(wholesalePrice)}
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <span className="block text-[10px] text-neutral-500">
                                        Retail MRP: {formatPrice(retailPrice)}
                                      </span>
                                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                        +₹{estimatedMargin.toLocaleString('en-IN')} Margin
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Public Front Quantity Selector & Add to Reseller Cart */}
                              <div className="p-4 pt-0 space-y-2 border-t border-neutral-100 mt-2">
                                {/* Copy Pitch & Cart Status Bar */}
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => handleCopyWhatsAppPitch(liveProd, e)}
                                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                                    title="Copy ready-to-share product description for WhatsApp"
                                  >
                                    {copiedPitchId === liveProd.id ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span className="text-emerald-700">Copied Pitch!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Copy WhatsApp Pitch</span>
                                      </>
                                    )}
                                  </button>
                                  {inCartItem && (
                                    <button
                                      type="button"
                                      onClick={() => setActiveTab('cart')}
                                      className="px-2.5 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                                      title="View in Reseller Cart"
                                    >
                                      <ShoppingCart className="w-3.5 h-3.5 text-purple-700" />
                                      <span>In Cart ({inCartItem.quantity})</span>
                                    </button>
                                  )}
                                </div>

                                {/* Quantity Stepper & Add to Reseller Cart Action */}
                                <div className="flex items-center gap-2">
                                  {/* Quantity Stepper (Stock constrained) */}
                                  <div className="flex items-center border border-neutral-200 rounded-xl bg-neutral-50 shadow-2xs overflow-hidden shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const current = getCardSelectedQty(liveProd.id);
                                        if (current > 1) setCardSelectedQty(liveProd.id, current - 1);
                                      }}
                                      disabled={isOutOfStock || remainingStock <= 0 || cardQty <= 1}
                                      className="p-2 hover:bg-neutral-200 text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                                      aria-label="Decrease quantity"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="px-2 text-xs font-bold tabular-nums text-neutral-800 min-w-5 text-center">
                                      {isOutOfStock || remainingStock <= 0 ? 0 : cardQty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const current = getCardSelectedQty(liveProd.id);
                                        if (current < remainingStock) {
                                          setCardSelectedQty(liveProd.id, current + 1);
                                        }
                                      }}
                                      disabled={isOutOfStock || remainingStock <= 0 || cardQty >= remainingStock}
                                      className="p-2 hover:bg-neutral-200 text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                                      aria-label="Increase quantity"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>

                                  {/* Add to Reseller Cart Button */}
                                  <button
                                    type="button"
                                    disabled={isOutOfStock || remainingStock <= 0}
                                    onClick={() => {
                                      const qtyToAdd = Math.min(cardQty, remainingStock);
                                      if (qtyToAdd > 0) {
                                        addToResellerCart(liveProd, qtyToAdd);
                                      }
                                    }}
                                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs ${
                                      isOutOfStock
                                        ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed border border-neutral-300'
                                        : remainingStock <= 0
                                        ? 'bg-purple-100 text-purple-900 cursor-not-allowed border border-purple-200'
                                        : addedCartFeedbackId === liveProd.id
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-purple-900 hover:bg-purple-800 text-white cursor-pointer active:scale-98'
                                    }`}
                                  >
                                    {isOutOfStock ? (
                                      <>
                                        <Ban className="w-3.5 h-3.5" />
                                        <span>Out of Stock</span>
                                      </>
                                    ) : remainingStock <= 0 ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-purple-700" />
                                        <span>All in Cart ({inCartQty})</span>
                                      </>
                                    ) : addedCartFeedbackId === liveProd.id ? (
                                      <>
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Added ({cardQty})!</span>
                                      </>
                                    ) : (
                                      <>
                                        <ShoppingCart className="w-3.5 h-3.5" />
                                        <span>Add to Cart</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Sticky Reseller Cart Quick-Bar (shown when items exist in cart) */}
                    {totalCartItems > 0 && (
                      <div className="sticky bottom-4 z-30 mt-6 max-w-4xl mx-auto bg-gradient-to-r from-purple-950 via-neutral-900 to-indigo-950 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-purple-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom-3 duration-300">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-400 text-purple-950 flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                            <ShoppingCart className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                              <span>Reseller Cart: {totalCartItems} {totalCartItems === 1 ? 'Saree' : 'Sarees'}</span>
                              <span className="text-amber-300 font-extrabold">&bull; {formatPrice(totalResellerCost)}</span>
                            </p>
                            <p className="text-[11px] text-purple-200">
                              Estimated Reseller Margin: <strong className="text-emerald-300 font-bold">+₹{totalEstimatedMargin.toLocaleString('en-IN')}</strong>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={() => clearResellerCart()}
                            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-neutral-200 transition cursor-pointer"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('cart')}
                            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-purple-950 text-xs font-bold transition shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap"
                          >
                            <span>Proceed to Cart & Checkout &rarr;</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: RESELLER ORDER TRACKING & DROPSHIPS */}
            {activeTab === 'orders' && (
              <div className="space-y-4">
                {/* Header & New Dropship Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-2xs">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-neutral-900 font-serif">
                        Reseller Dropships & Consignment Tracking
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                        {combinedResellerOrders.length} {combinedResellerOrders.length === 1 ? 'Order' : 'Orders'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Live dispatch transit, stage progression & boutique concierge chat for reseller: <strong>{currentReseller.businessName}</strong> ({currentReseller.id})
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Device Notification Bell Button (matches TrackOrderModal) */}
                    <button
                      type="button"
                      onClick={handleEnableNotifications}
                      disabled={isRequestingPermission}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                        notificationPermission === 'granted'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-white hover:bg-neutral-100 text-neutral-700 border-neutral-300'
                      }`}
                      title="Enable desktop & mobile notifications for real-time order and chat updates"
                    >
                      <Bell className={`w-3.5 h-3.5 ${notificationPermission === 'granted' ? 'text-emerald-600' : 'text-neutral-500'}`} />
                      <span className="hidden sm:inline">
                        {notificationPermission === 'granted' ? 'Alerts Active' : 'Enable Alerts'}
                      </span>
                    </button>

                    {/* Sound Chime & Haptic Test Button (matches TrackOrderModal) */}
                    <button
                      type="button"
                      onClick={handleTestSound}
                      className="p-2 rounded-xl bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-300 transition cursor-pointer"
                      title="Test sound chime and haptic feedback"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-neutral-700" />
                    </button>

                    {selectedResellerOrderId && (
                      <button
                        type="button"
                        onClick={() => setSelectedResellerOrderId(null)}
                        className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to All Orders</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTab('new_order')}
                      className="px-4 py-2 rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <span>+ Place New Dropship</span>
                    </button>
                  </div>
                </div>

                {headerNotice && (
                  <div className="p-3 rounded-xl bg-purple-900 text-white text-xs font-medium animate-in fade-in flex items-center gap-2">
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
                    VIEW 1: LIST VIEW (when selectedResellerOrderId === null)
                   ========================================================================= */}
                {!selectedResellerOrder ? (
                  <div className="space-y-4">
                    {/* Search & Status Filters */}
                    <div className="bg-white p-4 rounded-2xl border border-neutral-200 space-y-3 shadow-2xs">
                      {/* Search Bar with Submit Button & Clear */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          // If search matches single order directly, auto-select it
                          if (displayedResellerOrders.length === 1) {
                            setSelectedResellerOrderId(displayedResellerOrders[0].id);
                          }
                        }}
                        className="flex gap-2"
                      >
                        <div className="relative flex-1">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                          <input
                            type="text"
                            value={orderSearchQuery}
                            onChange={(e) => setOrderSearchQuery(e.target.value)}
                            placeholder="Search Order # (e.g. RES-9967), customer name, phone, saree, or AWB tracking..."
                            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-neutral-300 bg-white text-xs sm:text-sm text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500/40"
                          />
                          {orderSearchQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setOrderSearchQuery('');
                                setFirestoreOrders([]);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                              title="Clear search"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-purple-900 hover:bg-purple-800 text-white font-semibold text-xs sm:text-sm transition whitespace-nowrap cursor-pointer shadow-2xs"
                        >
                          Search
                        </button>
                      </form>

                      {/* Results & Status Summary Bar (matches TrackOrderModal) */}
                      <div className="flex items-center justify-between pt-1 text-xs text-neutral-600">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-800">
                            {orderSearchQuery
                              ? `Search Results for "${orderSearchQuery}"`
                              : 'Your Placed Dropship Orders'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[11px] font-bold">
                            {displayedResellerOrders.length}
                          </span>
                        </div>

                        {orderSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setOrderSearchQuery('');
                              setFirestoreOrders([]);
                            }}
                            className="text-purple-900 hover:underline font-semibold text-xs cursor-pointer"
                          >
                            Clear Filter
                          </button>
                        )}
                      </div>

                      {/* Firestore Live Search Spinner */}
                      {isSearchingFirestore && (
                        <div className="py-2 flex items-center gap-2 text-xs text-purple-800 bg-purple-50 px-3 rounded-xl border border-purple-200">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-700 shrink-0" />
                          <span>Searching live boutique database for dropship records...</span>
                        </div>
                      )}

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
                                  ? 'bg-purple-900 text-white shadow-xs'
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

                      {/* Boutique Policy Notice */}
                      <div className="p-3 rounded-xl bg-purple-50/80 border border-purple-200 text-purple-950 flex items-center gap-2 text-xs">
                        <AlertCircle className="w-4 h-4 text-purple-700 shrink-0" />
                        <p className="leading-tight">
                          <strong>Boutique Dropship Policy:</strong> Discreet unbranded plain packaging with zero boutique retail tags. Cancellations accepted only prior to dispatch/shipping. Click on any dropship order below for live delivery progression, courier lookup & direct concierge chat.
                        </p>
                      </div>
                    </div>

                    {/* Orders List Cards */}
                    {displayedResellerOrders.length === 0 ? (
                      <div className="text-center py-14 bg-white rounded-2xl border border-neutral-200 p-8 space-y-3">
                        <Package className="w-12 h-12 text-neutral-300 mx-auto" />
                        <h4 className="font-serif font-bold text-neutral-800 text-base">
                          {orderSearchQuery || orderStatusFilter !== 'all'
                            ? 'No Orders Match Your Filters'
                            : 'No Dropship Orders Placed Yet'}
                        </h4>
                        <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                          {orderSearchQuery || orderStatusFilter !== 'all'
                            ? 'Try clearing your search query or switching to another status filter.'
                            : 'Browse the reseller catalog, share saree pitches on WhatsApp, and place your first dropship order.'}
                        </p>
                        {orderSearchQuery || orderStatusFilter !== 'all' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOrderSearchQuery('');
                              setOrderStatusFilter('all');
                            }}
                            className="px-4 py-2 rounded-xl bg-neutral-900 text-white font-bold text-xs cursor-pointer"
                          >
                            Reset Filters
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('catalog');
                              setSelectedCat(null);
                            }}
                            className="px-4 py-2 rounded-xl bg-purple-900 text-white font-bold text-xs cursor-pointer"
                          >
                            Browse Reseller Catalog
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {displayedResellerOrders.map((ord) => {
                          const badge = getStatusBadge(ord.status);
                          const StatusIcon = badge.icon;
                          const itemCount = ord.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
                          const hasActiveDispute = Boolean(
                            ord.deliveryIssue?.reported && ord.deliveryIssue.status !== 'resolved'
                          );
                          const hasUnreadChat = Boolean(
                            ord.chatMessages?.some((m) => !m.readByCustomer && m.sender !== 'customer')
                          );

                          // Resolve courier details and direct link
                          const courier = resolveCourierDetails(ord.shippingDetails?.courierName, settings.courierServices);
                          const trackingUrl = buildCourierTrackingUrl(
                            courier,
                            ord.shippingDetails?.courierName,
                            ord.shippingDetails?.trackingNumber
                          );

                          return (
                            <div
                              key={ord.id}
                              onClick={() => setSelectedResellerOrderId(ord.id)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  setSelectedResellerOrderId(ord.id);
                                }
                              }}
                              className="group w-full text-left p-4 sm:p-5 rounded-2xl border border-neutral-200 bg-white hover:border-purple-400 hover:shadow-md transition-all duration-200 cursor-pointer relative overflow-hidden focus:outline-hidden focus:ring-2 focus:ring-purple-500/40"
                            >
                              {/* Status Accent Left Strip */}
                              <div
                                className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                                  ord.status === 'Delivered' || ord.status === 'Refunded'
                                    ? 'bg-emerald-500'
                                    : ord.status === 'Shipped'
                                    ? 'bg-blue-500'
                                    : ord.status === 'Confirmed'
                                    ? 'bg-purple-500'
                                    : ord.status === 'Cancelled' || ord.status === 'Rejected'
                                    ? 'bg-rose-500'
                                    : 'bg-amber-500'
                                }`}
                              />

                              {/* Top Card Row: Order ID, Date, Badges, Financials */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-xs sm:text-sm text-purple-950 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                                    #{ord.orderNumber}
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                                    Reseller Dropship
                                  </span>

                                  {/* Payment Verified Badge */}
                                  {ord.paymentGateway === 'paytm' || ord.paytmTxnId ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#002970]/10 text-[#002970] border border-[#00BAF2]/40 shadow-2xs">
                                      <ShieldCheck className="w-3 h-3 text-[#00BAF2]" />
                                      <span>Paytm Verified</span>
                                      <span className="px-1 rounded bg-emerald-600 text-white text-[9px] font-extrabold uppercase">PAID</span>
                                    </span>
                                  ) : ord.upiTransactionId ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                      <span>Prepaid</span>
                                    </span>
                                  ) : null}

                                  {/* Status Pill */}
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.bg}`}
                                  >
                                    <StatusIcon className="w-3 h-3" />
                                    <span>{badge.label}</span>
                                  </span>

                                  {/* Formatted Date & Time e.g. Submitted 25/10/2026 at 10:55 */}
                                  <span className="text-neutral-500 text-[11px]">
                                    {(() => {
                                      try {
                                        const d = new Date(ord.createdAt);
                                        const dateStr = d.toLocaleDateString('en-GB');
                                        const timeStr = d.toLocaleTimeString('en-GB', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          hour12: false,
                                        });
                                        return `Submitted ${dateStr} at ${timeStr}`;
                                      } catch {
                                        return `Submitted ${ord.createdAt}`;
                                      }
                                    })()}
                                  </span>

                                  {/* Dispute Alert Badge */}
                                  {hasActiveDispute && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-200">
                                      <AlertCircle className="w-3 h-3 text-rose-600" />
                                      <span>Dispute Active</span>
                                    </span>
                                  )}

                                  {/* Unread Concierge Chat Badge */}
                                  {hasUnreadChat && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                                      <span>New Concierge Reply</span>
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-4 text-left sm:text-right">
                                  <div>
                                    <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Reseller Total</span>
                                    <span className="font-serif font-bold text-base text-neutral-900 tabular-nums">
                                      {formatPrice(ord.totalAmount)}
                                    </span>
                                  </div>
                                  {ord.resellerMargin !== undefined && (
                                    <div>
                                      <span className="text-[10px] text-emerald-600 uppercase font-semibold block">Your Margin</span>
                                      <span className="font-serif font-bold text-base text-emerald-700 tabular-nums">
                                        +₹{ord.resellerMargin.toLocaleString('en-IN')}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Middle Card Row: Item Thumbnails, Title & Recipient Details */}
                              <div className="pt-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Product Thumbnails */}
                                  <div className="flex items-center -space-x-2 shrink-0">
                                    {ord.items.slice(0, 3).map((item, idx) => (
                                      <img
                                        key={idx}
                                        src={item.product.images?.[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                                        alt={item.product.title}
                                        className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-2xs bg-neutral-100"
                                      />
                                    ))}
                                    {ord.items.length > 3 && (
                                      <div className="w-12 h-12 rounded-xl bg-neutral-900 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow-2xs">
                                        +{ord.items.length - 3}
                                      </div>
                                    )}
                                  </div>

                                  {/* Titles & Destination Preview */}
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
                                        Ship To: {ord.dropshipRecipient?.name || ord.customer.name} ({ord.dropshipRecipient?.city || ord.customer.city}, {ord.dropshipRecipient?.state || ord.customer.state})
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

                                {/* Call to action button */}
                                <div className="flex items-center gap-2 text-xs font-bold text-purple-900 group-hover:text-purple-700 transition shrink-0 ml-auto md:ml-0">
                                  <span>View Tracking & Live Progression</span>
                                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                              </div>

                              {/* Dropship Recipient Address Box */}
                              {(ord.dropshipRecipient || ord.customer) && (
                                <div className="mt-3 p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                                      END-CUSTOMER DELIVERY ADDRESS
                                    </span>
                                    <p className="text-neutral-900 font-medium text-[11px] truncate">
                                      <strong>{ord.dropshipRecipient?.name || ord.customer.name}</strong> · 📱 +91 {ord.dropshipRecipient?.phone || ord.customer.phone} · {ord.dropshipRecipient?.address || ord.customer.address}, {ord.dropshipRecipient?.city || ord.customer.city}, {ord.dropshipRecipient?.state || ord.customer.state} - {ord.dropshipRecipient?.pincode || ord.customer.pincode}
                                    </p>
                                  </div>
                                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md shrink-0">
                                    Discreet Packaging
                                  </span>
                                </div>
                              )}

                              {/* Wholesale Payment Gateway Verification Reference */}
                              <div className="mt-2.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-800 text-[11px] truncate flex items-center gap-1.5">
                                      <span>{ord.paymentGateway === 'paytm' || ord.paytmTxnId ? 'Paytm Gateway Verified Settlement' : 'Prepaid Direct Transaction'}</span>
                                      <span className="px-1 rounded bg-emerald-600 text-white text-[9px] font-extrabold">PAID</span>
                                    </p>
                                    <p className="font-mono text-[10px] text-slate-500 truncate">
                                      Txn ID: <strong>{ord.paytmTxnId || ord.upiTransactionId || 'Payment on file'}</strong>
                                      {ord.paytmDetails?.bankTxnId && ` · Bank Ref: ${ord.paytmDetails.bankTxnId}`}
                                    </p>
                                  </div>
                                </div>
                                {ord.paytmDetails?.paymentMode && (
                                  <span className="text-[10px] font-medium text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                                    Mode: {ord.paytmDetails.paymentMode} {ord.paytmDetails.testMode ? '(Sandbox Test)' : ''}
                                  </span>
                                )}
                              </div>

                              {/* Courier Snippet matching image (12).png */}
                              {ord.shippingDetails?.trackingNumber && (
                                <div className="mt-2.5 p-2.5 rounded-xl bg-blue-50/90 border border-blue-200 text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 text-xs min-w-0">
                                    <Truck className="w-4 h-4 text-blue-700 shrink-0" />
                                    <span className="truncate">
                                      <strong>{ord.shippingDetails.courierName || 'The Professional Couriers'}</strong>:{' '}
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
                      VIEW 2: DETAILED ORDER TRACKING VIEW (matches Customer Tracking)
                     ========================================================================= */
                  <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm space-y-5 p-4 sm:p-6">
                    {/* Top Navigation Bar */}
                    <div className="flex items-center justify-between gap-3 pb-4 border-b border-neutral-200 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setSelectedResellerOrderId(null)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-bold text-xs transition cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4 text-purple-900" />
                        <span>← Back to My Dropships</span>
                      </button>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Copyable Order Number */}
                        <div className="flex items-center gap-1 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                          <span className="font-mono font-bold text-xs text-purple-950">
                            #{selectedResellerOrder.orderNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyOrderText(
                                selectedResellerOrder.orderNumber,
                                `ord-num-${selectedResellerOrder.id}`
                              )
                            }
                            className="p-0.5 text-purple-700 hover:text-purple-950 rounded cursor-pointer"
                            title="Copy Order Reference"
                          >
                            {copiedOrderKey === `ord-num-${selectedResellerOrder.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            getStatusBadge(selectedResellerOrder.status).bg
                          }`}
                        >
                          {getStatusBadge(selectedResellerOrder.status).label}
                        </span>

                        {/* Device Alerts Active / Enable (matches Customer TrackOrderModal) */}
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
                            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 text-[11px] font-bold transition cursor-pointer"
                            title="Enable notifications for live concierge & courier tracking updates"
                          >
                            <Bell className="w-3.5 h-3.5 animate-bounce shrink-0" />
                            <span>{isRequestingPermission ? 'Enabling...' : 'Enable Alerts'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setPrintingSlipOrder(selectedResellerOrder)}
                          className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-neutral-300"
                          title="Generate and print unbranded dropship packing slip"
                        >
                          <Printer className="w-3.5 h-3.5 text-neutral-600" />
                          <span className="hidden sm:inline">Dropship Packing Slip</span>
                        </button>
                      </div>
                    </div>

                    {/* End-Customer & Destination Card */}
                    <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">
                          End-Customer Delivery Destination
                        </span>
                        <h4 className="font-serif font-bold text-base text-neutral-900 mt-0.5">
                          {selectedResellerOrder.dropshipRecipient?.name || selectedResellerOrder.customer.name}
                        </h4>
                        <p className="text-xs text-neutral-600 mt-1">
                          {selectedResellerOrder.dropshipRecipient?.address || selectedResellerOrder.customer.address},{' '}
                          {selectedResellerOrder.dropshipRecipient?.city || selectedResellerOrder.customer.city},{' '}
                          {selectedResellerOrder.dropshipRecipient?.state || selectedResellerOrder.customer.state} -{' '}
                          <strong>{selectedResellerOrder.dropshipRecipient?.pincode || selectedResellerOrder.customer.pincode}</strong>
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <a
                            href={`tel:+91${selectedResellerOrder.dropshipRecipient?.phone || selectedResellerOrder.customer.phone}`}
                            className="inline-flex items-center gap-1 text-purple-800 font-semibold hover:underline"
                          >
                            <Phone className="w-3.5 h-3.5 text-purple-700" />
                            <span>+91 {selectedResellerOrder.dropshipRecipient?.phone || selectedResellerOrder.customer.phone}</span>
                          </a>
                          <span className="text-neutral-300">|</span>
                          <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 text-[10px] font-bold border border-purple-200">
                            Plain Packaging (No Retail Invoice)
                          </span>
                        </div>
                      </div>

                      <div className="text-left md:text-right border-t md:border-t-0 pt-3 md:pt-0 border-neutral-200">
                        <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">
                          Reseller Settlement
                        </span>
                        <p className="font-serif font-bold text-2xl text-neutral-900 tabular-nums">
                          {formatPrice(selectedResellerOrder.totalAmount)}
                        </p>
                        {selectedResellerOrder.resellerMargin !== undefined && (
                          <p className="text-xs font-bold text-emerald-700 mt-0.5">
                            Margin Earned: +₹{selectedResellerOrder.resellerMargin.toLocaleString('en-IN')}
                          </p>
                        )}
                        <span className="text-[11px] text-neutral-500 mt-0.5 block">
                          Submitted on {new Date(selectedResellerOrder.createdAt).toLocaleDateString('en-GB')} at {new Date(selectedResellerOrder.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                      </div>
                    </div>

                    {/* Cancellation Request Banner if pending */}
                    {selectedResellerOrder.cancellationRequest?.requested &&
                      selectedResellerOrder.cancellationRequest.status === 'pending' && (
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 text-amber-950 space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-amber-900">
                            <Clock className="w-4 h-4 text-amber-600" />
                            <span>Cancellation Request Submitted (Under Review)</span>
                          </div>
                          <p className="leading-relaxed">
                            Your request to cancel this dropship order has been submitted to boutique dispatch on{' '}
                            {new Date(selectedResellerOrder.cancellationRequest.requestedAt).toLocaleDateString('en-IN')}. Our fulfillment team is reviewing before consignment dispatch.
                          </p>
                          <p className="text-amber-800 italic">
                            Reason: "{selectedResellerOrder.cancellationRequest.reason}"
                          </p>
                        </div>
                      )}

                    {/* Stage Timeline (matches TrackOrderModal) */}
                    {selectedResellerOrder.status !== 'Cancelled' &&
                    selectedResellerOrder.status !== 'Rejected' &&
                    selectedResellerOrder.status !== 'Refunded' ? (
                      <div className="p-4 rounded-2xl border border-neutral-200 bg-white space-y-3">
                        {/* Concierge Assigned Banner */}
                        {selectedResellerOrder.assignedStaffName ? (
                          <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2.5">
                              <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-700 to-indigo-800 text-white font-serif font-bold text-xs flex items-center justify-center shadow-2xs shrink-0">
                                {selectedResellerOrder.assignedStaffName.charAt(0)}
                              </span>
                              <div>
                                <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
                                  Dedicated Concierge Assigned
                                </span>
                                <h4 className="font-serif font-bold text-xs sm:text-sm text-neutral-900">
                                  {selectedResellerOrder.assignedStaffName}
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
                                  Order in Fulfillment Queue
                                </span>
                                <h4 className="font-serif font-bold text-xs text-neutral-900">
                                  Awaiting Staff Concierge Claim & Inspection
                                </h4>
                              </div>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 text-[10px] font-bold shrink-0">
                              In Queue
                            </span>
                          </div>
                        )}

                        {/* 4-Step Visual Progression Stepper */}
                        <div className="pt-2">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block mb-3">
                            Live Delivery Progression
                          </span>
                          <div className="grid grid-cols-4 gap-2 pt-1">
                            {[
                              { name: 'Pending', icon: Clock },
                              { name: 'Confirmed', icon: CheckCircle },
                              { name: 'Shipped', icon: Truck },
                              { name: 'Delivered', icon: Package },
                            ].map((step, idx) => {
                              const currentStep = getStatusStepIndex(selectedResellerOrder.status);
                              const isDone = currentStep >= idx;
                              const isCurrent = currentStep === idx;
                              const StepIcon = step.icon;
                              return (
                                <div key={step.name} className="flex flex-col items-center text-center">
                                  <div
                                    className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
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
                              selectedResellerOrder.status === 'Refunded'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-rose-100 text-rose-900 border border-rose-300'
                            }`}
                          >
                            {selectedResellerOrder.status === 'Refunded' ? 'Stage: Refund Completed ✓' : 'Stage: Order Cancelled'}
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
                                selectedResellerOrder.status === 'Cancelled' ||
                                selectedResellerOrder.status === 'Rejected',
                              icon: XCircle,
                            },
                            {
                              name: 'Refunded',
                              isDone:
                                selectedResellerOrder.status === 'Refunded' ||
                                selectedResellerOrder.refundDetails?.refundStatus === 'processed',
                              isCurrent: selectedResellerOrder.status === 'Refunded',
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

                        {selectedResellerOrder.status === 'Refunded' ? (
                          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300 text-emerald-950 space-y-1.5 mt-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                                <CheckCircle className="w-4 h-4 text-emerald-600" />
                                <span>Refund Settled Successfully</span>
                              </span>
                              <span className="font-mono font-bold text-emerald-800 text-xs">
                                UTR: {selectedResellerOrder.refundDetails?.refundUtr || 'Processed'}
                              </span>
                            </div>
                            <p className="text-[11px] text-emerald-800">
                              Amount of {formatPrice(selectedResellerOrder.totalAmount)} refunded to reseller account.
                            </p>
                          </div>
                        ) : (
                          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-950 text-xs mt-2">
                            <p>
                              <strong>Cancellation Reason:</strong> {selectedResellerOrder.cancellationReason || 'Reseller requested'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Courier Consignment & Official Tracking Box (matches TrackOrderModal) */}
                    {(selectedResellerOrder.status === 'Shipped' || selectedResellerOrder.shippingDetails?.trackingNumber) && (
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
                              {selectedResellerOrder.shippingDetails?.courierName || 'Assigned Logistics Partner'}
                            </p>
                          </div>
                          <div>
                            <span className="text-neutral-500 text-[11px] font-semibold">
                              Consignment Tracking / Waybill Number:
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <code className="font-mono font-bold text-xs text-neutral-900 bg-neutral-100 px-2 py-1 rounded">
                                {selectedResellerOrder.shippingDetails?.trackingNumber || 'Pending Waybill'}
                              </code>
                              {selectedResellerOrder.shippingDetails?.trackingNumber && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyOrderText(
                                      selectedResellerOrder.shippingDetails!.trackingNumber,
                                      `track-${selectedResellerOrder.id}`
                                    )
                                  }
                                  className="p-1.5 hover:bg-neutral-100 rounded text-neutral-600 cursor-pointer"
                                  title="Copy Consignment ID"
                                >
                                  {copiedOrderKey === `track-${selectedResellerOrder.id}` ? (
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
                            selectedResellerOrder.shippingDetails?.courierName,
                            settings.courierServices
                          );
                          const trackingPortalUrl = buildCourierTrackingUrl(
                            courier,
                            selectedResellerOrder.shippingDetails?.courierName,
                            selectedResellerOrder.shippingDetails?.trackingNumber
                          );

                          return trackingPortalUrl ? (
                            <div className="pt-2 border-t border-blue-200/80 flex items-center justify-between flex-wrap gap-2">
                              <span className="text-[11px] text-blue-900 font-semibold flex items-center gap-1">
                                <Truck className="w-3.5 h-3.5 text-blue-700" />
                                <span>Live Courier Verification:</span>
                              </span>
                              <a
                                href={trackingPortalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-2xs cursor-pointer"
                              >
                                <span>Track on {selectedResellerOrder.shippingDetails?.courierName || 'Courier'} Portal</span>
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
                        Ordered Items ({selectedResellerOrder.items.length})
                      </span>
                      <div className="divide-y divide-neutral-100">
                        {selectedResellerOrder.items.map((item, idx) => (
                          <div
                            key={idx}
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
                                  <span className="font-mono font-bold text-purple-950 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
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
                                  ({formatPrice(item.product.price)} each reseller price)
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Payment Verification & Reseller Settlement */}
                    <div className="p-4 rounded-2xl border border-neutral-200 bg-neutral-50/80 space-y-3">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block">
                        Payment Verification & Settlement Details
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-white border border-neutral-200">
                          <span className="text-[10px] font-semibold text-neutral-400 uppercase block">
                            Payment Transaction ID (UTR)
                          </span>
                          <div className="flex items-center justify-between mt-1">
                            <code className="font-mono font-bold text-neutral-900 text-xs">
                              {selectedResellerOrder.upiTransactionId || 'Pending Settlement'}
                            </code>
                            {selectedResellerOrder.upiTransactionId && (
                              <button
                                type="button"
                                onClick={() =>
                                  copyOrderText(
                                    selectedResellerOrder.upiTransactionId,
                                    `utr-${selectedResellerOrder.id}`
                                  )
                                }
                                className="p-1 text-neutral-500 hover:text-neutral-900 rounded cursor-pointer"
                                title="Copy Payment UTR"
                              >
                                {copiedOrderKey === `utr-${selectedResellerOrder.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-white border border-neutral-200">
                          <span className="text-[10px] font-semibold text-neutral-400 uppercase block">
                            Reseller Margin Calculation
                          </span>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-bold text-emerald-700 text-sm">
                              +₹{selectedResellerOrder.resellerMargin?.toLocaleString('en-IN') || 0}
                            </span>
                            <span className="text-[11px] text-neutral-500">
                              Reseller Discount: {currentReseller.wholesaleDiscountPercent}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Dispute Notice if already active */}
                    {selectedResellerOrder.deliveryIssue?.reported &&
                      selectedResellerOrder.deliveryIssue.issueType !== 'cancellation' && (
                        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-950 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold flex items-center gap-1.5 text-rose-900">
                              <AlertCircle className="w-4 h-4 text-rose-600" />
                              <span>
                                {selectedResellerOrder.deliveryIssue.issueType === 'refund'
                                  ? `Refund / Margin Dispute Ticket (${selectedResellerOrder.deliveryIssue.status.toUpperCase()})`
                                  : `Delivery Issue Reported (${selectedResellerOrder.deliveryIssue.status.toUpperCase()})`}
                              </span>
                            </span>
                            <span className="text-[10px] text-neutral-500 font-medium">
                              {new Date(selectedResellerOrder.deliveryIssue.reportedAt).toLocaleDateString('en-IN')}
                            </span>
                          </div>
                          <p className="text-neutral-800 italic bg-white/80 p-2.5 rounded-xl border border-rose-100">
                            "{selectedResellerOrder.deliveryIssue.issueDescription}"
                          </p>
                          <p className="text-[11px] text-rose-800 font-medium">
                            {selectedResellerOrder.deliveryIssue.issueType === 'refund'
                              ? 'Boutique accounts team is verifying payment settlement with bank records.'
                              : `Assigned concierge is investigating dispatch status with ${selectedResellerOrder.shippingDetails?.courierName || 'the courier partner'} local hub.`}
                          </p>
                        </div>
                      )}

                    {/* Order Actions: Cancellation, Dispute & Real-Time Live Concierge Chat */}
                    <div className="p-4 rounded-2xl border border-neutral-200 bg-white space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Cancellation Button (allowed if order is Pending or Confirmed) */}
                          {(selectedResellerOrder.status === 'Pending' || selectedResellerOrder.status === 'Confirmed') &&
                            !selectedResellerOrder.cancellationRequest?.requested && (
                              <button
                                type="button"
                                onClick={() => setCancellingOrder(selectedResellerOrder)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs transition cursor-pointer"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>Request Cancellation</span>
                              </button>
                            )}

                          {/* Dispute Redressal Dropdown */}
                          {(() => {
                            const eligibleRedressals = getOrderEligibleRedressals(selectedResellerOrder, settings);
                            if (eligibleRedressals.length === 0) return null;

                            const availableRedressals = getAvailableRedressalsForOrder(selectedResellerOrder, settings);
                            const hasActiveDispute =
                              Boolean(
                                selectedResellerOrder.deliveryIssue?.reported &&
                                  selectedResellerOrder.deliveryIssue.status !== 'resolved'
                              ) ||
                              Boolean(
                                selectedResellerOrder.cancellationRequest?.requested &&
                                  selectedResellerOrder.cancellationRequest.status === 'pending'
                              );
                            const allEligibleResolved = areAllEligibleDisputesResolved(
                              selectedResellerOrder,
                              settings
                            );

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
                                      openIssueDropdownOrderId === selectedResellerOrder.id
                                        ? null
                                        : selectedResellerOrder.id
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900 font-semibold text-xs transition cursor-pointer shadow-2xs"
                                >
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Report Issue</span>
                                  <ChevronDown
                                    className={`w-3 h-3 text-rose-700 transition-transform ${
                                      openIssueDropdownOrderId === selectedResellerOrder.id ? 'rotate-180' : ''
                                    }`}
                                  />
                                </button>

                                {openIssueDropdownOrderId === selectedResellerOrder.id && (
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
                                            setReportingIssueOrder(selectedResellerOrder);
                                            setReportingIssueType(redressal.type as any);
                                            setIssueDescription(
                                              redressal.defaultNote(
                                                selectedResellerOrder.orderNumber,
                                                selectedResellerOrder.status
                                              )
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

                        {/* Real-Time Live Concierge Chat Button */}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedChatOrderId(
                              expandedChatOrderId === selectedResellerOrder.id ? null : selectedResellerOrder.id
                            )
                          }
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs ${
                            expandedChatOrderId === selectedResellerOrder.id
                              ? 'bg-purple-900 text-white'
                              : 'bg-purple-700 hover:bg-purple-600 text-white'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5 fill-white" />
                          <span>
                            {expandedChatOrderId === selectedResellerOrder.id
                              ? 'Close Concierge Chat'
                              : 'Live Concierge Chat'}
                            {selectedResellerOrder.chatMessages && selectedResellerOrder.chatMessages.length > 0
                              ? ` (${selectedResellerOrder.chatMessages.length})`
                              : ''}
                          </span>
                        </button>
                      </div>

                      {/* Live Concierge Chat Stream */}
                      {expandedChatOrderId === selectedResellerOrder.id && (
                        <div className="mt-3 pt-3 border-t border-neutral-200 animate-in fade-in duration-200">
                          <OrderLiveChat
                            order={selectedResellerOrder}
                            mode="customer"
                            title={`Atelier Concierge Live Chat · Dropship #${selectedResellerOrder.orderNumber}`}
                          />
                        </div>
                      )}
                    </div>

                    {/* Bottom Navigation Bar */}
                    <div className="pt-4 border-t border-neutral-200 flex items-center justify-between flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedResellerOrderId(null)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 text-xs font-bold transition cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to My Dropships</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedResellerOrderId(null);
                          setActiveTab('catalog');
                        }}
                        className="px-4 py-2 rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                      >
                        + Shop Reseller Catalog
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: RESELLER CART & MULTI-ITEM CHECKOUT */}
            {(activeTab === 'cart' || activeTab === 'new_order') && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-2xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-900 flex items-center justify-center font-bold">
                        <ShoppingCart className="w-4 h-4 text-purple-800" />
                      </span>
                      <h3 className="font-serif font-bold text-base sm:text-lg text-neutral-900">
                        Reseller Cart & Checkout
                      </h3>
                      {totalCartItems > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-purple-950 border border-amber-300">
                          {totalCartItems} {totalCartItems === 1 ? 'Saree' : 'Sarees'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      Review selected products, configure customer resale prices, and place dropship or self-stock orders with discreet packaging.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('catalog')}
                      className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add More Sarees</span>
                    </button>
                    {resellerCart.length > 0 && (
                      <button
                        type="button"
                        onClick={() => clearResellerCart()}
                        className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear Cart</span>
                      </button>
                    )}
                  </div>
                </div>

                {orderSuccess ? (
                  /* Order Success Confirmation Card */
                  <div className="max-w-2xl mx-auto p-6 sm:p-8 rounded-3xl bg-emerald-50 border border-emerald-200 text-center space-y-4 animate-in fade-in zoom-in-95 shadow-md">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                      <CheckCircle className="w-9 h-9" />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-xl sm:text-2xl text-emerald-950">
                        Reseller Order Placed Successfully!
                      </h4>
                      <p className="text-xs sm:text-sm text-emerald-800 mt-1">
                        Order reference <strong className="font-mono bg-emerald-100 px-2 py-0.5 rounded text-emerald-950">#{orderSuccess.orderNumber}</strong> has been dispatched to the boutique fulfillment queue.
                      </p>
                    </div>

                    <div className="bg-white/80 backdrop-blur-xs p-4 rounded-2xl border border-emerald-200 text-left space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                        <span className="text-neutral-600">Total Sarees Placed:</span>
                        <strong className="text-neutral-900 font-mono font-bold">
                          {orderSuccess.items.reduce((s, it) => s + it.quantity, 0)} pieces ({orderSuccess.items.length} styles)
                        </strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                        <span className="text-neutral-600">Settled with Boutique:</span>
                        <strong className="text-purple-950 font-bold">{formatPrice(orderSuccess.totalAmount)}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                        <span className="text-emerald-800 font-bold">Locked Reseller Margin:</span>
                        <strong className="text-emerald-700 font-bold text-sm">+₹{(orderSuccess.resellerMargin || 0).toLocaleString('en-IN')}</strong>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-neutral-600">Packaging Type:</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                          Plain Discreet Packaging (No Boutique Tags)
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedResellerOrderId(orderSuccess.id);
                          setActiveTab('orders');
                        }}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-purple-900 hover:bg-purple-800 text-white font-bold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                      >
                        <Package className="w-4 h-4" />
                        <span>Track in Reseller Orders &rarr;</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOrderSuccess(null);
                          setActiveTab('catalog');
                        }}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-800 font-bold text-xs transition cursor-pointer"
                      >
                        Shop More Sarees
                      </button>
                    </div>
                  </div>
                ) : resellerCart.length === 0 ? (
                  /* Empty Cart View */
                  <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200 space-y-4 max-w-2xl mx-auto shadow-2xs">
                    <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                      <ShoppingCart className="w-8 h-8 text-purple-800" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-serif font-bold text-lg text-neutral-900">
                        Your Reseller Cart is Empty
                      </h4>
                      <p className="text-xs text-neutral-500 max-w-md mx-auto">
                        You haven't selected any sarees yet. Browse through our Reseller Catalog to pick pure silk, Kanchipuram, and designer sarees, set quantities, and checkout for direct customer dropship.
                      </p>
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('catalog')}
                        className="px-6 py-3 rounded-xl bg-purple-900 hover:bg-purple-800 text-white font-bold text-xs transition cursor-pointer shadow-md inline-flex items-center gap-2"
                      >
                        <Store className="w-4 h-4" />
                        <span>Browse Reseller Catalog &rarr;</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Active Multi-Item Cart & Checkout Grid */
                  <form onSubmit={handlePlaceOrderSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column: Cart Items List */}
                    <div className="lg:col-span-7 space-y-4">
                      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                          <h4 className="font-serif font-bold text-sm text-neutral-900 uppercase tracking-wider">
                            Selected Sarees ({resellerCart.length})
                          </h4>
                          <span className="text-xs text-neutral-500 font-medium">
                            {totalCartItems} total pieces
                          </span>
                        </div>

                        {/* Items List */}
                        <div className="space-y-3.5 divide-y divide-neutral-100">
                          {resellerCart.map((item) => {
                            const unitWholesale = getWholesalePrice(item.product.price);
                            const retailMRP = item.product.price;
                            const resalePrice = item.resalePrice || retailMRP;
                            const unitMargin = Math.max(0, resalePrice - unitWholesale);
                            const lineTotalWholesale = unitWholesale * item.quantity;
                            const lineTotalMargin = unitMargin * item.quantity;

                            return (
                              <div
                                key={item.product.id}
                                className="pt-3.5 first:pt-0 flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-3.5 group"
                              >
                                <div className="flex items-start gap-3 min-w-0">
                                  <img
                                    src={item.product.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                                    alt={item.product.title}
                                    className="w-16 h-20 sm:w-20 sm:h-24 object-cover rounded-xl border border-neutral-200 shadow-2xs shrink-0"
                                  />
                                  <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">
                                        {item.product.fabric || item.product.category}
                                      </span>
                                      <span className="font-mono text-[10px] font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                                        {item.product.productCode}
                                      </span>
                                    </div>
                                    {(() => {
                                      const liveProd = products.find((p) => p.id === item.product.id) || item.product;
                                      const maxStock = liveProd.stockCount !== undefined ? Math.max(0, liveProd.stockCount) : 99;
                                      const isItemOutOfStock =
                                        liveProd.stockStatus === 'out_of_stock' || (liveProd.stockCount !== undefined && liveProd.stockCount <= 0);

                                      return (
                                        <>
                                          <h5 className="font-serif font-bold text-sm text-neutral-900 leading-tight">
                                            {liveProd.title}
                                          </h5>
                                          <div className="flex items-baseline gap-2 text-xs">
                                            <span className="font-bold text-purple-950">
                                              Reseller Cost: {formatPrice(unitWholesale)}
                                            </span>
                                            <span className="text-[11px] text-neutral-400 line-through">
                                              MRP: {formatPrice(retailMRP)}
                                            </span>
                                          </div>

                                          {/* Live Available Stock Indicator in Cart */}
                                          <div className="flex items-center gap-2 text-[11px] pt-0.5">
                                            <span className="text-neutral-500 font-medium">Available Quantity:</span>
                                            {isItemOutOfStock ? (
                                              <span className="font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                                                <Ban className="w-3 h-3" />
                                                <span>0 Available (Out of Stock)</span>
                                              </span>
                                            ) : maxStock <= 3 ? (
                                              <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                                <span>Only {maxStock} left in stock</span>
                                              </span>
                                            ) : (
                                              <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                                <span>{maxStock} available</span>
                                              </span>
                                            )}
                                          </div>
                                        </>
                                      );
                                    })()}

                                    {/* Reseller Selling Price Override */}
                                    <div className="pt-1.5 flex items-center gap-2 flex-wrap">
                                      <label className="text-[11px] font-medium text-neutral-600 whitespace-nowrap">
                                        Customer Selling Price:
                                      </label>
                                      <div className="relative w-28">
                                        <span className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-neutral-400 text-xs">
                                          ₹
                                        </span>
                                        <input
                                          type="number"
                                          min={0}
                                          value={resalePrice}
                                          onChange={(e) =>
                                            updateCartResalePrice(
                                              item.product.id,
                                              parseInt(e.target.value) || 0
                                            )
                                          }
                                          className="w-full pl-6 pr-2 py-1 rounded-lg border border-neutral-200 text-xs font-bold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-purple-700 bg-neutral-50"
                                          title="Customize your selling price to end-customer"
                                        />
                                      </div>
                                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                        +₹{unitMargin.toLocaleString('en-IN')}/pc margin
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Right Side: Stepper, Line Totals & Trash */}
                                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-100">
                                  {/* Quantity Stepper (Constrained strictly by stock) */}
                                  {(() => {
                                    const liveProd = products.find((p) => p.id === item.product.id) || item.product;
                                    const maxStock = liveProd.stockCount !== undefined ? Math.max(0, liveProd.stockCount) : 99;
                                    const isOutOfStock = liveProd.stockStatus === 'out_of_stock' || maxStock <= 0;

                                    return (
                                      <div className="flex items-center border border-neutral-200 rounded-xl bg-neutral-50 shadow-2xs overflow-hidden">
                                        <button
                                          type="button"
                                          onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                                          className="p-1.5 hover:bg-neutral-200 text-neutral-600 transition cursor-pointer"
                                          title="Decrease quantity"
                                        >
                                          <Minus className="w-3.5 h-3.5" />
                                        </button>
                                        <span className="px-2.5 text-xs font-bold tabular-nums text-neutral-800 min-w-6 text-center">
                                          {item.quantity}
                                        </span>
                                        <button
                                          type="button"
                                          disabled={item.quantity >= maxStock || isOutOfStock}
                                          onClick={() => {
                                            if (item.quantity < maxStock && !isOutOfStock) {
                                              updateCartQuantity(item.product.id, item.quantity + 1);
                                            }
                                          }}
                                          className="p-1.5 hover:bg-neutral-200 text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                                          title={item.quantity >= maxStock ? `Maximum available stock reached (${maxStock} units)` : "Increase quantity"}
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })()}

                                  {/* Line Total Reseller Cost & Margin */}
                                  <div className="text-right">
                                    <span className="block text-xs font-bold text-neutral-900">
                                      {formatPrice(lineTotalWholesale)}
                                    </span>
                                    <span className="block text-[10px] font-bold text-emerald-700">
                                      Margin: +₹{lineTotalMargin.toLocaleString('en-IN')}
                                    </span>
                                  </div>

                                  {/* Remove item button */}
                                  <button
                                    type="button"
                                    onClick={() => removeFromResellerCart(item.product.id)}
                                    className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                    title="Remove this saree from reseller cart"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Continue shopping link */}
                        <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setActiveTab('catalog')}
                            className="text-xs font-bold text-purple-900 hover:text-purple-700 flex items-center gap-1 cursor-pointer"
                          >
                            <span>&larr; Browse & Add More Sarees</span>
                          </button>
                          <span className="text-xs text-neutral-500">
                            {totalCartItems} total pieces ready for dispatch
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Checkout Panel (Delivery, Margins & UPI Payment) */}
                    <div className="lg:col-span-5 space-y-4">
                      {orderError && (
                        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>{orderError}</span>
                        </div>
                      )}

                      {/* Step 1: Delivery Destination (Dropship Only - My Business Address Removed) */}
                      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <label className="block text-xs font-bold uppercase tracking-wider text-neutral-800">
                            1. Delivery Destination (Customer Dropship)
                          </label>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                            Direct to End-Buyer
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200/80 text-[11px] text-purple-900 flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0" />
                          <span>
                            <strong>Discreet Dropship:</strong> Plain unbranded parcel without boutique price tags or invoices.
                          </span>
                        </div>

                        {/* Prompt to select from Saved Addresses if available */}
                        {currentReseller.savedAddresses && currentReseller.savedAddresses.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-neutral-700">
                                Select from Saved Addresses:
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSavedAddressId('new');
                                  setRecipientName('');
                                  setRecipientPhone('');
                                  setRecipientAddress('');
                                  setRecipientCity('');
                                  setRecipientState('Tamil Nadu');
                                  setRecipientPincode('');
                                }}
                                className={`text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                                  selectedSavedAddressId === 'new'
                                    ? 'text-purple-900 underline'
                                    : 'text-neutral-500 hover:text-purple-900'
                                }`}
                              >
                                <Plus className="w-3 h-3" />
                                <span>+ Enter New Address</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                              {currentReseller.savedAddresses.map((addr) => {
                                const isSelected = selectedSavedAddressId === addr.id;
                                return (
                                  <div
                                    key={addr.id}
                                    onClick={() => {
                                      setSelectedSavedAddressId(addr.id);
                                      setRecipientName(addr.name);
                                      setRecipientPhone(addr.phone);
                                      setRecipientAddress(addr.address);
                                      setRecipientCity(addr.city);
                                      setRecipientState(addr.state || 'Tamil Nadu');
                                      setRecipientPincode(addr.pincode);
                                    }}
                                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start justify-between gap-3 ${
                                      isSelected
                                        ? 'border-purple-600 bg-purple-50/70 shadow-xs ring-1 ring-purple-600'
                                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                                    }`}
                                  >
                                    <div className="space-y-0.5 text-xs">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-neutral-900">{addr.name}</span>
                                        {addr.isDefault && (
                                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-400 text-purple-950">
                                            Default
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-neutral-600 text-[11px]">{addr.address}</p>
                                      <p className="text-neutral-500 text-[11px]">
                                        {addr.city}, {addr.state || 'Tamil Nadu'} - {addr.pincode} &bull; Ph: +91 {addr.phone}
                                      </p>
                                    </div>
                                    <div className="pt-0.5">
                                      <div
                                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                          isSelected
                                            ? 'border-purple-600 bg-purple-600 text-white'
                                            : 'border-neutral-300 bg-white'
                                        }`}
                                      >
                                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Recipient inputs (shown when entering new address OR viewing/verifying selected address) */}
                        <div className="space-y-3 pt-1">
                          {selectedSavedAddressId === 'new' && currentReseller.savedAddresses && currentReseller.savedAddresses.length > 0 && (
                            <div className="text-[11px] font-semibold text-purple-900 bg-purple-50 p-2 rounded-lg border border-purple-200">
                              Entering new customer address (will be automatically saved for future dropships):
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                                Customer Name *
                              </label>
                              <input
                                type="text"
                                required
                                value={recipientName}
                                onChange={(e) => {
                                  setRecipientName(e.target.value);
                                  if (selectedSavedAddressId !== 'new') setSelectedSavedAddressId('new');
                                }}
                                placeholder="End buyer name"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-1 focus:ring-purple-700 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                                Customer Phone (10 digits) *
                              </label>
                              <input
                                type="tel"
                                required
                                maxLength={10}
                                value={recipientPhone}
                                onChange={(e) => {
                                  setRecipientPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                                  if (selectedSavedAddressId !== 'new') setSelectedSavedAddressId('new');
                                }}
                                placeholder="9876543210"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-mono focus:ring-1 focus:ring-purple-700 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                              Street Address, House / Flat No. *
                            </label>
                            <textarea
                              rows={2}
                              required
                              value={recipientAddress}
                              onChange={(e) => {
                                setRecipientAddress(e.target.value);
                                if (selectedSavedAddressId !== 'new') setSelectedSavedAddressId('new');
                              }}
                              placeholder="Door no, Street, Landmark, Area"
                              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-1 focus:ring-purple-700 focus:outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                                City *
                              </label>
                              <input
                                type="text"
                                required
                                value={recipientCity}
                                onChange={(e) => {
                                  setRecipientCity(e.target.value);
                                  if (selectedSavedAddressId !== 'new') setSelectedSavedAddressId('new');
                                }}
                                placeholder="e.g. Madurai"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-1 focus:ring-purple-700 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                                State *
                              </label>
                              <input
                                type="text"
                                required
                                value={recipientState}
                                onChange={(e) => {
                                  setRecipientState(e.target.value);
                                  if (selectedSavedAddressId !== 'new') setSelectedSavedAddressId('new');
                                }}
                                placeholder="Tamil Nadu"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-1 focus:ring-purple-700 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                                Pincode *
                              </label>
                              <input
                                type="text"
                                required
                                maxLength={6}
                                value={recipientPincode}
                                onChange={(e) => {
                                  setRecipientPincode(e.target.value.replace(/\D/g, '').slice(0, 6));
                                  if (selectedSavedAddressId !== 'new') setSelectedSavedAddressId('new');
                                }}
                                placeholder="625001"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-mono focus:ring-1 focus:ring-purple-700 focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Address Options: Auto-save & Set Default */}
                          <div className="pt-2 border-t border-neutral-100 space-y-1.5">
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-700 select-none">
                              <input
                                type="checkbox"
                                checked={saveAddressForFuture}
                                onChange={(e) => setSaveAddressForFuture(e.target.checked)}
                                className="w-3.5 h-3.5 text-purple-900 rounded border-neutral-300 focus:ring-purple-900"
                              />
                              <span>Save address to "Saved Addresses" for future dropships</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-700 select-none">
                              <input
                                type="checkbox"
                                checked={isNewAddressDefault}
                                onChange={(e) => setIsNewAddressDefault(e.target.checked)}
                                className="w-3.5 h-3.5 text-purple-900 rounded border-neutral-300 focus:ring-purple-900"
                              />
                              <span>Set as my default dropship address</span>
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                            Dispatch Notes (Optional)
                          </label>
                          <input
                            type="text"
                            value={orderNotes}
                            onChange={(e) => setOrderNotes(e.target.value)}
                            placeholder="Special folding, rush delivery, or packaging instruction"
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-1 focus:ring-purple-700 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Step 2: Settlement Breakdown & Margin */}
                      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-3">
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-800">
                          2. Settlement & Margin Breakdown
                        </label>

                        <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-200 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-600">Total Sarees</span>
                            <span className="font-bold text-neutral-900 font-mono">
                              {totalCartItems} pcs
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-600">Reseller Settlement to Pay</span>
                            <span className="font-bold text-purple-950 text-base">
                              {formatPrice(totalResellerCost)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-600">Total Customer Price Collected</span>
                            <span className="font-bold text-neutral-900">
                              {formatPrice(totalCustomerValue)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs border-t border-purple-200/80 pt-2">
                            <span className="font-bold text-emerald-800">Your Net Reseller Margin</span>
                            <span className="font-bold text-emerald-700 text-sm">
                              +₹{totalEstimatedMargin.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>

                        {/* Step 3: Paytm Payment Gateway */}
                        <div className="space-y-3 pt-1">
                          <label className="block text-xs font-bold uppercase tracking-wider text-neutral-800">
                            3. Settle Wholesale Total via Paytm Gateway
                          </label>

                          <div className="p-3.5 rounded-xl bg-[#002970]/5 border border-[#002970]/20 text-xs space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center font-bold text-sm tracking-tight">
                                  <span className="text-[#002970]">Pay</span>
                                  <span className="text-[#00BAF2]">tm</span>
                                </div>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#00BAF2]/15 text-[#002970]">
                                  Official Gateway
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Instant Verification</span>
                              </div>
                            </div>
                            <p className="text-[11px] text-neutral-600">
                              Settle wholesale order of <strong>{formatPrice(totalResellerCost)}</strong> via Paytm Dynamic QR, UPI Apps, Cards, Net Banking, or Paytm Wallet.
                            </p>
                          </div>

                          {/* Submit Checkout Button */}
                          <button
                            type="submit"
                            disabled={isPlacingOrder || resellerCart.length === 0}
                            className="w-full py-3.5 px-4 rounded-xl bg-[#002970] hover:bg-[#001f54] text-white font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50 active:scale-98 mt-2 flex items-center justify-center gap-2"
                          >
                            {isPlacingOrder ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Recording Wholesale Order...</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-4 h-4 text-[#00BAF2]" />
                                <span>Proceed to Paytm Payment ({formatPrice(totalResellerCost)})</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB 4: EARNINGS & RESELLER COMMISSION LEDGER */}
            {activeTab === 'earnings' && (
              <div className="space-y-4 max-w-3xl mx-auto">
                <div>
                  <h3 className="text-base font-bold text-neutral-900 font-serif">
                    Reseller Margins & Commission Ledger
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Track your reseller order volume and net profit margin earned.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      Total Orders
                    </span>
                    <p className="text-2xl font-serif font-bold text-neutral-900">
                      {resellerOrders.length}
                    </p>
                    <span className="text-[11px] text-neutral-500">Independent B2B dropships</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                      Reseller Volume
                    </span>
                    <p className="text-2xl font-serif font-bold text-purple-950">
                      {formatPrice(totalResellerVolume)}
                    </p>
                    <span className="text-[11px] text-purple-600">Total settled with boutique</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-emerald-200 bg-emerald-50/50 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      Total Margin Earned
                    </span>
                    <p className="text-2xl font-serif font-bold text-emerald-800">
                      +₹{totalResellerMarginEarned.toLocaleString('en-IN')}
                    </p>
                    <span className="text-[11px] text-emerald-600 font-medium">Your net resale profit</span>
                  </div>
                </div>

                {/* Reseller Partner Benefits Card */}
                <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-3">
                  <h4 className="font-serif font-bold text-xs uppercase tracking-wider text-neutral-800">
                    Reseller Partner Perks
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>{currentReseller.wholesaleDiscountPercent}% Flat Margin:</strong> Automatically
                        applied to all boutique silk sarees and designer wear.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Discreet Dropshipping:</strong> Parcels are shipped with neutral packaging and
                        do not mention reseller price tags.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>1-Click Media Packs:</strong> High-definition photos without watermarks ready
                        for WhatsApp Catalogs and Instagram feeds.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Priority Dispatch:</strong> Direct DTDC and Blue Dart air express courier
                        dispatch with live tracking links.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: DEDICATED SAVED ADDRESSES SECTION */}
            {activeTab === 'addresses' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Header Card */}
                <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-900 flex items-center justify-center font-bold">
                        <MapPin className="w-4 h-4 text-purple-800" />
                      </span>
                      <h3 className="font-serif font-bold text-lg text-neutral-900">
                        Saved Delivery Addresses
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Manage client and recurring delivery locations for immediate 1-click dropship dispatch.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenAddAddressModal}
                    className="px-4 py-2.5 rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Address</span>
                  </button>
                </div>

                {addressSuccessNotice && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{addressSuccessNotice}</span>
                  </div>
                )}

                {/* Addresses Grid */}
                {!currentReseller.savedAddresses || currentReseller.savedAddresses.length === 0 ? (
                  <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-neutral-300 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-purple-50 text-purple-700 mx-auto flex items-center justify-center">
                      <MapPin className="w-8 h-8" />
                    </div>
                    <div className="space-y-1 max-w-md mx-auto">
                      <h4 className="font-serif font-bold text-base text-neutral-900">
                        No Saved Addresses Yet
                      </h4>
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        Addresses you save during dropship checkout or add manually here will be preserved for quick reordering without re-typing client details.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenAddAddressModal}
                      className="px-4 py-2 rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create First Saved Address</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentReseller.savedAddresses.map((addr) => (
                      <div
                        key={addr.id}
                        className={`bg-white rounded-2xl border p-4.5 transition flex flex-col justify-between gap-4 shadow-2xs relative ${
                          addr.isDefault
                            ? 'border-purple-300 ring-1 ring-purple-400/50 bg-gradient-to-b from-purple-50/20 to-white'
                            : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-sm text-neutral-900 truncate">
                              {addr.name}
                            </h4>
                            {addr.isDefault && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-purple-950 shrink-0">
                                Default
                              </span>
                            )}
                          </div>

                          <div className="space-y-1 text-xs text-neutral-600">
                            <p className="flex items-center gap-1.5 font-mono text-neutral-800">
                              <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span>+91 {addr.phone}</span>
                            </p>
                            <p className="text-neutral-700 leading-relaxed line-clamp-2">
                              {addr.address}
                            </p>
                            <p className="text-neutral-500 font-medium">
                              {addr.city}, {addr.state || 'Tamil Nadu'} &bull; <span className="font-mono">{addr.pincode}</span>
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-2 text-xs">
                          <div>
                            {!addr.isDefault ? (
                              <button
                                type="button"
                                onClick={() => handleSetDefaultAddress(addr.id)}
                                className="text-[11px] font-bold text-purple-900 hover:text-purple-700 transition cursor-pointer"
                              >
                                Set as Default
                              </button>
                            ) : (
                              <span className="text-[11px] text-neutral-400 font-medium">
                                Active Default
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditAddressModal(addr)}
                              className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-[11px] transition cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAddress(addr.id)}
                              className="p-1 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Delete address"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: NOTIFICATIONS SECTION WITH DIRECT NAVIGATION */}
            {activeTab === 'notifications' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Header Card */}
                <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-900 flex items-center justify-center font-bold">
                        <Bell className="w-4 h-4 text-purple-800" />
                      </span>
                      <h3 className="font-serif font-bold text-lg text-neutral-900">
                        Reseller Updates & Notifications
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Stay informed on freshly restocked inventory, dropship milestones & direct boutique chats. Click any alert to navigate directly.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={markAllResellerNotificationsRead}
                      className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold transition cursor-pointer"
                    >
                      Mark all read
                    </button>
                    <button
                      type="button"
                      onClick={clearResellerNotifications}
                      className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold transition cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {[
                    { id: 'all', label: `All Updates (${(resellerNotifications || []).length})` },
                    { id: 'restock', label: `Restocked Sarees ✨ (${(resellerNotifications || []).filter((n) => n.type === 'restock').length})` },
                    { id: 'order', label: `Dropship Orders 📦 (${(resellerNotifications || []).filter((n) => n.type === 'order').length})` },
                    { id: 'chat', label: `Concierge Chat 💬 (${(resellerNotifications || []).filter((n) => n.type === 'chat').length})` },
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setResellerNotifFilter(chip.id as any)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                        resellerNotifFilter === chip.id
                          ? 'bg-purple-900 text-white shadow-xs'
                          : 'bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Notification Items List */}
                {(() => {
                  const filtered = (resellerNotifications || []).filter((n) => {
                    if (resellerNotifFilter === 'all') return true;
                    return n.type === resellerNotifFilter;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-neutral-300 space-y-3">
                        <div className="w-14 h-14 rounded-full bg-purple-50 text-purple-700 mx-auto flex items-center justify-center">
                          <Bell className="w-7 h-7" />
                        </div>
                        <h4 className="font-serif font-bold text-base text-neutral-900">
                          No Notifications in this Category
                        </h4>
                        <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                          You are completely up to date. You will receive real-time notifications when catalog sarees restock or dropship dispatches change.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2.5">
                      {filtered.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleResellerNotificationClick(notif)}
                          className={`p-4 rounded-2xl border transition cursor-pointer flex items-start justify-between gap-3 shadow-2xs group ${
                            notif.isRead
                              ? 'bg-white border-neutral-200 hover:border-neutral-300'
                              : 'bg-purple-50/50 border-purple-200 hover:border-purple-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                notif.type === 'restock'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : notif.type === 'order'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {notif.type === 'restock' ? (
                                <Sparkles className="w-4 h-4 text-emerald-700" />
                              ) : notif.type === 'order' ? (
                                <Package className="w-4 h-4 text-blue-700" />
                              ) : (
                                <MessageSquare className="w-4 h-4 text-amber-700" />
                              )}
                            </span>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4
                                  className={`text-xs font-bold ${
                                    notif.isRead ? 'text-neutral-900' : 'text-purple-950 font-black'
                                  }`}
                                >
                                  {notif.title}
                                </h4>
                                {!notif.isRead && (
                                  <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                                )}
                              </div>
                              <p className="text-xs text-neutral-600 leading-relaxed">
                                {notif.message}
                              </p>
                              <div className="flex items-center gap-3 pt-1 text-[11px] text-neutral-400">
                                <span>{new Date(notif.timestamp || notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span>&bull;</span>
                                <span className="text-purple-900 group-hover:underline font-semibold flex items-center gap-1">
                                  <span>
                                    {notif.type === 'restock'
                                      ? 'View in Saree Catalog'
                                      : notif.type === 'order'
                                      ? 'Track Dropship Order'
                                      : 'Open Concierge Chat'}
                                  </span>
                                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              markResellerNotificationRead(notif.id);
                            }}
                            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition shrink-0"
                            title={notif.isRead ? 'Mark as read' : 'Mark as read'}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* MODAL 0: Reseller Address Add / Edit Modal */}
            {isAddressModalOpen && (
              <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
                <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in zoom-in-95 duration-200">
                  <div className="p-5 bg-gradient-to-r from-purple-950 to-neutral-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-purple-300" />
                      <h3 className="font-serif text-base font-bold">
                        {addressModalMode === 'add' ? 'Add Saved Address' : 'Edit Saved Address'}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddressModalOpen(false)}
                      className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveAddressFormSubmit} className="p-5 space-y-3.5 text-xs">
                    {addrFormError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{addrFormError}</span>
                      </div>
                    )}

                    <div>
                      <label className="block font-bold text-neutral-800 mb-1">
                        Contact / Client Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={addrFormName}
                        onChange={(e) => setAddrFormName(e.target.value)}
                        placeholder="Full recipient name"
                        className="w-full p-2.5 rounded-xl border border-neutral-300 focus:ring-1 focus:ring-purple-700 focus:outline-none text-neutral-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-neutral-800 mb-1">
                        Phone Number (10 digits) *
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={addrFormPhone}
                        onChange={(e) => setAddrFormPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="9876543210"
                        className="w-full p-2.5 rounded-xl border border-neutral-300 font-mono focus:ring-1 focus:ring-purple-700 focus:outline-none text-neutral-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-neutral-800 mb-1">
                        Street Address / Landmark *
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={addrFormStreet}
                        onChange={(e) => setAddrFormStreet(e.target.value)}
                        placeholder="Door no, Building, Street, Landmark"
                        className="w-full p-2.5 rounded-xl border border-neutral-300 focus:ring-1 focus:ring-purple-700 focus:outline-none text-neutral-900"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block font-bold text-neutral-800 mb-1">City *</label>
                        <input
                          type="text"
                          required
                          value={addrFormCity}
                          onChange={(e) => setAddrFormCity(e.target.value)}
                          placeholder="Madurai"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-neutral-800 mb-1">State *</label>
                        <input
                          type="text"
                          required
                          value={addrFormState}
                          onChange={(e) => setAddrFormState(e.target.value)}
                          placeholder="Tamil Nadu"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-neutral-800 mb-1">Pincode *</label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={addrFormPincode}
                          onChange={(e) => setAddrFormPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="625001"
                          className="w-full p-2.5 rounded-xl border border-neutral-300 font-mono text-neutral-900"
                        />
                      </div>
                    </div>

                    <div className="pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-700 select-none">
                        <input
                          type="checkbox"
                          checked={addrFormIsDefault}
                          onChange={(e) => setAddrFormIsDefault(e.target.checked)}
                          className="w-3.5 h-3.5 text-purple-900 rounded border-neutral-300 focus:ring-purple-900"
                        />
                        <span>Set as Default Address for Dropshipping</span>
                      </label>
                    </div>

                    <div className="pt-3 flex flex-col gap-2">
                      <button
                        type="submit"
                        disabled={isSavingAddress}
                        className="w-full py-2.5 px-4 rounded-xl bg-purple-900 hover:bg-purple-800 text-white font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 active:scale-98"
                      >
                        {isSavingAddress ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        <span>{addressModalMode === 'add' ? 'Save Address' : 'Update Address'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsAddressModalOpen(false)}
                        className="w-full py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL 1: Reseller Order Cancellation Request Modal */}
            {cancellingOrder && (
              <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
                <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in zoom-in-95 duration-200">
                  <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ban className="w-5 h-5 text-rose-400" />
                      <h3 className="font-serif text-base font-bold">
                        Cancel Dropship #{cancellingOrder.orderNumber}
                      </h3>
                    </div>
                    <button
                      onClick={() => setCancellingOrder(null)}
                      className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmitCancellation} className="p-5 space-y-4 text-xs">
                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-700 space-y-1">
                      <p>Order Reference: <strong>#{cancellingOrder.orderNumber}</strong></p>
                      <p>Reseller Total: <strong className="text-neutral-900 font-serif">{formatPrice(cancellingOrder.totalAmount)}</strong></p>
                      <p className="text-[11px] text-purple-900 font-semibold pt-1">
                        📦 Ordered items: {cancellingOrder.items.reduce((s, it) => s + it.quantity, 0)} saree(s) will be restocked dynamically into inventory upon cancellation.
                      </p>
                    </div>

                    <div>
                      <label className="block font-bold text-neutral-800 mb-1">
                        Reason for Cancellation *
                      </label>
                      <select
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900"
                      >
                        <option value="Customer cancelled / Event postponed">Customer cancelled / Event postponed</option>
                        <option value="Ordered wrong color / saree variant">Ordered wrong color / saree variant</option>
                        <option value="End-customer delivery address change">End-customer delivery address change</option>
                        <option value="Customer selected different saree">Customer selected different saree</option>
                        <option value="Other">Other reason (specify below)</option>
                      </select>
                    </div>

                    {cancelReason === 'Other' && (
                      <div>
                        <label className="block font-semibold text-neutral-700 mb-1">Specify Reason</label>
                        <textarea
                          rows={2}
                          value={customCancelReason}
                          onChange={(e) => setCustomCancelReason(e.target.value)}
                          placeholder="Briefly state reason..."
                          className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                        />
                      </div>
                    )}

                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 rounded-xl bg-rose-900 hover:bg-rose-800 text-white font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-98"
                      >
                        <Ban className="w-4 h-4" />
                        <span>Cancel Order & Dynamic Restock</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCancellingOrder(null)}
                        className="w-full py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-semibold cursor-pointer"
                      >
                        Keep Dropship Order
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL 2: Reseller Issue Report Modal (Delivery Dispute or Refund Inquiry) */}
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
                            ? 'Report Refund / Margin Issue'
                            : 'Report Delivery Dispute'}
                        </h3>
                        <p className="text-[11px] text-neutral-400">
                          Dropship #{reportingIssueOrder.orderNumber} ·{' '}
                          {reportingIssueType === 'refund' ? 'Settlement Inquiry' : 'Parcel Non-Receipt Dispute'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setReportingIssueOrder(null);
                        setIssueFeedback(null);
                      }}
                      className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmitIssue} className="p-5 space-y-4 text-xs">
                    <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-neutral-800 space-y-1">
                      <p>
                        <strong>Recipient:</strong> {reportingIssueOrder.dropshipRecipient?.name || reportingIssueOrder.customer.name} (
                        {reportingIssueOrder.dropshipRecipient?.phone || reportingIssueOrder.customer.phone})
                      </p>
                      <p>
                        <strong>Order Status:</strong> {reportingIssueOrder.status}
                      </p>
                      {reportingIssueOrder.shippingDetails && (
                        <p className="text-[11px] text-neutral-600">
                          <strong>Courier:</strong> {reportingIssueOrder.shippingDetails.courierName} · Tracking: {reportingIssueOrder.shippingDetails.trackingNumber}
                        </p>
                      )}
                      <p className="text-[11px] text-neutral-500 pt-1">
                        Destination: {reportingIssueOrder.dropshipRecipient?.address || reportingIssueOrder.customer.address},{' '}
                        {reportingIssueOrder.dropshipRecipient?.city || reportingIssueOrder.customer.city} -{' '}
                        {reportingIssueOrder.dropshipRecipient?.pincode || reportingIssueOrder.customer.pincode}
                      </p>
                    </div>

                    <div>
                      <label className="block font-bold text-neutral-800 mb-1">
                        {reportingIssueType === 'refund'
                          ? 'Refund / Settlement Inquiry Explanation *'
                          : 'Delivery Issue Description *'}
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={issueDescription}
                        onChange={(e) => setIssueDescription(e.target.value)}
                        placeholder={
                          reportingIssueType === 'refund'
                            ? 'Please specify your margin settlement or payment reconciliation query.'
                            : 'Explain details: e.g. Courier system says delivered, but customer states parcel not received.'
                        }
                        className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-hidden focus:border-purple-500"
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
                                ? 'Submit Settlement Inquiry'
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

            {/* MODAL 3: Dropship Packing Slip Modal */}
            {printingSlipOrder && (
              <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
                <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in zoom-in-95 duration-200">
                  <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Printer className="w-5 h-5 text-purple-300" />
                      <h3 className="font-serif text-base font-bold">
                        Dropship Packing Slip #{printingSlipOrder.orderNumber}
                      </h3>
                    </div>
                    <button
                      onClick={() => setPrintingSlipOrder(null)}
                      className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4 text-xs text-neutral-900 bg-white" id="dropship-packing-slip">
                    {/* Slip Header */}
                    <div className="border-b-2 border-neutral-900 pb-3 flex items-center justify-between">
                      <div>
                        <h4 className="font-serif font-bold text-lg text-neutral-900 tracking-tight">
                          DROPSHIP DISPATCH SLIP
                        </h4>
                        <p className="text-[11px] text-neutral-500">
                          B2B Fulfillment Center · Plain Unbranded Packaging
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-sm block">#{printingSlipOrder.orderNumber}</span>
                        <span className="text-[10px] text-neutral-500">
                          Date: {new Date(printingSlipOrder.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Ship To Block */}
                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                        DELIVERY DESTINATION
                      </span>
                      <p className="font-bold text-sm text-neutral-900">
                        {printingSlipOrder.dropshipRecipient?.name || printingSlipOrder.customer.name}
                      </p>
                      <p className="text-xs text-neutral-700">
                        {printingSlipOrder.dropshipRecipient?.address || printingSlipOrder.customer.address}
                      </p>
                      <p className="text-xs text-neutral-700">
                        {printingSlipOrder.dropshipRecipient?.city || printingSlipOrder.customer.city},{' '}
                        {printingSlipOrder.dropshipRecipient?.state || printingSlipOrder.customer.state} -{' '}
                        <strong>{printingSlipOrder.dropshipRecipient?.pincode || printingSlipOrder.customer.pincode}</strong>
                      </p>
                      <p className="text-xs font-semibold text-neutral-900 pt-0.5">
                        Phone: +91 {printingSlipOrder.dropshipRecipient?.phone || printingSlipOrder.customer.phone}
                      </p>
                    </div>

                    {/* Items List (Strictly NO prices for dropshipping) */}
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">
                        Package Contents ({printingSlipOrder.items.length} items)
                      </span>
                      <table className="w-full text-left border border-neutral-200 rounded-xl overflow-hidden text-xs">
                        <thead className="bg-neutral-100 text-neutral-700 font-bold border-b border-neutral-200">
                          <tr>
                            <th className="p-2">Item Description</th>
                            <th className="p-2">SKU</th>
                            <th className="p-2 text-center">Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {printingSlipOrder.items.map((it, idx) => (
                            <tr key={idx}>
                              <td className="p-2 font-medium">
                                {it.product.title}
                                <span className="block text-[10px] text-neutral-500">
                                  {it.product.fabric} &middot; {it.product.color}
                                </span>
                              </td>
                              <td className="p-2 font-mono text-[11px] text-neutral-600">
                                {it.product.productCode || '-'}
                              </td>
                              <td className="p-2 text-center font-bold">{it.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Courier info if available */}
                    {printingSlipOrder.shippingDetails?.trackingNumber && (
                      <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-between text-xs">
                        <span>
                          Carrier: <strong>{printingSlipOrder.shippingDetails.courierName}</strong>
                        </span>
                        <span className="font-mono font-bold">
                          AWB: {printingSlipOrder.shippingDetails.trackingNumber}
                        </span>
                      </div>
                    )}

                    <p className="text-[10px] text-neutral-400 text-center italic pt-1">
                      Thank you for your order. For any inquiries, please contact your order representative.
                    </p>
                  </div>

                  <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setPrintingSlipOrder(null)}
                      className="px-4 py-2 rounded-xl bg-neutral-200 text-neutral-800 text-xs font-semibold hover:bg-neutral-300 transition cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-5 py-2 rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Packing Slip</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Paytm Wholesale Gateway Modal */}
            <PaytmCheckoutModal
              isOpen={isResellerPaytmOpen}
              onClose={() => setIsResellerPaytmOpen(false)}
              orderNumber={pendingResellerOrderNumber}
              amount={totalResellerCost}
              customerName={currentReseller?.name || recipientName || 'Reseller Partner'}
              customerPhone={currentReseller?.whatsappNumber || recipientPhone || '9876543210'}
              customerEmail={currentReseller?.email}
              onPaymentSuccess={handleResellerPaytmSuccess}
              onPaymentFailure={(err) => {
                setIsResellerPaytmOpen(false);
                setOrderError(`Paytm Wholesale Gateway Error: ${err}`);
              }}
            />
          </div>
        </div>
  );
};

