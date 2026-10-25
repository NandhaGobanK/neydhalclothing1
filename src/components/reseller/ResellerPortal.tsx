import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, Order, ResellerUser, CartItem } from '../../types/store';
import { formatPrice, getUpiQrCodeImageUrl } from '../../utils/upi';
import { downloadSingleImage, downloadAllProductImagesZip } from '../../utils/imageDownload';
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
  LogOut,
  AlertCircle,
  ArrowRight,
  ShoppingBag,
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
    placeResellerOrder,
    publicProducts,
    products,
    categories,
    settings,
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
              url('/assets/aistudio/Neydhal_logo_a18d5bd8.jpeg')
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
              src="/assets/aistudio/Neydhal_logo_a18d5bd8.jpeg"
              alt={settings.boutiqueName || 'Neydhal'}
              className="w-11 h-11 rounded-2xl object-cover shadow-lg border border-amber-300/40"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
                  {settings.boutiqueName || 'Neydhal'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-200 border border-amber-400/30">
                  B2B Wholesale Portal
                </span>
              </div>
              <p className="text-xs text-purple-200/80 hidden sm:block">
                Exclusive partner channel for boutiques, WhatsApp resellers & catalog dropshippers
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
                  Wholesale Partner Program
                </span>
                <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white leading-tight">
                  Empowering Resellers & Boutiques
                </h2>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  Join our enterprise network to source pure handcrafted silk sarees at direct weaver wholesale prices with guaranteed high margins and zero dead-stock risk.
                </p>
              </div>

              {/* B2B Perks List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <span className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
                    <DollarSign className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-white">20% Flat Wholesale Margin</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">Instant discount applied to all Kanjivaram, Banarasi, and Chanderi sarees.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <span className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Truck className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-white">White-Label Blind Dropshipping</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">We dispatch directly to your end buyers with unbranded packaging and no invoices.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <span className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Download className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-white">1-Click High-Res Media Packs</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">Download unwatermarked ZIP packs and single photos for WhatsApp & Instagram.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <span className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-white">Dedicated Dispatch & Support</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">Express DTDC & Blue Dart courier with real-time tracking links for your customers.</p>
                  </div>
                </div>
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
                        Resellers cannot log in without administrator authorization. Once your access request is approved on the admin Reseller Ledger, your account is saved in the database for instant authentication.
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
              <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white flex items-center justify-center shadow-md border border-purple-400/30 shrink-0">
                <Store className="w-6 h-6" />
              </span>
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

            {/* TAB 2: RESELLER ORDERS & DROPSHIPS (CATEGORIZED INDEPENDENTLY) */}
            {activeTab === 'orders' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-neutral-900 font-serif">
                      Reseller Dropships & Bulk Orders
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Orders categorized strictly under reseller ID: <code>{currentReseller.id}</code>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('new_order')}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    + Place New Dropship
                  </button>
                </div>

                {resellerOrders.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200 p-8 space-y-3">
                    <Package className="w-10 h-10 text-neutral-400 mx-auto" />
                    <h4 className="font-serif font-bold text-neutral-800 text-base">
                      No Reseller Orders Placed Yet
                    </h4>
                    <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                      Explore the wholesale catalog, download images to your WhatsApp catalog, and
                      place your first dropship order.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('catalog')}
                      className="px-4 py-2 rounded-xl bg-purple-900 text-white font-bold text-xs cursor-pointer"
                    >
                      Browse Wholesale Catalog
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {resellerOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 shadow-2xs hover:shadow-md transition space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded">
                                #{ord.orderNumber}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                                Wholesale Dropship
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-800">
                                {ord.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-400 mt-0.5">
                              Submitted {new Date(ord.createdAt).toLocaleDateString()} at{' '}
                              {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>

                          <div className="flex items-center gap-4">
                            <div>
                              <span className="text-[10px] text-neutral-500 block">Wholesale Total</span>
                              <span className="font-bold text-neutral-900 text-sm">
                                {formatPrice(ord.totalAmount)}
                              </span>
                            </div>
                            {ord.resellerMargin !== undefined && (
                              <div className="text-right">
                                <span className="text-[10px] text-emerald-600 block font-semibold">Your Margin</span>
                                <span className="font-bold text-emerald-700 text-sm">
                                  +₹{ord.resellerMargin.toLocaleString('en-IN')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Line items */}
                        <div className="space-y-1.5">
                          {ord.items.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                {it.product.images?.[0] && (
                                  <img
                                    src={it.product.images[0]}
                                    alt={it.product.title}
                                    className="w-8 h-10 object-cover rounded border border-neutral-200"
                                  />
                                )}
                                <span>
                                  <strong>{it.product.title}</strong> (x{it.quantity})
                                </span>
                              </div>
                              <span className="text-neutral-600">
                                {formatPrice(it.product.price * it.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Dropship Recipient Details */}
                        {ord.dropshipRecipient && (
                          <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs space-y-1">
                            <span className="font-bold text-neutral-700 text-[10px] uppercase tracking-wider block">
                              End-Customer Delivery Address
                            </span>
                            <p className="font-semibold text-neutral-900">
                              {ord.dropshipRecipient.name} · 📱 +91 {ord.dropshipRecipient.phone}
                            </p>
                            <p className="text-neutral-600 text-[11px]">
                              {ord.dropshipRecipient.address}, {ord.dropshipRecipient.city},{' '}
                              {ord.dropshipRecipient.state} - <strong>{ord.dropshipRecipient.pincode}</strong>
                            </p>
                          </div>
                        )}

                        {/* Courier Tracking if available */}
                        {ord.shippingDetails?.trackingNumber && (
                          <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 text-xs flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-purple-900">
                              <Truck className="w-4 h-4 text-purple-700" />
                              <span>
                                {ord.shippingDetails.courierName || 'Courier'}:{' '}
                                <strong className="font-mono">{ord.shippingDetails.trackingNumber}</strong>
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200">
                              In Transit
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
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
          </div>
        </div>
  );
};

