import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, Order, OrderStatus, ResellerUser, CartItem } from '../../types/store';
import { formatPrice, getUpiQrCodeImageUrl } from '../../utils/upi';
import { downloadSingleImage, downloadAllProductImagesZip } from '../../utils/imageDownload';
import { buildCourierTrackingUrl, resolveCourierDetails } from '../../utils/courier';
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
  ChevronDown,
  LogOut,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShoppingBag,
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
  const [activeTab, setActiveTab] = useState<'catalog' | 'orders' | 'new_order' | 'earnings'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');

  // Media download & copy states
  const [downloadingZipId, setDownloadingZipId] = useState<string | null>(null);
  const [copiedPitchId, setCopiedPitchId] = useState<string | null>(null);

  // New Wholesale / Dropship Order Flow
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [resaleSellingPrice, setResaleSellingPrice] = useState<number>(0);
  const [deliveryType, setDeliveryType] = useState<'dropship' | 'self'>('dropship');

  // End-customer dropship recipient fields
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientCity, setRecipientCity] = useState('');
  const [recipientState, setRecipientState] = useState('Tamil Nadu');
  const [recipientPincode, setRecipientPincode] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderUtr, setOrderUtr] = useState('');
  const [orderError, setOrderError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState<Order | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

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
    const phoneToUse = cancellingOrder.dropshipRecipient?.phone || cancellingOrder.customer.phone;
    const res = requestOrderCancellation(cancellingOrder.orderNumber, phoneToUse, finalReason);
    if (res.success) {
      setCancelStatusMsg({ type: 'success', text: res.message });
      setCancellingOrder(null);
    } else {
      setCancelStatusMsg({ type: 'error', text: res.message });
    }
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

  // Select product for wholesale order
  const handleStartOrder = (prod: Product) => {
    setSelectedProduct(prod);
    setOrderQuantity(1);
    setResaleSellingPrice(prod.price);
    setActiveTab('new_order');
    setOrderSuccess(null);
    setOrderError('');
  };

  const handlePlaceOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !currentReseller) return;
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

    const cleanUtr = orderUtr.replace(/\D/g, '');
    if (!cleanUtr || cleanUtr.length !== 12) {
      setOrderError('Please enter the 12-digit UPI Transaction ID (UTR) for wholesale settlement.');
      return;
    }

    setIsPlacingOrder(true);
    try {
      const wholesaleUnitPrice = getWholesalePrice(selectedProduct.price);
      const totalWholesaleCost = wholesaleUnitPrice * orderQuantity;
      const totalCustomerPrice = (resaleSellingPrice || selectedProduct.price) * orderQuantity;
      const calculatedMargin = Math.max(0, totalCustomerPrice - totalWholesaleCost);

      const cartItem: CartItem = {
        product: {
          ...selectedProduct,
          price: wholesaleUnitPrice, // wholesale price charged to reseller
        },
        quantity: orderQuantity,
      };

      const recipient =
        deliveryType === 'dropship'
          ? {
              name: recipientName.trim(),
              phone: recipientPhone.replace(/\D/g, '').slice(-10),
              address: recipientAddress.trim(),
              city: recipientCity.trim(),
              state: recipientState.trim(),
              pincode: recipientPincode.trim(),
            }
          : {
              name: currentReseller.name,
              phone: currentReseller.whatsappNumber,
              address: currentReseller.businessName,
              city: currentReseller.city || 'Salem',
              state: currentReseller.state || 'Tamil Nadu',
              pincode: '636001',
            };

      const newOrder = await placeResellerOrder({
        items: [cartItem],
        dropshipRecipient: recipient,
        resellerMargin: calculatedMargin,
        upiTransactionId: cleanUtr,
        notes: `[Reseller: ${currentReseller.businessName}] ${orderNotes ? `Notes: ${orderNotes}` : ''}`,
      });

      setOrderSuccess(newOrder);
      setOrderUtr('');
      setRecipientName('');
      setRecipientPhone('');
      setRecipientAddress('');
      setRecipientCity('');
      setRecipientPincode('');
    } catch (err: any) {
      setOrderError(err?.message || 'Failed to place reseller order.');
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
                  {settings.resellerLoginDisplay?.headerBadgeText || 'B2B Wholesale Portal'}
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
            {/* Left Column: B2B Value Proposition & Wholesale Perks */}
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-400/30">
                  <Sparkles className="w-3.5 h-3.5" />
                  {settings.resellerLoginDisplay?.programBadge || 'Wholesale Partner Program'}
                </span>
                <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white leading-tight">
                  {settings.resellerLoginDisplay?.headline || 'Empowering Resellers & Boutiques'}
                </h2>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  {settings.resellerLoginDisplay?.description ||
                    'Join our enterprise network to source pure handcrafted silk sarees at direct weaver wholesale prices with guaranteed high margins and zero dead-stock risk.'}
                </p>
              </div>

              {/* B2B Perks List */}
              <div className="space-y-3 pt-2">
                {(settings.resellerLoginDisplay?.perks && settings.resellerLoginDisplay.perks.length > 0
                  ? settings.resellerLoginDisplay.perks
                  : [
                      {
                        id: 'perk-margin',
                        title: '20% Flat Wholesale Margin',
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
                        Sign in with your approved Google email to unlock wholesale margins, blind dropshipping, and high-res media packs.
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
                        Need wholesale access?{' '}
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
                    B2B Wholesale Hub
                  </span>
                </div>
                <p className="text-xs text-neutral-300 mt-0.5">
                  Logged in: {currentReseller.name} &middot; WhatsApp: +91 {currentReseller.whatsappNumber} &middot; Tier: {currentReseller.wholesaleDiscountPercent}% Wholesale Margin
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
              onClick={() => setActiveTab('catalog')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-neutral-300 hover:text-white bg-white/5'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Wholesale Catalog ({filteredProducts.length})</span>
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
              onClick={() => setActiveTab('new_order')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'new_order'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-neutral-300 hover:text-white bg-white/5'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Create Dropship Order</span>
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
          </div>
        </div>
      </div>

      {/* Authenticated Reseller Content Body */}
      <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-neutral-50/50 max-w-7xl mx-auto w-full">
            {/* TAB 1: WHOLESALE CATALOG & MEDIA PACKS */}
            {activeTab === 'catalog' && (
              <div className="space-y-4">
                {/* Search & Category Filter Toolbar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-neutral-200 shadow-2xs">
                  <div className="relative w-full sm:w-72">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search wholesale products..."
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:ring-1 focus:ring-purple-700"
                    />
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setSelectedCat('all')}
                      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
                        selectedCat === 'all'
                          ? 'bg-purple-900 text-white'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      All Categories
                    </button>
                    {categories.slice(0, 5).map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCat(cat.name)}
                        className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
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

                {/* Catalog Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProducts.map((prod) => {
                    const wholesalePrice = getWholesalePrice(prod.price);
                    const retailPrice = prod.price;
                    const estimatedMargin = retailPrice - wholesalePrice;

                    return (
                      <div
                        key={prod.id}
                        className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-2xs hover:shadow-md transition flex flex-col justify-between"
                      >
                        <div>
                          {/* Image Thumbnail with 1-Click Download Pack */}
                          <div className="relative aspect-4/3 bg-neutral-100 overflow-hidden">
                            <img
                              src={prod.images[0]}
                              alt={prod.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 left-2 flex items-center gap-1">
                              <span className="px-2 py-0.5 rounded-full bg-purple-900/90 text-white text-[10px] font-bold backdrop-blur-xs shadow-xs">
                                Wholesale Tier: {currentReseller.wholesaleDiscountPercent}% OFF
                              </span>
                            </div>

                            {/* Download All Images Pack Button */}
                            <button
                              type="button"
                              onClick={(e) => handleDownloadImagePack(prod, e)}
                              disabled={downloadingZipId === prod.id}
                              className="absolute bottom-2 right-2 px-2.5 py-1.5 rounded-xl bg-black/80 hover:bg-black text-white text-[11px] font-bold backdrop-blur-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              title="Download complete high-res photo pack in ZIP"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>
                                {downloadingZipId === prod.id ? 'Packaging...' : 'Download HD Pack (.ZIP)'}
                              </span>
                            </button>
                          </div>

                          <div className="p-4 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                                {prod.fabric || prod.category}
                              </span>
                              <span className="font-mono text-[10px] font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                                {prod.productCode}
                              </span>
                            </div>

                            <h3 className="font-serif font-bold text-sm text-neutral-900 leading-tight">
                              {prod.title}
                            </h3>

                            {/* Pricing & Margin Card */}
                            <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100 flex items-center justify-between">
                              <div>
                                <span className="block text-[10px] text-purple-700 font-semibold uppercase">
                                  Your Wholesale Cost
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

                        {/* Action buttons */}
                        <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleCopyWhatsAppPitch(prod, e)}
                            className="py-2 px-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Copy ready-to-share product description for WhatsApp"
                          >
                            {copiedPitchId === prod.id ? (
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

                          <button
                            type="button"
                            onClick={() => handleStartOrder(prod)}
                            className="py-2 px-2.5 rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Order Wholesale</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                            : 'Browse the wholesale catalog, share saree pitches on WhatsApp, and place your first dropship order.'}
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
                            onClick={() => setActiveTab('catalog')}
                            className="px-4 py-2 rounded-xl bg-purple-900 text-white font-bold text-xs cursor-pointer"
                          >
                            Browse Wholesale Catalog
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
                                    Wholesale Dropship
                                  </span>

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
                                    <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Wholesale Total</span>
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
                          Wholesale Settlement
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
                                  ({formatPrice(item.product.price)} each wholesale)
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
                              Wholesale Discount: {currentReseller.wholesaleDiscountPercent}%
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
                          setActiveTab('new_order');
                        }}
                        className="px-4 py-2 rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                      >
                        + Place Another Dropship
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: CREATE NEW DROPSHIP ORDER */}
            {activeTab === 'new_order' && (
              <div className="max-w-2xl mx-auto space-y-4">
                <div>
                  <h3 className="text-base font-bold text-neutral-900 font-serif">
                    Create Wholesale Dropship Order
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Boutique packages discreetly with plain packaging (no boutique price tags).
                  </p>
                </div>

                {orderSuccess ? (
                  <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3 animate-in fade-in">
                    <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
                    <h4 className="font-serif font-bold text-lg text-emerald-950">
                      Wholesale Order Placed Successfully!
                    </h4>
                    <p className="text-xs text-emerald-800">
                      Order reference <strong className="font-mono">#{orderSuccess.orderNumber}</strong> has
                      been dispatched to the boutique fulfillment team.
                    </p>
                    <div className="pt-2 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab('orders')}
                        className="px-4 py-2 rounded-xl bg-emerald-800 text-white font-bold text-xs cursor-pointer"
                      >
                        View in Reseller Orders &rarr;
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOrderSuccess(null);
                          setSelectedProduct(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-bold text-xs cursor-pointer"
                      >
                        Place Another Order
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handlePlaceOrderSubmit} className="space-y-4">
                    {orderError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{orderError}</span>
                      </div>
                    )}

                    {/* Step 1: Select Item */}
                    <div className="bg-white p-4 rounded-2xl border border-neutral-200 space-y-3">
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-800">
                        1. Select Product for Dropship
                      </label>
                      {selectedProduct ? (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50/70 border border-purple-100">
                          <div className="flex items-center gap-3">
                            <img
                              src={selectedProduct.images[0]}
                              alt={selectedProduct.title}
                              className="w-12 h-14 object-cover rounded-md border border-purple-200"
                            />
                            <div>
                              <p className="font-serif font-bold text-xs text-neutral-900">
                                {selectedProduct.title}
                              </p>
                              <p className="text-[11px] text-neutral-500 font-mono">
                                Code: {selectedProduct.productCode}
                              </p>
                              <p className="text-xs text-purple-900 font-bold mt-0.5">
                                Wholesale Price: {formatPrice(getWholesalePrice(selectedProduct.price))}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedProduct(null)}
                            className="text-xs text-purple-700 font-bold hover:underline"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                          {publicProducts.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedProduct(p);
                                setResaleSellingPrice(p.price);
                              }}
                              className="p-2 rounded-xl bg-neutral-50 hover:bg-purple-50 text-left border border-neutral-200 transition cursor-pointer"
                            >
                              <img
                                src={p.images[0]}
                                alt={p.title}
                                className="w-full aspect-square object-cover rounded-lg mb-1"
                              />
                              <p className="text-[11px] font-bold text-neutral-900 truncate">
                                {p.title}
                              </p>
                              <p className="text-[10px] text-purple-700 font-bold">
                                {formatPrice(getWholesalePrice(p.price))}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Quantity & Resale Price */}
                      {selectedProduct && (
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div>
                            <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                              Quantity
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={selectedProduct.stockCount || 10}
                              value={orderQuantity}
                              onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                              Your Customer Resale Price (₹)
                            </label>
                            <input
                              type="number"
                              value={resaleSellingPrice}
                              onChange={(e) => setResaleSellingPrice(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 2: Delivery Destination */}
                    <div className="bg-white p-4 rounded-2xl border border-neutral-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-800">
                          2. Delivery Destination
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDeliveryType('dropship')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              deliveryType === 'dropship'
                                ? 'bg-purple-900 text-white'
                                : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            Direct Customer Dropship
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeliveryType('self')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              deliveryType === 'self'
                                ? 'bg-purple-900 text-white'
                                : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            Ship to My Business
                          </button>
                        </div>
                      </div>

                      {deliveryType === 'dropship' ? (
                        <div className="space-y-3 pt-1">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                                Customer Name *
                              </label>
                              <input
                                type="text"
                                required
                                value={recipientName}
                                onChange={(e) => setRecipientName(e.target.value)}
                                placeholder="Recipient name"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
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
                                onChange={(e) => setRecipientPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                placeholder="9876543210"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                              Street Address, Flat, House No. *
                            </label>
                            <textarea
                              rows={2}
                              required
                              value={recipientAddress}
                              onChange={(e) => setRecipientAddress(e.target.value)}
                              placeholder="Full delivery location details"
                              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
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
                                onChange={(e) => setRecipientCity(e.target.value)}
                                placeholder="e.g. Madurai"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
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
                                onChange={(e) => setRecipientState(e.target.value)}
                                placeholder="Tamil Nadu"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
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
                                onChange={(e) => setRecipientPincode(e.target.value.replace(/\D/g, ''))}
                                placeholder="625001"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-neutral-100 text-xs text-neutral-700">
                          Parcel will be delivered directly to <strong>{currentReseller.businessName}</strong>,{' '}
                          {currentReseller.city || 'Salem'}, Tamil Nadu.
                        </div>
                      )}
                    </div>

                    {/* Step 3: Wholesale Payment Settlement */}
                    {selectedProduct && (
                      <div className="bg-white p-4 rounded-2xl border border-neutral-200 space-y-3">
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-800">
                          3. Wholesale Settlement & UTR
                        </label>

                        {(() => {
                          const wholesaleUnit = getWholesalePrice(selectedProduct.price);
                          const wholesaleTotal = wholesaleUnit * orderQuantity;
                          const totalCustomer = (resaleSellingPrice || selectedProduct.price) * orderQuantity;
                          const netMargin = Math.max(0, totalCustomer - wholesaleTotal);

                          return (
                            <div className="p-3 rounded-xl bg-purple-50/80 border border-purple-200 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-neutral-600">Wholesale Amount to Pay</span>
                                <span className="font-bold text-purple-950 text-base">
                                  {formatPrice(wholesaleTotal)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-neutral-600">Customer Price Collected</span>
                                <span className="font-bold text-neutral-900">
                                  {formatPrice(totalCustomer)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs border-t border-purple-200/80 pt-1.5">
                                <span className="font-bold text-emerald-800">Your Reseller Profit Margin</span>
                                <span className="font-bold text-emerald-700 text-sm">
                                  +₹{netMargin.toLocaleString('en-IN')}
                                </span>
                              </div>

                              <div className="pt-2">
                                <label className="block text-[11px] font-bold text-neutral-800 mb-1">
                                  Enter 12-digit Payment UTR *
                                </label>
                                <input
                                  type="text"
                                  required
                                  maxLength={12}
                                  value={orderUtr}
                                  onChange={(e) => setOrderUtr(e.target.value.replace(/\D/g, '').slice(0, 12))}
                                  placeholder="12-digit UPI Transaction ID (e.g. 504128912345)"
                                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-mono"
                                />
                                <p className="text-[10px] text-neutral-500 mt-0.5">
                                  Boutique UPI ID: <strong>{settings.payment.upiId}</strong> ({settings.payment.payeeName})
                                </p>
                              </div>
                            </div>
                          );
                        })()}

                        <button
                          type="submit"
                          disabled={isPlacingOrder || !selectedProduct}
                          className="w-full py-3 rounded-xl bg-purple-900 hover:bg-purple-800 text-white font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50"
                        >
                          {isPlacingOrder ? 'Dispatching Order...' : 'Submit Wholesale Dropship Order'}
                        </button>
                      </div>
                    )}
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
                    Track your wholesale order volume and net profit margin earned.
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
                      Wholesale Volume
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

                {/* Wholesale Partner Benefits Card */}
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
                        do not mention wholesale price tags.
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
                      <p>Wholesale Total: <strong className="text-neutral-900 font-serif">{formatPrice(cancellingOrder.totalAmount)}</strong></p>
                      <p className="text-[11px] text-emerald-800 pt-1">
                        Refund will be credited back to your registered reseller account / UPI after boutique review.
                      </p>
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
                        className="w-full py-2.5 px-4 rounded-xl bg-rose-900 hover:bg-rose-800 text-white font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Check className="w-4 h-4" />
                        <span>Submit Cancellation Request</span>
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
          </div>
        </div>
  );
};

