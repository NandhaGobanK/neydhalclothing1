import React from 'react';
import { useStore } from '../../context/StoreContext';
import { formatPrice, openWhatsApp } from '../../utils/upi';
import { CheckCircle2, MessageSquare, Printer, Copy, Check, ArrowRight } from 'lucide-react';

interface OrderSuccessModalProps {
  onClose: () => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({ onClose }) => {
  const { lastPlacedOrder, settings } = useStore();
  const [copiedId, setCopiedId] = React.useState(false);

  if (!lastPlacedOrder) return null;

  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(lastPlacedOrder.orderNumber);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleWhatsAppChat = () => {
    const text = `Namaste! Regarding my saree order #${lastPlacedOrder.orderNumber} placed for ${formatPrice(lastPlacedOrder.totalAmount)}. Transaction ID: ${lastPlacedOrder.upiTransactionId}.`;
    openWhatsApp(settings.contactPhone, text);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Top Celebration Banner */}
        <div className="p-6 bg-gradient-to-br from-rose-950 via-rose-900 to-rose-950 text-white text-center">
          <div className="w-14 h-14 rounded-full bg-amber-400 text-rose-950 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold">
            Handloom Order Reserved!
          </h2>
          <p className="text-amber-200 text-xs sm:text-sm mt-1 max-w-sm mx-auto">
            Your boutique order has been recorded in our workshop ledger.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 bg-black/40 border border-amber-400/30 px-3.5 py-1.5 rounded-full text-xs font-mono">
            <span>Reference: #{lastPlacedOrder.orderNumber}</span>
            <button
              onClick={handleCopyOrderId}
              className="text-amber-300 hover:text-white transition"
              title="Copy Order ID"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div className="p-6 space-y-4 text-xs text-neutral-700 max-h-[60vh] overflow-y-auto">
          {/* Items summary */}
          <div className="border border-neutral-200 rounded-2xl p-4 bg-neutral-50/70">
            <h3 className="font-serif text-sm font-bold text-neutral-900 mb-2">
              Reserved Heirlooms ({lastPlacedOrder.items.length})
            </h3>
            <div className="divide-y divide-neutral-200/60">
              {lastPlacedOrder.items.map((item) => (
                <div key={item.product.id} className="py-2 first:pt-0 last:pb-0 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-neutral-900">{item.product.title}</p>
                    <p className="text-[11px] text-neutral-500">{item.product.fabric} (Qty: {item.quantity})</p>
                  </div>
                  <span className="font-bold tabular-nums text-neutral-900">
                    {formatPrice(item.product.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-2 mt-2 border-t border-neutral-200 flex justify-between font-bold text-sm text-neutral-950">
              <span>Total Paid</span>
              <span className="tabular-nums font-serif text-base">{formatPrice(lastPlacedOrder.totalAmount)}</span>
            </div>
          </div>

          {/* Payment & Refund Safeguard info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase">Payment Transaction UTR</span>
              <p className="font-mono text-xs font-bold text-neutral-900 mt-0.5 truncate">
                {lastPlacedOrder.upiTransactionId}
              </p>
              <p className="text-[10px] text-emerald-700 mt-1">Status: Recorded for Verification</p>
            </div>

            <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/70">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase">Customer Refund UPI</span>
              <p className="font-mono text-xs font-bold text-emerald-950 mt-0.5 truncate">
                {lastPlacedOrder.refundDetails.refundUpiId}
              </p>
              <p className="text-[10px] text-emerald-700 mt-1">Phone: {lastPlacedOrder.refundDetails.refundUpiPhone}</p>
            </div>
          </div>

          {/* Shipping destination */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase">Shipping Destination</span>
            <p className="font-medium text-neutral-900 mt-0.5">{lastPlacedOrder.customer.name}</p>
            <p className="text-neutral-600 text-[11px]">
              {lastPlacedOrder.customer.address}, {lastPlacedOrder.customer.city}, {lastPlacedOrder.customer.state} - {lastPlacedOrder.customer.pincode}
            </p>
            <p className="text-neutral-500 text-[11px] mt-0.5">Contact: {lastPlacedOrder.customer.phone}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 sm:p-6 bg-neutral-50 border-t border-neutral-100 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleWhatsAppChat}
            className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition"
          >
            <MessageSquare className="w-4 h-4 fill-white" />
            <span>Chat with Boutique Concierge</span>
          </button>

          <button
            onClick={onClose}
            className="py-3 px-6 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition"
          >
            <span>Back to Boutique</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
