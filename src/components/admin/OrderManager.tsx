import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus } from '../../types/store';
import { formatPrice, formatWhatsAppRefundMessage, openWhatsApp } from '../../utils/upi';
import {
  Search,
  Filter,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  AlertOctagon,
  Copy,
  Check,
  MessageSquare,
  ArrowUpRight,
  Download,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export const OrderManager: React.FC = () => {
  const { orders, updateOrderStatus, markRefundProcessed, settings } = useStore();
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Orders that need refund attention (Cancelled or Rejected and not marked processed)
  const pendingRefundOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        (o.status === 'Cancelled' || o.status === 'Rejected') &&
        o.refundDetails?.refundStatus === 'pending'
    );
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (selectedStatus === 'needs_refund') {
        return (
          (o.status === 'Cancelled' || o.status === 'Rejected') &&
          o.refundDetails?.refundStatus === 'pending'
        );
      }
      if (selectedStatus !== 'all' && o.status !== selectedStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.phone.includes(q) ||
          o.upiTransactionId.toLowerCase().includes(q) ||
          o.refundDetails.refundUpiId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, selectedStatus, searchQuery]);

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3 h-3" />
            <span>Pending</span>
          </span>
        );
      case 'Shipped':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <Truck className="w-3 h-3" />
            <span>Shipped</span>
          </span>
        );
      case 'Delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle className="w-3 h-3" />
            <span>Delivered</span>
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3 h-3" />
            <span>Cancelled</span>
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-200 text-neutral-800 border border-neutral-400">
            <AlertOctagon className="w-3 h-3" />
            <span>Rejected</span>
          </span>
        );
    }
  };

  const handleSendWhatsAppRefund = (order: Order) => {
    const text = formatWhatsAppRefundMessage(order, settings);
    openWhatsApp(order.customer.phone, text);
  };

  const handleExportCsv = () => {
    const headers = ['Order Number', 'Date', 'Customer Name', 'Phone', 'Email', 'Address', 'Status', 'Total', 'Payment UTR', 'Refund UPI ID', 'Refund Phone', 'Refund Status'];
    const rows = orders.map((o) => [
      o.orderNumber,
      new Date(o.createdAt).toLocaleDateString('en-IN'),
      `"${o.customer.name}"`,
      `"${o.customer.phone}"`,
      `"${o.customer.email}"`,
      `"${o.customer.address}, ${o.customer.city}, ${o.customer.state} ${o.customer.pincode}"`,
      o.status,
      o.totalAmount,
      `"${o.upiTransactionId}"`,
      `"${o.refundDetails.refundUpiId}"`,
      `"${o.refundDetails.refundUpiPhone}"`,
      o.refundDetails.refundStatus,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `aara_orders_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900">
            Boutique Order Manager
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Total {orders.length} orders recorded · Track fulfillment & automate refunds
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Refund Automation Banner / Alert (Prominently displayed) */}
      {pendingRefundOrders.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-neutral-900">
          <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500 text-neutral-950 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-base font-bold text-amber-950 flex items-center gap-2">
                  <span>Refund Action Queue ({pendingRefundOrders.length} Pending)</span>
                </h3>
                <p className="text-xs text-amber-900/80 mt-0.5 leading-relaxed">
                  Orders marked as <strong className="font-semibold text-rose-900">Cancelled</strong> or <strong className="font-semibold text-neutral-900">Rejected</strong> automatically populate the customer's saved refund UPI ID below. Transfer the amount in your UPI app and click to notify the customer on WhatsApp.
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedStatus('needs_refund')}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold whitespace-nowrap shadow-xs transition shrink-0"
            >
              Filter Refund Queue
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-neutral-200 shadow-xs">
        {/* Status Pills */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: `All (${orders.length})` },
            { id: 'Pending', label: 'Pending' },
            { id: 'Shipped', label: 'Shipped' },
            { id: 'Delivered', label: 'Delivered' },
            { id: 'Cancelled', label: 'Cancelled' },
            { id: 'Rejected', label: 'Rejected' },
            { id: 'needs_refund', label: `Needs Refund (${pendingRefundOrders.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                selectedStatus === tab.id
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order #, customer, UTR..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-neutral-300 bg-neutral-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
          />
        </div>
      </div>

      {/* Orders List / Cards */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
          <p className="font-serif text-lg font-bold text-neutral-800">No Orders in this view</p>
          <p className="text-xs text-neutral-500 mt-1">Try switching status filters or clear search.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isCancelledOrRejected = order.status === 'Cancelled' || order.status === 'Rejected';
            const refundPending = order.refundDetails.refundStatus === 'pending';

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border transition shadow-xs p-5 ${
                  refundPending
                    ? 'border-amber-400/80 bg-gradient-to-r from-amber-50/20 to-white'
                    : 'border-neutral-200/90'
                }`}
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-rose-950 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                      #{order.orderNumber}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-xs text-neutral-400">·</span>
                    <span className="text-xs font-semibold text-neutral-700">
                      via {order.checkoutMethod === 'whatsapp' ? 'WhatsApp Concierge' : 'Web Portal'}
                    </span>
                  </div>

                  {/* Status Toggle Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase mr-1">Status:</span>
                    {(['Pending', 'Shipped', 'Delivered', 'Cancelled', 'Rejected'] as OrderStatus[]).map(
                      (st) => (
                        <button
                          key={st}
                          onClick={() => updateOrderStatus(order.id, st)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                            order.status === st
                              ? st === 'Cancelled' || st === 'Rejected'
                                ? 'bg-rose-900 text-white shadow-xs'
                                : st === 'Shipped'
                                ? 'bg-blue-800 text-white shadow-xs'
                                : st === 'Delivered'
                                ? 'bg-emerald-800 text-white shadow-xs'
                                : 'bg-amber-600 text-white shadow-xs'
                              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          }`}
                        >
                          {st}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-4">
                  {/* Column 1: Customer & Shipping Details */}
                  <div className="space-y-2 text-xs">
                    <h4 className="font-serif text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Customer & Shipping Details
                    </h4>
                    <p className="font-bold text-sm text-neutral-900">{order.customer.name}</p>
                    <div className="text-neutral-600 space-y-0.5">
                      <p>
                        Phone: <strong className="text-neutral-900">{order.customer.phone}</strong>
                      </p>
                      <p>Email: {order.customer.email}</p>
                      <p className="text-neutral-700 pt-1 leading-relaxed">
                        {order.customer.address}, {order.customer.city}, {order.customer.state} - {order.customer.pincode}
                      </p>
                    </div>
                    {order.notes && (
                      <p className="mt-2 p-2 bg-amber-50 rounded-lg text-amber-900 text-[11px] border border-amber-200">
                        <strong>Note:</strong> {order.notes}
                      </p>
                    )}
                  </div>

                  {/* Column 2: Items Ordered */}
                  <div className="space-y-2 text-xs">
                    <h4 className="font-serif text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Sarees Ordered ({order.items.length})
                    </h4>
                    <div className="space-y-2 max-h-36 overflow-y-auto">
                      {order.items.map((item) => (
                        <div key={item.product.id} className="flex items-center gap-2.5 p-1.5 rounded-lg bg-neutral-50 border border-neutral-100">
                          <img
                            src={item.product.images[0] || '/src/assets/images/hero_saree_atelier_1791651761357.jpg'}
                            alt={item.product.title}
                            className="w-10 h-10 object-cover rounded-md bg-neutral-200 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-neutral-900 truncate">{item.product.title}</p>
                            <p className="text-[11px] text-neutral-500">{item.product.fabric} (Qty: {item.quantity})</p>
                          </div>
                          <span className="font-bold text-neutral-900 tabular-nums">
                            {formatPrice(item.product.price * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 flex justify-between font-bold text-sm text-neutral-900 border-t border-neutral-100">
                      <span>Total Paid:</span>
                      <span className="tabular-nums font-serif text-base">{formatPrice(order.totalAmount)}</span>
                    </div>
                  </div>

                  {/* Column 3: Payment Transaction & Refund Automation */}
                  <div className="space-y-3 text-xs bg-neutral-50/70 p-3.5 rounded-xl border border-neutral-200/80">
                    <h4 className="font-serif text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Payment Verification & Refund
                    </h4>

                    {/* Prepaid UTR */}
                    <div className="p-2.5 rounded-lg bg-white border border-neutral-200">
                      <div className="flex justify-between items-center text-[11px] text-neutral-500 mb-0.5">
                        <span className="font-semibold uppercase">Payment Transaction ID (UTR)</span>
                        <button
                          onClick={() => copyToClipboard(order.upiTransactionId, `utr-${order.id}`)}
                          className="hover:text-neutral-900 p-0.5"
                          title="Copy UTR"
                        >
                          {copiedKey === `utr-${order.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="font-mono text-xs font-bold text-neutral-950 truncate">
                        {order.upiTransactionId}
                      </p>
                    </div>

                    {/* Customer Refund UPI Details */}
                    <div className={`p-2.5 rounded-lg border ${
                      isCancelledOrRejected
                        ? 'bg-amber-50/90 border-amber-300'
                        : 'bg-white border-neutral-200'
                    }`}>
                      <div className="flex justify-between items-center text-[11px] mb-0.5">
                        <span className="font-bold text-rose-950 uppercase">Customer Refund UPI ID</span>
                        <button
                          onClick={() => copyToClipboard(order.refundDetails.refundUpiId, `refund-${order.id}`)}
                          className="hover:text-neutral-900 p-0.5"
                          title="Copy Refund UPI ID"
                        >
                          {copiedKey === `refund-${order.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="font-mono text-xs font-bold text-neutral-900 truncate">
                        {order.refundDetails.refundUpiId}
                      </p>
                      <p className="text-[11px] text-neutral-600 mt-0.5">
                        UPI Phone: <strong>{order.refundDetails.refundUpiPhone}</strong>
                      </p>
                    </div>

                    {/* Refund Automation View Action for Cancelled/Rejected Orders */}
                    {isCancelledOrRejected && (
                      <div className="pt-2 border-t border-neutral-200 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-neutral-700">Refund Status:</span>
                          <span className={`font-bold px-2 py-0.5 rounded-full ${
                            order.refundDetails.refundStatus === 'processed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {order.refundDetails.refundStatus === 'processed' ? 'Processed' : 'Action Required'}
                          </span>
                        </div>

                        <div className="flex gap-1.5 pt-1">
                          <button
                            onClick={() => handleSendWhatsAppRefund(order)}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition"
                            title="Open WhatsApp with pre-filled refund confirmation message"
                          >
                            <MessageSquare className="w-3 h-3 fill-white" />
                            <span>WhatsApp Customer</span>
                          </button>

                          {order.refundDetails.refundStatus !== 'processed' && (
                            <button
                              onClick={() => markRefundProcessed(order.id)}
                              className="py-1.5 px-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-bold transition whitespace-nowrap"
                            >
                              Mark Refunded
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
