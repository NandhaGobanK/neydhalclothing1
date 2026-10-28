import React, { useState, useEffect, useRef, useId } from 'react';
import QRCode from 'qrcode';
import { useStore, getBoutiqueOrderPrefix } from '../../context/StoreContext';
import { formatPrice } from '../../utils/upi';
import { useDeviceType, DeviceType } from '../../utils/deviceDetection';
import {
  compressPaymentScreenshot,
  CompressedScreenshotResult,
} from '../../utils/imageCompression';
import { uploadPaymentScreenshot } from '../../utils/firebase';
import {
  X,
  ShieldCheck,
  AlertCircle,
  Lock,
  ArrowRight,
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
  Trash2,
  Info,
} from 'lucide-react';

interface CheckoutModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ onClose, onSuccess }) => {
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

  // Screenshot Upload & Compression state
  const [screenshotResult, setScreenshotResult] =
    useState<CompressedScreenshotResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionError, setCompressionError] = useState<string | null>(null);
  const [previewZoomModal, setPreviewZoomModal] = useState<string | null>(null);

  // Customer entered UTR / Reference No.
  const [enteredUtr, setEnteredUtr] = useState('');

  // Submission / Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Active guidance tab for app receipt instructions
  const [activeAppGuide, setActiveAppGuide] = useState<
    'gpay' | 'phonepe' | 'paytm' | 'bhim'
  >('gpay');

  // Merchant details
  const merchantUpiId = (settings.payment.upiId || '8807392520@okbizaxis').trim();
  const merchantName = (settings.payment.payeeName || 'Neydhal Clothing').trim();
  const formattedAmount = cartGrandTotal.toFixed(2);
  const transactionNote = `ORDER #${orderNumber} • NEYDHAL CLOTHING`;

  // Direct UPI Intent URI pre-filled with merchant details, total amount, and order reference
  const upiIntentUri = `upi://pay?pa=${encodeURIComponent(merchantUpiId)}&pn=${encodeURIComponent(
    merchantName
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
      // Reset input value so re-selecting same file triggers onChange
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
    if (!screenshotResult) {
      setErrorMsg('Payment screenshot is mandatory. Please upload your payment receipt below.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  // Order Submission & Firebase Upload
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDeliveryForm()) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      let downloadUrl = '';

      if (screenshotResult?.file) {
        setUploadProgressText('Uploading compressed payment receipt to Firebase Storage...');
        downloadUrl = await uploadPaymentScreenshot(screenshotResult.file, orderNumber);
      }

      setUploadProgressText('Recording order into Firestore database...');

      const resolvedUpiTxn = (
        enteredUtr.trim() ||
        screenshotResult?.file?.name ||
        `UPI-${orderNumber}`
      ).trim();

      // Place order with initial status: 'pending_verification'
      placeOrder({
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
        upiTransactionId: resolvedUpiTxn,
        paymentScreenshotUrl: downloadUrl || screenshotResult?.previewUrl,
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
          'Failed to record your order in Firestore. Please check your connection and retry.'
      );
    } finally {
      setIsSubmitting(false);
      setUploadProgressText('');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden border border-neutral-200 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between bg-gradient-to-r from-neutral-900 via-neutral-950 to-emerald-950 text-white shrink-0">
            <div className="flex items-center gap-3">
              {/* Store Logo with vibrant emerald glow */}
              <div className="w-11 h-11 rounded-2xl bg-white p-1 border-2 border-emerald-400 shadow-md flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={settings.logoUrl || '/logo.png'}
                  alt="Neydhal Clothing Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-serif text-lg sm:text-xl font-bold tracking-wide">
                    Prepaid UPI Checkout
                  </h2>
                  {/* Vibrant Green Badge for Neydhal Clothing */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-green-600 text-white font-black text-xs uppercase tracking-wide border border-emerald-300 shadow-md">
                    <Sparkles className="w-3 h-3 text-amber-300 shrink-0 animate-pulse" />
                    <span>Neydhal Clothing</span>
                  </span>
                  {/* Big Bold Order Number Badge */}
                  <span className="font-mono text-xs sm:text-sm font-black bg-black/60 text-amber-300 px-3 py-1 rounded-xl border-2 border-emerald-400/70 tracking-wider shadow-inner">
                    #{orderNumber}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-300 mt-0.5">
                  Direct artisan handloom checkout & manual payment verification
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Prominent Vibrant Green Store Logo & Bold Order Showcase Banner */}
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-emerald-50/90 to-teal-50 border-2 border-emerald-500 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <div className="flex items-center gap-3.5">
                {/* Store Logo with vibrant emerald border */}
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white p-1.5 border-2 border-emerald-500 shadow-md flex items-center justify-center shrink-0">
                  <img
                    src={settings.logoUrl || '/logo.png'}
                    alt="Neydhal Clothing Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                    {/* Vibrant Green Bold Badge for Neydhal Clothing */}
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-md border-2 border-emerald-400">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse shrink-0" />
                      <span>Neydhal Clothing</span>
                    </span>
                    <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                      Official Payee
                    </span>
                  </div>
                  <p className="text-xs text-emerald-950 font-semibold mt-1">
                    Direct Artisan Handloom & Heirloom Pure Silk Weaves
                  </p>
                </div>
              </div>

              {/* Big Bold Order Number Badge */}
              <div className="flex flex-col items-center sm:items-end shrink-0">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-800 mb-0.5">
                  Order Number
                </span>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border-2 border-emerald-600 shadow-md">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-mono font-black text-lg sm:text-2xl text-emerald-950 tracking-wider">
                    #{orderNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(orderNumber, 'banner_order_num')}
                    className="p-1 hover:bg-emerald-50 rounded text-emerald-700 cursor-pointer ml-1"
                    title="Copy Order Number"
                  >
                    {copiedField === 'banner_order_num' ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 1: Order Items & Total Summary */}
            <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200">
              <div className="flex items-center justify-between mb-2">
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

              <div className="flex flex-wrap gap-1.5 mb-3">
                {cart.map((item) => (
                  <span
                    key={item.product.id}
                    className="text-[11px] bg-white border border-neutral-200 px-2.5 py-1 rounded-lg text-neutral-800 flex items-center gap-1.5 shadow-2xs"
                  >
                    <span className="font-medium">{item.product.title}</span>
                    <span className="text-neutral-500">×{item.quantity}</span>
                  </span>
                ))}
              </div>

              <div className="space-y-1 pt-2 border-t border-neutral-200 text-xs">
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
                <div className="flex justify-between items-baseline pt-1.5 border-t border-neutral-200 font-bold">
                  <span className="text-neutral-900 text-sm">Total Payable Amount:</span>
                  <span className="text-xl sm:text-2xl text-rose-950 font-serif tabular-nums font-bold">
                    {formatPrice(cartGrandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 2: Device-Adaptive Payment Gateway UI */}
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
                {/* 1. MOBILE USER INTERFACE */}
                {deviceType === 'mobile' && (
                  <div className="space-y-4 text-center">
                    {/* Vibrant Green Store & Bold Order Pill above Mobile Payment Button */}
                    <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-100/90 via-emerald-50 to-green-100/90 border-2 border-emerald-500 flex items-center justify-between gap-2 shadow-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-white p-0.5 border border-emerald-400 shadow-2xs shrink-0 flex items-center justify-center">
                          <img
                            src={settings.logoUrl || '/logo.png'}
                            alt="Logo"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <span className="px-3 py-1 rounded-full bg-emerald-600 text-white font-black text-xs uppercase tracking-wide border border-emerald-400 shadow-2xs shrink-0 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-300" />
                          <span>Neydhal Clothing</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] uppercase font-bold text-emerald-800">Order:</span>
                        <span className="font-mono font-black text-sm sm:text-base text-emerald-950 bg-white px-2.5 py-0.5 rounded-xl border-2 border-emerald-500 shadow-2xs tracking-wider">
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

                {/* 2. TABLET USER INTERFACE (Clean fallback switch so tablet users are never stuck) */}
                {deviceType === 'tablet' && (
                  <div className="space-y-4">
                    {/* Tablet View Switcher */}
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
                        <p className="text-[11px] text-neutral-500">
                          App didn't open? Switch to the "Scan QR Code" tab above to scan with your phone.
                        </p>
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

                {/* 3. DESKTOP USER INTERFACE (Scannable QR code generated dynamically on screen) */}
                {deviceType === 'desktop' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                    {/* Left: Dynamic QR Code */}
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

                    {/* Right: Payment Details & Guidance */}
                    <div className="md:col-span-7 space-y-3 text-xs text-neutral-700">
                      <div>
                        <h4 className="font-serif text-base font-bold text-neutral-900">
                          Scan to Pay with Any UPI App
                        </h4>
                        <p className="text-neutral-500 text-[11px] mt-0.5">
                          Open Google Pay, PhonePe, Paytm, or BHIM on your smartphone and point your camera at this QR code.
                        </p>
                      </div>

                      {/* Merchant Credentials card with 1-click copy */}
                      <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold block">
                              Merchant UPI ID
                            </span>
                            <span className="font-mono text-xs font-bold text-neutral-900">
                              {merchantUpiId}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(merchantUpiId, 'desk_upi')}
                            className="px-2.5 py-1 rounded-lg bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-800 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                          >
                            {copiedField === 'desk_upi' ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedField === 'desk_upi' ? 'Copied' : 'Copy UPI'}</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-neutral-200/80">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold block">
                              Exact Amount
                            </span>
                            <span className="font-serif text-sm font-bold text-rose-950">
                              {formatPrice(cartGrandTotal)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(formattedAmount, 'desk_amount')}
                            className="px-2.5 py-1 rounded-lg bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-800 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                          >
                            {copiedField === 'desk_amount' ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedField === 'desk_amount' ? 'Copied' : 'Copy Amount'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Direct UPI Intent Link for desktop browsers that support protocol handler */}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-500">Have a UPI app on this computer?</span>
                        <a
                          href={upiIntentUri}
                          className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1"
                        >
                          <span>Trigger UPI Intent link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Customer Guidance & Instructions Card */}
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-indigo-600 text-white font-bold text-xs">
                    STEP 2
                  </span>
                  <h4 className="font-serif text-sm font-bold text-indigo-950">
                    How to Find Your 12-Digit Reference No. & Screenshot
                  </h4>
                </div>
                <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100/80 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Required for Order Approval
                </span>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed">
                After completing the payment in your UPI app, take a full screenshot of the payment receipt. Make sure the <strong>12-digit reference number</strong> is clearly visible. Labels vary by app:
              </p>

              {/* App Reference Number Labels Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveAppGuide('gpay')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    activeAppGuide === 'gpay'
                      ? 'bg-white border-blue-500 shadow-xs ring-2 ring-blue-500/20'
                      : 'bg-white/80 border-neutral-200 hover:bg-white'
                  }`}
                >
                  <p className="font-bold text-blue-700">Google Pay</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">Labeled as:</p>
                  <p className="font-mono text-[11px] font-bold text-neutral-900 truncate">
                    UPI transaction ID
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAppGuide('phonepe')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    activeAppGuide === 'phonepe'
                      ? 'bg-white border-purple-500 shadow-xs ring-2 ring-purple-500/20'
                      : 'bg-white/80 border-neutral-200 hover:bg-white'
                  }`}
                >
                  <p className="font-bold text-purple-700">PhonePe</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">Labeled as:</p>
                  <p className="font-mono text-[11px] font-bold text-neutral-900 truncate">
                    UTR / Txn ID
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAppGuide('paytm')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    activeAppGuide === 'paytm'
                      ? 'bg-white border-sky-500 shadow-xs ring-2 ring-sky-500/20'
                      : 'bg-white/80 border-neutral-200 hover:bg-white'
                  }`}
                >
                  <p className="font-bold text-sky-700">Paytm</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">Labeled as:</p>
                  <p className="font-mono text-[11px] font-bold text-neutral-900 truncate">
                    UPI Ref No.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAppGuide('bhim')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    activeAppGuide === 'bhim'
                      ? 'bg-white border-orange-500 shadow-xs ring-2 ring-orange-500/20'
                      : 'bg-white/80 border-neutral-200 hover:bg-white'
                  }`}
                >
                  <p className="font-bold text-orange-700">BHIM / Banks</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">Labeled as:</p>
                  <p className="font-mono text-[11px] font-bold text-neutral-900 truncate">
                    Bank Ref / UTR
                  </p>
                </button>
              </div>

              {/* Visual Mockup Container Highlighting Reference Numbers on Typical Receipt */}
              <div className="p-3.5 rounded-2xl bg-white border border-indigo-200 shadow-xs">
                <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-2">
                  <span className="font-semibold text-neutral-700 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Typical UPI Receipt Mockup:</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Paid to {merchantName}
                  </span>
                </div>

                <div className="rounded-xl border border-dashed border-neutral-300 p-3 bg-neutral-50/80 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-neutral-600">
                    <span>Payment Status:</span>
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Successful
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-neutral-600">
                    <span>Amount Paid:</span>
                    <span className="font-bold font-serif text-sm text-neutral-900">
                      {formatPrice(cartGrandTotal)}
                    </span>
                  </div>

                  {/* Highlighted Reference Number Box */}
                  <div className="p-2.5 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 animate-pulse">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider block text-amber-800">
                        {activeAppGuide === 'gpay'
                          ? 'Google Pay: UPI transaction ID'
                          : activeAppGuide === 'phonepe'
                          ? 'PhonePe: UTR No.'
                          : activeAppGuide === 'paytm'
                          ? 'Paytm: UPI Ref No.'
                          : 'BHIM / Bank: UTR Reference No.'}
                      </span>
                      <span className="font-mono font-extrabold text-xs text-neutral-950 tracking-wider">
                        4289 1049 8213
                      </span>
                    </div>
                    <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded font-bold shrink-0 self-start sm:self-auto">
                      👈 Capture this number in screenshot!
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4: Mandatory Payment Screenshot Upload & Client-Side Compression */}
            <div className="rounded-2xl border-2 border-dashed border-amber-300/80 bg-amber-50/40 p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-amber-600 text-white font-bold text-xs">
                    STEP 3
                  </span>
                  <h4 className="font-serif text-sm font-bold text-amber-950">
                    Upload Payment Screenshot <span className="text-rose-600">* Mandatory</span>
                  </h4>
                </div>
                <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-900 border border-amber-300">
                  Target: 150KB - 200KB (Text Clarity Preserved)
                </span>
              </div>

              {/* Upload Drop Zone / Button */}
              {!screenshotResult && (
                <div className="space-y-3">
                  <label
                    htmlFor={fileInputId}
                    className={`block w-full border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer ${
                      isCompressing
                        ? 'bg-neutral-100 border-neutral-300 cursor-wait'
                        : 'bg-white border-amber-300 hover:border-amber-500 hover:bg-amber-50/60 shadow-xs'
                    }`}
                  >
                    <input
                      id={fileInputId}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileSelect}
                      disabled={isCompressing || isSubmitting}
                      className="hidden"
                    />

                    {isCompressing ? (
                      <div className="space-y-2 flex flex-col items-center">
                        <RefreshCw className="w-8 h-8 text-amber-600 animate-spin" />
                        <p className="font-bold text-xs text-neutral-800">
                          Compressing screenshot with browser-image-compression...
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          Resizing to max 1000px & targeting 150KB–200KB while preserving text sharpness
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 flex flex-col items-center">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-xs">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-neutral-900">
                            Tap to Select Payment Screenshot
                          </p>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            JPEG, PNG, or WebP screenshot from your photo gallery
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 mt-1">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          <span>Auto-compressed before upload to save mobile data</span>
                        </span>
                      </div>
                    )}
                  </label>

                  {compressionError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{compressionError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Compressed Screenshot Confirmation Banner & Thumbnail */}
              {screenshotResult && (
                <div className="p-4 rounded-2xl bg-white border border-emerald-300 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Check className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-xs text-emerald-950">
                        Screenshot Compressed & Verified!
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleRemoveScreenshot}
                      disabled={isSubmitting}
                      className="text-neutral-400 hover:text-rose-600 p-1 rounded-lg hover:bg-neutral-100 transition cursor-pointer flex items-center gap-1 text-[11px]"
                      title="Remove and upload different image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Thumbnail with Zoom trigger */}
                    <div
                      onClick={() => setPreviewZoomModal(screenshotResult.previewUrl)}
                      className="relative group cursor-pointer shrink-0 rounded-xl overflow-hidden border border-neutral-300 shadow-xs"
                      title="Click to zoom screenshot"
                    >
                      <img
                        src={screenshotResult.previewUrl}
                        alt="Compressed receipt"
                        className="w-16 h-20 object-cover bg-neutral-100"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                        <ZoomIn className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Compression Statistics Breakdown */}
                    <div className="space-y-1 text-xs text-neutral-700 flex-1">
                      <p className="font-semibold text-neutral-900 truncate">
                        {screenshotResult.file.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-neutral-500 line-through">
                          {screenshotResult.originalSizeKB} KB
                        </span>
                        <ArrowRight className="w-3 h-3 text-emerald-600" />
                        <span className="font-bold font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {screenshotResult.compressedSizeKB} KB
                        </span>
                        <span className="text-[10px] text-emerald-800 font-semibold">
                          ({screenshotResult.reductionPercentage}% smaller)
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-500">
                        Dimensions: {screenshotResult.width}×{screenshotResult.height}px · Format: {screenshotResult.mimeType}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Optional / Recommended: Type or Paste 12-digit UTR */}
              <div className="pt-1">
                <label className="block text-neutral-700 font-bold text-xs mb-1">
                  12-Digit UTR / Transaction Reference Number{' '}
                  <span className="text-neutral-400 font-normal">(Optional for faster lookup)</span>
                </label>
                <input
                  type="text"
                  maxLength={24}
                  value={enteredUtr}
                  onChange={(e) => setEnteredUtr(e.target.value)}
                  placeholder="e.g. 428910498213 (from your payment receipt)"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-neutral-900 font-mono text-xs"
                />
              </div>
            </div>

            {/* Step 5: Customer Delivery & Shipping Address */}
            <form id="checkout-delivery-form" onSubmit={handleSubmitOrder} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                  <span className="p-1 rounded-lg bg-neutral-900 text-white font-bold text-xs">
                    STEP 4
                  </span>
                  <span>Delivery & Dispatch Address</span>
                </h3>
                <span className="text-[11px] text-neutral-500">* Required fields</span>
              </div>

              {/* Saved Address selector if patron is signed in */}
              {currentCustomer && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>
                    Linked to member account: <strong>{currentCustomer.name}</strong> (+91{' '}
                    {currentCustomer.phone})
                  </span>
                  {currentCustomer.savedAddresses && currentCustomer.savedAddresses.length > 1 && (
                    <select
                      onChange={(e) => {
                        const selected = currentCustomer.savedAddresses.find(
                          (a) => a.id === e.target.value
                        );
                        if (selected) {
                          setName(selected.name || currentCustomer.name);
                          setPhone(selected.phone || currentCustomer.phone);
                          setAddress(selected.address);
                          setCity(selected.city);
                          setState(selected.state);
                          setPincode(selected.pincode);
                        }
                      }}
                      className="text-[11px] font-semibold bg-white px-2 py-1 rounded-lg border border-emerald-300 text-neutral-800"
                    >
                      <option value="">Select Saved Address...</option>
                      {currentCustomer.savedAddresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.city} - {a.address.slice(0, 20)}... {a.isDefault ? '(Default)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-neutral-700 font-medium mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Smt. Priyamvada Sharma"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-neutral-700 font-medium mb-1">
                    Mobile / WhatsApp Contact *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-digit mobile number"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-neutral-900 font-mono"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="block text-neutral-700 font-medium mb-1">
                  Email Address{' '}
                  <span className="text-neutral-400 font-normal">(Optional for tracking receipts)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. priyamvada@example.com"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                />
              </div>

              <div className="text-xs">
                <label className="block text-neutral-700 font-medium mb-1">
                  Door No., Street & Landmark *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Flat 3B, Golden Enclave, Near Vinayagar Temple"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-neutral-700 font-medium mb-1">City / Town *</label>
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
                  Delivery Notes / Saree Draping Instructions{' '}
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

              {/* Error Alert Banner */}
              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Uploading progress status */}
              {isSubmitting && uploadProgressText && (
                <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                  <span>{uploadProgressText}</span>
                </div>
              )}

              {/* Mandatory Screenshot Missing Notice */}
              {!screenshotResult && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    Upload your payment screenshot in <strong>Step 3</strong> above to enable order confirmation.
                  </span>
                </div>
              )}

              {/* Submit CTA Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!screenshotResult || isSubmitting || isCompressing}
                  className={`w-full py-4 px-6 rounded-2xl font-bold text-sm sm:text-base transition-all shadow-md flex items-center justify-center gap-2 ${
                    !screenshotResult || isSubmitting || isCompressing
                      ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-rose-900 via-rose-950 to-neutral-950 hover:from-rose-800 hover:to-neutral-900 text-white shadow-lg hover:shadow-xl cursor-pointer active:scale-98'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Recording Order in Firestore...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck2 className="w-5 h-5 text-amber-300" />
                      <span>
                        Confirm Order & Submit for Verification ({formatPrice(cartGrandTotal)})
                      </span>
                      <ArrowRight className="w-5 h-5 text-amber-300" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Screenshot Zoom Inspection Modal */}
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
    </>
  );
};
