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
  CheckCircle,
  Package,
  CreditCard,
  ChevronRight,
  FileText,
  Send,
  HelpCircle,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { OrderLiveChat } from '../common/OrderLiveChat';
import { buildCourierTrackingUrl, resolveCourierDetails } from '../../utils/courier';

interface CustomerIssuesManagerProps {
  onNavigateToTab?: (tab: string, param?: string) => void;
}

export type DisputeCategory = 'all' | 'cancellation' | 'delivery' | 'refund';
export type DisputeBucket = 'unassigned' | 'mine' | 'staff' | 'closed';

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
    assignCustomerIssueStaff,
    addInvestigationComment,
    resolveCancellationRequest,
    replenishOrderInventory,
    markRefundProcessed,
  } = useStore();

  const isAdmin = currentUser?.type === 'admin';
  const currentUserId = currentUser?.staffId || (isAdmin ? 'admin' : '');
  const currentUserName = currentUser?.name || (isAdmin ? 'Store Owner' : 'Staff Concierge');

  // Bucket selection according to Workflow:
  // 1. Unassigned Queue (Default landing queue)
  // 2. My Customer Issues (Assigned to logged-in staff/admin)
  // 3. Staff Buckets (Assigned to other staff specialists)
  // 4. Closed Bucket (Resolved & closed issues)
  const [activeBucket, setActiveBucket] = useState<DisputeBucket>('unassigned');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<DisputeCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals & Drawers State
  const [investigatingOrder, setInvestigatingOrder] = useState<Order | null>(null);
  const [investigationTab, setInvestigationTab] = useState<'details' | 'log' | 'chat'>('details');
  const [newLogComment, setNewLogComment] = useState('');
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);

  // Assignment Modal
  const [reassigningOrder, setReassigningOrder] = useState<Order | null>(null);
  const [targetStaffId, setTargetStaffId] = useState<string>('admin');
  const [reassignmentNote, setReassignmentNote] = useState('');

  // Cancellation Approval & Decline
  const [cancellationApproveOrder, setCancellationApproveOrder] = useState<Order | null>(null);
  const [cancellationApproveUtr, setCancellationApproveUtr] = useState('');
  const [cancellationApproveTool, setCancellationApproveTool] = useState('UPI Banking');
  const [cancellationApproveNotes, setCancellationApproveNotes] = useState('');
  const [cancellationDeclineOrder, setCancellationDeclineOrder] = useState<Order | null>(null);
  const [cancellationDeclineReason, setCancellationDeclineReason] = useState(
    'Saree has already been packed and handed over to courier dispatch'
  );

  // Resolve Modal
  const [resolvingOrder, setResolvingOrder] = useState<Order | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Reopen Modal
  const [reopeningOrder, setReopeningOrder] = useState<Order | null>(null);
  const [reopenReason, setReopenReason] = useState('');

  // Manual Refund Processing Modal
  const [refundProcessingOrder, setRefundProcessingOrder] = useState<Order | null>(null);
  const [processRefundUtr, setProcessRefundUtr] = useState('');
  const [processRefundTool, setProcessRefundTool] = useState('UPI Banking');
  const [processRefundNotes, setProcessRefundNotes] = useState('');

  // Feedback Notification Toast
  const [toastMessage, setToastMessage] = useState<{
    title: string;
    description: string;
    type: 'success' | 'info';
  } | null>(null);

  const showToast = (title: string, description: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ title, description, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Helper classifiers for the 3 distinct Workflow Issue Types:
  // 1. Order Cancellation Request
  // 2. Delivery Dispute Issue
  // 3. Refund Report Issue

  const isRefundIssue = (o: Order): boolean => {
    if (o.deliveryIssue?.reported === true && o.deliveryIssue?.issueType === 'refund') return true;
    const desc = (o.deliveryIssue?.issueDescription || '').toLowerCase();
    if (
      desc.includes('refund') ||
      desc.includes('funds not received') ||
      desc.includes('settlement')
    ) {
      return true;
    }
    if (
      o.deliveryIssue?.reported === true &&
      (o.status === 'Refunded' || o.status === 'Cancelled' || o.refundDetails?.refundStatus === 'processed') &&
      o.cancellationRequest?.status !== 'pending' &&
      o.deliveryIssue?.issueType !== 'delivery'
    ) {
      return true;
    }
    return false;
  };

  const isCancellationIssue = (o: Order): boolean => {
    if (isRefundIssue(o)) return false;
    if (o.cancellationRequest?.requested === true && o.cancellationRequest.status === 'pending') return true;
    if (o.deliveryIssue?.issueType === 'cancellation') return true;
    const desc = (o.deliveryIssue?.issueDescription || '').toLowerCase();
    if (desc.includes('cancellation') || desc.includes('cancel order')) return true;
    if (o.cancellationRequest?.requested === true && !o.deliveryIssue?.reported) return true;
    return false;
  };

  const isDeliveryIssue = (o: Order): boolean => {
    if (isRefundIssue(o)) return false;
    if (isCancellationIssue(o)) return false;
    return Boolean(o.deliveryIssue?.reported === true);
  };

  const getIssueType = (o: Order): 'cancellation' | 'delivery' | 'refund' => {
    if (isRefundIssue(o)) return 'refund';
    if (isCancellationIssue(o)) return 'cancellation';
    return 'delivery';
  };

  const isIssueActive = (o: Order): boolean => {
    if (o.deliveryIssue?.reported === true && o.deliveryIssue.status !== 'resolved') return true;
    if (o.cancellationRequest?.requested === true && o.cancellationRequest.status === 'pending') return true;
    return false;
  };

  const isIssueClosed = (o: Order): boolean => {
    if (isIssueActive(o)) return false;
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

  // All orders with a customer issue (active or closed)
  const allDisputedOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.deliveryIssue?.reported === true ||
        (o.cancellationRequest?.requested === true && o.cancellationRequest.status === 'pending') ||
        isRefundIssue(o) ||
        isCancellationIssue(o) ||
        isDeliveryIssue(o)
    );
  }, [orders]);

  const activeDisputes = useMemo(() => {
    return allDisputedOrders.filter((o) => !isIssueClosed(o));
  }, [allDisputedOrders]);

  const closedDisputes = useMemo(() => {
    return allDisputedOrders.filter((o) => isIssueClosed(o));
  }, [allDisputedOrders]);

  // Helpers for customer issue dedicated assignment
  const getIssueStaffId = (o: Order): string => {
    return o.issueAssignedStaffId || o.deliveryIssue?.assignedStaffId || 'unassigned';
  };

  const getIssueStaffName = (o: Order): string => {
    return o.issueAssignedStaffName || o.deliveryIssue?.assignedStaffName || 'Unassigned';
  };

  // Stage 1: Unassigned Queue (Active customer issues awaiting staff triage)
  const unassignedDisputes = useMemo(() => {
    return activeDisputes.filter((o) => {
      const sId = getIssueStaffId(o);
      return !sId || sId === 'unassigned';
    });
  }, [activeDisputes]);

  // Stage 2: My Bucket (Active issues assigned to currently logged in staff member or Store Owner)
  const myAssignedDisputes = useMemo(() => {
    return activeDisputes.filter((o) => getIssueStaffId(o) === currentUserId);
  }, [activeDisputes, currentUserId]);

  // Stage 3: Staff Buckets (Active issues assigned to other staff members)
  const otherStaffDisputes = useMemo(() => {
    return activeDisputes.filter((o) => {
      const sId = getIssueStaffId(o);
      return Boolean(sId && sId !== 'unassigned' && sId !== currentUserId);
    });
  }, [activeDisputes, currentUserId]);

  // Top level badge counters
  const totalUnassignedCount = unassignedDisputes.length;
  const totalMyCount = myAssignedDisputes.length;
  const totalOtherStaffCount = otherStaffDisputes.length;
  const totalClosedCount = closedDisputes.length;
  const totalActiveCount = activeDisputes.length;

  const cancellationCount = activeDisputes.filter(isCancellationIssue).length;
  const deliveryCount = activeDisputes.filter(isDeliveryIssue).length;
  const refundCount = activeDisputes.filter(isRefundIssue).length;

  // Filtered view by active bucket, staff dropdown, category filter, and search
  const filteredDisputes = useMemo(() => {
    let list: Order[] = [];
    if (activeBucket === 'unassigned') {
      list = unassignedDisputes;
    } else if (activeBucket === 'mine') {
      list = myAssignedDisputes;
    } else if (activeBucket === 'staff') {
      if (selectedStaffFilter === 'all') {
        list = otherStaffDisputes;
      } else {
        list = activeDisputes.filter((o) => getIssueStaffId(o) === selectedStaffFilter);
      }
    } else if (activeBucket === 'closed') {
      if (selectedStaffFilter === 'all') {
        list = closedDisputes;
      } else {
        list = closedDisputes.filter(
          (o) => getIssueStaffId(o) === selectedStaffFilter || o.assignedStaffId === selectedStaffFilter
        );
      }
    }

    // Secondary Category filter
    if (categoryFilter === 'cancellation') {
      list = list.filter(isCancellationIssue);
    } else if (categoryFilter === 'delivery') {
      list = list.filter(isDeliveryIssue);
    } else if (categoryFilter === 'refund') {
      list = list.filter(isRefundIssue);
    }

    // Search query
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
          (order.cancellationReason || '').toLowerCase().includes(q) ||
          (order.cancellationRequest?.reason || '').toLowerCase().includes(q)
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

  // Keep investigatingOrder in sync if orders update in real time
  const currentInvestigatingOrder = useMemo(() => {
    if (!investigatingOrder) return null;
    return orders.find((o) => o.id === investigatingOrder.id) || investigatingOrder;
  }, [investigatingOrder, orders]);

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

  // Workflow Action 1: 1-Click "Assign to Me"
  const handleAssignToMe = (order: Order) => {
    assignCustomerIssueStaff(
      order.id,
      currentUserId,
      currentUserName,
      `Claimed customer issue from Unassigned Queue into personal handling bucket`
    );
    showToast(
      `Assigned to You`,
      `Order #${order.orderNumber} has moved to your Customer Issue Bucket.`
    );
  };

  // Workflow Action 2: Staff / Admin Clicks "Assign" or "Reassign"
  const handleConfirmReassign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassigningOrder) return;

    const chosenStaff =
      targetStaffId === 'admin'
        ? { id: 'admin', name: 'Store Owner' }
        : staffMembers.find((s) => s.id === targetStaffId) || {
            id: targetStaffId,
            name: 'Staff Specialist',
          };

    const note =
      reassignmentNote.trim() ||
      `Assigned customer issue investigation to ${chosenStaff.name}`;

    assignCustomerIssueStaff(reassigningOrder.id, chosenStaff.id, chosenStaff.name, note);

    showToast(
      `Issue Reassigned`,
      `Order #${reassigningOrder.orderNumber} moved to ${chosenStaff.name}'s Customer Issue Bucket.`
    );

    setReassigningOrder(null);
    setReassignmentNote('');
  };

  // Workflow Action 3A: (For Cancellation Request) Approve Cancellation & Issue Refund (Auto-Restock)
  const handleConfirmCancellationApproval = (order: Order) => {
    const utr = cancellationApproveUtr.trim() || `UTR${Date.now().toString().slice(-8)}`;
    const notes =
      cancellationApproveNotes.trim() ||
      `Cancellation approved via ${cancellationApproveTool}. Saree auto-restocked to inventory.`;

    resolveCancellationRequest(order.id, 'approve', notes, utr);

    showToast(
      `Cancellation Approved & Restocked`,
      `Order #${order.orderNumber} marked Cancelled. Exact physical stock restored and issue moved to Closed Bucket.`
    );

    setCancellationApproveOrder(null);
    setCancellationApproveUtr('');
    setCancellationApproveNotes('');
    if (investigatingOrder?.id === order.id) {
      setInvestigatingOrder(null);
    }
  };

  // Workflow Action 3B: (For Cancellation Request) Decline Request
  const handleConfirmCancellationDecline = (order: Order) => {
    const reason =
      cancellationDeclineReason.trim() || 'Cancellation request declined by boutique concierge.';
    resolveCancellationRequest(order.id, 'reject', reason);

    showToast(
      `Cancellation Request Declined`,
      `Order #${order.orderNumber} remains active. Dispute case closed and moved to Closed Bucket.`
    );

    setCancellationDeclineOrder(null);
    if (investigatingOrder?.id === order.id) {
      setInvestigatingOrder(null);
    }
  };

  // Workflow Action 4: (For Delivery Dispute / Refund Report) State Order as Resolved and Closed
  const handleConfirmResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingOrder) return;

    const summary =
      resolutionNotes.trim() ||
      'Customer dispute investigated and resolved. Order moved to Closed Bucket.';

    await resolveDeliveryIssue(resolvingOrder.id, summary, 'resolve');

    showToast(
      `Issue Resolved & Closed`,
      `Order #${resolvingOrder.orderNumber} stated as resolved and moved to Closed Bucket.`
    );

    setResolvingOrder(null);
    setResolutionNotes('');
    if (investigatingOrder?.id === resolvingOrder.id) {
      setInvestigatingOrder(null);
    }
  };

  // Workflow Action 5: Reopen Closed Issue
  const handleConfirmReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopeningOrder) return;

    const reason =
      reopenReason.trim() || 'Customer re-contacted concierge for further assistance.';

    await resolveDeliveryIssue(reopeningOrder.id, reason, 'reopen');

    showToast(
      `Issue Reopened`,
      `Order #${reopeningOrder.orderNumber} returned to active investigation queue.`
    );

    setReopeningOrder(null);
    setReopenReason('');
    if (investigatingOrder?.id === reopeningOrder.id) {
      setInvestigatingOrder(null);
    }
  };

  // Workflow Action 6: Manual Refund Processing
  const handleConfirmProcessRefund = (order: Order) => {
    const utr = processRefundUtr.trim() || `UTR${Date.now().toString().slice(-8)}`;
    const tool = processRefundTool.trim() || 'UPI Banking';
    const notes = processRefundNotes.trim() || `Refund processed to customer via ${tool}`;

    markRefundProcessed(order.id, utr, tool, notes);

    showToast(
      `Refund Processed`,
      `Refund of ₹${order.totalAmount} completed (UTR: ${utr}). Order moved to Closed Bucket.`
    );

    setRefundProcessingOrder(null);
    setProcessRefundUtr('');
    setProcessRefundNotes('');
    if (investigatingOrder?.id === order.id) {
      setInvestigatingOrder(null);
    }
  };

  // Workflow Action 7: Add Investigation Log Comment
  const handleAddLogComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInvestigatingOrder || !newLogComment.trim()) return;

    setIsSubmittingLog(true);
    try {
      await addInvestigationComment(
        currentInvestigatingOrder.id,
        newLogComment.trim(),
        currentUserName,
        'investigating'
      );
      setNewLogComment('');
      showToast('Investigation Note Logged', 'Entry recorded with author & timestamp in audit log.');
    } catch (err) {
      console.error('Error logging comment:', err);
    } finally {
      setIsSubmittingLog(false);
    }
  };

  // Workflow Navigation: Staff / Admin Searches & Clicks to Open Original Order Page
  const handleOpenOriginalOrderPage = (orderId: string) => {
    if (onNavigateToTab) {
      onNavigateToTab('orders', orderId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom duration-300">
          <div className="bg-neutral-950 text-white px-4 py-3 rounded-2xl shadow-2xl border border-neutral-800 flex items-center gap-3 max-w-md">
            <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Check className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white leading-tight">{toastMessage.title}</p>
              <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">{toastMessage.description}</p>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="p-1 text-neutral-500 hover:text-white cursor-pointer ml-auto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header Banner with Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-100 text-rose-700">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900">
              Customer Issue & Dispute Redressal
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 font-sans font-bold border border-rose-300">
              {totalActiveCount} Active
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Unified dispute pipeline for Order Cancellations, Delivery Inquiries, and Refund Reports. Issues land in the Unassigned Queue, move to staff buckets upon assignment, and transition to Closed upon resolution.
          </p>
        </div>

        {/* Quick Bucket Status Counters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveBucket('unassigned')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeBucket === 'unassigned'
                ? 'bg-amber-500 text-neutral-950 border-amber-500 font-bold shadow-xs'
                : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Unassigned Queue ({totalUnassignedCount})</span>
          </button>

          <button
            onClick={() => setActiveBucket('mine')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              activeBucket === 'mine'
                ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                : 'bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100'
            }`}
          >
            <span>My Bucket ({totalMyCount})</span>
          </button>

          <button
            onClick={() => setActiveBucket('closed')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              activeBucket === 'closed'
                ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
            }`}
          >
            <span>Closed Bucket ({totalClosedCount})</span>
          </button>
        </div>
      </div>

      {/* Interactive Visual Workflow Stepper mirroring the attached diagram */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 text-white border border-neutral-800 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Operational Resolution Workflow</span>
          </span>
          <span className="text-[11px] text-neutral-400 hidden sm:inline">
            Click any stage below to filter active queue
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
          {/* Stage 1: Customer Issue Raised */}
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-neutral-400">Step 1</span>
              <span className="text-[10px] font-bold text-rose-400">3 Types</span>
            </div>
            <div className="mt-1 font-semibold text-white leading-tight">
              Issue Raised by Customer
            </div>
            <p className="text-[10px] text-neutral-400 mt-1 leading-snug">
              Cancellation, Delivery Dispute, or Refund Report
            </p>
          </div>

          {/* Stage 2: Lands in Unassigned Queue */}
          <button
            type="button"
            onClick={() => setActiveBucket('unassigned')}
            className={`p-2.5 rounded-xl border flex flex-col justify-between text-left transition cursor-pointer ${
              activeBucket === 'unassigned'
                ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-neutral-400">Step 2</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-neutral-950">
                {totalUnassignedCount}
              </span>
            </div>
            <div className="mt-1 font-semibold text-amber-300 leading-tight">
              Unassigned Queue
            </div>
            <p className="text-[10px] text-neutral-400 mt-1 leading-snug">
              Lands here awaiting concierge assignment
            </p>
          </button>

          {/* Stage 3: Assign / Reassign to Staff Bucket */}
          <button
            type="button"
            onClick={() => setActiveBucket('mine')}
            className={`p-2.5 rounded-xl border flex flex-col justify-between text-left transition cursor-pointer ${
              activeBucket === 'mine'
                ? 'bg-blue-500/20 border-blue-400 ring-1 ring-blue-400'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-neutral-400">Step 3</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-500 text-white">
                {totalMyCount} Mine
              </span>
            </div>
            <div className="mt-1 font-semibold text-blue-300 leading-tight">
              Staff / Admin Bucket
            </div>
            <p className="text-[10px] text-neutral-400 mt-1 leading-snug">
              Concierge clicks Assign/Reassign to take ownership
            </p>
          </button>

          {/* Stage 4: Search & Open Original Order Page */}
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-neutral-400">Step 4</span>
              <span className="text-[10px] font-bold text-emerald-400">Investigate</span>
            </div>
            <div className="mt-1 font-semibold text-white leading-tight">
              Original Order Page
            </div>
            <p className="text-[10px] text-neutral-400 mt-1 leading-snug">
              Approve/decline, view courier/refund, log notes
            </p>
          </div>

          {/* Stage 5: State as Resolved and Closed */}
          <button
            type="button"
            onClick={() => setActiveBucket('closed')}
            className={`p-2.5 rounded-xl border flex flex-col justify-between text-left transition cursor-pointer ${
              activeBucket === 'closed'
                ? 'bg-emerald-500/20 border-emerald-400 ring-1 ring-emerald-400'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-neutral-400">Step 5</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500 text-neutral-950">
                {totalClosedCount}
              </span>
            </div>
            <div className="mt-1 font-semibold text-emerald-300 leading-tight">
              Closed Bucket
            </div>
            <p className="text-[10px] text-neutral-400 mt-1 leading-snug">
              Automatically moves to Closed upon resolution
            </p>
          </button>
        </div>
      </div>

      {/* Main Controls: Bucket Tabs & Type Filters */}
      <div className="space-y-3">
        {/* Row 1: Primary Bucket Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-neutral-200 pb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveBucket('unassigned')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeBucket === 'unassigned'
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>1. Unassigned Queue</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeBucket === 'unassigned' ? 'bg-amber-400 text-neutral-950' : 'bg-neutral-100 text-neutral-700'
              }`}>
                {totalUnassignedCount}
              </span>
            </button>

            <button
              onClick={() => setActiveBucket('mine')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeBucket === 'mine'
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200'
              }`}
            >
              <User className="w-3.5 h-3.5 text-blue-500" />
              <span>2. My Customer Issues</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeBucket === 'mine' ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-700'
              }`}>
                {totalMyCount}
              </span>
            </button>

            <button
              onClick={() => setActiveBucket('staff')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeBucket === 'staff'
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-purple-500" />
              <span>3. Staff Buckets</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeBucket === 'staff' ? 'bg-purple-500 text-white' : 'bg-neutral-100 text-neutral-700'
              }`}>
                {totalOtherStaffCount}
              </span>
            </button>

            <button
              onClick={() => setActiveBucket('closed')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeBucket === 'closed'
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>4. Closed Bucket</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeBucket === 'closed' ? 'bg-emerald-500 text-neutral-950' : 'bg-neutral-100 text-neutral-700'
              }`}>
                {totalClosedCount}
              </span>
            </button>
          </div>

          {/* If in Staff or Closed Bucket, provide Staff Specialist filter dropdown */}
          {(activeBucket === 'staff' || activeBucket === 'closed') && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500 font-medium">Filter by Staff:</span>
              <select
                value={selectedStaffFilter}
                onChange={(e) => setSelectedStaffFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-white text-neutral-900 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-neutral-950"
              >
                <option value="all">All Staff Specialists</option>
                <option value="admin">Store Owner (Admin)</option>
                {staffMembers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (@{s.username})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Row 2: Secondary Issue Type Filter Pills & Search Input */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Issue Type Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              All Types
            </button>

            <button
              onClick={() => setCategoryFilter('cancellation')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                categoryFilter === 'cancellation'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <RotateCcw className="w-3 h-3 text-rose-600" />
              <span>1. Cancellation Requests</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-bold">
                {cancellationCount}
              </span>
            </button>

            <button
              onClick={() => setCategoryFilter('delivery')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                categoryFilter === 'delivery'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Truck className="w-3 h-3 text-amber-600" />
              <span>2. Delivery Disputes</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-bold">
                {deliveryCount}
              </span>
            </button>

            <button
              onClick={() => setCategoryFilter('refund')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                categoryFilter === 'refund'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              <CreditCard className="w-3 h-3 text-indigo-600" />
              <span>3. Refund Reports</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-bold">
                {refundCount}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order #, phone, courier..."
              className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-neutral-300 bg-white text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-950"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main List: Disputed Orders according to Workflow */}
      {filteredDisputes.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-neutral-200 space-y-3">
          <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="font-serif font-bold text-lg text-neutral-900">
            {activeBucket === 'unassigned'
              ? 'Unassigned Queue is Empty'
              : activeBucket === 'mine'
              ? 'No Customer Issues Assigned to You'
              : activeBucket === 'staff'
              ? 'No Issues in Staff Buckets'
              : 'No Closed / Resolved Customer Issues'}
          </h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            {activeBucket === 'unassigned'
              ? 'All incoming customer disputes and cancellation requests have been assigned to concierge staff specialists.'
              : activeBucket === 'mine'
              ? 'You have no open customer issues currently awaiting your investigation. Check the Unassigned Queue to claim new cases.'
              : activeBucket === 'closed'
              ? 'Resolved customer disputes and completed cancellations will appear here once marked as closed.'
              : 'Try adjusting your search query or issue type filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDisputes.map((order) => {
            const issueType = getIssueType(order);
            const courier = resolveCourierDetails(
              order.shippingDetails?.courierName,
              settings.courierServices,
              order.customer.city
            );
            const trackingUrl = buildCourierTrackingUrl(
              courier,
              order.shippingDetails?.courierName,
              order.shippingDetails?.trackingNumber
            );
            const issueStaffId = getIssueStaffId(order);
            const issueStaffName = getIssueStaffName(order);
            const isUnassigned = !issueStaffId || issueStaffId === 'unassigned';
            const isAssignedToMe = issueStaffId === currentUserId;
            const isClosed = isIssueClosed(order);
            const duration = formatResolutionDuration(
              order.deliveryIssue?.reportedAt || order.cancellationRequest?.requestedAt,
              order.deliveryIssue?.resolvedAt || order.closedAt
            );

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md ${
                  isClosed
                    ? 'border-neutral-200/80 bg-neutral-50/50'
                    : issueType === 'cancellation'
                    ? 'border-rose-200 ring-1 ring-rose-100'
                    : issueType === 'delivery'
                    ? 'border-amber-200 ring-1 ring-amber-100'
                    : 'border-indigo-200 ring-1 ring-indigo-100'
                }`}
              >
                {/* Closed Banner if resolved */}
                {isClosed && (
                  <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>
                        Resolved & Closed by {order.deliveryIssue?.resolvedBy || order.closedBy || 'Concierge'}
                        {order.deliveryIssue?.resolvedAt && ` on ${new Date(order.deliveryIssue.resolvedAt).toLocaleDateString('en-IN')}`}
                      </span>
                      {duration && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                          ⚡ Resolved in {duration}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setReopeningOrder(order)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reopen Issue</span>
                    </button>
                  </div>
                )}

                <div className="p-4 sm:p-5 space-y-4">
                  {/* Top Row: Order #, Date, Issue Type Badge, and Current Stage */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(order.orderNumber, `order-${order.id}`)}
                        className="font-serif font-bold text-base sm:text-lg text-neutral-900 flex items-center gap-1.5 hover:text-rose-700 transition cursor-pointer"
                        title="Click to copy order number"
                      >
                        <span>#{order.orderNumber}</span>
                        {copiedKey === `order-${order.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                      </button>

                      {/* Issue Type Badge (1, 2, or 3) */}
                      {issueType === 'cancellation' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300">
                          <RotateCcw className="w-3 h-3 text-rose-600" />
                          <span>1. Order Cancellation Request</span>
                        </span>
                      ) : issueType === 'delivery' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          <Truck className="w-3 h-3 text-amber-700" />
                          <span>2. Delivery Dispute Issue</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-300">
                          <CreditCard className="w-3 h-3 text-indigo-700" />
                          <span>3. Refund Report Issue</span>
                        </span>
                      )}

                      {/* Order Stage Badge */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        order.status === 'Confirmed'
                          ? 'bg-blue-100 text-blue-900'
                          : order.status === 'Shipped'
                          ? 'bg-purple-100 text-purple-900'
                          : order.status === 'Delivered'
                          ? 'bg-emerald-100 text-emerald-900'
                          : order.status === 'Cancelled'
                          ? 'bg-rose-100 text-rose-900'
                          : order.status === 'Refunded'
                          ? 'bg-indigo-100 text-indigo-900'
                          : 'bg-amber-100 text-amber-900'
                      }`}>
                        Stage: {order.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Placed {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Middle Content: Customer, Items, and Issue Description Box */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Customer & Purchased Saree Summary */}
                    <div className="space-y-2">
                      <div className="text-xs">
                        <span className="font-bold text-neutral-900">{order.customer.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <a
                            href={`tel:${order.customer.phone}`}
                            className="text-neutral-600 hover:text-neutral-900 font-mono text-[11px] flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3 text-neutral-400" />
                            <span>{order.customer.phone}</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              const msg = `Namaste ${order.customer.name},\nRegarding your order #${order.orderNumber} with ${settings.boutiqueName}: Our concierge desk is reviewing your dispute.`;
                              openWhatsApp(order.customer.phone, msg);
                            }}
                            className="text-emerald-700 hover:text-emerald-900 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3 text-emerald-600" />
                            <span>WhatsApp</span>
                          </button>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1">
                          {order.customer.city}, {order.customer.state} ({order.customer.pincode})
                        </p>
                      </div>

                      {/* Items & Total */}
                      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {order.items[0]?.product?.images?.[0] && (
                            <img
                              src={order.items[0].product.images[0]}
                              alt="Saree"
                              className="w-8 h-8 rounded-lg object-cover border border-neutral-200 shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-neutral-800 font-medium truncate max-w-[160px]">
                              {order.items.map((i) => `${i.quantity}x ${i.product.title}`).join(', ')}
                            </p>
                            <p className="text-[10px] text-neutral-400">
                              Payment: {formatPrice(order.totalAmount)}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-neutral-900">
                          {formatPrice(order.totalAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Customer Issue Complaint Callout */}
                    <div className="lg:col-span-2 space-y-2">
                      <div className={`p-3 rounded-xl border text-xs ${
                        issueType === 'cancellation'
                          ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                          : issueType === 'delivery'
                          ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                          : 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold flex items-center gap-1.5 uppercase text-[10px] tracking-wide">
                            {issueType === 'cancellation' ? (
                              <>
                                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                                <span>Cancellation Request Reason</span>
                              </>
                            ) : issueType === 'delivery' ? (
                              <>
                                <Truck className="w-3.5 h-3.5 text-amber-600" />
                                <span>Customer Non-Receipt Report</span>
                              </>
                            ) : (
                              <>
                                <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Refund Not Received Inquiry</span>
                              </>
                            )}
                          </span>

                          <span className="text-[10px] text-neutral-500">
                            {order.deliveryIssue?.reportedAt || order.cancellationRequest?.requestedAt
                              ? new Date(order.deliveryIssue?.reportedAt || order.cancellationRequest?.requestedAt || '').toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                              : 'Pending review'}
                          </span>
                        </div>

                        <p className="text-neutral-800 font-medium leading-relaxed">
                          "{order.cancellationRequest?.reason || order.deliveryIssue?.issueDescription || 'Customer submitted issue investigation request.'}"
                        </p>

                        {/* Associated Context Details Callout on the Card */}
                        {issueType === 'delivery' && order.shippingDetails && (
                          <div className="mt-2 pt-2 border-t border-amber-200/80 flex items-center justify-between text-[11px] text-amber-900 flex-wrap gap-2">
                            <span>
                              <strong>Courier:</strong> {order.shippingDetails.courierName} (#{order.shippingDetails.trackingNumber})
                            </span>
                            {trackingUrl && (
                              <a
                                href={trackingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-bold text-rose-800 hover:underline"
                              >
                                <span>Track on Carrier Website</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}

                        {issueType === 'refund' && order.refundDetails && (
                          <div className="mt-2 pt-2 border-t border-indigo-200/80 flex items-center justify-between text-[11px] text-indigo-900 flex-wrap gap-2">
                            <span>
                              <strong>Refund Status:</strong> {order.refundDetails.refundStatus === 'processed' ? 'Processed' : 'Pending'}
                              {order.refundDetails.refundUtr && ` (UTR: ${order.refundDetails.refundUtr})`}
                            </span>
                            <span>
                              <strong>Target UPI:</strong> {order.refundDetails.refundUpiId || order.customer.phone}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Handler Attribution & Assignment Controls */}
                      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          {isUnassigned ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                              <span>⚠️ Unassigned Queue</span>
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                              isAssignedToMe
                                ? 'bg-blue-100 text-blue-900 border-blue-300'
                                : 'bg-neutral-100 text-neutral-800 border-neutral-200'
                            }`}>
                              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                              <span>Assigned to: {issueStaffName || 'Staff Specialist'}</span>
                            </span>
                          )}

                          {/* Reassign / Assign Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setReassigningOrder(order);
                              setTargetStaffId(issueStaffId !== 'unassigned' ? issueStaffId : 'admin');
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>{isUnassigned ? 'Assign to Staff' : 'Reassign'}</span>
                          </button>
                        </div>

                        {/* 1-Click "Assign to Me" Button if unassigned or assigned to someone else */}
                        {!isAssignedToMe && (
                          <button
                            type="button"
                            onClick={() => handleAssignToMe(order)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition shadow-xs cursor-pointer"
                          >
                            <span>⚡ Assign to Me</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between flex-wrap gap-2">
                    {/* Left: Investigation Drawer & Original Order Page link */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setInvestigatingOrder(order);
                          setInvestigationTab('details');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        <Search className="w-3.5 h-3.5 text-amber-400" />
                        <span>Open & Investigate</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenOriginalOrderPage(order.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 text-xs font-semibold transition cursor-pointer"
                        title="Jump to the original complete order page in Order Manager"
                      >
                        <FileText className="w-3.5 h-3.5 text-neutral-600" />
                        <span>Open Original Order Page</span>
                        <ExternalLink className="w-3 h-3 text-neutral-400" />
                      </button>
                    </div>

                    {/* Right: Quick Contextual Actions based on Issue Type */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {issueType === 'cancellation' && !isClosed && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setCancellationApproveOrder(order);
                              setCancellationApproveUtr(`UTR${Date.now().toString().slice(-8)}`);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve & Issue Refund (Auto-Restock)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setCancellationDeclineOrder(order)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-semibold transition cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Decline Request</span>
                          </button>
                        </>
                      )}

                      {issueType === 'refund' && !isClosed && order.refundDetails?.refundStatus !== 'processed' && (
                        <button
                          type="button"
                          onClick={() => {
                            setRefundProcessingOrder(order);
                            setProcessRefundUtr(`UTR${Date.now().toString().slice(-8)}`);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Process Refund (Enter UTR)</span>
                        </button>
                      )}

                      {!isClosed && (
                        <button
                          type="button"
                          onClick={() => setResolvingOrder(order)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold transition cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>State as Resolved & Closed</span>
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

      {/* ========================================================================= */}
      {/* Comprehensive Dedicated Investigation Modal / Drawer                      */}
      {/* ========================================================================= */}
      {currentInvestigatingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-neutral-200 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between bg-neutral-900 text-white">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-serif font-bold text-lg text-white">
                    Order Investigation: #{currentInvestigatingOrder.orderNumber}
                  </h3>
                  {/* Issue Type */}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    getIssueType(currentInvestigatingOrder) === 'cancellation'
                      ? 'bg-rose-500 text-white'
                      : getIssueType(currentInvestigatingOrder) === 'delivery'
                      ? 'bg-amber-400 text-neutral-950'
                      : 'bg-indigo-400 text-neutral-950'
                  }`}>
                    {getIssueType(currentInvestigatingOrder) === 'cancellation'
                      ? '1. Cancellation Request'
                      : getIssueType(currentInvestigatingOrder) === 'delivery'
                      ? '2. Delivery Dispute'
                      : '3. Refund Report'}
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Customer: {currentInvestigatingOrder.customer.name} ({currentInvestigatingOrder.customer.phone}) • {formatPrice(currentInvestigatingOrder.totalAmount)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenOriginalOrderPage(currentInvestigatingOrder.id)}
                  className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition cursor-pointer"
                  title="Open in Order Manager"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Original Order</span>
                  <ExternalLink className="w-3 h-3" />
                </button>

                <button
                  onClick={() => setInvestigatingOrder(null)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Sub-Tabs: Details, Investigation Log, Live Chat */}
            <div className="flex border-b border-neutral-200 bg-neutral-50 px-4 pt-2">
              <button
                onClick={() => setInvestigationTab('details')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                  investigationTab === 'details'
                    ? 'border-neutral-900 text-neutral-900'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800'
                }`}
              >
                Dispute Details & Actions
              </button>
              <button
                onClick={() => setInvestigationTab('log')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  investigationTab === 'log'
                    ? 'border-neutral-900 text-neutral-900'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800'
                }`}
              >
                <span>Investigation Log</span>
                <span className="px-1.5 py-0.2 rounded-full bg-neutral-200 text-neutral-800 text-[10px]">
                  {(currentInvestigatingOrder.deliveryIssue?.investigationComments?.length || 0) +
                    (currentInvestigatingOrder.assignmentHistory?.length || 0)}
                </span>
              </button>
              <button
                onClick={() => setInvestigationTab('chat')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  investigationTab === 'chat'
                    ? 'border-neutral-900 text-neutral-900'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800'
                }`}
              >
                <span>Customer Live Chat</span>
                {currentInvestigatingOrder.chatMessages && currentInvestigatingOrder.chatMessages.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px]">
                    {currentInvestigatingOrder.chatMessages.length}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
              {investigationTab === 'details' && (
                <div className="space-y-6">
                  {/* Current Handler & Status Banner */}
                  {(() => {
                    const drawerStaffId = getIssueStaffId(currentInvestigatingOrder);
                    const drawerStaffName = getIssueStaffName(currentInvestigatingOrder);
                    const isDrawerUnassigned = !drawerStaffId || drawerStaffId === 'unassigned';
                    return (
                      <div className="p-3.5 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-between flex-wrap gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-700">Customer Issue Handler:</span>
                          <span className="font-bold text-neutral-900">
                            {!isDrawerUnassigned ? drawerStaffName : '⚠️ Unassigned Queue'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReassigningOrder(currentInvestigatingOrder);
                              setTargetStaffId(drawerStaffId !== 'unassigned' ? drawerStaffId : 'admin');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white border border-neutral-300 font-semibold text-neutral-800 hover:bg-neutral-50 transition cursor-pointer"
                          >
                            Reassign Handler
                          </button>

                          {drawerStaffId !== currentUserId && (
                            <button
                              type="button"
                              onClick={() => handleAssignToMe(currentInvestigatingOrder)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition cursor-pointer"
                            >
                              ⚡ Take Ownership
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ============================================================== */}
                  {/* WORKFLOW CONDITION 1: For Cancellation Request                  */}
                  {/* ============================================================== */}
                  {getIssueType(currentInvestigatingOrder) === 'cancellation' && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-rose-700 flex items-center gap-1.5">
                          <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                          <span>Order Cancellation Request</span>
                        </span>
                        <p className="text-sm font-semibold text-rose-950">
                          "{currentInvestigatingOrder.cancellationRequest?.reason || currentInvestigatingOrder.deliveryIssue?.issueDescription}"
                        </p>
                        <p className="text-[11px] text-rose-800">
                          Requested at: {currentInvestigatingOrder.cancellationRequest?.requestedAt
                            ? new Date(currentInvestigatingOrder.cancellationRequest.requestedAt).toLocaleString('en-IN')
                            : 'Recently'}
                        </p>
                      </div>

                      {/* Purchased Saree & Auto-Restock details */}
                      <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3">
                        <h4 className="font-serif font-bold text-sm text-neutral-900">
                          Saree Inventory & Refund Summary
                        </h4>
                        <div className="space-y-2">
                          {currentInvestigatingOrder.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-neutral-200/60 last:border-0">
                              <div className="flex items-center gap-2">
                                {item.product.images?.[0] && (
                                  <img
                                    src={item.product.images[0]}
                                    alt="Saree"
                                    className="w-10 h-10 rounded-lg object-cover border border-neutral-200"
                                  />
                                )}
                                <div>
                                  <p className="font-semibold text-neutral-900">{item.product.title}</p>
                                  <p className="text-[11px] text-neutral-500">
                                    SKU: {item.product.productCode} • Qty: {item.quantity}
                                  </p>
                                </div>
                              </div>
                              <span className="font-bold text-neutral-900">
                                {formatPrice(item.product.price * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-neutral-200 flex items-center justify-between text-xs font-bold text-neutral-900">
                          <span>Total Refund Payable:</span>
                          <span className="text-rose-700 text-sm font-serif">
                            {formatPrice(currentInvestigatingOrder.totalAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Prominent Action Buttons required by Workflow */}
                      <div className="p-4 rounded-xl bg-neutral-950 text-white space-y-3">
                        <h4 className="font-serif font-bold text-sm text-amber-300">
                          Concierge Resolution Actions
                        </h4>
                        <p className="text-xs text-neutral-300 leading-relaxed">
                          Approving the cancellation automatically replenishes the pure handloom saree stock in real time, issues refund verification to the customer, and moves the order to the Closed Bucket.
                        </p>

                        <div className="flex items-center gap-3 pt-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setCancellationApproveOrder(currentInvestigatingOrder);
                              setCancellationApproveUtr(`UTR${Date.now().toString().slice(-8)}`);
                            }}
                            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold text-xs transition shadow-sm cursor-pointer flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Approve Cancellation & Issue Refund (Auto-Restock)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setCancellationDeclineOrder(currentInvestigatingOrder)}
                            className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-rose-300 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5"
                          >
                            <Ban className="w-4 h-4" />
                            <span>Decline Request</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ============================================================== */}
                  {/* WORKFLOW CONDITION 2: For Delivery Dispute                      */}
                  {/* ============================================================== */}
                  {getIssueType(currentInvestigatingOrder) === 'delivery' && (
                    <div className="space-y-4">
                      {/* Customer Non-receipt notice */}
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-800 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-amber-600" />
                          <span>Customer Delivery Dispute</span>
                        </span>
                        <p className="text-sm font-semibold text-amber-950">
                          "{currentInvestigatingOrder.deliveryIssue?.issueDescription || 'Customer reports non-delivery despite Delivered / Shipped status.'}"
                        </p>
                      </div>

                      {/* Associated Courier Details Section (Required by Workflow) */}
                      <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-serif font-bold text-sm text-neutral-900 flex items-center gap-1.5">
                            <Truck className="w-4 h-4 text-purple-600" />
                            <span>Associated Courier & Dispatch Details</span>
                          </h4>
                          {currentInvestigatingOrder.shippingDetails?.trackingNumber && (
                            <span className="font-mono text-xs font-bold text-neutral-900 bg-white px-2 py-0.5 rounded border border-neutral-200">
                              #{currentInvestigatingOrder.shippingDetails.trackingNumber}
                            </span>
                          )}
                        </div>

                        {currentInvestigatingOrder.shippingDetails ? (() => {
                          const modalCourier = resolveCourierDetails(
                            currentInvestigatingOrder.shippingDetails?.courierName,
                            settings.courierServices,
                            currentInvestigatingOrder.customer.city
                          );
                          const modalTrackingUrl = buildCourierTrackingUrl(
                            modalCourier,
                            currentInvestigatingOrder.shippingDetails?.courierName,
                            currentInvestigatingOrder.shippingDetails?.trackingNumber
                          );

                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div className="p-3 bg-white rounded-lg border border-neutral-200 space-y-1">
                                <span className="text-[10px] text-neutral-500 font-medium">Courier Partner:</span>
                                <p className="font-bold text-neutral-900 text-sm">
                                  {currentInvestigatingOrder.shippingDetails.courierName}
                                </p>
                                {currentInvestigatingOrder.shippingDetails.shippedAt && (
                                  <p className="text-[11px] text-neutral-500">
                                    Dispatched: {new Date(currentInvestigatingOrder.shippingDetails.shippedAt).toLocaleString('en-IN')}
                                  </p>
                                )}
                                {modalTrackingUrl && (
                                  <a
                                    href={modalTrackingUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 font-bold text-rose-700 hover:underline pt-1 text-[11px]"
                                  >
                                    <span>Open Live Carrier Tracking</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>

                              {/* Hub Office Details */}
                              {modalCourier ? (
                                <div className="p-3 bg-white rounded-lg border border-neutral-200 space-y-1">
                                  <span className="text-[10px] text-neutral-500 font-medium">Dispatch Branch Hub:</span>
                                  <p className="font-semibold text-neutral-900">
                                    {modalCourier.addressLine1}, {modalCourier.city} ({modalCourier.pincode})
                                  </p>
                                  <div className="flex items-center gap-3 pt-1">
                                    {modalCourier.phone && (
                                      <a
                                        href={`tel:${modalCourier.phone}`}
                                        className="text-neutral-700 hover:text-neutral-900 font-mono text-[11px] flex items-center gap-1"
                                      >
                                        <Phone className="w-3 h-3 text-neutral-400" />
                                        <span>{modalCourier.phone}</span>
                                      </a>
                                    )}
                                    {modalCourier.mapsUrl && (
                                      <a
                                        href={modalCourier.mapsUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-700 hover:underline text-[11px] flex items-center gap-1"
                                      >
                                        <MapPin className="w-3 h-3 text-blue-600" />
                                        <span>Google Maps</span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="p-3 bg-white rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-500 text-xs">
                                  Courier hub contact details can be configured under Boutique Settings.
                                </div>
                              )}
                            </div>
                          );
                        })() : (
                          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
                            No consignment shipping details have been attached to this order yet.
                          </div>
                        )}
                      </div>

                      {/* State as Resolved & Closed */}
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setResolvingOrder(currentInvestigatingOrder)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          <span>State as Resolved & Move to Closed Bucket</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ============================================================== */}
                  {/* WORKFLOW CONDITION 3: For Refund Report                         */}
                  {/* ============================================================== */}
                  {getIssueType(currentInvestigatingOrder) === 'refund' && (
                    <div className="space-y-4">
                      {/* Customer refund dispute notice */}
                      <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-800 flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Customer Refund Report</span>
                        </span>
                        <p className="text-sm font-semibold text-indigo-950">
                          "{currentInvestigatingOrder.deliveryIssue?.issueDescription || 'Customer submitted inquiry: Refund not received in bank account.'}"
                        </p>
                      </div>

                      {/* Associated Refund Details Section (Required by Workflow) */}
                      <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3">
                        <h4 className="font-serif font-bold text-sm text-neutral-900 flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-indigo-600" />
                          <span>Associated Refund & Bank Settlement Details</span>
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 bg-white rounded-lg border border-neutral-200 space-y-1">
                            <span className="text-[10px] text-neutral-500 font-medium">Refund Amount:</span>
                            <p className="font-bold text-rose-700 text-base font-serif">
                              {formatPrice(currentInvestigatingOrder.totalAmount)}
                            </p>
                            <p className="text-[11px] text-neutral-500">
                              Original Payment UTR: {currentInvestigatingOrder.upiTransactionId || 'N/A'}
                            </p>
                          </div>

                          <div className="p-3 bg-white rounded-lg border border-neutral-200 space-y-1">
                            <span className="text-[10px] text-neutral-500 font-medium">Customer UPI / Account:</span>
                            <p className="font-semibold text-neutral-900 font-mono">
                              {currentInvestigatingOrder.refundDetails?.refundUpiId || currentInvestigatingOrder.customer.phone}
                            </p>
                            <p className="text-[11px] text-neutral-500">
                              Status: <strong className={currentInvestigatingOrder.refundDetails?.refundStatus === 'processed' ? 'text-emerald-700' : 'text-amber-700'}>
                                {currentInvestigatingOrder.refundDetails?.refundStatus === 'processed' ? 'Processed' : 'Pending'}
                              </strong>
                            </p>
                          </div>

                          {currentInvestigatingOrder.refundDetails?.refundUtr && (
                            <div className="sm:col-span-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-950 space-y-0.5">
                              <p className="font-bold">
                                Bank Settlement UTR Reference: {currentInvestigatingOrder.refundDetails.refundUtr}
                              </p>
                              <p className="text-[11px] text-emerald-800">
                                Transferred via {currentInvestigatingOrder.refundDetails.refundTool || 'UPI Banking'}
                                {currentInvestigatingOrder.refundDetails.processedAt && ` on ${new Date(currentInvestigatingOrder.refundDetails.processedAt).toLocaleString('en-IN')}`}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Process refund button if still pending */}
                        {currentInvestigatingOrder.refundDetails?.refundStatus !== 'processed' && (
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRefundProcessingOrder(currentInvestigatingOrder);
                                setProcessRefundUtr(`UTR${Date.now().toString().slice(-8)}`);
                              }}
                              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-xs cursor-pointer flex items-center gap-1.5"
                            >
                              <CreditCard className="w-4 h-4" />
                              <span>Complete & Issue Refund to Customer</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* State as Resolved & Closed */}
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setResolvingOrder(currentInvestigatingOrder)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          <span>State as Resolved & Move to Closed Bucket</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================== */}
              {/* SUB-TAB 2: Investigation Log Section (Required by Workflow)     */}
              {/* ============================================================== */}
              {investigationTab === 'log' && (
                <div className="space-y-5">
                  {/* Add New Note Box */}
                  <form onSubmit={handleAddLogComment} className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
                    <label className="block text-xs font-bold text-neutral-800">
                      Add Investigation Note / Staff Action Log
                    </label>
                    <textarea
                      value={newLogComment}
                      onChange={(e) => setNewLogComment(e.target.value)}
                      placeholder="e.g. Contacted DTDC branch manager; courier confirmed delivery at door to customer's family member..."
                      rows={3}
                      className="w-full p-2.5 rounded-lg border border-neutral-300 text-xs text-neutral-900 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-950"
                      required
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmittingLog || !newLogComment.trim()}
                        className="px-4 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Log Note</span>
                      </button>
                    </div>
                  </form>

                  {/* Chronological Audit Log Entries */}
                  <div className="space-y-2">
                    <h4 className="font-serif font-bold text-sm text-neutral-900">
                      Investigation History & Audit Trail
                    </h4>

                    {/* Investigation Comments */}
                    {(currentInvestigatingOrder.deliveryIssue?.investigationComments || []).map((comm) => (
                      <div key={comm.id} className="p-3 rounded-xl bg-white border border-neutral-200 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-neutral-900 flex items-center gap-1">
                            <User className="w-3 h-3 text-neutral-400" />
                            <span>{comm.author}</span>
                          </span>
                          <span className="text-neutral-400">
                            {new Date(comm.timestamp).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <p className="text-neutral-700 leading-relaxed font-medium">
                          {comm.comment}
                        </p>
                      </div>
                    ))}

                    {/* Assignment History logs */}
                    {(currentInvestigatingOrder.assignmentHistory || []).map((log) => (
                      <div key={log.id} className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/80 text-xs space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] text-neutral-500">
                          <span className="font-semibold text-neutral-700">{log.action}</span>
                          <span>{new Date(log.timestamp).toLocaleString('en-IN')}</span>
                        </div>
                        {log.note && (
                          <p className="text-[11px] text-neutral-600 font-medium">
                            {log.note}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* SUB-TAB 3: Direct Live Chat with Customer                       */}
              {/* ============================================================== */}
              {investigationTab === 'chat' && (
                <div className="h-[480px]">
                  <OrderLiveChat
                    order={currentInvestigatingOrder}
                    mode="admin"
                    title={`Live Chat with ${currentInvestigatingOrder.customer.name}`}
                    className="h-full"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleOpenOriginalOrderPage(currentInvestigatingOrder.id)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-800 hover:text-neutral-950 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Jump to Original Order Page</span>
                <ExternalLink className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={() => setInvestigatingOrder(null)}
                className="px-4 py-1.5 rounded-xl bg-neutral-900 text-white font-semibold text-xs hover:bg-neutral-800 transition cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Assignment / Reassignment Modal                                            */}
      {/* ========================================================================= */}
      {reassigningOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <form
            onSubmit={handleConfirmReassign}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-lg text-neutral-900">
                Assign Customer Issue
              </h3>
              <button
                type="button"
                onClick={() => setReassigningOrder(null)}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-600">
              Assign Order #{reassigningOrder.orderNumber} ({reassigningOrder.customer.name}) to a staff specialist or Store Owner. This will immediately move the order into their Customer Issue Bucket.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-700">Select Assignee:</label>
              <select
                value={targetStaffId}
                onChange={(e) => setTargetStaffId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-neutral-950"
              >
                <option value="admin">👑 Store Owner / Admin Bucket</option>
                {staffMembers.map((s) => (
                  <option key={s.id} value={s.id}>
                    👤 {s.name} (@{s.username})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-700">Handover Note (Optional):</label>
              <input
                type="text"
                value={reassignmentNote}
                onChange={(e) => setReassignmentNote(e.target.value)}
                placeholder="e.g. Please verify delivery POD with DTDC Salem hub"
                className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-950"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReassigningOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Confirm Assignment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Cancellation Approval Modal with Auto-Restock                              */}
      {/* ========================================================================= */}
      {cancellationApproveOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between text-emerald-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-serif font-bold text-lg text-neutral-900">
                  Approve Cancellation & Issue Refund
                </h3>
              </div>
              <button
                onClick={() => setCancellationApproveOrder(null)}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Order #{cancellationApproveOrder.orderNumber} for {cancellationApproveOrder.customer.name} will be marked as Cancelled. Physical inventory will be <strong>restored by the exact quantity purchased</strong>, and the issue will be moved to the <strong>Closed Bucket</strong>.
            </p>

            {/* Exact Restocked Items Breakdown */}
            {cancellationApproveOrder.items && cancellationApproveOrder.items.length > 0 && (
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-900">
                  Exact Items & Physical Quantities to Restore:
                </p>
                <div className="space-y-1">
                  {cancellationApproveOrder.items.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white/80 px-2.5 py-1.5 rounded-lg text-[11px] border border-blue-200">
                      <span className="font-medium text-neutral-800 truncate max-w-[220px]">
                        {it.product.title}
                      </span>
                      <span className="font-bold text-emerald-700 shrink-0">
                        +{it.quantity} {it.quantity > 1 ? 'items' : 'item'} to stock
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs space-y-1">
              <div className="flex justify-between font-bold text-neutral-900">
                <span>Refund Amount:</span>
                <span className="text-rose-700 text-sm font-serif">{formatPrice(cancellationApproveOrder.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Customer Refund UPI:</span>
                <span className="font-mono">{cancellationApproveOrder.refundDetails?.refundUpiId || cancellationApproveOrder.customer.phone}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Refund Bank Transaction UTR:</label>
                <input
                  type="text"
                  value={cancellationApproveUtr}
                  onChange={(e) => setCancellationApproveUtr(e.target.value)}
                  placeholder="12-digit Bank Reference UTR"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 font-mono text-neutral-900 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-950"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Refund Tool / Channel:</label>
                <select
                  value={cancellationApproveTool}
                  onChange={(e) => setCancellationApproveTool(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs bg-white font-medium focus:outline-none focus:ring-1 focus:ring-neutral-950"
                >
                  <option value="UPI Banking">UPI Banking (GPay / PhonePe / Paytm / BHIM)</option>
                  <option value="NetBanking IMPS">NetBanking IMPS</option>
                  <option value="NEFT Settlement">NEFT Settlement</option>
                  <option value="Direct Wallet">Direct Wallet Transfer</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Resolution Summary Note:</label>
                <input
                  type="text"
                  value={cancellationApproveNotes}
                  onChange={(e) => setCancellationApproveNotes(e.target.value)}
                  placeholder="e.g. Cancellation approved by concierge. Saree auto-restocked."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-950"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancellationApproveOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmCancellationApproval(cancellationApproveOrder)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Approve, Restock & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Cancellation Decline Modal                                                 */}
      {/* ========================================================================= */}
      {cancellationDeclineOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between text-rose-700">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-600" />
                <h3 className="font-serif font-bold text-lg text-neutral-900">
                  Decline Cancellation Request
                </h3>
              </div>
              <button
                onClick={() => setCancellationDeclineOrder(null)}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Decline the cancellation request for Order #{cancellationDeclineOrder.orderNumber}. The order will remain in active processing, and the dispute will be marked as resolved and closed.
            </p>

            <div className="space-y-1.5 text-xs">
              <label className="block font-bold text-neutral-700">Reason for Declining:</label>
              <textarea
                value={cancellationDeclineReason}
                onChange={(e) => setCancellationDeclineReason(e.target.value)}
                rows={3}
                className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-950"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancellationDeclineOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmCancellationDecline(cancellationDeclineOrder)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Confirm Decline & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* State as Resolved & Closed Modal                                          */}
      {/* ========================================================================= */}
      {resolvingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <form
            onSubmit={handleConfirmResolve}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4"
          >
            <div className="flex items-center justify-between text-emerald-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-serif font-bold text-lg text-neutral-900">
                  State Order as Resolved & Closed
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResolvingOrder(null)}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Order #{resolvingOrder.orderNumber} ({resolvingOrder.customer.name}) will be marked as officially resolved. It will <strong>automatically move to the Closed Bucket</strong>.
            </p>

            <div className="space-y-1.5 text-xs">
              <label className="block font-bold text-neutral-700">Resolution Summary Notes:</label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="e.g. Courier POD verified with DTDC hub. Customer confirmed parcel receipt from apartment security desk."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-950"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResolvingOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Resolve & Move to Closed Bucket
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Reopen Closed Issue Modal                                                 */}
      {/* ========================================================================= */}
      {reopeningOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <form
            onSubmit={handleConfirmReopen}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4"
          >
            <div className="flex items-center justify-between text-amber-800">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-600" />
                <h3 className="font-serif font-bold text-lg text-neutral-900">
                  Reopen Customer Issue
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReopeningOrder(null)}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Order #{reopeningOrder.orderNumber} will be reopened and moved back to the active queue for further investigation. A mandatory explanation is required.
            </p>

            <div className="space-y-1.5 text-xs">
              <label className="block font-bold text-neutral-700">Reason for Reopening:</label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="e.g. Customer stated that recipient was incorrect person; carrier investigation resumed."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-950"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReopeningOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Confirm Reopen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Manual Refund Processing Modal                                            */}
      {/* ========================================================================= */}
      {refundProcessingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between text-indigo-700">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <h3 className="font-serif font-bold text-lg text-neutral-900">
                  Process & Record Customer Refund
                </h3>
              </div>
              <button
                onClick={() => setRefundProcessingOrder(null)}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Record bank transfer details for Order #{refundProcessingOrder.orderNumber} ({refundProcessingOrder.customer.name}). Upon processing, the order will be marked as Refunded and moved to the Closed Bucket.
            </p>

            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs space-y-1">
              <div className="flex justify-between font-bold text-neutral-900">
                <span>Refund Amount:</span>
                <span className="text-rose-700 text-sm font-serif">{formatPrice(refundProcessingOrder.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Customer Refund Target:</span>
                <span className="font-mono">{refundProcessingOrder.refundDetails?.refundUpiId || refundProcessingOrder.customer.phone}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Bank Reference / UTR Number:</label>
                <input
                  type="text"
                  value={processRefundUtr}
                  onChange={(e) => setProcessRefundUtr(e.target.value)}
                  placeholder="12-digit UTR reference ID"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 font-mono text-neutral-900 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-950"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Refund Channel:</label>
                <select
                  value={processRefundTool}
                  onChange={(e) => setProcessRefundTool(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs bg-white font-medium focus:outline-none focus:ring-1 focus:ring-neutral-950"
                >
                  <option value="UPI Banking">UPI Banking (Google Pay, PhonePe, Paytm)</option>
                  <option value="NetBanking IMPS">NetBanking IMPS</option>
                  <option value="NEFT Bank Transfer">NEFT Bank Transfer</option>
                  <option value="Card Gateway Refund">Card Gateway Reversal</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Concierge Notes (Optional):</label>
                <input
                  type="text"
                  value={processRefundNotes}
                  onChange={(e) => setProcessRefundNotes(e.target.value)}
                  placeholder="e.g. Verified with customer over WhatsApp"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-950"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRefundProcessingOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmProcessRefund(refundProcessingOrder)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Confirm Refund & Move to Closed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
