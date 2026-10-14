import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, CourierService } from '../../types/store';
import { formatPrice, openWhatsApp } from '../../utils/upi';
import {
  AlertCircle,
  Truck,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  Clock,
  Search,
  MessageSquare,
  Copy,
  Check,
  Building,
  User,
  Calendar,
  ShieldAlert,
} from 'lucide-react';

export const CustomerIssuesManager: React.FC = () => {
  const {
    orders,
    settings,
    resolveDeliveryIssue,
    reopenOrder,
    currentUser,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'investigating' | 'resolved'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Reopen prompt state
  const [reopeningOrder, setReopeningOrder] = useState<Order | null>(null);
  const [reopenReason, setReopenReason] = useState(
    'Customer delivery dispute: Parcel not received. Investigating with local courier hub.'
  );

  // Resolution prompt state
  const [resolvingOrder, setResolvingOrder] = useState<Order | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Orders with customer delivery dispute reported
  const disputedOrders = orders.filter((o) => o.deliveryIssue?.reported === true);

  const filteredDisputes = disputedOrders.filter((order) => {
    // Status filter
    const issueStatus = order.deliveryIssue?.status || 'open';
    if (filterStatus !== 'all' && issueStatus !== filterStatus) {
      return false;
    }

    // Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      order.orderNumber.toLowerCase().includes(q) ||
      order.customer.name.toLowerCase().includes(q) ||
      order.customer.phone.includes(q) ||
      (order.shippingDetails?.courierName || '').toLowerCase().includes(q) ||
      (order.shippingDetails?.trackingNumber || '').toLowerCase().includes(q) ||
      (order.deliveryIssue?.issueDescription || '').toLowerCase().includes(q)
    );
  });

  const openCount = disputedOrders.filter((o) => (o.deliveryIssue?.status || 'open') === 'open').length;
  const investigatingCount = disputedOrders.filter((o) => o.deliveryIssue?.status === 'investigating').length;
  const resolvedCount = disputedOrders.filter((o) => o.deliveryIssue?.status === 'resolved').length;

  // Helper to find courier details configured in settings
  const getCourierDetails = (courierName?: string): CourierService | undefined => {
    if (!courierName) return undefined;
    return (settings.courierServices || []).find(
      (c) => c.name.toLowerCase().trim() === courierName.toLowerCase().trim()
    );
  };

  const handleConfirmReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopeningOrder || !reopenReason.trim()) return;

    const actor = currentUser?.name || 'Store Management';
    await reopenOrder(reopeningOrder.id, actor, reopenReason.trim());
    await resolveDeliveryIssue(reopeningOrder.id, reopenReason.trim(), 'reopen');
    setReopeningOrder(null);
  };

  const handleConfirmResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingOrder) return;

    await resolveDeliveryIssue(
      resolvingOrder.id,
      resolutionNotes.trim() || 'Dispute resolved with customer and courier partner.',
      'resolve'
    );
    setResolvingOrder(null);
    setResolutionNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-600" />
            <span>Customers Issue & Delivery Disputes</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 font-sans font-semibold border border-rose-300">
              {openCount} Open
            </span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Customer non-delivery reports for orders marked Delivered/Shipped. Investigate directly with local courier offices and reopen orders for resolution.
          </p>
        </div>

        {/* Status Counters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold">
            {openCount} Open Dispute{openCount === 1 ? '' : 's'}
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
            {investigatingCount} Investigating
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
            {resolvedCount} Resolved
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-neutral-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'all', label: `All Disputes (${disputedOrders.length})` },
              { id: 'open', label: `Open (${openCount})` },
              { id: 'investigating', label: `Investigating (${investigatingCount})` },
              { id: 'resolved', label: `Resolved (${resolvedCount})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setFilterStatus(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                filterStatus === t.id
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Order #, Customer, Phone, Courier..."
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 text-xs text-neutral-900 focus:outline-hidden focus:bg-white focus:border-neutral-400"
          />
        </div>
      </div>

      {/* Disputes List */}
      {filteredDisputes.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="font-serif text-lg font-bold text-neutral-900">
            {disputedOrders.length === 0 ? 'No Delivery Disputes Reported' : 'No Matching Disputes Found'}
          </h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            {disputedOrders.length === 0
              ? 'All customer saree shipments have been delivered smoothly with zero non-receipt disputes.'
              : 'Try clearing your search query or switching dispute status filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDisputes.map((order) => {
            const courier = getCourierDetails(order.shippingDetails?.courierName);
            const issueStatus = order.deliveryIssue?.status || 'open';

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-neutral-200 p-5 sm:p-6 shadow-xs hover:border-neutral-300 transition space-y-4"
              >
                {/* Dispute Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-rose-950 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                      #{order.orderNumber}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        issueStatus === 'open'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                          : issueStatus === 'investigating'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      Dispute: {issueStatus}
                    </span>
                    <span className="text-xs text-neutral-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        Reported on{' '}
                        {order.deliveryIssue?.reportedAt
                          ? new Date(order.deliveryIssue.reportedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Recent'}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-600">
                      Order Stage: <strong className="text-neutral-900">{order.status}</strong>
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        order.isClosed
                          ? 'bg-neutral-100 text-neutral-600 border border-neutral-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {order.isClosed ? 'Closed Order' : 'Active Handling'}
                    </span>
                  </div>
                </div>

                {/* Customer Dispute Statement Callout */}
                <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-rose-950 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-rose-900">
                      Customer Non-Delivery Statement
                    </h4>
                  </div>
                  <p className="text-xs font-medium text-rose-950 leading-relaxed bg-white/70 p-3 rounded-xl border border-rose-100">
                    "{order.deliveryIssue?.issueDescription || 'Customer reports parcel not received at delivery address.'}"
                  </p>
                  {order.deliveryIssue?.resolutionNotes && (
                    <div className="text-[11px] text-emerald-900 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                      <strong>Investigation Note:</strong> {order.deliveryIssue.resolutionNotes}
                    </div>
                  )}
                </div>

                {/* Grid: Customer Details & Courier Integration Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Customer & Order Profile */}
                  <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2.5">
                    <div className="flex items-center gap-2 text-neutral-900 font-bold">
                      <User className="w-4 h-4 text-amber-600" />
                      <span>Customer & Delivery Destination</span>
                    </div>
                    <div className="space-y-1 text-neutral-700">
                      <p className="font-semibold text-neutral-900">{order.customer.name}</p>
                      <p className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-neutral-400" />
                        <a href={`tel:${order.customer.phone}`} className="hover:text-amber-800 font-mono font-medium">
                          {order.customer.phone}
                        </a>
                      </p>
                      {order.customer.email && (
                        <p className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{order.customer.email}</span>
                        </p>
                      )}
                      <p className="flex items-start gap-1.5 pt-1 text-neutral-600">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                        <span>
                          {order.customer.address}, {order.customer.city}, {order.customer.state} -{' '}
                          {order.customer.pincode}
                        </span>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
                      <span className="text-neutral-500">Total Order Value:</span>
                      <span className="font-bold font-serif text-sm text-neutral-900">
                        {formatPrice(order.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Courier Partner Office Details & Sharable Maps Link (User Request 6) */}
                  <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-950 font-bold">
                        <Truck className="w-4 h-4 text-amber-700" />
                        <span>Courier Partner Details ({order.shippingDetails?.courierName || 'Unassigned'})</span>
                      </div>
                      {order.shippingDetails?.trackingNumber && (
                        <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-amber-200">
                          <span className="font-mono font-bold text-[11px] text-neutral-900">
                            {order.shippingDetails.trackingNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(order.shippingDetails!.trackingNumber, `track-${order.id}`)
                            }
                            className="p-0.5 hover:text-amber-700"
                            title="Copy Tracking #"
                          >
                            {copiedKey === `track-${order.id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {courier ? (
                      <div className="space-y-1.5 text-neutral-800">
                        <p className="font-bold text-neutral-900 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-amber-600" />
                          <span>{courier.name} Local Branch Hub</span>
                        </p>
                        <p className="text-[11px] text-neutral-600 flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <span>
                            {courier.addressLine1}
                            {courier.addressLine2 ? `, ${courier.addressLine2}` : ''}, {courier.city} -{' '}
                            {courier.pincode}
                          </span>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                          <p className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-neutral-500" />
                            <a href={`tel:${courier.phone}`} className="hover:text-amber-800 font-semibold">
                              {courier.phone}
                            </a>
                          </p>
                          <p className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3.5 h-3.5 text-neutral-500" />
                            <a href={`mailto:${courier.supportEmail}`} className="hover:text-amber-800 truncate">
                              {courier.supportEmail}
                            </a>
                          </p>
                        </div>

                        {courier.mapsUrl && (
                          <div className="pt-2">
                            <a
                              href={courier.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-amber-900 border border-amber-300 font-semibold text-[11px] transition shadow-2xs"
                            >
                              <MapPin className="w-3.5 h-3.5 text-rose-600" />
                              <span>View {courier.name} on Google Maps</span>
                              <ExternalLink className="w-3 h-3 text-neutral-500" />
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-neutral-600 space-y-1">
                        <p className="font-semibold">{order.shippingDetails?.courierName || 'Partner not specified'}</p>
                        <p className="text-[11px] text-neutral-500">
                          To view complete office address, phone, and Google Maps link, configure this courier in Settings.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Resolution & Reopening Action Toolbar (User Request 6) */}
                <div className="pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Reopen Order Button */}
                    <button
                      type="button"
                      onClick={() => setReopeningOrder(order)}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      title="Reopen order to active queue so staff can investigate with courier"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-neutral-950" />
                      <span>{order.isClosed ? 'Reopen Disputed Order' : 'Update Dispute Investigation'}</span>
                    </button>

                    {/* Mark Resolved Button */}
                    {issueStatus !== 'resolved' && (
                      <button
                        type="button"
                        onClick={() => setResolvingOrder(order)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        title="Mark delivery dispute resolved"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Dispute Resolved</span>
                      </button>
                    )}
                  </div>

                  {/* Customer WhatsApp Coordination */}
                  <button
                    type="button"
                    onClick={() => {
                      const cleanPhone = order.customer.phone.replace(/[^0-9]/g, '');
                      const text = `Namaste ${order.customer.name}! 🪔✨\n\nRegarding your delivery query for order #${order.orderNumber} (${order.shippingDetails?.courierName || 'Courier'}, Tracking: ${order.shippingDetails?.trackingNumber || 'Pending'}).\n\nOur concierge team is actively investigating with the local courier dispatch office to verify handover and ensure you receive your authentic handloom saree.\n\nWarm regards,\n${settings.boutiqueName}`;
                      openWhatsApp(cleanPhone, text);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp Customer</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reopen Disputed Order Modal */}
      {reopeningOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif text-base font-bold">
                  Reopen Order #{reopeningOrder.orderNumber}
                </h3>
              </div>
            </div>

            <form onSubmit={handleConfirmReopen} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-950 space-y-1">
                <p className="font-bold">Customer Delivery Dispute Investigation</p>
                <p className="text-[11px] leading-relaxed">
                  Reopening this order will reactivate it from Closed status into active staff handling, allowing your team to coordinate with {reopeningOrder.shippingDetails?.courierName || 'the courier partner'}.
                </p>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Reopen Explanation / Audit Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Explain why this order is reopened (mandatory)..."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReopeningOrder(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold transition shadow-xs"
                >
                  Reopen Order Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Dispute Modal */}
      {resolvingOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-serif text-base font-bold">
                  Resolve Dispute for Order #{resolvingOrder.orderNumber}
                </h3>
              </div>
            </div>

            <form onSubmit={handleConfirmResolve} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Resolution Notes / Summary
                </label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g. Courier hub re-attempted delivery and customer confirmed physical receipt..."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResolvingOrder(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-xs"
                >
                  Confirm Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
