import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus } from '../../types/store';
import {
  formatPrice,
  formatWhatsAppStageUpdateMessage,
  formatWhatsAppRefundMessage,
  openWhatsApp,
} from '../../utils/upi';
import {
  Search,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  AlertOctagon,
  Copy,
  Check,
  MessageSquare,
  Download,
  RotateCcw,
  Package,
  X,
  Send,
  Edit,
  Sparkles,
} from 'lucide-react';

export const OrderManager: React.FC = () => {
  const {
    orders,
    updateOrderStatus,
    updateOrderShipping,
    markRefundProcessed,
    assignOrderStaff,
    resolveCancellationRequest,
    staffMembers,
    settings,
    currentUser,
    currentPermissions,
  } = useStore();
  const isAdmin = currentUser?.type === 'admin';
  const canEditOrders = isAdmin || currentPermissions?.orders?.canEdit !== false;
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Cancellation Reason Modal State (Prompt request: If rejected or cancelled we need to send the reason for those actions)
  const [cancellationModalOrder, setCancellationModalOrder] = useState<{
    order: Order;
    targetStatus: 'Cancelled' | 'Rejected';
  } | null>(null);
  const [cancellationReasonPreset, setCancellationReasonPreset] = useState('Weaver Loom Backlog / Out of Stock');
  const [cancellationReasonCustom, setCancellationReasonCustom] = useState('');

  // Shipping Modal State
  const [shippingModalOrder, setShippingModalOrder] = useState<Order | null>(null);
  const [courierName, setCourierName] = useState('DTDC Express');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');

  // Refund Modal State
  const [refundModalOrder, setRefundModalOrder] = useState<Order | null>(null);
  const [refundUtr, setRefundUtr] = useState('');
  const [refundNotes, setRefundNotes] = useState('');

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
        if (!((o.status === 'Cancelled' || o.status === 'Rejected') && o.refundDetails?.refundStatus === 'pending')) {
          return false;
        }
      } else if (selectedStatus !== 'all' && o.status !== selectedStatus) {
        return false;
      }

      if (selectedStaffFilter === 'unassigned' && o.assignedStaffId) {
        return false;
      } else if (selectedStaffFilter !== 'all' && selectedStaffFilter !== 'unassigned' && o.assignedStaffId !== selectedStaffFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.phone.includes(q) ||
          o.upiTransactionId.toLowerCase().includes(q) ||
          (o.refundDetails?.refundUpiId && o.refundDetails.refundUpiId.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [orders, selectedStatus, selectedStaffFilter, searchQuery]);

  const handleStatusChange = (order: Order, newStatus: OrderStatus) => {
    if (newStatus === 'Shipped' && !order.shippingDetails?.trackingNumber) {
      // Open Shipping details modal
      setShippingModalOrder(order);
      setCourierName(order.shippingDetails?.courierName || 'DTDC Express');
      setTrackingNumber(order.shippingDetails?.trackingNumber || '');
      setShippingNotes(order.shippingDetails?.notes || '');
      return;
    }

    if (newStatus === 'Cancelled' || newStatus === 'Rejected') {
      // Open cancellation reason modal first so admin specifies why
      setCancellationModalOrder({ order, targetStatus: newStatus });
      setCancellationReasonPreset('Weaver Loom Backlog / Out of Stock');
      setCancellationReasonCustom('');
      return;
    }

    updateOrderStatus(order.id, newStatus);
  };

  const handleSaveCancellation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellationModalOrder) return;

    const finalReason =
      cancellationReasonPreset === 'Other Reason'
        ? cancellationReasonCustom.trim() || 'Cancelled by boutique concierge'
        : cancellationReasonPreset + (cancellationReasonCustom.trim() ? ` - ${cancellationReasonCustom.trim()}` : '');

    const { order, targetStatus } = cancellationModalOrder;

    updateOrderStatus(order.id, targetStatus, {
      cancellationReason: finalReason,
    });

    const updatedOrder: Order = {
      ...order,
      status: targetStatus,
      cancellationReason: finalReason,
      refundDetails: {
        ...order.refundDetails,
        refundStatus: 'pending',
      },
    };

    setCancellationModalOrder(null);

    // Open refund modal immediately to capture UTR
    setRefundModalOrder(updatedOrder);
    setRefundUtr('');
    setRefundNotes('');

    if (confirm(`Order marked as ${targetStatus}! Would you like to notify the customer on WhatsApp with the reason now?`)) {
      const msg = formatWhatsAppStageUpdateMessage(updatedOrder, settings);
      openWhatsApp(updatedOrder.customer.phone, msg);
    }
  };

  const handleSaveShipping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingModalOrder || !trackingNumber.trim()) return;

    updateOrderShipping(shippingModalOrder.id, {
      courierName: courierName.trim(),
      trackingNumber: trackingNumber.trim(),
      notes: shippingNotes.trim(),
    });

    const updatedOrder: Order = {
      ...shippingModalOrder,
      status: 'Shipped',
      shippingDetails: {
        courierName: courierName.trim(),
        trackingNumber: trackingNumber.trim(),
        notes: shippingNotes.trim(),
      },
    };

    setShippingModalOrder(null);

    // Ask to send WhatsApp notification immediately
    if (confirm('Shipment details saved! Would you like to send a dispatch update with courier & tracking details to the customer on WhatsApp now?')) {
      const msg = formatWhatsAppStageUpdateMessage(updatedOrder, settings);
      openWhatsApp(updatedOrder.customer.phone, msg);
    }
  };

  const handleSaveRefund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundModalOrder || !refundUtr.trim()) return;

    markRefundProcessed(refundModalOrder.id, refundUtr.trim(), refundNotes.trim());

    const updatedOrder: Order = {
      ...refundModalOrder,
      refundDetails: {
        ...refundModalOrder.refundDetails,
        refundStatus: 'processed',
        refundUtr: refundUtr.trim(),
      },
    };

    setRefundModalOrder(null);

    // Prompt to send refund WhatsApp notification
    if (confirm('Refund marked as completed! Would you like to send the Refund UTR notification to the customer on WhatsApp now?')) {
      const msg = formatWhatsAppRefundMessage(updatedOrder, settings);
      openWhatsApp(updatedOrder.customer.phone, msg);
    }
  };

  const handleSendStageWhatsApp = (order: Order) => {
    const text = formatWhatsAppStageUpdateMessage(order, settings);
    openWhatsApp(order.customer.phone, text);
  };

  const handleExportCsv = () => {
    const headers = [
      'Order Number',
      'Date',
      'Customer Name',
      'Phone',
      'Email',
      'Address',
      'Status',
      'Total Amount',
      'Payment Transaction UTR',
      'Courier Name',
      'Tracking Number',
      'Refund UPI ID',
      'Refund UPI Phone',
      'Refund Status',
      'Refund UTR ID',
      'Customer Comments',
    ];

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
      `"${o.shippingDetails?.courierName || ''}"`,
      `"${o.shippingDetails?.trackingNumber || ''}"`,
      `"${o.refundDetails?.refundUpiId || ''}"`,
      `"${o.refundDetails?.refundUpiPhone || ''}"`,
      o.refundDetails?.refundStatus || '',
      `"${o.refundDetails?.refundUtr || ''}"`,
      `"${(o.notes || '').replace(/"/g, '""')}"`,
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
      {/* Top Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900">
            Boutique Order Manager
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Total {orders.length} orders recorded · Multi-stage WhatsApp updates & Refund automation
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold shadow-xs transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Orders CSV</span>
        </button>
      </div>

      {/* Refund Automation Banner if any orders need refund */}
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
                  Cancelled or Rejected orders require manual banking transfer. Input your bank's <strong className="text-neutral-950 font-bold">Refund UTR ID</strong> to update the customer and send WhatsApp confirmation.
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedStatus('needs_refund')}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold whitespace-nowrap shadow-xs transition shrink-0"
            >
              View Refund Queue
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs, Staff Filter & Search Controls */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-neutral-200 shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
          {[
            { id: 'all', label: `All (${orders.length})` },
            { id: 'Pending', label: 'Pending' },
            { id: 'Confirmed', label: 'Confirmed' },
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

        <div className="flex items-center gap-2 w-full lg:w-auto">
          {/* Staff Filter */}
          <div className="shrink-0">
            <select
              value={selectedStaffFilter}
              onChange={(e) => setSelectedStaffFilter(e.target.value)}
              className="py-1.5 px-2.5 rounded-xl border border-neutral-300 text-xs bg-neutral-50/70 text-neutral-800"
            >
              <option value="all">All Staff</option>
              <option value="unassigned">Unassigned Orders</option>
              {staffMembers.map((s) => (
                <option key={s.id} value={s.id}>
                  Staff: {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order #, customer, UTR, SKU..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-neutral-300 bg-neutral-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
            />
          </div>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
          <p className="font-serif text-lg font-bold text-neutral-800">No Orders in this view</p>
          <p className="text-xs text-neutral-500 mt-1">Try switching status filters or clear search.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isCancelledOrRejected = order.status === 'Cancelled' || order.status === 'Rejected';
            const refundPending = isCancelledOrRejected && order.refundDetails?.refundStatus === 'pending';

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border transition shadow-xs p-5 ${
                  refundPending
                    ? 'border-amber-400 bg-gradient-to-r from-amber-50/20 to-white'
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

                  {/* Order Stage Toggles (Pending -> Confirmed -> Shipped -> Delivered -> Cancelled -> Rejected) */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase mr-1">Stage:</span>
                    {(['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Rejected'] as OrderStatus[]).map(
                      (st) => {
                        const isCurrent = order.status === st;
                        return (
                          <button
                            key={st}
                            onClick={() => handleStatusChange(order, st)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                              isCurrent
                                ? st === 'Cancelled' || st === 'Rejected'
                                  ? 'bg-rose-900 text-white shadow-xs'
                                  : st === 'Shipped'
                                  ? 'bg-blue-800 text-white shadow-xs'
                                  : st === 'Delivered'
                                  ? 'bg-emerald-800 text-white shadow-xs'
                                  : st === 'Confirmed'
                                  ? 'bg-purple-800 text-white shadow-xs'
                                  : 'bg-amber-600 text-white shadow-xs'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                            }`}
                          >
                            {st}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Cancellation Request Alert Banner if Customer requested cancellation */}
                {order.cancellationRequest?.requested && order.cancellationRequest.status === 'pending' && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-xs flex items-center gap-1.5 text-amber-900">
                        <AlertOctagon className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Customer Cancellation Request Received</span>
                      </p>
                      <p className="text-[11px] mt-0.5 text-amber-900 leading-relaxed">
                        Reason: <em>"{order.cancellationRequest.reason}"</em>
                      </p>
                      <p className="text-[10px] text-amber-700 mt-0.5">
                        Submitted: {new Date(order.cancellationRequest.requestedAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setCancellationModalOrder({ order, targetStatus: 'Cancelled' });
                          setCancellationReasonPreset(order.cancellationRequest?.reason || 'Customer Requested Cancellation');
                          setCancellationReasonCustom('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs shadow-xs"
                      >
                        Approve & Process Refund
                      </button>
                      <button
                        onClick={() => {
                          const note = prompt('Reason for declining cancellation request:', 'Order has already been packed / dispatched') || '';
                          resolveCancellationRequest(order.id, 'reject', note);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 font-semibold text-xs"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )}

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-4">
                  {/* Column 1: Customer Details, Assigned Staff & Reason */}
                  <div className="space-y-2.5 text-xs">
                    <h4 className="font-serif text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Customer & Handling Concierge
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

                    {/* Assigned Staff Member Dropdown (Prompt Request: assign staff members to orders) */}
                    <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                      <span className="font-bold text-[11px] text-neutral-700 block uppercase tracking-wide">
                        Assigned Boutique Staff:
                      </span>
                      <select
                        value={order.assignedStaffId || ''}
                        onChange={(e) => {
                          const sId = e.target.value;
                          const sMember = staffMembers.find((s) => s.id === sId);
                          assignOrderStaff(order.id, sId, sMember?.name || '');
                        }}
                        className="w-full p-1.5 rounded-lg border border-neutral-300 text-xs bg-white text-neutral-900 font-medium"
                      >
                        <option value="">Unassigned (Assign Staff)</option>
                        {staffMembers.map((staff) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.name} (@{staff.username}) {staff.isLocked ? '[Locked]' : ''}
                          </option>
                        ))}
                      </select>
                      {order.lastUpdatedBy && (
                        <p className="text-[10px] text-neutral-500 font-mono">
                          Last comment updated by: @{order.lastUpdatedBy}
                        </p>
                      )}
                    </div>

                    {/* Cancellation / Rejection Reason Badge (If cancelled) */}
                    {isCancelledOrRejected && order.cancellationReason && (
                      <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-950 text-xs space-y-0.5">
                        <span className="font-bold text-rose-900 block text-[11px] uppercase tracking-wide">
                          Reason for {order.status}:
                        </span>
                        <p className="font-medium">{order.cancellationReason}</p>
                      </div>
                    )}

                    {/* Customer Sending Comments / Instructions (Accurately highlighted) */}
                    {order.notes && (
                      <div className="p-2.5 bg-amber-50 rounded-xl text-amber-950 text-xs border border-amber-200/80">
                        <span className="font-bold text-amber-900 block text-[11px] uppercase tracking-wide">
                          Customer Comments / Instructions:
                        </span>
                        <p className="mt-0.5 italic">"{order.notes}"</p>
                      </div>
                    )}
                  </div>

                  {/* Column 2: Items Ordered with SKU Code */}
                  <div className="space-y-2 text-xs">
                    <h4 className="font-serif text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Items Ordered ({order.items.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {order.items.map((item) => (
                        <div key={item.product.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-neutral-50 border border-neutral-100">
                          <img
                            src={item.product.images[0] || '/src/assets/images/hero_saree_atelier_1791651761357.jpg'}
                            alt={item.product.title}
                            className="w-11 h-13 object-cover rounded-md bg-neutral-200 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-neutral-900 truncate">{item.product.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono font-bold text-rose-950 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 text-[10px]">
                                SKU: {item.product.productCode}
                              </span>
                              <span className="text-[11px] text-neutral-500">Qty: {item.quantity}</span>
                            </div>
                            <p className="text-[11px] text-neutral-500">{item.product.fabric} - {item.product.color}</p>
                          </div>
                          <span className="font-bold text-neutral-900 tabular-nums">
                            {formatPrice(item.product.price * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1 pt-2 border-t border-neutral-100 text-xs">
                      <div className="flex justify-between text-neutral-600">
                        <span>Items Subtotal:</span>
                        <span className="font-semibold text-neutral-900 tabular-nums">{formatPrice(order.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-neutral-600">
                        <span>Delivery Fee:</span>
                        {order.shippingFee === 0 ? (
                          <span className="font-semibold text-emerald-700">Free</span>
                        ) : (
                          <span className="font-semibold text-neutral-900 tabular-nums">{formatPrice(order.shippingFee)}</span>
                        )}
                      </div>
                      <div className="flex justify-between font-bold text-sm text-neutral-900 pt-1 border-t border-neutral-100">
                        <span>Total Paid:</span>
                        <span className="tabular-nums font-serif text-base">{formatPrice(order.totalAmount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Payment UTR, Courier Details, and Refund UTR */}
                  <div className="space-y-3 text-xs bg-neutral-50/70 p-3.5 rounded-xl border border-neutral-200/80">
                    <h4 className="font-serif text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Fulfillment & Verification
                    </h4>

                    {/* Customer's Prepaid UTR */}
                    <div className="p-2.5 rounded-lg bg-white border border-neutral-200">
                      <div className="flex justify-between items-center text-[11px] text-neutral-500 mb-0.5">
                        <span className="font-semibold uppercase">Customer Payment UTR</span>
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

                    {/* Courier Information (if Shipped) */}
                    {order.status === 'Shipped' && (
                      <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-950 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[11px] uppercase">Courier Consignment:</span>
                          <button
                            onClick={() => {
                              setShippingModalOrder(order);
                              setCourierName(order.shippingDetails?.courierName || 'DTDC Express');
                              setTrackingNumber(order.shippingDetails?.trackingNumber || '');
                              setShippingNotes(order.shippingDetails?.notes || '');
                            }}
                            className="text-[11px] text-blue-700 hover:underline flex items-center gap-0.5"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        </div>
                        <p className="font-semibold">
                          {order.shippingDetails?.courierName || 'DTDC Express'}
                        </p>
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                          <span>Tracking ID: {order.shippingDetails?.trackingNumber || 'Pending'}</span>
                          {order.shippingDetails?.trackingNumber && (
                            <button
                              onClick={() => copyToClipboard(order.shippingDetails!.trackingNumber, `track-${order.id}`)}
                              className="text-neutral-600 hover:text-neutral-900"
                            >
                              {copiedKey === `track-${order.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Customer Refund Coordinates (If present or Cancelled) */}
                    {(isCancelledOrRejected || order.refundDetails?.refundUpiId) && (
                      <div className={`p-2.5 rounded-lg border ${
                        isCancelledOrRejected ? 'bg-amber-50 border-amber-300' : 'bg-white border-neutral-200'
                      }`}>
                        <div className="flex justify-between items-center text-[11px] mb-0.5">
                          <span className="font-bold text-rose-950 uppercase">Customer Refund UPI</span>
                          {order.refundDetails?.refundUpiId && (
                            <button
                              onClick={() => copyToClipboard(order.refundDetails.refundUpiId!, `refund-${order.id}`)}
                              className="hover:text-neutral-900 p-0.5"
                              title="Copy Refund UPI ID"
                            >
                              {copiedKey === `refund-${order.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                        <p className="font-mono text-xs font-bold text-neutral-900 truncate">
                          {order.refundDetails?.refundUpiId || 'Not provided by customer'}
                        </p>
                        {order.refundDetails?.refundUpiPhone && (
                          <p className="text-[11px] text-neutral-600 mt-0.5">
                            Phone: {order.refundDetails.refundUpiPhone}
                          </p>
                        )}
                        {/* Refund UTR Display if processed */}
                        {order.refundDetails?.refundUtr && (
                          <div className="mt-1.5 pt-1.5 border-t border-amber-200 flex items-center justify-between text-[11px]">
                            <span className="font-bold text-emerald-800">Refund UTR ID:</span>
                            <span className="font-mono font-bold text-neutral-900">{order.refundDetails.refundUtr}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stage WhatsApp Update & Refund Buttons */}
                    <div className="pt-2 border-t border-neutral-200 space-y-1.5">
                      {/* 1-Click WhatsApp Stage Update (Prompt request: Order should be updated to users on each stage via WhatsApp) */}
                      <button
                        onClick={() => handleSendStageWhatsApp(order)}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs"
                        title={`Send ${order.status} stage notification on WhatsApp`}
                      >
                        <MessageSquare className="w-3.5 h-3.5 fill-white" />
                        <span>Send '{order.status}' WhatsApp Update</span>
                      </button>

                      {/* Process Refund Action for Cancelled/Rejected Orders */}
                      {isCancelledOrRejected && order.refundDetails?.refundStatus !== 'processed' && (
                        <button
                          onClick={() => {
                            setRefundModalOrder(order);
                            setRefundUtr('');
                            setRefundNotes('');
                          }}
                          className="w-full py-1.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Input Refund UTR & Complete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation / Rejection Reason Modal (Prompt request: if rejected or cancelled we need to send the reason for those actions) */}
      {cancellationModalOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-rose-400" />
                <h3 className="font-serif text-base font-bold">
                  Reason for {cancellationModalOrder.targetStatus} #{cancellationModalOrder.order.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setCancellationModalOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCancellation} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-950 space-y-1">
                <p className="font-bold">Customer: {cancellationModalOrder.order.customer.name}</p>
                <p>Phone: {cancellationModalOrder.order.customer.phone}</p>
                <p>Order Value: {formatPrice(cancellationModalOrder.order.totalAmount)}</p>
                <p className="text-[11px] text-rose-800 pt-0.5">
                  This explanation will be recorded in the order history, visible on the customer's Track Order screen, and sent in their WhatsApp update.
                </p>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Select Action Reason *
                </label>
                <select
                  value={cancellationReasonPreset}
                  onChange={(e) => setCancellationReasonPreset(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900"
                >
                  <option value="Weaver Loom Backlog / Out of Stock">Weaver Loom Backlog / Handloom Out of Stock</option>
                  <option value="Payment Transaction UTR Not Verified">Payment Transaction UTR Not Verified / Failed</option>
                  <option value="Customer Requested Cancellation via Portal / WhatsApp">Customer Requested Cancellation</option>
                  <option value="Delivery Pincode Unserviceable by Insured Courier">Delivery Pincode Unserviceable by Courier</option>
                  <option value="Duplicate Order Entry">Duplicate Order Entry</option>
                  <option value="Other Reason">Other Custom Reason</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Specific Details / Message to Customer (Optional)
                </label>
                <textarea
                  rows={2}
                  value={cancellationReasonCustom}
                  onChange={(e) => setCancellationReasonCustom(e.target.value)}
                  placeholder="e.g. Master weaver artisan informed loom delay of 3 weeks..."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancellationModalOrder(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold"
                >
                  Confirm & Open Refund Form
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Courier & Tracking Modal */}
      {shippingModalOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif text-base font-bold">
                  Update Shipment for #{shippingModalOrder.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setShippingModalOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveShipping} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-800 mb-1">Courier Partner *</label>
                <select
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900"
                >
                  <option value="DTDC Express">DTDC Express</option>
                  <option value="Blue Dart Express">Blue Dart Express</option>
                  <option value="India Post (Speed Post)">India Post (Speed Post)</option>
                  <option value="Delhivery Express">Delhivery Express</option>
                  <option value="Professional Couriers">The Professional Couriers</option>
                  <option value="Shadowfax">Shadowfax</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Courier Tracking ID / Consignment Number *
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  required
                  placeholder="e.g. DTDC9021849102"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 font-mono text-xs text-neutral-900 uppercase"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Customers can look up this exact consignment code using the Track Order link on the public storefront.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Dispatch Notes (Optional)
                </label>
                <input
                  type="text"
                  value={shippingNotes}
                  onChange={(e) => setShippingNotes(e.target.value)}
                  placeholder="e.g. Sealed with luxury silk seal"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShippingModalOrder(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold"
                >
                  Save & Mark as Shipped
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refund UTR Modal */}
      {refundModalOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif text-base font-bold">
                  Process Refund for #{refundModalOrder.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setRefundModalOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRefund} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 space-y-1">
                <p className="font-bold">Refund Target Coordinates:</p>
                <p>Customer: <strong>{refundModalOrder.customer.name}</strong></p>
                <p>Refund UPI ID: <strong>{refundModalOrder.refundDetails?.refundUpiId || 'Check WhatsApp chat'}</strong></p>
                <p>Refund Phone: <strong>{refundModalOrder.refundDetails?.refundUpiPhone || refundModalOrder.customer.phone}</strong></p>
                <p>Total to Refund: <strong className="text-rose-900">{formatPrice(refundModalOrder.totalAmount)}</strong></p>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Bank Refund Transaction ID (UTR Number) *
                </label>
                <input
                  type="text"
                  value={refundUtr}
                  onChange={(e) => setRefundUtr(e.target.value)}
                  required
                  placeholder="e.g. UTR301928491029"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 font-mono text-xs text-neutral-900 uppercase"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  This UTR will be recorded in the order and sent directly to the customer so they can track the refunded money in their bank account.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Refund Notes (Optional)
                </label>
                <input
                  type="text"
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  placeholder="e.g. Sent via Google Pay business banking"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRefundModalOrder(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold"
                >
                  Save Refund UTR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
