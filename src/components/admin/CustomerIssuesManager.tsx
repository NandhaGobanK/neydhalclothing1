import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, CourierService, StaffMember } from '../../types/store';
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
  ShieldAlert,
  UserCheck,
  UserPlus,
  Send,
  Layers,
  Sparkles,
  X,
  Eye,
  ShoppingBag,
  Package,
  Ban,
} from 'lucide-react';
import { OrderLiveChat } from '../common/OrderLiveChat';

interface CustomerIssuesManagerProps {
  onNavigateToTab?: (tab: string, bucketStaffId?: string) => void;
}

export const CustomerIssuesManager: React.FC<CustomerIssuesManagerProps> = ({
  onNavigateToTab,
}) => {
  const {
    orders,
    settings,
    resolveDeliveryIssue,
    reopenOrder,
    closeOrder,
    currentUser,
    staffMembers,
    assignOrderStaff,
    addInvestigationComment,
    resolveCancellationRequest,
  } = useStore();

  const isAdmin = currentUser?.type === 'admin';
  const currentUserId = currentUser?.staffId || (isAdmin ? 'admin' : '');
  const currentUserName = currentUser?.name || (isAdmin ? 'Store Owner' : 'Staff Concierge');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'investigating' | 'resolved'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'cancellation' | 'delivery' | 'refund'>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'unassigned' | 'mine' | 'other'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [chatModalOrder, setChatModalOrder] = useState<Order | null>(null);

  // Clickable Disputed Order Inspection & Resolution Panel Modal State
  const [selectedDisputeDetailOrder, setSelectedDisputeDetailOrder] = useState<Order | null>(null);
  const [modalQuickComment, setModalQuickComment] = useState('');
  const [modalQuickResolutionNotes, setModalQuickResolutionNotes] = useState('');
  const [isModalResolvingOpen, setIsModalResolvingOpen] = useState(false);
  const [isModalReassigningOpen, setIsModalReassigningOpen] = useState(false);
  const [modalTargetStaffId, setModalTargetStaffId] = useState('admin');
  const [modalReassignNote, setModalReassignNote] = useState('');

  // Dynamic Routing alert banner state
  const [routingToast, setRoutingToast] = useState<{
    orderNumber: string;
    staffName: string;
    staffId: string;
  } | null>(null);

  // 1. Reopen Modal State (ONLY used when order is actually closed)
  const [reopeningOrder, setReopeningOrder] = useState<Order | null>(null);
  const [reopenReason, setReopenReason] = useState(
    'Customer issue / refund inquiry: Reopening order for further investigation and settlement verification.'
  );

  // 2. Investigation Comment Modal State (Used on active/reopened disputes - NO reopen prompt!)
  const [investigatingOrder, setInvestigatingOrder] = useState<Order | null>(null);
  const [investigationNote, setInvestigationNote] = useState('');

  // 3. Reassign Modal State
  const [reassigningOrder, setReassigningOrder] = useState<Order | null>(null);
  const [targetStaffId, setTargetStaffId] = useState<string>('admin');
  const [reassignmentNote, setReassignmentNote] = useState('');

  // 4. Resolution Modal State
  const [resolvingOrder, setResolvingOrder] = useState<Order | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Helpers to categorize customer issues
  const isRefundDisputeReported = (o: Order) =>
    o.deliveryIssue?.reported === true && o.deliveryIssue?.issueType === 'refund';

  const isCancellationCase = (o: Order) =>
    !isRefundDisputeReported(o) &&
    (o.cancellationRequest?.requested === true || o.deliveryIssue?.issueType === 'cancellation');

  const isRefundCase = (o: Order) =>
    isRefundDisputeReported(o) ||
    (!isCancellationCase(o) &&
      (o.status === 'Refunded' ||
        o.refundDetails?.refundStatus === 'processed' ||
        o.refundDetails?.refundStatus === 'pending' ||
        ((o.status === 'Cancelled' || o.status === 'Rejected') && Boolean(o.refundDetails?.refundStatus))));

  const isDeliveryCase = (o: Order) =>
    !isCancellationCase(o) &&
    o.deliveryIssue?.reported === true &&
    o.deliveryIssue?.issueType !== 'refund' &&
    o.deliveryIssue?.issueType !== 'cancellation';

  // Orders routed to Customers Issue section: Delivery disputes, refunded orders, and cancellation requests
  const disputedOrders = orders.filter(
    (o) => o.deliveryIssue?.reported === true || isRefundCase(o) || isCancellationCase(o)
  );

  // Count breakdowns
  const cancellationCasesCount = disputedOrders.filter(isCancellationCase).length;
  const deliveryDisputesCount = disputedOrders.filter(isDeliveryCase).length;
  const refundedCasesCount = disputedOrders.filter(isRefundCase).length;

  const openCount = disputedOrders.filter(
    (o) => (o.deliveryIssue?.status || (o.isClosed ? 'resolved' : 'open')) === 'open'
  ).length;
  const investigatingCount = disputedOrders.filter(
    (o) => o.deliveryIssue?.status === 'investigating'
  ).length;
  const resolvedCount = disputedOrders.filter(
    (o) => o.deliveryIssue?.status === 'resolved' || o.isClosed
  ).length;

  const unassignedDisputesCount = disputedOrders.filter(
    (o) => !o.assignedStaffId || o.assignedStaffId === 'unassigned'
  ).length;

  const myAssignedDisputesCount = disputedOrders.filter(
    (o) => o.assignedStaffId === currentUserId
  ).length;

  // Filtered list based on status, category, ownership, and search query
  const filteredDisputes = disputedOrders.filter((order) => {
    // 1. Category Filter (Cancellation vs Delivery vs Refund)
    if (categoryFilter === 'cancellation' && !isCancellationCase(order)) return false;
    if (categoryFilter === 'delivery' && !isDeliveryCase(order)) return false;
    if (categoryFilter === 'refund' && !isRefundCase(order)) return false;

    // 2. Status Filter
    const issueStatus = order.deliveryIssue?.status || (order.isClosed ? 'resolved' : 'open');
    if (filterStatus !== 'all' && issueStatus !== filterStatus) {
      return false;
    }

    // 3. Ownership Filter (Dynamic routing)
    const orderAssignedId = order.assignedStaffId;
    if (ownershipFilter === 'unassigned') {
      if (orderAssignedId && orderAssignedId !== 'unassigned') return false;
    } else if (ownershipFilter === 'mine') {
      if (orderAssignedId !== currentUserId) return false;
    } else if (ownershipFilter === 'other') {
      if (!orderAssignedId || orderAssignedId === 'unassigned' || orderAssignedId === currentUserId) {
        return false;
      }
    }

    // 4. Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      order.orderNumber.toLowerCase().includes(q) ||
      order.customer.name.toLowerCase().includes(q) ||
      order.customer.phone.includes(q) ||
      (order.assignedStaffName || '').toLowerCase().includes(q) ||
      (order.shippingDetails?.courierName || '').toLowerCase().includes(q) ||
      (order.shippingDetails?.trackingNumber || '').toLowerCase().includes(q) ||
      (order.deliveryIssue?.issueDescription || '').toLowerCase().includes(q) ||
      (order.refundDetails?.refundUtr || '').toLowerCase().includes(q) ||
      (order.refundDetails?.refundUpiId || '').toLowerCase().includes(q)
    );
  });

  // Helper to find courier details configured in settings
  const getCourierDetails = (courierName?: string): CourierService | undefined => {
    if (!courierName) return undefined;
    return (settings.courierServices || []).find(
      (c) => c.name.toLowerCase().trim() === courierName.toLowerCase().trim()
    );
  };

  // Helper for resolution duration formatting
  const formatResolutionDuration = (reportedAt?: string, resolvedAt?: string): string | null => {
    if (!reportedAt || !resolvedAt) return null;
    const diffMs = new Date(resolvedAt).getTime() - new Date(reportedAt).getTime();
    if (diffMs <= 0) return null;
    const mins = Math.round(diffMs / (1000 * 60));
    if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'}`;
    const hours = mins / 60;
    if (hours < 24) return `${hours.toFixed(1)} hrs`;
    const days = hours / 24;
    return `${days.toFixed(1)} day${days >= 2 ? 's' : ''}`;
  };

  // 1. Reopen Handler (For closed orders only)
  const handleConfirmReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopeningOrder || !reopenReason.trim()) return;

    await reopenOrder(reopeningOrder.id, currentUserName, reopenReason.trim());
    await resolveDeliveryIssue(reopeningOrder.id, reopenReason.trim(), 'reopen');
    setReopeningOrder(null);
  };

  // 2. Investigation Comment Handler (No Re-prompting for reopen reason!)
  const handleSaveInvestigationComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investigatingOrder || !investigationNote.trim()) return;

    await addInvestigationComment(
      investigatingOrder.id,
      investigationNote.trim(),
      currentUserName,
      'investigating'
    );
    setInvestigatingOrder(null);
    setInvestigationNote('');
  };

  // 3. Assign to Me Action (Dynamic Routing to user's bucket)
  const handleAssignToMe = (order: Order) => {
    assignOrderStaff(
      order.id,
      currentUserId,
      currentUserName,
      `Claimed dispute case & started investigation`
    );

    setRoutingToast({
      orderNumber: order.orderNumber,
      staffName: currentUserName,
      staffId: currentUserId,
    });
    setTimeout(() => setRoutingToast(null), 5000);
  };

  // 4. Reassign Handler (Dynamic Routing to target staff's bucket)
  const handleConfirmReassign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassigningOrder) return;

    const chosenStaff =
      targetStaffId === 'admin'
        ? { id: 'admin', name: 'Store Owner' }
        : staffMembers.find((s) => s.id === targetStaffId) || {
            id: targetStaffId,
            name: 'Staff Concierge',
          };

    const reason =
      reassignmentNote.trim() ||
      `Reassigned dispute investigation to ${chosenStaff.name}`;

    assignOrderStaff(reassigningOrder.id, chosenStaff.id, chosenStaff.name, reason);

    setRoutingToast({
      orderNumber: reassigningOrder.orderNumber,
      staffName: chosenStaff.name,
      staffId: chosenStaff.id,
    });
    setTimeout(() => setRoutingToast(null), 5000);

    setReassigningOrder(null);
    setReassignmentNote('');
  };

  // 5. Resolve Dispute Handler (With official resolution timestamp tracking)
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
            Customer non-delivery reports for orders marked Delivered/Shipped. Claim cases, reassign directly to staff buckets, log investigation updates, and record official resolution timestamps.
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

      {/* Customer Issue Alert Banner (Strictly displayed on Customer Issue page) */}
      {openCount > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-md border border-rose-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white text-rose-700 shrink-0 shadow-xs">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                <span>⚠️ Customer Issue Alert: {openCount} Open {openCount === 1 ? 'Dispute' : 'Disputes'} Pending Action</span>
              </h4>
              <p className="text-xs text-rose-100 font-medium mt-0.5">
                Customers have reported non-delivery or refund issues. Please review, claim, assign, or add investigation notes.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setFilterStatus('open');
                setOwnershipFilter('all');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-white text-rose-950 text-xs font-bold hover:bg-neutral-100 transition shadow-xs cursor-pointer"
            >
              Filter Open Issues ({openCount})
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Routing Success Alert Banner */}
      {routingToast && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500 via-emerald-600 to-emerald-700 text-white text-xs font-medium shadow-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-white/20 text-white">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">
                Case #{routingToast.orderNumber} Assigned & Dynamically Routed!
              </p>
              <p className="text-white/90 text-xs">
                This dispute has moved directly into <strong>{routingToast.staffName}</strong>'s personal bucket/view.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => {
                  if (routingToast.staffId === 'admin') {
                    onNavigateToTab('admin_bucket');
                  } else {
                    onNavigateToTab('staff_buckets', routingToast.staffId);
                  }
                  setRoutingToast(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-white text-neutral-950 font-bold hover:bg-neutral-100 transition shadow-xs cursor-pointer"
              >
                Open in Personal Bucket &rarr;
              </button>
            )}
            <button
              type="button"
              onClick={() => setRoutingToast(null)}
              className="text-white/80 hover:text-white font-bold p-1"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Routing & Ownership Strip + Status Filter Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-neutral-200 shadow-2xs space-y-3">
        {/* Ownership / Bucket Routing Tabs */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-neutral-100 pb-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mr-1">
              Routing View:
            </span>
            {[
              { id: 'all', label: `All Disputes (${disputedOrders.length})` },
              {
                id: 'unassigned',
                label: `Unassigned Triage (${unassignedDisputesCount})`,
                highlight: unassignedDisputesCount > 0,
              },
              { id: 'mine', label: `My Assigned Cases (${myAssignedDisputesCount})` },
              { id: 'other', label: 'Other Staff Cases' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setOwnershipFilter(t.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                  ownershipFilter === t.id
                    ? 'bg-neutral-950 text-white shadow-xs'
                    : t.highlight
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold hover:bg-amber-200'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Order #, Customer, Phone, Courier..."
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 text-xs text-neutral-900 focus:outline-hidden focus:bg-white focus:border-neutral-400"
            />
          </div>
        </div>

        {/* Issue Category Filter (User Request 1: Separate tracking for Delivery Disputes vs Refunded Orders) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-b border-neutral-100 pb-2">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mr-1">
            Category:
          </span>
          {[
            { id: 'all', label: `All Issues & Disputes (${disputedOrders.length})` },
            {
              id: 'cancellation',
              label: `Cancellations (${cancellationCasesCount})`,
              icon: Ban,
              highlight: cancellationCasesCount > 0,
            },
            {
              id: 'delivery',
              label: `Delivery Disputes (${deliveryDisputesCount})`,
              icon: Truck,
            },
            {
              id: 'refund',
              label: `Refunded Orders (${refundedCasesCount})`,
              icon: RotateCcw,
              highlight: refundedCasesCount > 0,
            },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.id as any)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  categoryFilter === c.id
                    ? 'bg-rose-950 text-white shadow-xs'
                    : c.highlight
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold hover:bg-amber-200'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mr-1">
            Status:
          </span>
          {[
            { id: 'all', label: 'All Stages' },
            { id: 'open', label: `Open (${openCount})` },
            { id: 'investigating', label: `Investigating (${investigatingCount})` },
            { id: 'resolved', label: `Resolved (${resolvedCount})` },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setFilterStatus(s.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                filterStatus === s.id
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-2xs'
                  : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border border-neutral-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Disputes List */}
      {filteredDisputes.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="font-serif text-lg font-bold text-neutral-900">
            {disputedOrders.length === 0
              ? 'No Delivery Disputes Reported'
              : ownershipFilter === 'unassigned'
              ? 'All Delivery Disputes Have Assigned Case Owners'
              : 'No Matching Disputes in this View'}
          </h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            {ownershipFilter === 'unassigned'
              ? 'Every reported dispute has been assigned to a boutique staff member or admin bucket.'
              : disputedOrders.length === 0
              ? 'All customer saree shipments have been delivered smoothly with zero non-receipt disputes.'
              : 'Try switching your routing view or clearing your search query.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDisputes.map((order) => {
            const courier = getCourierDetails(order.shippingDetails?.courierName);
            const issueStatus = order.deliveryIssue?.status || 'open';
            const isAssignedToMe = order.assignedStaffId === currentUserId;
            const isUnassigned = !order.assignedStaffId || order.assignedStaffId === 'unassigned';
            const commentsList = order.deliveryIssue?.investigationComments || [];
            const resolutionDuration = formatResolutionDuration(
              order.deliveryIssue?.reportedAt,
              order.disputeResolvedAt || order.deliveryIssue?.resolvedAt
            );

            return (
              <div
                key={order.id}
                onClick={() => setSelectedDisputeDetailOrder(order)}
                className={`bg-white rounded-3xl border p-5 sm:p-6 shadow-xs hover:border-amber-400 hover:shadow-md transition space-y-4 cursor-pointer group/dispute ${
                  isUnassigned
                    ? 'border-rose-300 ring-1 ring-rose-200/60'
                    : 'border-neutral-200'
                }`}
                title="Click anywhere to inspect complete order details, investigation log & resolution panel"
              >
                {/* Clickable Quick Hint Banner */}
                <div className="flex items-center justify-between text-[11px] text-neutral-400 group-hover/dispute:text-amber-800 transition pb-0.5">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Eye className="w-3.5 h-3.5 text-amber-600" />
                    <span>Click order card anywhere to view complete details, investigation log & resolution panel</span>
                  </span>
                  <span className="font-bold text-amber-700 group-hover/dispute:translate-x-0.5 transition-transform flex items-center gap-1">
                    <span>Inspect Order</span>
                    <span>&rarr;</span>
                  </span>
                </div>

                {/* Dispute Header Row with Assignment Pill */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-sm font-bold text-rose-950 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                      #{order.orderNumber}
                    </span>

                    {/* Category Identifier (Cancellation vs Refund vs Delivery) */}
                    {isCancellationCase(order) ? (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1 shadow-2xs">
                        <Ban className="w-3 h-3 text-rose-700" />
                        <span>
                          Cancellation Request · {order.cancellationRequest?.status === 'pending' ? 'Pending Review' : order.cancellationRequest?.status || 'Active'}
                        </span>
                      </span>
                    ) : isRefundCase(order) ? (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs">
                        <RotateCcw className="w-3 h-3 text-amber-700" />
                        <span>
                          Refund Case · {order.refundDetails?.refundStatus === 'processed' ? 'Refunded' : 'Refund In Queue'}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1 shadow-2xs">
                        <Truck className="w-3 h-3 text-rose-600" />
                        <span>Delivery Dispute</span>
                      </span>
                    )}

                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        issueStatus === 'open'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                          : issueStatus === 'investigating'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      Status: {issueStatus}
                    </span>

                    {/* Assigned Owner Badge */}
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                        isUnassigned
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : isAssignedToMe
                          ? 'bg-blue-100 text-blue-900 border border-blue-300'
                          : 'bg-neutral-100 text-neutral-800 border border-neutral-300'
                      }`}
                    >
                      <User className="w-3 h-3" />
                      <span>
                        {isUnassigned
                          ? 'Unassigned Dispute (Needs Owner)'
                          : isAssignedToMe
                          ? `Assigned to You (${currentUserName})`
                          : `Owner: ${order.assignedStaffName || 'Staff'}`}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDisputeDetailOrder(order);
                      }}
                      className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition shadow-2xs flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5 text-neutral-950" />
                      <span>Inspect Details & Resolution</span>
                    </button>
                  </div>
                </div>

                {/* Resolution & Timeline Milestones (User Request: Resolution Timestamps) */}
                <div className="bg-neutral-50/80 rounded-2xl p-3 border border-neutral-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-700">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      <span>
                        Reported:{' '}
                        <strong>
                          {order.deliveryIssue?.reportedAt
                            ? new Date(order.deliveryIssue.reportedAt).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Recently'}
                        </strong>
                      </span>
                    </span>

                    {order.deliveredAt && (
                      <span className="flex items-center gap-1 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          Delivered on:{' '}
                          <strong>
                            {new Date(order.deliveredAt).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </strong>
                        </span>
                      </span>
                    )}

                    {(order.disputeResolvedAt || order.deliveryIssue?.resolvedAt) && (
                      <span className="flex items-center gap-1 text-emerald-900 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded-lg border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>
                          Resolved:{' '}
                          {new Date(
                            order.disputeResolvedAt || order.deliveryIssue!.resolvedAt!
                          ).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {order.disputeResolvedBy && ` by ${order.disputeResolvedBy}`}
                        </span>
                      </span>
                    )}

                    {resolutionDuration && (
                      <span className="px-2 py-0.5 rounded-lg bg-neutral-200 text-neutral-800 text-[10px] font-bold">
                        Resolution Speed: {resolutionDuration}
                      </span>
                    )}
                  </div>

                  {/* Dynamic Action: View in Staff Bucket */}
                  {order.assignedStaffId && onNavigateToTab && (
                    <button
                      type="button"
                      onClick={() => {
                        if (order.assignedStaffId === 'admin') {
                          onNavigateToTab('admin_bucket');
                        } else {
                          onNavigateToTab('staff_buckets', order.assignedStaffId);
                        }
                      }}
                      className="text-amber-800 hover:text-amber-900 font-bold text-xs underline cursor-pointer flex items-center gap-1"
                    >
                      <Layers className="w-3 h-3" />
                      <span>Open in {order.assignedStaffName || 'Staff'}'s Bucket &rarr;</span>
                    </button>
                  )}
                </div>

                {/* Dedicated Refund Settlement Details Box (User Request 1) */}
                {order.refundDetails && (
                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 space-y-2 text-xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900">
                        <RotateCcw className="w-4 h-4 text-amber-700" />
                        <span className="uppercase tracking-wider text-[11px]">
                          Refund Settlement Status & UPI Record
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          order.refundDetails.refundStatus === 'processed'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                        }`}
                      >
                        {order.refundDetails.refundStatus === 'processed'
                          ? 'Refund Completed ✓'
                          : 'Refund Settlement Pending'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white/80 p-3 rounded-xl border border-amber-200/80 text-[11px]">
                      <div>
                        <span className="text-neutral-500 font-medium block">Refund Target UPI:</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <p className="font-mono font-bold text-neutral-900 truncate">
                            {order.refundDetails.refundUpiId || order.customer.phone}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                order.refundDetails!.refundUpiId || order.customer.phone,
                                `refund-upi-${order.id}`
                              )
                            }
                            className="p-0.5 text-neutral-500 hover:text-amber-800"
                            title="Copy UPI ID"
                          >
                            {copiedKey === `refund-upi-${order.id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-neutral-500 font-medium block">Bank UTR Reference:</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <p className="font-mono font-bold text-emerald-800 truncate">
                            {order.refundDetails.refundUtr || 'Awaiting UTR generation'}
                          </p>
                          {order.refundDetails.refundUtr && (
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(order.refundDetails!.refundUtr!, `refund-utr-${order.id}`)
                              }
                              className="p-0.5 text-neutral-500 hover:text-emerald-800"
                              title="Copy UTR ID"
                            >
                              {copiedKey === `refund-utr-${order.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-neutral-500 font-medium block">Processed At:</span>
                        <p className="text-neutral-800 font-medium mt-0.5">
                          {order.refundDetails.processedAt
                            ? new Date(order.refundDetails.processedAt).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'In Finance Queue'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Customer Issue / Dispute Statement Callout */}
                <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-rose-950 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-rose-900">
                      {isRefundCase(order)
                        ? 'Customer Inquiry / Reason for Settlement'
                        : 'Customer Non-Delivery Statement'}
                    </h4>
                  </div>
                  <p className="text-xs font-medium text-rose-950 leading-relaxed bg-white/70 p-3 rounded-xl border border-rose-100">
                    "{order.deliveryIssue?.issueDescription ||
                      order.cancellationReason ||
                      'Customer inquiry logged for boutique concierge investigation.'}"
                  </p>
                  {order.deliveryIssue?.resolutionNotes && (
                    <div className="text-[11px] text-emerald-900 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                      <strong>Latest Resolution Finding:</strong> {order.deliveryIssue.resolutionNotes}
                    </div>
                  )}
                </div>

                {/* Investigation Comments & Handover Logs Thread (User Request: Investigation Comments instead of re-prompting) */}
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/90 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-amber-600" />
                      <h4 className="font-bold text-xs text-neutral-900 uppercase tracking-wider">
                        Investigation Updates & Log Thread ({commentsList.length})
                      </h4>
                    </div>
                    {!order.isClosed && (
                      <button
                        type="button"
                        onClick={() => setInvestigatingOrder(order)}
                        className="text-xs font-bold text-amber-800 hover:text-amber-950 underline flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        <span>+ Add Investigation Note</span>
                      </button>
                    )}
                  </div>

                  {commentsList.length === 0 ? (
                    <p className="text-xs text-neutral-400 italic bg-white p-3 rounded-xl border border-neutral-200/60">
                      No investigation notes logged yet. Click "Update Dispute Investigation" below to add notes from your courier coordination.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {commentsList.map((comm) => (
                        <div
                          key={comm.id}
                          className="p-2.5 rounded-xl bg-white border border-neutral-200/80 text-xs space-y-1 shadow-2xs"
                        >
                          <div className="flex items-center justify-between text-[11px] text-neutral-500">
                            <span className="font-bold text-neutral-900 flex items-center gap-1">
                              <UserCheck className="w-3 h-3 text-amber-600" />
                              <span>{comm.author}</span>
                            </span>
                            <span>
                              {new Date(comm.timestamp).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-neutral-800 leading-relaxed font-medium">
                            {comm.comment}
                          </p>
                        </div>
                      ))}
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
                        <a
                          href={`tel:${order.customer.phone}`}
                          className="hover:text-amber-800 font-mono font-medium"
                        >
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
                          {order.customer.address}, {order.customer.city},{' '}
                          {order.customer.state} - {order.customer.pincode}
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

                  {/* Courier Partner Office Details & Sharable Maps Link */}
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
                            className="p-0.5 hover:text-amber-700 cursor-pointer"
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

                {/* Action Toolbar: Assign to Me, Reassign, Update Investigation, Reopen, Resolve, WhatsApp */}
                <div className="pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Assign to Me Button (User Request: Assign & Reassign Options for Disputes) */}
                    {!isAssignedToMe && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAssignToMe(order);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        title="Take ownership of this delivery dispute and route to your personal bucket"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Assign to Me</span>
                      </button>
                    )}

                    {/* Reassign Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReassigningOrder(order);
                        setTargetStaffId(order.assignedStaffId || 'admin');
                        setReassignmentNote('');
                      }}
                      className="px-3 py-2 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 font-semibold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      title="Reassign this dispute to another staff member or admin"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-neutral-600" />
                      <span>{order.assignedStaffId ? 'Reassign Case' : 'Assign Case'}</span>
                    </button>

                    {/* Investigation Update / Reopen Button (User Request: Investigation Comments instead of re-prompting) */}
                    {order.isClosed ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReopeningOrder(order);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        title="Reopen order to active queue so staff can investigate with courier"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-neutral-950" />
                        <span>Reopen Disputed Order</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInvestigatingOrder(order);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        title="Add investigation progress comment without re-prompting for reopen explanation"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-neutral-950" />
                        <span>Update Dispute Investigation</span>
                      </button>
                    )}

                    {/* Mark Resolved Button */}
                    {issueStatus !== 'resolved' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setResolvingOrder(order);
                          setResolutionNotes('');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        title="Mark delivery dispute resolved with dedicated resolution timestamp"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Dispute Resolved</span>
                      </button>
                    )}

                    {/* Final Order Closure Button (User Request 1: Close Order button once refund or dispute is completed) */}
                    {!order.isClosed && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await closeOrder(order.id, currentUserName);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        title="Officially close this order now that refund or dispute resolution is complete"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Close Order</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Live Customer Chat Stream (User Request 3) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setChatModalOrder(order);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      title="Chat in real-time with customer regarding this dispute"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-white" />
                      <span>
                        Live Chat
                        {order.chatMessages && order.chatMessages.length > 0 ? ` (${order.chatMessages.length})` : ''}
                      </span>
                      {order.chatMessages?.some((m) => !m.readByStaff && m.sender === 'customer') && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
                      )}
                    </button>

                    {/* Customer WhatsApp Coordination (User Request 1: Chat directly with users regarding refund updates) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const cleanPhone = order.customer.phone.replace(/[^0-9]/g, '');
                        const isRefund = isRefundCase(order);
                        const text = isRefund
                          ? `Namaste ${order.customer.name}! 🪔✨\n\nRegarding your refund inquiry for order #${order.orderNumber} (Amount: ${formatPrice(order.totalAmount)}).\n• Refund Status: *${order.refundDetails?.refundStatus === 'processed' ? 'Processed' : 'In Queue'}*${order.refundDetails?.refundUtr ? `\n• Bank Transaction UTR ID: *${order.refundDetails.refundUtr}*` : ''}${order.refundDetails?.refundUpiId ? `\n• Credited to UPI: *${order.refundDetails.refundUpiId}*` : ''}\n\nOur concierge finance team has verified your case. Please let us know if you need any additional assistance.\n\nWarm regards,\n${settings.boutiqueName}`
                          : `Namaste ${order.customer.name}! 🪔✨\n\nRegarding your delivery query for order #${order.orderNumber} (${order.shippingDetails?.courierName || 'Courier'}, Tracking: ${order.shippingDetails?.trackingNumber || 'Pending'}).\n\nOur concierge team is actively investigating with the local courier dispatch office to verify handover and ensure you receive your authentic handloom saree.\n\nWarm regards,\n${settings.boutiqueName}`;
                        openWhatsApp(cleanPhone, text);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      title="Send instant update to customer via WhatsApp"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isRefundCase(order) ? 'Chat Refund with Customer' : 'WhatsApp Customer'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Investigation Update Modal (No Reopen Prompting!) */}
      {investigatingOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif text-base font-bold">
                  Update Dispute Investigation · #{investigatingOrder.orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInvestigatingOrder(null)}
                className="text-neutral-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveInvestigationComment} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-950 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                  <span>Logging as: {currentUserName}</span>
                </p>
                <p className="text-[11px] leading-relaxed text-amber-900">
                  Save your latest progress note, courier hub response, or handover details. This comment will be timestamped into the case thread so teammates can seamlessly continue the investigation.
                </p>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1.5">
                  Latest Investigation Finding / Courier Progress Update *
                </label>
                <textarea
                  required
                  rows={4}
                  value={investigationNote}
                  onChange={(e) => setInvestigationNote(e.target.value)}
                  placeholder="e.g. Spoke with DTDC Salem hub supervisor Ramesh. Consignment reached destination branch today morning; driver is out for delivery with physical proof handover scheduled by 4:30 PM..."
                  className="w-full p-3 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInvestigatingOrder(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Save Investigation Update</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Reassign Case Modal (Dynamic Routing) */}
      {reassigningOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif text-base font-bold">
                  Assign / Reassign Dispute #{reassigningOrder.orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReassigningOrder(null)}
                className="text-neutral-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmReassign} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-blue-950 space-y-1">
                <p className="font-bold">Dynamic Bucket Routing</p>
                <p className="text-[11px] leading-relaxed text-blue-900">
                  Assigning or reassigning this dispute routes it directly into the selected staff member's personal bucket/view.
                </p>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1.5">
                  Select Staff Member / Owner *
                </label>
                <select
                  value={targetStaffId}
                  onChange={(e) => setTargetStaffId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                >
                  <option value="admin">Store Owner / Admin</option>
                  {staffMembers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (@{s.username}) · {s.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1.5">
                  Handover / Assignment Reason
                </label>
                <textarea
                  rows={2}
                  value={reassignmentNote}
                  onChange={(e) => setReassignmentNote(e.target.value)}
                  placeholder="e.g. Handing over to local dispatch specialist for branch office coordination..."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReassigningOrder(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-amber-300 font-bold transition shadow-xs cursor-pointer"
                >
                  Confirm & Route to Bucket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Reopen Closed Order Modal (Only when order.isClosed === true) */}
      {reopeningOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif text-base font-bold">
                  Reopen Order #{reopeningOrder.orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReopeningOrder(null)}
                className="text-neutral-400 hover:text-white"
              >
                &times;
              </button>
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
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold transition shadow-xs cursor-pointer"
                >
                  Reopen Order Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Resolve Dispute Modal (With Timestamp Resolution Tracking) */}
      {resolvingOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-serif text-base font-bold">
                  Resolve Dispute for Order #{resolvingOrder.orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResolvingOrder(null)}
                className="text-neutral-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmResolve} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-950 space-y-1">
                <p className="font-bold">Official Resolution Timestamp</p>
                <p className="text-[11px] leading-relaxed text-emerald-900">
                  Submitting will mark this dispute officially resolved with an exact audit timestamp, resolving staff credit, and resolution notes.
                </p>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Resolution Notes / Summary *
                </label>
                <textarea
                  required
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g. Courier hub re-attempted delivery; package physically handed over and customer confirmed receipt..."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResolvingOrder(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-xs cursor-pointer"
                >
                  Confirm Official Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Live Customer Chat Stream (User Request 3) */}
      {chatModalOrder && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto">
            <div className="p-4 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white">
                    Live Customer Dispute Chat · #{chatModalOrder.orderNumber}
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Customer: {chatModalOrder.customer.name} ({chatModalOrder.customer.phone})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setChatModalOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <OrderLiveChat
                order={orders.find((o) => o.id === chatModalOrder.id) || chatModalOrder}
                mode="admin"
                title={`Dispute Case #${chatModalOrder.orderNumber} Live Support`}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL 0: Complete Disputed Order Details, Investigation Log & Resolution Panel (Requirement: Clickable Orders on Customer Issue Page) */}
      {selectedDisputeDetailOrder && (() => {
        const currentOrder =
          orders.find((o) => o.id === selectedDisputeDetailOrder.id) || selectedDisputeDetailOrder;
        const courier = getCourierDetails(currentOrder.shippingDetails?.courierName);
        const issueStatus = currentOrder.deliveryIssue?.status || (currentOrder.isClosed ? 'resolved' : 'open');
        const commentsList = currentOrder.deliveryIssue?.investigationComments || [];
        const isAssignedToMe = currentOrder.assignedStaffId === currentUserId;
        const isUnassigned = !currentOrder.assignedStaffId || currentOrder.assignedStaffId === 'unassigned';
        const isRefund = isRefundCase(currentOrder);

        const handleModalAddComment = async (e: React.FormEvent) => {
          e.preventDefault();
          if (!modalQuickComment.trim()) return;
          await addInvestigationComment(
            currentOrder.id,
            modalQuickComment.trim(),
            currentUserName,
            'investigating'
          );
          setModalQuickComment('');
        };

        const handleModalResolve = async (e: React.FormEvent) => {
          e.preventDefault();
          await resolveDeliveryIssue(
            currentOrder.id,
            modalQuickResolutionNotes.trim() || 'Dispute resolved with customer and courier partner.',
            'resolve'
          );
          setModalQuickResolutionNotes('');
          setIsModalResolvingOpen(false);
        };

        const handleModalReassign = (e: React.FormEvent) => {
          e.preventDefault();
          const chosenStaff =
            modalTargetStaffId === 'admin'
              ? { id: 'admin', name: 'Store Owner' }
              : staffMembers.find((s) => s.id === modalTargetStaffId) || {
                  id: modalTargetStaffId,
                  name: 'Staff Concierge',
                };
          const reason =
            modalReassignNote.trim() ||
            `Reassigned dispute investigation to ${chosenStaff.name}`;
          assignOrderStaff(currentOrder.id, chosenStaff.id, chosenStaff.name, reason);
          setIsModalReassigningOpen(false);
          setModalReassignNote('');
        };

        return (
          <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 my-auto flex flex-col max-h-[92vh]">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-neutral-950 via-neutral-900 to-rose-950 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-serif text-base sm:text-lg font-bold text-white">
                        Disputed Order #{currentOrder.orderNumber}
                      </h3>
                      <span className="font-mono text-xs font-bold text-rose-300 bg-rose-950/80 border border-rose-500/40 px-2 py-0.5 rounded">
                        {isRefund ? 'Refund Case' : 'Delivery Dispute'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          issueStatus === 'open'
                            ? 'bg-rose-500 text-white'
                            : issueStatus === 'investigating'
                            ? 'bg-amber-500 text-neutral-950'
                            : 'bg-emerald-500 text-white'
                        }`}
                      >
                        Status: {issueStatus}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Customer: {currentOrder.customer.name} ({currentOrder.customer.phone}) · Placed: {new Date(currentOrder.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDisputeDetailOrder(null)}
                  className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body - 3 Core Sections */}
              <div className="p-5 sm:p-6 space-y-6 overflow-y-auto text-xs text-neutral-700 flex-1">
                {/* 1. Handling Bucket & Quick Status Bar */}
                <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-neutral-600">Handling Bucket:</span>
                    <span
                      className={`font-bold px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 ${
                        isUnassigned
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : isAssignedToMe
                          ? 'bg-blue-100 text-blue-900 border-blue-300'
                          : 'bg-white text-neutral-900 border-neutral-200'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>
                        {isUnassigned
                          ? 'Unassigned Dispute (Needs Owner)'
                          : isAssignedToMe
                          ? `Assigned to You (${currentUserName})`
                          : `Owner: ${currentOrder.assignedStaffName || 'Staff Specialist'}`}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500 font-medium">Order Status:</span>
                    <span className="font-bold text-neutral-900 bg-white px-2.5 py-1 rounded-lg border border-neutral-200">
                      {currentOrder.status}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        currentOrder.isClosed
                          ? 'bg-neutral-200 text-neutral-700'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {currentOrder.isClosed ? 'Closed' : 'Active'}
                    </span>
                  </div>
                </div>

                {/* 2. Customer Dispute Statement Callout */}
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-rose-900">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Customer Grievance / Non-Delivery Statement</span>
                  </div>
                  <p className="text-xs font-medium text-rose-950 leading-relaxed bg-white/80 p-3 rounded-xl border border-rose-200/60 font-sans">
                    "{currentOrder.deliveryIssue?.issueDescription ||
                      currentOrder.cancellationReason ||
                      'Customer dispute logged for boutique concierge investigation.'}"
                  </p>
                  {currentOrder.deliveryIssue?.resolutionNotes && (
                    <div className="text-[11px] text-emerald-950 bg-emerald-50 p-2.5 rounded-xl border border-emerald-300">
                      <strong>Recorded Resolution:</strong> {currentOrder.deliveryIssue.resolutionNotes}
                    </div>
                  )}
                </div>

                {/* 3. Customer Profile & Delivery Address Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                      Customer Profile & Contact
                    </span>
                    <p className="font-bold text-neutral-900 text-sm">{currentOrder.customer.name}</p>
                    <p className="flex items-center gap-1.5 font-mono text-neutral-800">
                      <Phone className="w-3.5 h-3.5 text-neutral-400" />
                      <a href={`tel:${currentOrder.customer.phone}`} className="hover:text-amber-800 font-semibold underline">
                        {currentOrder.customer.phone}
                      </a>
                    </p>
                    {currentOrder.customer.email && (
                      <p className="flex items-center gap-1.5 text-neutral-600">
                        <Mail className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{currentOrder.customer.email}</span>
                      </p>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                      Delivery Destination Address
                    </span>
                    <p className="flex items-start gap-1.5 text-neutral-800 leading-relaxed font-medium">
                      <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                      <span>
                        {currentOrder.customer.address}, {currentOrder.customer.city},{' '}
                        {currentOrder.customer.state} - {currentOrder.customer.pincode}
                      </span>
                    </p>
                  </div>
                </div>

                {/* 4. Ordered Items & Financials */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      Ordered Sarees ({currentOrder.items.length})
                    </span>
                    <span className="text-xs font-bold text-neutral-900">
                      Total Order Value: {formatPrice(currentOrder.totalAmount)}
                    </span>
                  </div>

                  <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 overflow-hidden bg-white">
                    {currentOrder.items.map((item, idx) => (
                      <div key={idx} className="p-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={item.product.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                            alt={item.product.title}
                            className="w-12 h-14 rounded-xl object-cover border border-neutral-200 shrink-0 bg-neutral-100"
                          />
                          <div className="min-w-0">
                            <p className="font-serif font-bold text-neutral-900 text-xs sm:text-sm truncate">
                              {item.product.title}
                            </p>
                            <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
                              SKU: {item.product.productCode} · Qty: {item.quantity} · {item.product.fabric || 'Pure Silk'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-serif font-bold text-sm text-neutral-900">
                            {formatPrice(item.product.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Financials & Payment UTR Box */}
                  <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-neutral-500 font-medium block">Subtotal:</span>
                      <span className="font-semibold text-neutral-900">{formatPrice(currentOrder.subtotal)}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 font-medium block">Shipping:</span>
                      <span className="font-semibold text-neutral-900">
                        {currentOrder.shippingFee === 0 ? 'FREE' : formatPrice(currentOrder.shippingFee)}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 font-medium block">Total Paid:</span>
                      <span className="font-bold text-neutral-950 font-serif">{formatPrice(currentOrder.totalAmount)}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 font-medium block">Prepaid UTR:</span>
                      <span className="font-mono font-bold text-neutral-900 bg-white px-2 py-0.5 rounded border border-amber-200 truncate inline-block max-w-full">
                        {currentOrder.upiTransactionId || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. Courier Logistics or Refund Record */}
                {courier && currentOrder.shippingDetails?.trackingNumber && (
                  <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2 text-xs text-blue-950">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-blue-950">
                        <Truck className="w-4 h-4 text-blue-700" />
                        <span>Dispatch & Courier Logistics · {courier.name}</span>
                      </div>
                      <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-blue-300 text-blue-900">
                        Tracking: {currentOrder.shippingDetails.trackingNumber}
                      </span>
                    </div>
                    <p className="text-blue-900">
                      Branch Office: {courier.addressLine1}, {courier.city} - {courier.pincode} · Phone: {courier.phone}
                    </p>
                    {courier.mapsUrl && (
                      <a
                        href={courier.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-950 font-bold underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>View {courier.name} Hub on Google Maps</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Refund Record if applicable */}
                {currentOrder.refundDetails && (
                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 text-xs text-amber-950 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900">
                        <RotateCcw className="w-4 h-4 text-amber-700" />
                        <span>Refund Transaction Record</span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        currentOrder.refundDetails.refundStatus === 'processed'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-amber-200 text-amber-950'
                      }`}>
                        {currentOrder.refundDetails.refundStatus === 'processed' ? 'Refund Completed' : 'Pending Settlement'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white/90 p-3 rounded-xl border border-amber-200">
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Refund UPI:</span>
                        <span className="font-mono font-bold text-neutral-900">{currentOrder.refundDetails.refundUpiId || currentOrder.customer.phone}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Bank Refund UTR:</span>
                        <span className="font-mono font-bold text-emerald-800">{currentOrder.refundDetails.refundUtr || 'Pending UTR'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Processed At:</span>
                        <span className="text-neutral-800 font-medium">{currentOrder.refundDetails.processedAt ? new Date(currentOrder.refundDetails.processedAt).toLocaleString('en-IN') : 'In Queue'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Complete Investigation Log Thread */}
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-amber-600" />
                      <h4 className="font-bold text-xs text-neutral-900 uppercase tracking-wider">
                        Investigation Updates & Log Thread ({commentsList.length})
                      </h4>
                    </div>
                  </div>

                  {commentsList.length === 0 ? (
                    <p className="text-xs text-neutral-400 italic bg-white p-3 rounded-xl border border-neutral-200">
                      No investigation notes logged yet. Log your findings or courier dispatch updates below.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {commentsList.map((comm) => (
                        <div
                          key={comm.id}
                          className="p-3 rounded-xl bg-white border border-neutral-200 text-xs space-y-1 shadow-2xs"
                        >
                          <div className="flex items-center justify-between text-[11px] text-neutral-500">
                            <span className="font-bold text-neutral-900 flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                              <span>{comm.author}</span>
                            </span>
                            <span>{new Date(comm.timestamp).toLocaleString('en-IN')}</span>
                          </div>
                          <p className="text-neutral-800 leading-relaxed font-medium">{comm.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inline Add Investigation Comment */}
                  <form onSubmit={handleModalAddComment} className="pt-2 flex gap-2">
                    <input
                      type="text"
                      value={modalQuickComment}
                      onChange={(e) => setModalQuickComment(e.target.value)}
                      placeholder="Add an investigation note, courier branch response, or update..."
                      className="flex-1 p-2.5 rounded-xl border border-neutral-300 bg-white text-xs text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                    />
                    <button
                      type="submit"
                      disabled={!modalQuickComment.trim()}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Log Note</span>
                    </button>
                  </form>
                </div>

                {/* 7. Dedicated Resolution Action Panel */}
                <div className="p-5 rounded-2xl bg-neutral-900 text-white space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <div>
                        <h4 className="font-serif font-bold text-sm text-white">
                          Dispute Resolution & Concierge Panel
                        </h4>
                        <p className="text-[11px] text-neutral-400">
                          Resolve claims, reassign ownership, or coordinate directly with the patron
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* WhatsApp Button */}
                      <button
                        type="button"
                        onClick={() => {
                          const cleanPhone = currentOrder.customer.phone.replace(/[^0-9]/g, '');
                          const text = isRefund
                            ? `Namaste ${currentOrder.customer.name}! 🪔✨\n\nRegarding your refund inquiry for order #${currentOrder.orderNumber} (Amount: ${formatPrice(currentOrder.totalAmount)}).\n• Refund Status: *${currentOrder.refundDetails?.refundStatus === 'processed' ? 'Processed' : 'In Queue'}*${currentOrder.refundDetails?.refundUtr ? `\n• Bank Transaction UTR ID: *${currentOrder.refundDetails.refundUtr}*` : ''}\n\nOur concierge finance team has verified your case. Please let us know if you need any additional assistance.\n\nWarm regards,\n${settings.boutiqueName}`
                            : `Namaste ${currentOrder.customer.name}! 🪔✨\n\nRegarding your delivery query for order #${currentOrder.orderNumber} (${currentOrder.shippingDetails?.courierName || 'Courier'}).\n\nOur concierge team is actively investigating with the local courier dispatch office to verify handover and ensure you receive your authentic handloom saree.\n\nWarm regards,\n${settings.boutiqueName}`;
                          openWhatsApp(cleanPhone, text);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp Customer</span>
                      </button>

                      {/* Live Customer Chat */}
                      <button
                        type="button"
                        onClick={() => setChatModalOrder(currentOrder)}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Live Chat</span>
                      </button>
                    </div>
                  </div>

                  {/* Resolution Input / Reopen / Close Actions */}
                  <div className="pt-2 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {issueStatus !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => setIsModalResolvingOpen(!isModalResolvingOpen)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark Dispute Resolved...</span>
                        </button>
                      )}

                      {currentOrder.isClosed ? (
                        <button
                          type="button"
                          onClick={() => setReopeningOrder(currentOrder)}
                          className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reopen Disputed Order</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            await closeOrder(currentOrder.id, currentUserName);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer border border-neutral-700"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Close Order</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsModalReassigningOpen(!isModalReassigningOpen)}
                        className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs transition flex items-center gap-1.5 border border-neutral-700 cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{currentOrder.assignedStaffId ? 'Reassign Case' : 'Assign Case'}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const summary = `Dispute Order #${currentOrder.orderNumber} - ${currentOrder.customer.name} (${currentOrder.customer.phone}) - Amount: ${formatPrice(currentOrder.totalAmount)} - Status: ${issueStatus}`;
                        copyToClipboard(summary, `modal-copy-${currentOrder.id}`);
                      }}
                      className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer border border-neutral-700"
                    >
                      {copiedKey === `modal-copy-${currentOrder.id}` ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Copy Case Summary</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Resolution Notes Expanded Form */}
                  {isModalResolvingOpen && (
                    <form onSubmit={handleModalResolve} className="p-3.5 bg-neutral-800 rounded-2xl border border-neutral-700 space-y-2.5 animate-in fade-in">
                      <label className="block text-xs font-bold text-emerald-300">
                        Official Resolution Notes & Courier Confirmation *
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={modalQuickResolutionNotes}
                        onChange={(e) => setModalQuickResolutionNotes(e.target.value)}
                        placeholder="e.g. Courier hub re-attempted delivery; package physically handed over and patron confirmed receipt."
                        className="w-full p-2.5 rounded-xl bg-neutral-900 border border-neutral-600 text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsModalResolvingOpen(false)}
                          className="px-3 py-1.5 rounded-xl border border-neutral-600 text-neutral-300 text-xs hover:bg-neutral-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                        >
                          Confirm Official Resolution
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Reassign Case Expanded Form */}
                  {isModalReassigningOpen && (
                    <form onSubmit={handleModalReassign} className="p-3.5 bg-neutral-800 rounded-2xl border border-neutral-700 space-y-2.5 animate-in fade-in">
                      <label className="block text-xs font-bold text-amber-300">
                        Reassign Dispute to Staff / Owner Bucket *
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={modalTargetStaffId}
                          onChange={(e) => setModalTargetStaffId(e.target.value)}
                          className="w-full p-2 rounded-xl bg-neutral-900 border border-neutral-600 text-white text-xs"
                        >
                          <option value="admin">Store Owner / Admin</option>
                          {staffMembers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} (@{s.username}) · {s.role}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={modalReassignNote}
                          onChange={(e) => setModalReassignNote(e.target.value)}
                          placeholder="Handover note (optional)"
                          className="w-full p-2 rounded-xl bg-neutral-900 border border-neutral-600 text-white text-xs"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsModalReassigningOpen(false)}
                          className="px-3 py-1.5 rounded-xl border border-neutral-600 text-neutral-300 text-xs hover:bg-neutral-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs cursor-pointer"
                        >
                          Confirm & Route to Bucket
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedDisputeDetailOrder(null)}
                  className="px-5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
