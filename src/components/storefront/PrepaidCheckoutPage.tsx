import React, { useState, useEffect, useId } from 'react';
import QRCode from 'qrcode';
import { useStore, getBoutiqueOrderPrefix } from '../../context/StoreContext';
import { formatPrice } from '../../utils/upi';
import { useDeviceType } from '../../utils/deviceDetection';
import {
  compressPaymentScreenshot,
  CompressedScreenshotResult,
} from '../../utils/imageCompression';
import { uploadPaymentScreenshot } from '../../utils/firebase';
import {
  ShieldCheck,
  AlertCircle,
  Lock,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  QrCode,
  Smartphone,
  Tablet,
  Monitor,
  Copy,
  Check,
  Upload,
  Image as ImageIcon,
  ZoomIn,
  RefreshCw,
  ExternalLink,
  HelpCircle,
  FileCheck2,
  Info,
  ChevronDown,
  ChevronUp,
  User,
  ShoppingBag,
  X,
} from 'lucide-react';

interface PrepaidCheckoutPageProps {
  onBack: () => void;
  onSuccess: () => void;
}

export const PrepaidCheckoutPage: React.FC<PrepaidCheckoutPageProps> = ({ onBack, onSuccess }) => {
  const {
    cart,
    cartTotal,
    cartShippingFee,
    cartGrandTotal,
    settings,
    placeOrder,
    currentCustomer,
  } = useStore();

  const deviceType = useDeviceType();
  const fileInputId = useId();

  const defaultAddr =
    currentCustomer?.savedAddresses?.find((a) => a.isDefault) ||
    currentCustomer?.savedAddresses?.[0];

  // Delivery Form states
  const [name, setName] = useState(currentCustomer?.name || '');
  const [phone, setPhone] = useState(currentCustomer?.phone || '');
  const [email, setEmail] = useState(currentCustomer?.email || '');
  const [address, setAddress] = useState(defaultAddr?.address || '');
  const [city, setCity] = useState(defaultAddr?.city || '');
  const [state, setState] = useState(defaultAddr?.state || 'Tamil Nadu');
  const [pincode, setPincode] = useState(defaultAddr?.pincode || '');
  const [notes, setNotes] = useState('');

  // Fixed order reference generated at checkout open
  const [orderNumber] = useState(() => {
    const prefix = getBoutiqueOrderPrefix(settings.boutiqueName);
    return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
  });

  // Tablet payment view toggle ('intent' or 'qr')
  const [tabletView, setTabletView] = useState<'intent' | 'qr'>('intent');
  // Mobile QR toggle (in case mobile user wants to scan from a different phone)
  const [showMobileQr, setShowMobileQr] = useState(false);

  // Dynamic QR Code data URL
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(true);

  // Screenshot Upload & Compression state (Optional)
  const [screenshotResult, setScreenshotResult] =
    useState<CompressedScreenshotResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionError, setCompressionError] = useState<string | null>(null);
  const [previewZoomModal, setPreviewZoomModal] = useState<string | null>(null);
  const [showOptionalScreenshot, setShowOptionalScreenshot] = useState(false);

  // Reference guide image zoom lightbox
  const [previewGuideModal, setPreviewGuideModal] = useState<{
    app: string;
    image: string;
    instruction: string;
    sampleRef: string;
  } | null>(null);

  // Customer entered UTR / Reference No. (Strictly 12 numeric digits required)
  const [enteredUtr, setEnteredUtr] = useState('');

  // Submission / Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Active guidance tab for app receipt instructions
  const [activeAppGuide, setActiveAppGuide] = useState<
    'phonepe' | 'gpay' | 'paytm' | 'bhim'
  >('phonepe');

  // Collapsible step toggles
  const [isHowToPayOpen, setIsHowToPayOpen] = useState(true);
  const [isAppGuidesOpen, setIsAppGuidesOpen] = useState(true);

  // Merchant details
  const merchantUpiId = (settings.payment.upiId || '8807392520@okbizaxis').trim();
  const merchantName = (settings.payment.payeeName || settings.payment.merchantName || 'Neydhal Boutique').trim();
  const merchantUpiOwnerName = (
    settings.payment.upiOwnerName ||
    settings.payment.payeeName ||
    settings.payment.merchantName ||
    'Neydhal Clothing'
  ).trim();
  const formattedAmount = cartGrandTotal.toFixed(2);
  const transactionNote = `ORDER #${orderNumber} • NEYDHAL CLOTHING`;

  // Direct UPI Intent URI pre-filled with merchant details, total amount, and order reference
  const upiIntentUri = `upi://pay?pa=${encodeURIComponent(merchantUpiId)}&pn=${encodeURIComponent(
    merchantUpiOwnerName || merchantName
  )}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(transactionNote)}&tr=${encodeURIComponent(
    orderNumber
  )}`;

  // Generate dynamic QR code using exact same UPI Intent URI
  useEffect(() => {
    let isCancelled = false;
    setIsGeneratingQr(true);

    QRCode.toDataURL(upiIntentUri, {
      width: 360,
      margin: 1.5,
      color: {
        dark: '#1e1b4b',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!isCancelled) {
          setQrDataUrl(url);
          setIsGeneratingQr(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate local UPI QR code:', err);
        if (!isCancelled) {
          // Fallback to online QR service
          setQrDataUrl(
            `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
              upiIntentUri
            )}&margin=12`
          );
          setIsGeneratingQr(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [upiIntentUri]);

  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2200);
  };

  // Client-Side Image Compression using browser-image-compression
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setCompressionError('Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    setIsCompressing(true);
    setCompressionError(null);

    try {
      const result = await compressPaymentScreenshot(file);
      setScreenshotResult(result);
    } catch (err: any) {
      console.error('Screenshot compression error:', err);
      setCompressionError(
        err?.message || 'Failed to compress image. Please choose another screenshot file.'
      );
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const handleRemoveScreenshot = () => {
    setScreenshotResult(null);
    setCompressionError(null);
  };

  // Form Validation
  const validateDeliveryForm = (): boolean => {
    if (!name.trim()) {
      setErrorMsg('Please enter your full delivery name.');
      return false;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setErrorMsg('Please provide a valid 10-digit mobile number.');
      return false;
    }
    if (email.trim() && !email.includes('@')) {
      setErrorMsg('Please provide a valid email address or leave it blank.');
      return false;
    }
    if (!address.trim() || !city.trim() || !state.trim()) {
      setErrorMsg('Please complete your full delivery address (Door No, Street, City, State).');
      return false;
    }
    if (pincode.replace(/\D/g, '').length !== 6) {
      setErrorMsg('Please enter a valid 6-digit Indian postal pincode.');
      return false;
    }

    // UTR / Transaction ID 12-digit validation (Mandatory)
    const cleanUtr = enteredUtr.replace(/\D/g, '').trim();
    if (!cleanUtr) {
      setErrorMsg('Please enter your 12-digit reference number / UTR from your payment app.');
      return false;
    }
    if (cleanUtr.length !== 12) {
      setErrorMsg(
        `Please enter exactly 12 numeric digits for your UTR / Transaction ID (currently ${cleanUtr.length}/12 digits entered).`
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (cart.length === 0) {
      setErrorMsg('Your shopping bag is empty. Please add products before placing an order.');
      return;
    }

    if (!validateDeliveryForm()) {
      return;
    }

    const cleanUtr = enteredUtr.replace(/\D/g, '').trim();

    try {
      setIsSubmitting(true);
      let uploadedScreenshotUrl: string | undefined = undefined;

      if (screenshotResult?.file) {
        setUploadProgressText('Uploading payment confirmation screenshot to secure cloud storage...');
        try {
          uploadedScreenshotUrl = await uploadPaymentScreenshot(
            screenshotResult.file,
            orderNumber
          );
        } catch (uploadErr) {
          console.warn('Screenshot upload encountered an issue, proceeding with order submission:', uploadErr);
        }
      }

      setUploadProgressText('Recording order details in store system...');

      await placeOrder({
        customer: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
        },
        items: cart,
        upiTransactionId: cleanUtr,
        paymentScreenshotUrl: uploadedScreenshotUrl || screenshotResult?.previewUrl || undefined,
        deviceType: deviceType,
        paymentGateway: 'upi_manual',
        notes: notes.trim() || undefined,
        checkoutMethod: 'submit_order',
      });
      onSuccess();
    } catch (err: any) {
      console.error('Failed to submit order:', err);
      setErrorMsg(
        err?.message ||
          'Failed to record your order. Please check your connection and retry.'
      );
    } finally {
      setIsSubmitting(false);
      setUploadProgressText('');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50/70 pb-32">
      {/* Top Sticky Navigation Bar with Single-Arrow "Go Back" */}
      <div className="sticky top-18 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200 px-4 py-3 sm:py-3.5 shadow-2xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-neutral-700 hover:text-neutral-950 px-3 py-1.5 rounded-xl hover:bg-neutral-100 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-rose-900" />
            <span>Go Back</span>
          </button>

          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-neutral-600">
              256-Bit Encrypted Direct UPI Checkout
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 space-y-6">
        {/* Prominent Header Banner - Responsive and collision-free */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-950 to-emerald-950 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Store Logo */}
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white p-1 border-2 border-emerald-400 shadow-md flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src={settings.logoUrl || '/logo.png'}
                alt="Neydhal Clothing Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-serif text-lg sm:text-xl font-bold tracking-wide">
                  Prepaid UPI Checkout
                </h1>
                {/* Neydhal Clothing Badge - Styled cleanly without overlapping */}
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-green-600 text-white font-black text-xs uppercase tracking-wide border border-emerald-300 shadow-2xs whitespace-nowrap">
                  <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                  <span>Neydhal Clothing</span>
                </span>
              </div>
              <p className="text-[11px] text-neutral-300">
                Direct retail store checkout & verified payment confirmation
              </p>
            </div>
          </div>

          {/* Bold Order Number Badge */}
          <div className="flex items-center gap-2 bg-black/60 border border-emerald-400/60 px-3.5 py-1.5 rounded-2xl shadow-inner shrink-0 self-start sm:self-auto">
            <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">
              Order:
            </span>
            <span className="font-mono text-sm sm:text-base font-black text-amber-300 tracking-wider">
              #{orderNumber}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(orderNumber, 'banner_order_num')}
              className="p-1 hover:bg-white/10 rounded text-neutral-300 hover:text-white cursor-pointer ml-1"
              title="Copy Order Number"
            >
              {copiedField === 'banner_order_num' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Empty Bag Safeguard */}
        {cart.length === 0 ? (
          <div className="bg-white rounded-3xl border border-neutral-200 p-12 text-center max-w-md mx-auto space-y-4 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-700 mx-auto flex items-center justify-center">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-neutral-900">Your bag is currently empty</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Please add items to your shopping bag before proceeding to checkout.
              </p>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition cursor-pointer shadow-sm"
            >
              <span>Return to Shopping</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Bag Summary & Total Payable */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                  <span>Bag Summary</span>
                  <span className="text-xs font-normal text-neutral-500">
                    ({cart.length} {cart.length === 1 ? 'item' : 'items'})
                  </span>
                </h3>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {cartShippingFee === 0 ? 'Free Insured Delivery' : 'Insured Delivery'}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3.5">
                {cart.map((item) => (
                  <span
                    key={item.product.id}
                    className="text-[11px] bg-neutral-50 border border-neutral-200 px-2.5 py-1 rounded-lg text-neutral-800 flex items-center gap-1.5 shadow-2xs"
                  >
                    <span className="font-medium">{item.product.title}</span>
                    <span className="text-neutral-500">×{item.quantity}</span>
                  </span>
                ))}
              </div>

              <div className="space-y-1.5 pt-3 border-t border-neutral-100 text-xs">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-neutral-900 tabular-nums">
                    {formatPrice(cartTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Shipping Fee:</span>
                  {cartShippingFee === 0 ? (
                    <span className="font-bold text-emerald-700">Free</span>
                  ) : (
                    <span className="font-semibold text-neutral-900 tabular-nums">
                      {formatPrice(cartShippingFee)}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-neutral-200 font-bold">
                  <span className="text-neutral-900 text-sm">Total Payable Amount:</span>
                  <span className="text-xl sm:text-2xl text-rose-950 font-serif tabular-nums font-bold">
                    {formatPrice(cartGrandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* STEP 1: Complete UPI Payment */}
            <div className="rounded-2xl border-2 border-neutral-900/10 overflow-hidden bg-white shadow-xs">
              <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 text-white px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-amber-400 text-neutral-950 font-bold text-xs">
                    STEP 1
                  </span>
                  <h3 className="font-serif text-sm font-bold tracking-wide">
                    Complete UPI Payment
                  </h3>
                </div>

                {/* Device Indicator Tag */}
                <div className="flex items-center gap-1.5 text-[11px] bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10 text-neutral-200">
                  {deviceType === 'mobile' && (
                    <>
                      <Smartphone className="w-3.5 h-3.5 text-amber-300" />
                      <span>Mobile Detected</span>
                    </>
                  )}
                  {deviceType === 'tablet' && (
                    <>
                      <Tablet className="w-3.5 h-3.5 text-amber-300" />
                      <span>Tablet / iPad Detected</span>
                    </>
                  )}
                  {deviceType === 'desktop' && (
                    <>
                      <Monitor className="w-3.5 h-3.5 text-amber-300" />
                      <span>Desktop Detected</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-4">
                {/* Verified Payee (UPI Owner Name) & Customer Name Overview for Trust */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50/70 to-blue-50/70 border-2 border-emerald-300 shadow-2xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Verified UPI Payee / Account Owner */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <ShieldCheck className="w-5 h-5 text-amber-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-900">
                            UPI Owner / Payee Name
                          </span>
                          <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-300">
                            Verified
                          </span>
                        </div>
                        <p className="font-serif font-black text-sm text-neutral-950 truncate">
                          {merchantUpiOwnerName}
                        </p>
                      </div>
                    </div>

                    {/* Customer Name */}
                    <div className="flex items-center gap-2.5 sm:border-l sm:border-emerald-200/90 sm:pl-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-blue-900 block">
                          Paying Customer
                        </span>
                        <p className="font-bold text-sm text-neutral-900 truncate">
                          {name.trim() || currentCustomer?.name || 'Customer / Patron'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1. MOBILE USER INTERFACE */}
                {deviceType === 'mobile' && (
                  <div className="space-y-4 text-center">
                    {/* Fixed Neydhal Logo and Order Badge - Words never collide */}
                    <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-emerald-100/90 via-emerald-50 to-green-100/90 border-2 border-emerald-500 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-white p-0.5 border border-emerald-400 shadow-2xs shrink-0 flex items-center justify-center">
                          <img
                            src={settings.logoUrl || '/logo.png'}
                            alt="Logo"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white font-black text-[11px] sm:text-xs uppercase tracking-wide border border-emerald-400 shadow-2xs inline-flex items-center gap-1 whitespace-nowrap">
                          <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                          <span>Neydhal Clothing</span>
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border-2 border-emerald-500 shadow-2xs shrink-0">
                        <span className="text-[10px] uppercase font-bold text-emerald-800">Order:</span>
                        <span className="font-mono font-black text-xs sm:text-sm text-emerald-950 tracking-wider">
                          #{orderNumber}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-600">
                      Tap the button below to launch your preferred UPI app directly with pre-filled amount and order reference.
                    </p>

                    {/* Primary Direct UPI Intent Button */}
                    <a
                      href={upiIntentUri}
                      className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 hover:from-emerald-500 hover:to-teal-700 text-white font-bold text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2.5 active:scale-98 select-none"
                    >
                      <Smartphone className="w-5 h-5 text-amber-300 animate-bounce" />
                      <span>Pay {formatPrice(cartGrandTotal)} via UPI App</span>
                      <ArrowRight className="w-5 h-5 text-amber-300" />
                    </a>

                    {/* Supported Apps Pills */}
                    <div className="flex items-center justify-center flex-wrap gap-2 pt-1 text-[11px] text-neutral-600 font-medium">
                      <span className="px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">
                        Google Pay
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">
                        PhonePe
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">
                        Paytm
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">
                        BHIM UPI
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">
                        Cred
                      </span>
                    </div>

                    {/* Mobile fallback option: toggle QR */}
                    <div className="pt-2 border-t border-neutral-100">
                      <button
                        type="button"
                        onClick={() => setShowMobileQr(!showMobileQr)}
                        className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 inline-flex items-center gap-1.5 underline underline-offset-4 cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>
                          {showMobileQr
                            ? 'Hide QR Code'
                            : 'Paying from another phone? Show QR Code to scan'}
                        </span>
                      </button>

                      {showMobileQr && (
                        <div className="mt-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-200 inline-block animate-in fade-in">
                          {isGeneratingQr ? (
                            <div className="w-48 h-48 flex items-center justify-center text-xs text-neutral-500">
                              Generating dynamic QR...
                            </div>
                          ) : (
                            <img
                              src={qrDataUrl}
                              alt="UPI QR Code"
                              className="w-48 h-48 mx-auto rounded-xl shadow-xs border border-neutral-300"
                            />
                          )}
                          <p className="text-[11px] text-neutral-500 mt-2 font-mono">
                            UPI ID: {merchantUpiId}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. TABLET USER INTERFACE */}
                {deviceType === 'tablet' && (
                  <div className="space-y-4">
                    <div className="flex rounded-xl bg-neutral-100 p-1 border border-neutral-200 max-w-sm mx-auto">
                      <button
                        type="button"
                        onClick={() => setTabletView('intent')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          tabletView === 'intent'
                            ? 'bg-white text-neutral-900 shadow-xs'
                            : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Launch Installed UPI App</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTabletView('qr')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          tabletView === 'qr'
                            ? 'bg-white text-neutral-900 shadow-xs'
                            : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                      >
                        <QrCode className="w-3.5 h-3.5 text-blue-600" />
                        <span>Scan QR Code with Phone</span>
                      </button>
                    </div>

                    {tabletView === 'intent' ? (
                      <div className="text-center space-y-3 py-2">
                        <p className="text-xs text-neutral-600">
                          If you have a banking or UPI app installed on this tablet (e.g. GPay, PhonePe, BHIM), tap below:
                        </p>
                        <a
                          href={upiIntentUri}
                          className="w-full max-w-md mx-auto py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-800 hover:from-emerald-500 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 select-none"
                        >
                          <Smartphone className="w-4 h-4 text-amber-300" />
                          <span>Open UPI App on Tablet ({formatPrice(cartGrandTotal)})</span>
                          <ArrowRight className="w-4 h-4 text-amber-300" />
                        </a>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                        <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 shrink-0">
                          {isGeneratingQr ? (
                            <div className="w-44 h-44 flex items-center justify-center text-xs text-neutral-500">
                              Loading QR...
                            </div>
                          ) : (
                            <img
                              src={qrDataUrl}
                              alt="Scan UPI QR"
                              className="w-44 h-44 rounded-xl shadow-xs border border-neutral-300"
                            />
                          )}
                        </div>
                        <div className="text-left space-y-2 text-xs">
                          <p className="font-bold text-neutral-900 text-sm">
                            Scan with your phone camera or any UPI app
                          </p>
                          <p className="text-neutral-600">
                            Pre-fills <strong>{formatPrice(cartGrandTotal)}</strong> and order reference <strong>#{orderNumber}</strong> automatically.
                          </p>
                          <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 font-mono text-[11px] text-neutral-800 space-y-1">
                            <div className="flex justify-between items-center text-emerald-900 font-sans font-bold pb-1 border-b border-neutral-200/80">
                              <span>Verified Payee:</span>
                              <span className="text-neutral-950 font-serif">{merchantUpiOwnerName}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>UPI ID: <strong>{merchantUpiId}</strong></span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(merchantUpiId, 'tab_upi')}
                                className="px-2 py-0.5 rounded text-[10px] bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-sans cursor-pointer font-semibold"
                              >
                                {copiedField === 'tab_upi' ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. DESKTOP USER INTERFACE */}
                {deviceType === 'desktop' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                    <div className="md:col-span-5 flex flex-col items-center text-center">
                      <div className="p-3 bg-neutral-50 rounded-2xl border-2 border-neutral-200 shadow-inner">
                        {isGeneratingQr ? (
                          <div className="w-48 h-48 flex items-center justify-center text-xs text-neutral-500">
                            Generating scannable QR...
                          </div>
                        ) : (
                          <img
                            src={qrDataUrl}
                            alt="Scan UPI QR"
                            className="w-48 h-48 rounded-xl border border-neutral-300 shadow-xs"
                          />
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Dynamic {formatPrice(cartGrandTotal)} QR</span>
                      </span>
                    </div>

                    <div className="md:col-span-7 space-y-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5">
                        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                          <QrCode className="w-4 h-4 text-amber-700" />
                          <span>How to Pay via Desktop</span>
                        </div>
                        <ol className="list-decimal list-inside space-y-1 text-neutral-700 text-xs">
                          <li>Open Google Pay, PhonePe, Paytm, BHIM, or any UPI app on your smartphone.</li>
                          <li>Tap <strong>Scan QR</strong> and scan the code on your screen.</li>
                          <li>Verify Payee name <strong>"{merchantUpiOwnerName}"</strong> and approve payment.</li>
                        </ol>
                      </div>

                      {/* Manual UPI ID Box */}
                      <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-neutral-500 block">
                            Or Pay to Direct UPI ID
                          </span>
                          <span className="font-mono font-bold text-xs text-neutral-900">
                            {merchantUpiId}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(merchantUpiId, 'desk_upi')}
                          className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                        >
                          {copiedField === 'desk_upi' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy UPI ID</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* STEP 2: How to Pay (Collapsible) */}
            <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setIsHowToPayOpen(!isHowToPayOpen)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="p-1 px-2 rounded-lg bg-emerald-600 text-white font-bold text-xs">
                    STEP 2
                  </span>
                  <h4 className="font-serif text-sm font-bold text-neutral-900">
                    How to Pay via UPI (Simple 3-Step Guide)
                  </h4>
                </div>
                <div className="flex items-center gap-1 text-xs text-neutral-500 font-medium">
                  <span>{isHowToPayOpen ? 'Hide' : 'Show'}</span>
                  {isHowToPayOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </button>

              {isHowToPayOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-neutral-600">
                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1">
                    <span className="font-bold text-neutral-900 text-sm block">1. Open & Pay</span>
                    <p className="text-[11px] leading-relaxed">
                      Launch your preferred UPI app (Google Pay, PhonePe, Paytm, or BHIM) using the button or QR code above.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1">
                    <span className="font-bold text-neutral-900 text-sm block">2. Copy 12-Digit Ref</span>
                    <p className="text-[11px] leading-relaxed">
                      On the payment success screen, copy the 12-digit UTR / UPI Transaction ID / Ref No.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1">
                    <span className="font-bold text-neutral-900 text-sm block">3. Confirm Order</span>
                    <p className="text-[11px] leading-relaxed">
                      Paste your 12-digit number in Step 4 below and hit "Place Order". Your order will be confirmed!
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 3: Visual Reference Guides for Top 4 UPI Apps */}
            <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-4 sm:p-5 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1 px-2 rounded-lg bg-indigo-700 text-white font-extrabold text-xs tracking-wider">
                    STEP 3
                  </span>
                  <h4 className="font-serif text-sm sm:text-base font-bold text-indigo-950">
                    Where to Find Your 12-Digit Reference Number (Visual Guide)
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAppGuidesOpen(!isAppGuidesOpen)}
                  className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>{isAppGuidesOpen ? 'Collapse Guides' : 'Expand Visual Guides'}</span>
                  {isAppGuidesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {isAppGuidesOpen && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveAppGuide('phonepe')}
                      className={`p-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        activeAppGuide === 'phonepe'
                          ? 'bg-purple-700 text-white border-purple-800 shadow-sm'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      <span>📱 PhonePe</span>
                      <span className="text-[10px] opacity-80">(UTR)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAppGuide('gpay')}
                      className={`p-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        activeAppGuide === 'gpay'
                          ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      <span>🔵 Google Pay</span>
                      <span className="text-[10px] opacity-80">(Txn ID)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAppGuide('paytm')}
                      className={`p-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        activeAppGuide === 'paytm'
                          ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      <span>🟣 Paytm</span>
                      <span className="text-[10px] opacity-80">(Ref No)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAppGuide('bhim')}
                      className={`p-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        activeAppGuide === 'bhim'
                          ? 'bg-orange-600 text-white border-orange-700 shadow-sm'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      <span>🟠 BHIM App</span>
                      <span className="text-[10px] opacity-80">(Txn ID)</span>
                    </button>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-indigo-200 shadow-2xs">
                    {activeAppGuide === 'phonepe' && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📱</span>
                            <h5 className="font-bold text-sm text-purple-900">PhonePe Instructions</h5>
                            <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded border border-purple-200">
                              Red Box: 12-Digit UTR
                            </span>
                          </div>
                          <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            📱 <strong>PhonePe:</strong> Find the <strong>12-digit UTR</strong> displayed on the payment confirmation page.
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            Look for the red highlighted box under "Debited from" or "Transfer Details" on your PhonePe receipt.
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewGuideModal({
                                app: 'PhonePe',
                                image: '/assets/aistudio/Phonepe_6d38e6b0.jpeg',
                                instruction: '📱 PhonePe: Find the 12-digit UTR displayed on the payment confirmation page.',
                                sampleRef: '228372659102',
                              })
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 hover:underline cursor-pointer pt-1"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                            <span>Tap to View Full Screen PhonePe Screenshot</span>
                          </button>
                        </div>

                        <div
                          onClick={() =>
                            setPreviewGuideModal({
                              app: 'PhonePe',
                              image: '/assets/aistudio/Phonepe_6d38e6b0.jpeg',
                              instruction: '📱 PhonePe: Find the 12-digit UTR displayed on the payment confirmation page.',
                              sampleRef: '228372659102',
                            })
                          }
                          className="relative group cursor-pointer shrink-0 rounded-xl overflow-hidden border-2 border-purple-400 shadow-sm bg-neutral-900 self-center sm:self-auto"
                          title="Click to view PhonePe payment reference image"
                        >
                          <img
                            src="/assets/aistudio/Phonepe_6d38e6b0.jpeg"
                            alt="PhonePe UTR Reference Screenshot"
                            className="w-24 sm:w-28 h-36 object-cover object-top group-hover:scale-105 transition duration-200"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[10px] font-bold">
                            <ZoomIn className="w-4 h-4 mr-1" /> Zoom
                          </div>
                          <span className="absolute bottom-1 right-1 bg-red-600 text-white font-mono text-[9px] font-black px-1 rounded shadow">
                            UTR Box
                          </span>
                        </div>
                      </div>
                    )}

                    {activeAppGuide === 'gpay' && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🔵</span>
                            <h5 className="font-bold text-sm text-blue-900">Google Pay Instructions</h5>
                            <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                              Red Box: 12-Digit Txn ID
                            </span>
                          </div>
                          <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            🔵 <strong>Google Pay:</strong> Find the <strong>12-digit UPI Transaction ID</strong> displayed on the payment confirmation page.
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            Check the red highlighted box under "Payment details" on your Google Pay receipt screen.
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewGuideModal({
                                app: 'Google Pay',
                                image: '/assets/aistudio/GooglePay_3d1a4bdf.jpeg',
                                instruction: '🔵 Google Pay: Find the 12-digit UPI Transaction ID displayed on the payment confirmation page.',
                                sampleRef: '228399128472',
                              })
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer pt-1"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                            <span>Tap to View Full Screen Google Pay Screenshot</span>
                          </button>
                        </div>

                        <div
                          onClick={() =>
                            setPreviewGuideModal({
                              app: 'Google Pay',
                              image: '/assets/aistudio/GooglePay_3d1a4bdf.jpeg',
                              instruction: '🔵 Google Pay: Find the 12-digit UPI Transaction ID displayed on the payment confirmation page.',
                              sampleRef: '228399128472',
                            })
                          }
                          className="relative group cursor-pointer shrink-0 rounded-xl overflow-hidden border-2 border-blue-400 shadow-sm bg-neutral-900 self-center sm:self-auto"
                          title="Click to view Google Pay payment reference image"
                        >
                          <img
                            src="/assets/aistudio/GooglePay_3d1a4bdf.jpeg"
                            alt="Google Pay UPI Transaction ID Reference Screenshot"
                            className="w-24 sm:w-28 h-36 object-cover object-top group-hover:scale-105 transition duration-200"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[10px] font-bold">
                            <ZoomIn className="w-4 h-4 mr-1" /> Zoom
                          </div>
                          <span className="absolute bottom-1 right-1 bg-red-600 text-white font-mono text-[9px] font-black px-1 rounded shadow">
                            Txn ID Box
                          </span>
                        </div>
                      </div>
                    )}

                    {activeAppGuide === 'paytm' && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🟣</span>
                            <h5 className="font-bold text-sm text-sky-900">Paytm Instructions</h5>
                            <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded border border-sky-200">
                              Red Box: 12-Digit Ref No.
                            </span>
                          </div>
                          <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            🟣 <strong>Paytm:</strong> Find the <strong>12-digit Ref No</strong> displayed on the payment confirmation page.
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            Check the red highlighted box next to the date/timestamp on your Paytm green success screen.
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewGuideModal({
                                app: 'Paytm',
                                image: '/assets/aistudio/Paytm_44207adf.jpeg',
                                instruction: '🟣 Paytm: Find the 12-digit Ref No displayed on the payment confirmation page.',
                                sampleRef: '219172152537',
                              })
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-900 hover:underline cursor-pointer pt-1"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                            <span>Tap to View Full Screen Paytm Screenshot</span>
                          </button>
                        </div>

                        <div
                          onClick={() =>
                            setPreviewGuideModal({
                              app: 'Paytm',
                              image: '/assets/aistudio/Paytm_44207adf.jpeg',
                              instruction: '🟣 Paytm: Find the 12-digit Ref No displayed on the payment confirmation page.',
                              sampleRef: '219172152537',
                            })
                          }
                          className="relative group cursor-pointer shrink-0 rounded-xl overflow-hidden border-2 border-sky-400 shadow-sm bg-neutral-900 self-center sm:self-auto"
                          title="Click to view Paytm payment reference image"
                        >
                          <img
                            src="/assets/aistudio/Paytm_44207adf.jpeg"
                            alt="Paytm Ref No Reference Screenshot"
                            className="w-24 sm:w-28 h-36 object-cover object-top group-hover:scale-105 transition duration-200"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[10px] font-bold">
                            <ZoomIn className="w-4 h-4 mr-1" /> Zoom
                          </div>
                          <span className="absolute bottom-1 right-1 bg-red-600 text-white font-mono text-[9px] font-black px-1 rounded shadow">
                            Ref No Box
                          </span>
                        </div>
                      </div>
                    )}

                    {activeAppGuide === 'bhim' && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🟠</span>
                            <h5 className="font-bold text-sm text-orange-900">BHIM App Instructions</h5>
                            <span className="text-[10px] font-bold bg-orange-100 text-orange-800 px-2 py-0.5 rounded border border-orange-200">
                              Red Box: 12-Digit Txn ID
                            </span>
                          </div>
                          <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            🟠 <strong>BHIM App:</strong> Find the <strong>12-digit Transaction ID</strong> displayed on the payment confirmation page.
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            Check the red highlighted box on the green BHIM receipt screen under your banking name.
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewGuideModal({
                                app: 'BHIM App',
                                image: '/assets/aistudio/BHIM_9be98cb4.jpeg',
                                instruction: '🟠 BHIM App: Find the 12-digit Transaction ID displayed on the payment confirmation page.',
                                sampleRef: '193810919980',
                              })
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-700 hover:text-orange-900 hover:underline cursor-pointer pt-1"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                            <span>Tap to View Full Screen BHIM Screenshot</span>
                          </button>
                        </div>

                        <div
                          onClick={() =>
                            setPreviewGuideModal({
                              app: 'BHIM App',
                              image: '/assets/aistudio/BHIM_9be98cb4.jpeg',
                              instruction: '🟠 BHIM App: Find the 12-digit Transaction ID displayed on the payment confirmation page.',
                              sampleRef: '193810919980',
                            })
                          }
                          className="relative group cursor-pointer shrink-0 rounded-xl overflow-hidden border-2 border-orange-400 shadow-sm bg-neutral-900 self-center sm:self-auto"
                          title="Click to view BHIM payment reference image"
                        >
                          <img
                            src="/assets/aistudio/BHIM_9be98cb4.jpeg"
                            alt="BHIM App Transaction ID Reference Screenshot"
                            className="w-24 sm:w-28 h-36 object-cover object-center group-hover:scale-105 transition duration-200"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[10px] font-bold">
                            <ZoomIn className="w-4 h-4 mr-1" /> Zoom
                          </div>
                          <span className="absolute bottom-1 right-1 bg-red-600 text-white font-mono text-[9px] font-black px-1 rounded shadow">
                            Txn ID Box
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Form wrapping Steps 4, 5, 6, and Submit Button */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* STEP 4: 12-Digit Reference Number Input */}
              <div className="rounded-2xl border-2 border-amber-400/90 bg-amber-50/50 p-4 sm:p-5 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1 px-2 rounded-lg bg-amber-600 text-white font-extrabold text-xs tracking-wider">
                      STEP 4
                    </span>
                    <label htmlFor="utr-input-field" className="font-serif text-base font-bold text-amber-950">
                      Enter Your 12-Digit Reference Number <span className="text-rose-600">*</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {enteredUtr.replace(/\D/g, '').length === 12 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-300">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>12 / 12 Digits (Valid)</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold bg-white text-neutral-600 px-2.5 py-0.5 rounded-full border border-amber-300">
                        {enteredUtr.replace(/\D/g, '').length} / 12 Digits
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    id="utr-input-field"
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={16}
                    value={enteredUtr}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                      setEnteredUtr(val);
                    }}
                    placeholder="Enter 12-digit UTR / UPI Ref ID (e.g. 228399128472)"
                    className="w-full p-3.5 rounded-xl border-2 border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-base tracking-wider text-neutral-900 placeholder:text-neutral-400"
                  />
                  <p className="text-[11px] text-neutral-600 leading-relaxed">
                    Check the visual guides above for your app (PhonePe, Google Pay, Paytm, or BHIM) to copy the exact 12-digit number.
                  </p>
                </div>
              </div>

              {/* STEP 5: Delivery Details */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="p-1 px-2 rounded-lg bg-neutral-900 text-white font-bold text-xs">
                    STEP 5
                  </span>
                  <h4 className="font-serif text-sm sm:text-base font-bold text-neutral-900">
                    Delivery Address Details
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-neutral-700 font-medium mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Nandha Goban"
                      className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-medium mb-1">Mobile Number (10 Digits) *</label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 9876543210"
                      className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-neutral-900 font-mono"
                    />
                  </div>
                </div>

                <div className="text-xs">
                  <label className="block text-neutral-700 font-medium mb-1">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. customer@example.com"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                  />
                </div>

                <div className="text-xs">
                  <label className="block text-neutral-700 font-medium mb-1">Street Address / Door No. *</label>
                  <textarea
                    required
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 42/8, Mettu Street, Shevapet"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-neutral-900 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-neutral-700 font-medium mb-1">City *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Salem"
                      className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-medium mb-1">State *</label>
                    <input
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. Tamil Nadu"
                      className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-medium mb-1">Pincode *</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 636001"
                      className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-neutral-900 font-mono"
                    />
                  </div>
                </div>

                <div className="text-xs">
                  <label className="block text-neutral-700 font-medium mb-1">
                    Delivery Notes / Special Instructions{' '}
                    <span className="text-neutral-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Please call before delivery, gift wrap requested"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                  />
                </div>
              </div>

              {/* STEP 6: Optional Screenshot Upload */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 space-y-3 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setShowOptionalScreenshot(!showOptionalScreenshot)}
                  className="w-full flex items-center justify-between text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="p-1 px-2 rounded-lg bg-neutral-200 text-neutral-800 font-bold text-xs">
                      STEP 6
                    </span>
                    <div>
                      <h4 className="font-serif text-sm font-bold text-neutral-900 flex items-center gap-2">
                        <span>Attach Payment Screenshot</span>
                        <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                          Optional
                        </span>
                      </h4>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {screenshotResult
                          ? 'Screenshot attached and compressed ✓'
                          : 'Not required if you entered your 12-digit UTR above'}
                      </p>
                    </div>
                  </div>
                  {showOptionalScreenshot ? (
                    <ChevronUp className="w-4 h-4 text-neutral-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-500" />
                  )}
                </button>

                {showOptionalScreenshot && (
                  <div className="pt-2 border-t border-neutral-100 space-y-3">
                    <input
                      id={fileInputId}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {!screenshotResult ? (
                      <label
                        htmlFor={fileInputId}
                        className="p-6 rounded-2xl border-2 border-dashed border-neutral-300 hover:border-amber-500 bg-neutral-50 hover:bg-amber-50/30 transition flex flex-col items-center justify-center gap-2 cursor-pointer text-center"
                      >
                        <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-neutral-200 flex items-center justify-center text-neutral-600">
                          {isCompressing ? (
                            <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" />
                          ) : (
                            <Upload className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-neutral-900">
                            {isCompressing ? 'Compressing Screenshot...' : 'Tap to Select Screenshot'}
                          </p>
                          <p className="text-[11px] text-neutral-500 mt-0.5">
                            JPEG, PNG or WebP · Auto-compressed for fast upload
                          </p>
                        </div>
                      </label>
                    ) : (
                      <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={screenshotResult.previewUrl}
                            alt="Screenshot preview"
                            className="w-12 h-16 object-cover rounded-lg border border-neutral-300 shrink-0 cursor-pointer"
                            onClick={() => setPreviewZoomModal(screenshotResult.previewUrl)}
                          />
                          <div className="text-xs min-w-0">
                            <p className="font-bold text-neutral-900 truncate">
                              {screenshotResult.file.name}
                            </p>
                            <p className="text-[11px] text-neutral-500">
                              Size: {screenshotResult.compressedSizeKB} KB (Saved {screenshotResult.reductionPercentage}%)
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveScreenshot}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer text-xs font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    )}

                    {compressionError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{compressionError}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Error Alert Banner */}
              {errorMsg && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Uploading progress status */}
              {isSubmitting && uploadProgressText && (
                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                  <span>{uploadProgressText}</span>
                </div>
              )}

              {/* 12-Digit Reference Status Notice */}
              {enteredUtr.replace(/\D/g, '').length !== 12 ? (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    Please enter your <strong>12-digit reference number / UTR</strong> in <strong>Step 4</strong> above to enable order confirmation.
                  </span>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      12-Digit UTR (<strong>{enteredUtr.replace(/\D/g, '')}</strong>) entered. Ready to place order!
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Ready
                  </span>
                </div>
              )}

              {/* Submit CTA Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={enteredUtr.replace(/\D/g, '').length !== 12 || isSubmitting || isCompressing}
                  className={`w-full py-4 px-6 rounded-2xl font-bold text-sm sm:text-base transition-all shadow-md flex items-center justify-center gap-2 ${
                    enteredUtr.replace(/\D/g, '').length !== 12 || isSubmitting || isCompressing
                      ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-rose-900 via-rose-950 to-neutral-950 hover:from-rose-800 hover:to-neutral-900 text-white shadow-lg hover:shadow-xl cursor-pointer active:scale-98'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Recording Order...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck2 className="w-5 h-5 text-amber-300" />
                      <span>Place Order ({formatPrice(cartGrandTotal)})</span>
                      <ArrowRight className="w-5 h-5 text-amber-300" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* App Guide Screenshot Zoom Lightbox Modal */}
      {previewGuideModal && (
        <div
          onClick={() => setPreviewGuideModal(null)}
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 cursor-zoom-out animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-lg w-full bg-white rounded-3xl p-4 sm:p-5 shadow-2xl overflow-hidden flex flex-col items-center max-h-[92vh]"
          >
            <div className="w-full flex items-center justify-between pb-3 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-neutral-900 text-base sm:text-lg">
                  {previewGuideModal.app} Payment Receipt Guide
                </span>
                <span className="text-[10px] font-bold uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
                  Red Box Highlighted
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewGuideModal(null)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full my-3 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-700 leading-snug">
              <p className="font-semibold text-neutral-900">{previewGuideModal.instruction}</p>
              <p className="text-[11px] text-neutral-600 mt-1.5">
                Check the red rectangle highlighted on the receipt image below to locate your genuine 12-digit number, then enter it into the checkout box.
              </p>
            </div>

            <div className="overflow-y-auto max-h-[62vh] w-full flex items-center justify-center bg-neutral-900 rounded-2xl p-2 border border-neutral-300">
              <img
                src={previewGuideModal.image}
                alt={`${previewGuideModal.app} Reference Receipt`}
                className="max-h-[58vh] w-auto object-contain rounded-xl"
              />
            </div>

            <p className="text-[11px] text-neutral-500 mt-2 text-center">
              Copy the 12-digit number marked in the red rectangle into the input field.
            </p>
          </div>
        </div>
      )}

      {/* User Screenshot Zoom Inspection Modal */}
      {previewZoomModal && (
        <div
          onClick={() => setPreviewZoomModal(null)}
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl max-h-[90vh] bg-white rounded-2xl p-2 shadow-2xl overflow-hidden flex flex-col items-center"
          >
            <button
              type="button"
              onClick={() => setPreviewZoomModal(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewZoomModal}
              alt="High-resolution payment screenshot preview"
              className="max-h-[82vh] w-auto object-contain rounded-xl"
            />
            <p className="text-[11px] text-neutral-500 mt-2 font-mono">
              Screenshot compressed for clarity · Size: {screenshotResult?.compressedSizeKB} KB
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
