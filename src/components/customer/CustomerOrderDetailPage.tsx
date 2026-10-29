import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus } from '../../types/store';
import { formatPrice } from '../../utils/upi';
import { formatDeviceDateTime } from '../../utils/deviceTime';
import { resolveCourierDetails, buildCourierTrackingUrl } from '../../utils/courier';
import { OrderLiveChat } from '../common/OrderLiveChat';
import { getOrderStatusColorTheme } from './CustomerOrdersPage';
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  ShieldCheck,
  ExternalLink,
  MessageSquare,
  Copy,
  Check,
  MapPin,
  Calendar,
  CreditCard,
  Printer,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CustomerOrderDetailPageProps {
  orderId?: string;
  onBack?: () => void;
  onOpenProductDetails?: (productId: string) => void;
}

export const CustomerOrderDetailPage: React.FC<CustomerOrderDetailPageProps> = ({
  orderId,
  onBack,
  onOpenProductDetails,
}) => {
  const {
    customerOrders,
    orders,
    selectedCustomerOrderId,
    setSelectedCustomerOrderId,
    setCustomerActiveTab,
    settings,
    requestOrderCancellation,
  } = useStore();

  const activeId = orderId || selectedCustomerOrderId;
  const order: Order | undefined =
    customerOrders.find((o) => o.id === activeId) ||
    orders.find((o) => o.id === activeId);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('Found another weave / Changed mind');
  const [cancelStatusMsg, setCancelStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleReturn = () => {
    setSelectedCustomerOrderId(null);
    if (onBack) {
      onBack();
    } else {
      setCustomerActiveTab('orders');
    }
  };

  if (!order) {
    return (
      <div className="min-h-screen pb-28 bg-neutral-50/60 p-6 flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-3xl border border-neutral-200 max-w-md text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-neutral-100 mx-auto flex items-center justify-center text-neutral-400">
            <Package className="w-8 h-8" />
          </div>
          <h2 className="font-serif font-bold text-lg text-neutral-900">Order Not Found</h2>
          <p className="text-xs text-neutral-500">
            We could not locate this order in your local patron session. Please select from your orders list or lookup by phone number.
          </p>
          <button
            type="button"
            onClick={handleReturn}
            className="px-5 py-2.5 rounded-xl bg-neutral-900 text-white font-bold text-xs hover:bg-neutral-800 transition cursor-pointer"
          >
            Back to My Orders
          </button>
        </div>
      </div>
    );
  }

  const theme = getOrderStatusColorTheme(order.status);
  const courierInfo = order.shippingDetails
    ? resolveCourierDetails(order.shippingDetails.courierName, settings.courierServices)
    : null;
  const trackingUrl = order.shippingDetails
    ? buildCourierTrackingUrl(courierInfo || undefined, order.shippingDetails.courierName, order.shippingDetails.trackingNumber)
    : null;

  // Stages for the visual timeline stepper
  const stages: { key: OrderStatus; label: string; desc: string }[] = [
    { key: 'Pending', label: 'Order Placed', desc: '12-digit UTR submitted' },
    { key: 'Confirmed', label: 'Verified & Packed', desc: 'Payment verified & order packed' },
    { key: 'Shipped', label: 'In Transit', desc: 'Handed over to courier partner' },
    { key: 'Delivered', label: 'Delivered', desc: 'Delivered to recipient address' },
  ];

  const getStageIndex = (status: OrderStatus | string) => {
    const s = (status || '').toLowerCase().trim();
    if (s === 'pending' || s === 'pending_verification' || s === 'pending_payment') {
      return 0;
    }
    if (s === 'confirmed') return 1;
    if (s === 'shipped') return 2;
    if (s === 'delivered') return 3;
    if (s === 'cancelled' || s === 'refunded' || s === 'rejected') return -1;
    return 0;
  };

  const currentStageIndex = getStageIndex(order.status);

  return (
    <div className="min-h-screen pb-28 bg-neutral-50/60">
      {/* Top Navigation Bar */}
      <div className="sticky top-18 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200 px-4 py-4 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleReturn}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-neutral-700 hover:text-neutral-950 px-3 py-1.5 rounded-xl hover:bg-neutral-100 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-rose-900" />
            <span>Back to My Orders</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700 hover:text-neutral-950 px-3 py-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Invoice</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Prominent Color-Coded Stage Header Banner */}
        <div className={`p-5 sm:p-6 rounded-3xl border ${theme.border} ${theme.lightBg} shadow-xs space-y-4`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-500">
                  Order Details
                </span>
                <span className="font-mono font-bold text-sm text-neutral-900 bg-white px-2 py-0.5 rounded border border-neutral-200">
                  #{order.orderNumber}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(order.orderNumber, 'ord')}
                  className="p-1 rounded text-neutral-400 hover:text-neutral-700 transition"
                  title="Copy Order Number"
                >
                  {copiedKey === 'ord' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <h1 className="font-serif font-bold text-xl sm:text-2xl text-neutral-900 mt-1">
                Order Stage: {theme.label}
              </h1>
              <p className="text-xs text-neutral-600 mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Placed on {formatDeviceDateTime(order.createdAt)}</span>
                </span>
              </p>
            </div>

            {/* Stage Pill Badge */}
            <div className={`px-4 py-1.5 rounded-full text-xs font-bold border shadow-xs flex items-center gap-1.5 ${theme.badgeBg}`}>
              <theme.icon className="w-4 h-4" />
              <span>{theme.label}</span>
            </div>
          </div>

          {/* Visual 4-Stage Stepper (for normal flow orders) */}
          {order.status !== 'Cancelled' && order.status !== 'Refunded' ? (
            <div className="pt-2">
              <div className="grid grid-cols-4 gap-2 sm:gap-4 relative">
                {stages.map((st, idx) => {
                  const isCompleted = idx <= currentStageIndex;
                  const isCurrent = idx === currentStageIndex;

                  return (
                    <div key={st.key} className="flex flex-col items-center text-center space-y-1.5">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-2xs ${
                          isCompleted
                            ? `${theme.pillBg} ring-4 ring-white shadow-xs`
                            : 'bg-white text-neutral-400 border border-neutral-200'
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4 text-white" /> : idx + 1}
                      </div>
                      <p
                        className={`text-[11px] font-bold leading-tight ${
                          isCurrent ? theme.accent : isCompleted ? 'text-neutral-900' : 'text-neutral-400'
                        }`}
                      >
                        {st.label}
                      </p>
                      <p className="text-[9px] text-neutral-500 hidden sm:block leading-tight">
                        {st.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-white/80 rounded-2xl border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                <strong>Order Terminated:</strong> {order.cancellationReason || 'Order was cancelled or rejected by store policy.'}
              </span>
            </div>
          )}
        </div>

        {/* Courier & Tracking Section (If Shipped / Dispatched) */}
        {order.shippingDetails?.trackingNumber && (
          <div className="bg-white rounded-3xl border border-purple-200 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-purple-700" />
                </span>
                <div>
                  <h3 className="font-serif font-bold text-sm text-neutral-900">
                    Dispatched via {order.shippingDetails.courierName}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
                    <span>AWB / Tracking Number:</span>
                    <strong className="font-mono text-purple-900 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                      {order.shippingDetails.trackingNumber}
                    </strong>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(order.shippingDetails!.trackingNumber, 'track')}
                      className="text-neutral-400 hover:text-neutral-700"
                      title="Copy Tracking Number"
                    >
                      {copiedKey === 'track' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {trackingUrl && (
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>Track Courier Live</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {order.shippingDetails.notes && (
              <p className="text-xs text-purple-950/80 bg-purple-50/60 p-2.5 rounded-xl border border-purple-100">
                📌 <strong>Dispatch Note:</strong> {order.shippingDetails.notes}
              </p>
            )}
          </div>
        )}

        {/* Ordered Sarees & Items Breakdown */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-5 shadow-2xs space-y-4">
          <h3 className="font-serif font-bold text-base text-neutral-900 border-b border-neutral-100 pb-3 flex items-center justify-between">
            <span>Ordered Items ({order.items.length})</span>
            <span className="text-xs text-neutral-500 font-sans font-normal">
              Direct from Salem Artisans
            </span>
          </h3>

          <div className="divide-y divide-neutral-100">
            {order.items.map((item, idx) => (
              <div
                key={idx}
                className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <img
                    src={item.product.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                    alt={item.product.title}
                    className="w-16 h-20 sm:w-18 sm:h-22 rounded-xl object-cover border border-neutral-200 shrink-0"
                  />
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                      {item.product.fabric || item.product.category}
                    </span>
                    <h4 className="font-serif font-bold text-xs sm:text-sm text-neutral-900 truncate">
                      {item.product.title}
                    </h4>
                    <p className="text-[11px] font-mono text-neutral-400">
                      SKU: {item.product.productCode} • Qty: {item.quantity}
                    </p>
                    <p className="text-xs font-bold text-neutral-900">
                      {formatPrice(item.product.price)} each
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm sm:text-base font-serif font-bold text-neutral-950">
                    {formatPrice(item.product.price * item.quantity)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing & Billing Summary */}
          <div className="pt-4 border-t border-neutral-200 space-y-2 text-xs">
            <div className="flex justify-between text-neutral-600">
              <span>Items Total</span>
              <span className="font-bold text-neutral-900">
                {formatPrice(
                  order.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
                )}
              </span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Express Delivery Courier</span>
              <span className="text-emerald-700 font-bold uppercase tracking-wider text-[11px]">
                FREE / INCLUDED
              </span>
            </div>
            <div className="pt-2 border-t border-neutral-100 flex justify-between items-baseline">
              <span className="text-sm font-bold text-neutral-900">Grand Total Paid</span>
              <span className="text-lg font-serif font-bold text-neutral-950">
                {formatPrice(order.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment & UPI Reference Section */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <CreditCard className="w-4 h-4 text-amber-700" />
            <h3 className="font-serif font-bold text-sm text-neutral-900">
              UPI Payment & Reference Number
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                12-Digit Reference Number (UTR)
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-neutral-900">
                  {order.upiTransactionId || 'Pending Verification'}
                </span>
                {order.upiTransactionId && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(order.upiTransactionId!, 'utr')}
                    className="p-1 rounded text-neutral-400 hover:text-neutral-700"
                  >
                    {copiedKey === 'utr' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                Payment Verification Status
              </span>
              <div className="flex items-center gap-1.5 font-bold">
                {order.isPaymentVerified || order.paymentVerifiedAt || order.paymentStatus === 'verified' ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Payment Verified by Boutique</span>
                  </span>
                ) : (
                  <span className="text-amber-700 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>Awaiting Banking Reconciliation</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-neutral-500 italic">
            Disclaimer: The store reserves the right to reject an order if the payment reference number does not match banking records.
          </p>
        </div>

        {/* Delivery Address Card */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <MapPin className="w-4 h-4 text-rose-800" />
            <h3 className="font-serif font-bold text-sm text-neutral-900">
              Shipping Destination Address
            </h3>
          </div>

          <div className="text-xs space-y-1 text-neutral-700">
            <p className="font-bold text-neutral-900 text-sm">{order.customer.name}</p>
            <p className="text-neutral-600 leading-relaxed">
              {order.customer.address}, {order.customer.city}, {order.customer.state} - <strong>{order.customer.pincode}</strong>
            </p>
            <p className="text-neutral-600 pt-1">
              📱 <strong>Mobile:</strong> +91 {order.customer.phone}
            </p>
            {order.customer.email && (
              <p className="text-neutral-600">
                ✉️ <strong>Email:</strong> {order.customer.email}
              </p>
            )}
          </div>
        </div>

        {/* Live Atelier Concierge Support Chat */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-700" />
              <h3 className="font-serif font-bold text-sm text-neutral-900">
                Direct Store Support Concierge
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Support Active
            </span>
          </div>

          <p className="text-xs text-neutral-500">
            Chat directly with our store support and dispatch team regarding order queries, delivery updates, or product care.
          </p>

          <OrderLiveChat
            order={order}
            mode="customer"
            className="border border-neutral-200 rounded-2xl overflow-hidden shadow-2xs"
          />
        </div>

        {/* Order Cancellation Request (if eligible) */}
        {settings.storefrontDisplay?.allowPublicCancellation &&
          (order.status === 'Pending' || order.status === 'Confirmed') &&
          !order.cancellationRequest?.requested && (
            <div className="p-5 rounded-3xl bg-rose-50/70 border border-rose-200 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="font-bold text-xs text-rose-950">Need to cancel this drape?</h4>
                  <p className="text-[11px] text-rose-800">
                    You can request cancellation before the parcel is packaged and handed to the courier partner.
                  </p>
                </div>
                {!cancelling ? (
                  <button
                    type="button"
                    onClick={() => setCancelling(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Request Cancellation
                  </button>
                ) : null}
              </div>

              {cancelling && (
                <div className="p-3 bg-white rounded-2xl border border-rose-200 space-y-2.5">
                  <label className="block text-[11px] font-semibold text-neutral-700">
                    Select cancellation reason:
                  </label>
                  <select
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full p-2 rounded-xl border border-neutral-300 text-xs text-neutral-900"
                  >
                    <option value="Found another weave / Changed mind">Found another weave / Changed mind</option>
                    <option value="Ordered duplicate by mistake">Ordered duplicate by mistake</option>
                    <option value="Event postponed / No longer needed">Event postponed / No longer needed</option>
                    <option value="Delivery timeline too slow">Delivery timeline too slow</option>
                    <option value="Other / Personal reason">Other / Personal reason</option>
                  </select>

                  <div className="flex items-center gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setCancelling(false)}
                      className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs cursor-pointer"
                    >
                      Keep Order
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const res = requestOrderCancellation(order.orderNumber, order.customer.phone, cancelReason);
                        if (res?.success) {
                          setCancelStatusMsg({
                            type: 'success',
                            text: 'Cancellation request recorded and submitted to boutique team.',
                          });
                          setCancelling(false);
                        } else {
                          setCancelStatusMsg({
                            type: 'error',
                            text: res?.message || 'Unable to submit cancellation request.',
                          });
                        }
                      }}
                      className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
                    >
                      Confirm Cancellation Request
                    </button>
                  </div>
                </div>
              )}

              {cancelStatusMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    cancelStatusMsg.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {cancelStatusMsg.text}
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
};
