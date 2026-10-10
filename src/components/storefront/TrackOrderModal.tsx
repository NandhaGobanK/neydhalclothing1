import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus } from '../../types/store';
import { formatPrice, openWhatsApp, formatWhatsAppCustomerCancellationRequest } from '../../utils/upi';
import {
  Search,
  X,
  Package,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  Copy,
  Check,
  MessageSquare,
  AlertCircle,
  RotateCcw,
  Ban,
  ArrowRight,
} from 'lucide-react';

interface TrackOrderModalProps {
  onClose: () => void;
}

export const TrackOrderModal: React.FC<TrackOrderModalProps> = ({ onClose }) => {
  const { orders, requestOrderCancellation, settings } = useStore();
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Cancellation Request Form State
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('Change of wedding / event schedule');
  const [customReasonText, setCustomReasonText] = useState('');
  const [cancelStatusMsg, setCancelStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check URL params if present (e.g., #track?order=AARA-1082 or ?order=AARA-1082)
  useEffect(() => {
    const syncFromUrl = () => {
      if (typeof window === 'undefined') return;
      const fullUrl = window.location.href;
      const matchOrder = fullUrl.match(/[?&#]order=([^&#]+)/i);
      const matchPhone = fullUrl.match(/[?&#]phone=([^&#]+)/i);

      const targetOrder = matchOrder ? decodeURIComponent(matchOrder[1]).trim() : '';
      const targetPhone = matchPhone ? decodeURIComponent(matchPhone[1]).trim() : '';

      const paramVal = targetOrder || targetPhone;
      if (paramVal) {
        setQuery(paramVal);
        setSearchedQuery(paramVal);
      }
    };

    syncFromUrl();
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  // Compute matched orders dynamically & reactively from live `orders` state
  const matchedOrders = useMemo(() => {
    if (!searchedQuery.trim()) return [];
    const clean = searchedQuery.trim().toLowerCase();
    const cleanDigits = searchedQuery.replace(/[^0-9]/g, '');

    // 1. Strict exact Order Number match first to avoid showing wrong order
    const exactOrderMatch = orders.find(
      (o) => o.orderNumber.trim().toLowerCase() === clean
    );
    if (exactOrderMatch) {
      return [exactOrderMatch];
    }

    // 2. Strict exact Payment UTR match
    const exactUtrMatch = orders.find(
      (o) => o.upiTransactionId.trim().toLowerCase() === clean
    );
    if (exactUtrMatch) {
      return [exactUtrMatch];
    }

    // 3. Fallback matching
    return orders
      .filter((o) => {
        const matchOrderNum = o.orderNumber.toLowerCase().includes(clean);
        const matchName = o.customer.name.toLowerCase().includes(clean);
        const matchUtr = o.upiTransactionId.toLowerCase().includes(clean);

        // Only match phone number if query looks like phone digits (at least 6 digits)
        const matchPhone =
          cleanDigits.length >= 6 &&
          o.customer.phone.replace(/[^0-9]/g, '').includes(cleanDigits);

        return matchOrderNum || matchName || matchUtr || matchPhone;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, searchedQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearchedQuery(query.trim());
    setCancelStatusMsg(null);
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
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

  const handleSubmitCancellation = (e: React.FormEvent, method: 'web' | 'whatsapp') => {
    e.preventDefault();
    if (!cancellingOrder) return;

    const finalReason = cancelReason === 'Other' ? customReasonText.trim() || 'Customer requested' : cancelReason;

    const res = requestOrderCancellation(cancellingOrder.orderNumber, cancellingOrder.customer.phone, finalReason);

    if (res.success) {
      setCancelStatusMsg({ type: 'success', text: res.message });

      if (method === 'whatsapp') {
        const waMsg = formatWhatsAppCustomerCancellationRequest(cancellingOrder, finalReason, settings);
        openWhatsApp(settings.contactPhone, waMsg);
      }

      setCancellingOrder(null);
    } else {
      setCancelStatusMsg({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-neutral-900 text-white flex items-center justify-between border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-bold">Track Your Saree Order</h2>
              <p className="text-xs text-neutral-400">
                Live dispatch status, courier consignment ID & cancellation request
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

        {/* Search Bar */}
        <div className="p-4 sm:p-6 bg-neutral-50/70 border-b border-neutral-200 shrink-0">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter 10-digit Phone Number OR Order # (e.g. AARA-1082)"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 bg-white text-xs sm:text-sm text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs sm:text-sm transition whitespace-nowrap"
            >
              Track Order
            </button>
          </form>

          {cancelStatusMsg && (
            <div
              className={`mt-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
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
              <span>{cancelStatusMsg.text}</span>
            </div>
          )}

          <p className="text-[11px] text-neutral-500 mt-2">
            Enter the exact order number or contact phone used during checkout.
          </p>
        </div>

        {/* Results Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {!searchedQuery ? (
            <div className="py-12 text-center text-neutral-500">
              <Truck className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
              <p className="font-serif text-base font-bold text-neutral-800">
                Track Live Order Progress
              </p>
              <p className="text-xs max-w-sm mx-auto mt-1">
                Enter your order reference (e.g. AARA-1082) or mobile number above to see live stage status, courier consignment, and cancellation options.
              </p>
            </div>
          ) : matchedOrders.length === 0 ? (
            <div className="py-12 text-center text-neutral-500">
              <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-2" />
              <p className="font-serif text-base font-bold text-neutral-800">No Orders Found</p>
              <p className="text-xs max-w-sm mx-auto mt-1">
                We couldn't find an order matching "{searchedQuery}". Please check your order reference number or mobile number.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {matchedOrders.map((order) => {
                const currentStep = getStatusStepIndex(order.status);
                const isCancelled = order.status === 'Cancelled' || order.status === 'Rejected';
                const canRequestCancel =
                  !isCancelled &&
                  order.status !== 'Delivered' &&
                  !order.cancellationRequest?.requested;

                return (
                  <div
                    key={order.id}
                    className="p-5 rounded-2xl border border-neutral-200 bg-white shadow-xs space-y-4"
                  >
                    {/* Top Order Badge & Date */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-rose-950 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200">
                            #{order.orderNumber}
                          </span>
                          <span className="text-neutral-500 text-[11px]">
                            {new Date(order.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          {/* Live Status Pill */}
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              order.status === 'Shipped'
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : order.status === 'Delivered'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : order.status === 'Confirmed'
                                ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                : order.status === 'Cancelled' || order.status === 'Rejected'
                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            Status: {order.status}
                          </span>
                        </div>
                        <p className="text-neutral-600 text-[11px] mt-1 font-medium">
                          Customer: <strong className="text-neutral-900">{order.customer.name}</strong> ({order.customer.phone})
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-[11px] text-neutral-500">Total Value:</span>
                        <p className="font-serif font-bold text-base text-neutral-900 tabular-nums">
                          {formatPrice(order.totalAmount)}
                        </p>
                      </div>
                    </div>

                    {/* Customer Cancellation Request Pending Notice (Only if not already Shipped/Delivered/Cancelled) */}
                    {!isCancelled && order.status !== 'Shipped' && order.status !== 'Delivered' && order.cancellationRequest?.requested && order.cancellationRequest.status === 'pending' && (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span>Cancellation Request Submitted (Under Review)</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Your request to cancel this order has been submitted to the boutique on{' '}
                          {new Date(order.cancellationRequest.requestedAt).toLocaleDateString('en-IN')}. Our concierge team is processing the refund.
                        </p>
                        <p className="text-[11px] text-amber-800 italic">
                          Reason: "{order.cancellationRequest.reason}"
                        </p>
                      </div>
                    )}

                    {/* Stage Timeline (When Not Cancelled) */}
                    {!isCancelled ? (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                            Order Progress
                          </span>
                          {order.assignedStaffName && (
                            <span className="text-[11px] text-neutral-600">
                              Attending Concierge: <strong>{order.assignedStaffName}</strong>
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-2 mt-2 pt-2">
                          {[
                            { name: 'Pending', icon: Clock },
                            { name: 'Confirmed', icon: CheckCircle },
                            { name: 'Shipped', icon: Truck },
                            { name: 'Delivered', icon: Package },
                          ].map((step, idx) => {
                            const isDone = currentStep >= idx;
                            const isCurrent = currentStep === idx;
                            const Icon = step.icon;
                            return (
                              <div key={step.name} className="flex flex-col items-center text-center">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                                    isDone
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-neutral-100 text-neutral-400'
                                  } ${isCurrent ? 'ring-4 ring-emerald-100' : ''}`}
                                >
                                  <Icon className="w-4 h-4" />
                                </div>
                                <span
                                  className={`text-[11px] mt-1.5 font-semibold ${
                                    isCurrent
                                      ? 'text-emerald-800'
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
                    ) : (
                      /* Cancelled or Rejected Banner */
                      <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                          <h4 className="font-bold text-sm">Order {order.status}</h4>
                        </div>
                        {order.cancellationReason && (
                          <p className="text-xs text-rose-950 font-medium">
                            <strong>Reason:</strong> {order.cancellationReason}
                          </p>
                        )}
                        <p className="text-[11px] text-rose-800 leading-relaxed">
                          This saree reservation has been cancelled. Please review refund transaction record below.
                        </p>
                      </div>
                    )}

                    {/* Courier & Tracking Details Box (When Shipped) */}
                    {order.status === 'Shipped' && order.shippingDetails && (
                      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 space-y-2">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-blue-700" />
                          <h4 className="font-bold text-xs">Courier Consignment Dispatch Information</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-lg border border-blue-100">
                          <div>
                            <span className="text-neutral-500 text-[11px] font-semibold">Courier Partner:</span>
                            <p className="font-bold text-neutral-900 mt-0.5">
                              {order.shippingDetails.courierName}
                            </p>
                          </div>
                          <div>
                            <span className="text-neutral-500 text-[11px] font-semibold">
                              Consignment Tracking Number:
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <code className="font-mono font-bold text-xs text-neutral-900">
                                {order.shippingDetails.trackingNumber}
                              </code>
                              <button
                                onClick={() => copyText(order.shippingDetails!.trackingNumber, `track-${order.id}`)}
                                className="p-1 hover:bg-neutral-100 rounded text-neutral-600"
                                title="Copy Consignment ID"
                              >
                                {copiedKey === `track-${order.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                        <p className="text-[11px] text-blue-800 leading-relaxed">
                          Note: You can monitor your order status directly on this page or copy your Consignment ID above to track on {order.shippingDetails.courierName}'s official portal.
                        </p>
                      </div>
                    )}

                    {/* Refund Information (If Cancelled/Rejected) */}
                    {isCancelled && (
                      <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                            <RotateCcw className="w-4 h-4 text-amber-700" />
                            <span>Refund Settlement Details</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            order.refundDetails?.refundStatus === 'processed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {order.refundDetails?.refundStatus === 'processed' ? 'Refund Processed' : 'Refund In Queue'}
                          </span>
                        </div>

                        {order.refundDetails?.refundUtr ? (
                          <div className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-amber-200">
                            <span className="font-semibold text-neutral-600">Bank Refund UTR ID:</span>
                            <div className="flex items-center gap-1">
                              <code className="font-mono font-bold text-neutral-900">
                                {order.refundDetails.refundUtr}
                              </code>
                              <button
                                onClick={() => copyText(order.refundDetails.refundUtr!, `utr-${order.id}`)}
                                className="p-0.5 text-neutral-500 hover:text-neutral-900"
                                title="Copy Refund UTR"
                              >
                                {copiedKey === `utr-${order.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-neutral-600">
                            Our team is transferring the amount to your UPI ID ({order.refundDetails?.refundUpiId || 'your provided account'}). The Bank UTR will appear here once processed.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Items List with Product SKU Code */}
                    <div>
                      <span className="text-[11px] font-semibold text-neutral-500 uppercase">
                        Sarees in this Order:
                      </span>
                      <div className="mt-1 space-y-1">
                        {order.items.map((item) => (
                          <div
                            key={item.product.id}
                            className="flex justify-between items-center py-1.5 border-b border-neutral-100 last:border-0"
                          >
                            <div>
                              <p className="font-medium text-neutral-900">{item.product.title}</p>
                              <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                                <span className="font-mono font-semibold text-rose-950 bg-rose-50 px-1 rounded">
                                  SKU: {item.product.productCode}
                                </span>
                                <span>{item.product.fabric} - {item.product.color} (Qty: {item.quantity})</span>
                              </div>
                            </div>
                            <span className="font-bold tabular-nums text-neutral-900">
                              {formatPrice(item.product.price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Actions: Cancel Request or WhatsApp Support */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100">
                      {canRequestCancel ? (
                        <button
                          onClick={() => setCancellingOrder(order)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 font-medium text-xs transition"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Request Order Cancellation</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-neutral-400">
                          {isCancelled
                            ? 'Order already cancelled'
                            : order.status === 'Delivered'
                            ? 'Delivered'
                            : 'Cancellation requested'}
                        </span>
                      )}

                      <button
                        onClick={() => {
                          const text = `Namaste! Regarding my saree order #${order.orderNumber} for ${formatPrice(order.totalAmount)}. Status: ${order.status}.`;
                          openWhatsApp(settings.contactPhone, text);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition ml-auto"
                      >
                        <MessageSquare className="w-3.5 h-3.5 fill-white" />
                        <span>Chat with Boutique Concierge</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* Customer Cancellation Request Drawer/Modal */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-400" />
                <h3 className="font-serif text-base font-bold">
                  Cancel Order #{cancellingOrder.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setCancellingOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-700 space-y-1">
                <p>Order Reference: <strong>#{cancellingOrder.orderNumber}</strong></p>
                <p>Total Paid Amount: <strong className="text-neutral-900 font-serif">{formatPrice(cancellingOrder.totalAmount)}</strong></p>
                <p className="text-[11px] text-emerald-800 pt-1">
                  100% refund will be deposited to your UPI ID: {cancellingOrder.refundDetails?.refundUpiId || 'account on file'}.
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
                  <option value="Change of wedding / event schedule">Change of wedding / event schedule</option>
                  <option value="Ordered wrong color / fabric shade">Ordered wrong color / fabric shade</option>
                  <option value="Selected another heirloom saree">Selected another heirloom saree</option>
                  <option value="Delivery address change required">Delivery address change required</option>
                  <option value="Other">Other reason (specify below)</option>
                </select>
              </div>

              {cancelReason === 'Other' && (
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Specify Reason</label>
                  <textarea
                    rows={2}
                    value={customReasonText}
                    onChange={(e) => setCustomReasonText(e.target.value)}
                    placeholder="Briefly state reason..."
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                  />
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={(e) => handleSubmitCancellation(e, 'web')}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-900 hover:bg-rose-800 text-white font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Submit Cancellation Request</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => handleSubmitCancellation(e, 'whatsapp')}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="w-4 h-4 fill-white" />
                  <span>Send Cancellation Request via WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCancellingOrder(null)}
                  className="w-full py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-semibold"
                >
                  Keep My Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
