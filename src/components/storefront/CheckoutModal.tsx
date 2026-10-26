import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { formatPrice } from '../../utils/upi';
import {
  X,
  ShieldCheck,
  AlertCircle,
  Lock,
  ArrowRight,
  Sparkles,
  Building,
  CreditCard,
  QrCode,
  Wallet,
} from 'lucide-react';
import { PaytmCheckoutModal } from '../common/PaytmCheckoutModal';
import { PaytmTransactionDetails } from '../../types/store';

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

  const defaultAddr = currentCustomer?.savedAddresses?.find((a) => a.isDefault) || currentCustomer?.savedAddresses?.[0];

  // Form states
  const [name, setName] = useState(currentCustomer?.name || '');
  const [phone, setPhone] = useState(currentCustomer?.phone || '');
  const [email, setEmail] = useState(currentCustomer?.email || '');
  const [address, setAddress] = useState(defaultAddr?.address || '');
  const [city, setCity] = useState(defaultAddr?.city || '');
  const [state, setState] = useState(defaultAddr?.state || 'Tamil Nadu');
  const [pincode, setPincode] = useState(defaultAddr?.pincode || '');
  const [notes, setNotes] = useState('');

  // Paytm Modal State
  const [isPaytmOpen, setIsPaytmOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingOrderNumber, setPendingOrderNumber] = useState('');

  const validateForm = (): boolean => {
    if (!name.trim()) {
      setErrorMsg('Please enter your full customer name.');
      return false;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setErrorMsg('Please provide a valid 10-digit mobile contact number.');
      return false;
    }
    if (email.trim() && !email.includes('@')) {
      setErrorMsg('Please provide a valid email address or leave it blank.');
      return false;
    }
    if (!address.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      setErrorMsg('Please provide complete delivery address with city, state & pincode.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const handleInitiatePaytm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Generate tentative order reference
    const prefix = 'NYD';
    const tempNum = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    setPendingOrderNumber(tempNum);
    setIsPaytmOpen(true);
  };

  const handlePaytmSuccess = (details: PaytmTransactionDetails) => {
    setIsPaytmOpen(false);

    try {
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
        paymentGateway: 'paytm',
        paytmTxnId: details.txnId,
        paytmDetails: details,
        notes: notes.trim() || undefined,
        checkoutMethod: 'submit_order',
      });

      onSuccess();
    } catch (err: any) {
      console.error('Failed to record order after payment:', err);
      setErrorMsg(err?.message || 'Payment received, but failed to log order record.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-neutral-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/80">
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-neutral-900">
                Order Checkout
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Instant delivery intake & verified Paytm Payment Gateway
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/50 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Section 1: Order Summary */}
            <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200">
              <h3 className="font-serif text-sm font-bold text-neutral-900 mb-2.5">
                Items In Bag ({cart.length})
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {cart.map((item) => (
                  <span
                    key={item.product.id}
                    className="text-xs bg-white border border-neutral-200 px-2.5 py-1 rounded-lg text-neutral-800 flex items-center gap-1.5"
                  >
                    <span>{item.product.title} (×{item.quantity})</span>
                    {item.previousPrice !== undefined && item.previousPrice !== item.product.price && (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                        Rate Updated: {formatPrice(item.product.price)}
                      </span>
                    )}
                  </span>
                ))}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-neutral-200 text-xs">
                <div className="flex justify-between text-neutral-600">
                  <span>Items Subtotal:</span>
                  <span className="font-semibold text-neutral-900 tabular-nums">{formatPrice(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Delivery Charges:</span>
                  {cartShippingFee === 0 ? (
                    <span className="font-semibold text-emerald-700">Free</span>
                  ) : (
                    <span className="font-semibold text-neutral-900 tabular-nums">{formatPrice(cartShippingFee)}</span>
                  )}
                </div>
                <div className="flex justify-between items-baseline pt-1.5 border-t border-neutral-200 font-bold">
                  <span className="text-neutral-800">Total Payable Amount:</span>
                  <span className="text-xl text-neutral-950 font-serif tabular-nums">
                    {formatPrice(cartGrandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Delivery & Shipping Address */}
            <form onSubmit={handleInitiatePaytm} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-base font-bold text-neutral-900">
                  Delivery & Shipping Details
                </h3>
                <span className="text-xs text-neutral-500">* Required fields</span>
              </div>

              {/* Customer Account Auto-Fill Notification */}
              {currentCustomer && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>
                    Linked to member account: <strong>{currentCustomer.name}</strong> (+91 {currentCustomer.phone})
                  </span>
                  {currentCustomer.savedAddresses && currentCustomer.savedAddresses.length > 1 && (
                    <select
                      onChange={(e) => {
                        const selected = currentCustomer.savedAddresses.find((a) => a.id === e.target.value);
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
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-neutral-700 font-medium mb-1">Mobile / WhatsApp Number *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-neutral-900 font-mono"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="block text-neutral-700 font-medium mb-1">
                  Email Address <span className="text-neutral-400 font-normal">(Optional for tracking updates)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. priyamvada@example.com"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                />
              </div>

              <div className="text-xs">
                <label className="block text-neutral-700 font-medium mb-1">Door No., Street & Landmark *</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Flat 3B, Golden Enclave, Near Vinayagar Temple"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
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
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
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
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
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
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-neutral-900 font-mono"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="block text-neutral-700 font-medium mb-1">
                  Delivery Instructions / Notes <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Call before delivery, gift wrap request"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-neutral-900"
                />
              </div>

              {/* Error Banner */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Section 3: Paytm Payment Gateway Highlight Box */}
              <div className="mt-6 p-4 rounded-2xl bg-[#002970]/5 border border-[#002970]/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center font-bold text-base tracking-tight">
                      <span className="text-[#002970]">Pay</span>
                      <span className="text-[#00BAF2]">tm</span>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#00BAF2]/15 text-[#002970]">
                      Official Payment Gateway
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Instant Verification</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600">
                  Pay securely via Paytm Dynamic QR, any UPI app (GPay, PhonePe, BHIM), Debit/Credit Cards, Net Banking, or Paytm Wallet.
                </p>

                {/* Payment channel badges */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 text-[11px] text-slate-700 font-medium">
                    <QrCode className="w-3 h-3 text-[#00BAF2]" />
                    Dynamic UPI QR
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 text-[11px] text-slate-700 font-medium">
                    <CreditCard className="w-3 h-3 text-[#00BAF2]" />
                    Cards (Visa/Master/RuPay)
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 text-[11px] text-slate-700 font-medium">
                    <Building className="w-3 h-3 text-[#00BAF2]" />
                    Net Banking
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 text-[11px] text-slate-700 font-medium">
                    <Wallet className="w-3 h-3 text-[#00BAF2]" />
                    Paytm Wallet
                  </span>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#002970] hover:bg-[#001f54] text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4 text-[#00BAF2]" />
                  <span>Proceed to Paytm Checkout ({formatPrice(cartGrandTotal)})</span>
                  <ArrowRight className="w-4 h-4 text-[#00BAF2]" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Paytm Gateway Modal */}
      <PaytmCheckoutModal
        isOpen={isPaytmOpen}
        onClose={() => setIsPaytmOpen(false)}
        orderNumber={pendingOrderNumber}
        amount={cartGrandTotal}
        customerName={name}
        customerPhone={phone}
        customerEmail={email}
        onPaymentSuccess={handlePaytmSuccess}
        onPaymentFailure={(err) => {
          setIsPaytmOpen(false);
          setErrorMsg(`Paytm Gateway Error: ${err}`);
        }}
      />
    </>
  );
};
