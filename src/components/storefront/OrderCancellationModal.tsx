import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order } from '../../types/store';
import { formatPrice, openWhatsApp, formatWhatsAppCustomerCancellationRequest } from '../../utils/upi';
import {
  Ban,
  X,
  Search,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Clock,
  ArrowRight,
  ShieldCheck,
  Send,
} from 'lucide-react';

interface OrderCancellationModalProps {
  onClose: () => void;
  initialOrderNumber?: string;
  initialPhone?: string;
}

export const OrderCancellationModal: React.FC<OrderCancellationModalProps> = ({
  onClose,
  initialOrderNumber = '',
  initialPhone = '',
}) => {
  const { orders, requestOrderCancellation, settings } = useStore();

  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [phone, setPhone] = useState(initialPhone);
  const [reasonCategory, setReasonCategory] = useState('Wedding / Event Date Changed');
  const [customReason, setCustomReason] = useState('');
  const [refundUpi, setRefundUpi] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);

  const reasonOptions = [
    'Wedding / Event Date Changed',
    'Selected Another Handloom Design in Boutique',
    'Ordered by Mistake / Accidental Booking',
    'Delivery Date Required Earlier',
    'Financial / Budget Adjustment',
    'Other Reason',
  ];

  const handleSubmit = (e: React.FormEvent, viaWhatsApp = false) => {
    e.preventDefault();
    if (!orderNumber.trim() || !phone.trim()) {
      setStatusMsg({ type: 'error', text: 'Please provide both your Order Number and Registered Mobile Number.' });
      return;
    }

    const finalReason = reasonCategory === 'Other Reason'
      ? customReason.trim() || 'Customer requested cancellation'
      : reasonCategory + (customReason.trim() ? ` - ${customReason.trim()}` : '');

    const res = requestOrderCancellation(orderNumber.trim(), phone.trim(), finalReason);

    if (res.success && res.order) {
      setSubmittedOrder(res.order);
      setStatusMsg({ type: 'success', text: res.message });

      if (viaWhatsApp) {
        const waMsg = formatWhatsAppCustomerCancellationRequest(res.order, finalReason, settings);
        openWhatsApp(settings.contactPhone, waMsg);
      }
    } else {
      setStatusMsg({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-neutral-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-base sm:text-lg font-bold">Request Order Cancellation</h2>
              <p className="text-[11px] text-neutral-400">
                Cancel your saree reservation & initiate direct UPI refund
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 text-xs">
          {settings.storefrontDisplay?.allowPublicCancellation === false && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Public Cancellation Requests Disabled</p>
                <p className="text-[11px] leading-relaxed">
                  Direct online cancellations are currently disabled by boutique policy. Please contact our concierge team directly on WhatsApp for assistance with pending or confirmed orders.
                </p>
              </div>
            </div>
          )}

          {statusMsg && (
            <div
              className={`p-3.5 rounded-2xl flex items-start gap-2.5 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-950'
                  : 'bg-rose-50 border border-rose-200 text-rose-950'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-bold">{statusMsg.type === 'success' ? 'Cancellation Recorded' : 'Notice'}</p>
                <p className="text-[11px] leading-relaxed">{statusMsg.text}</p>
                {statusMsg.type === 'success' && submittedOrder && (
                  <p className="text-[11px] text-emerald-800 pt-1 font-medium">
                    Order #{submittedOrder.orderNumber} for {formatPrice(submittedOrder.totalAmount)} is now flagged for concierge refund processing.
                  </p>
                )}
              </div>
            </div>
          )}

          {!submittedOrder ? (
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-800 mb-1">
                    Order Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. AARA-1082"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 font-mono text-xs uppercase text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/30"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-800 mb-1">
                    Registered Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9820198201"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 font-mono text-xs text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-800 mb-1">
                  Reason for Cancellation *
                </label>
                <select
                  value={reasonCategory}
                  onChange={(e) => setReasonCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-xs text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/30"
                >
                  {reasonOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-neutral-800 mb-1">
                  Additional Details / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Tell our concierge team if you wish to reschedule or change your drape..."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/30"
                />
              </div>

              {/* Policy note */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-600 text-[11px] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-neutral-800">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>Boutique Refund Guarantee</span>
                </div>
                <p>
                  Orders that have not been dispatched can be cancelled immediately. Our team transfers 100% of the prepaid amount directly back to your registered UPI account and sends a bank UTR confirmation.
                </p>
              </div>

              {/* Dual Action Buttons */}
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <span>Submit to Boutique</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs"
                >
                  <MessageSquare className="w-3.5 h-3.5 fill-white" />
                  <span>Request via WhatsApp</span>
                </button>
              </div>
            </form>
          ) : (
            /* After Success */
            <div className="space-y-4 pt-2">
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Order Reference:</span>
                  <span className="font-mono font-bold text-neutral-900">#{submittedOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Order Value:</span>
                  <span className="font-bold text-neutral-900">{formatPrice(submittedOrder.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Refund Target:</span>
                  <span className="font-mono text-neutral-900">{submittedOrder.refundDetails?.refundUpiId || submittedOrder.customer.phone}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => {
                    const finalReason = reasonCategory === 'Other Reason'
                      ? customReason.trim() || 'Customer requested cancellation'
                      : reasonCategory;
                    const waMsg = formatWhatsAppCustomerCancellationRequest(submittedOrder, finalReason, settings);
                    openWhatsApp(settings.contactPhone, waMsg);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <MessageSquare className="w-4 h-4 fill-white" />
                  <span>Notify Concierge on WhatsApp</span>
                </button>
                <button
                  onClick={onClose}
                  className="py-2.5 px-4 rounded-xl border border-neutral-300 text-neutral-700 font-semibold text-xs hover:bg-neutral-100 transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
