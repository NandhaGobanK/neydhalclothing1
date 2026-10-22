import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, CourierService } from '../../types/store';
import { formatPrice, openWhatsApp } from '../../utils/upi';
import {
  AlertCircle,
  Truck,
  RotateCcw,
  CheckCircle2,
  Clock,
  Search,
  MessageSquare,
  Copy,
  Check,
  User,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Layers,
  ExternalLink,
  Ban,
  MapPin,
  X,
  Phone,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { OrderLiveChat } from '../common/OrderLiveChat';
import { buildCourierTrackingUrl, buildCourierMapsUrl } from '../../utils/courier';

interface CustomerIssuesManagerProps {
  onNavigateToTab?: (tab: string, param?: string) => void;
}

export type DisputeCategory = 'all' | 'cancellation' | 'delivery' | 'refund';
export type DisputeBucket = 'unassigned' | 'mine' | 'staff' | 'closed' | 'all';

export const CustomerIssuesManager: React.FC<CustomerIssuesManagerProps> = ({
  onNavigateToTab,
}) => {
  const {
    orders,
    settings,
    resolveDeliveryIssue,
    currentUser,
    staffMembers,
    assignOrderStaff,
    addInvestigationComment,
    resolveCancellationRequest,
    replenishOrderInventory,
  } = useStore();

  const isAdmin = currentUser?.type === 'admin';
  const currentUserId = currentUser?.staffId || (isAdmin ? 'admin' : '');
  const currentUserName = currentUser?.name || (isAdmin ? 'Store Owner' : 'Staff Concierge');

  // Default landing view: ⚠️ Unassigned Queue
  const [activeBucket, setActiveBucket] = useState<DisputeBucket>('unassigned');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<DisputeCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals state
  const [chatModalOrder, setChatModalOrder] = useState<Order | null>(null);
  const [reassigningOrder, setReassigningOrder] = useState<Order | null>(null);
  const [targetStaffId, setTargetStaffId] = useState<string>('admin');
  const [reassignmentNote, setReassignmentNote] = useState('');

  // Cancellation Approval & Decline Modals
  const [cancellationApproveOrder, setCancellationApproveOrder] = useState<Order | null>(null);
  const [cancellationApproveUtr, setCancellationApproveUtr] = useState('');
  const [cancellationApproveTool, setCancellationApproveTool] = useState('UPI Banking');
  const [cancellationApproveNotes, setCancellationApproveNotes] = useState('');
  const [cancellationDeclineOrder, setCancellationDeclineOrder] = useState<Order | null>(null);
  const [cancellationDeclineReason, setCancellationDeclineReason] = useState(
    'Saree has already been packed and handed over to courier dispatch'
  );

  // Quick Dispute Resolution Modal
  const [resolvingOrder, setResolvingOrder] = useState<Order | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Dynamic routing toast
  const [routingToast, setRoutingToast] = useState<{
    orderNumber: string;
    staffName: string;
    staffId: string;
  } | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 1. Defined Customer Dispute Types:
  // - Refund Report Issue: Raised if order is marked as cancelled/refunded but funds not received, or explicit issueType === 'refund'
  // - Order Cancellation Request: Raised by customer after placing an order (pending review or cancellation dispute)
  // - Delivery Dispute Issue: Raised if order is marked as Delivered/Shipped but customer hasn't received it

  const isRefundCase = (o: Order): boolean => {
    // If explicitly reported as a refund issue, it is ALWAYS a refund case!
    if (o.deliveryIssue?.reported === true && o.deliveryIssue?.issueType === 'refund') return true;

    const desc = (o.deliveryIssue?.issueDescription || '').toLowerCase();
    if (
      desc.includes('refund inquiry') ||
      desc.includes('refund report') ||
      desc.includes('refund dispute') ||
      desc.includes('settlement inquiry') ||
      desc.includes('funds not received') ||
      desc.includes('refund not received')
    ) {
      return true;
    }

    // Customer reported an issue on an already Cancelled or Refunded order (and not a pending cancellation request)
    if (
      o.deliveryIssue?.reported === true &&
      (o.status === 'Refunded' || o.status === 'Cancelled' || o.status === 'Rejected' || o.refundDetails?.refundStatus === 'processed') &&
      o.cancellationRequest?.status !== 'pending' &&
      o.deliveryIssue?.issueType !== 'delivery'
    ) {
      return true;
    }

    return false;
  };

  const isCancellationCase = (o: Order): boolean => {
    // A refund dispute is NEVER a cancellation case
    if (isRefundCase(o)) return false;

    // Active cancellation request pending review
    if (o.cancellationRequest?.requested === true && o.cancellationRequest.status === 'pending') return true;
    if (o.deliveryIssue?.issueType === 'cancellation') return true;

    const desc = (o.deliveryIssue?.issueDescription || '').toLowerCase();
    if (desc.includes('cancellation request') || desc.includes('order cancellation')) return true;

    // Historical cancellation request if no other dispute reported
    if (o.cancellationRequest?.requested === true && !o.deliveryIssue?.reported) return true;

    return false;
  };

  const isDeliveryCase = (o: Order): boolean => {
    if (isRefundCase(o)) return false;
    if (isCancellationCase(o)) return false;
    return Boolean(o.deliveryIssue?.reported === true);
  };

  const isDisputeActive = (o: Order): boolean => {
    // 1. If customer reported a delivery dispute or refund inquiry and it is NOT yet marked resolved, it is ACTIVE
    if (
      o.deliveryIssue?.reported === true &&
      o.deliveryIssue.status !== 'resolved'
    ) {
      return true;
    }

    // 2. If there is a pending cancellation request, it is ACTIVE
    if (
      o.cancellationRequest?.requested === true &&
      o.cancellationRequest.status === 'pending'
    ) {
      return true;
    }

    return false;
  };

  const isDisputeClosedOrResolved = (o: Order): boolean => {
    // If a dispute was reported and is currently active, it is NEVER closed!
    if (isDisputeActive(o)) return false;

    if (o.isClosed) return true;
    if (o.deliveryIssue?.status === 'resolved') return true;
    if (
      o.cancellationRequest?.requested &&
      (o.cancellationRequest.status === 'approved' || o.cancellationRequest.status === 'rejected')
    ) {
      return true;
    }

    return false;
  };

  // All orders that qualify as customer disputes (across the 3 types)
  const allDisputedOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.deliveryIssue?.reported === true ||
        (o.cancellationRequest?.requested === true && o.cancellationRequest.status === 'pending') ||
        isRefundCase(o) ||
        isCancellationCase(o) ||
        isDeliveryCase(o)
    );
  }, [orders]);

  // Active disputes (not closed or resolved)
  const activeDisputes = useMemo(() => {
    return allDisputedOrders.filter((o) => !isDisputeClosedOrResolved(o));
  }, [allDisputedOrders]);

  // Closed & resolved disputes
  const closedDisputes = useMemo(() => {
    return allDisputedOrders.filter((o) => isDisputeClosedOrResolved(o));
  }, [allDisputedOrders]);

  // Unassigned Queue (Active disputes where no staff is assigned or assignedStaffId is 'unassigned')
  const unassignedDisputes = useMemo(() => {
    return activeDisputes.filter(
      (o) => !o.assignedStaffId || o.assignedStaffId === 'unassigned'
    );
  }, [activeDisputes]);

  // My Assigned Disputes (Active disputes assigned to logged in staff or Store Owner)
  const myAssignedDisputes = useMemo(() => {
    return activeDisputes.filter((o) => o.assignedStaffId === currentUserId);
  }, [activeDisputes, currentUserId]);

  // Other Staff Disputes
  const otherStaffDisputes = useMemo(() => {
    return activeDisputes.filter(
      (o) =>
        o.assignedStaffId &&
        o.assignedStaffId !== 'unassigned' &&
        o.assignedStaffId !== currentUserId
    );
  }, [activeDisputes, currentUserId]);

  // Counts for Top-Level Metrics
  const totalUnassignedCount = unassignedDisputes.length;
  const totalMyDisputesCount = myAssignedDisputes.length;
  const totalOtherStaffCount = otherStaffDisputes.length;
  const totalClosedCount = closedDisputes.length;
  const totalActiveCount = activeDisputes.length;

  const cancellationCount = activeDisputes.filter(isCancellationCase).length;
  const deliveryCount = activeDisputes.filter(isDeliveryCase).length;
  const refundCount = activeDisputes.filter(isRefundCase).length;

  // Filtered disputes based on Active Bucket, Staff Filter, Category, and Search
  const filteredDisputes = useMemo(() => {
    // 1. Base list according to bucket
    let list: Order[] = [];
    if (activeBucket === 'unassigned') {
      list = unassignedDisputes;
    } else if (activeBucket === 'mine') {
      list = myAssignedDisputes;
    } else if (activeBucket === 'staff') {
      if (selectedStaffFilter === 'all') {
        list = otherStaffDisputes;
      } else {
        list = activeDisputes.filter((o) => o.assignedStaffId === selectedStaffFilter);
      }
    } else if (activeBucket === 'closed') {
      if (selectedStaffFilter === 'all') {
        list = closedDisputes;
      } else {
        list = closedDisputes.filter((o) => o.assignedStaffId === selectedStaffFilter);
      }
    } else {
      list = activeDisputes;
    }

    // 2. Category filter
    if (categoryFilter === 'cancellation') {
      list = list.filter(isCancellationCase);
    } else if (categoryFilter === 'delivery') {
      list = list.filter(isDeliveryCase);
    } else if (categoryFilter === 'refund') {
      list = list.filter(isRefundCase);
    }

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const cleanNum = q.replace(/^[#\s]+/, '');
      list = list.filter((order) => {
        const orderNum = order.orderNumber.toLowerCase().replace(/^[#\s]+/, '');
        return (
          orderNum.includes(cleanNum) ||
          order.orderNumber.toLowerCase().includes(q) ||
          order.customer.name.toLowerCase().includes(q) ||
          order.customer.phone.includes(q) ||
          (order.assignedStaffName || '').toLowerCase().includes(q) ||
          (order.shippingDetails?.courierName || '').toLowerCase().includes(q) ||
          (order.shippingDetails?.trackingNumber || '').toLowerCase().includes(cleanNum) ||
          (order.upiTransactionId || '').toLowerCase().includes(cleanNum) ||
          (order.refundDetails?.refundUtr || '').toLowerCase().includes(cleanNum) ||
          (order.refundDetails?.refundUpiId || '').toLowerCase().includes(q) ||
          (order.deliveryIssue?.issueDescription || '').toLowerCase().includes(q) ||
          (order.cancellationReason || '').toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [
    activeBucket,
    selectedStaffFilter,
    categoryFilter,
    searchQuery,
    unassignedDisputes,
    myAssignedDisputes,
    otherStaffDisputes,
    closedDisputes,
    activeDisputes,
  ]);

  const getCourierDetails = (courierName?: string): CourierService | undefined => {
    if (!courierName) return undefined;
    return (settings.courierServices || []).find(
      (c) => c.name.toLowerCase().trim() === courierName.toLowerCase().trim()
    );
  };

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

  // 1-Click Claim Action
  const handleAssignToMe = (order: Order) => {
    assignOrderStaff(
      order.id,
      currentUserId,
      currentUserName,
      `Claimed dispute case from Unassigned Queue into personal handling bucket`
    );

    setRoutingToast({
      orderNumber: order.orderNumber,
      staffName: currentUserName,
      staffId: currentUserId,
    });
    setTimeout(() => setRoutingToast(null), 5000);
  };

  // Reassign / Assign Modal Submit
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

  // Approve Cancellation with Auto-Restock
  const handleConfirmCancellationApproval = (order: Order) => {
    const utr = cancellationApproveUtr.trim() || `UTR${Date.now().toString().slice(-8)}`;
    const notes =
      cancellationApproveNotes.trim() ||
      'Cancellation approved by concierge. Saree auto-restocked to inventory.';
    resolveCancellationRequest(order.id, 'approve', notes, utr);
    if (!order.isRestocked) {
      replenishOrderInventory(order);
    }
    setCancellationApproveOrder(null);
    setCancellationApproveUtr('');
    setCancellationApproveNotes('');
  };

  // Decline Cancellation Request
  const handleConfirmCancellationDecline = (order: Order) => {
    const reason = cancellationDeclineReason.trim() || 'Cancellation request declined by concierge.';
    resolveCancellationRequest(order.id, 'reject', reason);
    setCancellationDeclineOrder(null);
  };

  // Formally Resolve Dispute
  const handleConfirmResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingOrder) return;

    await resolveDeliveryIssue(
      resolvingOrder.id,
      resolutionNotes.trim() || 'Dispute resolved with customer and logistics verification.',
      'resolve'
    );
    setResolvingOrder(null);
    setResolutionNotes('');
  };

  const handleOpenOnOrderPage = (orderId: string) => {
    if (onNavigateToTab) {
      onNavigateToTab('orders', orderId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-600" />
            <span>Customer Issue & Dispute Redressal</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 font-sans font-semibold border border-rose-300">
              {totalActiveCount} Active
            </span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Unified management for Cancellation Requests, Delivery Disputes, and Refund Reports. All disputes land in the Unassigned Queue, move to staff buckets upon assignment, and transition to Closed upon resolution.
          </p>
        </div>

        {/* Status Counters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>{totalUnassignedCount} Unassigned Queue</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold">
            {totalMyDisputesCount} in My Bucket
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
            {totalClosedCount} Resolved & Closed
          </div>
        </div>
      </div>

      {/* Unassigned Queue Alert Banner (If there are unassigned issues) */}
      {totalUnassignedCount > 0 && activeBucket !== 'unassigned' && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-700 to-amber-700 text-white shadow-md border border-rose-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white text-rose-700 shrink-0 shadow-xs">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                <span>⚠️ {totalUnassignedCount} Unassigned Dispute{totalUnassignedCount === 1 ? '' : 's'} Pending Intake</span>
              </h4>
              <p className="text-xs text-rose-100 font-medium mt-0.5">
                Newly raised customer disputes are waiting in the Unassigned Queue. Claim or assign them to start investigation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveBucket('unassigned');
              setCategoryFilter('all');
            }}
            className="px-3.5 py-1.5 rounded-xl bg-white text-rose-950 text-xs font-bold hover:bg-neutral-100 transition shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
          >
            Go to Unassigned Queue &rarr;
          </button>
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
                This dispute has moved directly into <strong>{routingToast.staffName}</strong>'s personal Customer Issue bucket.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (routingToast.staffId === currentUserId) {
                  setActiveBucket('mine');
                } else {
                  setActiveBucket('staff');
                  setSelectedStaffFilter(routingToast.staffId);
                }
                setRoutingToast(null);
              }}
              className="px-3 py-1.5 rounded-xl bg-white text-neutral-950 font-bold hover:bg-neutral-100 transition shadow-xs cursor-pointer"
            >
              Open in Bucket &rarr;
            </button>
            <button
              type="button"
              onClick={() => setRoutingToast(null)}
              className="text-white/80 hover:text-white font-bold p-1 cursor-pointer"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Unified Queue Navigation & Filter Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-neutral-200 shadow-2xs space-y-3">
        {/* Row 1: Unified Bucket Movement Lifecycle Tabs */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-neutral-100 pb-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mr-1">
              Bucket Queue:
            </span>
            {[
              {
                id: 'unassigned',
                label: `⚠️ Unassigned Queue (${totalUnassignedCount})`,
                highlight: totalUnassignedCount > 0,
              },
              {
                id: 'mine',
                label: `👤 My Bucket (${totalMyDisputesCount})`,
              },
              {
                id: 'staff',
                label: `👥 Staff Buckets (${totalOtherStaffCount})`,
              },
              {
                id: 'closed',
                label: `📁 Closed Bucket (${totalClosedCount})`,
              },
              {
                id: 'all',
                label: `🌐 All Active (${totalActiveCount})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveBucket(tab.id as DisputeBucket)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                  activeBucket === tab.id
                    ? 'bg-neutral-950 text-white shadow-xs'
                    : tab.highlight
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold hover:bg-amber-200'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Search Bar with Instant Matching */}
          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Order #, Customer, Phone, Courier, UTR..."
              className="w-full pl-8 pr-8 py-2 rounded-xl border border-neutral-200 bg-neutral-50 text-xs text-neutral-900 focus:outline-hidden focus:bg-white focus:border-neutral-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Specific Staff Filter (When viewing Staff Buckets or Closed Bucket) */}
        {(activeBucket === 'staff' || activeBucket === 'closed') && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-0.5 border-b border-neutral-100 pb-2">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mr-1">
              Staff Filter:
            </span>
            <button
              type="button"
              onClick={() => setSelectedStaffFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                selectedStaffFilter === 'all'
                  ? 'bg-neutral-900 text-white font-bold'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              All Staff
            </button>
            <button
              type="button"
              onClick={() => setSelectedStaffFilter('admin')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                selectedStaffFilter === 'admin'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Store Owner (Admin)
            </button>
            {staffMembers.map((staff) => (
              <button
                key={staff.id}
                type="button"
                onClick={() => setSelectedStaffFilter(staff.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  selectedStaffFilter === staff.id
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {staff.name} (@{staff.username})
              </button>
            ))}
          </div>
        )}

        {/* Row 3: Three Defined Customer Dispute Types */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mr-1">
            Dispute Type:
          </span>
          {[
            { id: 'all', label: `All Types (${allDisputedOrders.length})` },
            {
              id: 'cancellation',
              label: `Order Cancellation Requests (${cancellationCount})`,
              icon: Ban,
              highlight: cancellationCount > 0,
            },
            {
              id: 'delivery',
              label: `Delivery Dispute Issues (${deliveryCount})`,
              icon: Truck,
              highlight: deliveryCount > 0,
            },
            {
              id: 'refund',
              label: `Refund Report Issues (${refundCount})`,
              icon: RotateCcw,
              highlight: refundCount > 0,
            },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.id as DisputeCategory)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  categoryFilter === c.id
                    ? 'bg-rose-950 text-white shadow-xs'
                    : c.highlight
                    ? 'bg-amber-50 text-amber-900 border border-amber-300 font-bold hover:bg-amber-100'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dispute Orders List */}
      {filteredDisputes.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="font-serif text-lg font-bold text-neutral-900">
            {activeBucket === 'unassigned'
              ? 'Unassigned Queue is Clear'
              : activeBucket === 'mine'
              ? 'No Active Disputes in Your Bucket'
              : activeBucket === 'closed'
              ? 'No Resolved / Closed Disputes Recorded'
              : 'No Disputes Matching Filter'}
          </h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            {activeBucket === 'unassigned'
              ? 'Every customer cancellation request, delivery dispute, and refund inquiry has an assigned staff or admin concierge.'
              : activeBucket === 'mine'
              ? 'You have zero pending dispute cases assigned to your concierge profile.'
              : 'Try selecting another queue bucket or clearing your search criteria.'}
          </p>
          {activeBucket !== 'unassigned' && totalUnassignedCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveBucket('unassigned')}
              className="mt-2 px-4 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>View Unassigned Queue ({totalUnassignedCount})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDisputes.map((order) => {
            const courier = getCourierDetails(order.shippingDetails?.courierName);
            const isAssignedToMe = order.assignedStaffId === currentUserId;
            const isUnassigned = !order.assignedStaffId || order.assignedStaffId === 'unassigned';
            const isClosed = isDisputeClosedOrResolved(order);
            const commentsList = order.deliveryIssue?.investigationComments || [];
            const isCancellation = isCancellationCase(order);
            const isRefund = isRefundCase(order);
            const isDelivery = isDeliveryCase(order);

            const resolutionDuration = formatResolutionDuration(
              order.deliveryIssue?.reportedAt || order.cancellationRequest?.requestedAt,
              order.disputeResolvedAt || order.closedAt || order.deliveryIssue?.resolvedAt
            );

            return (
              <div
                key={order.id}
                onClick={() => handleOpenOnOrderPage(order.id)}
                className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs hover:border-amber-400 hover:shadow-md transition space-y-3 cursor-pointer group/dispute ${
                  isUnassigned
                    ? 'border-amber-300 ring-1 ring-amber-200/70 bg-amber-50/20'
                    : isClosed
                    ? 'border-emerald-200 bg-neutral-50/60'
                    : 'border-neutral-200'
                }`}
                title="Click to redirect and open directly on the original order page"
              >
                {/* Header Row: Order Number, Dispute Type Badge, Assigned Owner, Stage, Total */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs sm:text-sm font-bold text-rose-950 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                      #{order.orderNumber}
                    </span>

                    {/* Dispute Type Badge */}
                    {isCancellation ? (
                      <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1 shadow-2xs">
                        <Ban className="w-3 h-3 text-rose-700" />
                        <span>Order Cancellation Request</span>
                      </span>
                    ) : isRefund ? (
                      <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs">
                        <RotateCcw className="w-3 h-3 text-amber-700" />
                        <span>Refund Report Issue</span>
                      </span>
                    ) : (
                      <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1 shadow-2xs">
                        <Truck className="w-3 h-3 text-rose-600" />
                        <span>Delivery Dispute Issue</span>
                      </span>
                    )}

                    {/* Status Pill */}
                    <span
                      className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isClosed
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : isUnassigned
                          ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {isClosed
                        ? 'Resolved & Closed'
                        : isUnassigned
                        ? 'Unassigned Queue'
                        : 'Active Investigation'}
                    </span>

                    {/* Handling Bucket Badge */}
                    <span
                      className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
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
                          ? 'Unassigned'
                          : isAssignedToMe
                          ? 'Assigned to You'
                          : (order.assignedStaffName || 'Staff')}
                      </span>
                    </span>
                  </div>

                  {/* Stage & Total Amount */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-xs text-neutral-500 font-medium">
                      Order Stage: <strong className="text-neutral-800">{order.status}</strong>
                    </span>
                    <span className="text-neutral-300">•</span>
                    <span className="font-serif font-bold text-xs sm:text-sm text-neutral-900">
                      {formatPrice(order.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Middle Row: Customer Info & Tailored Dispute Details */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start text-xs pt-1">
                  {/* Customer Contact */}
                  <div className="md:col-span-4 text-neutral-700 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 space-y-0.5">
                    <p className="font-bold text-neutral-900">{order.customer.name}</p>
                    <p className="text-[11px] text-neutral-600 font-mono flex items-center gap-1">
                      <Phone className="w-3 h-3 text-neutral-400" />
                      <span>{order.customer.phone}</span>
                    </p>
                    <p className="text-[11px] text-neutral-500 truncate">
                      {order.customer.city}, {order.customer.state} ({order.customer.pincode})
                    </p>
                  </div>

                  {/* Tailored Dispute Content Preview */}
                  <div className="md:col-span-8 space-y-2">
                    {/* 1. Cancellation Request Details (NO Courier Details!) */}
                    {isCancellation && (
                      <div className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-200/80 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-rose-900 font-bold">
                          <span>Customer Cancellation Reason:</span>
                          <span>Refund Target: {order.refundDetails?.refundUpiId || order.customer.phone}</span>
                        </div>
                        <p className="text-rose-950 font-medium italic text-[11px]">
                          "{order.cancellationRequest?.reason || order.cancellationReason || order.deliveryIssue?.issueDescription || 'Customer requested order cancellation'}"
                        </p>
                        {order.cancellationRequest?.adminDecisionNotes && (
                          <p className="text-[10px] text-neutral-600 pt-0.5 border-t border-rose-200">
                            <strong>Atelier Decision:</strong> {order.cancellationRequest.adminDecisionNotes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 2. Delivery Dispute Details (Displays relevant courier details) */}
                    {isDelivery && (
                      <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/90 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-amber-950 flex-wrap gap-1">
                          <span className="flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-amber-700" />
                            <span>Courier Partner: {order.shippingDetails?.courierName || 'DTDC Express'}</span>
                          </span>
                          {order.shippingDetails?.trackingNumber && (
                            <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200 text-neutral-900">
                              Consignment #{order.shippingDetails.trackingNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-amber-950 text-[11px] italic">
                          "{order.deliveryIssue?.issueDescription || 'Customer reported non-receipt despite Delivered/Shipped status.'}"
                        </p>
                        {/* Courier Quick Links */}
                        <div className="pt-1 border-t border-amber-200/80 flex items-center justify-between text-[11px] flex-wrap gap-2">
                          <span className="text-neutral-500">Destination Hub: {order.customer.city}</span>
                          <div className="flex items-center gap-3">
                            {order.shippingDetails?.trackingNumber && (
                              <a
                                href={buildCourierTrackingUrl(
                                  courier,
                                  order.shippingDetails?.courierName,
                                  order.shippingDetails?.trackingNumber
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="font-bold text-blue-700 hover:text-blue-900 underline flex items-center gap-0.5"
                              >
                                <span>Track Consignment</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            <a
                              href={buildCourierMapsUrl(
                                courier,
                                order.shippingDetails?.courierName,
                                order.customer.city
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="font-bold text-rose-700 hover:text-rose-900 underline flex items-center gap-0.5"
                            >
                              <MapPin className="w-3 h-3 text-rose-600" />
                              <span>Courier Hub on Maps</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. Refund Report Details (Displays associated refund details) */}
                    {isRefund && (
                      <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200 text-emerald-950 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold flex-wrap gap-1">
                          <span className="flex items-center gap-1 text-emerald-900">
                            <RotateCcw className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Refund Settlement Verification</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            order.refundDetails?.refundStatus === 'processed'
                              ? 'bg-emerald-200 text-emerald-900'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}>
                            {order.refundDetails?.refundStatus === 'processed' ? 'Refund Processed ✓' : 'Settlement In Queue'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                          <div>Prepaid Payment UTR: <strong className="font-mono text-neutral-900">{order.upiTransactionId}</strong></div>
                          <div>Refund Bank UTR: <strong className="font-mono text-emerald-900">{order.refundDetails?.refundUtr || 'Pending UTR'}</strong></div>
                          <div>Target UPI: <strong className="font-mono text-neutral-900">{order.refundDetails?.refundUpiId || order.customer.phone}</strong></div>
                          <div>Amount: <strong className="font-serif font-bold text-neutral-900">{formatPrice(order.refundDetails?.refundAmount || order.totalAmount)}</strong></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer: Timeline, Investigation Notes Count & Action Buttons */}
                <div className="pt-2 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-3 text-[11px] text-neutral-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-neutral-400" />
                      <span>
                        Reported:{' '}
                        {new Date(
                          order.deliveryIssue?.reportedAt || order.cancellationRequest?.requestedAt || order.createdAt
                        ).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </span>

                    {commentsList.length > 0 && (
                      <span className="flex items-center gap-1 font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        <MessageSquare className="w-3 h-3 text-amber-600" />
                        <span>{commentsList.length} Investigation Log{commentsList.length === 1 ? '' : 's'}</span>
                      </span>
                    )}

                    {resolutionDuration && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                        Speed: {resolutionDuration}
                      </span>
                    )}
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                    {/* Tailored Quick Action: Cancellation Approve / Decline right on card */}
                    {isCancellation && !isClosed && order.status !== 'Cancelled' && order.status !== 'Refunded' && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCancellationApproveOrder(order);
                            setCancellationApproveUtr(
                              order.refundDetails?.refundUtr ||
                                `UTR${Math.floor(100000000000 + Math.random() * 900000000000)}`
                            );
                            setCancellationApproveNotes(
                              'Cancellation approved by concierge. Saree auto-restocked to inventory.'
                            );
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs transition shadow-2xs flex items-center gap-1 cursor-pointer"
                          title="Approve cancellation and replenish saree stock"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Approve & Restock</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCancellationDeclineOrder(order);
                            setCancellationDeclineReason(
                              'Saree has already been packed and handed over to courier dispatch'
                            );
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-semibold text-xs transition cursor-pointer flex items-center gap-1"
                          title="Decline cancellation request"
                        >
                          <Ban className="w-3 h-3 text-rose-600" />
                          <span>Decline</span>
                        </button>
                      </div>
                    )}

                    {/* Claim or Reassign */}
                    {isUnassigned ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAssignToMe(order);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="Claim this dispute into your personal bucket"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>Claim to Me</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReassigningOrder(order);
                          setTargetStaffId(order.assignedStaffId || 'admin');
                          setReassignmentNote('');
                        }}
                        className="px-2 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs transition flex items-center gap-1 border border-neutral-300 cursor-pointer"
                        title="Reassign case to another staff member or admin bucket"
                      >
                        <UserCheck className="w-3 h-3 text-neutral-600" />
                        <span>Reassign</span>
                      </button>
                    )}

                    {/* Live Chat */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setChatModalOrder(order);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold text-xs transition flex items-center gap-1 cursor-pointer"
                      title="Open Live Chat"
                    >
                      <MessageSquare className="w-3 h-3 text-blue-600" />
                      <span>Chat</span>
                      {order.chatMessages?.some((m) => !m.readByStaff && m.sender === 'customer') && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                    </button>

                    {/* WhatsApp */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const cleanPhone = order.customer.phone.replace(/[^0-9]/g, '');
                        const msg = isCancellation
                          ? `Namaste ${order.customer.name}! 🪔✨\n\nRegarding your cancellation request for order #${order.orderNumber} at *${settings.boutiqueName}*.\nOur concierge desk is actively reviewing your request. Please let us know if you need any additional assistance.\n\nWarm regards,\n${settings.boutiqueName}`
                          : isRefund
                          ? `Namaste ${order.customer.name}! 🪔✨\n\nRegarding your refund inquiry for order #${order.orderNumber} (Amount: ${formatPrice(order.totalAmount)}).\n• Status: *${order.refundDetails?.refundStatus === 'processed' ? 'Processed' : 'In Queue'}*${order.refundDetails?.refundUtr ? `\n• Bank Transaction UTR ID: *${order.refundDetails.refundUtr}*` : ''}\n\nOur concierge finance team is verifying settlement with our accounts desk.\n\nWarm regards,\n${settings.boutiqueName}`
                          : `Namaste ${order.customer.name}! 🪔✨\n\nRegarding your delivery query for order #${order.orderNumber} (${order.shippingDetails?.courierName || 'Courier'}, Tracking: ${order.shippingDetails?.trackingNumber || 'Pending'}).\n\nOur concierge team is actively investigating with the local courier dispatch office to verify handover.\n\nWarm regards,\n${settings.boutiqueName}`;
                        openWhatsApp(cleanPhone, msg);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold text-xs transition flex items-center gap-1 cursor-pointer"
                      title="WhatsApp Customer"
                    >
                      <MessageSquare className="w-3 h-3 text-emerald-600" />
                      <span>WhatsApp</span>
                    </button>

                    {/* Primary Button: Open directly on original Order Page */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenOnOrderPage(order.id);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                      title="Open directly on the original order page with tailored workflow and investigation logs"
                    >
                      <span>Open on Original Order Page</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Assign / Reassign Staff Modal with Handover Reason */}
      {reassigningOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto">
            <div className="p-5 bg-neutral-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif text-base font-bold">
                  {reassigningOrder.assignedStaffId ? 'Reassign Dispute' : 'Assign Dispute'} · #{reassigningOrder.orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReassigningOrder(null)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReassign} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-blue-950 space-y-1">
                <p className="font-bold">Bucket Routing Movement</p>
                <p className="text-[11px] leading-relaxed text-blue-900">
                  Assigning this dispute routes it directly out of the Unassigned Queue and into the selected staff/admin's personal Customer Issue bucket.
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
                  <option value="admin">Store Owner (Admin)</option>
                  {staffMembers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (@{s.username}) · {s.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1.5">
                  Assignment / Handover Reason
                </label>
                <textarea
                  rows={2}
                  value={reassignmentNote}
                  onChange={(e) => setReassignmentNote(e.target.value)}
                  placeholder="e.g. Handing over dispute to courier coordinator Ramesh for branch investigation..."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                />
                <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px]">
                  <span className="text-neutral-400 font-semibold">Presets:</span>
                  {[
                    'Emergency leave handover',
                    'Shift handover',
                    'Logistics investigation priority',
                    'VIP patron resolution',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setReassignmentNote(preset)}
                      className="px-2 py-0.5 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
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

      {/* MODAL 2: Cancellation Approval & Auto-Restock Modal */}
      {cancellationApproveOrder && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 my-auto">
            <div className="p-5 bg-gradient-to-r from-emerald-950 via-neutral-900 to-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <RotateCcw className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white">
                    Approve Cancellation & Issue Refund (Auto-Restock)
                  </h3>
                  <p className="text-[11px] text-emerald-300">
                    Order #{cancellationApproveOrder.orderNumber} · {cancellationApproveOrder.customer.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancellationApproveOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmCancellationApproval(cancellationApproveOrder);
              }}
              className="p-6 space-y-4 text-xs text-neutral-700"
            >
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Automatic Inventory Replenishment</span>
                </p>
                <p className="text-[11px] text-emerald-900 leading-relaxed">
                  Approving immediately restores all ordered sarees ({cancellationApproveOrder.items.length} item) back to live boutique stock, marks them with the "Restocked" flag, records the Bank UTR, and moves the order into the Closed bucket.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs">
                <div>
                  <span className="text-neutral-500 block">Total Refund Amount:</span>
                  <span className="font-serif font-bold text-sm text-neutral-900">
                    {formatPrice(cancellationApproveOrder.totalAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Customer Refund UPI:</span>
                  <span className="font-mono font-bold text-neutral-900 truncate block">
                    {cancellationApproveOrder.refundDetails?.refundUpiId || cancellationApproveOrder.customer.phone}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Bank Refund Transaction UTR ID *
                </label>
                <input
                  type="text"
                  required
                  value={cancellationApproveUtr}
                  onChange={(e) => setCancellationApproveUtr(e.target.value)}
                  placeholder="e.g. 12-digit Bank UTR (e.g. 402819283741)"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white font-mono text-sm tracking-wider text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Approval & Settlement Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={cancellationApproveNotes}
                  onChange={(e) => setCancellationApproveNotes(e.target.value)}
                  placeholder="e.g. Cancellation approved by concierge. Saree auto-restocked to inventory."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCancellationApproveOrder(null)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Confirm Approval & Auto-Restock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Decline Cancellation Request Modal */}
      {cancellationDeclineOrder && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 my-auto">
            <div className="p-5 bg-gradient-to-r from-rose-950 via-neutral-900 to-rose-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <Ban className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white">
                    Decline Cancellation Request
                  </h3>
                  <p className="text-[11px] text-rose-300">
                    Order #{cancellationDeclineOrder.orderNumber} · {cancellationDeclineOrder.customer.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancellationDeclineOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmCancellationDecline(cancellationDeclineOrder);
              }}
              className="p-6 space-y-4 text-xs text-neutral-700"
            >
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-950 space-y-1">
                <p className="font-bold">Active Order Preservation</p>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  Declining will mark the cancellation request as rejected. The order will remain active in{' '}
                  <strong className="text-neutral-900 font-bold">{cancellationDeclineOrder.status}</strong> stage.
                </p>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1.5">
                  Quick Reason Presets:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Saree already packed & handed over to courier dispatch',
                    'Custom fall, pico & tassel stitching already completed',
                    'Cancellation window has expired for this order',
                    'Customer agreed to proceed with delivery',
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCancellationDeclineReason(preset)}
                      className={`text-[10px] px-2 py-1 rounded-lg border text-left transition cursor-pointer ${
                        cancellationDeclineReason === preset
                          ? 'bg-rose-100 text-rose-900 border-rose-300 font-bold'
                          : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Reason for Declining *
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancellationDeclineReason}
                  onChange={(e) => setCancellationDeclineReason(e.target.value)}
                  placeholder="State the official reason for declining cancellation..."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCancellationDeclineOrder(null)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Ban className="w-4 h-4" />
                  <span>Confirm Decline Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Live Customer Chat Modal */}
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
                type="button"
                onClick={() => setChatModalOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
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
    </div>
  );
};
