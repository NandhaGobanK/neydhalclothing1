import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { formatPrice, generateUpiUri, getUpiQrCodeImageUrl, formatWhatsAppOrderMessage, openWhatsApp } from '../../utils/upi';
import {
  X,
  QrCode,
  Copy,
  Check,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  MessageSquare,
  Send,
  ArrowRight,
  Info,
} from 'lucide-react';

interface CheckoutModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ onClose, onSuccess }) => {
  const { cart, cartTotal, settings, placeOrder } = useStore();

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [notes, setNotes] = useState('');

  // Payment states
  const [upiTransactionId, setUpiTransactionId] = useState('');
  const [refundUpiId, setRefundUpiId] = useState('');
  const [refundUpiPhone, setRefundUpiPhone] = useState('');
  const [sameAsPhone, setSameAsPhone] = useState(true);

  // UI helpers
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQrExpanded, setShowQrExpanded] = useState(false);

  // Auto-fill refund phone if checkbox active
  const handlePhoneChange = (val: string) => {
    setPhone(val);
    if (sameAsPhone) {
      setRefundUpiPhone(val);
    }
  };

  const handleCopyUpiId = () => {
    navigator.clipboard.writeText(settings.payment.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const upiIntentUri = generateUpiUri(
    settings.payment.upiId,
    settings.payment.payeeName,
    cartTotal,
    undefined,
    `Saree Reservation (${cart.length} items)`
  );

  const qrImageUrl = settings.payment.qrCodeUrl || getUpiQrCodeImageUrl(
    settings.payment.upiId,
    settings.payment.payeeName,
    cartTotal
  );

  const validateForm = (): boolean => {
    if (!name.trim()) {
      setErrorMsg('Please enter your full customer name.');
      return false;
    }
    if (!phone.trim() || phone.length < 10) {
      setErrorMsg('Please provide a valid 10-digit mobile contact number.');
      return false;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please provide a valid email address for order confirmation.');
      return false;
    }
    if (!address.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      setErrorMsg('Please provide complete shipping address with city, state & pincode.');
      return false;
    }
    if (!upiTransactionId.trim() || upiTransactionId.trim().length < 6) {
      setErrorMsg('Please enter your Prepaid Payment Transaction ID / UTR from your UPI app.');
      return false;
    }
    if (!refundUpiId.trim() || !refundUpiId.includes('@')) {
      setErrorMsg('Please provide a valid Refund UPI ID (e.g. name@okhdfcbank or phone@upi) for refund safety.');
      return false;
    }
    const finalRefundPhone = sameAsPhone ? phone.trim() : refundUpiPhone.trim();
    if (!finalRefundPhone || finalRefundPhone.length < 10) {
      setErrorMsg('Please provide your UPI-linked mobile phone number for potential refunds.');
      return false;
    }

    setErrorMsg('');
    return true;
  };

  const handleCheckout = (method: 'submit_order' | 'whatsapp') => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    const finalRefundPhone = sameAsPhone ? phone.trim() : refundUpiPhone.trim();

    try {
      const createdOrder = placeOrder({
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
        upiTransactionId: upiTransactionId.trim(),
        refundUpiId: refundUpiId.trim(),
        refundUpiPhone: finalRefundPhone,
        notes: notes.trim(),
        checkoutMethod: method,
      });

      if (method === 'whatsapp') {
        const waText = formatWhatsAppOrderMessage(createdOrder, settings);
        openWhatsApp(settings.contactPhone, waText);
      }

      setIsSubmitting(false);
      onSuccess();
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg('Unable to place order. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-900 text-white shrink-0">
          <div>
            <div className="flex items-center gap-2 text-xs text-amber-300 font-semibold tracking-wider uppercase">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Prepaid Handloom Reservation</span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold mt-0.5">
              Secure Checkout & UPI Payment
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Order Summary Preview */}
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
              <span className="font-semibold text-neutral-700">Order Items ({cart.length})</span>
              <span className="text-emerald-700 font-medium">Free Express Delivery</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {cart.map((item) => (
                <span
                  key={item.product.id}
                  className="text-xs bg-white border border-neutral-200 px-2.5 py-1 rounded-lg text-neutral-800"
                >
                  {item.product.title} (×{item.quantity})
                </span>
              ))}
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-neutral-200">
              <span className="text-xs text-neutral-600">Total Payable Amount:</span>
              <span className="text-xl font-bold text-neutral-950 font-serif tabular-nums">
                {formatPrice(cartTotal)}
              </span>
            </div>
          </div>

          {/* Section 2: Customer & Shipping Details Form */}
          <div>
            <h3 className="font-serif text-base sm:text-lg font-bold text-neutral-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-rose-950 text-amber-200 text-xs flex items-center justify-center font-sans font-bold">1</span>
              <span>Delivery & Shipping Address</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-neutral-700 font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Smt. Priyamvada Sharma"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                />
              </div>

              <div>
                <label className="block text-neutral-700 font-medium mb-1">WhatsApp / Phone Number *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-neutral-700 font-medium mb-1">Email Address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="For digital invoice & tracking updates"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-neutral-700 font-medium mb-1">Street Address / House No / Apartment *</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Complete door-to-door delivery address"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                />
              </div>

              <div>
                <label className="block text-neutral-700 font-medium mb-1">City *</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Chennai, Mumbai, Bengaluru"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-neutral-700 font-medium mb-1">State *</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Tamil Nadu"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-neutral-700 font-medium mb-1">Pincode *</label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="6 digits"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-neutral-700 font-medium mb-1">Gift Note / Blouse Stitching Notes (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special packing request or notes for the boutique owner"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Prepaid UPI Payment Step */}
          <div className="pt-4 border-t border-neutral-200">
            <h3 className="font-serif text-base sm:text-lg font-bold text-neutral-900 mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-rose-950 text-amber-200 text-xs flex items-center justify-center font-sans font-bold">2</span>
              <span>Prepaid UPI Payment (Pay Before Submitting)</span>
            </h3>

            <p className="text-xs text-neutral-500 mb-4">
              All sarees are exclusive single-piece handlooms. Please transfer <strong className="text-neutral-900 font-semibold">{formatPrice(cartTotal)}</strong> using the boutique's official UPI ID or QR code below.
            </p>

            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* QR Code visual */}
                <div className="flex flex-col items-center text-center p-3 bg-white rounded-xl border border-amber-200 shadow-xs">
                  <div className="relative group">
                    <img
                      src={qrImageUrl}
                      alt="Boutique UPI QR Code"
                      referrerPolicy="no-referrer"
                      className="w-44 h-44 object-contain rounded-lg"
                    />
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-2 font-medium">
                    Scan with Google Pay, PhonePe, Paytm, BHIM
                  </p>
                </div>

                {/* Direct UPI ID & Mobile App Intent */}
                <div className="space-y-3">
                  <div>
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                      Store UPI ID
                    </span>
                    <div className="mt-1 flex items-center gap-1.5 p-2 bg-white rounded-xl border border-neutral-300">
                      <code className="text-xs font-mono font-bold text-neutral-900 flex-1 truncate">
                        {settings.payment.upiId}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyUpiId}
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium flex items-center gap-1 shrink-0 transition"
                      >
                        {copiedUpi ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                      Payee Registered Name
                    </span>
                    <p className="text-xs font-semibold text-neutral-800 mt-0.5">
                      {settings.payment.payeeName}
                    </p>
                  </div>

                  {/* Mobile Direct Pay Intent */}
                  <a
                    href={upiIntentUri}
                    className="w-full py-2.5 px-3 rounded-xl bg-rose-950 hover:bg-rose-900 text-amber-200 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition"
                  >
                    <Smartphone className="w-4 h-4 text-amber-300" />
                    <span>Pay {formatPrice(cartTotal)} on UPI App</span>
                  </a>
                </div>
              </div>

              {/* Transaction ID input (Mandatory) */}
              <div className="mt-4 pt-4 border-t border-amber-200/80">
                <label className="block text-xs font-bold text-neutral-900 mb-1">
                  Enter Payment Transaction ID (UTR / Reference Number) *
                </label>
                <input
                  type="text"
                  value={upiTransactionId}
                  onChange={(e) => setUpiTransactionId(e.target.value)}
                  placeholder="e.g. 12-digit UTR: 402918471928"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 uppercase"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Found in your banking/UPI receipt history immediately after paying.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Mandatory Refund Details Capture */}
          <div className="pt-4 border-t border-neutral-200">
            <h3 className="font-serif text-base sm:text-lg font-bold text-neutral-900 mb-1 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-800 text-emerald-100 text-xs flex items-center justify-center font-sans font-bold">3</span>
              <span>Customer Refund Details (Safeguard in Case of Cancellation)</span>
            </h3>

            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 mb-3 text-xs text-emerald-950 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-900">100% Refund Assurance Guarantee</p>
                <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                  In the event of cancellation or if this single-edition handloom piece becomes unavailable, your payment will be refunded immediately to this account.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-neutral-700 font-bold mb-1">Your Refund UPI ID *</label>
                <input
                  type="text"
                  value={refundUpiId}
                  onChange={(e) => setRefundUpiId(e.target.value)}
                  placeholder="e.g. yourname@oksbi or 9876543210@paytm"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-neutral-700 font-bold">Refund UPI Mobile Phone *</label>
                  <label className="flex items-center gap-1 text-[11px] text-neutral-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sameAsPhone}
                      onChange={(e) => {
                        setSameAsPhone(e.target.checked);
                        if (e.target.checked) setRefundUpiPhone(phone);
                      }}
                      className="rounded text-rose-900"
                    />
                    <span>Same as shipping</span>
                  </label>
                </div>
                <input
                  type="tel"
                  disabled={sameAsPhone}
                  value={sameAsPhone ? phone : refundUpiPhone}
                  onChange={(e) => setRefundUpiPhone(e.target.value)}
                  placeholder="10-digit mobile linked to your UPI"
                  className={`w-full p-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden ${
                    sameAsPhone ? 'bg-neutral-100 text-neutral-600' : 'bg-white text-neutral-900'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer with Dual Checkout Options */}
        <div className="p-4 sm:p-6 border-t border-neutral-200 bg-neutral-50 shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-left w-full sm:w-auto">
              <span className="text-[11px] text-neutral-500 uppercase font-semibold">Total Payable</span>
              <p className="text-xl font-serif font-bold text-neutral-900 tabular-nums">
                {formatPrice(cartTotal)}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
              {/* Option A: Submit Order directly */}
              <button
                type="button"
                onClick={() => handleCheckout('submit_order')}
                disabled={isSubmitting}
                className="py-3 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition whitespace-nowrap"
              >
                <Send className="w-4 h-4" />
                <span>Submit Order</span>
              </button>

              {/* Option B: Send Order via WhatsApp */}
              <button
                type="button"
                onClick={() => handleCheckout('whatsapp')}
                disabled={isSubmitting}
                className="py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition whitespace-nowrap"
              >
                <MessageSquare className="w-4 h-4 fill-white" />
                <span>Send Order via WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
