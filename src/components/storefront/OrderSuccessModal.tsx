import React from 'react';
import { useStore } from '../../context/StoreContext';
import { formatPrice } from '../../utils/upi';
import { CheckCircle2, Copy, Check, ArrowRight, Truck, AlertCircle, Download, ShieldCheck, Sparkles } from 'lucide-react';
import { downloadSingleImage } from '../../utils/imageDownload';

interface OrderSuccessModalProps {
  onClose: () => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({ onClose }) => {
  const { lastPlacedOrder, settings, setIsTrackOrderOpen } = useStore();
  const [copiedId, setCopiedId] = React.useState(false);

  if (!lastPlacedOrder) return null;

  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(lastPlacedOrder.orderNumber);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const isRefundEnabled = settings.storefrontDisplay?.allowPublicRefunds !== false;
  const hasRefundDetails = Boolean(
    lastPlacedOrder.refundDetails?.refundUpiId || lastPlacedOrder.refundDetails?.refundUpiPhone
  );
  const showRefundUpi = isRefundEnabled && hasRefundDetails;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Top Celebration Banner */}
        <div className="p-6 bg-gradient-to-br from-rose-950 via-rose-900 to-emerald-950 text-white text-center">
          {/* Store Logo with Vibrant Emerald Border */}
          <div className="w-16 h-16 rounded-2xl bg-white p-1.5 border-2 border-emerald-400 shadow-xl mx-auto mb-3 flex items-center justify-center">
            <img
              src={settings.logoUrl || '/logo.png'}
              alt="Neydhal Clothing Logo"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Vibrant Green Neydhal Clothing Badge */}
          <div className="mb-2">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-green-600 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-md border-2 border-emerald-300">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>Neydhal Clothing</span>
            </span>
          </div>

          <h2 className="font-serif text-2xl sm:text-3xl font-bold">
            Handloom Order Placed!
          </h2>
          <p className="text-amber-200 text-xs sm:text-sm mt-1 max-w-sm mx-auto">
            Your boutique order has been recorded in our workshop ledger.
          </p>

          {/* Big Bold Order Number Badge */}
          <div className="mt-4 inline-flex items-center gap-2.5 bg-emerald-950/90 border-2 border-emerald-400 px-4 py-2 rounded-2xl shadow-lg">
            <span className="text-xs font-bold uppercase text-emerald-300 tracking-wider">Order No:</span>
            <span className="font-mono text-base sm:text-xl font-black text-white tracking-widest">
              #{lastPlacedOrder.orderNumber}
            </span>
            <button
              onClick={handleCopyOrderId}
              className="p-1 hover:bg-emerald-800 rounded-lg text-emerald-300 hover:text-white transition cursor-pointer ml-1"
              title="Copy Order ID"
            >
              {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div className="p-6 space-y-4 text-xs text-neutral-700 max-h-[60vh] overflow-y-auto">
          {/* Items summary */}
          <div className="border border-neutral-200 rounded-2xl p-4 bg-neutral-50/70">
            <h3 className="font-serif text-sm font-bold text-neutral-900 mb-2">
              Ordered Heirlooms ({lastPlacedOrder.items.length})
            </h3>
            <div className="divide-y divide-neutral-200/60">
              {lastPlacedOrder.items.map((item) => {
                const img = item.product.images?.[0];
                return (
                  <div key={item.product.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {img && (
                        <img
                          src={img}
                          alt={item.product.title}
                          className="w-10 h-12 object-cover rounded-lg border border-neutral-200 shrink-0 bg-neutral-100"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900 truncate">{item.product.title}</p>
                        <p className="text-[11px] text-neutral-500">{item.product.fabric} (Qty: {item.quantity})</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {img && (
                        <button
                          type="button"
                          onClick={() => downloadSingleImage(img, `${item.product.title}_${item.product.productCode || 'sku'}.jpg`)}
                          className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-emerald-700 border border-neutral-200 transition cursor-pointer flex items-center gap-1 text-[10px] font-semibold"
                          title="Download photo"
                        >
                          <Download className="w-3 h-3 text-emerald-600" />
                          <span className="hidden sm:inline">Save Photo</span>
                        </button>
                      )}
                      <span className="font-bold tabular-nums text-neutral-900">
                        {formatPrice(item.product.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="space-y-1 pt-2 mt-2 border-t border-neutral-200 text-xs">
              <div className="flex justify-between text-neutral-600">
                <span>Items Subtotal:</span>
                <span className="font-semibold text-neutral-900 tabular-nums">{formatPrice(lastPlacedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Delivery Charges:</span>
                {lastPlacedOrder.shippingFee === 0 ? (
                  <span className="font-semibold text-emerald-700">Free</span>
                ) : (
                  <span className="font-semibold text-neutral-900 tabular-nums">{formatPrice(lastPlacedOrder.shippingFee)}</span>
                )}
              </div>
              <div className="flex justify-between font-bold text-sm text-neutral-950 pt-1 border-t border-neutral-200">
                <span>Total Paid:</span>
                <span className="tabular-nums font-serif text-base">{formatPrice(lastPlacedOrder.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Payment & Safeguard info */}
          <div className={`grid gap-3 ${showRefundUpi ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            <div className={`p-3 rounded-xl border space-y-1.5 ${
              lastPlacedOrder.status === 'pending_verification' || !lastPlacedOrder.isPaymentVerified
                ? 'bg-amber-50/80 border-amber-300'
                : 'bg-gradient-to-r from-emerald-50/70 via-slate-50 to-[#002970]/5 border-emerald-200/80'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-neutral-800 uppercase flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>{lastPlacedOrder.paymentMethod || 'Direct UPI Payment'}</span>
                </span>
                {lastPlacedOrder.status === 'pending_verification' || !lastPlacedOrder.isPaymentVerified ? (
                  <span className="text-[9px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1 shadow-2xs">
                    <AlertCircle className="w-3 h-3 text-amber-700" />
                    <span>PENDING VERIFICATION</span>
                  </span>
                ) : (
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1 shadow-2xs">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>PAYMENT VERIFIED [PAID]</span>
                  </span>
                )}
              </div>
              <p className="font-mono text-xs font-bold text-neutral-900 mt-1 truncate">
                Txn Ref / UTR: {lastPlacedOrder.upiTransactionId || 'Awaiting Review'}
              </p>
              {lastPlacedOrder.paymentScreenshotUrl && (
                <div className="flex items-center gap-2 pt-1 text-[11px] text-amber-900 font-medium">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Payment screenshot securely uploaded & queued for atelier staff verification.</span>
                </div>
              )}
            </div>

            {showRefundUpi && (
              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/70">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase">Customer Refund UPI</span>
                {lastPlacedOrder.refundDetails.refundUpiId && (
                  <p className="font-mono text-xs font-bold text-emerald-950 mt-0.5 truncate">
                    {lastPlacedOrder.refundDetails.refundUpiId}
                  </p>
                )}
                {lastPlacedOrder.refundDetails.refundUpiPhone && (
                  <p className="text-[10px] text-emerald-700 mt-1">Phone: {lastPlacedOrder.refundDetails.refundUpiPhone}</p>
                )}
              </div>
            )}
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

          {/* Storefront Order Cancellation Policy Notice (Mandatory Requirement) */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <p className="leading-tight font-medium">
              <strong>Order Policy:</strong> No cancellation once the order is shipped
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 sm:p-6 bg-neutral-50 border-t border-neutral-100 flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={() => {
              onClose();
              setIsTrackOrderOpen(true);
              window.location.hash = `track?order=${encodeURIComponent(lastPlacedOrder.orderNumber)}`;
            }}
            className="flex-1 py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
          >
            <Truck className="w-4 h-4 text-amber-300" />
            <span>Track Order Now</span>
          </button>

          <button
            onClick={onClose}
            className="py-3 px-5 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-neutral-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <span>Back to Store</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
